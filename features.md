# Meal Tracker — Feature Specification

This document describes every feature of the meal tracker app as it exists today, built iteratively over many sessions. Use this as the authoritative reference when building the full SaaS version.

---

## 1. Core Data Model

### 1.1 Food Database (`FOOD_DB`)

Every food is stored with nutrition values **per 100 grams (or 100ml for liquids)**. This is the universal unit — all calculations derive from `(grams / 100) * per100gValue`.

Each food entry has exactly these 10 nutrient fields:

| Field | Unit | Description |
|-------|------|-------------|
| `calories` | kcal | Total calories |
| `fat` | g | Total fat |
| `satFat` | g | Saturated fat |
| `cholesterol` | mg | Cholesterol |
| `sodium` | mg | Sodium |
| `carbs` | g | Total carbohydrates |
| `fiber` | g | Dietary fiber |
| `sugar` | g | Total sugars |
| `addSugar` | g | Added sugars (distinct from natural sugar) |
| `protein` | g | Protein |

**Important rules:**
- All values are per 100g/100ml — never per serving
- Maple syrup has `addSugar: 0` (pure maple syrup = natural sugar, per user instruction)
- Composite/recipe items (e.g., "Tempeh Penne", "Cava Pita HHC") are pre-calculated to per-100g values and stored as single entries. The user logs them by total grams consumed.
- Restaurant items are stored as composite entries (e.g., "Vals Shrimp Taco" includes tortilla, filling, toppings — all pre-calculated into one per-100g entry)
- The database currently has ~156 items, ranging from raw ingredients (Garlic, Olive Oil) to branded products (Clif Bar Choc Brownie, Truvani Choc Protein) to restaurant dishes (Cava Pita HHC, Baru Empanadas Domino)

### 1.2 Food IDs (`FOOD_ID`)

Every food in `FOOD_DB` gets a static numeric ID for quick reference. IDs are assigned alphabetically (sorted A-Z) and numbered sequentially starting at 1. When new foods are added, ALL IDs are rebuilt from scratch alphabetically.

**Purpose:** Quick reference when logging meals verbally (e.g., "add 350g of #132 tempeh pasta"). Displayed in the Food Database tab and in the Day Detail meals table.

**Critical maintenance rule:** IDs must be rebuilt from FOOD_DB keys every time the database changes. The rebuild process is: extract all FOOD_DB keys → sort alphabetically → assign sequential IDs 1, 2, 3...

### 1.3 Day Record

Each day is keyed by day number (1-31) within a month dataset. A day record has this shape:

```javascript
{
  location: "SD",                    // String — city/airport code (e.g., "SD", "NOLA", "MNL")
  weight: 167.4,                     // Number — morning weigh-in in lbs. Can be null if not weighed.
  exercise: 600,                     // Number — total exercise calories burned
  exerciseNote: "Jiu Jitsu",        // String — description of workout(s)
  creatine: 5,                       // Number — creatine intake in mg. Optional field.
  sleep: {                           // Object — overnight sleep data. Optional.
    hours: 7.6,                      // Number — total overnight sleep hours
    quality: 4,                      // Number 1-5 — subjective quality rating
    bedtime: "22:10",               // String HH:MM — 24hr format, time got in bed
    wake: "05:55",                  // String HH:MM — 24hr format, time woke up
    meds: true                      // Boolean — sleep medication taken. Optional, omit if false.
  },
  nap: {                             // Object — daytime nap data. Optional.
    hours: 1,                        // Number — nap duration in hours
    time: "15:00"                   // String HH:MM — 24hr format, nap start time
  },
  meals: [                           // Array — all food consumed that day
    { item: "Egg White", grams: 170 },
    { item: "Olive Oil", grams: 15 },
    // ... more items
  ]
}
```

