# PRS Tools

A suite of printable PRS Good Neighbor Program document builders. It ships as one installable
Progressive Web App with three pages: coordinators use a **Success Story Builder** and an **Event
Flyer Builder**, mostly on iPad, installed to the home screen so each behaves like a standalone
app rather than a browser tab. A regional manager authors the flyer templates coordinators pick
from, using an unlinked **Template Creator** page.

## Suite layout and URLs

| Page | For | Path |
|---|---|---|
| Landing page | anyone opening the site root | `/` |
| Success Story Builder | coordinators, building success-story one-pagers | `/success-story/` |
| Event Flyer Builder | coordinators, building event flyers from a template | `/event-flyer/` |
| Template Creator | the regional manager, authoring flyer templates | `/template-creator/` (unlinked) |

- Production: https://zdonhauser.github.io/prs/
- Staging: https://zdonhauser.github.io/prs/staging/

Both host the same three tool pages at the paths above (e.g.
https://zdonhauser.github.io/prs/event-flyer/ in production,
https://zdonhauser.github.io/prs/staging/event-flyer/ on staging).

**The template creator is deliberately unlinked, not access-controlled.** It isn't on the landing
page and isn't linked from either tool, so it won't show up by accident to a coordinator browsing
the site. That's all it does. There's no login and no server-side check — it's a static page like
any other in this repo, visible to anyone who has or guesses the URL. Don't treat "unlinked" as
"secured"; if that ever needs to change, it needs real access control, not a better hiding place.

## For the regional manager: adding a flyer template

No coding or command line needed — everything below happens in a regular web browser.

**1. Build the template.** Open the template creator:

https://zdonhauser.github.io/prs/template-creator/

(This page isn't linked from anywhere else — worth bookmarking.) Fill in the template: its name,
month, eyebrow/headline/subtitle/description text, a photo, colors, watermark, and which fields
coordinators are allowed to fill in for this event. The preview on the right updates as you type,
showing exactly what a coordinator will see. When it looks right, click the **"↓ Export Template"**
button near the top of the page. That downloads a file named after the template (for example
`winter-safety-fair.json`) — on an iPad it opens the Share sheet instead, so save it somewhere
you can find it, like Files.

**2. Upload the file to GitHub.**

1. Go to https://github.com/zdonhauser/prs/tree/main/src/config/flyerTemplates
2. Click the green **"Add file"** button (top right, above the list of files), then choose
   **"Upload files"** from the dropdown.
3. Drag the `.json` file you just exported into the box, or click "choose your files" and pick it.
4. Scroll down to "Commit changes", make sure **"Commit directly to the `main` branch"** is
   selected, and click the green **"Commit changes"** button.

**3. Wait for the build, then check staging.** The upload kicks off an automatic rebuild, usually
a couple of minutes. Watch it at:

https://github.com/zdonhauser/prs/actions

Look for a "Deploy to GitHub Pages" run turn from a yellow dot (running) to a green check (done).
Once it's green, check the new template on the safe rehearsal copy of the site — nothing
coordinators use yet:

https://zdonhauser.github.io/prs/staging/event-flyer/

It should appear in the Template picker, grouped under its month.

**4. When it looks right, promote it to the real site.** Staging doesn't affect what coordinators
see until this step:

1. Go to https://github.com/zdonhauser/prs/actions/workflows/promote.yml
2. Click **"Run workflow"** (right side), leave the `ref` box set to `main`, and click the green
   **"Run workflow"** button.
3. Wait for it to finish on the same Actions page, then check
   https://zdonhauser.github.io/prs/event-flyer/ — the new template should be live.

**Preparing ahead.** Templates carry a month (e.g. "August 2026"), and the coordinator app groups
its picker by month, defaulting to whichever template matches the current month. There's no need
to wait for the month to arrive — a whole year of templates can be built and uploaded in advance;
each one just sits in the picker under its own month until a coordinator needs it.

**Updating an existing template.** Open the template creator, use "Load a bundled template" (or
"Import a Template File…" if you have the original JSON) to pull in the one you want to change,
edit it, and export again. As long as you don't rename it, the export keeps the same filename and
overwrites the old version when you upload it the same way. If you *do* rename it, the export gets
a new filename and a new ID — treated as a brand-new template rather than an edit of the old one.
That matters when you're preparing next year's version of a template rather than fixing this
year's: rename it, and it uploads alongside the original instead of replacing it.

## Develop

```bash
npm install
npm run dev      # local dev server — landing page at /, tools at /success-story/, /event-flyer/, /template-creator/
npm test         # run the test suite once
npm run lint     # eslint over src
npm run typecheck
npm run build    # production build to dist/, all four pages
```

## Deploy

Every push to `main` automatically deploys to staging only (`/staging/`). Production is a
separate branch, `prod`, that only moves when someone explicitly promotes it, so staging can be
pushed to and verified without any risk to what coordinators and the regional manager are using.

To promote a build to production, go to the Actions tab and run the "Promote to Production"
workflow (or `gh workflow run promote.yml`), optionally passing a `ref` input, a branch name or
commit SHA, to promote. The workflow force-moves `prod` to that ref and then explicitly dispatches
the Pages deploy itself — a push made with `GITHUB_TOKEN` doesn't trigger `on: push` workflows, so
nothing would otherwise notice `prod` moved. Passing an older SHA is also how you roll production
back: promote the last SHA that worked, then re-promote main once the fix lands.

**Gotcha:** the repo's `github-pages` deployment environment only allows branch `main` to deploy
(a GitHub repo setting, not anything in this repo's YAML). `deploy.yml` listens for pushes to both
`main` and `prod`, so a direct push to `prod` does start a workflow run — but it fails at the
`deploy` job with an environment-protection error. That's expected and harmless; it just means a
push to `prod` never actually updates the live site. Always promote through the workflow above.

## Architecture

The codebase is organized in layers, and the layer boundaries are the main thing to respect when
adding or changing code.

- **`src/entries`** has one small mount file per page — `successStory.tsx`, `eventFlyer.tsx`,
  `templateCreator.tsx` — each rendering that page's composition root into its own `#root` and
  importing the stylesheets that page needs.
- **`src/app`** holds the composition roots. It wires features and services together (`App`
  for the success-story builder, `FlyerApp` for the event-flyer builder, `CreatorApp` for the
  template creator, the shared `AppHeader`, and the hooks that connect form state to the preview —
  `useStoryForm`, `useFlyerForm`) and should not contain business logic of its own.
- **`src/features/<name>`** holds one folder per user-facing capability: `story-form`, `photos`,
  `ai-generate`, `preview`, `export`, `flyer-form`, `flyer-preview`, `template-creator`. A feature
  may import from `domain`, `config`, and `services`, but not from another feature, with a couple
  of established exceptions: `story-form/FormPanel` composes `photos` and `ai-generate` directly,
  since the form panel is where those pieces are surfaced to the user, and
  `template-creator/CreatorPanel` composes `story-form`'s `DateSelect` and `photos`' `PhotoCropModal`
  directly for the same reason. `CreatorApp` and `template-creator/photoPipeline.ts` also import
  `deliverFile` from `features/export/shared.ts` — a third instance of the same pattern. Outside of
  these documented exceptions, keep features independent of each other.
- **`src/domain`** is pure functions only, no React, no DOM, no browser APIs. This is where photo
  geometry math, date formatting, and the flyer template helpers (`domain/flyerTemplate.ts` —
  validation, defaults, month grouping/sorting, and slugifying a template name into its id) live,
  and everything here is unit-tested.
- **`src/config`** holds static template data: story themes, photo layout definitions, page
  dimensions, the AI prompt template, the curated flyer color palette (`config/prsPalette.ts`),
  and the committed flyer templates themselves — one JSON file per template in
  `config/flyerTemplates/`, loaded and validated at build time by `config/flyerTemplates.ts` via
  `import.meta.glob`. This directory is where a new flyer template lands; see "adding a flyer
  template" above. Data, not behavior.
- **`src/services`** is browser infrastructure: localStorage persistence (a generic
  versioned-envelope helper backs both the story form and the flyer form, each under its own
  storage key) and DOM text measurement. The messy platform-specific quirks live here, and in
  `features/export`, which has its own PDF/canvas concerns for both the story and flyer exports.
- **`src/styles`** is split by responsibility. `page.css` and `themes.css` define the printed
  success story itself and change whenever design intent changes; `flyer.css` plays the same role
  for the printed flyer, but its `--f-*` variables work differently from the story's `--t-*` ones.
  `--t-*` is a fixed enum: one `[data-theme="…"]` CSS block per story theme in `themes.css` (ten
  today).
  A flyer template's colors are arbitrary hex values a template author picks in the template
  creator, not a small fixed set, so there's no equivalent set of CSS blocks to write — instead
  `FlyerCanvas` sets each `--f-*` variable as an inline style straight from the template's own
  `colors` object (`flyer.css` keeps a fallback color block only as a safety net). The remaining
  stylesheets are app chrome (form layout, modals, responsive breakpoints) and can change
  independently of what gets printed.
- Tests are co-located next to the module they cover, as `*.test.ts` files, rather than living in
  a separate top-level test directory.

### Multi-page build, service worker, and manifest

The suite is one Vite build with four HTML entry points, declared in `vite.config.ts`'s
`build.rollupOptions.input`: the static landing page at the root, plus `success-story/`,
`event-flyer/`, and `template-creator/`. Each tool is a real directory so its URL works as a
direct link on GitHub Pages, no SPA fallback needed.

One service worker and one web-app manifest cover the whole suite, both hand-rolled rather than
left to `vite-plugin-pwa`'s usual auto-injection — the reasons are commented in `vite.config.ts`:

- `vite-plugin-pwa`'s manifest link and its `registerSW` script both point at paths relative to
  whatever page they're injected into, which is fine for a single-page app at the site root but
  404s for the nested tool pages (there's no `manifest.webmanifest` inside `/success-story/`; the
  file only exists once, at the site root). So the plugin's own manifest handling and register
  injection are disabled (`manifest: false`, `injectRegister: false`); a small custom Vite plugin
  (`emit-web-manifest`) emits the manifest once at the site root, and each page's `<head>` links it
  with a correct relative path and registers `sw.js` itself via a small inline script that derives
  the site root from `location.pathname`, so the same script works whether the page is served from
  the repo root or from `/staging/`.
- The manifest content also has to differ between the production and staging builds (`"PRS
  Tools"` vs `"PRS Tools (Staging)"`) so the two installs are distinguishable on a home screen —
  another reason to generate it in the build rather than serve one static file.
- Workbox's default navigation fallback would otherwise answer a `/staging/` navigation with
  production's cached `index.html` (same origin, same service-worker scope), silently serving the
  wrong build. `navigateFallbackDenylist: [/\/staging\//]` in the workbox config exists
  specifically to stop that.

## iOS / PWA quirks worth knowing

- Installed (home-screen, standalone) PWAs open `target="_blank"` links in an embedded in-app
  browser sheet rather than full Safari. That sheet doesn't share Safari's cookies, so a user who
  is logged into ChatGPT or Claude in Safari appears logged out inside the app. This is why the AI
  links in the success-story builder's AI-generate flow navigate in the same window instead of
  opening a new tab, since that gives the user the best available chance of landing in a real,
  cookie-sharing browser context.
- iOS Safari, including installed PWAs, ignores the anchor `download` attribute, so a plain link
  or `<a download>` just opens the PDF (or, in the template creator, the exported JSON) in a new
  tab and leaves the user to manually share it to Files. Export instead uses the Web Share API
  (`navigator.share` with a `File`) so the native share sheet opens directly, in one tap, with a
  normal filename — `features/export/shared.ts`'s `deliverPdf`/`deliverFile` are the two callers
  of this, used by the story and flyer PDF exports and by the template creator's JSON export.
- html2canvas does not reliably capture `object-fit: cover` or CSS transforms (the pan/zoom used
  for cropping photos) at the scale factor needed for print-quality output. Each photo cell is
  instead pre-rendered to an offscreen canvas with the crop, pan, and zoom baked into plain
  pixels. The template creator's own photo pipeline (`features/template-creator/photoPipeline.ts`)
  bakes a cropped template photo the same way, though it's a separate implementation tuned to its
  own size cap rather than shared code.
- The exported success-story PDF is layered, not one flat raster: the theme decoration is a
  background image (captured by html2canvas with text/photos hidden via `onclone`, so the live
  page never flickers), each photo is its own separately-selectable image object, the photo frame
  is a vector rect, and all text is real vector text in base-14 Helvetica — selectable, searchable,
  and editable in Acrobat/Illustrator. Text positions are measured from the live preview DOM at
  export time rather than re-implementing the CSS layout in jsPDF coordinates. The flyer export
  (`features/export/exportFlyerPdf.ts`) follows the same layered philosophy with one deliberate
  exception: the flyer's headline is raster, not vector. Its reference typeface is a heavy wide
  grotesque with no equivalent in jsPDF's built-in fonts (no black weight, no horizontal scaling),
  so `flyer.css` fakes it in the browser with Arial Black plus a CSS `scaleX()` squeeze — a trick
  that has no jsPDF equivalent. Everything else in the flyer (eyebrow, subtitle, description,
  detail-row labels and the coordinator's entered values, the footer label and its value) stays
  real vector text; only the headline is pixels.

## The old repo is frozen

Before this suite existed, the success-story builder was its own repo,
`zdonhauser/prs-success-story`, deployed at https://zdonhauser.github.io/prs-success-story/. That
repo and URL are frozen legacy: they keep serving the old single-app build exactly as before, so
anyone who already installed it to a home screen keeps a working app. All active development
happens in `zdonhauser/prs` (this repo), deployed at https://zdonhauser.github.io/prs/. Nothing
gets pushed to `prs-success-story` going forward — don't "helpfully" sync it, and don't point new
users at its URL.
