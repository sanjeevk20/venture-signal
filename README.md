# Venture Signal

Static business idea explorer with browser-saved favorites, comparisons, and live internet research. No build step, API key, or backend required.

## GitHub Pages

1. Add these project files to the intended GitHub repository on `main`.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Run **Test and deploy Venture Signal to GitHub Pages** from Actions, or push to `main`.
4. The workflow validates the app, publishes `dist`, then checks the deployed HTML and JavaScript. The deployment URL appears in the workflow's environment.

If using another default branch, update `on.push.branches` in `.github/workflows/pages.yml`.

## Local usage

Serve `dist` over HTTP; do not open the HTML as a local file, because browsers restrict JavaScript module loading from file URLs:

```sh
python3 -m http.server 8000 --directory dist
```

Then visit http://localhost:8000.

## Verification

```sh
node --check dist/app.js
node --check dist/research.mjs
node tests/research.test.mjs
```

Live research calls Hacker News / Algolia and Wikipedia directly from the visitor's browser. The visitor's search terms are sent to these services. Live data requires internet access and their CORS support. Mocked automated tests verify calculations, query windows, failure behavior and escaping; they do not verify live services or browser rendering.

Hacker News provides technology discussion signals, not whole-market analysis. Scores on curated idea cards are illustrative and separate from live research. Wikipedia provides background only.
