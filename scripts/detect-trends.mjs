import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const OUTPUT_PATH = path.join(process.cwd(), 'client', 'public', 'data', 'trends.json');
const ARTICLES_PATH = path.join(process.cwd(), 'client', 'public', 'data', 'articles.json');

const TREND_WINDOW_DAYS = 14;
const CONFIRMED_MIN_ARTICLES = 4;
const CONFIRMED_MIN_SOURCES = 2;
const TREND_RETENTION_DAYS = 365;
const SIGNAL_TYPES = ['source_authority', 'claim_magnitude', 'cross_topic', 'velocity'];

export function windowArticles(articles, days, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  return articles.filter(a => {
    if (!a.publishedAt) return false;
    const d = new Date(a.publishedAt);
    return !isNaN(d) && d >= cutoff;
  });
}

export function shouldRun(lastRunAt, now, force = false) {
  if (force) return true;
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  if (isNaN(last)) return true;
  return last.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
}

function slugify(name) {
  const s = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  return s || 'trend';
}

function uniqueId(base, used) {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function dedupeArticles(existing, incoming) {
  const seen = new Set(existing.map(a => a.url));
  const merged = [...existing];
  for (const a of incoming) {
    if (!seen.has(a.url)) {
      seen.add(a.url);
      merged.push(a);
    }
  }
  return merged;
}

function meetsConfirmedThresholds(articles, sources) {
  return articles.length >= CONFIRMED_MIN_ARTICLES && sources.length >= CONFIRMED_MIN_SOURCES;
}

// Claude's response is untrusted input: drop any article whose url doesn't
// actually exist in the corpus we sent (a hallucinated "citation" must
// never become permanent archive evidence), source fields from the corpus
// record rather than the model's echo, and drop any signalTypes value
// outside our vocabulary (a junk value would render raw in the UI forever).
export function sanitizeClusters(clusters, inWindow) {
  const byUrl = new Map(inWindow.map(a => [a.url, a]));
  return clusters.map(cluster => {
    const articles = (cluster.articles || [])
      .filter(a => a && byUrl.has(a.url))
      .map(a => {
        const corpus = byUrl.get(a.url);
        return { url: corpus.url, title: corpus.title, source: corpus.source, publishedAt: corpus.publishedAt };
      });
    const signalTypes = (cluster.signalTypes || []).filter(s => SIGNAL_TYPES.includes(s));
    return { ...cluster, articles, signalTypes };
  });
}

function mergeIntoExisting(existing, cluster, today) {
  const articles = dedupeArticles(existing.articles, cluster.articles || []);
  const sources = [...new Set(articles.map(a => a.source))];
  const signalTypes = [...new Set([...(existing.signalTypes || []), ...(cluster.signalTypes || [])])];

  // Already-confirmed archive trends never demote. A trend newly claiming
  // confirmed status this run must actually clear the article/source
  // thresholds on its OWN evidence from this run (not the lifetime
  // accumulated total), not just be asserted by the LLM (guards against a
  // long-lived emerging trend crossing the confirmed bar on a single new
  // article, or one prolific source posting near-duplicate items).
  const clusterArticles = dedupeArticles([], cluster.articles || []);
  const clusterSources = [...new Set(clusterArticles.map(a => a.source))];
  const status = existing.status === 'confirmed'
    || (cluster.status === 'confirmed' && meetsConfirmedThresholds(clusterArticles, clusterSources))
    ? 'confirmed' : 'emerging';

  return {
    ...existing,
    name: cluster.name || existing.name,
    status,
    lastActive: today,
    cooledAt: null,
    rationale: cluster.rationale || existing.rationale,
    signalTypes,
    articleCount: articles.length,
    sources,
    articles,
  };
}

function newTrendRecord(id, cluster, today) {
  const articles = dedupeArticles([], cluster.articles || []);
  const sources = [...new Set(articles.map(a => a.source))];
  const status = cluster.status === 'confirmed' && meetsConfirmedThresholds(articles, sources)
    ? 'confirmed' : 'emerging';

  return {
    id,
    name: cluster.name || 'Untitled trend',
    status,
    firstDetected: today,
    lastActive: today,
    cooledAt: null,
    rationale: cluster.rationale || '',
    signalTypes: cluster.signalTypes || [],
    articleCount: articles.length,
    sources,
    articles,
  };
}

// Matching, promotion, cooling, and (via pruneTrends) retention — the whole
// archive lifecycle, pure and independent of the Claude call itself.
export function mergeTrends(clusters, archiveTrends, today) {
  const archiveById = new Map(archiveTrends.map(t => [t.id, t]));
  const usedIds = new Set(archiveTrends.map(t => t.id));
  const matchedIds = new Set();
  const result = [];

  for (const cluster of clusters) {
    const existing = cluster.id ? archiveById.get(cluster.id) : null;
    if (existing && existing.status !== 'cooled' && !matchedIds.has(existing.id)) {
      matchedIds.add(existing.id);
      result.push(mergeIntoExisting(existing, cluster, today));
    } else {
      const id = uniqueId(slugify(cluster.name), usedIds);
      usedIds.add(id);
      result.push(newTrendRecord(id, cluster, today));
    }
  }

  for (const t of archiveTrends) {
    if (matchedIds.has(t.id)) continue;
    if (t.status === 'cooled') {
      result.push(t);
    } else {
      result.push({ ...t, status: 'cooled', cooledAt: today });
    }
  }

  return result;
}

export function pruneTrends(trends, today, retentionDays = TREND_RETENTION_DAYS) {
  const todayMs = new Date(today).getTime();
  return trends.filter(t => {
    if (t.status !== 'cooled' || !t.cooledAt) return true;
    const cooledMs = new Date(t.cooledAt).getTime();
    return (todayMs - cooledMs) / 86400000 <= retentionDays;
  });
}

function buildTrendsPrompt(articles, existingTrends) {
  const articlesBlock = articles.map(a => JSON.stringify({
    url: a.url, title: a.title, summary: a.summary, source: a.source,
    publishedAt: a.publishedAt, topic: a.topic,
  })).join('\n');
  const existingBlock = existingTrends.length
    ? existingTrends.map(t => JSON.stringify({ id: t.id, name: t.name, rationale: t.rationale, status: t.status })).join('\n')
    : '(none)';

  return `You are a trend analyst for a physical security industry news dashboard. Identify emergent themes ("trends") across the articles below from the last ${TREND_WINDOW_DAYS} days — a trend is a specific, dated narrative, not a broad category like "AI" or "cybersecurity".

ARTICLES (one JSON object per line):
${articlesBlock}

CURRENTLY ACTIVE TRENDS FROM PRIOR RUNS (match new evidence to these by id when it's the same theme, instead of creating a duplicate):
${existingBlock}

For each distinct trend you identify, output an object with:
- "id": the matching existing trend's id if this is the same theme, otherwise null
- "name": short trend name (plain text, no markdown)
- "status": "confirmed" if at least ${CONFIRMED_MIN_ARTICLES} of the articles above, from at least ${CONFIRMED_MIN_SOURCES} different sources, support it; otherwise "emerging" if it's low-volume but shows strong early signal
- "rationale": 2-4 plain-text sentences explaining why this is a trend (confirmed) or why it looks like it could become one (emerging) — name the specific evidence
- "signalTypes": for "emerging" only, an array using only these values: ${SIGNAL_TYPES.map(s => `"${s}"`).join(', ')}. Empty array if status is "confirmed".
  - "source_authority": a named major vendor, SIA, or a named executive/speaker is quoted
  - "claim_magnitude": funding, acquisition, new regulation, or a breach affecting many organizations
  - "cross_topic": the theme spans multiple different topic categories
  - "velocity": multiple articles published within days of each other
- "articles": array of {"url", "title", "source", "publishedAt"} for every supporting article from the list above

Respond with ONLY a JSON array of these objects, no markdown fences, no other text. If no theme in the articles rises to either tier, respond with an empty array [].`;
}

function parseTrendsResponse(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [];
}

export async function callClaude(anthropic, articles, existingTrends) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildTrendsPrompt(articles, existingTrends) }],
  });
  const text = response.content[0]?.text;
  if (!text) return null;
  try {
    return parseTrendsResponse(text);
  } catch (e) {
    console.warn('detect-trends: failed to parse Claude response:', e.message);
    return null;
  }
}

