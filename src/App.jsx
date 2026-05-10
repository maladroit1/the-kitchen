import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, ArrowLeft, Minus, Edit3, Clock, Users, ChevronRight, Trash2, X, Save, AlertCircle, RefreshCcw, RotateCcw } from 'lucide-react';
import recipesData from './data/recipes.json';

/* ============================================================
   UNIT CONVERSION
   ============================================================ */

// Volume unit → milliliters
const VOLUME_TO_ML = {
  cup: 240, tbsp: 15, tsp: 5, ml: 1, l: 1000, fl_oz: 30, pint: 480, quart: 960,
};

// Weight unit → grams
const WEIGHT_TO_G = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
};

const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_ML));
const WEIGHT_UNITS = new Set(Object.keys(WEIGHT_TO_G));

// Grams per cup (240 ml) — for volume↔weight conversion
const DENSITY_G_PER_CUP = {
  'heavy cream': 240, 'cream': 240, 'whipping cream': 238, 'half and half': 242,
  'milk': 244, 'whole milk': 244, 'skim milk': 245, 'fairlife': 244,
  'water': 240, 'stock': 240, 'beef stock': 240, 'chicken stock': 240, 'broth': 240, 'chicken broth': 240,
  'butter': 227, 'olive oil': 218, 'oil': 218, 'vegetable oil': 218, 'canola oil': 218, 'sesame oil': 217,
  'granulated sugar': 200, 'sugar': 200, 'turbinado': 195, 'turbinado sugar': 195,
  'brown sugar': 213, 'powdered sugar': 120, 'honey': 340, 'maple syrup': 322,
  'flour': 125, 'all-purpose flour': 125, 'breadcrumbs': 108, 'panko': 60,
  'cornstarch': 128, 'tapioca starch': 120, 'cornflakes': 28,
  'cottage cheese': 226, 'sour cream': 230, 'yogurt': 245, 'greek yogurt': 245,
  'mayo': 220, 'mayonnaise': 220, 'light mayo': 215, 'light mayonnaise': 215,
  'cream cheese': 232,
  'ground beef': 225, 'beef': 225, 'chicken': 220, 'cross rib': 225, 'ground lamb': 225,
  'rice': 185, 'cooked rice': 195, 'pasta': 100, 'gnocchi': 200,
  'coffee beans': 100, 'instant coffee': 60,
  'kosher salt': 145, 'salt': 290, 'fine salt': 290,
  'parmesan': 100, 'cheese': 113, 'shredded cheese': 113, 'three cheese blend': 113, 'mozzarella': 113, 'feta': 150,
  'onion': 160, 'diced onion': 160, 'tomato': 180, 'sun-dried tomatoes': 110,
  'lime juice': 240, 'lemon juice': 240, 'orange juice': 240, 'citrus juice': 240,
  'soy sauce': 255, 'tamari': 255, 'vinegar': 240, 'white vinegar': 240, 'rice vinegar': 240, 'red wine vinegar': 240, 'apple cider vinegar': 240,
  'mirin': 230, 'sake': 230, 'cilantro': 16, 'parsley': 16, 'rosemary': 25, 'basil': 24, 'thyme': 24, 'dill': 16,
  'celery': 100, 'jalapeño': 90, 'jalapeno': 90, 'garlic': 136, 'pickle': 155,
  'carrots': 128, 'spinach': 30, 'cabbage': 89, 'mushrooms': 70,
  'chili crisp': 220, 'chili crunch': 220,
  'sweetened condensed milk': 306, 'coconut': 80, 'flaked coconut': 80,
};

function lookupDensity(name) {
  const n = (name || '').toLowerCase();
  if (DENSITY_G_PER_CUP[n]) return DENSITY_G_PER_CUP[n];
  let best = null;
  let bestLen = 0;
  for (const key of Object.keys(DENSITY_G_PER_CUP)) {
    if (n.includes(key) && key.length > bestLen) {
      best = DENSITY_G_PER_CUP[key];
      bestLen = key.length;
    }
  }
  return best;
}

function isCountUnit(unit) {
  return !unit || unit === 'pinch' || unit === 'dash' || unit === 'whole';
}

