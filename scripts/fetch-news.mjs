import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const OUTPUT_PATH = path.join(process.cwd(), 'client', 'public', 'data', 'articles.json');
const MAX_ANALYSES_PER_RUN = 60;
const MAX_ARTICLE_AGE_DAYS = 30; // matches the client's longest selectable range

// ── PRIORITY SOURCE ───────────────────────────────────────────────────────
const PRIORITY_SOURCE = 'CoreWillSoft';
const PRIORITY_RSS_URL = 'https://www.corewillsoft.com/feed/';
const PRIORITY_BLOG_URL = 'https://www.corewillsoft.com/blog/';

// ── RSS FEEDS ─────────────────────────────────────────────────────────────
export const RSS_FEEDS = [
  { url: 'https://www.securityinfowatch.com/rss/all',          source: 'SecurityInfoWatch'    },
  { url: 'https://www.securitysales.com/feed/',                source: 'Security Sales'       },
  { url: 'https://www.securitymagazine.com/rss/all',           source: 'Security Magazine'    },
  { url: 'https://ifsecglobal.com/feed/',                      source: 'IFSEC Global'         },
  { url: 'https://www.securityworldmarket.com/rss',            source: 'Security World'       },
  { url: 'https://www.securityindustry.org/feed/',             source: 'SIA'                  },
  { url: 'https://www.genetec.com/blog/rss',                   source: 'Genetec'              },
  { url: 'https://www.axis.com/blog/secure-insights/feed',     source: 'Axis Communications'  },
  { url: 'https://www.verkada.com/blog/feed.xml',              source: 'Verkada'              },
  { url: 'https://www.brivo.com/blog/feed/',                   source: 'Brivo'                },
  { url: 'https://feeds.feedburner.com/TheHackersNews',        source: 'The Hacker News'      },
  { url: 'https://www.darkreading.com/rss.xml',                source: 'Dark Reading'         },
  { url: 'https://campussafetymagazine.com/feed/',             source: 'Campus Safety'        },
  { url: 'https://www.msspalert.com/feed/',                    source: 'MSSP Alert'           },
];

export const KEYWORDS = [
  'access control','video surveillance','physical security','security camera',
  'biometric','facial recognition','cctv','vms','nvr','ip camera',
  'genetec','milestone','axis','hanwha','avigilon','hid global','verkada',
  'brivo','lenel','bosch security','johnson controls','assa abloy','pelco',
  'smart building','perimeter security','intrusion detection',
  'security software','psim','vsaas','cloud video','security analytics',
  'ndaa','fedramp','zero trust','identity','credential','badge reader',
  'gunshot detection','gun detection','school safety','license plate',
  'alpr','anpr','body camera','body worn','guard tour',
];

export function isRelevant(title, summary) {
  const text = (title + ' ' + (summary || '')).toLowerCase();
  return KEYWORDS.some(kw => text.includes(kw));
}

export function classifyTopic(title, summary) {
  const text = (title + ' ' + (summary || '')).toLowerCase();
  if (/acqui|merger|acquires|acquired|\$\d+\s*(billion|million)|raises \$|funding round|ipo|valuation/.test(text)) return 'business';
  if (/cyber|hack|vulnerab|breach|malware|ransomware|firmware|exploit|infosec|cve/.test(text)) return 'cyber';
  if (/cloud|saas|vsaas|hosted|subscription|cloud-managed|cloud video/.test(text)) return 'cloud';
  if (/\bsdk\b|open platform|rest api|interoperab|connector|api integrat/.test(text)) return 'integration';
  if (/smart building|bms|building management|occupancy|hvac|facility|digital twin/.test(text)) return 'building';
  if (/\bai\b|artificial intel|machine learn|computer vision|facial|neural|analytic|detection/.test(text)) return 'ai';
  if (/access control|credential|badge|biometric|reader|turnstile|keycard|mobile credential/.test(text)) return 'access';
  if (/video|camera|cctv|surveillance|vms|nvr|dvr|megapixel|ptz|recording/.test(text)) return 'video';
  if (/regulat|complianc|nist|ndaa|fedramp|gdpr|standard|policy|mandate/.test(text)) return 'regulation';
  return 'tech';
}

