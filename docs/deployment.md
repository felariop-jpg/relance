# Deploying Relance

Relance is a static site: the build in `dist/` is plain HTML, CSS, JavaScript and images, with relative paths. It can be served from any static host. This page covers the current setup (GitHub Pages from a private repository) and what to do if that stops working.

## Current setup

- **Host:** GitHub Pages, published by the workflow `.github/workflows/deploy.yml` on every push to `main`: install, test, build, deploy. Pull requests are tested but not deployed.
- **Site:** https://felariop-jpg.github.io/relance/
- **Repository:** private (the source was public earlier; see below).
- **Base path:** one constant, `BASE_PATH` in `vite.config.ts`. It is `'./'` (relative), which works both under a sub-path (`/relance/` on GitHub Pages) and at the root of another host. Changing hosts normally needs no edit; if one ever does, it is that one line.
- **Guides** (`docs/*.md`, `PRIVACY*.md`) are also built into the site as pages under `docs/` (see `scripts/docs-plugin.ts`), so the in-app help links work whether or not the repository is public.

## Pages from a private repository needs GitHub Pro

GitHub only serves Pages from a **private** repository on paid plans (Pro, Team, Enterprise). Here, **GitHub Pro comes from the GitHub Student Developer Pack.**

**When student verification expires, the account returns to GitHub Free, and the site stops being served.** Nothing is lost: the repository and its history stay, and the users' data was never on GitHub (it lives in their browsers). But the URL stops working until you do one of the following:

1. **Make the repository public again** (Settings → General → Danger Zone → Change visibility). Pages from public repositories is free. Re-run the deploy workflow afterwards (Actions → *Test and deploy to GitHub Pages* → Run workflow).
2. **Move hosting to Cloudflare Pages**, which builds from private repositories on its free plan (steps below). Keep the repository private.

A good habit: note the date your student verification ends, and decide a month before.

Private repositories also have a monthly allowance of GitHub Actions minutes (smaller on Free than on Pro). One Relance build takes about a minute, so this is unlikely to matter.

## What "private" does and does not protect

- A private repository **hides the source code, history and issues on GitHub.**
- It does **not** restrict the website. **Anyone with the URL can open the site.** There is no login, by design.
- Because this is a static site, **the full application code is downloaded by every visitor's browser** and can be read with the browser's developer tools. The build contains no source maps, but the JavaScript is readable. Nothing secret is, or ever should be, in the code: API keys are entered by each user and stay in their own browser.
- Users' contacts are never on the site or in the repository. They are stored in each user's browser only.

In short: going private keeps the *source* out of view. It does not make the *app* private, and it doesn't need to.

## Moving to Cloudflare Pages

Cloudflare Pages can deploy straight from a private GitHub repository on its free plan (at the time of writing: unlimited static requests and a monthly build allowance far above what Relance needs).

1. Create a free account at **dash.cloudflare.com** and sign in.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorise Cloudflare's GitHub app and give it access to the `relance` repository only.
4. Select the repository and set:
   - **Production branch:** `main`
   - **Framework preset:** None (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22`
5. Click **Save and Deploy**. The first build takes a minute or two. The site appears at `https://<project-name>.pages.dev/`.
6. Open the new URL and check: the welcome screen appears; **Load sample contacts** works; a guide link (for example Settings → *How to get an API key*) opens its page; the page source contains the `Content-Security-Policy` meta tag.
7. Optional: add a custom domain under the project's **Custom domains** tab.
8. Tell users the new address. **Their data does not move with the site**: each browser keeps data per address. Ask them to **download a backup on the old address and restore it on the new one** (Settings → Backup), before the old site stops.
9. Stop publishing to GitHub Pages: in the repository, **Settings → Pages → Source → None**, and delete or disable `.github/workflows/deploy.yml`. Keep the test step if you want pull requests tested: remove the `upload-pages-artifact` step and the `deploy` job.
10. Update the live-site links in `README.md` and `README.fr.md`.

No code change is needed for Cloudflare: `BASE_PATH` is relative and the app uses hash navigation (`#/contacts`), so there are no server routes to configure.

## Checking a deployment

- The workflow run is green (Actions tab).
- The site loads and shows the welcome screen in a private window.
- `view-source:` on the page shows `connect-src 'self' https://api.anthropic.com`.
- `<site>/docs/getting-started.html` opens with its screenshots.
