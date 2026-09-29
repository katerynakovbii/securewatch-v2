# SecureWatch v2

Static, no-login version of SecureWatch: an intelligence dashboard for
physical security industry news. No accounts, no user data collection.
Deployed on GitHub Pages.

## How it works

A scheduled GitHub Actions workflow (`.github/workflows/update-news.yml`)
crawls 14 RSS feeds every 6 hours, classifies and deduplicates articles,
generates an AI analysis brief (via Claude Haiku) for each newly-seen
article, and commits the result as `client/public/data/articles.json`.
The React client (in `client/`) fetches that file directly — there is no
server at request time.

## Local development

```bash
npm install
npm install --prefix client
npm run fetch-news        # requires ANTHROPIC_API_KEY in your shell env; writes client/public/data/articles.json
cd client && npm run dev
```

## Manually triggering a data refresh

Go to the repo's **Actions** tab → **Update news data** workflow → **Run workflow**.

## Environment variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | GitHub Actions repo secret | Yes | Claude API key, used only inside the workflow job. Never sent to the browser. |
