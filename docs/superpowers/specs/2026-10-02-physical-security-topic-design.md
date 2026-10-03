# Physical Security Topic — Design Spec

**Status:** approved in brainstorming, pending written-spec review.
**Owner ask:** a dedicated topic covering every aspect of physical
security — access control, video management, perimeter detection,
intrusion/alarms, etc. — and exclusively physical security, not security
in general.

## 1. Goal

Add a "Physical Security" entry to the topic list that shows every
article about physical security, regardless of which existing topic the
article was classified under.

It is an **umbrella filter**, not a peer topic: each article keeps its
single existing `topic` (`access`, `video`, `ai`, `business`, ...) and
additionally gets a boolean `physical` flag. Selecting "Physical
Security" shows all articles with `physical === true`.

### Inclusion rule

An article is physical security if its title or summary mentions a
physical security device, system, or practice (see §2 vocabulary).

- Cyber attacks on physical security devices **are included**
  (e.g. "Critical CVE in Hikvision NVRs", "Hackers exploit access control
  panels"). Cyber terms never disqualify an article.
- Pure cyber/IT news with no physical anchor **is excluded**
  (e.g. "Ransomware hits hospital", "Broken access control in web app",
  "Network perimeter firewall bypass").

### Non-goals

- No change to existing single-label `topic` classification.
- No Claude/LLM involvement in the decision — deterministic keyword rules
  only.
- No new feeds.

## 2. Pipeline — `scripts/fetch-news.mjs`

### New export: `isPhysicalSecurity(title, summary) → boolean`

Lowercases `title + ' ' + summary`, removes ambiguous IT phrases
(guard list below), then returns true if any positive pattern matches the
remaining text.

**Positive vocabulary**, grouped by area (regex patterns, word-boundary
where needed to avoid substring hits):

| Area | Terms |
|---|---|
| Access control | access control (after guard removal), access control panel/reader/system, door controller, badge reader, keycard, key card, proximity card, mobile credential, biometric reader, turnstile, mantrap, electronic lock, smart lock, door lock, intercom, visitor management |
| Video | video management system, `\bvms\b`, `\bnvr\b`, `\bdvr\b`, cctv, ip camera, security camera, surveillance camera, ptz, thermal camera, dome camera, video surveillance, vsaas, video analytics, body-worn / body worn / body camera |
| Perimeter | perimeter detection, perimeter protection, perimeter security, perimeter intrusion, fence detection, fence sensor, ground radar, lidar sensor, bollard, vehicle barrier, crash-rated, gate operator, `\balpr\b`, `\banpr\b`, license plate recognition/reader |
| Intrusion & alarms | intrusion alarm, intrusion panel, burglar alarm, alarm panel, alarm monitoring, central station, monitoring center, motion sensor, motion detector, glass-break / glass break, panic button, duress alarm, security system installer/integrator |
| Ops & other | physical security, psim, gsoc, guard tour, security guard, security officer, gunshot detection, gun detection, weapons detection, metal detector, school safety, campus safety |
| Vendors | genetec, milestone systems, axis communications, hanwha vision, avigilon, hid global, verkada, brivo, lenel, lenelS2, pelco, assa abloy, allegion, hikvision, dahua, bosch security, honeywell security, eagle eye networks, openpath, rhombus, axon |

Broad conglomerate names (Motorola Solutions, Johnson Controls) are not
vendor triggers; their physical articles match via product terms.

**Ambiguity guards** — phrases stripped from the text before positive
matching, because in IT context they look physical but are not:

- "broken access control", "identity and access management", `\biam\b`,
  "privileged access", "role-based access control", "access control list",
  `\bacl\b`
- "network perimeter", "perimeter firewall", "cloud perimeter"
- "intrusion detection system" / `\bids\b` / "intrusion prevention"
  (network IDS/IPS)
- "threat detection", "endpoint detection", `\bedr\b`, `\bxdr\b`
- "credential theft", "credential stuffing", "stolen credentials"
- "lockbit"
- "raises alarm", "sounds the alarm", "alarm bells"
- "surveillance" not counted by itself (spyware/government surveillance);
  only the compound video terms above count

Bare "credential", "identity", "zero trust", "monitoring", "detection",
"alarm", "camera", "surveillance" are deliberately **not** positive on
their own.

### Shaping and merge

- `fetchAllRaw` output objects gain `physical: isPhysicalSecurity(title, summary)`.
- `diffNew`: after merging, set `physical` on every article in `merged`
  (fresh and retained) by recomputing from title+summary. This backfills
  existing stored articles on the first run; no separate migration.
  Recomputing every run also means keyword tweaks apply retroactively.

### Tests — `scripts/fetch-news.test.mjs`

New `describe('isPhysicalSecurity')`:
- true, one per area: access control reader, VMS/NVR, perimeter fence
  detection, alarm monitoring central station, gunshot detection, vendor
  name (e.g. "Genetec launches ...").
- true, cyber-on-device: "Critical CVE in Hikvision NVR firmware".
- false, pure cyber: "Ransomware hits hospital network", "Broken access
  control flaw in web app", "Network perimeter firewall bypassed",
  "LockBit gang claims attack", "Report raises alarm over phishing",
  "Spyware used for government surveillance".
- true, guard phrase and physical term together: "Broken access control in
  door controller firmware" → true (door controller remains after guard
  removal).

`diffNew` test: retained article without `physical` field gets it
recomputed in `merged`.

## 3. Client

### `client/src/utils.js`

- `TOPICS`: insert `physical: { label: 'Physical Security', color: '#4fffb0' }`
  directly after `all`, so it renders second in the sidebar and mobile
  filter drawer (both iterate `TOPICS`; no component change needed for the
  list itself).
- `filterArticles`: `topic === 'physical'` → match `a.physical === true`.
  Other topics unchanged (`a.topic === topic`).
- `topicCounts`: `counts.physical` = number of articles with
  `physical === true`. Overlaps other counts by design. Articles never
  increment `counts.physical` via `a.topic`.
- `sortArticles` "By topic" unchanged (uses `a.topic`).
- Missing `physical` field (JSON produced before the first run with this
  change) is treated as false.

### Badge

`ArticleCard.jsx` and `DetailPanel.jsx`: when `article.physical`, render a
small secondary "Physical" badge next to the existing topic tag, using the
same tag styling pattern (new `PHYSICAL_BADGE_STYLE` in `utils.js`). The
existing topic tag is unchanged.

### Sidebar stat

`Sidebar.jsx` "Topics" stat (`Object.keys(TOPICS).length - 1`) goes from
10 to 11 automatically. Acceptable; no change.

### Tests

- New `client/src/utils.test.js`: `filterArticles` with `topic: 'physical'`
  returns only flagged articles across different `topic` values; missing
  field treated false; `topicCounts` includes correct `physical` count
  without disturbing per-topic counts.
- `FilterDrawer.test.jsx`: "Physical Security" option renders and
  selecting it calls `setTopic('physical')`.

## 4. Branch / coordination

Built on branch `physical-security-topic` off `main`. The in-progress
`trend-detection` branch also edits `App.jsx` and `utils.js`; this change
is additive (new key, one new branch in two functions), so conflicts
should be small and resolved at merge time.
