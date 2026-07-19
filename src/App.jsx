import { useState, useMemo } from 'react';
import { Search, ArrowLeft, Minus, Plus, Clock, Users, ChevronRight } from 'lucide-react';
import recipesData from './data/recipes.json';

// Photo paths in recipes.json are root-absolute ("/photos/x.jpg"); BASE_URL keeps them
// working when the site is served from a subpath (GitHub Pages) as well as root (Netlify).
const assetUrl = (p) => (p ? import.meta.env.BASE_URL + p.replace(/^\//, '') : p);

/* ============================================================
   UNIT CONVERSION
   ============================================================ */

const VOLUME_TO_ML = {
  cup: 240, tbsp: 15, tsp: 5, ml: 1, l: 1000, fl_oz: 30, pint: 480, quart: 960,
};

const WEIGHT_TO_G = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
};

const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_ML));
const WEIGHT_UNITS = new Set(Object.keys(WEIGHT_TO_G));

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
   VERSION FAMILY HELPERS
   ============================================================ */

function familyOf(recipe) {
  return recipe.family || recipe.id.replace(/-v\d+.*$/, '');
}

function versionRank(recipe) {
  const v = recipe.version || '';
  const m = v.match(/v?(\d+)/i);
  if (m) return parseInt(m[1]);
  return 0;
}

function siblingsByFamily(allRecipes, family) {
  const sibs = allRecipes.filter(r => familyOf(r) === family);
  return sibs.slice().sort((a, b) => versionRank(a) - versionRank(b));
}

/* ============================================================
   APP — READ-ONLY DISPLAY
   ============================================================ */

export default function RecipeApp() {
  const recipes = recipesData.recipes;
  const dataVersion = recipesData.dataVersion;

  const [view, setView] = useState({ type: 'list' });
  const [search, setSearch] = useState('');

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
            dataVersion={dataVersion}
          />
        ) : view.type === 'detail' ? (
          <DetailView
            recipe={recipes.find(r => r.id === view.id)}
            allRecipes={recipes}
            onBack={() => setView({ type: 'list' })}
            onSelect={(id) => setView({ type: 'detail', id })}
          />
        ) : null}
      </div>
    </>
  );
}

/* ============================================================
   LIST VIEW
   ============================================================ */