function toGrams(amount, unit, name) {
  if (WEIGHT_UNITS.has(unit)) return amount * WEIGHT_TO_G[unit];
  if (VOLUME_UNITS.has(unit)) {
    const cups = (amount * VOLUME_TO_ML[unit]) / 240;
    const density = lookupDensity(name);
    if (!density) return null;
    return cups * density;
  }
  return null;
}

function toVolume(amount, unit, name) {
  let grams;
  if (WEIGHT_UNITS.has(unit)) grams = amount * WEIGHT_TO_G[unit];
  else if (VOLUME_UNITS.has(unit)) {
    return pickVolumeUnit(amount * VOLUME_TO_ML[unit]);
  } else return null;

  const density = lookupDensity(name);
  if (!density) return null;
  const cups = grams / density;
  const ml = cups * 240;
  return pickVolumeUnit(ml);
}

function pickVolumeUnit(ml) {
  if (ml >= 240) return { amount: ml / 240, unit: 'cup' };
  if (ml >= 15) return { amount: ml / 15, unit: 'tbsp' };
  return { amount: ml / 5, unit: 'tsp' };
}

/* ============================================================
   FORMATTING
   ============================================================ */

const FRACTIONS = [
  [0, ''], [1/8, '⅛'], [1/4, '¼'], [1/3, '⅓'], [3/8, '⅜'],
  [1/2, '½'], [5/8, '⅝'], [2/3, '⅔'], [3/4, '¾'], [7/8, '⅞'], [1, ''],
];

function formatFraction(num) {
  if (num === 0) return '0';
  if (num < 0.05) return num.toFixed(2).replace(/\.?0+$/, '');
  const whole = Math.floor(num);
  const frac = num - whole;
  let best = '';
  let bestDist = Infinity;
  let bestVal = 0;
  for (const [val, str] of FRACTIONS) {
    const d = Math.abs(val - frac);
    if (d < bestDist) { bestDist = d; best = str; bestVal = val; }
  }
  if (bestDist > 0.04) {
    const v = parseFloat(num.toFixed(2));
    return v.toString();
  }
  if (bestVal === 1) return (whole + 1).toString();
  if (whole === 0) return best || '0';
  if (!best) return whole.toString();
  return `${whole}${best}`;
}

function formatGrams(g) {
  if (g < 1) return `${g.toFixed(1)} g`;
  if (g < 10) return `${g.toFixed(1)} g`;
  if (g < 100) return `${Math.round(g)} g`;
  return `${Math.round(g / 5) * 5} g`;
}

