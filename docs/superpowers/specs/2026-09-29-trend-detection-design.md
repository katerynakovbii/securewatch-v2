# Trend Detection — Design Spec

**Status:** approved, ready for implementation plan.
**Owner ask:** marketing manager needs to see what the physical security
industry is talking about / worried about right now, backed by real
articles — not just a topic filter.

## 1. Goal

Add a "Trends" feature on top of the existing article corpus. A trend is
an emergent theme across multiple articles, distinct from the existing
static `topic` classification (business/cyber/cloud/integration/building/
ai/access/video/regulation/tech) — a trend is a specific, dated narrative
("deepfake-driven ID fraud hitting credential systems"), not a category.

Two tiers:
- **Confirmed trend** — enough article volume to be a real, current theme.
- **Emerging trend** — too few articles to confirm yet, but strong early
  signal (an authoritative source, a big claim, convergence across topic
  categories, or a burst of coverage) suggests it's worth surfacing before
  it's obvious.

Every trend, confirmed or emerging, must carry a clear, human-readable
explanation of *why* it's flagged and *which* articles/sources are the
evidence — this is the feature's whole point, not an afterthought.

Trends are archived permanently (pruned only past 1 year old) with a
first-detected date and, once they stop being active, a cooled-off date —
so the marketing manager can look back at what was trending in a given
month, not just what's trending today.

## 2. Data flow

```
existing (unchanged):
  RSS/CoreWillSoft fetch → per-article Claude analysis → articles.json

new:
  articles.json (last TREND_WINDOW_DAYS)
    + trends.json (existing non-cooled trends, for continuity)
    → one Claude call → detect-trends.mjs merge/cooling logic
    → trends.json (updated archive)
```

Runs as a new step in the existing `.github/workflows/update-news.yml`,
after the "Fetch news and run AI analysis" step and before "Commit updated
article data" — so `articles.json` and `trends.json` land in the same
commit. Not a new workflow file.

**Cadence:** once per day, not every 6h. The script itself guards this —
at the top of `run()`, it reads `trends.json`'s `lastRunAt`; if that
timestamp falls on the same UTC calendar day as now, it logs and exits
without calling Claude, unless invoked with `{ force: true }` (wired to a
`workflow_dispatch` boolean input `force_trends`, default false, for manual
testing). This keeps the cadence logic in one testable place rather than
split into GitHub Actions YAML conditionals.

**Secret:** reuses the existing `ANTHROPIC_API_KEY` — no new secret.

## 3. Data model — `client/public/data/trends.json`

```json
{
  "lastRunAt": "2026-09-29T06:00:00.000Z",
  "trends": [
    {
      "id": "deepfake-id-fraud-2026-09",
      "name": "Deepfake-driven ID fraud hitting credential systems",
      "status": "confirmed",
      "firstDetected": "2026-09-15",
      "lastActive": "2026-09-29",
      "cooledAt": null,
      "rationale": "Plain-text, 2-4 sentences: why this is a trend (confirmed) or why it looks like it will be big (emerging).",
      "signalTypes": [],
      "articleCount": 7,
      "sources": ["HID Global", "SIA", "Dark Reading"],
      "articles": [
        { "url": "https://...", "title": "...", "source": "...", "publishedAt": "2026-09-20" }
      ]
    }
  ]
}
```

Field notes:
- `status`: `"emerging" | "confirmed" | "cooled"`.
- `signalTypes`: populated only while `status === "emerging"` — subset of
  `["source_authority", "claim_magnitude", "cross_topic", "velocity"]`.
  Cleared (or left as historical record — see Open Item below) once a
  trend promotes to `confirmed`.
- `cooledAt`: null while active (emerging or confirmed); set to a date the
  first run a previously-active trend no longer has qualifying evidence in
  the current window.
- `articles`: the full accumulated evidence list across all runs this
  trend has been active, not just the current run's window — dedup by
  `url`.
- Array order: not significant: the client sorts for display (active
  trends by `lastActive` desc, archive by `cooledAt` desc).

**Retention:** any trend with `status === "cooled"` and `cooledAt` more
than 365 days ago is dropped from the array on write (prune step, pure
function, unit tested). Nothing else is ever deleted.

## 4. Detection window & thresholds

- `TREND_WINDOW_DAYS = 14` — only articles published within the last 14
  days are considered as current evidence for whether a trend is still
  active this run. (Distinct from the article corpus's own 30-day
  retention — a trend can only be "currently trending" over a shorter,
  more current slice of it.)
- `CONFIRMED_MIN_ARTICLES = 4` **and** `CONFIRMED_MIN_SOURCES = 2` — a
  cluster needs both to count as confirmed (guards against one prolific
  source posting 4 near-duplicate items looking like a trend).