async function loadArticles() {
  try {
    const raw = await readFile(ARTICLES_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

async function loadArchive() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const data = JSON.parse(raw);
    return { lastRunAt: data.lastRunAt || null, trends: Array.isArray(data.trends) ? data.trends : [] };
  } catch {
    return { lastRunAt: null, trends: [] };
  }
}

export async function run({ apiKey = process.env.ANTHROPIC_API_KEY, force = false, now = new Date() } = {}) {
  const archive = await loadArchive();
  if (!shouldRun(archive.lastRunAt, now, force)) {
    console.log('detect-trends: already ran today, skipping.');
    return archive;
  }

  const today = now.toISOString().slice(0, 10);
  const articles = await loadArticles();
  const inWindow = windowArticles(articles, TREND_WINDOW_DAYS, now);
  const activeExisting = archive.trends.filter(t => t.status !== 'cooled');

  if (inWindow.length === 0 || !apiKey) {
    console.warn('detect-trends: no articles in window or no API key; leaving archive unchanged.');
    return archive;
  }

  let clusters = null;
  const anthropic = new Anthropic({ apiKey });
  try {
    clusters = await callClaude(anthropic, inWindow, activeExisting);
  } catch (e) {
    console.warn('detect-trends: Claude call failed:', e.message);
  }

  if (clusters === null) {
    console.warn('detect-trends: no usable response from Claude; leaving archive unchanged.');
    return archive;
  }

  const sanitized = sanitizeClusters(clusters, inWindow);
  const merged = mergeTrends(sanitized, archive.trends, today);
  const pruned = pruneTrends(merged, today, TREND_RETENTION_DAYS);

  const payload = { lastRunAt: now.toISOString(), trends: pruned };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run({ force: process.env.FORCE_TRENDS === 'true' })
    .then(p => console.log(`Wrote ${p.trends.length} trends (lastRunAt ${p.lastRunAt}).`))
    .catch(e => {
      console.error('detect-trends failed:', e.message);
      process.exit(1);
    });
}