**Rules and conventions:**
- `location` defaults to "SD" (San Diego) if not specified. Changes only when user travels.
- `weight` is always in pounds (lbs), recorded first thing in the morning.
- `exercise` is total calories burned across all workouts. Multiple workouts are summed (e.g., "BJJ x2 (600+200)" = 800).
- `sleep` is logged on the **wake-up day**, per PSQI convention. If you go to bed Saturday night and wake up Sunday, the sleep entry goes on Sunday's record.
- `nap` is separate from `sleep`. Overnight sleep drives quality metrics; naps are additive for total sleep only.
- `meals` array can have the same item multiple times (e.g., two servings of soy milk at different times). These are intentional, not duplicates.
- `creatine` is optional — only present on days it was taken.

### 1.4 Month Datasets

Data is organized by month. Each month is a separate constant:

```javascript
const APR_DATA = { 5: {...}, 6: {...}, ... };
const OCT_DATA = { 15: {...}, 16: {...}, ... };
```

The months array controls which months appear in the selector:

```javascript
const MONTHS = [
  { id: "apr2026", label: "Apr 2026", data: APR_DATA },
  { id: "oct2025", label: "Oct 2025", data: OCT_DATA },
];
```

The most recent month is first and selected by default.

---

## 2. Calculations

### 2.1 Nutrition Calculation

For each meal item:
```
nutrient_value = (grams / 100) * per_100g_value
```

Day totals sum all meal items across all 10 nutrient fields.

### 2.2 Calorie Budget

```
BMR = 1970 (fixed constant)
allowed = BMR + exercise_calories
surplus = total_calories_consumed - allowed
```

- If surplus > 0: displayed as "Surplus" in red
- If surplus < 0: displayed as "Deficit" in green
- The surplus/deficit display shows a positive number with the label indicating direction

### 2.3 Macro Percentages

```
fatPct = (fat_grams * 9) / total_calories
satFatPct = (satFat_grams * 9) / total_calories
carbPct = (carb_grams * 4) / total_calories
proteinPct = (protein_grams * 4) / total_calories
addSugarPct = (addSugar_grams * 4) / total_calories
```

Percentages are displayed as whole numbers with one decimal (e.g., "32.5%").

### 2.4 Weight Change

On the Weight tab and Month tab:
```
weight_change = first_day_weight - last_day_weight
```
- Positive value = weight lost (shown in green)
- Negative value = weight gained (shown in red)

### 2.5 Monthly Averages

Computed across all days in the selected month:
- All nutrient fields are averaged
- Total deficit/surplus is summed (not averaged)
- Fat%, carb%, protein% are recomputed from averaged grams (not averaged from daily percentages)
- Creatine is averaged across all days
- Sleep hours and quality are averaged across only days that have sleep data
- Sleep count tracks how many days have sleep entries vs total days

---

## 3. Target Ranges (Settings)

All color coding in the app references a TARGETS state object. These targets are **editable** in the Settings tab and **persisted** to storage.

### Default Targets

| Target | Low | High | Unit | Notes |
|--------|-----|------|------|-------|
| Fat % | 20 | 35 | % of calories | |
| Sat Fat % | 0 | 10 | % of calories | |
| Carb % | 45 | 65 | % of calories | |
| Protein % | 10 | 35 | % of calories | |
| Cholesterol | 0 | 200 | mg | |
| Sodium | 0 | 2300 | mg | |
| Fiber | 28 | 34 | g | |
| Protein Min | 90 | — | g | No upper bound (9999) |
| Added Sugar | 0 | 10 | % of calories | |
| Creatine Min | 5 | — | mg | No upper bound (9999) |
| Sleep Hours | 8 | 10 | hours | |
| Sleep Quality | 4 | 5 | 1-5 scale | |

### Color Coding Logic

