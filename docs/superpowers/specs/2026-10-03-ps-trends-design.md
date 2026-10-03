# PS Trends — Design Spec

**Status:** approved in brainstorming, pending written-spec review.
**Owner ask:** a "PS Trends" view that shows only physical security
trends.

## 1. Goal

Add a second, independent trend archive built only from physical security
articles (`article.physical === true`, from the Physical Security topic),
shown in its own "PS Trends" tab. The existing Trends tab and
`trends.json` are unchanged.

Rationale: the general trend pass is dominated by cyber themes (e.g. on
2026-10-03 the only confirmed trend had 0 of 7 physical articles), so
physical themes surface only as thin "emerging" items. A dedicated pass
over physical-only articles gives physical themes their own clustering,
naming, history and archive.

### Non-goals

- No change to the general Trends output, thresholds or UI.
- No new workflow file, no new secret.
- No backfill of PS trend history before the first run.

## 2. Pipeline — `scripts/detect-trends.mjs`

### Profiles

Introduce `PROFILES`, one entry per archive:

| Profile | Article filter | Output file | Prompt |
|---|---|---|---|
| `general` | all articles | `client/public/data/trends.json` | existing prompt, unchanged |
| `physical` | `a.physical === true` | `client/public/data/trends-physical.json` | existing prompt + physical restriction |

Physical restriction, appended to the prompt's instructions:
"Only report physical security themes (access control, video
surveillance, perimeter and intrusion detection, alarms and monitoring,
guarding, security integrators/industry). A cyber theme qualifies only if
it concerns physical security devices or systems." This backstops keyword
false positives so the output stays strictly physical.

### `run()`

`run({ apiKey, force, now })` iterates the profiles sequentially. Each
profile independently:
- loads its own archive file (missing/invalid → `{ lastRunAt: null, trends: [] }`),
- applies its own once-per-UTC-day guard (`shouldRun` on its own `lastRunAt`; `force` applies to both),
- windows articles (`TREND_WINDOW_DAYS`) after applying the profile filter,
- makes its own Claude call,
- sanitizes, merges, prunes and writes with the existing pure functions.

A failure (Claude error, unparseable response, no articles in window) in
one profile leaves that profile's archive unchanged and does not stop the
other profile. Thresholds (`TREND_WINDOW_DAYS = 14`,
`CONFIRMED_MIN_ARTICLES = 4`, `CONFIRMED_MIN_SOURCES = 2`,
`TREND_RETENTION_DAYS = 365`, `SIGNAL_TYPES`) are shared by both profiles.

The CLI entry point still runs `run({ force: FORCE_TRENDS === 'true' })`
and logs one line per profile.

### Workflow — `.github/workflows/update-news.yml`

- "Detect trends" step unchanged (it runs both profiles).
- Commit step `git add`s `client/public/data/trends-physical.json` too.
- `force_trends` input description updated to say it forces both.

### Cost

One extra Claude call per day, input roughly the physical subset of the
14-day window.

## 3. Client

### `client/src/hooks/useTrends.js`

`useTrends(file = 'trends.json')` builds its URL from `file`. Behaviour
otherwise unchanged, except: an HTTP 404 resolves to empty
(`trends: []`, `lastRunAt: null`, no error), so the PS tab shows an empty
state, not an error, before the first physical run lands.

### `client/src/App.jsx`

Calls `useTrends()` and `useTrends('trends-physical.json')`, loads both on
mount. New tab key `ps-trends` renders `TrendsPanel` with the physical
data and `emptyText="No physical security trends detected yet — detection runs daily."`.

### `TrendsPanel.jsx`

Optional `emptyText` prop; when there are no active trends it replaces
the existing empty message. Default keeps the current text.

### Tabs

- `Topbar.jsx`: tabs `feed · starred · trends · PS trends` (key
  `ps-trends`, label `PS trends` in the existing lowercase/uppercase style
  of the other tabs).
- `MobileBottomNav.jsx`: fifth button "PS Trends" after "Trends",
  `active` when `tab === 'ps-trends' && !filterDrawerOpen`, closes the
  filter drawer on click. Icon: the Trends icon plus a small `#4fffb0`
  dot/shield so the two are distinguishable. Five buttons must fit at
  400px width.

## 4. Tests

- `scripts/detect-trends.test.mjs`:
  - physical profile filter keeps only `physical === true` articles;
  - physical prompt contains the restriction; general prompt does not;
  - `run` writes both files independently (Claude mocked);
  - one profile's Claude failure leaves its file unchanged and the other
    profile still writes;
  - per-profile `shouldRun` guard (one already ran today, the other not).
- Client:
  - `useTrends('trends-physical.json')` fetches that file; 404 → empty, no error;
  - Topbar renders "PS trends" and clicking calls `setTab('ps-trends')`;
  - MobileBottomNav renders "PS Trends" and clicking calls `setTab('ps-trends')`;
  - TrendsPanel shows `emptyText` when given and no trends.

## 5. Open items for the plan

- Exact mobile icon markup — implementer's call within the constraint above.
- Whether `run()` returns an object keyed by profile or an array —
  plan picks one; tests follow.