// Phrases that look physical but are IT/cyber usage; stripped before matching
// so they can't trigger the physical flag on their own.
const PHYSICAL_GUARDS = [
  /\b(?:broken|improper|missing|insufficient) access control\b/g,
  /\bidentity and access management\b/g,
  /\biam\b/g,
  /\bprivileged access\b/g,
  /\brole-based access control\b/g,
  /\baccess control lists?\b/g,
  /\bacls?\b/g,
  /\bnetwork perimeter\b/g,
  /\bperimeter firewalls?\b/g,
  /\bcloud perimeter\b/g,
  /(?<!perimeter )\bintrusion (?:detection|prevention) systems?\b/g,
  /\bids\b/g,
  /\bthreat detection\b/g,
  /\bendpoint detection\b/g,
  /\b[ex]dr\b/g,
  /\bcredential (?:theft|stuffing)\b/g,
  /\bstolen credentials\b/g,
  /\blockbit\b/g,
  /\braises? (?:the )?alarms?\b/g,
  /\bsounds? the alarm\b/g,
  /\balarm bells\b/g,
  /\binformation security officers?\b/g,
  /\b(?:chief|field) security officers?\b/g,
  /\b(?:security operations|soc|network|cyber(?:security)?|it) monitoring cent(?:er|re)s?\b/g,
];

const PHYSICAL_TERMS = [
  // Access control
  /\baccess control\b/, /\bdoor controllers?\b/, /\bbadge readers?\b/, /\bkey ?cards?\b/,
  /\bproximity cards?\b/, /\bmobile credentials?\b/, /\bbiometric readers?\b/, /\bturnstiles?\b/,
  /\bmantraps?\b/, /\b(?:electronic|smart|door) locks?\b/, /\bintercoms?\b/, /\bvisitor management\b/, /\bosdp\b/,
  // Video
  /\bvideo management systems?\b/, /\b[nd]vrs?\b/, /\bcctv\b/, /\bptz\b/,
  /\b(?:ip|security|surveillance|thermal|dome) cameras?\b/, /\bvideo surveillance\b/, /\bvsaas\b/,
  /\bvideo analytics\b/, /\bbody[- ]worn\b/, /\bbody cam(?:era)?s?\b/, /\bsurveillance (?:videos?|footage)\b/,
  // Perimeter
  /\bperimeter (?:detection|protection|security|intrusion)\b/, /\bfence (?:detection|sensors?)\b/,
  /\bground radar\b/, /\blidar sensors?\b/, /\bbollards?\b/, /\bvehicle barriers?\b/, /\bcrash-rated\b/,
  /\bgate operators?\b/, /\ba[ln]pr\b/, /\blicense plate (?:recognition|readers?)\b/,
  // Intrusion & alarms
  /\bintrusion (?:alarms?|panels?)\b/, /\bburglar alarms?\b/, /\balarm (?:panels?|monitoring)\b/,
  /\bcentral station\b/, /\bmonitoring cent(?:er|re)s?\b/, /\bmotion (?:sensors?|detectors?)\b/,
  /\bglass[- ]break\b/, /\bpanic buttons?\b/, /\bduress alarms?\b/,
  /\bsecurity (?:system )?(?:installers?|integrators?)\b/,
  // Ops & other
  /\bphysical security\b/, /\bpsim\b/, /\bgsoc\b/, /\bguard tours?\b/, /\bsecurity (?:guards?|officers?)\b/,
  /\b(?:gunshot|gun|weapons?) detection\b/, /\bmetal detectors?\b/, /\b(?:school|campus) safety\b/,
  /\belectronic security\b/, /\b(?:gsx|isc west|isc east|ifsec|asis international)\b/,
  // Vendors
  /\b(?:genetec|milestone systems|axis communications|hanwha vision|avigilon|hid global|verkada|brivo|lenel|lenels2|pelco|assa abloy|allegion|hikvision|dahua|bosch security|honeywell security|eagle eye networks|openpath|rhombus|axon|amag|securitas|pavion|pye-barker|allied universal|adt|per mar|dormakaba|keenfinity|convergint|salto|identiv|napco|alarm\.com|openeye)\b/,
];

// Matched case-sensitively on the original text: lowercase "vms" in cyber
// news is usually virtual machines.
const PHYSICAL_TERMS_CASED = [/\bVMS\b/];

