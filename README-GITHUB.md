# The Kitchen — GitHub copy

Melby family recipe site (React + Vite). Read-only display; recipes live in
`src/data/recipes.json` (source of truth authored in Ken's Second Brain vault,
`Recipes/*.md`).

## Hosting — two lanes during migration

| Lane | URL | Deploys |
|---|---|---|
| Netlify (primary, legacy) | https://the-kitchen-melby.netlify.app | direct-deploy from local build (`DEPLOY.md`) |
| GitHub Pages (standby → future primary) | https://maladroit1.github.io/the-kitchen/ | automatic — push to `main`, Actions builds with `--base=/the-kitchen/` |

Photo paths in the data are root-absolute; `assetUrl()` in `src/App.jsx`
prefixes `import.meta.env.BASE_URL` so both lanes serve them correctly.

## Cutover plan (when ready to cancel Netlify)

1. Optionally point `kitchen.threemelbys.com` (Cloudflare) at GitHub Pages
   (CNAME → `maladroit1.github.io`, plus custom-domain setting on this repo) —
   then the site serves at a root path and gets the family domain.
2. Update the `online:` links in the vault (`Recipes/`) to the new URL.
3. Netlify team has SEVEN sites — audit the other six before canceling the
   plan (list in the vault: Daily 2026-07-19).

## Local dev

```bash
npm install
npm run dev        # local
npm run build      # root-path build (Netlify)
npm run build -- --base=/the-kitchen/   # Pages build
```
