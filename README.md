# Warhammer 40K Army Builder
### A mobile-first React single-page app for building, tracking, and managing Warhammer 40,000 armies across four factions.

---

## Overview

This app is a **single-file React application** (`src/App.jsx`) built with [Vite](https://vitejs.dev/) as the dev server and bundler. There is no backend, no database, and no server-side logic — everything runs in the browser and persists to **localStorage**.

The app supports four factions (**Chaos Space Marines, World Eaters, Space Marines, Tyranids**) and implements the **11th Edition** rules, including the Detachment Points system, stratagem tracker, and the full Crusade narrative campaign system.

---

## Architecture at a Glance

```
App.jsx (single file, ~4,000 lines)
│
├── IMPORTS                         React hooks only (useState, useEffect, useCallback)
│
├── FIREBASE CONFIG                 Stubbed out — see inline comments to activate cloud saves
│
├── LOCAL STORAGE HELPERS           loadListsFromStorage / saveListsToStorage
│                                   loadCrusadeFromStorage / saveCrusadeToStorage
│
├── CRUSADE DATA                    Ranks, Battle Honours, Battle Scars, Requisitions, Agendas
│   └── applyStatModifiers()        Pure function — computes live stat deltas from Honours/Scars
│
├── FACTION DATA (4 objects)        CSM_DATA, WE_DATA, SM_DATA, TYR_DATA
│   └── FACTIONS registry           Maps faction ID strings to their data objects
│
├── HELPER FUNCTIONS                getExcludedWeapons, useIsMobile, buildArmySnapshot,
│                                   hydrateArmySnapshot, parseStatValue, formatStatValue
│
├── SHARED COMPONENTS               StatBadge, WeaponRow
│
├── ArmyListManager                 Save/load/rename/delete army lists panel
│
├── ArmyBuilder                     ⚔ Tab 1 — main army building interface
│
├── RulesReference                  📖 Tab 2 — faction rules browser
│
├── CrusadeUnitCard                 Sub-component of CrusadeSection — per-unit crusade card
├── CrusadeSection                  🎖 Tab 3 — full Crusade roster management
├── BattleLogSection                Sub-component of CrusadeSection — battle log entry
│
├── App (default export)            Root component — tab routing, header, nav
│
└── NarrativeHub                    🗺 Tab 4 — lightweight narrative campaign tracker
```

---

## How Data Flows

### Faction Data
Each faction is defined as a plain JavaScript object (`CSM_DATA`, `WE_DATA`, `SM_DATA`, `TYR_DATA`) with this shape:

```js
{
  id: "csm",              // used as the faction key throughout the app
  name: "...",            // display name
  color: "#8b0000",       // primary theme colour (used for borders, backgrounds)
  accentColor: "#e0c070", // text/highlight colour on dark backgrounds
  icon: "✠",             // emoji icon shown in the UI
  tagline: "...",
  armyRule: { name, description },
  detachments: [
    {
      name: "...",
      dpCost: 2,                    // 11th Ed Detachment Points cost (1, 2, or 3)
      forceDisposition: "...",      // Take and Hold / Purge the Foe / etc.
      rule: "...",                  // full rule text
    }
  ],
  enhancements: [
    {
      id: "csm-e1",         // unique ID — used to link enhancements to detachments
      detachment: "...",    // must match a detachment name exactly for filtering to work
      name: "...",
      points: 15,
      description: "...",
    }
  ],
  stratagems: [
    {
      id: "csm-s1",
      detachment: "...",    // must match a detachment name exactly for tracker to work
      name: "...",
      cost: "1 CP",
      phase: "...",         // used to group stratagems by phase in the tracker
      description: "...",
    }
  ],
  marks: [...],    // Marks of Chaos — empty array for non-CSM factions
  units: [
    {
      id: "csm-chaos-lord",
      name: "...",
      role: "CHARACTER",    // CHARACTER | BATTLELINE | ELITE | FAST ATTACK | HEAVY | VEHICLE | DEDICATED TRANSPORT | MONSTER
      points: 80,
      baseSize: 1,          // optional — shown as "per model" hint in UI
      keywords: [...],
      stats: { M, T, Sv, W, Ld, OC, Inv },  // Inv is optional
      abilities: [{ name, description }],
      weapons: {
        ranged: [{ id, name, range, attacks, skill, strength, AP, damage, special, points, exclusive, limit }],
        melee:  [{ id, name,        attacks, skill, strength, AP, damage, special, points, exclusive, limit }],
      }
    }
  ]
}
```

The `exclusive` array on a weapon lists the IDs of other weapons that cannot be selected at the same time. This drives the mutual-exclusion greying-out logic in the UI.

All four faction objects are registered in:
```js
const FACTIONS = { csm: CSM_DATA, we: WE_DATA, sm: SM_DATA, tyr: TYR_DATA };
```
Adding a new faction means: define its data object, add it to `FACTIONS`.

---

## Army Builder — How It Works

`ArmyBuilder` is a React functional component with the following state:

| State | Type | Purpose |
|---|---|---|
| `factionId` | string | Currently selected faction key |
| `armyName` | string | Editable army name |
| `pointsLimit` | number | Army points cap (500–3000) |
| `units` | array | List of unit instances currently in the army |
| `selectedDetachments` | array | Names of currently selected detachments |
| `usedStratagems` | Set | IDs of stratagems marked as Used this game session |
| `showStratagemPanel` | bool | Whether the stratagem tracker is expanded |
| `showAddPanel` | bool | Whether the Add Unit panel is open |
| `showListManager` | bool | Whether the save/load panel is open |
| `showFactionPicker` | bool | Whether the faction selector is open |
| `expandedUnit` | string\|null | Instance ID of the currently expanded unit card |
| `currentListId` | string\|null | ID of the currently loaded saved list |

### Unit Instances
Each unit added to the army is a **unit instance** — a copy of the unit's base data merged with per-instance state:
```js
{
  instanceId: "...",           // unique ID (Date.now() + random)
  unitId: "...",               // references a unit in factionData.units
  unitData: { ... },           // full copy of the unit's data object
  selectedWeapons: {},         // map of weapon ID → true/false
  selectedMark: null,          // Mark of Chaos (CSM only)
  selectedEnhancement: null,   // Enhancement ID (CHARACTER units only)
  totalPoints: 80,             // recomputed whenever weapons/enhancements change
  // Narrative/Crusade fields (only visible when narrativeMode = true)
  unitName: "",
  xp: 0,
  notes: "",
}
```

### Detachment Points System (11th Edition)
- Budget: **2 DP at 1,000 pts**, **3 DP at 2,000 pts**
- 3 DP detachments are army-wide and cannot be combined with any other detachment
- The DP picker enforces this automatically via the `blocked` flag computed in the render
- `selectedDetachments` drives both enhancement filtering and the stratagem tracker

### Enhancement Filtering
When a CHARACTER unit's card is expanded, the enhancement picker filters `factionData.enhancements` to only show enhancements whose `detachment` field matches one of the strings in `selectedDetachments`. If no detachments are selected, a prompt is shown instead.

### Stratagem Tracker
- Reads all stratagems from `factionData.stratagems` whose `detachment` is in `selectedDetachments`
- Groups them by `phase` for display
- `usedStratagems` is a `Set<string>` of stratagem IDs — toggling a button calls `setUsedStratagems` with the ID added or removed
- State is **session-only** — it resets when the faction changes or the page reloads (intentional: it's a game-time tool, not persistent data)

### Save / Load
Army lists are serialised by `buildArmySnapshot()` into a plain JS object and stored in `localStorage` under `csm_army_lists_v4`. `hydrateArmySnapshot()` reverses this — it re-links unit instances to their current faction data. The version suffix in the storage key (`_v4`) means old saves from breaking-change updates are cleanly ignored rather than causing errors.

---

## Rules Reference — How It Works

`RulesReference` is a stateless display component (just two `useState` hooks for faction toggle and active sub-tab). It reads directly from the `FACTIONS` registry and renders whatever the user selects. No data transformation happens here — it's a pure render of the data layer.

Sub-tabs: `army-rule` · `detachments` · `units` · `stratagems` · `enhancements` · `11th-edition`

The `units` sub-tab has two layouts:
- **Desktop**: sidebar list + detail pane side by side
- **Mobile**: drill-down — list view → tap unit → detail view with Back button

---

## Crusade System — How It Works

The Crusade system is completely independent from the army builder. It has its own localStorage key (`csm_crusade_rosters_v4`) and its own state tree inside `CrusadeSection`.

### Roster Shape
```js
{
  id: "...",
  name: "...",
  factionId: "csm",
  createdAt: "...",
  crusadePoints: 0,
  requisitionPoints: 5,
  supplyLimit: 1000,
  supplyUsed: 0,
  biomassPoints: 0,        // Tyranids only
  battleTally: { victories, draws, defeats },
  agendaLog: [],
  units: [...],            // array of CrusadeUnit objects (see below)
}
```

### CrusadeUnit Shape
```js
{
  instanceId: "...",
  unitId: "...",           // references factionData.units
  unitName: "",            // custom name
  xp: 0,
  battleHonourIds: [],     // IDs from BATTLE_HONOURS
  battleScarIds: [],       // IDs from BATTLE_SCARS
  notes: "",
}
```

### Live Stat Modification
`applyStatModifiers(baseStats, activeHonourIds, activeScarIds)` is a pure function that:
1. Looks up each active honour/scar ID in `ALL_HONOURS` / `BATTLE_SCARS`
2. Applies `statModifiers` (e.g. `{ M: 2, Sv: -1 }`) on top of the unit's base stats
3. Returns a new stats object plus a `deltas` map showing what changed

The `CrusadeUnitCard` component uses this to drive the coloured stat badges (green = buff, red = debuff).

### Rank Progression
Defined in `CRUSADE_RANKS` — an array of `{ rank, minXp, icon }` objects. `getRank(xp)` and `getNextRank(xp)` are simple linear scans of this array. When a unit's XP crosses a rank boundary, an animated banner notification fires for 4 seconds.

---

## Crusade Data Structures

| Constant | Description |
|---|---|
| `CRUSADE_RANKS` | XP thresholds for Fresh Recruit → Blooded → Veteran → Elite → Legend |
| `BATTLE_HONOURS` | Categorised by type (Battle Traits, Weapon Enhancements, Relics, faction-specific). Each honour has `statModifiers` and optional `specialRule` |
| `BATTLE_SCARS` | 10 scars, each tagged `recoverable` or `permanent` with an RP cost to remove |
| `REQUISITIONS` | 6 standard requisitions with RP cost and effect |
| `CRUSADE_AGENDAS` | General and faction-restricted agendas with XP, CP, and (for Tyranids) Biomass Point rewards |
| `ALL_HONOURS` | Flat array of all honours from all categories — used for ID lookups |

---

## Adding a New Faction

1. Define a new data object following the shape above (e.g. `DRUKHARI_DATA = { id: "drk", ... }`)
2. Add it to the FACTIONS registry: `const FACTIONS = { ..., drk: DRUKHARI_DATA }`
3. Add faction-specific Battle Honours to `BATTLE_HONOURS` under a new key (e.g. `drkFaction`)
4. Add faction-specific Crusade agendas to `CRUSADE_AGENDAS` with `factionRestriction: "drk"`
5. Wire the new honour category into `availableHonourCategories` inside `CrusadeUnitCard`
6. If the faction has a unique Crusade mechanic (like Tyranid Biomass Points), add the tracker field to the roster creation block and render it conditionally in the UI

---

## Adding a New Detachment to an Existing Faction

1. Add a detachment object to the faction's `detachments` array with `name`, `dpCost`, `forceDisposition`, and `rule`
2. Add enhancement objects to the faction's `enhancements` array — set `detachment` to exactly match the detachment name
3. Add stratagem objects to the faction's `stratagems` array — set `detachment` to exactly match the detachment name
4. The detachment picker, enhancement filter, and stratagem tracker all work automatically from these fields

---

## Tech Stack

| Tool | Role |
|---|---|
| React 18 | UI framework — functional components + hooks only |
| Vite | Dev server (`npm run dev`) and production bundler (`npm run build`) |
| localStorage | All persistence — no backend required |
| Google Fonts | Cinzel (display) + Crimson Text (body) — loaded via CSS import |
| Firebase (stubbed) | Optional cloud saves — see inline comments to activate |

---

## Running Locally

```bash
git clone https://github.com/raven-feeder/warhammer-army-app.git
cd warhammer-army-app
npm install
npm run dev
# Open http://localhost:5173
```

## Deploying to GitHub Pages

```bash
npm run build
npm run deploy
# Live at https://raven-feeder.github.io/warhammer-army-app/
```

---

## File Structure

```
warhammer-army-app/
├── src/
│   └── App.jsx          ← The entire application (single file)
├── index.html           ← Vite entry point
├── vite.config.js       ← Base path set to /warhammer-army-app/ for GitHub Pages
├── package.json
└── README.md
```

---

## Known Limitations / Future Work

- **No cloud sync by default** — saves are browser-local. Firebase hooks are stubbed; see inline comments.
- **No multi-user support** — each browser instance has its own independent save data.
- **Points costs** — sourced from the Munitorum Field Manual at time of writing. Cross-reference the latest GW document for tournament-legal costs.
- **Single file architecture** — chosen for simplicity and easy sharing. As the app grows, splitting into separate component files under `src/components/` would improve maintainability.