export function isPhysicalSecurity(title, summary) {
  const raw = title + ' ' + (summary || '');
  if (PHYSICAL_TERMS_CASED.some(re => re.test(raw))) return true;
  let text = raw.toLowerCase();
  for (const re of PHYSICAL_GUARDS) text = text.replace(re, ' ');
  return PHYSICAL_TERMS.some(re => re.test(text));
}

export function fixDate(dateStr) {
  if (!dateStr) return '';
  const today = new Date();
  const parsed = new Date(dateStr);
  if (isNaN(parsed)) return '';
  while (parsed > today) parsed.setFullYear(parsed.getFullYear() - 1);
  return parsed.toISOString().slice(0, 10);
}

// An article with no parseable publish date can't be shown as current, so
// it is never kept: without this it slipped past every age cutoff.
export function isWithinAge(dateStr, now = new Date(), days = MAX_ARTICLE_AGE_DAYS) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return d >= new Date(now.getTime() - days * 86400000);
}

export function parseRSS(xml, sourceName) {
  const articles = [];
  try {
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const item of items) {
      const title   = (item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || '').trim();
      const link    = (item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1] || '').trim();
      const desc    = (item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] || '').trim();
      const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();

      if (!title || !link || !/^https?:\/\//i.test(link)) continue;

      const summary = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").slice(0, 300).trim();

      articles.push({ title, link, summary, pubDate, sourceName });
    }
  } catch (e) {}
  return articles;
}

async function fetchRSSFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'SecureWatch/1.0 RSS Reader' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      console.warn(`RSS non-OK: ${feed.source}: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRSS(xml, feed.source);
  } catch (e) {
    console.warn(`RSS failed: ${feed.source}:`, e.message);
    return [];
  }
}

async function fetchCorewillsoftBlog() {
  const rssArticles = await fetchRSSFeed({ url: PRIORITY_RSS_URL, source: PRIORITY_SOURCE });
  if (rssArticles.length > 0) return rssArticles;

  try {
    const res = await fetch(PRIORITY_BLOG_URL, {
      headers: { 'User-Agent': 'SecureWatch/1.0 RSS Reader' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const articles = [];

    const blocks = html.match(/<article[\s>][\s\S]*?<\/article>/gi) || [];
    for (const block of blocks) {
      const hMatch = block.match(/<h[23][^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const tMatch = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
      if (!hMatch) continue;
      const link = hMatch[1].startsWith('http') ? hMatch[1] : `https://www.corewillsoft.com${hMatch[1]}`;
      const title = hMatch[2].replace(/<[^>]+>/g, '').trim();
      if (!title) continue;
      articles.push({ title, link, summary: '', pubDate: tMatch?.[1] || '', sourceName: PRIORITY_SOURCE });
    }

    if (articles.length === 0) {
      const seen = new Set();
      for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/(?:www\.)?corewillsoft\.com\/blog\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const link = m[1];
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        if (!title || title.length < 8 || seen.has(link)) continue;
        seen.add(link);
        articles.push({ title, link, summary: '', pubDate: '', sourceName: PRIORITY_SOURCE });
      }
    }

    return articles;
  } catch (e) {
    console.warn('CoreWillSoft scrape failed:', e.message);
    return [];
  }
}

async function fetchAllRaw() {
  const [priorityArticles, rssResults] = await Promise.all([
    fetchCorewillsoftBlog(),
    Promise.allSettled(RSS_FEEDS.map(f => fetchRSSFeed(f))),
  ]);
  const allRawArticles = rssResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const combined = [...priorityArticles, ...allRawArticles];

  const tradePressFeeds = [
    'SecurityInfoWatch','Security Sales','Security Magazine','IFSEC Global','SIA',
    'Genetec','Axis Communications','Verkada','Brivo','Campus Safety',
    PRIORITY_SOURCE,
  ];
  const filtered = combined.filter(a => {
    if (!isWithinAge(a.pubDate)) return false;
    if (tradePressFeeds.includes(a.sourceName)) return true;
    return isRelevant(a.title, a.summary);
  });

  const seen = new Set();
  const deduped = [];
  for (const a of filtered) {
    if (!seen.has(a.link)) {
      seen.add(a.link);
      deduped.push(a);
    }
  }

  deduped.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate) : new Date(0);
    const db = b.pubDate ? new Date(b.pubDate) : new Date(0);
    const dateDiff = db - da;
    if (Math.abs(dateDiff) > 86400000) return dateDiff;
    const pa = a.sourceName === PRIORITY_SOURCE ? 1 : 0;
    const pb = b.sourceName === PRIORITY_SOURCE ? 1 : 0;
    return pb - pa || dateDiff;
  });

  return deduped.map(a => ({
    id: a.link,
    title: a.title,
    summary: a.summary,
    source: a.sourceName,
    url: a.link,
    publishedAt: fixDate(a.pubDate),
    topic: classifyTopic(a.title, a.summary),
    physical: isPhysicalSecurity(a.title, a.summary),
    fetchedAt: new Date().toISOString(),
  }));
}

