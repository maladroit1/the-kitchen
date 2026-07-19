# The Kitchen

A personal interactive recipe collection. Editorial cookbook aesthetic, live servings scaling, density-aware volume↔weight conversion, version history.

The site is **read-only**. Authoring lives in your Box `Recipes/` folder; the site is rebuilt from that folder on demand.

Live: https://the-kitchen-melby.netlify.app

## Stack

- **Vite** + **React 18** + **Tailwind CSS** (utility-only, no compiled stylesheet)
- **Lucide** icons
- **Google Fonts**: Fraunces (display), Inter Tight (body), JetBrains Mono (numerals)
- **Netlify** for hosting (deploys via direct upload from this repo)

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

```bash
npm run build       # production build into dist/
npm run preview     # serve the built bundle locally
npm run sync        # parse recipes-source/ → src/data/recipes.json
```

## Data flow

```
  ┌─────────────────────────┐
  │ Box: Recipes/*.docx     │   ← write recipes here (source of truth)
  │ Box: Recipes/*.jpg      │   ← optional photos
  └────────────┬────────────┘
               │  ↓ refresh-from-box (PRN, via Cowork Claude)
  ┌────────────┴────────────┐
  │ recipes-source/*.md     │   ← intermediate markdown (gitignored)
  │ recipes-source/*.jpg    │   ← intermediate photos
  │ recipes-source/_metadata.json
  └────────────┬────────────┘
               │  ↓ npm run sync
  ┌────────────┴────────────┐
  │ src/data/recipes.json   │   ← canonical data
  │ public/photos/*.jpg     │   ← photos served by Netlify
  └────────────┬────────────┘
               │  ↓ Netlify direct deploy
  ┌────────────┴────────────┐
  │ the-kitchen-melby       │
  │ .netlify.app            │
  └─────────────────────────┘
```

## Refreshing recipes from Box

Open Cowork with the Box MCP connected. Ask: "Refresh the kitchen recipes from Box." Claude will pull the latest `.docx` files and any photos, regenerate `recipes.json`, copy photos into `public/photos/`, and redeploy to Netlify.

## Recipe schema

```jsonc
{
  "id": "coffee-creme-brulee-v3",         // slug + version
  "family": "coffee-creme-brulee",        // groups versions of the same dish
  "title": "Coffee Crème Brûlée",
  "version": "v3",
  "author": "Kenneth",                    // who developed/owns this version
  "badge": "Sous Vide",                   // optional small label
  "icon": "☕",                            // emoji fallback when no photo
  "accent": "#7B4423",                    // hex; tints hero & metadata
  "photo": "/photos/coffee-creme-brulee-v3.jpg",  // optional; replaces emoji hero
  "description": "...",
  "baseServings": 6,
  "servingsLabel": "4 oz portions",
  "activeMinutes": 25,
  "totalMinutes": 330,
  "tags": ["dessert", "sous vide"],
  "ingredients": [
    { "id": "i1", "name": "...", "amount": 2, "unit": "cup",
      "section": "Custard" }              // optional grouping
  ],
  "steps": [
    { "id": "s1", "title": "Sear", "content": "...",
      "timerSeconds": 120 }              // optional countdown
  ],
  "notes": [
    { "title": "Why 176°F", "body": "..." }
  ]
}
```

Supported units: `cup`, `tbsp`, `tsp`, `ml`, `l`, `fl_oz`, `pint`, `quart`, `g`, `kg`, `oz`, `lb`, `pinch`, `dash`, `whole`. Anything else passes through unchanged but won't get unit-converted.

## Versioning model

Each version of a recipe is its own entry, with its own `id`. They share a `family` (slug) and a display-friendly `version` ("v1", "v2", "v3", "v1 · high-protein").

The site:
- Shows all versions as cards. Older versions render with a slightly dimmed border and a "newer version" tag in the metadata strip.
- Within the same family, versions sit next to each other in the list view.
- The detail page shows an "Other versions" chip cluster — clickable jump to any sibling.

When you create a new version (e.g. v3 of crème brûlée):
1. In Box, create a new `.docx` named distinctly (e.g. `coffee creme brulee v3.docx`).
2. Optional photo: drop `coffee-creme-brulee-v3.jpg` next to it.
3. Don't delete v2 — keep history.
4. Ask Claude in Cowork: "refresh the kitchen from Box, add v3 of coffee crème brûlée."

## Author conventions

`author` is a free-form string; it shows beneath the title on detail pages and in card metadata. Defaults to "Kenneth" for any recipe without one specified.

Some examples already in the data:
- `"author": "Kenneth"` — your own development
- `"author": "Chef John (Food Wishes)"` — direct attribution
- `"author": "Kenneth (adapted from @summer_food)"` — adaptation credit
- `"author": "Once Upon a Chef"` — recipe pulled from another source

To set author from Box, add a line near the top of the .docx:
```
Author: Kenneth (adapted from @summer_food)
```
The parser strips it from the recipe text and uses it for the field.

## Photo conventions

- Place a photo in your Box `Recipes/` folder named after the recipe id, e.g. `coffee-creme-brulee-v3.jpg`. Supported: `.jpg`, `.jpeg`, `.png`, `.webp`.
- The sync script auto-detects the photo, copies it into `public/photos/`, and sets the `photo` field on that recipe.
- If no photo is found, the emoji renders as a tinted hero.
- Recommended dimensions: 1600–2000px wide; the layout shows hero at 16:9 (detail) or 4:3 (cards).

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
├── recipes-source/             # (gitignored) intermediate markdown + photos
│   ├── _metadata.json
│   ├── <recipe-id>.md
│   └── <recipe-id>.jpg
├── public/
│   └── photos/                 # served at /photos/<id>.<ext>
└── src/
    ├── main.jsx                # React entry
    ├── App.jsx                 # All UI components (read-only)
    ├── index.css               # Tailwind directives
    └── data/
        └── recipes.json        # Canonical recipe data
```

## Features

- **Recipe list** with search across title, description, tags, ingredients, and authors
- **Detail view** with servings scaler that scales every ingredient live
- **Unit toggle** — Recipe / Grams / Volume; conversions use a built-in density table for ~70 ingredients
- **Step checkoff** — tap step number to mark complete (visual fade, session-only)
- **Notes** section per recipe
- **Version family chips** — jump between v1/v2/v3 of the same dish from the detail page
- **Sectioned ingredients** — recipes can group ingredients into named blocks (e.g. "Brine", "Steak Bites", "Alfredo Sauce")
- **Photos with emoji fallback** — drop a photo, it replaces the hero; otherwise emoji

## Aesthetic principles

- **Editorial cookbook** — warm cream paper, deep ink, burnt sienna accents
- **No rounded corners** — square edges throughout for editorial feel
- **Tabular numerals** in measurement displays so ingredients align vertically
- **Subtle SVG grain texture** for warmth (mix-blend-mode: multiply)
- **Per-recipe accent colors** so each recipe has visual identity

## Roadmap

- [ ] Cooking mode (full-screen step-by-step with live timer countdowns)
- [ ] Tag filtering on list view
- [ ] Per-cook journal entries (would require a backend)
- [ ] Shopping list export (grouped by aisle, scaled to portions)
- [ ] Inline diff view between versions of the same family
- [ ] PWA wrapper for installable mobile app

## License

Private. Personal use only.
