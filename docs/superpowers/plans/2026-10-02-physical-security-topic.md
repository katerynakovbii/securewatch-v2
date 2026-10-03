# Physical Security Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Physical Security" umbrella topic that shows every physical-security article (access control, video, perimeter, intrusion/alarms, ops, vendors) regardless of its existing single `topic`, excluding pure cyber/IT news.

**Architecture:** The crawler (`scripts/fetch-news.mjs`) computes a deterministic boolean `physical` per article with keyword regexes after stripping IT phrases that only look physical; it recomputes the flag for every merged article on each run (backfills old data). The client treats `topic === 'physical'` as a filter on that flag, counts it separately, and shows a secondary "Physical" badge.

**Tech Stack:** Node ESM script + vitest (root `npm test` runs `vitest run scripts`); React 18 + Vite client with vitest/jsdom/@testing-library (`cd client && npm test`, globals enabled).

**Spec:** `docs/superpowers/specs/2026-10-02-physical-security-topic-design.md`

## Global Constraints

- Work on branch `physical-security-topic` (already created off `main`, spec committed).
- Article field name is exactly `physical` (boolean). Topic key is exactly `physical`, label exactly `Physical Security`, color `#4fffb0`, inserted directly after `all` in `TOPICS`.
- Badge text is exactly `Physical`; existing topic tag stays unchanged.
- Existing single-label `classifyTopic` must not change.
- No Claude/LLM involvement in the physical decision; keyword rules only.
- Cyber terms never disqualify; an article is physical iff a physical term remains after guard-phrase removal.
- Missing `physical` field is treated as false on the client.
- Do NOT run `npm run fetch-news` / `run()` — it rewrites the committed `client/public/data/articles.json` (owned by CI).

**Deviations from spec (deliberate, decided while planning):**
- Extra guard phrases beyond spec: `improper|missing|insufficient access control` (standard CVE wording) and `information security officer` (else "Chief Information Security Officer" matches "security officer").
- `VMS` is matched case-sensitively on the original text, because lowercase "vms" in cyber news is usually virtual machines.
- The `intrusion detection system` guard does not fire when preceded by "perimeter " (physical PIDS).
- Spec's `FilterDrawer.test.jsx` check is replaced by a `TOPICS` ordering assertion in `utils.test.js`: the drawer test mocks `../utils.js`, so it cannot observe the real `TOPICS`; the drawer renders `TOPICS` generically and already has a click test.

## Review Focus

1. Cyber story mentioning virtual machines ("Attackers encrypt ESXi VMs") → must NOT be physical. Test in Task 1.
2. "Perimeter intrusion detection system" (physical PIDS) → must be physical despite the network-IDS guard. Test in Task 1.
3. "Chief Information Security Officer" in a cyber story → must NOT be physical. Test in Task 1.
4. A newly crawled article's `analysis` is attached by `run()` to the `newOnes` objects; the flag recomputation must mutate in place so `merged` and `newOnes` share objects. Test in Task 2.
5. Old `articles.json` with no `physical` field → "Physical Security" view shows zero rather than everything or crashing. Test in Task 3.

---

### Task 1: `isPhysicalSecurity` classifier

**Files:**
- Modify: `scripts/fetch-news.mjs` (add after `classifyTopic`, around line 52)
- Test: `scripts/fetch-news.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function isPhysicalSecurity(title: string, summary?: string): boolean` from `scripts/fetch-news.mjs`.

- [ ] **Step 1: Write the failing tests**

In `scripts/fetch-news.test.mjs`, change the import line to:

```js
import { classifyTopic, isRelevant, isPhysicalSecurity, parseRSS, fixDate, diffNew } from './fetch-news.mjs';
```

Append after the `classifyTopic` describe block:

```js
describe('isPhysicalSecurity', () => {
  test.each([
    ['access control', 'New mobile credential reader for access control', ''],
    ['video', 'Milestone adds AI search to its VMS', ''],
    ['nvr', 'New 32-channel NVR announced', ''],
    ['perimeter', 'Fence detection upgrade for utility substations', ''],
    ['alarms', 'Alarm monitoring central station adds video verification', ''],
    ['ops', 'Schools deploy gunshot detection', ''],
    ['vendor', 'Genetec launches new release', ''],
    ['cyber on device', 'Critical CVE in Hikvision NVR firmware', ''],
    ['perimeter PIDS', 'Airport upgrades perimeter intrusion detection system', ''],
    ['guard phrase plus physical term', 'Broken access control in door controller firmware', ''],
    ['summary only', 'Product update', 'adds support for PTZ cameras'],
  ])('physical: %s', (_label, title, summary) => {
    expect(isPhysicalSecurity(title, summary)).toBe(true);
  });

  test.each([
    ['ransomware', 'Ransomware hits hospital network', ''],
    ['web app access control', 'Broken access control flaw in web app', ''],
    ['CVE wording', 'Improper access control in Jenkins plugin', ''],
    ['network perimeter', 'Network perimeter firewall bypassed', ''],
    ['lockbit', 'LockBit gang claims attack', ''],
    ['raises alarm', 'Report raises alarm over phishing', ''],
    ['spyware surveillance', 'Spyware used for government surveillance', ''],
    ['virtual machines', 'Attackers encrypt ESXi VMs', ''],
    ['ciso', 'Chief Information Security Officer resigns after breach', ''],
    ['network IDS', 'New intrusion detection system for cloud workloads', ''],
    ['IAM', 'Identity and access management startup raises seed', ''],
  ])('not physical: %s', (_label, title, summary) => {
    expect(isPhysicalSecurity(title, summary)).toBe(false);
  });

  test('handles missing summary', () => {
    expect(isPhysicalSecurity('Verkada ships new camera')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `isPhysicalSecurity is not a function` (or similar import error).

- [ ] **Step 3: Implement**

In `scripts/fetch-news.mjs`, directly after the `classifyTopic` function, add:

```js
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
];