function ListView({ recipes, search, setSearch, onSelect, dataVersion }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q)) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(q)) ||
      r.author?.toLowerCase().includes(q)
    );
  }, [recipes, search]);

  // Group by family — ONE card per family, always the latest version.
  // Older versions live behind the version-switcher on the detail page.
  // Search rule: a family matches if ANY of its versions match the query.
  const grouped = useMemo(() => {
    const matchingFamilies = new Set();
    for (const r of filtered) matchingFamilies.add(familyOf(r));

    // Track family first-appearance index in the full recipes list (for ordering)
    const familyFirstIndex = new Map();
    recipes.forEach((r, i) => {
      const fam = familyOf(r);
      if (!familyFirstIndex.has(fam)) familyFirstIndex.set(fam, i);
    });

    const out = [];
    for (const fam of matchingFamilies) {
      const allInFamily = recipes.filter(r => familyOf(r) === fam);
      // Highest version rank wins; ties broken by file order (first wins)
      const sorted = allInFamily.slice().sort((a, b) => {
        const rankDiff = versionRank(b) - versionRank(a);
        if (rankDiff !== 0) return rankDiff;
        return recipes.indexOf(a) - recipes.indexOf(b);
      });
      out.push({ recipe: sorted[0], siblingCount: allInFamily.length });
    }
    out.sort((a, b) => familyFirstIndex.get(familyOf(a.recipe)) - familyFirstIndex.get(familyOf(b.recipe)));
    return out;
  }, [filtered, recipes]);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 sm:mb-14">
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500">
            № {String(grouped.length).padStart(3, '0')} dishes · refreshed {dataVersion}
          </div>
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

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes, tags, ingredients, authors…"
            className="w-full pl-11 pr-4 py-3 bg-stone-50/60 border border-stone-300 rounded-none font-body text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-20">
          <div className="font-display italic text-stone-500 text-xl">nothing matches that.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {grouped.map(({ recipe, siblingCount }, i) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => onSelect(recipe.id)}
              delay={i * 30}
              siblingCount={siblingCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onClick, delay = 0, siblingCount = 1 }) {
  const accent = recipe.accent || '#7B4423';
  const hasSiblings = siblingCount > 1;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-stone-50/40 hover:bg-stone-50 border border-stone-300 hover:border-stone-900 transition-all duration-200 fade-in flex flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="aspect-[4/3] flex items-center justify-center text-7xl sm:text-8xl border-b border-stone-300 transition-transform group-hover:scale-[1.02] overflow-hidden relative"
        style={{ background: recipe.photo ? '#F5EFE3' : `linear-gradient(135deg, ${accent}15 0%, ${accent}05 100%)` }}
      >
        {recipe.photo && (
          <img
            src={assetUrl(recipe.photo)}
            alt={recipe.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <span style={{ filter: 'saturate(0.85)' }} className="relative">
          {!recipe.photo && (recipe.icon || '🍽️')}
        </span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="font-display text-2xl font-medium leading-tight text-stone-900">
            {recipe.title}
          </h3>
          <span className="font-mono text-[10px] tracking-widest uppercase shrink-0 mt-1 flex items-center gap-1.5" style={{ color: accent }}>
            {recipe.version}
            {hasSiblings && (
              <span className="text-stone-400 normal-case tracking-normal">
                +{siblingCount - 1}
              </span>
            )}
          </span>
        </div>
        {recipe.badge && (
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-3">
            {recipe.badge}
          </div>
        )}
        <p className="text-sm text-stone-600 leading-relaxed mb-3 line-clamp-3">
          {recipe.description}
        </p>
        {recipe.author && (
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-3">
            by {recipe.author}
          </div>
        )}
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

function DetailView({ recipe, allRecipes, onBack, onSelect }) {
  const [servings, setServings] = useState(recipe?.baseServings || 1);
  const [unitSystem, setUnitSystem] = useState('original');

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

  const family = familyOf(recipe);
  const siblings = siblingsByFamily(allRecipes, family);
  const hasSiblings = siblings.length > 1;

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
      </div>

      <div
        className="aspect-[16/9] sm:aspect-[21/9] flex items-center justify-center text-8xl sm:text-9xl border border-stone-300 mb-8 overflow-hidden relative"
        style={{ background: recipe.photo ? '#F5EFE3' : `linear-gradient(135deg, ${accent}20 0%, ${accent}08 100%)` }}
      >
        {recipe.photo && (
          <img
            src={assetUrl(recipe.photo)}
            alt={recipe.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <span style={{ filter: 'saturate(0.85)' }} className="relative">
          {!recipe.photo && (recipe.icon || '🍽️')}
        </span>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2 gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: accent }}>
            {recipe.badge || recipe.tags?.[0] || ''}
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500">
            {recipe.version}
          </span>
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-light leading-[0.95] tracking-tight mb-3 text-stone-900">
          {recipe.title}
        </h1>
        {recipe.author && (
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-stone-500 mb-4">
            by {recipe.author}
          </div>
        )}
        <p className="font-display italic text-lg sm:text-xl text-stone-700 leading-relaxed max-w-2xl">
          {recipe.description}
        </p>
      </div>

      {hasSiblings && (
        <div className="mb-8 px-4 py-3 border border-stone-300 bg-stone-50/40">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-stone-500 mb-2">
            Other versions
          </div>
          <div className="flex flex-wrap gap-2">
            {siblings.map(sib => (
              <button
                key={sib.id}
                onClick={() => sib.id !== recipe.id && onSelect(sib.id)}
                disabled={sib.id === recipe.id}
                className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase border transition-colors ${
                  sib.id === recipe.id
                    ? 'bg-stone-900 text-stone-50 border-stone-900 cursor-default'
                    : 'bg-stone-50 border-stone-300 hover:border-stone-900'
                }`}
              >
                {sib.version}
                {sib.badge && <span className="ml-2 text-stone-400">· {sib.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

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