- **Green (#34d399):** Value is within the low-high range
- **Red (#f87171):** Value is outside the range
- **Yellow (#fbbf24):** Used only for sleep — hours >= 7 but below target, or quality = 3
- Sodium uses a simpler check: green if <= high, red if > high

Settings are persisted to `localStorage` (HTML version) or `window.storage` (JSX/Claude artifact version). On load, saved targets are merged with defaults so new target fields added later get default values.

---

## 4. Tabs / Views

### 4.1 Month Tab

**Summary table** showing all days in the selected month with columns:
- Day, Weight, Allowed, Calories, Δ (delta/surplus), Fat, Sat, Chol, Na, Carbs, Fiber, Sugar, Add S, Protein

**Color coding:** Each cell is color-coded against TARGETS. Fat grams are colored by fat%, not absolute grams.

**Averages row** at the bottom: Shows average of all columns. The delta (Δ) column shows total surplus/deficit sum (not average).

**Stat cards** above the table (first row):
- Avg Calories (purple)
- Total Deficit/Surplus (green if deficit, red if surplus)
- Weight Loss (first day weight minus last day weight; green if lost, red if gained)
- Fat (colored by avg fat%)
- Carbs (colored by avg carb%)
- Protein (colored by avg protein meeting target)

**Row click:** Clicking any day row navigates to that day's Day Detail tab.

**Legend:** "■ In range  ■ Out of range  Click any row to see day detail"

### 4.2 Day Detail Tab (Default Tab)

**Day selector:** Row of numbered buttons (one per logged day). Selected day is highlighted green. Defaults to today's date on load.

**Day header cards:** Weight, BMR (always 1,970), Exercise, Allowed, Consumed, Surplus/Deficit

**Exercise + Creatine line:** Shows exercise description, calories, and creatine if taken. Example: "🏄 Jiu Jitsu · 💊 Creatine 5mg"

**Sleep bar:** Horizontal bar showing:
- "SLEEP" label
- Hours (color-coded: green if >= target, yellow if >= 7, red if < 7)
- "Quality" label + 5 colored dots (filled dots up to quality level, empty dots for remainder)
- Bedtime - Wake time range (e.g., "22:10 - 05:55")
- MEDS badge (purple, only if meds: true)
- NAP badge (yellow, shows "NAP 1h" — only if nap exists)
- Location badge (gray, e.g., "SD" or "NOLA")

**Meals table** with 13 columns:
- ID, Item, g, Cal, Fat, Sat, Chol, Na, Carb, Fiber, Sugar, Add S, Prot

Each row shows one meal item with calculated nutrition based on grams consumed.

**TOTALS row:** Bold row summing all nutrient columns. Color-coded:
- Calories: purple
- Cholesterol: green/red vs target
- Sodium: green/red vs target
- Fiber: green/red vs target

**MACRO % row:** Shows fat%, sat fat%, carb%, protein% — each color-coded vs targets.

**Target range cards** below the table (grid layout):
- Fat %, Sat Fat %, Carb %, Protein %, Cholesterol, Sodium, Fiber, Protein (g), Creatine
- Each card shows the label and current value
- Card border is green if in range, red if out of range
- Value text is green if in range, red if out of range

### 4.3 Food Database Tab

**Search bar:** Text input that filters the food list by name (case-insensitive substring match).

**Item count:** Shows "X items · per 100g" above the table.

**Table columns:** ID, Food, Cal, Fat, Sat, Chol, Na, Carb, Fiber, Sugar, Add S, Prot

All values displayed are per 100g. Table is sorted alphabetically by food name. Rows highlight on hover.

### 4.4 Weight Tab

**Stat cards:** Start weight, Current weight, Change (+/- lbs, green if lost, red if gained), Low (lowest weight in period, green)

**Chart:** Recharts AreaChart showing weight over time. Green line with gradient fill. X-axis is day number, Y-axis auto-scales with ±2 padding. Tooltip shows "Day X: Y lbs".

### 4.5 Sleep Tab

**Stat cards:** Avg Hours (colored vs target), Avg Quality (colored vs target), Days Tracked (X/Y, purple)

**Chart:** Dual-axis Recharts AreaChart:
- Left Y-axis: Hours (0-12), purple area
- Right Y-axis: Quality (0-5), green area
- X-axis: Day numbers
- Only days with sleep data are plotted

**Data table** with columns:
- Day, Location (badge), Bedtime, Wake, Hours (color-coded), Nap (hours if exists, "—" if not), Total (overnight + nap), Quality (5 colored dots), Meds ("Yes" or blank)

**Sleep quality scale:**
- 1 = Terrible
- 2 = Poor
- 3 = Fair
- 4 = Good
- 5 = Excellent

Quality dots color logic:
- Green: quality >= target (default 4)
- Yellow: quality = 3
- Red: quality < 3

Hours color logic:
- Green: hours >= target (default 8)
- Yellow: hours >= 7 but below target
- Red: hours < 7

### 4.6 Goals Tab

**Only active for April 2026.** Shows "Weight goals are configured for April 2026" for other months.

**Goal parameters (hardcoded for now):**
- Start date: April 5, 2026
- End date: May 12, 2026
- Start weight: 167.4 lbs
- Goal weight: 160.0 lbs
- Total days: 37
- Daily loss: (167.4 - 160.0) / 37 = 0.2 lbs/day
- Daily deficit needed: daily_loss * 3500 cal/lb

**Stat cards:** Start Weight, Goal Weight, Total Loss, Daily Loss, Daily Deficit, Target Date

**Tracking table** with columns:
- Day (Apr 5 through Apr 30)
- Goal Weight (linear interpolation: start - day_number * daily_loss)
- Actual Weight (from data, or "—" if no entry)
- Diff (actual - goal, green if ≤ 0, red if > 0)
- Status ("✓ On track" green if actual ≤ goal, "✗ Over" red if actual > goal, "—" if no data)

### 4.7 Settings Tab

**Editable target ranges** for all parameters listed in Section 3.

Each target shows:
- Label
- LOW input field
- HIGH input field (hidden for proteinG and creatine — "no upper bound" targets)

Percentage values are entered as whole numbers (e.g., "20" for 20%) and stored as decimals (0.20) internally.

Changes apply immediately to all views. Persisted to storage.

Note: "Changes apply immediately. Percentage values entered as whole numbers (e.g. 20 for 20%)."

---

## 5. Location Tracking

- Each day has an optional `location` field — a short string code (e.g., "SD", "NOLA", "MNL", "SIN")
- Defaults to "SD" if not specified
- Only changes when the user travels
- Displayed as a small gray badge on:
  - The sleep bar in the Day Detail tab
  - The Location column in the Sleep tab data table
- Included in the sleep chart tooltip data
- Purpose: Track how travel/location changes affect sleep quality and nutrition patterns

---

## 6. Nap Tracking

- Separate from overnight sleep
- Optional `nap` field on day record: `{ hours: Number, time: "HH:MM" }`
- Displayed as a yellow "NAP Xh" badge on the daily detail sleep bar
- Sleep tab table has "Nap" and "Total" columns:
  - Nap: shows nap hours or "—"
  - Total: overnight hours + nap hours
- **Overnight sleep quality scores are NOT affected by naps** — quality is tied to the primary overnight sleep only
- Sleep chart plots overnight hours only (not total including nap)
- Rationale: Modeled after Oura/Whoop approach — naps improve recovery but don't compensate for poor overnight sleep

---

## 7. Export

**Export JSON button** in the header. Downloads a file named `meal-tracker-data.json` containing:

```javascript
{
  foodDatabase: { /* full FOOD_DB */ },
  foodIds: { /* full FOOD_ID */ },
  months: {
    apr2026: { label: "Apr 2026", days: { /* APR_DATA */ } },
    oct2025: { label: "Oct 2025", days: { /* OCT_DATA */ } }
  }
}
```

---

## 8. Visual Design

### 8.1 Color Palette (Dark Theme)

| Element | Color |
|---------|-------|
| Background | #0c0c0f |
| Card background | #18181b |
| Card border | #27272a |
| Subtle card bg | #15151a |
| Row border | #1e1e24 |
| Primary text | #e4e4e7 / #f4f4f5 |
| Secondary text | #a1a1aa |
| Muted text | #71717a |
| Dim text | #52525b |
| Disabled/empty | #3f3f46 |
| Green (in range) | #34d399 |
| Red (out of range) | #f87171 |
| Yellow (warning) | #fbbf24 |
| Purple (accent/info) | #818cf8 |
| Meds badge bg | #1e1b4b |
| Meds badge text | #818cf8 |
| Nap badge bg | #422006 |
| Nap badge text | #fbbf24 |
| Location badge bg | #27272a |
| Location badge text | #a1a1aa |
| Green border (in range) | #064e3b |
| Red border (out of range) | #450a0a |

### 8.2 Typography

- Header/mono font: `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace` — used for all labels, table headers, stat values, tab buttons, numeric data
- Body font: `'DM Sans', 'Helvetica Neue', sans-serif` — used as the base font-family
- Loaded via Google Fonts CSS link

### 8.3 Component Patterns

- **Stat cards:** Grid layout, auto-fit columns min 130px. Dark card with uppercase label (10px, letter-spacing 1) and large value (18-20px, bold).
- **Tables:** Full-width, collapsed borders. Tiny uppercase headers (9-10px). Row hover highlight (#1a1a1f). Monospace font throughout.
- **Tab bar:** Bottom-border style tabs. Active tab has green (#34d399) bottom border and bright text. Inactive tabs are dim (#52525b).
- **Day selector buttons:** 38x38px rounded squares. Selected = green background with dark text. Unselected = dark background with gray border.
- **Target range cards:** Flex row with label left, value right. Border color indicates in/out of range.
- **Charts:** Recharts library. Dark tooltip styling matching card design. Green for weight, purple for sleep hours, green for sleep quality. Gradient fills.

---

## 9. Deployment

The app is deployed as a standalone HTML file:

- **URL:** `https://corp.javin.io/meal-tracker/`
- **Server:** nginx on a DigitalOcean droplet
- **Deploy script:** `deploy.sh` rsyncs `meal-tracker.html` as `index.html` to `/var/www/meal-tracker/`
- **nginx config:** Simple location block aliasing `/meal-tracker/` to the directory

The HTML version uses unpkg CDN for React 18, Babel standalone, Recharts, and prop-types. It's a single self-contained HTML file with all data, logic, and UI in one file.

---

## 10. Composite Recipe Items

Several food items in the database are pre-calculated composite recipes where the user cooked a recipe, calculated total nutrition, and divided by total weight to get per-100g values. These include:

| Item | Cal/100g | Description |
|------|----------|-------------|
| Veg Meatloaf | 108.78 | Lentils, mushrooms, onion, garlic, panko, egg, dijon, BBQ sauce, olive oil |
| Roasted Fingerlings | 122.35 | Potatoes, olive oil, rosemary |
| White Miso Risotto | 134.79 | Arborio rice, onion, garlic, broth, butter, parmesan, cashews, miso, lemon, walnuts, coconut oil, water (NO tofu) |
| Cashew Miso Sauce | 205.84 | Cashews, white miso, water, garlic, lemon |
| Vegan Shawarma Plate | 142.45 | Soy shawarma, hummus, yellow rice, tabouli (no garlic sauce) |
| GW Falafel Mezze | 185.96 | Pita, beet hummus, falafel, turmeric cauliflower, tabbouleh (no olive oil dip) |
| Tempeh Penne | 112 | Tempeh bolognese with 2 onions, no-salt san marzano tomatoes, extra 16oz blended tomatoes, ¼c water, no tomato paste, sodium 19mg/100g |
| Daily Beet Rainbow Bowl | 120 | Quinoa, avocado, carrot, beet, red bell pepper, chickpea, currant, toasted almond (NO dressing version) |
| Cava Pita HHC | 190 | Full pita build: pita + roasted eggplant dip + red pepper hummus + harissa honey chicken + avocado + tomato/cucumber + tomato/onion + fire-roasted corn + skhug |

These items are logged by total grams consumed, not by individual ingredients.

---

## 11. Data Inventory

### Current Months
- **October 2025:** Days 15-31 (17 days), weight range 177.4 → 168.2
- **April 2026:** Days 5-23 (19 days), weight range 167.4 → 171.6

### Food Database Size
- ~156 unique items across raw ingredients, branded products, homemade recipes, and restaurant dishes

### Sleep Data Coverage
- April 2026: Sleep logged starting Day 14 (10 of 19 days have sleep)
- October 2025: No sleep data (feature added later)

### Location Data Coverage
- April 2026: All days have location. Days 5-15: SD, Days 16-21: NOLA, Days 22-23: SD
- October 2025: Some days have location, many don't (feature added later)

---

## 12. Intended But Not Yet Implemented

These features were discussed and planned but are not in the current build:

1. **Month tab second row of stat cards:** Was intended to show Fiber, Sodium, Creatine, Avg Sleep, and Sleep Quality averages below the first row of stat cards (Avg Calories, Total Deficit, Weight Loss, Fat, Carbs, Protein). Got lost during code regeneration.

2. **Cava Pita from Apr 20:** Was researched with full per-component nutrition from Cava's official data (Pita 230cal + Roasted Eggplant 50cal + Red Pepper Hummus 40cal + Harissa Honey Chicken 260cal + Avocado 110cal + Tomato+Cucumber 15cal + Tomato+Onion 15cal + Fire-Roasted Corn 45cal + Skhug 90cal = 855cal total). Stored as composite "Cava Pita HHC" at 190cal/100g for a 450g serving.

3. **Production React mode:** The HTML version uses React development mode via Babel standalone. Was flagged to switch to production mode for performance but never done.

---

## 13. Known Issues and Design Decisions

1. **Sleep on wake-up day:** Sleep is always logged on the day you wake up, not the day you went to bed. This follows the PSQI (Pittsburgh Sleep Quality Index) convention.

2. **Duplicate food items in meals:** The same food can appear multiple times in a day's meals array (e.g., two servings of soy milk). This is intentional — each entry represents a separate eating event.

3. **BMR is hardcoded:** Fixed at 1970 calories. In the SaaS version this should be user-configurable or calculated from height/weight/age.

4. **Goal tracking is month-specific:** Currently hardcoded for April 2026 with fixed start/goal weights and dates. Should be generalized.

5. **No CRUD for meals or days in the UI:** All data was entered programmatically. The SaaS version needs full add/edit/delete functionality for meals, days, foods, sleep, exercise, etc.

6. **Food IDs change when foods are added:** Since IDs are assigned alphabetically, adding a new food can change every ID. The SaaS version should use stable unique IDs (UUIDs or auto-increment that never reassigns).

7. **No user authentication:** Single-user app. SaaS version needs auth, multi-user support, and data isolation.

8. **Cottage Cheese updated to Nancy's Low Fat:** The Cottage Cheese entry was updated to Nancy's Organic Probiotic Low Fat (72 cal/100g, 12g protein). This affects all historical days that reference it.

9. **Duplicate sleep tab rendering in JSX:** The sleep tab content block appears twice in the current JSX code (around lines 992 and 1164). Both render when the sleep tab is active. The SaaS version should have only one.

10. **Some duplicate food entries in FOOD_DB:** A few items appear twice with slightly different nutrition values (e.g., Cream Cheese, Bobbys Veggie Burger, Bobos Strawberry Oat Bar, Beignet). The last entry wins in JavaScript, but the SaaS version should enforce unique names.

11. **JSX vs HTML feature parity:** The HTML version has features the JSX version is missing, including: the sleep bar in Day Detail (with quality dots, bedtime-wake, meds badge, nap badge, location badge), and the exercise/location line styling. The HTML version is the more complete reference. The SaaS version should implement all features from both.

12. **Exercise display format:** Shows "🏄 {exerciseNote} · 💊 Creatine {X}mg" — the surfboard emoji is used generically for all exercise types (including BJJ). The SaaS version could use contextual icons.