- Below that bar: still eligible as **emerging** if the Claude call
  identifies at least one of the four signal types below in the cluster's
  evidence — not article-count driven at all, a judgment call:
  - `source_authority` — a named major vendor (Genetec, Axis, Verkada,
    HID, Brivo, Bosch, etc.), SIA, or a named executive/speaker is quoted.
  - `claim_magnitude` — the article itself describes something as large in
    scope: funding round, acquisition, new regulation/mandate proposal, a
    breach affecting many organizations.
  - `cross_topic` — the same underlying theme appears in articles spanning
    multiple different `topic` categories (e.g. shows up as both `ai` and
    `regulation` and `cyber`).
  - `velocity` — 2-3 articles published within days of each other (a
    burst), rather than spread across the whole window.

Thresholds live as named constants at the top of `scripts/detect-trends.mjs`
(mirroring `MAX_ARTICLE_AGE_DAYS` in `fetch-news.mjs`), not hardcoded
inline, so they're one visible place to tune later.

## 5. The Claude call — one per run, combined confirmed+emerging pass

Single call, not two passes (keeps cost down, lets the model see the whole
window at once). Input:
- All articles in the 14-day window: `title`, `summary`, `source`,
  `publishedAt`, `topic`, `url` (not the per-article `.analysis` brief —
  irrelevant to trend clustering and would bloat the prompt).
- The current archive's non-`cooled` trends: `id`, `name`, `rationale`,
  `status` — so the model can match new evidence to an existing trend
  instead of re-naming the same theme slightly differently each run (same
  carry-forward principle as `diffNew`'s `.analysis` reuse in
  `fetch-news.mjs`).

Requested output: strict JSON, an array of cluster objects, each either
matched to an existing trend `id` or flagged `"new"`, with `status`
(`emerging`/`confirmed`), `rationale`, `signalTypes` (emerging only), and
the supporting article `url`s from the window. The prompt explicitly
instructs plain-text rationale (no markdown), consistent with the existing
per-article analysis prompt's style.

`detect-trends.mjs` then merges this response into the archive:
- Matched-existing + still qualifying → update `lastActive`, append new
  article evidence (dedup by url), update `status` if promoted from
  emerging to confirmed, update `rationale`.
- `"new"` → create a new record, `firstDetected = lastActive = today`.
- Existing non-cooled trend NOT present in this run's response → mark
  `cooled`, stamp `cooledAt = today`. (Confirmed trends never demote to
  emerging — they only go to cooled.)

This merge logic — matching, promotion, cooling, pruning — is pure and
unit-testable without touching Claude, exactly like `diffNew`. Only the
single Claude call itself needs mocking in tests.

## 6. Client — `client/src/hooks/useTrends.js`

New hook, same shape/pattern as the existing `useApi.js`/`useNews`: fetches
`client/public/data/trends.json`, returns
`{ trends, loading, error, lastRunAt }`. No new global state management —
consistent with the rest of the app's static-fetch pattern.

## 7. UI — new "Trends" tab

A new tab alongside the existing topic-filter dashboard (not a replacement).
Two components:

- `TrendsPanel.jsx` — the tab's container. Splits trends into "Active"
  (status `emerging` or `confirmed`, sorted `lastActive` desc) and a
  collapsed "Archive" section (status `cooled`, sorted `cooledAt` desc,
  toggled open on click — keeps the default view focused on what's current
  while the full year stays one click away).
- `TrendCard.jsx` — one trend: name, status badge (🔒 Confirmed / 🔍
  Emerging / archived styling for cooled), the rationale paragraph, a
  `signalTypes` chip row (emerging only — human-readable labels: "Named
  source", "Big claim", "Cross-industry", "Fast-breaking"), first-detected
  → last-active (or → cooled) date range, article count, and an expandable
  list of the supporting articles (title, source, published date, links
  out — same link-out pattern as the existing `ArticleCard`).

No search/star/sort controls on this tab for v1 of the feature — YAGNI;
the archive toggle plus chronological sort covers the stated need. Can
revisit if the marketing manager asks for more.

## 8. Testing

- `scripts/detect-trends.test.mjs`, mirroring `scripts/fetch-news.test.mjs`:
  unit tests for the pure merge functions (new-trend creation, matching by
  id, emerging→confirmed promotion, cooling when absent from a run's
  response, pruning cooled trends past 365 days) using fixture data — no
  network/Claude calls in tests, same pattern as `fetch-news.test.mjs`
  already established.
- `client/src/hooks/useTrends.test.js` and `TrendCard`/`TrendsPanel`
  component tests, mirroring the existing `useApi.test.js` /
  `ArticleCard` test patterns already in the codebase.

## 9. Out of scope / open items for the implementation plan to decide

- Whether `signalTypes` is cleared or retained as historical record once a
  trend promotes from emerging to confirmed — implementation plan should
  pick one and note it; leaning toward *retain* (cheap, useful history,
  no reason to erase it) but not load-bearing enough to fix here.
- No UI affordance to manually dismiss/hide a trend — not requested, not
  in scope for v1.
- No email/Slack notification when a new emerging trend appears — not
  requested; the existing app has no notification surface at all.
- Exact wording of the four `signalTypes` chip labels in the UI — cosmetic,
  implementer's call within the plan, following existing UI copy tone.