const PHYSICAL_TERMS = [
  // Access control
  /\baccess control\b/, /\bdoor controllers?\b/, /\bbadge readers?\b/, /\bkey ?cards?\b/,
  /\bproximity cards?\b/, /\bmobile credentials?\b/, /\bbiometric readers?\b/, /\bturnstiles?\b/,
  /\bmantraps?\b/, /\b(?:electronic|smart|door) locks?\b/, /\bintercoms?\b/, /\bvisitor management\b/,
  // Video
  /\bvideo management systems?\b/, /\b[nd]vrs?\b/, /\bcctv\b/, /\bptz\b/,
  /\b(?:ip|security|surveillance|thermal|dome) cameras?\b/, /\bvideo surveillance\b/, /\bvsaas\b/,
  /\bvideo analytics\b/, /\bbody[- ]worn\b/, /\bbody cam(?:era)?s?\b/,
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
  // Vendors
  /\b(?:genetec|milestone systems|axis communications|hanwha vision|avigilon|hid global|verkada|brivo|lenel|lenels2|pelco|assa abloy|allegion|hikvision|dahua|bosch security|honeywell security|eagle eye networks|openpath|rhombus|axon)\b/,
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
```

Note: positive regexes must NOT have the `g` flag (`.test()` with `g` is stateful via `lastIndex`). Guards use `g` only with `.replace()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites (existing + new).

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-news.mjs scripts/fetch-news.test.mjs
git commit -m "feat: add isPhysicalSecurity keyword classifier"
```

---

### Task 2: Set `physical` on crawled and merged articles

**Files:**
- Modify: `scripts/fetch-news.mjs` — `fetchAllRaw` return mapping (~line 213) and `diffNew` (~line 243)
- Test: `scripts/fetch-news.test.mjs` — `describe('diffNew')`

**Interfaces:**
- Consumes: `isPhysicalSecurity(title, summary)` from Task 1.
- Produces: every article in `articles.json` carries `physical: boolean`. `diffNew(fresh, known)` still returns `{ merged, newOnes }`; every object in `merged` has `physical` set; objects in `newOnes` are the same references as their entries in `merged`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('diffNew', () => { ... })`:

```js
  test('sets physical on fresh and retained articles', () => {
    const today = new Date().toISOString().slice(0, 10);
    const fresh = [{ url: 'https://a.test/1', title: 'New NVR from Hanwha Vision', summary: '' }];
    const known = [
      { url: 'https://a.test/2', title: 'Ransomware hits hospital', summary: '', publishedAt: today, analysis: 'X' },
      { url: 'https://a.test/3', title: 'Turnstile rollout at stadium', summary: '', publishedAt: today, analysis: 'Y' },
    ];
    const { merged } = diffNew(fresh, known);
    const byUrl = Object.fromEntries(merged.map(a => [a.url, a.physical]));
    expect(byUrl).toEqual({
      'https://a.test/1': true,
      'https://a.test/2': false,
      'https://a.test/3': true,
    });
  });

  test('newOnes share object identity with merged so later analysis lands in output', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'Access control update', summary: '' }];
    const { merged, newOnes } = diffNew(fresh, []);
    newOnes[0].analysis = 'LATER';
    expect(merged[0].analysis).toBe('LATER');
    expect(merged[0].physical).toBe(true);
  });

  test('articles without a title get physical false', () => {
    const { merged } = diffNew([{ url: 'https://a.test/1' }], []);
    expect(merged[0].physical).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `physical` is `undefined` in the new tests.

- [ ] **Step 3: Implement**

In `fetchAllRaw`, the final `deduped.map(...)` object — add a `physical` line after `topic`:

```js
    topic: classifyTopic(a.title, a.summary),
    physical: isPhysicalSecurity(a.title, a.summary),
    fetchedAt: new Date().toISOString(),
```

In `diffNew`, replace the final line `return { merged: sortShapedArticles(merged), newOnes };` with:

```js
  // Recompute for every article so stored data is backfilled and keyword
  // changes apply retroactively. Mutate in place: run() attaches .analysis
  // to the newOnes objects, which must stay the same objects as in merged.
  for (const a of merged) a.physical = isPhysicalSecurity(a.title || '', a.summary);

  return { merged: sortShapedArticles(merged), newOnes };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Sanity-check against real stored data (read-only)**

Run:

```bash
node -e "
import('./scripts/fetch-news.mjs').then(({ isPhysicalSecurity }) => {
  const d = JSON.parse(require('fs').readFileSync('client/public/data/articles.json','utf8'));
  for (const a of d.articles) console.log(isPhysicalSecurity(a.title, a.summary) ? 'PHYS ' : '---- ', a.source.padEnd(20), a.title.slice(0, 80));
});"
```

Expected: cyber-only items (e.g. the MCP SDK OAuth flaw from The Hacker News) show `----`; trade-press items about cameras/access/alarms show `PHYS`. If an obvious misclassification appears, add a test case reproducing it to Task 1's tables, fix the regex lists, rerun `npm test`. Do not write to `articles.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-news.mjs scripts/fetch-news.test.mjs
git commit -m "feat: flag physical security articles in crawl output"
```

---

### Task 3: Client topic, filter, counts

**Files:**
- Modify: `client/src/utils.js` — `TOPICS` (line 1), add `PHYSICAL_BADGE_STYLE` after `TAG_STYLES`, `filterArticles` (~line 68), `topicCounts` (~line 80)
- Create: `client/src/utils.test.js`

**Interfaces:**
- Consumes: articles with optional `physical: boolean` (from Task 2's JSON).
- Produces: `TOPICS.physical = { label: 'Physical Security', color: '#4fffb0' }` as second key; `filterArticles(articles, { topic: 'physical', query })` returns only `a.physical === true`; `topicCounts(articles).physical: number`; `export const PHYSICAL_BADGE_STYLE: { background, color, border }` (used by Task 4).

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils.test.js`:

```js
import { TOPICS, PHYSICAL_BADGE_STYLE, filterArticles, topicCounts } from './utils.js';

const articles = [
  { title: 'Reader launch', summary: '', source: 'SIA',  topic: 'access',   physical: true  },
  { title: 'NVR update',    summary: '', source: 'Axis', topic: 'video',    physical: true  },
  { title: 'Camera CVE',    summary: '', source: 'THN',  topic: 'cyber',    physical: true  },
  { title: 'Ransomware',    summary: '', source: 'THN',  topic: 'cyber',    physical: false },
  { title: 'Old article',   summary: '', source: 'SIA',  topic: 'business'                 },
];

test('Physical Security is the second topic, right after All', () => {
  expect(Object.keys(TOPICS).slice(0, 2)).toEqual(['all', 'physical']);
  expect(TOPICS.physical).toEqual({ label: 'Physical Security', color: '#4fffb0' });
});

test('exports a badge style', () => {
  expect(PHYSICAL_BADGE_STYLE).toHaveProperty('color');
});

test('physical filter returns flagged articles across topics', () => {
  const titles = filterArticles(articles, { topic: 'physical', query: '' }).map(a => a.title);
  expect(titles).toEqual(['Reader launch', 'NVR update', 'Camera CVE']);
});

test('physical filter combines with search query', () => {
  const titles = filterArticles(articles, { topic: 'physical', query: 'nvr' }).map(a => a.title);
  expect(titles).toEqual(['NVR update']);
});

test('data without physical field yields empty physical view', () => {
  const legacy = [{ title: 'A', summary: '', source: 'S', topic: 'video' }];
  expect(filterArticles(legacy, { topic: 'physical', query: '' })).toEqual([]);
  expect(topicCounts(legacy).physical).toBe(0);
});

test('regular topic filter unchanged', () => {
  const titles = filterArticles(articles, { topic: 'cyber', query: '' }).map(a => a.title);
  expect(titles).toEqual(['Camera CVE', 'Ransomware']);
});

test('topicCounts adds physical without disturbing per-topic counts', () => {
  const c = topicCounts(articles);
  expect(c.all).toBe(5);
  expect(c.physical).toBe(3);
  expect(c.cyber).toBe(2);
  expect(c.access).toBe(1);
  expect(c.business).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/utils.test.js`
Expected: FAIL — `TOPICS` keys don't include `physical`; `PHYSICAL_BADGE_STYLE` undefined.

- [ ] **Step 3: Implement**

In `client/src/utils.js`, `TOPICS` — insert after the `all` line:

```js
  physical:   { label: 'Physical Security',   color: '#4fffb0' },
```

After the closing `};` of `TAG_STYLES`, add:

```js
export const PHYSICAL_BADGE_STYLE = { background:'rgba(79,255,176,0.08)', color:'#4fffb0', border:'1px solid rgba(79,255,176,0.25)' };
```

In `filterArticles`, replace the `matchTopic` line with:

```js
    const matchTopic = !topic || topic === 'all' ||
      (topic === 'physical' ? a.physical === true : a.topic === topic);
```

In `topicCounts`, before `return counts;`, add:

```js
  counts.physical = articles.filter(a => a.physical === true).length;
```

- [ ] **Step 4: Run all client tests**

Run: `cd client && npm test`
Expected: PASS (new file plus existing FilterDrawer/MobileBottomNav/hooks tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils.js client/src/utils.test.js
git commit -m "feat: add Physical Security umbrella topic filter"
```

---

### Task 4: "Physical" badge on card and detail panel

**Files:**
- Modify: `client/src/components/ArticleCard.jsx` (import line 2; tag row ~line 23)
- Modify: `client/src/components/DetailPanel.jsx` (import line 2; header tag row ~line 56)
- Create: `client/src/components/ArticleCard.test.jsx`
- Create: `client/src/components/DetailPanel.test.jsx`

**Interfaces:**
- Consumes: `PHYSICAL_BADGE_STYLE` from `client/src/utils.js` (Task 3); `article.physical`.
- Produces: UI only.

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/ArticleCard.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard';

const base = {
  id: 'https://a.test/1', url: 'https://a.test/1', title: 'Reader launch',
  summary: 'New reader', source: 'SIA', publishedAt: '2026-10-01', topic: 'access',
};
const props = { selected: false, isStarred: false, onSelect: vi.fn(), onToggleStar: vi.fn() };

test('shows Physical badge alongside topic tag when flagged', () => {
  render(<ArticleCard article={{ ...base, physical: true }} {...props} />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
  expect(screen.getByText('Access Control')).toBeInTheDocument();
});

test('no Physical badge when not flagged or field missing', () => {
  const { rerender } = render(<ArticleCard article={{ ...base, physical: false }} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
  rerender(<ArticleCard article={base} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
});
```

Create `client/src/components/DetailPanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import DetailPanel from './DetailPanel';

const base = {
  id: 'https://a.test/1', url: 'https://a.test/1', title: 'Reader launch',
  summary: 'New reader', source: 'SIA', publishedAt: '2026-10-01', topic: 'access',
};
const props = { isStarred: false, onToggleStar: vi.fn(), onClose: vi.fn(), isMobile: false };

test('shows Physical badge when flagged', () => {
  render(<DetailPanel article={{ ...base, physical: true }} {...props} />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
});

test('no Physical badge when not flagged', () => {
  render(<DetailPanel article={base} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/ArticleCard.test.jsx src/components/DetailPanel.test.jsx`
Expected: FAIL — "Unable to find an element with the text: Physical" in the two flagged tests.

- [ ] **Step 3: Implement**

`client/src/components/ArticleCard.jsx` — change import line 2 to:

```js
import { TOPICS, TAG_STYLES, PHYSICAL_BADGE_STYLE, formatDate } from '../utils.js';
```

Directly after the topic-label `<span ...>{label}</span>` line, add:

```jsx
          {article.physical && <span style={{ ...PHYSICAL_BADGE_STYLE, fontFamily:'IBM Plex Mono,monospace', fontSize:9, padding:'3px 8px', borderRadius:3, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>Physical</span>}
```

`client/src/components/DetailPanel.jsx` — change import line 2 to:

```js
import { TOPICS, TAG_STYLES, PHYSICAL_BADGE_STYLE, formatDate } from '../utils.js';
```

Directly after the header's `<span ...>{topicLabel}</span>` line, add:

```jsx
            {article.physical && <span style={{ ...PHYSICAL_BADGE_STYLE, fontFamily:'IBM Plex Mono,monospace', fontSize:9, padding:'3px 8px', borderRadius:3, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>Physical</span>}
```

(`textTransform: uppercase` is CSS-only; DOM text stays `Physical`, so `getByText('Physical')` matches.)

- [ ] **Step 4: Run all tests and build**

Run: `cd client && npm test && npm run build`
Expected: all tests PASS; Vite build succeeds.

Run (repo root): `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ArticleCard.jsx client/src/components/DetailPanel.jsx client/src/components/ArticleCard.test.jsx client/src/components/DetailPanel.test.jsx
git commit -m "feat: show Physical badge on flagged articles"
```
