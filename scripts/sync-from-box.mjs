#!/usr/bin/env node
/**
 * sync-from-box.mjs
 *
 * Reads markdown-formatted recipe text files from `recipes-source/`, parses them
 * into the recipe schema, and writes `src/data/recipes.json`.
 *
 * Workflow:
 *   1. Pull recipes from your Box "Recipes" folder (manually or via Cowork Claude
 *      with the Box MCP). Save each as a .md file in recipes-source/, named after
 *      the recipe id (e.g. `gyros-salad-v1.md`).
 *   2. Add a per-recipe metadata entry in recipes-source/_metadata.json with
 *      icon, accent, baseServings, etc. (See _metadata.json for examples.)
 *   3. Run `node scripts/sync-from-box.mjs`.
 *   4. Commit the resulting recipes.json and push — Netlify will rebuild.
 *
 * The parser is intentionally lightweight; the goal is a deterministic conversion
 * from markdown structure into the JSON schema. It is NOT a full AI parser — if
 * the structure of a recipe deviates from the convention (numbered ingredients
 * after an "Ingredients" header, numbered steps after an "Instructions"/"Method"
 * header, etc.), hand-edit the resulting JSON.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_DIR = join(ROOT, 'recipes-source');
const OUT_FILE = join(ROOT, 'src/data/recipes.json');
const META_FILE = join(SOURCE_DIR, '_metadata.json');
const PHOTOS_DIR = join(ROOT, 'public/photos');
const PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const VOLUME_UNITS = ['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'ml', 'l', 'liter', 'liters', 'pint', 'quart', 'fl oz'];
const WEIGHT_UNITS = ['g', 'gram', 'grams', 'kg', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'];
const COUNT_UNITS = ['pinch', 'pinches', 'dash', 'dashes', 'whole'];
const ALL_UNITS = [...VOLUME_UNITS, ...WEIGHT_UNITS, ...COUNT_UNITS];

const UNIT_NORMALIZE = {
  cups: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', teaspoon: 'tsp', teaspoons: 'tsp',
  liter: 'l', liters: 'l', gram: 'g', grams: 'g', ounce: 'oz', ounces: 'oz',
  lbs: 'lb', pound: 'lb', pounds: 'lb', pinches: 'pinch', dashes: 'dash',
};

const FRACTION_MAP = { '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

function parseAmount(s) {
  s = s.trim();
  // unicode fractions
  for (const [k, v] of Object.entries(FRACTION_MAP)) {
    if (s === k) return v;
    // mixed number: "1½"
    const m = s.match(new RegExp(`^(\\d+)${k}$`));
    if (m) return parseInt(m[1]) + v;
  }
  // "1/2" or "1 1/2"
  const mm = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mm) return parseInt(mm[1]) + parseInt(mm[2]) / parseInt(mm[3]);
  const mf = s.match(/^(\d+)\/(\d+)$/);
  if (mf) return parseInt(mf[1]) / parseInt(mf[2]);
  // plain number
  const n = parseFloat(s);
  if (!Number.isNaN(n)) return n;
  return null;
}

/**
 * Parse a single ingredient line into {name, amount, unit}.
 * Examples:
 *   "1 lb ground beef" → {name: "ground beef", amount: 1, unit: "lb"}
 *   "½ cup yellow onion, diced" → {name: "yellow onion, diced", amount: 0.5, unit: "cup"}
 *   "Salt and pepper, to taste" → {name: "salt and pepper, to taste", amount: 1, unit: "pinch"}
 *   "3 chicken breasts" → {name: "chicken breasts", amount: 3, unit: "whole"}
 */
