# Venture Signal

GitHub Pages frontend with public business-news signals, country filters, browser-saved favorites, comparisons, live Hacker News discussion research, and an optional Cloudflare AI research API.

## What works without API keys

- On every deployment and approximately every six hours, GitHub Actions retrieves country-specific Google News RSS headlines and publishes `dist/signals.json` with the Pages artifact. Schedules may be delayed; unavailable feeds are reported in the app.
- The frontend filters these current headlines by country and topic. Headlines are research signals, not proof of popularity or customer demand.
- Keyword research retrieves Hacker News / Algolia discussions and Wikipedia background directly from the browser.
- The original 12-card catalog remains an explicitly illustrative collection; its sample scores are separate from the news and AI results.

## Activate country-specific AI ideas later

The AI form stays disabled until a working backend URL is included in the deployment. No browser API key is used.

1. Set up a Cloudflare account with Workers and a workers.dev subdomain. No custom domain is required.
2. Create a Cloudflare API token for deploying Workers to that account (Cloudflare's Edit Workers template; scope it to the intended account).
3. Open https://github.com/sanjeevk20/venture-signal/settings/secrets/actions and add repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `OPENAI_API_KEY` (an OpenAI API project with model and web-search access and sufficient credits)
4. Rerun the Pages workflow. It deploys `backend/worker.mjs`, installs the API key as a Worker secret, verifies `/health`, and writes the public endpoint into the Pages artifact's `config.json`.
5. Open the live app, choose a country, and try “Dukaan”. AI research searches the web, differentiates the company from local shops, and returns ideas, sources, country evidence and pilot experiments. Test a live response before relying on the feature.

Cloudflare and OpenAI billing are separate. Set provider budget controls before enabling secrets. No paid research is performed by this repository's scheduled job. The Worker makes AI requests only when a visitor submits research. A public endpoint has a per-IP limit of three requests per minute and a six-hour shared result cache; these are not a guarantee of a monthly spending cap.

## Backend behavior

- `GET /health`: readiness, no credentials.
- `POST /api/research`: JSON `{ "query": "Dukaan", "country": "India" }`, accepted from `https://sanjeevk20.github.io`.
- Supported countries: India, United States, United Kingdom, Canada, Australia, Germany, Singapore and United Arab Emirates.
- Default model: `gpt-4.1-mini`, configurable in `backend/wrangler.jsonc`.
- Research prompt: `backend/prompt.mjs`. Search terms are sent to OpenAI; public search sources are used for analysis.
- The server only retains cited URLs that appear in the current provider's actual web-search sources or citation annotations. It drops unsourced ideas, downgrades single-publisher evidence and never substitutes demo results on errors. Country relevance, publication dates and AI claims still need human verification.
- CORS limits browser use to the app's origin. It is not authentication. GitHub Pages project paths share the same origin.
- Cache retention is up to six hours; the app shows the original research timestamp when using cached results.

## Deploy GitHub Pages

In Settings → Pages choose **GitHub Actions**. Push to `main`, run the workflow manually, or wait for the scheduled refresh. The workflow validates logic, refreshes news, runs mobile browser checks, optionally deploys the API, publishes `dist`, and verifies the hosted files. If the three backend secrets are missing, it publishes the frontend with AI research explicitly pending.

## Local checks

```sh
node tests/research.test.mjs
node tests/backend.test.mjs
python3 tests/test_signals.py
python3 scripts/refresh-signals.py
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Run the feed refresh only with internet access. Browser QA is configured in GitHub Actions with Playwright; fixture-based tests do not prove live AI/provider availability. Source errors are shown instead of fabricated results.
