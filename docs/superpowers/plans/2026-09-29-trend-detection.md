# Trend Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Trends" feature that clusters the article corpus into confirmed and emerging industry themes, with a permanent archive, and surfaces it as a new tab in the SecureWatch v2 dashboard.

**Architecture:** A new script (`scripts/detect-trends.mjs`) runs once/day as an added step in the existing `update-news.yml` workflow, right after `fetch-news`. It reads the last 14 days of `articles.json`, sends them plus the current non-cooled trend archive to a single Claude call, and merges the response into `client/public/data/trends.json` using pure, unit-tested matching/promotion/cooling/pruning logic. The client gets a new `useTrends` hook (mirrors `useNews`) and a "Trends" tab (`TrendsPanel` + `TrendCard`) alongside the existing feed.

**Tech Stack:** Node.js (`@anthropic-ai/sdk`), Vitest, React 18, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-trend-detection-design.md`

## Global Constraints

- `TREND_WINDOW_DAYS = 14` — only articles published in the last 14 days count as current evidence.
- `CONFIRMED_MIN_ARTICLES = 4` and `CONFIRMED_MIN_SOURCES = 2` — both required for `confirmed` status; below that bar a cluster can still be `emerging` if Claude flags at least one `signalTypes` entry.
- `signalTypes` values are exactly: `source_authority`, `claim_magnitude`, `cross_topic`, `velocity`.
- `TREND_RETENTION_DAYS = 365` — cooled trends are pruned only past this age; nothing else is ever deleted.
- `signalTypes` is **retained** (unioned, never cleared) when a trend promotes from `emerging` to `confirmed` — this is the plan's resolution of the spec's open item.
- Confirmed trends never demote back to `emerging` — only to `cooled`.
- Reuses the existing `ANTHROPIC_API_KEY` secret. No new secret.
- Cadence (once/day) is enforced in `detect-trends.mjs` itself, not in YAML — `run()` checks `trends.json`'s `lastRunAt` against the current UTC day and no-ops unless `force: true`.
- All merge/matching/promotion/cooling/pruning/window logic must be pure functions, unit-tested without touching the network or Claude — only the single Claude call itself gets mocked in tests. Mirrors `fetch-news.mjs` / `fetch-news.test.mjs`.

---

### Task 1: Add `detect-trends` npm script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run detect-trends` invoking `node scripts/detect-trends.mjs` (used by Task 4's workflow step).

- [ ] **Step 1: Edit `package.json`**

Change:
```json
  "scripts": {
    "fetch-news": "node scripts/fetch-news.mjs",
    "test": "vitest run scripts"
  },
```
to:
```json
  "scripts": {
    "fetch-news": "node scripts/fetch-news.mjs",
    "detect-trends": "node scripts/detect-trends.mjs",
    "test": "vitest run scripts"
  },
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add detect-trends npm script"
```

---

### Task 2: `scripts/detect-trends.mjs` — pure logic, with tests (TDD)

**Files:**
- Create: `scripts/detect-trends.mjs`
- Test: `scripts/detect-trends.test.mjs`

**Interfaces:**
- Consumes: nothing from other tasks (`fetch-news.mjs`'s `articles.json` output shape is already known: array of `{ id, title, summary, source, url, publishedAt, topic, fetchedAt, analysis? }`).
- Produces (used by Task 3's CLI entrypoint, and conceptually by the client in Task 5):
  - `export function windowArticles(articles, days, now = new Date())` → `Article[]`
  - `export function shouldRun(lastRunAt, now, force = false)` → `boolean`
  - `export function mergeTrends(clusters, archiveTrends, today)` → `Trend[]`
  - `export function pruneTrends(trends, today, retentionDays = TREND_RETENTION_DAYS)` → `Trend[]`
  - `export async function run({ apiKey, force, now } = {})` → writes `client/public/data/trends.json`, returns the payload `{ lastRunAt, trends }`
  - `Trend` shape: `{ id, name, status, firstDetected, lastActive, cooledAt, rationale, signalTypes, articleCount, sources, articles }` exactly as in the spec's Section 3.
  - `Cluster` shape (Claude's per-item response, also what tests hand to `mergeTrends`): `{ id: string|null, name, status: "emerging"|"confirmed", rationale, signalTypes: string[], articles: {url,title,source,publishedAt}[] }`.

This task is pure logic only — no Claude call is exercised in tests (that's mocked). Write the test file first, watch it fail, then implement.

- [ ] **Step 1: Write the failing test file**

Create `scripts/detect-trends.test.mjs`:

```javascript
import { describe, test, expect } from 'vitest';
import { windowArticles, shouldRun, mergeTrends, pruneTrends } from './detect-trends.mjs';

describe('windowArticles', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');

  test('keeps an article published within the window', () => {
    const articles = [{ url: 'a', publishedAt: '2026-09-20' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(1);
  });

  test('drops an article published before the window', () => {
    const articles = [{ url: 'a', publishedAt: '2026-09-01' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(0);
  });

  test('drops an article with no publishedAt', () => {
    const articles = [{ url: 'a', publishedAt: '' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(0);
  });
});

describe('shouldRun', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');

  test('true when lastRunAt is null', () => {
    expect(shouldRun(null, now)).toBe(true);
  });

  test('false when lastRunAt is the same UTC day', () => {
    expect(shouldRun('2026-09-29T01:00:00.000Z', now)).toBe(false);
  });

  test('true when lastRunAt is a prior UTC day', () => {
    expect(shouldRun('2026-09-28T23:59:00.000Z', now)).toBe(true);
  });

  test('force=true always returns true', () => {
    expect(shouldRun('2026-09-29T01:00:00.000Z', now, true)).toBe(true);
  });
});

describe('mergeTrends', () => {
  const today = '2026-09-29';

  test('creates a new trend record for an unmatched cluster', () => {
    const clusters = [{
      id: null, name: 'Deepfake ID fraud', status: 'emerging',
      rationale: 'Two vendors flagged this.', signalTypes: ['source_authority'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-20' }],
    }];
    const result = mergeTrends(clusters, [], today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Deepfake ID fraud', status: 'emerging',
      firstDetected: today, lastActive: today, cooledAt: null,
      signalTypes: ['source_authority'], articleCount: 1, sources: ['HID'],
    });
    expect(result[0].id).toBeTruthy();
  });

  test('updates a matched existing trend, appending deduped article evidence', () => {
    const existing = [{
      id: 'deepfake-id-fraud', name: 'Deepfake ID fraud', status: 'emerging',
      firstDetected: '2026-09-15', lastActive: '2026-09-20', cooledAt: null,
      rationale: 'old rationale', signalTypes: ['source_authority'],
      articleCount: 1, sources: ['HID'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-15' }],
    }];
    const clusters = [{
      id: 'deepfake-id-fraud', name: 'Deepfake ID fraud', status: 'emerging',
      rationale: 'new rationale', signalTypes: ['velocity'],
      articles: [
        { url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-15' },
        { url: 'https://a.test/2', title: 'B', source: 'SIA', publishedAt: '2026-09-28' },
      ],
    }];
    const result = mergeTrends(clusters, existing, today);

    expect(result).toHaveLength(1);
    expect(result[0].lastActive).toBe(today);
    expect(result[0].firstDetected).toBe('2026-09-15');
    expect(result[0].articleCount).toBe(2);
    expect(result[0].sources.sort()).toEqual(['HID', 'SIA']);
    expect(result[0].rationale).toBe('new rationale');
    expect(result[0].signalTypes.sort()).toEqual(['source_authority', 'velocity']);
  });

  test('promotes emerging to confirmed when the cluster says confirmed', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'emerging', firstDetected: '2026-09-15', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: ['velocity'], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' }],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'confirmed', rationale: 'now confirmed', signalTypes: [],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result[0].status).toBe('confirmed');
    // signalTypes retained as historical record, not cleared on promotion
    expect(result[0].signalTypes).toEqual(['velocity']);
  });

  test('never demotes a confirmed trend back to emerging', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A', 'B'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'emerging', rationale: 'weaker this run', signalTypes: ['velocity'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result[0].status).toBe('confirmed');
  });

  test('cools an existing non-cooled trend absent from this run\'s clusters', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-15',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const result = mergeTrends([], existing, today);
    expect(result[0].status).toBe('cooled');
    expect(result[0].cooledAt).toBe(today);
    expect(result[0].lastActive).toBe('2026-09-15'); // unchanged
  });

  test('leaves an already-cooled trend untouched and does not re-stamp it', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'cooled', firstDetected: '2026-08-01', lastActive: '2026-08-10',
      cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-08-01' }],
    }];
    const result = mergeTrends([], existing, today);
    expect(result[0]).toEqual(existing[0]);
  });

  test('a cluster referencing an id that is cooled (or unknown) creates a new trend rather than reviving it', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'cooled', firstDetected: '2026-08-01', lastActive: '2026-08-10',
      cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-08-01' }],
    }];
    const clusters = [{
      id: 't1', name: 'X reborn', status: 'emerging', rationale: 'back again', signalTypes: ['velocity'],
      articles: [{ url: 'https://a.test/2', title: 'B', source: 'A', publishedAt: '2026-09-28' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result).toHaveLength(2);
    const revived = result.find(t => t.name === 'X reborn');
    expect(revived.status).toBe('emerging');
    expect(revived.id).not.toBe('t1');
    const stillCooled = result.find(t => t.id === 't1');
    expect(stillCooled.status).toBe('cooled');
  });

  test('generates distinct ids for two new trends with colliding slugs', () => {
    const clusters = [
      { id: null, name: 'Same Name', status: 'emerging', rationale: 'r1', signalTypes: ['velocity'], articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: today }] },
      { id: null, name: 'Same Name', status: 'emerging', rationale: 'r2', signalTypes: ['velocity'], articles: [{ url: 'https://a.test/2', title: 'B', source: 'B', publishedAt: today }] },
    ];
    const result = mergeTrends(clusters, [], today);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
  });
});

describe('pruneTrends', () => {
  const today = '2026-09-29';

  test('keeps a cooled trend within the retention window', () => {
    const trends = [{ id: 't1', status: 'cooled', cooledAt: '2026-09-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(1);
  });

  test('drops a cooled trend past the retention window', () => {
    const trends = [{ id: 't1', status: 'cooled', cooledAt: '2025-01-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(0);
  });

  test('never prunes a non-cooled trend regardless of age', () => {
    const trends = [{ id: 't1', status: 'confirmed', cooledAt: null, firstDetected: '2020-01-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/detect-trends.test.mjs`
Expected: FAIL — `scripts/detect-trends.mjs` does not exist yet (`Cannot find module`).

- [ ] **Step 3: Implement `scripts/detect-trends.mjs`**

Create `scripts/detect-trends.mjs`:

```javascript
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

function mergeIntoExisting(existing, cluster, today) {
  const articles = dedupeArticles(existing.articles, cluster.articles || []);
  const sources = [...new Set(articles.map(a => a.source))];
  const signalTypes = [...new Set([...(existing.signalTypes || []), ...(cluster.signalTypes || [])])];
  const status = existing.status === 'confirmed' || cluster.status === 'confirmed' ? 'confirmed' : 'emerging';

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
  const status = cluster.status === 'confirmed' ? 'confirmed' : 'emerging';

  return {
    id,
    name: cluster.name,
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
    if (existing && existing.status !== 'cooled') {
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

async function callClaude(anthropic, articles, existingTrends) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildTrendsPrompt(articles, existingTrends) }],
  });
  const text = response.content[0]?.text || '[]';
  try {
    return parseTrendsResponse(text);
  } catch (e) {
    console.warn('detect-trends: failed to parse Claude response:', e.message);
    return [];
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

  let clusters = [];
  if (inWindow.length > 0 && apiKey) {
    const anthropic = new Anthropic({ apiKey });
    try {
      clusters = await callClaude(anthropic, inWindow, activeExisting);
    } catch (e) {
      console.warn('detect-trends: Claude call failed:', e.message);
    }
  }

  const merged = mergeTrends(clusters, archive.trends, today);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/detect-trends.test.mjs`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS, including the existing `fetch-news.test.mjs` suite.

- [ ] **Step 6: Commit**

```bash
git add scripts/detect-trends.mjs scripts/detect-trends.test.mjs
git commit -m "feat: add trend detection script with pure merge/cooling/prune logic"
```

---

### Task 3: Wire trend detection into the daily workflow

**Files:**
- Modify: `.github/workflows/update-news.yml`

**Interfaces:**
- Consumes: `npm run detect-trends` from Task 1, `ANTHROPIC_API_KEY` secret (already present in the workflow).
- Produces: `client/public/data/trends.json` committed alongside `articles.json`.

- [ ] **Step 1: Add a `force_trends` workflow_dispatch input**

In `.github/workflows/update-news.yml`, change:
```yaml
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch: {}
```
to:
```yaml
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      force_trends:
        description: 'Force trend detection to run even if it already ran today'
        type: boolean
        default: false
```

- [ ] **Step 2: Insert the trend-detection step and extend the commit step**

Change:
```yaml
      - name: Fetch news and run AI analysis on new articles
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm run fetch-news

      - name: Commit updated article data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add client/public/data/articles.json
          git diff --cached --quiet && echo "No article data changes" || git commit -m "chore: update article data [skip ci]"
          git push
```
to:
```yaml
      - name: Fetch news and run AI analysis on new articles
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm run fetch-news

      - name: Detect trends
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          FORCE_TRENDS: ${{ github.event.inputs.force_trends }}
        run: npm run detect-trends

      - name: Commit updated article data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add client/public/data/articles.json client/public/data/trends.json
          git diff --cached --quiet && echo "No article data changes" || git commit -m "chore: update article and trend data [skip ci]"
          git push
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update-news.yml
git commit -m "ci: run trend detection as part of the daily news update"
```

---

### Task 4: `client/src/hooks/useTrends.js` — client data hook, with tests (TDD)

**Files:**
- Create: `client/src/hooks/useTrends.js`
- Test: `client/src/hooks/useTrends.test.js`

**Interfaces:**
- Consumes: `client/public/data/trends.json`, shape `{ lastRunAt, trends: Trend[] }` (Task 2's output).
- Produces (used by Task 7's `App.jsx` wiring): `useTrends()` → `{ trends, loading, error, lastRunAt, load, refresh }`, where `load()` fetches once and `refresh()` cache-busts — same contract shape as `useNews()` in `useApi.js`.

- [ ] **Step 1: Write the failing test file**

Create `client/src/hooks/useTrends.test.js`:

```javascript
import { renderHook, act } from '@testing-library/react';
import { useTrends } from './useTrends.js';

const SAMPLE = {
  lastRunAt: '2026-09-29T06:00:00.000Z',
  trends: [
    { id: 't1', name: 'Deepfake ID fraud', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-29', cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 5, sources: ['A'], articles: [] },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE) })
  );
});

test('load() fetches the static JSON and exposes trends + lastRunAt', async () => {
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.load(); });

  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('data/trends.json'));
  expect(result.current.trends).toEqual(SAMPLE.trends);
  expect(result.current.lastRunAt).toBe(SAMPLE.lastRunAt);
  expect(result.current.error).toBe(null);
});

test('refresh() cache-busts the URL', async () => {
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.refresh(); });

  const calledUrl = global.fetch.mock.calls[0][0];
  expect(calledUrl).toMatch(/data\/trends\.json\?t=\d+/);
});

test('sets error when fetch fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.load(); });

  expect(result.current.error).toMatch(/500/);
  expect(result.current.trends).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/src/hooks/useTrends.test.js --root client`
Expected: FAIL — `useTrends.js` does not exist yet.

- [ ] **Step 3: Implement `client/src/hooks/useTrends.js`**

Create `client/src/hooks/useTrends.js`:

```javascript
import { useState, useCallback } from 'react';

const DATA_URL = `${import.meta.env.BASE_URL}data/trends.json`;

export function useTrends() {
  const [trends, setTrends]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);

  const fetchTrends = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      setLastRunAt(data.lastRunAt || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const load    = useCallback(() => fetchTrends(false), [fetchTrends]);
  const refresh = useCallback(() => fetchTrends(true), [fetchTrends]);

  return { trends, loading, error, lastRunAt, load, refresh };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run client/src/hooks/useTrends.test.js --root client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useTrends.js client/src/hooks/useTrends.test.js
git commit -m "feat: add useTrends client hook"
```

---

### Task 5: `client/src/components/TrendCard.jsx`

**Files:**
- Create: `client/src/components/TrendCard.jsx`

**Interfaces:**
- Consumes: `formatDate` from `../utils.js`; a single `trend` prop matching the `Trend` shape from Task 2.
- Produces (used by Task 6): `export default function TrendCard({ trend })`.

- [ ] **Step 1: Create `client/src/components/TrendCard.jsx`**

```jsx
import React, { useState } from 'react';
import { formatDate } from '../utils.js';

const STATUS_STYLES = {
  confirmed: { label: '🔒 Confirmed', color: '#4fffb0', background: 'rgba(79,255,176,0.07)', border: 'rgba(79,255,176,0.3)' },
  emerging:  { label: '🔍 Emerging',  color: '#f59e0b', background: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.3)' },
  cooled:    { label: 'Archived',     color: '#505a6e', background: 'transparent',            border: 'rgba(255,255,255,0.07)' },
};

const SIGNAL_LABELS = {
  source_authority: 'Named source',
  claim_magnitude:  'Big claim',
  cross_topic:      'Cross-industry',
  velocity:         'Fast-breaking',
};

export default function TrendCard({ trend }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[trend.status] || STATUS_STYLES.emerging;
  const dateRange = trend.status === 'cooled' && trend.cooledAt
    ? `${formatDate(trend.firstDetected)} → ${formatDate(trend.cooledAt)}`
    : `${formatDate(trend.firstDetected)} → ${formatDate(trend.lastActive)}`;

  return (
    <div style={{
      background: '#11141c', border: `1px solid ${style.border}`, borderRadius: 10,
      padding: '14px 16px', marginBottom: 8, opacity: trend.status === 'cooled' ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>{trend.name}</div>
        <span style={{
          fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, padding: '3px 8px', borderRadius: 4,
          background: style.background, color: style.color, border: `1px solid ${style.border}`, whiteSpace: 'nowrap',
        }}>{style.label}</span>
      </div>

      <div style={{ fontSize: 12, color: '#8a94a8', lineHeight: 1.55, marginBottom: 10 }}>{trend.rationale}</div>

      {trend.status === 'emerging' && trend.signalTypes?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {trend.signalTypes.map(s => (
            <span key={s} style={{
              fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, padding: '3px 7px', borderRadius: 3,
              background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{SIGNAL_LABELS[s] || s}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', marginBottom: expanded ? 10 : 0 }}>
        <span>{dateRange}</span>
        <span>{trend.articleCount} article{trend.articleCount === 1 ? '' : 's'}</span>
        <span>{trend.sources?.join(', ')}</span>
        <button onClick={() => setExpanded(e => !e)} style={{
          background: 'none', border: 'none', color: '#4fffb0', cursor: 'pointer',
          fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, marginLeft: 'auto', padding: 0,
        }}>{expanded ? 'Hide articles ▴' : 'Show articles ▾'}</button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trend.articles?.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px',
              background: '#171c27', borderRadius: 6, textDecoration: 'none',
            }}>
              <span style={{ fontSize: 12, color: '#dde2ed' }}>{a.title}</span>
              <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', whiteSpace: 'nowrap' }}>{a.source} · {formatDate(a.publishedAt)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/TrendCard.jsx
git commit -m "feat: add TrendCard component"
```

---

### Task 6: `client/src/components/TrendsPanel.jsx`, with test

**Files:**
- Create: `client/src/components/TrendsPanel.jsx`
- Test: `client/src/components/TrendsPanel.test.jsx`

**Interfaces:**
- Consumes: `TrendCard` from Task 5; props `{ trends, loading, error, lastRunAt, onRetry, isMobile }`.
- Produces (used by Task 7): `export default function TrendsPanel(props)`.

- [ ] **Step 1: Write the failing test file**

Create `client/src/components/TrendsPanel.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import TrendsPanel from './TrendsPanel';

const CONFIRMED = { id: 'c1', name: 'Confirmed Trend', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-29', cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 5, sources: ['A'], articles: [] };
const EMERGING  = { id: 'e1', name: 'Emerging Trend',  status: 'emerging',  firstDetected: '2026-09-20', lastActive: '2026-09-27', cooledAt: null, rationale: 'r', signalTypes: ['velocity'], articleCount: 2, sources: ['B'], articles: [] };
const COOLED    = { id: 'k1', name: 'Cooled Trend',    status: 'cooled',    firstDetected: '2026-08-01', lastActive: '2026-08-10', cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 4, sources: ['C'], articles: [] };

function setup(overrides = {}) {
  const props = {
    trends: [CONFIRMED, EMERGING, COOLED],
    loading: false,
    error: null,
    lastRunAt: '2026-09-29T06:00:00.000Z',
    onRetry: vi.fn(),
    isMobile: false,
    ...overrides,
  };
  return { ...render(<TrendsPanel {...props} />), props };
}

test('renders active trends but not cooled ones by default', () => {
  setup();
  expect(screen.getByText('Confirmed Trend')).toBeInTheDocument();
  expect(screen.getByText('Emerging Trend')).toBeInTheDocument();
  expect(screen.queryByText('Cooled Trend')).not.toBeInTheDocument();
});

test('shows the archive toggle with the cooled count', () => {
  setup();
  expect(screen.getByText('▾ Archive (1)')).toBeInTheDocument();
});

test('clicking the archive toggle reveals cooled trends', () => {
  setup();
  fireEvent.click(screen.getByText('▾ Archive (1)'));
  expect(screen.getByText('Cooled Trend')).toBeInTheDocument();
});

test('shows an empty state when there are no active trends', () => {
  setup({ trends: [COOLED] });
  expect(screen.getByText('No active trends detected yet.')).toBeInTheDocument();
});

test('shows the error state and wires the retry button', () => {
  const onRetry = vi.fn();
  setup({ error: 'HTTP 500', trends: [], onRetry });
  expect(screen.getByText('Failed to load trends')).toBeInTheDocument();
  fireEvent.click(screen.getByText('↻ Retry'));
  expect(onRetry).toHaveBeenCalled();
});

test('shows a loading state', () => {
  setup({ loading: true });
  expect(screen.getByText('LOADING TRENDS')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/src/components/TrendsPanel.test.jsx --root client`
Expected: FAIL — `TrendsPanel.jsx` does not exist yet.

- [ ] **Step 3: Implement `client/src/components/TrendsPanel.jsx`**

```jsx
import React, { useMemo, useState } from 'react';
import TrendCard from './TrendCard.jsx';

function parseDate(str) { return str ? (new Date(str).getTime() || 0) : 0; }

export default function TrendsPanel({ trends, loading, error, lastRunAt, onRetry, isMobile }) {
  const [showArchive, setShowArchive] = useState(false);

  const active = useMemo(
    () => trends.filter(t => t.status !== 'cooled').sort((a, b) => parseDate(b.lastActive) - parseDate(a.lastActive)),
    [trends]
  );
  const archived = useMemo(
    () => trends.filter(t => t.status === 'cooled').sort((a, b) => parseDate(b.cooledAt) - parseDate(a.cooledAt)),
    [trends]
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '12px 10px 68px' : '12px 16px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 14 }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#4fffb0', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#505a6e' }}>LOADING TRENDS</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 24, textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: '#f87171', marginBottom: 10 }}>Failed to load trends</div>
            <div style={{ fontSize: 12, color: '#8a94a8', marginBottom: 16 }}>{error}</div>
            {onRetry && (
              <button onClick={onRetry} style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, padding: '8px 16px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>
                ↻ Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {lastRunAt && (
              <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', marginBottom: 14 }}>
                Last analyzed {new Date(lastRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {active.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', gap: 10, color: '#505a6e' }}>
                <div style={{ fontSize: 28, opacity: 0.4 }}>◫</div>
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12 }}>No active trends detected yet.</div>
              </div>
            )}

            {active.map(t => <TrendCard key={t.id} trend={t} />)}

            {archived.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <button onClick={() => setShowArchive(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)',
                  padding: '12px 0 10px', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {showArchive ? '▴' : '▾'} Archive ({archived.length})
                </button>
                {showArchive && archived.map(t => <TrendCard key={t.id} trend={t} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run client/src/components/TrendsPanel.test.jsx --root client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TrendsPanel.jsx client/src/components/TrendsPanel.test.jsx
git commit -m "feat: add TrendsPanel component"
```

---

### Task 7: Wire the "Trends" tab into the app shell

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/Topbar.jsx`
- Modify: `client/src/components/MobileBottomNav.jsx`
- Modify: `client/src/components/MobileBottomNav.test.jsx`

**Interfaces:**
- Consumes: `useTrends` (Task 4), `TrendsPanel` (Task 6).
- Produces: `tab` state in `App.jsx` gains a third value, `'trends'`, alongside the existing `'feed'`/`'starred'`.

- [ ] **Step 1: Add the Trends tab to desktop `Topbar.jsx`**

In `client/src/components/Topbar.jsx`, change:
```jsx
        {['feed', 'starred'].map(t => (
```
to:
```jsx
        {['feed', 'starred', 'trends'].map(t => (
```

(The existing label logic `t.charAt(0).toUpperCase() + t.slice(1)` already renders `"Trends"` correctly; the star-count badge is already conditioned on `t === 'starred'` so it won't appear on the new tab.)

- [ ] **Step 2: Add a Trends button to `MobileBottomNav.jsx`**

In `client/src/components/MobileBottomNav.jsx`, change:
```jsx
export default function MobileBottomNav({ tab, setTab, starCount, filterDrawerOpen, setFilterDrawerOpen, hasActiveFilter }) {
  function handleFeed() { setTab('feed'); setFilterDrawerOpen(false); }
  function handleStarred() { setTab('starred'); setFilterDrawerOpen(false); }
  function handleFilter() { setFilterDrawerOpen(!filterDrawerOpen); }
```
to:
```jsx
export default function MobileBottomNav({ tab, setTab, starCount, filterDrawerOpen, setFilterDrawerOpen, hasActiveFilter }) {
  function handleFeed() { setTab('feed'); setFilterDrawerOpen(false); }
  function handleStarred() { setTab('starred'); setFilterDrawerOpen(false); }
  function handleTrends() { setTab('trends'); setFilterDrawerOpen(false); }
  function handleFilter() { setFilterDrawerOpen(!filterDrawerOpen); }
```

Then, immediately after the closing `</NavBtn>` of the "Starred" button (the last one in the file, right before the final `</div>`), add a fourth button:
```jsx
      <NavBtn active={tab === 'trends' && !filterDrawerOpen} onClick={handleTrends} label="Trends">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" />
        </svg>
      </NavBtn>
```

- [ ] **Step 3: Update `MobileBottomNav.test.jsx` for the new button**

Add these two tests to `client/src/components/MobileBottomNav.test.jsx` (after the existing "tapping Starred..." test):

```jsx
test('renders Trends label', () => {
  setup();
  expect(screen.getByText('Trends')).toBeInTheDocument();
});

test('tapping Trends calls setTab("trends") and setFilterDrawerOpen(false)', () => {
  const setTab = vi.fn();
  const setFilterDrawerOpen = vi.fn();
  setup({ filterDrawerOpen: true, setTab, setFilterDrawerOpen });
  fireEvent.click(screen.getByText('Trends'));
  expect(setTab).toHaveBeenCalledWith('trends');
  expect(setFilterDrawerOpen).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 4: Run the updated component tests**

Run: `npx vitest run client/src/components/MobileBottomNav.test.jsx --root client`
Expected: PASS, including the two new tests.

- [ ] **Step 5: Wire `App.jsx`**

In `client/src/App.jsx`, change the imports:
```jsx
import React, { useState, useEffect, useMemo } from 'react';
import Topbar from './components/Topbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import FeedPanel from './components/FeedPanel.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import FilterDrawer from './components/FilterDrawer.jsx';
import { useNews } from './hooks/useApi.js';
import { useStarred } from './hooks/useStarred.js';
import { useMobile } from './hooks/useMobile.js';
import { filterArticles, sortArticles, topicCounts } from './utils.js';
```
to:
```jsx
import React, { useState, useEffect, useMemo } from 'react';
import Topbar from './components/Topbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import FeedPanel from './components/FeedPanel.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import FilterDrawer from './components/FilterDrawer.jsx';
import TrendsPanel from './components/TrendsPanel.jsx';
import { useNews } from './hooks/useApi.js';
import { useTrends } from './hooks/useTrends.js';
import { useStarred } from './hooks/useStarred.js';
import { useMobile } from './hooks/useMobile.js';
import { filterArticles, sortArticles, topicCounts } from './utils.js';
```

Add the trends hook and its load call:
```jsx
  const { articles, loading, error, fetchedAt, days, load, refresh, switchRange } = useNews();
  const { trends, loading: trendsLoading, error: trendsError, lastRunAt, load: loadTrends } = useTrends();
  const { starred, toggle, isStarred } = useStarred();
```

```jsx
  useEffect(() => { load(); loadTrends(); }, []);
```
(replaces the existing `useEffect(() => { load(); }, []);`)

Replace the main content row:
```jsx
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!isMobile && (
          <Sidebar
            topic={topic} setTopic={setTopic}
            sort={sort} setSort={setSort}
            counts={counts}
            totalSources={new Set(articles.map(a => a.source)).size}
            starCount={starred.size}
          />
        )}
        <FeedPanel
          articles={displayed}
          loading={loading}
          error={error}
          selected={selected}
          isStarred={isStarred}
          onSelect={setSelected}
          onToggleStar={toggle}
          onRetry={load}
          tab={tab}
          isMobile={isMobile}
        />
      </div>
```
with:
```jsx
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {tab === 'trends' ? (
          <TrendsPanel
            trends={trends}
            loading={trendsLoading}
            error={trendsError}
            lastRunAt={lastRunAt}
            onRetry={loadTrends}
            isMobile={isMobile}
          />
        ) : (
          <>
            {!isMobile && (
              <Sidebar
                topic={topic} setTopic={setTopic}
                sort={sort} setSort={setSort}
                counts={counts}
                totalSources={new Set(articles.map(a => a.source)).size}
                starCount={starred.size}
              />
            )}
            <FeedPanel
              articles={displayed}
              loading={loading}
              error={error}
              selected={selected}
              isStarred={isStarred}
              onSelect={setSelected}
              onToggleStar={toggle}
              onRetry={load}
              tab={tab}
              isMobile={isMobile}
            />
          </>
        )}
      </div>
```

- [ ] **Step 6: Run the full client test suite**

Run: `npm test --prefix client -- run`
Expected: PASS, all existing and new component/hook tests green.

- [ ] **Step 7: Run the full root test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/App.jsx client/src/components/Topbar.jsx client/src/components/MobileBottomNav.jsx client/src/components/MobileBottomNav.test.jsx
git commit -m "feat: wire Trends tab into app shell"
```

---

### Task 8: Seed an empty `trends.json` so the client never 404s

**Files:**
- Create: `client/public/data/trends.json`

**Interfaces:**
- Produces: the initial file `useTrends` fetches before the workflow has ever run `detect-trends` in production.

- [ ] **Step 1: Create the seed file**

Create `client/public/data/trends.json`:
```json
{
  "lastRunAt": null,
  "trends": []
}
```

- [ ] **Step 2: Verify the client build includes it**

Run: `npm run build --prefix client`
Expected: build succeeds; `client/dist/data/trends.json` exists (Vite copies everything under `client/public/`).

- [ ] **Step 3: Commit**

```bash
git add client/public/data/trends.json
git commit -m "chore: seed empty trends.json for first deploy"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (data flow, cadence, secret) → Tasks 2 & 3. Section 3 (data model) → Task 2's `Trend` shape. Section 4 (thresholds) → Task 2's constants + prompt. Section 5 (Claude call + merge) → Task 2. Section 6 (client hook) → Task 4. Section 7 (UI) → Tasks 5-7. Section 8 (testing) → every task's TDD step. Section 9 (open items) → `signalTypes` retention resolved in Global Constraints; the other three items are explicitly out of scope and untouched.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code.
- **Type consistency:** `Trend` fields (`id, name, status, firstDetected, lastActive, cooledAt, rationale, signalTypes, articleCount, sources, articles`) are identical across Task 2's implementation, Task 2's tests, Task 5's `TrendCard`, and Task 6's `TrendsPanel`/tests. `useTrends()`'s return shape (`trends, loading, error, lastRunAt, load, refresh`) matches between Task 4's implementation, its tests, and Task 7's `App.jsx` usage.