function sortShapedArticles(articles) {
  articles.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
    const db = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
    const dateDiff = db - da;
    if (Math.abs(dateDiff) > 86400000) return dateDiff;
    const pa = a.source === PRIORITY_SOURCE ? 1 : 0;
    const pb = b.source === PRIORITY_SOURCE ? 1 : 0;
    return pb - pa || dateDiff;
  });
  return articles;
}

// Merge freshly-crawled articles with the previous run's data: carry over
// .analysis for URLs already analyzed, report which URLs are genuinely new
// (or were seen before but never got a successful analysis), and retain
// previously-known articles that dropped out of the current crawl but are
// still within the app's MAX_ARTICLE_AGE_DAYS window.
export function diffNew(freshArticles, knownArticles) {
  const knownByUrl = new Map(knownArticles.map(a => [a.url, a]));
  const freshByUrl = new Map(freshArticles.map(a => [a.url, a]));
  const merged = [];
  const newOnes = [];

  for (const a of freshArticles) {
    const prev = knownByUrl.get(a.url);
    if (prev && prev.analysis) {
      merged.push({ ...a, analysis: prev.analysis });
    } else {
      merged.push(a);
      newOnes.push(a);
    }
  }

  for (const prev of knownArticles) {
    if (freshByUrl.has(prev.url)) continue;
    if (!isWithinAge(prev.publishedAt)) continue;
    merged.push(prev);
  }

  // Recompute for every article so stored data is backfilled and keyword
  // changes apply retroactively. Mutate in place: run() attaches .analysis
  // to the newOnes objects, which must stay the same objects as in merged.
  for (const a of merged) a.physical = isPhysicalSecurity(a.title || '', a.summary);

  return { merged: sortShapedArticles(merged), newOnes };
}

async function analyzeOne(anthropic, article) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are a senior analyst at a physical security software company. Analyze this industry article and deliver a structured intelligence brief.

Article: "${article.title}"
Source: ${article.source || 'Unknown'}
Summary: ${article.summary || 'No summary available'}
URL: ${article.url || ''}

Write a concise brief with exactly these four sections. Use plain text only — no markdown, no bullet symbols:

IMPACT
What does this mean for physical security software companies right now? 2-3 sentences.

OPPORTUNITY
What concrete product feature, integration, or go-to-market move should a security software company consider? 2-3 sentences.

THREAT
What risk or competitive threat does this create if ignored? 1-2 sentences.

WATCH
What specific development should this team monitor over the next 90 days? 1 sentence.`
    }]
  });
  return response.content[0]?.text || '';
}

async function loadPrevious() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

export async function run({ apiKey = process.env.ANTHROPIC_API_KEY, cap = MAX_ANALYSES_PER_RUN } = {}) {
  const [fresh, previous] = await Promise.all([fetchAllRaw(), loadPrevious()]);
  const { merged, newOnes } = diffNew(fresh, previous);

  const toAnalyze = newOnes.slice(0, cap);
  if (toAnalyze.length > 0 && apiKey) {
    const anthropic = new Anthropic({ apiKey });
    for (const article of toAnalyze) {
      try {
        article.analysis = await analyzeOne(anthropic, article);
      } catch (e) {
        console.warn(`Analysis failed for ${article.url}: ${e.message}`);
      }
    }
  }

  const payload = { articles: merged, fetchedAt: new Date().toISOString() };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then(p => {
      const analyzedCount = p.articles.filter(a => a.analysis).length;
      console.log(`Wrote ${p.articles.length} articles (${analyzedCount} with analysis).`);
    })
    .catch(e => {
      console.error('fetch-news failed:', e.message);
      process.exit(1);
    });
}
