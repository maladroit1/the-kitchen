# Deploy: GitHub + Netlify

One-time setup to get The Kitchen on the public internet.

## 1. Create the GitHub repo

Two ways:

### Option A — github.com (browser)

1. Go to <https://github.com/new>
2. **Repository name**: `the-kitchen` (or whatever you want)
3. **Visibility**: Private (recommended — it's a personal recipe collection)
4. Do **not** initialize with README, .gitignore, or license — we already have those
5. Click "Create repository"
6. Copy the SSH or HTTPS URL it shows (something like `git@github.com:yourname/the-kitchen.git`)

### Option B — `gh` CLI (if installed)

```bash
cd ~/Documents/Claude/Projects/recipe\ website/recipe-book
gh repo create the-kitchen --private --source=. --remote=origin
```

This creates the repo and links it as `origin` in one shot. Skip step 2 if you do this.

## 2. First push from your Mac

Open Terminal and run:

```bash
cd ~/Documents/Claude/Projects/recipe\ website/recipe-book
git init
git add .
git commit -m "Initial: The Kitchen v0.1"
git branch -M main
git remote add origin <YOUR_REPO_URL_FROM_STEP_1>
git push -u origin main
```

If `git remote add` complains because origin already exists (e.g. you used the
`gh` CLI), skip that line — `git push` alone is enough.

## 3. Connect Netlify

1. Go to <https://app.netlify.com/start>
2. Pick **Import from Git**
3. Authorize Netlify to access GitHub if you haven't already
4. Pick the repo you just created
5. Netlify will detect the build settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **Deploy**. First build takes ~1–2 minutes.

Netlify will give you a random URL like `silly-pancake-12345.netlify.app`. You
can rename it under **Site settings → Domain management → Site name**, e.g. to
`the-kitchen-melby.netlify.app`.

### Custom domain (optional)

Under **Domain management → Add custom domain**, point a domain you own at
Netlify. They'll walk you through DNS records.

## 4. Updating the site

Any push to `main` triggers a Netlify rebuild. The typical update loop:

```bash
# Local dev
npm run dev

# When happy
git add .
git commit -m "describe what changed"
git push
```

Netlify deploys within a minute or two. You can watch it in the Netlify dashboard.

## 5. Refreshing recipes from Box

Two paths:

### A. PRN via Cowork (current setup)

Open Cowork. Make sure the Box MCP is connected. Ask: "Refresh the kitchen
recipes from Box." Claude will:

1. Pull all `.docx` files from your Box `Recipes/` folder
2. Regenerate `src/data/recipes.json`
3. Show you a diff
4. Commit + push (with your approval)

Netlify rebuilds within ~1 min. Done.

### B. Self-service

```bash
# Save each .docx as a markdown file in recipes-source/
# (one per recipe, named after the id e.g. gyros-salad-v1.md)
# Add per-recipe metadata in recipes-source/_metadata.json

npm run sync          # parses recipes-source/ → src/data/recipes.json
git add src/data/recipes.json
git commit -m "Sync recipes from Box (YYYY-MM-DD)"
git push
```

## Troubleshooting

**"Build failed on Netlify with `npm install` errors"** — Netlify uses Node 18 by
default. If you need a different version, add `.nvmrc` or set
`NODE_VERSION` in `netlify.toml`.

**"Recipes look out of date after refresh"** — Hard-reload (Cmd+Shift+R) to
bypass the browser cache. If you've made local edits in the app, the
"reset to canonical" button on the home screen wipes them.

**"My local edits disappeared after a sync"** — Local edits live in
`localStorage` per browser. They survive recipe syncs (overrides apply on top
of canonical data). If a recipe was *edited locally* and the canonical version
also changed, you'll see the local override; click the reset arrow on the
recipe detail page to drop it and pick up the new canonical version.