function parseIngredientLine(raw) {
  const line = raw.trim().replace(/^\d+\.\s*/, '');
  // Match leading amount + unit
  // amount = number / fraction / mixed number
  const amountRe = /^([\d./⅛¼⅓⅜½⅝⅔¾⅞]+(?:[–-][\d./⅛¼⅓⅜½⅝⅔¾⅞]+)?)\s*/;
  const amountMatch = line.match(amountRe);

  if (!amountMatch) {
    // No leading amount — treat as "to taste" / pinch
    return { name: line.toLowerCase().startsWith('salt') || line.toLowerCase().includes('to taste') ? line : line, amount: 1, unit: 'pinch' };
  }

  // Range like "1–2" or "1-2" → take lower bound; preserve full range in name
  let amountStr = amountMatch[1];
  if (/[–-]/.test(amountStr)) {
    amountStr = amountStr.split(/[–-]/)[0];
  }
  const amount = parseAmount(amountStr);
  if (amount === null) {
    return { name: line, amount: 1, unit: 'whole' };
  }

  let rest = line.slice(amountMatch[0].length).trim();

  // Try to extract a unit
  let unit = 'whole';
  for (const u of ALL_UNITS.sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`^${u}\\b\\.?\\s*`, 'i');
    if (pattern.test(rest)) {
      unit = UNIT_NORMALIZE[u.toLowerCase()] || u.toLowerCase();
      rest = rest.replace(pattern, '');
      break;
    }
  }

  return { name: rest.trim(), amount, unit };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function parseMarkdownRecipe(md, meta, photoPath) {
  const lines = md.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Pull an "Author: ..." line out of the first 5 non-empty lines if present
  let detectedAuthor = null;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const m = lines[i].match(/^author\s*[:—–-]\s*(.+)$/i);
    if (m) { detectedAuthor = m[1].trim(); lines.splice(i, 1); break; }
  }

  const result = {
    id: meta.id,
    family: meta.family || meta.id.replace(/-v\d+.*$/, ''),
    title: meta.title || lines[0],
    version: meta.version || 'v1',
    author: meta.author || detectedAuthor || 'Kenneth',
    icon: meta.icon || '🍽️',
    accent: meta.accent || '#7B4423',
    description: meta.description || '',
    badge: meta.badge,
    baseServings: meta.baseServings || 4,
    servingsLabel: meta.servingsLabel,
    activeMinutes: meta.activeMinutes || 0,
    totalMinutes: meta.totalMinutes || 0,
    tags: meta.tags || [],
    photo: photoPath || meta.photo,
    ingredients: [],
    steps: [],
    notes: meta.notes || [],
  };
  // Strip undefined fields
  for (const k of Object.keys(result)) if (result[k] === undefined) delete result[k];

  let mode = null; // 'ingredients' | 'steps' | 'notes' | null
  let currentSection = null;
  let stepCounter = 0;
  let ingCounter = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^ingredients\b/.test(lower)) { mode = 'ingredients'; currentSection = null; continue; }
    if (/^(instructions|method|directions|steps)\b/.test(lower)) { mode = 'steps'; currentSection = null; continue; }
    if (/^notes\b/.test(lower)) { mode = 'notes'; currentSection = null; continue; }

    // Subgroup heading detection (e.g. "For the Chicken:", "Brine", "Steak Bites")
    const isHeading = !line.match(/^\d+\./) && !line.match(/^[\d./⅛¼⅓⅜½⅝⅔¾⅞]/) && line.length < 60 && (line.endsWith(':') || /^[A-Z]/.test(line));

    if (mode === 'ingredients') {
      if (isHeading) {
        currentSection = line.replace(/:$/, '').replace(/^For the\s+/i, '');
        continue;
      }
      const parsed = parseIngredientLine(line);
      ingCounter++;
      const ing = { id: `i${ingCounter}`, ...parsed };
      if (currentSection) ing.section = currentSection;
      result.ingredients.push(ing);
    } else if (mode === 'steps') {
      if (isHeading && !/^\d+\./.test(line)) {
        currentSection = line.replace(/:$/, '');
        continue;
      }
      const stripped = line.replace(/^\d+\.\s*/, '');
      stepCounter++;
      // Heuristic: if first sentence is short, use as title
      const sentenceMatch = stripped.match(/^([^.]{3,40}?[.:])\s+(.+)/);
      let title, content;
      if (sentenceMatch) {
        title = sentenceMatch[1].replace(/[.:]$/, '');
        content = sentenceMatch[2];
      } else {
        title = `Step ${stepCounter}`;
        content = stripped;
      }
      result.steps.push({ id: `s${stepCounter}`, title, content });
    } else if (mode === 'notes') {
      // Each line becomes a note with auto-derived title
      const stripped = line.replace(/^\d+\.\s*/, '');
      const colonIdx = stripped.indexOf(':');
      let title, body;
      if (colonIdx > 3 && colonIdx < 40) {
        title = stripped.slice(0, colonIdx);
        body = stripped.slice(colonIdx + 1).trim();
      } else {
        title = 'Note';
        body = stripped;
      }
      result.notes.push({ title, body });
    }
  }

  if (result.notes.length === 0) delete result.notes;
  return result;
}

function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`No source directory at ${SOURCE_DIR}.`);
    console.error('Create recipes-source/ and add one .md per recipe + a _metadata.json.');
    process.exit(1);
  }

  const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : {};
  const files = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.error('No .md files in recipes-source/. Nothing to sync.');
    process.exit(1);
  }

  // Ensure photos directory exists
  if (!existsSync(PHOTOS_DIR)) mkdirSync(PHOTOS_DIR, { recursive: true });

  const recipes = [];
  for (const f of files.sort()) {
    const id = basename(f, '.md');
    const recipeMeta = { id, ...(meta[id] || {}) };
    const md = readFileSync(join(SOURCE_DIR, f), 'utf8');

    // Look for a sibling photo file
    let photoPath = null;
    for (const ext of PHOTO_EXTS) {
      const candidate = join(SOURCE_DIR, id + ext);
      if (existsSync(candidate)) {
        const dest = join(PHOTOS_DIR, id + ext);
        copyFileSync(candidate, dest);
        photoPath = `/photos/${id}${ext}`;
        break;
      }
    }

    try {
      const recipe = parseMarkdownRecipe(md, recipeMeta, photoPath);
      recipes.push(recipe);
      console.log(`✓ ${id} — ${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps${photoPath ? ' · 📷' : ''}`);
    } catch (e) {
      console.error(`✗ ${id}: ${e.message}`);
    }
  }

  const output = {
    schemaVersion: 'v1',
    dataVersion: new Date().toISOString().slice(0, 10),
    source: 'Box folder: Recipes',
    recipes,
  };
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${recipes.length} recipes → ${OUT_FILE}`);
}

main();
