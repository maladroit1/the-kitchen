# The Kitchen

A personal interactive recipe collection. Editorial cookbook aesthetic, live servings scaling, density-aware volume↔weight conversion.

Source of truth: a `Recipes/` folder of `.docx` files in Box. The site is rebuilt from that folder on demand.

## Stack

- **Vite** + **React 18** + **Tailwind CSS** (utility-only, no compiled stylesheet)
- **Lucide** icons
- **Google Fonts**: Fraunces (display), Inter Tight (body), JetBrains Mono (numerals)
- **Netlify** for hosting (auto-deploy on push to `main`)

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

```bash
npm run build       # production build into dist/
npm run preview     # serve the built bundle locally
```

## Data flow

```
  ┌─────────────────────────┐
  │ Box: Recipes/*.docx     │   ← write recipes here (source of truth)
  └────────────┬────────────┘
               │  ↓ refresh-from-box (PRN, via Cowork Claude)
  ┌────────────┴────────────┐
  │ recipes-source/*.md     │   ← intermediate markdown (gitignored by default)
  │ recipes-source/_metadata.json
  └────────────┬────────────┘
               │  ↓ npm run sync
  ┌────────────┴────────────┐
  │ src/data/recipes.json   │   ← committed; bundled at build time
  └────────────┬────────────┘
               │  ↓ git push origin main
  ┌────────────┴────────────┐
  │ Netlify build + deploy  │
  └─────────────────────────┘
```

The React app `import`s `recipes.json` directly — no runtime fetch, no backend.
Local edits in the deployed app are kept in `localStorage` as overrides; they
never touch the canonical data.

## Refreshing recipes from Box

Two paths:

**(a) PRN via Cowork (current model).** Open Cowork with the Box MCP connected
and ask: "Refresh the kitchen recipes from Box." Claude will pull the latest
`.docx` files, regenerate `src/data/recipes.json`, and prepare the commit.

**(b) Self-service.** Save each recipe as `recipes-source/<id>.md` (markdown
extracted from the .docx) and run `npm run sync`. Add per-recipe metadata
(icon, accent color, baseServings, badge, tags) in
`recipes-source/_metadata.json` keyed by id.

## Project structure

```
recipe-book/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── netlify.toml
├── scripts/
│   └── sync-from-box.mjs       # markdown → recipes.json parser
├── recipes-source/             # (gitignored) intermediate markdown
│   ├── _metadata.json
│   └── <recipe-id>.md
└── src/
    ├── main.jsx                # React entry
    ├── App.jsx                 # All UI components
    ├── index.css               # Tailwind directives
    └── data/
        └── recipes.json        # Canonical recipe data (committed)
```

## Recipe schema

```jsonc
{
  "id": "gyros-salad-v1",                 // slug + version
  "title": "Homemade Gyros Salad",
  "version": "v1",
  "badge": "Greek",                       // optional small label
  "icon": "🥗",
  "accent": "#7A4B2E",                    // hex; tints hero & metadata
  "description": "...",
  "baseServings": 4,
  "servingsLabel": "bowls",               // optional; renders below servings number
  "activeMinutes": 35,
  "totalMinutes": 70,
  "tags": ["greek", "salad"],
  "ingredients": [
    { "id": "i1", "name": "...", "amount": 1, "unit": "lb",
      "section": "The Meat" }            // optional grouping
  ],
  "steps": [
    { "id": "s1", "title": "Sear", "content": "...",
      "timerSeconds": 120 }              // optional countdown
  ],
  "notes": [
    { "title": "Texture key", "body": "..." }
  ]
}
```

Supported units: `cup`, `tbsp`, `tsp`, `ml`, `l`, `fl_oz`, `pint`, `quart`,
`g`, `kg`, `oz`, `lb`, `pinch`, `dash`, `whole`. Anything else passes through
unchanged but won't get unit-converted.

## Features

- **Recipe list** with search across title, description, tags, and ingredients
- **Detail view** with servings scaler that scales every ingredient live
- **Unit toggle** — Recipe / Grams / Volume; conversions use a built-in density
  table for ~70 common ingredients
- **Step checkoff** — tap step number to mark complete (visual fade)
- **Notes** section per recipe
- **Local edit / add / hide** — saved per-browser only; canonical data stays
  intact. A "reset to canonical" button discards local changes.
- **Sectioned ingredients** — recipes can group ingredients into named blocks
  (e.g. "Brine", "Steak Bites", "Alfredo Sauce")

## Aesthetic principles

- **Editorial cookbook** — warm cream paper, deep ink, burnt sienna accents
- **No rounded corners** — square edges throughout for editorial feel
- **Tabular numerals** in measurement displays so ingredients align vertically
- **Subtle SVG grain texture** for warmth (mix-blend-mode: multiply)
- **Per-recipe accent colors** so each recipe has visual identity

## Roadmap

### v0.x — polish
- [ ] Photo upload (replace emoji placeholders)
- [ ] Cooking mode (full-screen step-by-step with live timer countdowns)
- [ ] Tag filtering on list view
- [ ] Per-cook journal entries
- [ ] Shopping list export (grouped by aisle, scaled to portions)

### v1 — multi-device sync
- [ ] Move from localStorage overrides to a real backend (Supabase / Netlify Blobs)
- [ ] Auth (Auth.js or Clerk)
- [ ] PWA wrapper for installable mobile app
- [ ] Multi-user (family access)

## License

Private. Personal use only.