function unitLabel(unit) {
  const labels = { cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', ml: 'ml', l: 'l', fl_oz: 'fl oz',
    g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', pinch: 'pinch', dash: 'dash', whole: '' };
  return labels[unit] || unit || '';
}

function pluralizeUnit(unit, amount) {
  if (amount === 1 || amount === 0) return unitLabel(unit);
  if (unit === 'pinch') return 'pinches';
  if (unit === 'dash') return 'dashes';
  return unitLabel(unit);
}

function formatTime(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

/* ============================================================
   STORAGE
   ----------
   Source of truth: src/data/recipes.json (refreshed from Box).
   localStorage tracks per-user customizations only:
     - overrides: { [recipeId]: recipeObject }   (edited canonical recipes)
     - additions: recipeObject[]                 (recipes the user added)
     - deletions: recipeId[]                     (canonical recipes the user hid)
   ============================================================ */

const KEYS = {
  overrides: 'recipes:overrides-v1',
  additions: 'recipes:additions-v1',
  deletions: 'recipes:deletions-v1',
};

function loadStored() {
  const safe = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch { return fallback; }
  };
  return {
    overrides: safe(KEYS.overrides, {}),
    additions: safe(KEYS.additions, []),
    deletions: safe(KEYS.deletions, []),
  };
}

function saveStored(stored) {
  try {
    localStorage.setItem(KEYS.overrides, JSON.stringify(stored.overrides));
    localStorage.setItem(KEYS.additions, JSON.stringify(stored.additions));
    localStorage.setItem(KEYS.deletions, JSON.stringify(stored.deletions));
    return true;
  } catch { return false; }
}

function effectiveRecipes(canonical, stored) {
  const surviving = canonical
    .filter(r => !stored.deletions.includes(r.id))
    .map(r => stored.overrides[r.id] ? { ...stored.overrides[r.id], _edited: true } : r);
  const additions = stored.additions.map(r => ({ ...r, _userAdded: true }));
  return [...surviving, ...additions];
}

/* ============================================================
   APP
   ============================================================ */

export default function RecipeApp() {
  const canonical = recipesData.recipes;
  const dataVersion = recipesData.dataVersion;

  const [stored, setStored] = useState(() => loadStored());
  const [view, setView] = useState({ type: 'list' });
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const recipes = useMemo(() => effectiveRecipes(canonical, stored), [canonical, stored]);

  const persist = (next) => {
    setStored(next);
    setSaveStatus('saving');
    const ok = saveStored(next);
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus(null), 1800);
  };

  const handleSave = (recipe) => {
    const isCanonical = canonical.some(r => r.id === recipe.id);
    const isAddition = stored.additions.some(r => r.id === recipe.id);
    const next = { ...stored };
    if (isCanonical) {
      next.overrides = { ...stored.overrides, [recipe.id]: recipe };
    } else if (isAddition) {
      next.additions = stored.additions.map(r => r.id === recipe.id ? recipe : r);
    } else {
      next.additions = [...stored.additions, recipe];
    }
    persist(next);
    setView({ type: 'detail', id: recipe.id });
  };

  const handleDelete = (id) => {
    const next = { ...stored };
    if (canonical.some(r => r.id === id)) {
      next.deletions = [...stored.deletions, id];
      // Drop any override for that id since it's now hidden
      const { [id]: _, ...rest } = stored.overrides;
      next.overrides = rest;
    } else {
      next.additions = stored.additions.filter(r => r.id !== id);
    }
    persist(next);
    setView({ type: 'list' });
  };

  const handleResetRecipe = (id) => {
    if (!stored.overrides[id]) return;
    const { [id]: _, ...rest } = stored.overrides;
    persist({ ...stored, overrides: rest });
  };

  const handleResetAll = () => {
    persist({ overrides: {}, additions: [], deletions: [] });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Inter Tight', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .paper-bg {
          background-color: #F5EFE3;
          background-image:
            radial-gradient(at 12% 22%, rgba(200, 85, 61, 0.04) 0px, transparent 50%),
            radial-gradient(at 88% 78%, rgba(123, 68, 35, 0.04) 0px, transparent 50%);
        }
        .grain { position: relative; }
        .grain::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.18 0 0 0 0 0.13 0 0 0 0 0.07 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.04;
          mix-blend-mode: multiply;
        }

        .recipe-num { font-feature-settings: 'tnum' 1, 'lnum' 1; }
        .scaler-pill { background: linear-gradient(180deg, #FAF6EE 0%, #F0E9D8 100%); }

        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fade-in 0.3s ease-out; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slide-up 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
      `}</style>

      <div className="min-h-screen paper-bg font-body text-stone-900 grain">
        {view.type === 'list' ? (
          <ListView
            recipes={recipes}
            search={search}
            setSearch={setSearch}
            onSelect={(id) => setView({ type: 'detail', id })}
            onAdd={() => setView({ type: 'edit', id: null })}
            saveStatus={saveStatus}
            dataVersion={dataVersion}
            onResetAll={handleResetAll}
            hasLocalChanges={Object.keys(stored.overrides).length > 0 || stored.additions.length > 0 || stored.deletions.length > 0}
          />
        ) : view.type === 'detail' ? (
          <DetailView
            recipe={recipes.find(r => r.id === view.id)}
            onBack={() => setView({ type: 'list' })}
            onEdit={() => setView({ type: 'edit', id: view.id })}
            onDelete={handleDelete}
            onResetOverride={() => handleResetRecipe(view.id)}
          />
        ) : view.type === 'edit' ? (
          <EditView
            recipe={view.id ? recipes.find(r => r.id === view.id) : null}
            onSave={handleSave}
            onCancel={() => setView(view.id ? { type: 'detail', id: view.id } : { type: 'list' })}
          />
        ) : null}
      </div>
    </>
  );
}

/* ============================================================
   LIST VIEW
   ============================================================ */

function ListView({ recipes, search, setSearch, onSelect, onAdd, saveStatus, dataVersion, onResetAll, hasLocalChanges }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const filtered = useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q)) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(q))
    );
  }, [recipes, search]);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 sm:px-8 sm:py-12">
      {/* Masthead */}
      <header className="mb-10 sm:mb-14">
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500">
            № {String(recipes.length).padStart(3, '0')} · refreshed {dataVersion}
          </div>
          {saveStatus && (
            <div className="font-mono text-[10px] tracking-widest uppercase text-stone-500 fade-in">
              {saveStatus === 'saving' ? 'saving…' : saveStatus === 'saved' ? '✓ saved' : '⚠ save failed'}
            </div>
          )}
        </div>
        <h1 className="font-display text-6xl sm:text-7xl font-light tracking-tight leading-none text-stone-900">
          The Kitchen
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-300"></div>
          <div className="font-display italic text-stone-600 text-lg">a personal collection</div>
          <div className="h-px flex-1 bg-stone-300"></div>
        </div>
      </header>

      {/* Controls */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes, tags, ingredients…"
            className="w-full pl-11 pr-4 py-3 bg-stone-50/60 border border-stone-300 rounded-none font-body text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
          />
        </div>
        <button
          onClick={onAdd}
          className="px-5 py-3 bg-stone-900 text-stone-50 font-body font-medium text-sm tracking-wide hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Recipe
        </button>
      </div>

      {/* Local-changes indicator */}
      {hasLocalChanges && (
        <div className="mb-6 px-4 py-3 border border-stone-300 bg-stone-50/50 flex items-center justify-between fade-in">
          <div className="font-mono text-[10px] tracking-widest uppercase text-stone-600">
            you have local edits — they live in this browser only
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="font-mono text-[10px] tracking-widest uppercase text-stone-700 hover:text-stone-900 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" /> reset to canonical
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="font-display italic text-stone-500 text-xl">nothing matches that.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => onSelect(r.id)} delay={i * 30} />
          ))}
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-5 fade-in">
          <div className="bg-stone-50 border border-stone-900 max-w-sm w-full p-6">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-xl font-medium mb-1">Reset to canonical?</h3>
                <p className="text-sm text-stone-600">All local edits, additions, and deletions will be discarded. The recipe set returns to whatever was last synced from Box.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-sm hover:bg-stone-100">
                Cancel
              </button>
              <button
                onClick={() => { onResetAll(); setShowResetConfirm(false); }}
                className="px-4 py-2 text-sm bg-stone-900 text-stone-50 hover:bg-stone-800"
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onClick, delay = 0 }) {
  const accent = recipe.accent || '#7B4423';
  return (
    <button
      onClick={onClick}
      className="group text-left bg-stone-50/40 hover:bg-stone-50 border border-stone-300 hover:border-stone-900 transition-all duration-200 fade-in flex flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="aspect-[4/3] flex items-center justify-center text-7xl sm:text-8xl border-b border-stone-300 transition-transform group-hover:scale-[1.02]"
        style={{ background: `linear-gradient(135deg, ${accent}15 0%, ${accent}05 100%)` }}
      >
        <span style={{ filter: 'saturate(0.85)' }}>{recipe.icon || '🍽️'}</span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="font-display text-2xl font-medium leading-tight text-stone-900">
            {recipe.title}
          </h3>
          <span className="font-mono text-[10px] tracking-widest uppercase shrink-0 mt-1" style={{ color: accent }}>
            {recipe.version}
          </span>
        </div>
        {(recipe.badge || recipe._edited || recipe._userAdded) && (
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-3 flex items-center gap-2">
            {recipe.badge && <span>{recipe.badge}</span>}
            {recipe._edited && <span className="text-amber-700">· edited</span>}
            {recipe._userAdded && <span className="text-emerald-700">· added by you</span>}
          </div>
        )}
        <p className="text-sm text-stone-600 leading-relaxed mb-4 line-clamp-3">
          {recipe.description}
        </p>
        <div className="mt-auto flex items-center justify-between text-xs text-stone-500 font-mono pt-3 border-t border-stone-200">
          <span className="flex items-center gap-1.5"><Users className="w-3 h-3" />{recipe.baseServings}</span>
          {recipe.totalMinutes ? (
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{formatTime(recipe.totalMinutes * 60)}</span>
          ) : <span />}
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

/* ============================================================
   DETAIL VIEW
   ============================================================ */

function DetailView({ recipe, onBack, onEdit, onDelete, onResetOverride }) {
  const [servings, setServings] = useState(recipe?.baseServings || 1);
  const [unitSystem, setUnitSystem] = useState('original');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!recipe) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-20 text-center">
        <div className="font-display italic text-stone-500 text-xl">that recipe is gone.</div>
        <button onClick={onBack} className="mt-4 font-mono text-[11px] tracking-[0.2em] uppercase text-stone-700 hover:text-stone-900">← back to the kitchen</button>
      </div>
    );
  }
  const scale = servings / recipe.baseServings;
  const accent = recipe.accent || '#7B4423';

  // Group ingredients by section, preserving order
  const sectionedIngredients = useMemo(() => {
    const groups = [];
    let current = null;
    for (const ing of recipe.ingredients || []) {
      const sec = ing.section || null;
      if (!current || current.section !== sec) {
        current = { section: sec, items: [] };
        groups.push(current);
      }
      current.items.push(ing);
    }
    return groups;
  }, [recipe]);

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 sm:px-8 sm:py-10 slide-up">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">The Kitchen</span>
        </button>
        <div className="flex items-center gap-2">
          {recipe._edited && (
            <button onClick={onResetOverride} className="p-2 text-amber-700 hover:text-amber-900 transition-colors" aria-label="Reset to canonical" title="Reset to canonical">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEdit} className="p-2 text-stone-600 hover:text-stone-900 transition-colors" aria-label="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-2 text-stone-600 hover:text-red-700 transition-colors" aria-label="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="aspect-[16/9] sm:aspect-[21/9] flex items-center justify-center text-8xl sm:text-9xl border border-stone-300 mb-8"
        style={{ background: `linear-gradient(135deg, ${accent}20 0%, ${accent}08 100%)` }}
      >
        <span style={{ filter: 'saturate(0.85)' }}>{recipe.icon || '🍽️'}</span>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2 gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: accent }}>
            {recipe.badge || recipe.tags?.[0] || ''}
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500">
            {recipe.version}{recipe._edited ? ' · edited locally' : ''}
          </span>
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-light leading-[0.95] tracking-tight mb-4 text-stone-900">
          {recipe.title}
        </h1>
        <p className="font-display italic text-lg sm:text-xl text-stone-700 leading-relaxed max-w-2xl">
          {recipe.description}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-3 mb-10 border-y border-stone-300 py-5">
        <MetaCell label="Yield" value={`${servings}`} sub={recipe.servingsLabel || 'servings'} accent={accent} />
        <MetaCell label="Active" value={formatTime((recipe.activeMinutes || 0) * 60) || '—'} sub="" accent={accent} />
        <MetaCell label="Total" value={formatTime((recipe.totalMinutes || 0) * 60) || '—'} sub="" accent={accent} />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500">Adjust portions</h3>
          {scale !== 1 && (
            <span className="font-mono text-[10px] text-stone-500">×{scale.toFixed(2).replace(/\.?0+$/, '')}</span>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          <button
            onClick={() => setServings(Math.max(1, servings - 1))}
            disabled={servings <= 1}
            className="px-4 scaler-pill border border-stone-300 hover:border-stone-900 disabled:opacity-30 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={1}
            max={Math.max(24, recipe.baseServings * 4)}
            value={servings}
            onChange={(e) => setServings(parseInt(e.target.value))}
            className="flex-1"
            style={{ accentColor: accent }}
          />
          <button
            onClick={() => setServings(servings + 1)}
            className="px-4 scaler-pill border border-stone-300 hover:border-stone-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="w-20 scaler-pill border border-stone-300 flex flex-col items-center justify-center">
            <div className="font-display font-medium text-2xl leading-none recipe-num" style={{ color: accent }}>
              {servings}
            </div>
            <div className="font-mono text-[8px] tracking-widest uppercase text-stone-500 mt-0.5">portions</div>
          </div>
        </div>
        {servings !== recipe.baseServings && (
          <button onClick={() => setServings(recipe.baseServings)} className="mt-2 font-mono text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900">
            ↺ reset to {recipe.baseServings}
          </button>
        )}
      </div>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-3xl font-medium text-stone-900">Ingredients</h2>
          <UnitToggle system={unitSystem} setSystem={setUnitSystem} />
        </div>
        <div className="space-y-1">
          {sectionedIngredients.map((group, gi) => (
            <div key={gi}>
              {group.section && (
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500 mt-4 mb-2 pb-1 border-b border-stone-200">
                  {group.section}
                </div>
              )}
              {group.items.map((ing) => (
                <IngredientRow key={ing.id} ingredient={ing} scale={scale} system={unitSystem} accent={accent} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-3xl font-medium mb-5 text-stone-900">Method</h2>
        <ol className="space-y-5">
          {(recipe.steps || []).map((step, idx) => (
            <StepRow key={step.id} step={step} index={idx + 1} accent={accent} />
          ))}
        </ol>
      </section>

      {recipe.notes && recipe.notes.length > 0 && (
        <section className="mb-12 border-t border-stone-300 pt-8">
          <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500 mb-5">Notes from the cook</h2>
          <div className="space-y-4">
            {recipe.notes.map((note, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 sm:gap-6">
                <div className="font-display italic font-medium text-stone-900 text-base">{note.title}</div>
                <div className="text-stone-700 leading-relaxed text-sm">{note.body}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-center py-8 border-t border-stone-300">
        <div className="font-display italic text-stone-500 text-sm">— end of recipe —</div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-5 fade-in">
          <div className="bg-stone-50 border border-stone-900 max-w-sm w-full p-6">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-xl font-medium mb-1">Hide this recipe?</h3>
                <p className="text-sm text-stone-600">"{recipe.title}" will be hidden in this browser. If it's a canonical recipe, the next sync from Box will not bring it back unless you reset.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm hover:bg-stone-100">
                Cancel
              </button>
              <button onClick={() => onDelete(recipe.id)} className="px-4 py-2 text-sm bg-red-700 text-white hover:bg-red-800">
                Hide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, value, sub, accent }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-stone-500 mb-1.5">{label}</div>
      <div className="font-display text-2xl sm:text-3xl font-light leading-none recipe-num" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] tracking-wider text-stone-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function UnitToggle({ system, setSystem }) {
  const options = [
    { id: 'original', label: 'Recipe' },
    { id: 'weight', label: 'Grams' },
    { id: 'volume', label: 'Volume' },
  ];
  return (
    <div className="flex border border-stone-300 text-[10px] font-mono tracking-widest uppercase">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => setSystem(opt.id)}
          className={`px-2 sm:px-3 py-1.5 transition-colors ${system === opt.id ? 'bg-stone-900 text-stone-50' : 'bg-transparent text-stone-600 hover:bg-stone-100'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function IngredientRow({ ingredient, scale, system, accent }) {
  const scaledAmount = ingredient.amount * scale;
  const display = useMemo(() => {
    if (isCountUnit(ingredient.unit)) {
      return {
        primary: formatFraction(scaledAmount),
        unit: ingredient.unit === 'pinch' ? pluralizeUnit('pinch', scaledAmount) :
              ingredient.unit === 'whole' ? '' : ingredient.unit,
        note: null,
      };
    }
    if (system === 'original') {
      return { primary: formatFraction(scaledAmount), unit: pluralizeUnit(ingredient.unit, scaledAmount), note: null };
    }
    if (system === 'weight') {
      const g = toGrams(scaledAmount, ingredient.unit, ingredient.name);
      if (g === null) {
        return { primary: formatFraction(scaledAmount), unit: pluralizeUnit(ingredient.unit, scaledAmount), note: 'no weight conversion' };
      }
      return { primary: formatGrams(g), unit: '', note: null };
    }
    if (system === 'volume') {
      if (VOLUME_UNITS.has(ingredient.unit)) {
        return { primary: formatFraction(scaledAmount), unit: pluralizeUnit(ingredient.unit, scaledAmount), note: null };
      }
      const v = toVolume(scaledAmount, ingredient.unit, ingredient.name);
      if (!v) {
        return { primary: formatFraction(scaledAmount), unit: pluralizeUnit(ingredient.unit, scaledAmount), note: 'no volume conversion' };
      }
      return { primary: formatFraction(v.amount), unit: pluralizeUnit(v.unit, v.amount), note: null };
    }
  }, [scaledAmount, ingredient, system]);

  return (
    <div className="flex items-baseline py-2.5 border-b border-stone-200 gap-4">
      <div className="font-display font-medium text-xl recipe-num shrink-0 min-w-[90px]" style={{ color: accent }}>
        {display.primary}
        {display.unit && <span className="text-base font-normal text-stone-700 ml-1">{display.unit}</span>}
      </div>
      <div className="flex-1 text-stone-800 leading-tight">
        {ingredient.name}
        {display.note && (
          <span className="block font-mono text-[9px] tracking-wider uppercase text-stone-400 mt-0.5">
            {display.note}
          </span>
        )}
      </div>
    </div>
  );
}

function StepRow({ step, index, accent }) {
  const [done, setDone] = useState(false);
  const time = formatTime(step.timerSeconds);
  return (
    <li className={`grid grid-cols-[40px_1fr] gap-4 transition-opacity ${done ? 'opacity-40' : ''}`}>
      <button
        onClick={() => setDone(!done)}
        className="font-display text-3xl leading-none font-light pt-0.5 hover:scale-110 transition-transform recipe-num text-left"
        style={{ color: accent }}
      >
        {String(index).padStart(2, '0')}
      </button>
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <h4 className={`font-display text-lg font-medium text-stone-900 ${done ? 'line-through' : ''}`}>
            {step.title}
          </h4>
          {time && (
            <span className="font-mono text-[10px] tracking-wider uppercase text-stone-500 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {time}
            </span>
          )}
        </div>
        <p className="text-stone-700 leading-relaxed text-[15px]">{step.content}</p>
      </div>
    </li>
  );
}

/* ============================================================
   EDIT VIEW
   ============================================================ */

function EditView({ recipe, onSave, onCancel }) {
  const isNew = !recipe;
  const [draft, setDraft] = useState(() => recipe ? JSON.parse(JSON.stringify(recipe)) : {
    id: `r-${Date.now()}`,
    title: '',
    version: 'v1',
    icon: '🍽️',
    accent: '#7B4423',
    description: '',
    baseServings: 4,
    activeMinutes: 0,
    totalMinutes: 0,
    tags: [],
    ingredients: [{ id: `i${Date.now()}`, name: '', amount: 1, unit: 'cup' }],
    steps: [{ id: `s${Date.now()}`, title: '', content: '' }],
    notes: [],
  });

  // Drop synthetic flags from saved draft
  const cleanDraft = (d) => {
    const { _edited, _userAdded, ...rest } = d;
    return rest;
  };

  const update = (patch) => setDraft({ ...draft, ...patch });
  const updateIngredient = (i, patch) => {
    const ings = [...draft.ingredients];
    ings[i] = { ...ings[i], ...patch };
    update({ ingredients: ings });
  };
  const addIngredient = () => update({ ingredients: [...draft.ingredients, { id: `i${Date.now()}`, name: '', amount: 1, unit: 'cup' }] });
  const removeIngredient = (i) => update({ ingredients: draft.ingredients.filter((_, idx) => idx !== i) });
  const updateStep = (i, patch) => {
    const steps = [...draft.steps];
    steps[i] = { ...steps[i], ...patch };
    update({ steps });
  };
  const addStep = () => update({ steps: [...draft.steps, { id: `s${Date.now()}`, title: '', content: '' }] });
  const removeStep = (i) => update({ steps: draft.steps.filter((_, idx) => idx !== i) });

  const canSave = draft.title.trim() && draft.ingredients.some(i => i.name.trim()) && draft.steps.some(s => s.title.trim() || s.content.trim());

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 sm:px-8 sm:py-10 slide-up">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-stone-300">
        <button onClick={onCancel} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors text-sm">
          <X className="w-4 h-4" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Cancel</span>
        </button>
        <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500">
          {isNew ? 'New Recipe' : 'Editing'}
        </h2>
        <button
          onClick={() => canSave && onSave(cleanDraft(draft))}
          disabled={!canSave}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-50 disabled:bg-stone-300 transition-colors text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <div className="mb-6 px-3 py-2 border-l-2 border-amber-600 bg-amber-50/50 text-xs text-stone-700">
        Edits and new recipes are saved <strong>only in this browser</strong>. To make changes permanent, edit the .docx in your Box <em>Recipes</em> folder and ask Claude to refresh the site.
      </div>

      <div className="space-y-3 mb-8">
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="What are you making?"
            className="w-full bg-transparent border-b border-stone-300 focus:border-stone-900 outline-none font-display text-3xl font-light py-2"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Version"><TextInput value={draft.version} onChange={v => update({ version: v })} /></Field>
          <Field label="Icon"><TextInput value={draft.icon} onChange={v => update({ icon: v })} /></Field>
          <Field label="Servings"><TextInput type="number" value={draft.baseServings} onChange={v => update({ baseServings: parseFloat(v) || 1 })} /></Field>
        </div>
        <Field label="Description">
          <textarea
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={2}
            placeholder="One sentence about this recipe."
            className="w-full bg-transparent border border-stone-300 focus:border-stone-900 outline-none font-display italic text-base py-2 px-3 resize-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Active min"><TextInput type="number" value={draft.activeMinutes} onChange={v => update({ activeMinutes: parseInt(v) || 0 })} /></Field>
          <Field label="Total min"><TextInput type="number" value={draft.totalMinutes} onChange={v => update({ totalMinutes: parseInt(v) || 0 })} /></Field>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-display text-2xl font-medium mb-3">Ingredients</h3>
        <div className="space-y-2">
          {draft.ingredients.map((ing, i) => (
            <div key={ing.id} className="grid grid-cols-[60px_70px_1fr_30px] gap-2 items-center">
              <input
                type="number"
                value={ing.amount}
                onChange={(e) => updateIngredient(i, { amount: parseFloat(e.target.value) || 0 })}
                className="bg-transparent border-b border-stone-300 focus:border-stone-900 outline-none py-1 px-1 font-mono text-sm"
                step="0.25"
              />
              <select
                value={ing.unit || 'whole'}
                onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                className="bg-transparent border-b border-stone-300 focus:border-stone-900 outline-none py-1 px-1 text-sm"
              >
                <option value="whole">—</option>
                <option value="cup">cup</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
                <option value="pinch">pinch</option>
                <option value="dash">dash</option>
              </select>
              <input
                value={ing.name}
                onChange={(e) => updateIngredient(i, { name: e.target.value })}
                placeholder="Ingredient"
                className="bg-transparent border-b border-stone-300 focus:border-stone-900 outline-none py-1 px-1"
              />
              <button onClick={() => removeIngredient(i)} className="text-stone-400 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addIngredient} className="mt-3 font-mono text-[11px] tracking-widest uppercase text-stone-600 hover:text-stone-900 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add ingredient
        </button>
      </div>

      <div className="mb-8">
        <h3 className="font-display text-2xl font-medium mb-3">Method</h3>
        <div className="space-y-3">
          {draft.steps.map((step, i) => (
            <div key={step.id} className="border border-stone-300 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display text-2xl font-light text-stone-500 recipe-num shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input
                  value={step.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder="Step title"
                  className="flex-1 bg-transparent border-b border-stone-200 focus:border-stone-900 outline-none py-1 px-1 font-display font-medium"
                />
                <input
                  type="number"
                  value={step.timerSeconds || ''}
                  onChange={(e) => updateStep(i, { timerSeconds: parseInt(e.target.value) || null })}
                  placeholder="seconds"
                  className="w-20 bg-transparent border-b border-stone-200 focus:border-stone-900 outline-none py-1 px-1 font-mono text-xs"
                />
                <button onClick={() => removeStep(i)} className="text-stone-400 hover:text-red-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={step.content}
                onChange={(e) => updateStep(i, { content: e.target.value })}
                rows={2}
                placeholder="What to do..."
                className="w-full bg-transparent text-sm focus:outline-none resize-none"
              />
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-3 font-mono text-[11px] tracking-widest uppercase text-stone-600 hover:text-stone-900 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add step
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-stone-300 focus:border-stone-900 outline-none py-1 px-1 text-sm"
    />
  );
}
