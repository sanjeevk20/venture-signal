# Venture Signal — GitHub Actions edition

The complete app is hosted on GitHub Pages. GitHub Actions supplies scheduled dynamic content. No Cloudflare service, API endpoint, AI subscription or repository secrets are required.

## How it works

1. On a push to `main`, a manual workflow run, or approximately every six hours, `scripts/refresh-signals.py` fetches country-specific public Google News RSS headlines.
2. `scripts/build-ideas.mjs` groups the latest headlines by country and topic and creates exploration briefs only for groups with sources. Three editorial business hypotheses cover retail operations, AI automation and local repair/reuse services.
3. The workflow publishes `signals.json`, `ideas.json` and the app to GitHub Pages. Generated data is in the deployment artifact, not committed back to the repository.
4. Visitors search the current snapshot instantly in their browser. “Dukaan”, “kirana” and “दुकान” match retail briefs. Country and topic filters apply to both news and briefs.
5. The separate live Hacker News / Wikipedia research tool remains available for on-demand public discussion searches.

**These briefs are not AI-generated.** Their suggested customer problems and pilots are editorial templates. Refreshed headlines provide topic context only; full articles have not been read or summarized. News mentions do not establish popularity, country demand or commercial viability. No unsupported market scores or paid research are generated. Empty feeds and unmatched searches show honest empty states.

## Hosting and refresh

Choose **GitHub Actions** under repository Settings → Pages. The workflow runs automatically on `main` and approximately every six hours. GitHub schedules can be delayed, and public feeds can fail. Published data retains its build timestamp; visitors must refresh the page to load a newer snapshot. To request an earlier refresh, the repository owner can run the workflow manually from Actions.

Workflow: https://github.com/sanjeevk20/venture-signal/actions/workflows/pages.yml
Live app: https://sanjeevk20.github.io/venture-signal/

## No Cloudflare dependency

The Cloudflare deployment step, Worker source and backend configuration have been removed. The app does not read Cloudflare or OpenAI secrets or call an AI backend. Any previously created external Worker or provider account is not deleted by this repository update; this project had not activated one. Previously added repository secrets are unnecessary for this version.

GitHub Actions is scheduled computation, not an always-running server. An arbitrary visitor query does not trigger a fresh web crawl or a workflow. Searches filter published briefs. For topics outside the snapshot, the app links to Google News and retains its live discussion-search tool.

## Local verification

```sh
node tests/research.test.mjs
node tests/ideas.test.mjs
python3 tests/test_signals.py
python3 scripts/refresh-signals.py
node scripts/build-ideas.mjs
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Feed refresh requires internet access. The GitHub workflow also runs mobile browser tests using fixture feeds and verifies the published JavaScript and data files. Those tests do not validate market demand or third-party service uptime.

## Optional request audit panel

Use **API audit: Off/On** in the header. Logging is off by default. When enabled it shows button clicks, form submissions, filter changes and fetch requests with method, full URL, HTTP status and time to response headers. Local actions are explicitly shown without an API request. Background fetches are separate; only requests started synchronously during an interaction are grouped under that interaction.

The panel keeps up to 100 action groups and 25 requests per group in tab memory. Its on/off preference survives reloads in the same browser session, but log entries do not. Reload while enabled to capture initial data loading. Clear log resets the display; disabling stops recording. Known credential query parameters are redacted. Search terms may be visible in URLs. Headers, request bodies, response contents, navigation, fonts and script downloads are not logged or uploaded.

Published app data: `https://sanjeevk20.github.io/venture-signal/signals.json` and `https://sanjeevk20.github.io/venture-signal/ideas.json`. Live discussion research calls `https://hn.algolia.com/api/v1/search_by_date` and `https://en.wikipedia.org/w/api.php`. News RSS is fetched by GitHub Actions, not by browser button clicks.

## Reddit pain points

The Reddit section searches the published discussion snapshot and offers direct Reddit searches sorted by comment count. Community filters include r/india, r/indianstartups, r/smallbusiness, r/Entrepreneur, r/startups and r/SaaS. Direct searches cover the last year; scheduled snapshot collection covers the last month. Minimum-comment filters apply only to retrieved snapshot posts. Comments are not automatically classified as complaints.

GitHub Actions attempts a small anonymous Reddit search API collection every refresh. HTTP 401/403/429 stops further requests and is reported without alternate hosts or access workarounds. Reddit may require approved authenticated API access, so snapshot retrieval is not guaranteed. The section remains useful through direct search links when retrieval is unavailable. No million-comment dataset is claimed; no usernames, post bodies or comment bodies are stored. Counts are whole-thread counts at the snapshot time, not counts of negative comments. Country relevance is not verified from community names.

Browser data endpoint: `https://sanjeevk20.github.io/venture-signal/reddit.json`. Scheduled upstream endpoint: `https://www.reddit.com/search.json`. The audit panel records the snapshot fetch, while filtering is local. Opening Reddit is navigation and does not appear as a fetch request.
