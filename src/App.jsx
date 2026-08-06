// ============================================================
// IMPORTS
// ============================================================
import { useState, useEffect, useCallback } from "react";

// ============================================================
// FIREBASE CONFIGURATION (CLOUD SAVES)
// ============================================================
// To enable cloud saves:
//   1. Go to https://firebase.google.com and create a free project
//   2. Enable Authentication (Google, Apple, Email/Password) in the Firebase console
//   3. Enable Firestore Database in the Firebase console
//   4. Run: npm install firebase
//   5. Replace placeholder values below with your project config keys
//   6. Uncomment lines marked FIREBASE STEP 1 / STEP 2
//
// FIREBASE STEP 1 - add these imports:
//   initializeApp from firebase/app
//   getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup,
//   createUserWithEmailAndPassword, signInWithEmailAndPassword,
//   signOut, onAuthStateChanged from firebase/auth
//   getFirestore, doc, setDoc, getDocs, deleteDoc, collection from firebase/firestore
//
// FIREBASE STEP 2 - initialise with your config:
//   const firebaseConfig = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
//   const firebaseApp = initializeApp(firebaseConfig);
//   const auth = getAuth(firebaseApp);
//   const db   = getFirestore(firebaseApp);

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

// Storage key for army lists
const STORAGE_KEY = "csm_army_lists_v4";
// Storage key for crusade rosters (separate from army lists)
const CRUSADE_STORAGE_KEY = "csm_crusade_rosters_v4";

// Reads saved army lists from localStorage. Returns [] on failure.
function loadListsFromStorage() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

// Writes army lists array to localStorage.
function saveListsToStorage(lists) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lists)); }
  catch { console.error("localStorage write failed."); }
}

// Reads saved crusade rosters from localStorage. Returns [] on failure.
function loadCrusadeFromStorage() {
  try { const r = localStorage.getItem(CRUSADE_STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

// Writes crusade rosters array to localStorage.
function saveCrusadeToStorage(rosters) {
  try { localStorage.setItem(CRUSADE_STORAGE_KEY, JSON.stringify(rosters)); }
  catch { console.error("Crusade localStorage write failed."); }
}

// ============================================================
// CRUSADE RULES DATA (10th Edition)
// ============================================================
// Source: Warhammer 40,000 Core Rules (Crusade), Codex: CSM 2024,
// Codex: World Eaters 2025. Cross-reference GW FAQs for latest XP values.

// ── Rank thresholds ──
// Each rank is reached when a unit's XP meets or exceeds the threshold.
// Ranks: Fresh Recruit (0) → Blooded (6) → Veteran (16) → Elite (31) → Legend (51)
const CRUSADE_RANKS = [
  { name: "Fresh Recruit", minXP: 0,  icon: "☆" },
  { name: "Blooded",       minXP: 6,  icon: "★" },
  { name: "Veteran",       minXP: 16, icon: "★★" },
  { name: "Elite",         minXP: 31, icon: "★★★" },
  { name: "Legend",        minXP: 51, icon: "★★★★" },
];

// Returns the rank object for a given XP value.
function getRank(xp) {
  return [...CRUSADE_RANKS].reverse().find((r) => xp >= r.minXP) || CRUSADE_RANKS[0];
}

// Returns the next rank object (or null if already at Legend).
function getNextRank(xp) {
  const idx = CRUSADE_RANKS.findIndex((r) => r === getRank(xp));
  return idx < CRUSADE_RANKS.length - 1 ? CRUSADE_RANKS[idx + 1] : null;
}

// ── Battle Honours ──
// Each honour has an optional statModifiers object that automatically updates
// the unit's stat block when selected. Keys match the unit stats object keys.
// Positive values = buff (shown green), negative = debuff (shown red).
const BATTLE_HONOURS = {
  // ── Battle Traits ──
  battleTraits: [
    {
      id: "bh-bt-1", name: "Unyielding",
      type: "Battle Trait",
      description: "This unit's models have +1 to their Toughness characteristic.",
      statModifiers: { T: 1 },
      minRank: "Blooded",
    },
    {
      id: "bh-bt-2", name: "Swift Advance",
      type: "Battle Trait",
      description: "Add 1\" to this unit's Move characteristic.",
      statModifiers: { M: 1 },
      minRank: "Blooded",
    },
    {
      id: "bh-bt-3", name: "Driven by Hatred",
      type: "Battle Trait",
      description: "Add 1 to the Attacks characteristic of melee weapons equipped by models in this unit.",
      statModifiers: {},
      specialRule: "+1 Attack (melee weapons)",
      minRank: "Blooded",
    },
    {
      id: "bh-bt-4", name: "Hardened Veterans",
      type: "Battle Trait",
      description: "Improve this unit's Save characteristic by 1 (e.g. 3+ becomes 2+).",
      statModifiers: { Sv: -1 }, // lower number = better save
      minRank: "Veteran",
    },
    {
      id: "bh-bt-5", name: "Fearsome Reputation",
      type: "Battle Trait",
      description: "Subtract 1 from the Leadership characteristic of enemy units within 6\" of this unit.",
      statModifiers: {},
      specialRule: "Enemy -1 Ld within 6\"",
      minRank: "Veteran",
    },
    {
      id: "bh-bt-6", name: "Warp-touched Resilience",
      type: "Battle Trait",
      description: "Models in this unit have a 6+ Feel No Pain.",
      statModifiers: {},
      specialRule: "6+ Feel No Pain",
      minRank: "Blooded",
    },
    {
      id: "bh-bt-7", name: "Unstoppable Fury",
      type: "Battle Trait",
      description: "Add 1 to charge rolls made for this unit.",
      statModifiers: {},
      specialRule: "+1 to Charge rolls",
      minRank: "Blooded",
    },
    {
      id: "bh-bt-8", name: "Daemonic Vigour",
      type: "Battle Trait",
      description: "Improve the invulnerable save of models in this unit by 1 (e.g. 5+ becomes 4+). If the unit has no invulnerable save, it gains a 6+ invulnerable save.",
      statModifiers: { Inv: -1 },
      minRank: "Elite",
    },
    {
      id: "bh-bt-9", name: "Veteran Warriors",
      type: "Battle Trait",
      description: "Add 1 to the Objective Control (OC) characteristic of models in this unit.",
      statModifiers: { OC: 1 },
      minRank: "Blooded",
    },
    {
      id: "bh-bt-10", name: "Prescient Strike",
      type: "Battle Trait",
      description: "Once per battle, this unit can fight first in the Fight phase even if it did not charge.",
      statModifiers: {},
      specialRule: "Fight First (once per battle)",
      minRank: "Veteran",
    },
  ],

  // ── Weapon Enhancements ──
  weaponEnhancements: [
    {
      id: "bh-we-1", name: "Empyric Blade",
      type: "Weapon Enhancement",
      description: "Select one melee weapon. Improve the AP of that weapon by 1.",
      statModifiers: {},
      specialRule: "Selected melee weapon: AP -1",
      minRank: "Blooded",
    },
    {
      id: "bh-we-2", name: "Hellfire Rounds",
      type: "Weapon Enhancement",
      description: "Select one ranged weapon. That weapon gains the Devastating Wounds ability.",
      statModifiers: {},
      specialRule: "Selected ranged weapon: Devastating Wounds",
      minRank: "Blooded",
    },
    {
      id: "bh-we-3", name: "Warpforged Edge",
      type: "Weapon Enhancement",
      description: "Select one melee weapon. Add 1 to the Strength of that weapon.",
      statModifiers: {},
      specialRule: "Selected melee weapon: +1 Strength",
      minRank: "Veteran",
    },
    {
      id: "bh-we-4", name: "Murderous Efficacy",
      type: "Weapon Enhancement",
      description: "Select one weapon. Add 1 to the Damage of that weapon.",
      statModifiers: {},
      specialRule: "Selected weapon: +1 Damage",
      minRank: "Elite",
    },
    {
      id: "bh-we-5", name: "Relentless Barrage",
      type: "Weapon Enhancement",
      description: "Select one ranged weapon. Add 1 to the Attacks of that weapon.",
      statModifiers: {},
      specialRule: "Selected ranged weapon: +1 Attacks",
      minRank: "Blooded",
    },
  ],

  // ── Crusade Relics ──
  crusadeRelics: [
    {
      id: "bh-cr-1", name: "Blade of the Long War",
      type: "Crusade Relic",
      description: "The bearer's melee weapons gain +1 Strength, +1 AP, and the Lethal Hits ability.",
      statModifiers: {},
      specialRule: "Melee: +1 S, +1 AP, Lethal Hits",
      minRank: "Legend",
    },
    {
      id: "bh-cr-2", name: "Mark of Chaos Ascendant",
      type: "Crusade Relic",
      description: "The bearer gains a 4+ invulnerable save. If they already have one, improve it by 1.",
      statModifiers: { Inv: -1 },
      minRank: "Elite",
    },
    {
      id: "bh-cr-3", name: "Daemon-bound Plate",
      type: "Crusade Relic",
      description: "The bearer has +1 Toughness and +1 Wound.",
      statModifiers: { T: 1, W: 1 },
      minRank: "Elite",
    },
    {
      id: "bh-cr-4", name: "Skull of Khorne",
      type: "Crusade Relic",
      description: "World Eaters only. The bearer's melee weapons gain the Devastating Wounds ability. Add 2 to the bearer's Attacks.",
      statModifiers: {},
      specialRule: "Melee: Devastating Wounds, +2 Attacks",
      minRank: "Legend",
      factionRestriction: "we",
    },
    {
      id: "bh-cr-5", name: "Tome of the Dark Gods",
      type: "Crusade Relic",
      description: "CSM only. Once per battle, the bearer can make a Dark Pact that automatically succeeds (no roll required).",
      statModifiers: {},
      specialRule: "Dark Pact: auto-succeed (once per battle)",
      minRank: "Legend",
      factionRestriction: "csm",
    },
  ],

  // ── CSM-specific Faction Honours ──
  csmFaction: [
    {
      id: "bh-csm-1", name: "Favoured of the Dark Gods",
      type: "CSM Faction Honour",
      description: "This unit may make one additional Dark Pact attempt per battle.",
      statModifiers: {},
      specialRule: "+1 Dark Pact attempt per battle",
      minRank: "Veteran",
    },
    {
      id: "bh-csm-2", name: "Mark Ascendant",
      type: "CSM Faction Honour",
      description: "The bonus from this unit's Mark of Chaos is enhanced. Khorne: +2 Attacks. Tzeentch: 4+ invuln. Nurgle: +2 Toughness. Slaanesh: +3\" Advance/Charge. Undivided: Re-roll one Dark Pact die.",
      statModifiers: {},
      specialRule: "Enhanced Mark of Chaos bonus",
      minRank: "Elite",
    },
    {
      id: "bh-csm-3", name: "Veteran of the Long War",
      type: "CSM Faction Honour",
      description: "Add 1 to wound rolls made by this unit against IMPERIUM units.",
      statModifiers: {},
      specialRule: "+1 to wound vs IMPERIUM",
      minRank: "Blooded",
    },
  ],

  // ── World Eaters-specific Faction Honours ──
  weFaction: [
    {
      id: "bh-we-f1", name: "Skulls Taken",
      type: "WE Faction Honour",
      description: "Each time this unit destroys an enemy CHARACTER, it immediately gains D3 XP.",
      statModifiers: {},
      specialRule: "+D3 XP per enemy CHARACTER destroyed",
      minRank: "Blooded",
    },
    {
      id: "bh-we-f2", name: "Blood God's Champion",
      type: "WE Faction Honour",
      description: "This unit counts as two units for the purposes of Blood Tithe points.",
      statModifiers: {},
      specialRule: "Counts as 2 units for Blood Tithe",
      minRank: "Veteran",
    },
    {
      id: "bh-we-f3", name: "Khorne's Chosen",
      type: "WE Faction Honour",
      description: "Add 1 to the Attacks characteristic of this unit's melee weapons. This unit also gains the ability to re-roll charge rolls.",
      statModifiers: {},
      specialRule: "+1 Attacks (melee), re-roll Charge rolls",
      minRank: "Elite",
    },
  ],

  // ── Tyranid-specific Faction Honours (Bioform Adaptations) ──
  tyrFaction: [
    {
      id: "bh-tyr-f1", name: "Accelerated Chitin",
      type: "TYR Bioform Adaptation",
      description: "Improve the bearer's Save by 1 (e.g. 4+ becomes 3+).",
      statModifiers: { Sv: -1 },
      minRank: "Blooded",
    },
    {
      id: "bh-tyr-f2", name: "Enhanced Muscle Fibres",
      type: "TYR Bioform Adaptation",
      description: "Add 2\" to the Move characteristic of models in this unit.",
      statModifiers: { M: 2 },
      minRank: "Blooded",
    },
    {
      id: "bh-tyr-f3", name: "Predatory Instincts",
      type: "TYR Bioform Adaptation",
      description: "Each time this unit makes a charge move, until end of turn, its melee weapons gain Devastating Wounds.",
      statModifiers: {},
      specialRule: "Melee: Devastating Wounds after charging",
      minRank: "Veteran",
    },
    {
      id: "bh-tyr-f4", name: "Toxic Venom Sacs",
      type: "TYR Bioform Adaptation",
      description: "Add 1 to the Wound rolls of this unit's melee attacks.",
      statModifiers: {},
      specialRule: "+1 to Wound (melee)",
      minRank: "Blooded",
    },
    {
      id: "bh-tyr-f5", name: "Warp-twisted Biology",
      type: "TYR Bioform Adaptation",
      description: "This unit gains a 5+ invulnerable save. If it already has one, improve it by 1.",
      statModifiers: { Inv: -1 },
      minRank: "Veteran",
    },
    {
      id: "bh-tyr-f6", name: "Regenerative Tissue",
      type: "TYR Bioform Adaptation",
      description: "At the start of each of your Command phases, this unit regains 1 lost wound.",
      statModifiers: {},
      specialRule: "Regain 1 wound per Command phase",
      minRank: "Elite",
    },
  ],
};

// Flattened array of all Battle Honours for easy lookup by ID.
const ALL_HONOURS = Object.values(BATTLE_HONOURS).flat();

// ── Battle Scars ──
// Each scar has optional statModifiers that automatically worsen the unit's stats.
// Negative modifiers on stats like T, W, Sv represent deterioration.
const BATTLE_SCARS = [
  {
    id: "bs-1", name: "Horrific Disfigurement",
    description: "This unit's Objective Control characteristic is reduced by 1 (minimum 1).",
    statModifiers: { OC: -1 },
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-2", name: "Traumatised",
    description: "Worsen this unit's Leadership characteristic by 1 (e.g. 6+ becomes 7+).",
    statModifiers: { Ld: 1 }, // higher number = worse for Ld
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-3", name: "Battle-weary",
    description: "Reduce this unit's Move characteristic by 1\".",
    statModifiers: { M: -1 },
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-4", name: "Damaged Weapons",
    description: "Worsen the AP of all weapons equipped by models in this unit by 1 (e.g. AP -2 becomes AP -1).",
    statModifiers: {},
    specialRule: "All weapons: AP worsened by 1",
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-5", name: "Tainted Flesh",
    description: "Reduce this unit's Toughness characteristic by 1.",
    statModifiers: { T: -1 },
    recoverable: false,
  },
  {
    id: "bs-6", name: "Devastating Blow",
    description: "Reduce the Wounds characteristic of each model in this unit by 1 (minimum 1).",
    statModifiers: { W: -1 },
    recoverable: false,
  },
  {
    id: "bs-7", name: "Eye Injury",
    description: "Worsen this unit's Ballistic Skill characteristic by 1 (e.g. 3+ becomes 4+).",
    statModifiers: { BS: 1 },
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-8", name: "Shaken",
    description: "Worsen this unit's Weapon Skill characteristic by 1 (e.g. 3+ becomes 4+).",
    statModifiers: { WS: 1 },
    recoverable: true,
    recoveryCost: 1,
  },
  {
    id: "bs-9", name: "Twisted by the Warp",
    description: "This unit's invulnerable save (if any) is worsened by 1 (e.g. 4+ becomes 5+).",
    statModifiers: { Inv: 1 },
    recoverable: false,
  },
  {
    id: "bs-10", name: "Marked for Death",
    description: "Enemy units always count as having the Sustained Hits 1 ability when targeting this unit.",
    statModifiers: {},
    specialRule: "Enemies gain Sustained Hits 1 vs this unit",
    recoverable: false,
  },
];

// ── Requisitions ──
// Actions the player can spend Requisition Points (RP) on between battles.
const REQUISITIONS = [
  {
    id: "req-1", name: "Rearm and Resupply",
    cost: 1,
    description: "Remove one Battle Scar from a unit on your Order of Battle that has the Recoverable tag.",
    effect: "Remove one recoverable Battle Scar",
  },
  {
    id: "req-2", name: "Veteran Warriors",
    cost: 1,
    description: "Add a unit to your Order of Battle. The unit starts with 1 XP.",
    effect: "Add unit to Order of Battle with 1 XP",
  },
  {
    id: "req-3", name: "Fresh Recruits",
    cost: 1,
    description: "Remove a unit from your Order of Battle. You may use this to replace a destroyed unit.",
    effect: "Remove unit from Order of Battle",
  },
  {
    id: "req-4", name: "Specialist Reinforcements",
    cost: 2,
    description: "Add a unit to your Order of Battle. That unit starts with XP equal to the Fresh Recruit threshold for the next rank (6 XP).",
    effect: "Add unit with 6 XP (Blooded rank)",
  },
  {
    id: "req-5", name: "Mark of Favour",
    cost: 2,
    description: "One unit on your Order of Battle immediately gains one Battle Honour of your choice, provided its rank allows it.",
    effect: "Immediately grant one Battle Honour",
  },
  {
    id: "req-6", name: "Daemonic Infusion",
    cost: 3,
    description: "One unit on your Order of Battle gains 5 XP and may immediately roll on the Battle Traits table if it has ranked up.",
    effect: "Grant 5 XP to one unit",
  },
];

// ── Crusade Agendas ──
// Goals set before a battle that award XP and CP when completed.
const CRUSADE_AGENDAS = [
  {
    id: "ag-1", name: "Slay the Warlord",
    xpReward: 2,
    cpReward: 1,
    description: "Destroy the enemy WARLORD. If achieved, each unit that participated in that fight gains 2 XP and your crusade earns 1 CP.",
  },
  {
    id: "ag-2", name: "Skull Tally",
    xpReward: 1,
    cpReward: 0,
    description: "For each enemy CHARACTER or MONSTER destroyed by a WORLD EATERS unit this battle, that unit gains 1 XP.",
    factionRestriction: "we",
  },
  {
    id: "ag-3", name: "Dark Rites",
    xpReward: 2,
    cpReward: 1,
    description: "A CSM unit successfully completes 3 or more Dark Pacts in a single battle. If achieved, that unit gains 2 XP and your crusade earns 1 CP.",
    factionRestriction: "csm",
  },
  {
    id: "ag-4", name: "Hold Ground",
    xpReward: 1,
    cpReward: 1,
    description: "Control 3 or more objective markers at the end of your turn. Each unit holding an objective gains 1 XP.",
  },
  {
    id: "ag-5", name: "Blood and Gore",
    xpReward: 1,
    cpReward: 0,
    description: "For each enemy unit destroyed by a melee attack, the unit responsible gains 1 XP (maximum 3 XP per unit per battle).",
  },
  {
    id: "ag-6", name: "Prove Your Worth",
    xpReward: 3,
    cpReward: 0,
    description: "Select one unit before the battle. If that unit destroys at least one enemy unit and survives, it gains 3 XP.",
  },
  {
    id: "ag-7", name: "Seize Territory",
    xpReward: 1,
    cpReward: 2,
    description: "Capture an enemy-held objective marker. If achieved, your crusade earns 2 CP.",
  },
  {
    id: "ag-8", name: "Bitter Rivals",
    xpReward: 2,
    cpReward: 1,
    description: "Destroy the same enemy unit type that caused the most casualties to your forces last battle. If achieved, the destroying unit gains 2 XP.",
  },
  // ── Tyranid-specific Agendas ──
  {
    id: "ag-tyr-1", name: "Hunt and Slay",
    xpReward: 1,
    cpReward: 1,
    biomassReward: 2,
    description: "Your opponent selects up to 5 friendly units as prey. For each prey unit you destroy, earn 1 XP (for the unit that destroyed it) and 1 Biomass Point. At end of battle, earn 1 CP for each 3 Biomass Points earned.",
    factionRestriction: "tyr",
  },
  {
    id: "ag-tyr-2", name: "Infest the Prey World",
    xpReward: 2,
    cpReward: 0,
    biomassReward: 1,
    description: "ENDLESS MULTITUDES units that end the game in your opponent's deployment zone gain 2 XP. Your army also earns 1 Biomass Point for each such unit.",
    factionRestriction: "tyr",
  },
  {
    id: "ag-tyr-3", name: "Tyrannoform the Prey World",
    xpReward: 1,
    cpReward: 0,
    biomassReward: 3,
    description: "TYRANIDS INFANTRY units can perform the Tyrannoform action (1 action, 1 round). Place a Tyrannoform marker. The more markers you place, the more Biomass Points and XP you earn. Markers cannot be destroyed.",
    factionRestriction: "tyr",
  },
];

// ============================================================
// STAT MODIFIER HELPERS
// ============================================================

// Applies all active Battle Honours and Battle Scars modifiers to a unit's base stats,
// returning a new stats object with modified values. Used to drive the live stat display.
// Honours that buff stats are shown in green; scars that debuff are shown in red.
function applyStatModifiers(baseStats, activeHonourIds, activeScarIds) {
  // Clone the base stats — we never mutate the original
  const modified = { ...baseStats };
  const changes = {}; // tracks which keys changed and by how much (for colour coding)

  // Collect all modifiers from active Honours
  activeHonourIds.forEach((id) => {
    const honour = ALL_HONOURS.find((h) => h.id === id);
    if (!honour?.statModifiers) return;
    Object.entries(honour.statModifiers).forEach(([key, delta]) => {
      if (modified[key] !== undefined) {
        // Handle stat values that may be strings like "3+" or '6"'
        const parsed = parseStatValue(modified[key]);
        if (parsed !== null) {
          modified[key] = formatStatValue(parsed + delta, key, modified[key]);
          changes[key] = (changes[key] || 0) + delta;
        }
      }
    });
  });

  // Collect all modifiers from active Battle Scars
  activeScarIds.forEach((id) => {
    const scar = BATTLE_SCARS.find((s) => s.id === id);
    if (!scar?.statModifiers) return;
    Object.entries(scar.statModifiers).forEach(([key, delta]) => {
      if (modified[key] !== undefined) {
        const parsed = parseStatValue(modified[key]);
        if (parsed !== null) {
          modified[key] = formatStatValue(parsed + delta, key, modified[key]);
          changes[key] = (changes[key] || 0) + delta;
        }
      }
    });
  });

  return { modified, changes };
}

// Extracts the numeric part from a stat value string.
// Examples: "3+" → 3, '6"' → 6, 4 → 4, "5+" → 5
function parseStatValue(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  return null;
}

// Re-formats a modified numeric value back to the original string style.
// Examples: 4 with original "3+" → "4+", 7 with original '6"' → '7"'
function formatStatValue(newNum, key, originalValue) {
  if (typeof originalValue === "number") return newNum;
  if (typeof originalValue === "string") {
    if (originalValue.endsWith("+")) return `${newNum}+`;
    if (originalValue.endsWith('"')) return `${newNum}"`;
  }
  return newNum;
}

// ============================================================
// GAME DATA — CHAOS SPACE MARINES (10th Edition)
// ============================================================
const CSM_DATA = {
  id: "csm",
  name: "Chaos Space Marines",
  shortName: "CSM",
  color: "#8b0000",
  accentColor: "#e0c070",
  tagline: "Slaves to Darkness",
  icon: "✠",
  armyRule: {
    name: "Dark Pacts",
    description: "Once per turn, when a unit from your army is selected to shoot or fight, you can make a Dark Pact for that unit. Roll one D6: on a 2+, until the end of the phase that unit's weapons have either Lethal Hits or Sustained Hits 1 (your choice). On a 1, that unit suffers D3 mortal wounds.",
  },
  detachments: [
    { name: "Veterans of the Long War", dpCost: 2, forceDisposition: "Take and Hold", rule: "Focus of Hatred: Select one enemy unit at the start of your Command phase. Until your next Command phase, friendly CSM CORE units targeting that unit get +1 to wound rolls." },
    { name: "Renegade Raiders", dpCost: 3, forceDisposition: "Reconnaissance", rule: "Swift Hunters: Friendly CSM units can re-roll Advance rolls. Units that Advance can still shoot Assault weapons and do not suffer -1 to hit if they also charge." },
    { name: "Creations of Bile", dpCost: 3, forceDisposition: "Purge the Foe", rule: "Grotesque Experiments: At the start of the battle, each non-DAMNED INFANTRY unit gains one bonus: +1 WS, +1 BS, +1 Strength (melee), +1 Toughness, +1 Attack, or +2\" Move." },
    { name: "Soulforged Warpack", dpCost: 2, forceDisposition: "Purge the Foe", rule: "Daemonic Onslaught: Each time a friendly CHAOS VEHICLE or DAEMON unit makes an attack, re-roll a Hit roll of 1." },
  ],
  enhancements: [
    { id: "csm-e1", detachment: "Veterans of the Long War", name: "Blade of the Relentless", points: 20, description: "Bearer's melee weapons gain +1 Strength and +1 Damage." },
    { id: "csm-e2", detachment: "Veterans of the Long War", name: "Mark of the Chosen", points: 15, description: "Bearer gains the Chosen keyword and +1 to all saving throws." },
    { id: "csm-e3", detachment: "Soulforged Warpack", name: "Sigil of Corruption", points: 25, description: "Once per battle, at the start of the Fight phase, all friendly CSM units within 6\" gain +1 Attack until end of phase." },
    { id: "csm-e4", detachment: "Creations of Bile", name: "Warpforged Armour", points: 30, description: "Bearer gains a 4+ invulnerable save." },
    { id: "csm-e5", detachment: "Renegade Raiders", name: "Cursed Fang", points: 10, description: "Improve the AP of one of the bearer's melee weapons by 1. That weapon also has the Precision ability." },
    { id: "csm-e6", detachment: "Renegade Raiders", name: "Shroud of Obfuscation", points: 15, description: "Bearer has the Stealth and Lone Operative abilities." },
  ],
  stratagems: [
    { id: "csm-s1", detachment: "Veterans of the Long War", name: "Hateful Assault", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM unit is chosen to fight. Until the end of the phase, that unit's melee weapons have the Lethal Hits ability." },
    { id: "csm-s2", detachment: "Veterans of the Long War", name: "Malicious Volleys", cost: "1 CP", phase: "Shooting Phase", description: "Use when a CSM INFANTRY unit is chosen to shoot. Until end of phase, add 1 to the Attacks of that unit's bolt weapons." },
    { id: "csm-s3", detachment: "Veterans of the Long War", name: "Veterans of the Long War", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM CORE unit is selected to fight. Until end of phase, add 1 to wound rolls for melee attacks against IMPERIUM units." },
    { id: "csm-s4", detachment: "Soulforged Warpack", name: "Warpfire Baptism", cost: "1 CP", phase: "Shooting Phase", description: "Use when a SORCERER is chosen to shoot. Until end of phase, that unit's ranged weapons gain Devastating Wounds." },
    { id: "csm-s5", detachment: "Renegade Raiders", name: "Death to the False Emperor", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM unit fights. Each unmodified hit roll of 6 scores 1 additional hit against IMPERIUM units." },
    { id: "csm-s6", detachment: "Creations of Bile", name: "Chaos Undivided", cost: "2 CP", phase: "Command Phase", description: "One friendly CSM unit within 12\" of your WARLORD regains D3 lost wounds." },
    { id: "csm-s7", detachment: "Soulforged Warpack", name: "Daemonic Ritual", cost: "1 CP", phase: "Movement Phase", description: "Select a CSM CHARACTER. Until the end of the phase, that model can attempt to summon a DAEMON unit." },
    { id: "csm-s8", detachment: "Creations of Bile", name: "Warp Surge", cost: "2 CP", phase: "Fight Phase", description: "Use when a POSSESSED or GREATER POSSESSED unit is chosen to fight. Add 2 to the Attacks of models in that unit." },
  ],
  marks: [
    { id: "undivided", name: "Undivided", bonus: "No specific bonus — pure Chaos" },
    { id: "khorne", name: "Mark of Khorne", bonus: "+1 Attack in the Fight phase" },
    { id: "tzeentch", name: "Mark of Tzeentch", bonus: "5+ invulnerable save (or improve existing by 1)" },
    { id: "nurgle", name: "Mark of Nurgle", bonus: "+1 Toughness" },
    { id: "slaanesh", name: "Mark of Slaanesh", bonus: "+1\" to Advance and Charge rolls" },
  ],
  units: [
    { id: "csm-abaddon", name: "Abaddon the Despoiler", role: "CHARACTER", points: 310, keywords: ["CHARACTER","INFANTRY","TERMINATOR","EPIC HERO","CHAOS UNDIVIDED","CHAOS","ABADDON THE DESPOILER"], stats: { M: '6"', T: 5, Sv: "2+", W: 9, Ld: "5+", OC: 1, Inv: "4+" }, abilities: [{ name: "Paragon of Hatred (Aura)", description: "While a friendly HERETIC ASTARTES unit is within 6\", each time a model makes an attack, you can re-roll the Hit roll." },{ name: "Lord of the Traitor Legions (Aura)", description: "While a friendly HERETIC ASTARTES unit is within 6\", you can re-roll Leadership and Battle-shock tests for that unit." },{ name: "Dark Destiny", description: "Once per battle, when Abaddon makes a Dark Pact roll with a result of 7+ (two dice), he gains 1 CP instead of suffering mortal wounds." },{ name: "Warmaster", description: "Abaddon must be your WARLORD if included." }], weapons: { ranged: [{ id: "abd-talon", name: "Talon of Horus", range: '24"', attacks: 4, skill: "2+", strength: 5, AP: -2, damage: 1, special: "Sustained Hits 1", points: 0 }], melee: [{ id: "abd-drach", name: "Drach'nyen", attacks: 8, skill: "2+", strength: 14, AP: -4, damage: 3, special: "Devastating Wounds", points: 0 }] } },
    { id: "csm-chaos-lord", name: "Chaos Lord", role: "CHARACTER", points: 75, keywords: ["CHARACTER","INFANTRY","CHAOS LORD","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 5, Ld: "6+", OC: 1 }, abilities: [{ name: "Lord of Chaos", description: "Once per battle round, reduce the CP cost of a Stratagem used on a friendly CSM unit within 6\" by 1." },{ name: "Warlord Trait", description: "If your WARLORD, select one Warlord Trait." }], weapons: { ranged: [{ id: "cl-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },{ id: "cl-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["cl-plasma-pistol"] },{ id: "cl-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0, exclusive: ["cl-plasma-pistol"] }], melee: [{ id: "cl-chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cl-power-fist","cl-daemon-blade"] },{ id: "cl-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cl-chainsword","cl-daemon-blade"] },{ id: "cl-daemon-blade", name: "Daemon Blade", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 2, special: "Anti-IMPERIUM 4+", points: 15, exclusive: ["cl-chainsword","cl-power-fist"] }] } },
    { id: "csm-dark-apostle", name: "Dark Apostle", role: "CHARACTER", points: 65, keywords: ["CHARACTER","INFANTRY","CHAOS","DARK APOSTLE","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "5+", OC: 1 }, abilities: [{ name: "Dark Zealotry", description: "While leading a unit, each time a model makes a melee attack, add 1 to the Wound roll." },{ name: "Demagogue", description: "Once per battle, remove Battle-shock from one HERETIC ASTARTES unit within 12\"." }], weapons: { ranged: [{ id: "da-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "da-crozius", name: "Accursed Crozius", attacks: 5, skill: "3+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "csm-sorcerer", name: "Sorcerer", role: "CHARACTER", points: 80, keywords: ["CHARACTER","INFANTRY","PSYKER","CHAOS","SORCERER","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Psychic Ritual", description: "At the start of your Shooting phase, select one enemy unit within 18\". Roll 3D6: if total exceeds target's Toughness, deal D3 mortal wounds." },{ name: "Warp Finesse", description: "While leading a unit, re-roll one Hit or Wound roll per attack sequence." }], weapons: { ranged: [{ id: "sorc-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "sorc-force", name: "Force Weapon", attacks: 4, skill: "3+", strength: 5, AP: -1, damage: "D3", special: "Psychic", points: 0 }] } },
    { id: "csm-warpsmith", name: "Warpsmith", role: "CHARACTER", points: 75, keywords: ["CHARACTER","INFANTRY","CHAOS","WARPSMITH","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Master of Machines", description: "At the end of your Movement phase, repair one friendly VEHICLE within 3\". That model regains D3 lost wounds." },{ name: "Warp Curse", description: "At the start of the Shooting phase, select one enemy VEHICLE within 18\". Worsen that model's Save by 1 until end of phase." }], weapons: { ranged: [{ id: "ws-flamer", name: "Mechatendril Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 0 }], melee: [{ id: "ws-axe", name: "Hellforged Axe", attacks: 4, skill: "3+", strength: 6, AP: -2, damage: 2, special: "—", points: 0 }] } },
    { id: "csm-master-executions", name: "Master of Executions", role: "CHARACTER", points: 80, keywords: ["CHARACTER","INFANTRY","CHAOS","MASTER OF EXECUTIONS","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Cruel Hunter", description: "While leading a unit, each time that unit Piles In or Consolidates, each model can move up to 6\" instead of 3\"." },{ name: "Decapitating Strike", description: "Each unmodified Hit roll of 6 causes 2 additional mortal wounds." }], weapons: { ranged: [{ id: "me-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "me-axe", name: "Axe of Dismemberment", attacks: 5, skill: "3+", strength: 8, AP: -3, damage: 2, special: "Devastating Wounds", points: 0 }] } },
    { id: "csm-daemon-prince", name: "Heretic Astartes Daemon Prince", role: "CHARACTER", points: 155, keywords: ["CHARACTER","MONSTER","CHAOS","DAEMON","DAEMON PRINCE","CHAOS SPACE MARINES"], stats: { M: '10"', T: 9, Sv: "3+", W: 9, Ld: "6+", OC: 3, Inv: "4+" }, abilities: [{ name: "Daemonic Terror", description: "Once per battle, at the start of the Fight phase, all enemy units within 6\" must take a Battle-shock test." },{ name: "Warp-touched Form", description: "Each time this model makes a charge move, add 1 to the Attacks of its melee weapons until end of turn." },{ name: "Deadly Demise D3", description: "When destroyed, roll D6 for each unit within 6\": on 4+, D3 mortal wounds." }], weapons: { ranged: [{ id: "dp-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "dp-hellforged-strike", name: "Hellforged Weapons – strike", attacks: 6, skill: "3+", strength: 7, AP: -2, damage: 3, special: "—", points: 0, exclusive: ["dp-talons"] },{ id: "dp-hellforged-sweep", name: "Hellforged Weapons – sweep", attacks: 12, skill: "3+", strength: 5, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["dp-talons"] },{ id: "dp-talons", name: "Paired Malefic Talons", attacks: 7, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Twin-linked", points: 10, exclusive: ["dp-hellforged-strike","dp-hellforged-sweep"] }] } },
    { id: "csm-legionaries", name: "Legionaries", role: "BATTLELINE", points: 80, baseSize: 5, keywords: ["INFANTRY","CORE","CHAOS","LEGIONARIES","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Death to the False Emperor", description: "Each time a model makes a melee attack against an IMPERIUM unit, on an unmodified Hit roll of 6, score 1 additional hit." },{ name: "Hateful Assault", description: "If this unit made a charge move this turn, add 1 to Attacks of melee weapons." }], weapons: { ranged: [{ id: "leg-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },{ id: "leg-plasma", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["leg-melta","leg-flamer","leg-boltgun"], limit: 2 },{ id: "leg-melta", name: "Meltagun", range: '12"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["leg-plasma","leg-flamer","leg-boltgun"], limit: 2 },{ id: "leg-flamer", name: "Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 5, exclusive: ["leg-plasma","leg-melta","leg-boltgun"], limit: 2 }], melee: [{ id: "leg-chainsword", name: "Chainsword", attacks: 3, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "csm-cultist-mob", name: "Cultist Mob", role: "BATTLELINE", points: 50, baseSize: 10, keywords: ["INFANTRY","CORE","CHAOS","CULTIST MOB","CHAOS SPACE MARINES"], stats: { M: '6"', T: 3, Sv: "6+", W: 1, Ld: "7+", OC: 2 }, abilities: [{ name: "Fanatical Devotion", description: "Each time a model would lose a wound, roll 1D6. On a 6+, that wound is not lost." },{ name: "Tide of Traitors", description: "Once per battle, if this unit has been destroyed, set it back up with its starting number of models more than 9\" from all enemy units." }], weapons: { ranged: [{ id: "cult-autogun", name: "Autogun", range: '24"', attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 }], melee: [{ id: "cult-knife", name: "Brutal Assault Weapon", attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "csm-chosen", name: "Chosen", role: "ELITE", points: 150, baseSize: 5, keywords: ["INFANTRY","CORE","CHAOS","CHOSEN","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Chosen Warriors", description: "Each model in this unit can be equipped with a different weapon loadout." },{ name: "Aura of Dark Glory", description: "Friendly CSM CORE units within 6\" gain +1 to Leadership." }], weapons: { ranged: [{ id: "cho-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "cho-chainsword", name: "Chainsword", attacks: 4, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cho-power-fist","cho-lightning-claws"] },{ id: "cho-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cho-chainsword","cho-lightning-claws"], limit: 2 },{ id: "cho-lightning-claws", name: "Lightning Claws (pair)", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 10, exclusive: ["cho-chainsword","cho-power-fist"], limit: 2 }] } },
    { id: "csm-terminators", name: "Chaos Terminator Squad", role: "ELITE", points: 175, baseSize: 5, keywords: ["INFANTRY","CORE","TERMINATOR","CHAOS","CHAOS SPACE MARINES"], stats: { M: '5"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." },{ name: "Terminator Resilience", description: "Subtract 1 from Damage of attacks allocated to this unit (min 1)." }], weapons: { ranged: [{ id: "term-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },{ id: "term-combi-melta", name: "Combi-melta", range: '24"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2, Rapid Fire 1", points: 10, exclusive: ["term-combi"], limit: 2 }], melee: [{ id: "term-chainfist", name: "Chainfist", attacks: 3, skill: "4+", strength: 8, AP: -4, damage: 2, special: "Anti-VEHICLE 4+", points: 0, exclusive: ["term-lightning-claws","term-power-fist"] },{ id: "term-lightning-claws", name: "Lightning Claws (pair)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0, exclusive: ["term-chainfist","term-power-fist"] },{ id: "term-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["term-chainfist","term-lightning-claws"] }] } },
    { id: "csm-possessed", name: "Possessed", role: "ELITE", points: 130, baseSize: 5, keywords: ["INFANTRY","CORE","CHAOS","DAEMON","POSSESSED","CHAOS SPACE MARINES"], stats: { M: '6"', T: 5, Sv: "3+", W: 3, Ld: "6+", OC: 2, Inv: "5+" }, abilities: [{ name: "Daemonic Might", description: "Add 1 to the Attacks of melee weapons equipped by models in this unit." },{ name: "Warp-touched Resilience", description: "Each time a model would lose a wound, roll 1D6. On a 5+, that wound is not lost." }], weapons: { ranged: [], melee: [{ id: "poss-mutations", name: "Hideous Mutations", attacks: 4, skill: "3+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "csm-obliterators", name: "Obliterators", role: "ELITE", points: 140, baseSize: 2, keywords: ["INFANTRY","CHAOS","DAEMON","OBLITERATORS","CHAOS SPACE MARINES"], stats: { M: '5"', T: 6, Sv: "2+", W: 4, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Fleshmetal Guns", description: "Each time this unit is chosen to shoot, select one Fleshmetal Guns weapon profile to use." },{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." }], weapons: { ranged: [{ id: "obl-heavy", name: "Fleshmetal Guns – heavy", range: '24"', attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 3, special: "Heavy", points: 0 },{ id: "obl-assault", name: "Fleshmetal Guns – assault", range: '12"', attacks: 4, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0 },{ id: "obl-melta", name: "Fleshmetal Guns – melta", range: '12"', attacks: 2, skill: "4+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0 }], melee: [{ id: "obl-fists", name: "Crushing Fists", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 }] } },
    { id: "csm-havocs", name: "Havocs", role: "HEAVY", points: 115, baseSize: 5, keywords: ["INFANTRY","CORE","CHAOS","HAVOCS","CHAOS SPACE MARINES"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Malicious Volleys", description: "Add 1 to the Attacks of bolt weapons equipped by models in this unit." },{ name: "Fire Discipline", description: "No penalty to Hit rolls for moving and shooting Heavy weapons." }], weapons: { ranged: [{ id: "hav-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },{ id: "hav-lascannon", name: "Lascannon", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["hav-boltgun","hav-autocannon","hav-heavy-bolter","hav-missile"], limit: 4 },{ id: "hav-autocannon", name: "Autocannon", range: '48"', attacks: 2, skill: "3+", strength: 9, AP: -1, damage: 3, special: "Heavy", points: 10, exclusive: ["hav-boltgun","hav-lascannon","hav-heavy-bolter","hav-missile"], limit: 4 },{ id: "hav-heavy-bolter", name: "Heavy Bolter", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 5, exclusive: ["hav-boltgun","hav-lascannon","hav-autocannon","hav-missile"], limit: 4 },{ id: "hav-missile", name: "Missile Launcher", range: '48"', attacks: 1, skill: "3+", strength: 10, AP: -2, damage: "D6", special: "Heavy, Indirect Fire", points: 15, exclusive: ["hav-boltgun","hav-lascannon","hav-autocannon","hav-heavy-bolter"], limit: 4 }], melee: [{ id: "hav-chainsword", name: "Chainsword", attacks: 2, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "csm-raptors", name: "Raptors", role: "FAST ATTACK", points: 80, baseSize: 5, keywords: ["INFANTRY","CORE","JUMP PACK","CHAOS","RAPTORS","CHAOS SPACE MARINES"], stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1 }, abilities: [{ name: "Jump Pack Assault", description: "This unit can be placed into Strategic Reserves for free and can charge the turn it arrives." },{ name: "Swift Raptors", description: "Can charge in the same turn it arrived from Strategic Reserves." }], weapons: { ranged: [{ id: "rapt-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "rapt-plasma", name: "Plasma Pistols (x2)", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 8, exclusive: ["rapt-bolt-pistol"] }], melee: [{ id: "rapt-chainsword", name: "Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "csm-warp-talons", name: "Warp Talons", role: "FAST ATTACK", points: 95, baseSize: 5, keywords: ["INFANTRY","CORE","JUMP PACK","DAEMON","CHAOS","WARP TALONS","CHAOS SPACE MARINES"], stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1, Inv: "5+" }, abilities: [{ name: "Warp Fracture", description: "The first time this unit arrives from Deep Strike, one enemy unit within 9\" cannot use Overwatch or Set to Defend until end of turn." },{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." }], weapons: { ranged: [], melee: [{ id: "wt-warp-talons", name: "Warp Talons", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0 }] } },
    { id: "csm-helbrute", name: "Helbrute", role: "VEHICLE", points: 145, keywords: ["VEHICLE","WALKER","CHAOS","HELBRUTE","CHAOS SPACE MARINES"], stats: { M: '8"', T: 9, Sv: "3+", W: 8, Ld: "6+", OC: 3 }, abilities: [{ name: "Crazed", description: "Each time selected to fight, roll D6. On a 1, suffer 1 mortal wound. On a 5+, add 1 to Attacks this phase." },{ name: "Enraged Desperation", description: "While below half starting Wounds, add 2 to Attacks characteristic." }], weapons: { ranged: [{ id: "hb-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0, exclusive: ["hb-twin-lascannon"] },{ id: "hb-twin-lascannon", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 10, exclusive: ["hb-multi-melta"] }], melee: [{ id: "hb-fist", name: "Helbrute Fist", attacks: 4, skill: "4+", strength: 12, AP: -3, damage: 3, special: "—", points: 0, exclusive: ["hb-hammer"] },{ id: "hb-hammer", name: "Helbrute Power Scourge", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 5, exclusive: ["hb-fist"] }] } },
    { id: "csm-predator-annihilator", name: "Chaos Predator Annihilator", role: "VEHICLE", points: 135, keywords: ["VEHICLE","CHAOS","PREDATOR ANNIHILATOR","SMOKE","CHAOS SPACE MARINES"], stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 }, abilities: [{ name: "Smoke", description: "Once per game, use Smoke Launchers. Until start of next turn, -1 to ranged Hit rolls against this model." },{ name: "Grinding Advance", description: "If this model did not move this turn, add 1 to its ranged Hit rolls." }], weapons: { ranged: [{ id: "pred-ann-twin-las", name: "Twin Lascannon (turret)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },{ id: "pred-ann-hb-sponson", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },{ id: "pred-ann-las-sponson", name: "Lascannon (sponson)", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["pred-ann-hb-sponson"], limit: 2 }], melee: [{ id: "pred-ann-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "csm-forgefiend", name: "Forgefiend", role: "VEHICLE", points: 185, keywords: ["VEHICLE","WALKER","DAEMON","CHAOS","FORGEFIEND","CHAOS SPACE MARINES"], stats: { M: '9"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" }, abilities: [{ name: "Daemonic", description: "5+ invulnerable save." },{ name: "Infernal Relentlessness", description: "Re-roll Hit rolls of 1 against the closest eligible enemy unit." },{ name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." }], weapons: { ranged: [{ id: "ff-ecto", name: "Ectoplasma Cannon (x2)", range: '36"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: "D3+1", special: "Blast, Rapid Fire 1, Hazardous", points: 0, exclusive: ["ff-hades"] },{ id: "ff-hades", name: "Hades Autocannon (x2)", range: '36"', attacks: 6, skill: "4+", strength: 9, AP: -1, damage: 3, special: "Rapid Fire 3", points: 0, exclusive: ["ff-ecto"] }], melee: [{ id: "ff-claws", name: "Daemonic Jaws", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 }] } },
    { id: "csm-maulerfiend", name: "Maulerfiend", role: "VEHICLE", points: 150, keywords: ["VEHICLE","WALKER","DAEMON","CHAOS","MAULERFIEND","CHAOS SPACE MARINES"], stats: { M: '10"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" }, abilities: [{ name: "Daemonic", description: "5+ invulnerable save." },{ name: "Scent of Blood", description: "+1 to charge rolls (+2 if target below half strength)." },{ name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." }], weapons: { ranged: [{ id: "mf-lasher", name: "Lasher Tendrils", range: '6"', attacks: 4, skill: "Auto", strength: 6, AP: -1, damage: 1, special: "Torrent", points: 0 }], melee: [{ id: "mf-claws", name: "Power Scourges", attacks: 6, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["mf-magma"] },{ id: "mf-magma", name: "Magma Cutters (pair)", attacks: 4, skill: "3+", strength: 10, AP: -4, damage: "D6", special: "Anti-VEHICLE 4+", points: 10, exclusive: ["mf-claws"] }] } },
    { id: "csm-rhino", name: "Chaos Rhino", role: "DEDICATED TRANSPORT", points: 75, keywords: ["VEHICLE","TRANSPORT","DEDICATED TRANSPORT","SMOKE","CHAOS","CHAOS SPACE MARINES"], stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to ranged Hit rolls against this model until start of next turn." },{ name: "Self-repair", description: "Regains 1 lost wound at the start of your Command phase." },{ name: "Transport (10)", description: "Transports 10 HERETIC ASTARTES INFANTRY (not JUMP PACK or TERMINATOR)." }], weapons: { ranged: [{ id: "rh-combi-bolter", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "rh-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 }] } },
  ],
};

// ============================================================
// GAME DATA — WORLD EATERS (10th Edition)
// ============================================================
const WE_DATA = {
  id: "we",
  name: "World Eaters",
  shortName: "WE",
  color: "#8b1a00",
  accentColor: "#ff6030",
  tagline: "Blood for the Blood God!",
  icon: "🩸",
  armyRule: {
    name: "Blessings of Khorne",
    description: "At the start of each battle round, roll 8D6. Spend matching dice to activate up to 2 Blessings of Khorne until end of battle round. Available Blessings: Rage-fuelled Invigoration (any pair → +2\" Move), Wrathful Onslaught (double 4+ → Lethal Hits melee), Merciless Butchers (double 5+ → Sustained Hits 1 melee), Savage Momentum (double 6+ → Pile In/Consolidate 6\"), Decapitating Strikes (triple 3+ → Devastating Wounds vs Infantry), Blood-mad Rampage (triple 4+ → re-roll Charge rolls).",
  },
  detachments: [
    { name: "Berzerker Warband", dpCost: 2, forceDisposition: "Purge the Foe", rule: "Relentless Rage: Add 1\" to Pile In and Consolidate moves. Blood Tithe: Each time an enemy model is destroyed by a WE melee attack, add 1 to your Blood Tithe total." },
    { name: "Cult of Blood", dpCost: 2, forceDisposition: "Purge the Foe", rule: "Frenzied Charge: Add D3\" to Charge rolls. Rush to the Fray: Friendly WE units within 6\" of an objective gain +1 to Charge rolls." },
    { name: "Goretrack Onslaught", dpCost: 1, forceDisposition: "Disruption", rule: "Unstoppable Advance: Friendly WE VEHICLE units can move through terrain features that are not buildings." },
  ],
  enhancements: [
    { id: "we-e1", detachment: "Berzerker Warband", name: "Helm of Brazen Ire", points: 20, description: "Bearer has a 4+ invulnerable save. Each time selected to fight, can fight twice (must target different units on second fight)." },
    { id: "we-e2", detachment: "Berzerker Warband", name: "Berzerker Glaive", points: 15, description: "Bearer's melee weapons have Devastating Wounds. Add 1 to bearer's Attacks." },
    { id: "we-e3", detachment: "Cult of Blood", name: "Favoured of Khorne", points: 25, description: "Once per battle, at the start of the Fight phase, add 3 to the Attacks of all bearer's melee weapons until end of phase." },
    { id: "we-e4", detachment: "Cult of Blood", name: "Blood-forged Armour", points: 20, description: "Reduce all damage dealt to bearer by 1 (min 1). Bearer ignores penalty for moving and shooting Heavy weapons." },
    { id: "we-e5", detachment: "Goretrack Onslaught", name: "Skull Helm of Khorne", points: 30, description: "Enemy units within 6\" subtract 2 from their Leadership. Enemy units that fail Battle-shock tests within 6\" suffer D3 mortal wounds." },
  ],
  stratagems: [
    { id: "we-s1", detachment: "Berzerker Warband", name: "Skulls for the Skull Throne!", cost: "1 CP", phase: "Fight Phase", description: "Use when a WE unit is chosen to fight. Each unmodified Hit roll of 6 scores 1 additional hit." },
    { id: "we-s2", detachment: "Berzerker Warband", name: "Frenzied Resilience", cost: "2 CP", phase: "Any Phase", description: "When a WE INFANTRY unit would lose wounds, until end of phase models have a 5+ Feel No Pain." },
    { id: "we-s3", detachment: "Cult of Blood", name: "Hack and Slash", cost: "1 CP", phase: "Fight Phase", description: "Each time a model destroys an enemy model, it can immediately make 1 additional attack with the same weapon." },
    { id: "we-s4", detachment: "Cult of Blood", name: "Blood Offering", cost: "1 CP", phase: "Command Phase", description: "Select one friendly WE unit that has destroyed at least one enemy model. It regains D3 lost wounds and ignores Battle-shock until your next Command phase." },
    { id: "we-s5", detachment: "Goretrack Onslaught", name: "Daemontide", cost: "1 CP", phase: "Movement Phase", description: "Select one WE DAEMON unit. That unit can immediately make a Normal move of up to 6\"." },
    { id: "we-s6", detachment: "Goretrack Onslaught", name: "A Worthy Skull", cost: "1 CP", phase: "Fight Phase", description: "Add 2 to the Attacks of melee weapons equipped by a WE CHARACTER this phase." },
  ],
  marks: [],
  units: [
    { id: "we-angron", name: "Angron", role: "CHARACTER", points: 340, keywords: ["MONSTER","CHARACTER","FLY","EPIC HERO","CHAOS","KHORNE","DAEMON","PRIMARCH","ANGRON"], stats: { M: '14"', T: 11, Sv: "2+", W: 16, Ld: "5+", OC: 6, Inv: "4+" }, abilities: [{ name: "Supreme Commander", description: "Must be your WARLORD if included." },{ name: "The Blood God's Favour", description: "Re-roll up to six D6 when making a Blessings of Khorne roll." },{ name: "Overwhelming Wrath (Aura)", description: "Enemy units within 6\" that Fall Back must take a Leadership test or Remain Stationary." },{ name: "Driven by Ultimate Rage (Aura)", description: "Friendly WE units within 6\" ignore modifiers to Move, Advance, Charge, and Weapon Skill." },{ name: "Reborn in Blood", description: "If destroyed, spend a triple 6 from Blessings to resurrect with 8 wounds." },{ name: "Deadly Demise D6", description: "When destroyed, D6 for each unit within 6\": 4+ = D6 mortal wounds." }], weapons: { ranged: [], melee: [{ id: "ang-strike", name: "Samni'arius and Spinegrinder – strike", attacks: 8, skill: "2+", strength: 14, AP: -3, damage: "D6+2", special: "Devastating Wounds", points: 0, exclusive: ["ang-sweep"] },{ id: "ang-sweep", name: "Samni'arius and Spinegrinder – sweep", attacks: 16, skill: "2+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0, exclusive: ["ang-strike"] }] } },
    { id: "we-kharn", name: "Khârn the Betrayer", role: "CHARACTER", points: 85, keywords: ["CHARACTER","INFANTRY","EPIC HERO","CHAOS","KHORNE","KHARN THE BETRAYER"], stats: { M: '8"', T: 4, Sv: "3+", W: 5, Ld: "5+", OC: 1, Inv: "4+" }, abilities: [{ name: "The Betrayer", description: "After fighting, roll D6. On a 1, must fight again targeting a friendly unit if possible." },{ name: "Slaughter Incarnate", description: "Add 1 to Hit rolls. Unmodified 6s score 1 additional hit." },{ name: "Direct the Slaughter", description: "Once per battle round, reduce the CP cost of a Stratagem for a WE unit within 12\" by 1." }], weapons: { ranged: [{ id: "kh-plasma", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 0 }], melee: [{ id: "kh-gorechild", name: "Gorechild", attacks: 8, skill: "2+", strength: 6, AP: -2, damage: 2, special: "Anti-INFANTRY 4+, Sustained Hits 1", points: 0 }] } },
    { id: "we-lord-juggernaut", name: "Lord on Juggernaut", role: "CHARACTER", points: 135, keywords: ["CHARACTER","MOUNTED","CHAOS","KHORNE","LORD ON JUGGERNAUT"], stats: { M: '10"', T: 6, Sv: "3+", W: 7, Ld: "6+", OC: 2, Inv: "4+" }, abilities: [{ name: "Direct the Slaughter", description: "Once per battle round, reduce the CP cost of a Stratagem for a WE unit within 12\" by 1." },{ name: "Devastating Assault", description: "After a Charge move, melee weapons gain Devastating Wounds until end of turn." },{ name: "Lord of Murder", description: "While within 3\" of WE INFANTRY, has Lone Operative." }], weapons: { ranged: [{ id: "lj-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "lj-axe", name: "Axe of Khorne", attacks: 6, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Anti-INFANTRY 4+", points: 0, exclusive: ["lj-fist"] },{ id: "lj-fist", name: "Power Fist", attacks: 5, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["lj-axe"] },{ id: "lj-juggernaut", name: "Juggernaut Bladed Horn", attacks: 3, skill: "3+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "we-lord-invocatus", name: "Lord Invocatus", role: "CHARACTER", points: 155, keywords: ["CHARACTER","MOUNTED","EPIC HERO","CHAOS","KHORNE","LORD INVOCATUS"], stats: { M: '14"', T: 6, Sv: "3+", W: 7, Ld: "6+", OC: 2, Inv: "4+" }, abilities: [{ name: "Direct the Slaughter", description: "Once per battle round, reduce CP cost of a Stratagem for a WE unit within 12\" by 1." },{ name: "Filled with Fury", description: "Each time Lord Invocatus makes a Charge move, one enemy unit moved within 1\" of suffers D3+1 mortal wounds." }], weapons: { ranged: [{ id: "li-plasma", name: "Twin Plasma Pistols", range: '12"', attacks: 2, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 0 }], melee: [{ id: "li-krak", name: "Krak'arth", attacks: 7, skill: "2+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0 },{ id: "li-juggernaut", name: "Juggernaut Bladed Horn", attacks: 4, skill: "3+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "we-master-executions", name: "Master of Executions", role: "CHARACTER", points: 80, keywords: ["CHARACTER","INFANTRY","CHAOS","KHORNE","MASTER OF EXECUTIONS"], stats: { M: '8"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Cruel Hunter", description: "While leading a unit, each time that unit Piles In or Consolidates, each model can move up to 6\"." },{ name: "Decapitating Strike", description: "Each unmodified Hit roll of 6 causes 2 additional mortal wounds." }], weapons: { ranged: [{ id: "weme-bolt", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "weme-axe", name: "Axe of Dismemberment", attacks: 5, skill: "3+", strength: 8, AP: -3, damage: 2, special: "Devastating Wounds", points: 0 }] } },
    { id: "we-daemon-prince", name: "Daemon Prince of Khorne", role: "CHARACTER", points: 200, keywords: ["CHARACTER","MONSTER","CHAOS","KHORNE","DAEMON","DAEMON PRINCE"], stats: { M: '10"', T: 10, Sv: "2+", W: 10, Ld: "6+", OC: 3, Inv: "4+" }, abilities: [{ name: "Lord of Murder", description: "While within 3\" of WE INFANTRY, has Lone Operative." },{ name: "Devastating Assault", description: "After a Charge move, melee weapons gain Devastating Wounds until end of turn." },{ name: "Direct the Slaughter", description: "Once per battle round, reduce CP cost of a Stratagem for a WE unit within 12\" by 1." },{ name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." }], weapons: { ranged: [{ id: "wedp-cannon", name: "Infernal Cannon", range: '24"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Rapid Fire 1", points: 0 }], melee: [{ id: "wedp-strike", name: "Hellforged Weapons – strike", attacks: 8, skill: "2+", strength: 8, AP: -2, damage: 3, special: "—", points: 0, exclusive: ["wedp-sweep"] },{ id: "wedp-sweep", name: "Hellforged Weapons – sweep", attacks: 16, skill: "2+", strength: 6, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["wedp-strike"] }] } },
    { id: "we-slaughterbound", name: "Slaughterbound", role: "CHARACTER", points: 100, keywords: ["CHARACTER","INFANTRY","CHAOS","KHORNE","SLAUGHTERBOUND"], stats: { M: '8"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 1, Inv: "5+" }, abilities: [{ name: "Bloodbound Champion", description: "While leading a unit, re-roll Hit rolls of 1 for models in that unit." },{ name: "Skull Taker", description: "Each time this model destroys an enemy CHARACTER, regain D3 lost wounds." }], weapons: { ranged: [], melee: [{ id: "sb-lacerator", name: "Lacerator and Daemonic Claw", attacks: 6, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Twin-linked", points: 0 }] } },
    { id: "we-berzerkers", name: "Khorne Berzerkers", role: "BATTLELINE", points: 180, baseSize: 10, keywords: ["INFANTRY","CORE","CHAOS","KHORNE","KHORNE BERZERKERS"], stats: { M: '8"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Bane of Cowards", description: "Enemy units (excluding MONSTERS and VEHICLES) within Engagement Range that Fall Back must take Desperate Escape tests." },{ name: "Chainaxe Frenzy", description: "Add 1 to the Attacks of melee weapons if this unit made a charge move this turn." }], weapons: { ranged: [{ id: "bzk-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "bzk-chainblade", name: "Chainblade", attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 1, special: "—", points: 0 },{ id: "bzk-eviscerator", name: "Khornate Eviscerator (x2)", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "Devastating Wounds", points: 5, limit: 2 }] } },
    { id: "we-jakhals", name: "Jakhals", role: "BATTLELINE", points: 70, baseSize: 10, keywords: ["INFANTRY","CORE","CHAOS","KHORNE","JAKHALS"], stats: { M: '8"', T: 4, Sv: "5+", W: 1, Ld: "7+", OC: 2 }, abilities: [{ name: "Khorne's Hounds", description: "Add 1 to Hit rolls when this unit made a charge move this turn." },{ name: "Frenzied Pack", description: "When destroyed, roll D6. On 4+, set back up with full model count more than 9\" from all enemy units." }], weapons: { ranged: [{ id: "jak-pistol", name: "Autopistol", range: '12"', attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "jak-blades", name: "Jakhal Blades", attacks: 2, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },{ id: "jak-mancleaver", name: "Mancleaver (Pack Leader)", attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "—", points: 0, limit: 1 }] } },
    { id: "we-eightbound", name: "Eightbound", role: "ELITE", points: 140, baseSize: 3, keywords: ["INFANTRY","CHAOS","KHORNE","DAEMON","EIGHTBOUND"], stats: { M: '8"', T: 5, Sv: "3+", W: 4, Ld: "6+", OC: 2, Inv: "4+" }, abilities: [{ name: "Bound by Eight", description: "Each time a model would lose a wound, roll D6. On 4+, that wound is not lost." },{ name: "Eightbound Rage", description: "Add 1 to the Attacks of melee weapons." }], weapons: { ranged: [], melee: [{ id: "eb-twinclaws", name: "Eightbound Eviscerators", attacks: 5, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0 }] } },
    { id: "we-exalted-eightbound", name: "Exalted Eightbound", role: "ELITE", points: 180, baseSize: 3, keywords: ["INFANTRY","CHAOS","KHORNE","DAEMON","EXALTED EIGHTBOUND"], stats: { M: '8"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 2, Inv: "4+" }, abilities: [{ name: "Exalted Fury", description: "Each unmodified Hit roll of 6 scores 1 additional hit." },{ name: "Bound by Eight", description: "Each time a model would lose a wound, roll D6. On 4+, that wound is not lost." }], weapons: { ranged: [], melee: [{ id: "xeb-claws-strike", name: "Exalted Eviscerators – strike", attacks: 4, skill: "2+", strength: 9, AP: -3, damage: 3, special: "Devastating Wounds", points: 0, exclusive: ["xeb-claws-sweep"] },{ id: "xeb-claws-sweep", name: "Exalted Eviscerators – sweep", attacks: 8, skill: "2+", strength: 6, AP: -2, damage: 1, special: "—", points: 0, exclusive: ["xeb-claws-strike"] }] } },
    { id: "we-terminators", name: "World Eaters Chaos Terminators", role: "ELITE", points: 190, baseSize: 5, keywords: ["INFANTRY","TERMINATOR","CHAOS","KHORNE","CHAOS TERMINATORS"], stats: { M: '7"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." },{ name: "Terminator Resilience", description: "Subtract 1 from Damage of attacks allocated to this unit (min 1)." },{ name: "Bloodthirsty Rampage", description: "Add 1 to Attacks of melee weapons when this unit makes a charge move." }], weapons: { ranged: [{ id: "wet-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "wet-chainfist", name: "Chainfist", attacks: 3, skill: "4+", strength: 8, AP: -4, damage: 2, special: "Anti-VEHICLE 4+", points: 0, exclusive: ["wet-lightning-claws","wet-power-fist"] },{ id: "wet-lightning-claws", name: "Lightning Claws (pair)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0, exclusive: ["wet-chainfist","wet-power-fist"] },{ id: "wet-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["wet-chainfist","wet-lightning-claws"] }] } },
    { id: "we-helbrute", name: "World Eaters Helbrute", role: "VEHICLE", points: 150, keywords: ["VEHICLE","WALKER","CHAOS","KHORNE","HELBRUTE"], stats: { M: '9"', T: 9, Sv: "3+", W: 8, Ld: "6+", OC: 3 }, abilities: [{ name: "Crazed", description: "Each time selected to fight, roll D6. On 5+, add 1 to Attacks this phase." },{ name: "Khorne's Fury", description: "After a charge move, melee weapons gain Devastating Wounds until end of turn." }], weapons: { ranged: [{ id: "wehb-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0, exclusive: ["wehb-twin-las"] },{ id: "wehb-twin-las", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 10, exclusive: ["wehb-multi-melta"] }], melee: [{ id: "wehb-fist", name: "Helbrute Fist", attacks: 5, skill: "4+", strength: 12, AP: -3, damage: 3, special: "—", points: 0 }] } },
    { id: "we-forgefiend", name: "World Eaters Forgefiend", role: "VEHICLE", points: 190, keywords: ["VEHICLE","WALKER","DAEMON","CHAOS","KHORNE","FORGEFIEND"], stats: { M: '9"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" }, abilities: [{ name: "Daemonic", description: "5+ invulnerable save." },{ name: "Infernal Relentlessness", description: "Re-roll Hit rolls of 1 against the closest eligible enemy unit." },{ name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." }], weapons: { ranged: [{ id: "weff-hades", name: "Hades Autocannon (x2)", range: '36"', attacks: 6, skill: "4+", strength: 9, AP: -1, damage: 3, special: "Rapid Fire 3", points: 0, exclusive: ["weff-ecto"] },{ id: "weff-ecto", name: "Ectoplasma Cannon (x2)", range: '36"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: "D3+1", special: "Blast, Rapid Fire 1, Hazardous", points: 0, exclusive: ["weff-hades"] }], melee: [{ id: "weff-claws", name: "Daemonic Jaws", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 }] } },
    { id: "we-maulerfiend", name: "World Eaters Maulerfiend", role: "VEHICLE", points: 150, keywords: ["VEHICLE","WALKER","DAEMON","CHAOS","KHORNE","MAULERFIEND"], stats: { M: '10"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" }, abilities: [{ name: "Daemonic", description: "5+ invulnerable save." },{ name: "Savage Exaltation", description: "+1 to Hit and Wound against targets below starting strength." },{ name: "Scent of Blood", description: "+1 to charge rolls (+2 if target below half strength)." }], weapons: { ranged: [{ id: "wemf-lasher", name: "Lasher Tendrils", range: '6"', attacks: 4, skill: "Auto", strength: 6, AP: -1, damage: 1, special: "Torrent", points: 0 }], melee: [{ id: "wemf-scourges", name: "Power Scourges", attacks: 7, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["wemf-magma"] },{ id: "wemf-magma", name: "Magma Cutters (pair)", attacks: 5, skill: "3+", strength: 10, AP: -4, damage: "D6", special: "Anti-VEHICLE 4+", points: 10, exclusive: ["wemf-scourges"] }] } },
    { id: "we-lord-of-skulls", name: "Khorne Lord of Skulls", role: "VEHICLE", points: 480, keywords: ["VEHICLE","TITANIC","WALKER","DAEMON","CHAOS","KHORNE","LORD OF SKULLS"], stats: { M: '10"', T: 16, Sv: "2+", W: 26, Ld: "6+", OC: 8, Inv: "4+" }, abilities: [{ name: "Towering", description: "Can be seen and target units over terrain. Cannot benefit from cover." },{ name: "Daemonic", description: "4+ invulnerable save." },{ name: "Deadly Demise D6", description: "When destroyed, D6 for each unit within 6\": 4+ = D6 mortal wounds." }], weapons: { ranged: [{ id: "los-cannon", name: "Skull Cannon", range: '60"', attacks: 4, skill: "3+", strength: 14, AP: -3, damage: "D6+2", special: "Heavy, Devastating Wounds", points: 0 },{ id: "los-hades", name: "Hades Gatling Cannon", range: '36"', attacks: 12, skill: "3+", strength: 8, AP: -2, damage: 2, special: "Rapid Fire 6", points: 0 }], melee: [{ id: "los-axe-strike", name: "Titanic Axe – strike", attacks: 6, skill: "3+", strength: 20, AP: -4, damage: "D6+4", special: "Devastating Wounds", points: 0, exclusive: ["los-axe-sweep"] },{ id: "los-axe-sweep", name: "Titanic Axe – sweep", attacks: 12, skill: "3+", strength: 12, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["los-axe-strike"] }] } },
    { id: "we-predator-annihilator", name: "WE Predator Annihilator", role: "VEHICLE", points: 135, keywords: ["VEHICLE","CHAOS","KHORNE","PREDATOR ANNIHILATOR","SMOKE"], stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Meet Any Challenge", description: "When an opponent ends a move within 9\", you can immediately disembark units inside." }], weapons: { ranged: [{ id: "wepa-twin-las", name: "Twin Lascannon (turret)", range: '48"', attacks: 2, skill: "4+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked, Rapid Fire 2", points: 0 },{ id: "wepa-hb-sponson", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 }], melee: [{ id: "wepa-tracks", name: "Armoured Tracks", attacks: 4, skill: "4+", strength: 7, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "we-rhino", name: "World Eaters Chaos Rhino", role: "DEDICATED TRANSPORT", points: 75, keywords: ["VEHICLE","TRANSPORT","DEDICATED TRANSPORT","SMOKE","CHAOS","KHORNE","RHINO"], stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Meet Any Challenge", description: "When an opponent ends a move within 9\", you can immediately disembark units inside." },{ name: "Transport (12)", description: "Transports 12 WE INFANTRY (not POSSESSED or TERMINATOR)." }], weapons: { ranged: [{ id: "werh-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "werh-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 7, AP: -1, damage: 1, special: "—", points: 0 }] } },
  ],
};

// ============================================================
// FACTION REGISTRY
// ============================================================
// Maps faction ID strings to their full data objects.
// Add new factions here to make them available throughout the app.

// ============================================================
// GAME DATA — SPACE MARINES / ADEPTUS ASTARTES (10th Edition)
// ============================================================
// Source: Codex: Space Marines (2023), Wahapedia 10th ed., Munitorum Field Manual 2024.
// Both Firstborn and Primaris datasheets are included under the unified codex.
// Cross-reference the latest GW points document for tournament-legal costs.

const SM_DATA = {
  id: "sm",
  name: "Space Marines",
  shortName: "SM",
  color: "#1a3a6e",
  accentColor: "#c8a84b",
  tagline: "For the Emperor and the Chapter!",
  icon: "⚜",
  armyRule: {
    name: "Oath of Moment",
    description: "At the start of your Command phase, select one enemy unit on the battlefield. Until the start of your next Command phase, that unit is your Oath of Moment target. Each time an ADEPTUS ASTARTES model from your army makes an attack that targets your Oath of Moment unit, you can re-roll the Hit roll, and if your army is Battle-forged and includes only ADEPTUS ASTARTES units, you can also re-roll the Wound roll.",
  },
  detachments: [
    { name: "Gladius Task Force", dpCost: 2, forceDisposition: "Take and Hold", rule: "Finest Hour: Each ADEPTUS ASTARTES BATTLELINE unit has the Objective Secured ability. Once per battle round, one unit can use Finest Hour — its ranged and melee attacks gain Lethal Hits until end of phase." },
    { name: "Ironstorm Spearhead", dpCost: 2, forceDisposition: "Purge the Foe", rule: "Storm of Fire: At the start of your Shooting phase, select one ADEPTUS ASTARTES VEHICLE. Until end of phase, add 1 to Hit rolls for its ranged attacks. ADEPTUS ASTARTES VEHICLE models can shoot even while in Engagement Range." },
    { name: "Vanguard Spearhead", dpCost: 2, forceDisposition: "Reconnaissance", rule: "Guerrilla Tactics: ADEPTUS ASTARTES PHOBOS units have the Stealth ability. Once per battle round, one PHOBOS unit can be removed from the battlefield at the end of the Fight phase and placed into Strategic Reserves." },
    { name: "Anvil Siege Force", dpCost: 2, forceDisposition: "Take and Hold", rule: "Lay Down Suppressing Fire: Units that do not move gain the benefit of cover against ranged attacks. Heavy weapons gain +1 to Hit if the bearer did not move this turn." },
    { name: "Stormlance Task Force", dpCost: 2, forceDisposition: "Disruption", rule: "Thunderstrike: Each time an ADEPTUS ASTARTES MOUNTED or BIKER unit makes a charge move, until the end of the turn, its melee weapons gain the Lance ability." },
    { name: "1st Company Task Force", dpCost: 3, forceDisposition: "Priority Assets", rule: "Veteran Warriors: TERMINATOR, BLADEGUARD VETERAN SQUAD, STERNGUARD VETERAN SQUAD and VANGUARD VETERAN SQUAD units have Fights First when they make a charge move. They also gain +1 to Hit against your Oath of Moment target." },
  ],
  enhancements: [
    { id: "sm-e1", detachment: "Gladius Task Force", name: "Adept of the Codex", points: 15, description: "Once per battle round, reduce the CP cost of a Stratagem targeting a unit within 6\" of the bearer by 1." },
    { id: "sm-e2", detachment: "Gladius Task Force", name: "Artificer Armour", points: 10, description: "Improve the bearer's Save by 1 (e.g. 3+ becomes 2+). Bearer also gains a 4+ invulnerable save." },
    { id: "sm-e3", detachment: "1st Company Task Force", name: "Rites of War", points: 25, description: "Once per battle round, one friendly ADEPTUS ASTARTES unit within 6\" can use a Stratagem for 0 CP." },
    { id: "sm-e4", detachment: "Anvil Siege Force", name: "The Honour Vehement", points: 20, description: "Add 1 to the Attacks and Strength of the bearer's melee weapons. The bearer also has the Fights First ability." },
    { id: "sm-e5", detachment: "Stormlance Task Force", name: "Sanctic Halo", points: 15, description: "Bearer has a 4+ invulnerable save. Each time the bearer would lose a wound, roll 1D6: on a 5+, that wound is not lost." },
    { id: "sm-e6", detachment: "Ironstorm Spearhead", name: "Forged in Battle", points: 10, description: "Each time the bearer makes an attack, re-roll unmodified Hit rolls of 1. If this unit charged this turn, re-roll all Hit rolls instead." },
  ],
  stratagems: [
    { id: "sm-s1", detachment: "Gladius Task Force", name: "Honour the Chapter", cost: "1 CP", phase: "Fight Phase", description: "Use when an ADEPTUS ASTARTES unit is chosen to fight. Until end of phase, re-roll Hit rolls of 1. If the target is your Oath of Moment unit, re-roll Wound rolls of 1 as well." },
    { id: "sm-s2", detachment: "Gladius Task Force", name: "Armour of Contempt", cost: "1 CP", phase: "Shooting or Fight Phase", description: "Use when an ADEPTUS ASTARTES unit is targeted. Until end of phase, subtract 1 from the Damage of attacks allocated to models in that unit (minimum 1)." },
    { id: "sm-s3", detachment: "Ironstorm Spearhead", name: "Rapid Fire", cost: "1 CP", phase: "Shooting Phase", description: "Use when an ADEPTUS ASTARTES INFANTRY unit is chosen to shoot. Until end of phase, increase the Rapid Fire value of bolt weapons in that unit by 1." },
    { id: "sm-s4", detachment: "Gladius Task Force", name: "Codex Discipline", cost: "1 CP", phase: "Any Phase", description: "Use at the start of any phase. Select one ADEPTUS ASTARTES unit that is Battle-shocked. That unit is no longer Battle-shocked." },
    { id: "sm-s5", detachment: "Stormlance Task Force", name: "Skilled Riders", cost: "1 CP", phase: "Movement Phase", description: "Use when an ADEPTUS ASTARTES MOUNTED or BIKER unit Advances. Until end of turn, that unit can still shoot and charge." },
    { id: "sm-s6", detachment: "1st Company Task Force", name: "Teleport Homer", cost: "1 CP", phase: "Movement Phase", description: "Use at end of your opponent's Fight phase. Remove one ADEPTUS ASTARTES TERMINATOR unit from the battlefield into Strategic Reserves. It returns via Deep Strike next Movement phase." },
    { id: "sm-s7", detachment: "Anvil Siege Force", name: "Transhuman Physiology", cost: "1 CP", phase: "Shooting or Fight Phase", description: "Use when an ADEPTUS ASTARTES INFANTRY unit is targeted. Until end of phase, unmodified Wound rolls of 1–3 always fail against that unit." },
    { id: "sm-s8", detachment: "1st Company Task Force", name: "Only in Death Does Duty End", cost: "2 CP", phase: "Fight Phase", description: "Use when an ADEPTUS ASTARTES CHARACTER model is destroyed by a melee attack. Before the model is removed, it can fight as if it were your Fight phase." },
  ],
  marks: [],
  units: [
    // CHARACTERS
    { id: "sm-captain", name: "Captain", role: "CHARACTER", points: 80, keywords: ["CHARACTER","INFANTRY","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","CAPTAIN"], stats: { M: '6"', T: 4, Sv: "3+", W: 5, Ld: "6+", OC: 1 }, abilities: [{ name: "Lord of the Chapter", description: "Once per battle round, reduce the CP cost of one Stratagem targeting a unit within 6\" of this model by 1." },{ name: "Rites of Battle (Aura)", description: "While a friendly ADEPTUS ASTARTES CORE unit is within 6\", each time a model makes an attack, re-roll a Hit roll of 1." }], weapons: { ranged: [{ id: "cap-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "cap-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["cap-bolt-pistol"] }], melee: [{ id: "cap-chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cap-power-fist","cap-master-sword","cap-relic-blade"] },{ id: "cap-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cap-chainsword","cap-master-sword","cap-relic-blade"] },{ id: "cap-master-sword", name: "Master-crafted Power Sword", attacks: 5, skill: "3+", strength: 5, AP: -3, damage: 2, special: "Precision", points: 10, exclusive: ["cap-chainsword","cap-power-fist","cap-relic-blade"] },{ id: "cap-relic-blade", name: "Relic Blade", attacks: 4, skill: "3+", strength: 7, AP: -3, damage: 3, special: "—", points: 15, exclusive: ["cap-chainsword","cap-power-fist","cap-master-sword"] }] } },
    { id: "sm-captain-terminator", name: "Captain in Terminator Armour", role: "CHARACTER", points: 110, keywords: ["CHARACTER","INFANTRY","TERMINATOR","IMPERIUM","ADEPTUS ASTARTES","CAPTAIN"], stats: { M: '5"', T: 5, Sv: "2+", W: 6, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Rites of Battle (Aura)", description: "Re-roll Hit rolls of 1 for friendly ADEPTUS ASTARTES CORE units within 6\"." },{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." },{ name: "Lord of the Chapter", description: "Once per battle round, reduce CP cost of one Stratagem targeting a unit within 6\" by 1." }], weapons: { ranged: [{ id: "cap-term-storm-bolter", name: "Storm Bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "cap-term-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["cap-term-thunder-hammer","cap-term-lightning-claws"] },{ id: "cap-term-thunder-hammer", name: "Thunder Hammer", attacks: 3, skill: "4+", strength: 10, AP: -2, damage: 3, special: "Devastating Wounds", points: 5, exclusive: ["cap-term-power-fist","cap-term-lightning-claws"] },{ id: "cap-term-lightning-claws", name: "Paired Lightning Claws", attacks: 6, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 5, exclusive: ["cap-term-power-fist","cap-term-thunder-hammer"] }] } },
    { id: "sm-captain-jumppack", name: "Captain with Jump Pack", role: "CHARACTER", points: 90, keywords: ["CHARACTER","INFANTRY","JUMP PACK","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","CAPTAIN"], stats: { M: '12"', T: 4, Sv: "3+", W: 5, Ld: "6+", OC: 1 }, abilities: [{ name: "Rites of Battle (Aura)", description: "Re-roll Hit rolls of 1 for friendly ADEPTUS ASTARTES CORE units within 6\"." },{ name: "Meteoric Descent", description: "Can be placed in Strategic Reserves for free. Can charge the turn it arrives from Strategic Reserves." }], weapons: { ranged: [{ id: "cap-jp-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "cap-jp-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["cap-jp-bolt-pistol"] }], melee: [{ id: "cap-jp-chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cap-jp-power-fist","cap-jp-thunder-hammer"] },{ id: "cap-jp-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cap-jp-chainsword","cap-jp-thunder-hammer"] },{ id: "cap-jp-thunder-hammer", name: "Thunder Hammer", attacks: 3, skill: "4+", strength: 10, AP: -2, damage: 3, special: "Devastating Wounds", points: 15, exclusive: ["cap-jp-chainsword","cap-jp-power-fist"] }] } },
    { id: "sm-lieutenant", name: "Lieutenant", role: "CHARACTER", points: 70, keywords: ["CHARACTER","INFANTRY","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","LIEUTENANT"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Tactical Precision (Aura)", description: "While a friendly ADEPTUS ASTARTES CORE unit is within 6\", unmodified Wound rolls of 6 score Critical Wounds (Lethal Hits)." }], weapons: { ranged: [{ id: "lt-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "lt-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["lt-bolt-pistol"] }], melee: [{ id: "lt-chainsword", name: "Chainsword", attacks: 4, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["lt-power-weapon"] },{ id: "lt-power-weapon", name: "Power Weapon", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "—", points: 5, exclusive: ["lt-chainsword"] }] } },
    { id: "sm-lieutenant-combi", name: "Lieutenant with Combi-weapon", role: "CHARACTER", points: 75, keywords: ["CHARACTER","INFANTRY","PHOBOS","IMPERIUM","ADEPTUS ASTARTES","LIEUTENANT"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Tactical Precision (Aura)", description: "Lethal Hits on unmodified Wound rolls of 6 for ADEPTUS ASTARTES CORE units within 6\"." },{ name: "Lord of Deceit", description: "Each time your opponent targets a unit with a Stratagem while that unit is within 12\", increase the CP cost by 1 (once per battle round)." }], weapons: { ranged: [{ id: "lt-combi-weapon", name: "Combi-weapon", range: '24"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Rapid Fire 1, Devastating Wounds", points: 0 }], melee: [{ id: "lt-combi-blades", name: "Paired Combat Blades", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Twin-linked", points: 0 }] } },
    { id: "sm-chaplain", name: "Chaplain", role: "CHARACTER", points: 75, keywords: ["CHARACTER","INFANTRY","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","CHAPLAIN"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "5+", OC: 1 }, abilities: [{ name: "Litany of Hate", description: "While leading a unit, each time a model makes a melee attack, add 1 to the Wound roll." },{ name: "Spiritual Leaders (Aura)", description: "Friendly ADEPTUS ASTARTES CORE units within 6\" have a 5+ Feel No Pain against mortal wounds." }], weapons: { ranged: [{ id: "chap-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "chap-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["chap-bolt-pistol"] }], melee: [{ id: "chap-crozius", name: "Crozius Arcanum", attacks: 5, skill: "3+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "sm-librarian", name: "Librarian", role: "CHARACTER", points: 80, keywords: ["CHARACTER","INFANTRY","PSYKER","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","LIBRARIAN"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Psychic Ritual", description: "At the start of your Shooting phase, select one enemy unit within 18\". Roll 3D6: if total exceeds target's Toughness, deal D3 mortal wounds." },{ name: "Psychic Hood", description: "Add 1 to Battle-shock tests for friendly ADEPTUS ASTARTES units within 12\"." }], weapons: { ranged: [{ id: "lib-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "lib-force-weapon", name: "Force Weapon", attacks: 4, skill: "3+", strength: 5, AP: -1, damage: "D3", special: "Psychic", points: 0 }] } },
    { id: "sm-apothecary", name: "Apothecary", role: "CHARACTER", points: 55, keywords: ["CHARACTER","INFANTRY","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","APOTHECARY"], stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Narthecium", description: "While leading a unit, at the start of your Command phase, return 1 destroyed non-CHARACTER model to that unit." },{ name: "Healing Aura", description: "At the start of your Command phase, one friendly ADEPTUS ASTARTES INFANTRY model within 3\" regains up to D3 lost wounds." }], weapons: { ranged: [{ id: "apo-bolt-pistol", name: "Absolvor Bolt Pistol", range: '18"', attacks: 1, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Pistol", points: 0 }], melee: [{ id: "apo-ccw", name: "Close Combat Weapon", attacks: 3, skill: "3+", strength: 4, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-techmarine", name: "Techmarine", role: "CHARACTER", points: 65, keywords: ["CHARACTER","INFANTRY","IMPERIUM","ADEPTUS ASTARTES","TECHMARINE"], stats: { M: '6"', T: 4, Sv: "2+", W: 4, Ld: "6+", OC: 1 }, abilities: [{ name: "Blessing of the Omnissiah", description: "At end of your Movement phase, repair one friendly ADEPTUS ASTARTES VEHICLE within 3\". It regains up to 3 lost wounds." },{ name: "Master of the Forge", description: "Friendly ADEPTUS ASTARTES VEHICLE models within 6\" do not suffer the penalty to attack characteristics for being below Half-strength." }], weapons: { ranged: [{ id: "tech-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "tech-servo-arm", name: "Omnissian Power Axe", attacks: 4, skill: "3+", strength: 6, AP: -2, damage: 2, special: "—", points: 0 }] } },
    // BATTLELINE
    { id: "sm-intercessors", name: "Intercessor Squad", role: "BATTLELINE", points: 75, baseSize: 5, keywords: ["INFANTRY","BATTLELINE","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Objective Secured", description: "If you control an objective at end of Command phase and this unit is within range, it remains under your control until your opponent controls it." },{ name: "Auspex Scan", description: "After resolving attacks, one enemy unit hit is auspex scanned. ADEPTUS ASTARTES models re-roll Hit rolls of 1 against scanned units." }], weapons: { ranged: [{ id: "int-bolt-rifle", name: "Bolt Rifle", range: '30"', attacks: 2, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Heavy, Rapid Fire 1", points: 0 },{ id: "int-auto-bolt-rifle", name: "Auto Bolt Rifle", range: '24"', attacks: 3, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Assault", points: 0, exclusive: ["int-bolt-rifle"] },{ id: "int-stalker-bolt-rifle", name: "Stalker Bolt Rifle", range: '36"', attacks: 1, skill: "3+", strength: 4, AP: -2, damage: 2, special: "Heavy, Precision", points: 0, exclusive: ["int-bolt-rifle"] }], melee: [{ id: "int-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-tactical-squad", name: "Tactical Squad", role: "BATTLELINE", points: 75, baseSize: 5, keywords: ["INFANTRY","BATTLELINE","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Objective Secured", description: "This unit has the Objective Secured ability." },{ name: "Combat Squads", description: "Before battle, this unit can split into two units of 5 models." }], weapons: { ranged: [{ id: "tac-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },{ id: "tac-plasma", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["tac-melta","tac-flamer","tac-boltgun"], limit: 1 },{ id: "tac-melta", name: "Meltagun", range: '12"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["tac-plasma","tac-flamer","tac-boltgun"], limit: 1 },{ id: "tac-flamer", name: "Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 5, exclusive: ["tac-plasma","tac-melta","tac-boltgun"], limit: 1 },{ id: "tac-missile", name: "Missile Launcher (Sergeant)", range: '48"', attacks: 1, skill: "3+", strength: 10, AP: -2, damage: "D6", special: "Heavy, Indirect Fire", points: 10, limit: 1 }], melee: [{ id: "tac-chainsword", name: "Astartes Chainsword", attacks: 2, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },{ id: "tac-power-fist", name: "Power Fist (Sergeant)", attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, limit: 1 }] } },
    { id: "sm-assault-intercessors", name: "Assault Intercessor Squad", role: "BATTLELINE", points: 75, baseSize: 5, keywords: ["INFANTRY","BATTLELINE","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Objective Secured", description: "This unit has the Objective Secured ability." },{ name: "Hammer of Wrath", description: "Add 1 to Attacks of melee weapons when this unit made a charge move this turn." }], weapons: { ranged: [{ id: "ai-heavy-bolt-pistol", name: "Heavy Bolt Pistol", range: '18"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Pistol", points: 0 },{ id: "ai-plasma-pistol", name: "Plasma Pistol (Sergeant)", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["ai-heavy-bolt-pistol"], limit: 1 }], melee: [{ id: "ai-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },{ id: "ai-power-fist", name: "Power Fist (Sergeant)", attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, limit: 1 }] } },
    { id: "sm-heavy-intercessors", name: "Heavy Intercessor Squad", role: "BATTLELINE", points: 90, baseSize: 5, keywords: ["INFANTRY","BATTLELINE","CORE","GRAVIS","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '5"', T: 6, Sv: "3+", W: 3, Ld: "6+", OC: 2 }, abilities: [{ name: "Objective Secured", description: "This unit has the Objective Secured ability." },{ name: "Heavily Armed", description: "Each time this unit is selected to shoot, each model can make 1 additional attack with its bolt weapon." }], weapons: { ranged: [{ id: "hi-heavy-bolt-rifle", name: "Heavy Bolt Rifle", range: '36"', attacks: 2, skill: "3+", strength: 5, AP: -1, damage: 1, special: "Heavy, Rapid Fire 1", points: 0 },{ id: "hi-executor-bolt-rifle", name: "Executor Bolt Rifle", range: '42"', attacks: 1, skill: "3+", strength: 5, AP: -2, damage: 2, special: "Heavy, Precision", points: 0, exclusive: ["hi-heavy-bolt-rifle"] },{ id: "hi-hellstorm-bolt-rifle", name: "Hellstorm Bolt Rifle", range: '24"', attacks: 3, skill: "3+", strength: 5, AP: 0, damage: 1, special: "Heavy, Sustained Hits 1", points: 0, exclusive: ["hi-heavy-bolt-rifle"] }], melee: [{ id: "hi-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-scout-squad", name: "Scout Squad", role: "BATTLELINE", points: 65, baseSize: 5, keywords: ["INFANTRY","BATTLELINE","CORE","IMPERIUM","ADEPTUS ASTARTES","SCOUT"], stats: { M: '6"', T: 4, Sv: "4+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Infiltrators", description: "During deployment, set up anywhere more than 9\" from the enemy deployment zone and all enemy units." },{ name: "Scout", description: "After deployment but before the first battle round, this unit can make a Normal move of up to 6\"." }], weapons: { ranged: [{ id: "sc-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },{ id: "sc-sniper-rifle", name: "Sniper Rifle", range: '36"', attacks: 1, skill: "3+", strength: 4, AP: -2, damage: 2, special: "Heavy, Precision, Indirect Fire", points: 5, exclusive: ["sc-boltgun"], limit: 1 },{ id: "sc-heavy-bolter", name: "Heavy Bolter", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, exclusive: ["sc-boltgun"], limit: 1 },{ id: "sc-missile-launcher", name: "Missile Launcher", range: '48"', attacks: 1, skill: "3+", strength: 10, AP: -2, damage: "D6", special: "Heavy, Indirect Fire", points: 10, exclusive: ["sc-boltgun"], limit: 1 }], melee: [{ id: "sc-chainsword", name: "Astartes Chainsword", attacks: 2, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    // ELITE
    { id: "sm-terminators", name: "Terminator Squad", role: "ELITE", points: 200, baseSize: 5, keywords: ["INFANTRY","CORE","TERMINATOR","IMPERIUM","ADEPTUS ASTARTES"], stats: { M: '5"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Fury of the First", description: "Each time a model makes an attack targeting your Oath of Moment unit, add 1 to the Hit roll." },{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." },{ name: "Terminator Resilience", description: "Subtract 1 from Damage of attacks allocated to models in this unit (minimum 1)." }], weapons: { ranged: [{ id: "term-storm-bolter", name: "Storm Bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },{ id: "term-assault-cannon", name: "Assault Cannon (Sergeant)", range: '24"', attacks: 6, skill: "3+", strength: 6, AP: 0, damage: 1, special: "Devastating Wounds", points: 10, limit: 1 }], melee: [{ id: "term-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["term-chainfist","term-thunder-hammer"] },{ id: "term-chainfist", name: "Chainfist", attacks: 3, skill: "4+", strength: 8, AP: -4, damage: 2, special: "Anti-VEHICLE 4+", points: 5, exclusive: ["term-power-fist","term-thunder-hammer"] },{ id: "term-thunder-hammer", name: "Thunder Hammer (Sergeant)", attacks: 3, skill: "4+", strength: 10, AP: -2, damage: 3, special: "Devastating Wounds", points: 10, exclusive: ["term-power-fist","term-chainfist"], limit: 1 }] } },
    { id: "sm-terminator-assault", name: "Terminator Assault Squad", role: "ELITE", points: 210, baseSize: 5, keywords: ["INFANTRY","CORE","TERMINATOR","IMPERIUM","ADEPTUS ASTARTES"], stats: { M: '5"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Fury of the First", description: "Add 1 to Hit rolls targeting your Oath of Moment unit." },{ name: "Deep Strike", description: "Set up anywhere more than 9\" from all enemy units." },{ name: "Terminator Resilience", description: "Subtract 1 from Damage of attacks allocated to models in this unit (minimum 1)." }], weapons: { ranged: [], melee: [{ id: "ta-thunder-hammer", name: "Thunder Hammer & Storm Shield", attacks: 3, skill: "4+", strength: 10, AP: -2, damage: 3, special: "Devastating Wounds, 4+ Invuln", points: 0, exclusive: ["ta-lightning-claws"] },{ id: "ta-lightning-claws", name: "Paired Lightning Claws", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0, exclusive: ["ta-thunder-hammer"] }] } },
    { id: "sm-bladeguard", name: "Bladeguard Veteran Squad", role: "ELITE", points: 125, baseSize: 3, keywords: ["INFANTRY","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","BLADEGUARD VETERAN SQUAD"], stats: { M: '6"', T: 4, Sv: "3+", W: 3, Ld: "6+", OC: 1, Inv: "4+" }, abilities: [{ name: "Martial Honour", description: "Each time a model makes a melee attack, add 1 to the Hit roll." },{ name: "Storm Shield", description: "Models in this unit have a 4+ invulnerable save." }], weapons: { ranged: [{ id: "bg-heavy-bolt-pistol", name: "Heavy Bolt Pistol", range: '18"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Pistol", points: 0 }], melee: [{ id: "bg-master-sword", name: "Master-crafted Power Sword", attacks: 4, skill: "3+", strength: 5, AP: -3, damage: 2, special: "Precision", points: 0 }] } },
    { id: "sm-sternguard", name: "Sternguard Veteran Squad", role: "ELITE", points: 95, baseSize: 5, keywords: ["INFANTRY","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","STERNGUARD VETERAN SQUAD"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Special Issue Ammunition", description: "Each time a model makes a ranged attack with a bolt weapon, that weapon has the Lethal Hits ability." }], weapons: { ranged: [{ id: "st-combi-weapon", name: "Combi-weapon", range: '24"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Rapid Fire 1, Devastating Wounds", points: 0 },{ id: "st-plasma", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["st-combi-weapon","st-melta","st-grav"], limit: 2 },{ id: "st-melta", name: "Meltagun", range: '12"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["st-combi-weapon","st-plasma","st-grav"], limit: 2 },{ id: "st-grav", name: "Grav-gun", range: '18"', attacks: 2, skill: "3+", strength: 5, AP: -3, damage: 1, special: "Anti-VEHICLE 2+", points: 5, exclusive: ["st-combi-weapon","st-plasma","st-melta"], limit: 2 }], melee: [{ id: "st-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-aggressors", name: "Aggressor Squad", role: "ELITE", points: 115, baseSize: 3, keywords: ["INFANTRY","CORE","GRAVIS","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '5"', T: 6, Sv: "3+", W: 3, Ld: "6+", OC: 1 }, abilities: [{ name: "Relentless Advance", description: "Each time this unit Advances, until end of turn it can still shoot as if it had not Advanced, but cannot declare a charge." }], weapons: { ranged: [{ id: "agg-boltstorm-gauntlets", name: "Boltstorm Gauntlets", range: '18"', attacks: 6, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Assault", points: 0, exclusive: ["agg-flamestorm"] },{ id: "agg-flamestorm", name: "Flamestorm Gauntlets", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover, Twin-linked", points: 0, exclusive: ["agg-boltstorm-gauntlets"] }], melee: [{ id: "agg-twin-power-fists", name: "Twin Power Fists", attacks: 5, skill: "3+", strength: 8, AP: -2, damage: 2, special: "Twin-linked", points: 0 }] } },
    { id: "sm-hellblasters", name: "Hellblaster Squad", role: "ELITE", points: 100, baseSize: 5, keywords: ["INFANTRY","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "For the Chapter!", description: "Each time a model is destroyed, roll D6: on a 3+, it can shoot before being removed. Hazardous tests auto-pass for this shot." }], weapons: { ranged: [{ id: "hb-plasma-incinerator", name: "Plasma Incinerator", range: '36"', attacks: 2, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Rapid Fire 1, Hazardous", points: 0 },{ id: "hb-assault-plasma", name: "Assault Plasma Incinerator", range: '24"', attacks: 3, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Assault, Hazardous", points: 0, exclusive: ["hb-plasma-incinerator"] },{ id: "hb-heavy-plasma", name: "Heavy Plasma Incinerator", range: '36"', attacks: 1, skill: "3+", strength: 8, AP: -3, damage: 3, special: "Heavy, Hazardous", points: 0, exclusive: ["hb-plasma-incinerator"] }], melee: [{ id: "hb-ccw", name: "Close Combat Weapon", attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-eradicators", name: "Eradicator Squad", role: "ELITE", points: 95, baseSize: 3, keywords: ["INFANTRY","CORE","GRAVIS","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '5"', T: 6, Sv: "3+", W: 3, Ld: "6+", OC: 1 }, abilities: [{ name: "Total Obliteration", description: "If this unit did not move this turn, its ranged weapons gain the Devastating Wounds ability." }], weapons: { ranged: [{ id: "era-melta-rifle", name: "Melta Rifle", range: '18"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2, Heavy", points: 0, exclusive: ["era-multi-melta"] },{ id: "era-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["era-melta-rifle"] }], melee: [{ id: "era-ccw", name: "Close Combat Weapon", attacks: 3, skill: "3+", strength: 5, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-vanguard-veterans", name: "Vanguard Veteran Squad (Jump Packs)", role: "ELITE", points: 130, baseSize: 5, keywords: ["INFANTRY","CORE","JUMP PACK","IMPERIUM","ADEPTUS ASTARTES","TACTICUS","VANGUARD VETERAN SQUAD"], stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1 }, abilities: [{ name: "Heroic Intervention", description: "Each time an enemy unit ends a Normal move, this unit can immediately move up to 6\" without ending in Engagement Range." },{ name: "Jump Pack Assault", description: "Can be placed in Strategic Reserves for free. Can charge in the same turn it arrives." }], weapons: { ranged: [{ id: "vv-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },{ id: "vv-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["vv-bolt-pistol"], limit: 2 }], melee: [{ id: "vv-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["vv-power-fist","vv-thunder-hammer","vv-lightning-claws"] },{ id: "vv-power-fist", name: "Power Fist", attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 5, exclusive: ["vv-chainsword","vv-thunder-hammer","vv-lightning-claws"], limit: 2 },{ id: "vv-thunder-hammer", name: "Thunder Hammer", attacks: 2, skill: "4+", strength: 10, AP: -2, damage: 3, special: "Devastating Wounds", points: 10, exclusive: ["vv-chainsword","vv-power-fist","vv-lightning-claws"], limit: 1 },{ id: "vv-lightning-claws", name: "Lightning Claws (pair)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 8, exclusive: ["vv-chainsword","vv-power-fist","vv-thunder-hammer"], limit: 2 }] } },
    // FAST ATTACK
    { id: "sm-assault-intercessors-jp", name: "Assault Intercessors with Jump Packs", role: "FAST ATTACK", points: 80, baseSize: 5, keywords: ["INFANTRY","CORE","JUMP PACK","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1 }, abilities: [{ name: "Jump Pack Assault", description: "Free Strategic Reserves. Can charge the turn it arrives." },{ name: "Hammer of Wrath", description: "Add 1 to Attacks of melee weapons when this unit made a charge move this turn." }], weapons: { ranged: [{ id: "aijp-heavy-bolt-pistol", name: "Heavy Bolt Pistol", range: '18"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Pistol", points: 0 },{ id: "aijp-plasma-pistol", name: "Plasma Pistol (Sergeant)", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["aijp-heavy-bolt-pistol"], limit: 1 }], melee: [{ id: "aijp-chainsword", name: "Astartes Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },{ id: "aijp-power-fist", name: "Power Fist (Sergeant)", attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, limit: 1 }] } },
    { id: "sm-inceptors", name: "Inceptor Squad", role: "FAST ATTACK", points: 75, baseSize: 3, keywords: ["INFANTRY","CORE","JUMP PACK","GRAVIS","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '10"', T: 6, Sv: "3+", W: 3, Ld: "6+", OC: 1 }, abilities: [{ name: "Meteoric Descent", description: "Free Strategic Reserves. Can charge the turn it arrives." },{ name: "Crushing Impact", description: "After a charge move, roll D6 for each enemy unit within 1\": on a 2+, D3 mortal wounds." }], weapons: { ranged: [{ id: "inc-assault-bolters", name: "Assault Bolters (pair)", range: '18"', attacks: 6, skill: "3+", strength: 5, AP: -1, damage: 1, special: "Assault, Pistol", points: 0, exclusive: ["inc-plasma-exterminators"] },{ id: "inc-plasma-exterminators", name: "Plasma Exterminators (pair)", range: '18"', attacks: 2, skill: "3+", strength: 7, AP: -3, damage: 2, special: "Pistol, Hazardous, Devastating Wounds", points: 5, exclusive: ["inc-assault-bolters"] }], melee: [{ id: "inc-fists", name: "Close Combat Weapon", attacks: 3, skill: "3+", strength: 5, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-outriders", name: "Outrider Squad", role: "FAST ATTACK", points: 90, baseSize: 3, keywords: ["MOUNTED","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '14"', T: 5, Sv: "3+", W: 4, Ld: "6+", OC: 2 }, abilities: [{ name: "Turbo-boost", description: "When Advancing, add 6\" to Move characteristic (instead of rolling dice) until end of phase." },{ name: "Devastating Charge", description: "After a charge move, add 1 to Wound rolls for melee weapons until end of turn." }], weapons: { ranged: [{ id: "out-twin-bolt", name: "Twin Bolt Rifle", range: '30"', attacks: 2, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Twin-linked, Heavy, Rapid Fire 1", points: 0 }], melee: [{ id: "out-chainsword", name: "Astartes Chainsword", attacks: 4, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-eliminators", name: "Eliminator Squad", role: "FAST ATTACK", points: 75, baseSize: 3, keywords: ["INFANTRY","CORE","PHOBOS","IMPERIUM","ADEPTUS ASTARTES"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Infiltrators", description: "Set up anywhere more than 9\" from enemy deployment zone and all enemy units." },{ name: "Camo Cloaks", description: "When a ranged attack targets this unit while it has cover, add an additional +1 to the saving throw." },{ name: "Executioner Round", description: "Once per turn, one model can make 1 additional Precision attack with its sniper rifle at +2 Damage." }], weapons: { ranged: [{ id: "eli-las-fusil", name: "Las Fusil", range: '36"', attacks: 1, skill: "3+", strength: 8, AP: -3, damage: "D3+3", special: "Heavy, Precision", points: 0, exclusive: ["eli-bolt-sniper"] },{ id: "eli-bolt-sniper", name: "Bolt Sniper Rifle", range: '36"', attacks: 1, skill: "3+", strength: 4, AP: -2, damage: 2, special: "Heavy, Precision, Indirect Fire", points: 0, exclusive: ["eli-las-fusil"] }], melee: [{ id: "eli-combat-knife", name: "Combat Knife", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 }] } },
    // HEAVY SUPPORT
    { id: "sm-devastators", name: "Devastator Squad", role: "HEAVY", points: 95, baseSize: 5, keywords: ["INFANTRY","CORE","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 }, abilities: [{ name: "Signum", description: "At start of Shooting phase, one model (not Sergeant) uses Signum: +1 to Hit for that model until end of phase." },{ name: "Armourium Cherub", description: "Once per battle, one model can re-roll all Hit rolls for one attack sequence." }], weapons: { ranged: [{ id: "dev-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },{ id: "dev-lascannon", name: "Lascannon", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["dev-boltgun","dev-missile","dev-hb","dev-plasma-cannon","dev-multi-melta"], limit: 4 },{ id: "dev-missile", name: "Missile Launcher", range: '48"', attacks: 1, skill: "3+", strength: 10, AP: -2, damage: "D6", special: "Heavy, Indirect Fire", points: 15, exclusive: ["dev-boltgun","dev-lascannon","dev-hb","dev-plasma-cannon","dev-multi-melta"], limit: 4 },{ id: "dev-hb", name: "Heavy Bolter", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 5, exclusive: ["dev-boltgun","dev-lascannon","dev-missile","dev-plasma-cannon","dev-multi-melta"], limit: 4 },{ id: "dev-plasma-cannon", name: "Plasma Cannon", range: '36"', attacks: "D3", skill: "3+", strength: 8, AP: -3, damage: 2, special: "Blast, Heavy, Hazardous", points: 15, exclusive: ["dev-boltgun","dev-lascannon","dev-missile","dev-hb","dev-multi-melta"], limit: 4 },{ id: "dev-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 15, exclusive: ["dev-boltgun","dev-lascannon","dev-missile","dev-hb","dev-plasma-cannon"], limit: 4 }], melee: [{ id: "dev-chainsword", name: "Astartes Chainsword", attacks: 2, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },{ id: "dev-power-fist", name: "Power Fist (Sergeant)", attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, limit: 1 }] } },
    { id: "sm-centurion-devastators", name: "Centurion Devastator Squad", role: "HEAVY", points: 180, baseSize: 3, keywords: ["INFANTRY","CORE","CENTURION","IMPERIUM","ADEPTUS ASTARTES","TACTICUS"], stats: { M: '5"', T: 7, Sv: "2+", W: 4, Ld: "6+", OC: 3 }, abilities: [{ name: "Decimator Protocols", description: "If this unit did not move this turn, add 1 to Hit rolls for its ranged attacks." },{ name: "Grav-amp", description: "Each time a model makes an attack with a grav-cannon, an unmodified Wound roll of 6 inflicts an additional D3 mortal wounds." }], weapons: { ranged: [{ id: "cen-twin-lascannon", name: "Twin Lascannon (pair)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0, exclusive: ["cen-twin-heavy-bolter","cen-grav-cannon"] },{ id: "cen-twin-heavy-bolter", name: "Twin Heavy Bolter (pair)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1, Twin-linked", points: 0, exclusive: ["cen-twin-lascannon","cen-grav-cannon"] },{ id: "cen-grav-cannon", name: "Grav-cannon & Grav-amp (pair)", range: '24"', attacks: 5, skill: "3+", strength: 6, AP: -3, damage: 2, special: "Heavy, Anti-VEHICLE 2+", points: 0, exclusive: ["cen-twin-lascannon","cen-twin-heavy-bolter"] }], melee: [{ id: "cen-fists", name: "Centurion Fists", attacks: 4, skill: "4+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 }] } },
    // VEHICLES
    { id: "sm-dreadnought", name: "Dreadnought", role: "VEHICLE", points: 100, keywords: ["VEHICLE","WALKER","IMPERIUM","ADEPTUS ASTARTES","DREADNOUGHT"], stats: { M: '6"', T: 9, Sv: "3+", W: 8, Ld: "6+", OC: 3 }, abilities: [{ name: "Smoke Launchers", description: "Once per game, at start of Movement phase, use Smoke Launchers. Until start of next turn, -1 to Hit rolls against this model." },{ name: "Duty Eternal", description: "Each time an attack is allocated to this model, subtract 1 from Damage (minimum 1)." }], weapons: { ranged: [{ id: "dread-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0, exclusive: ["dread-twin-lascannon","dread-plasma-cannon","dread-assault-cannon"] },{ id: "dread-twin-lascannon", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 10, exclusive: ["dread-multi-melta","dread-plasma-cannon","dread-assault-cannon"] },{ id: "dread-plasma-cannon", name: "Plasma Cannon", range: '36"', attacks: "D3", skill: "3+", strength: 8, AP: -3, damage: 2, special: "Blast, Heavy, Hazardous", points: 5, exclusive: ["dread-multi-melta","dread-twin-lascannon","dread-assault-cannon"] },{ id: "dread-assault-cannon", name: "Assault Cannon", range: '24"', attacks: 6, skill: "3+", strength: 6, AP: 0, damage: 1, special: "Devastating Wounds", points: 5, exclusive: ["dread-multi-melta","dread-twin-lascannon","dread-plasma-cannon"] }], melee: [{ id: "dread-fist", name: "Dreadnought Combat Weapon", attacks: 5, skill: "4+", strength: 10, AP: -2, damage: 3, special: "—", points: 0 }] } },
    { id: "sm-redemptor-dreadnought", name: "Redemptor Dreadnought", role: "VEHICLE", points: 180, keywords: ["VEHICLE","WALKER","IMPERIUM","ADEPTUS ASTARTES","REDEMPTOR"], stats: { M: '8"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 4 }, abilities: [{ name: "Smoke Launchers", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Duty Eternal", description: "Subtract 1 from Damage of attacks allocated to this model (minimum 1)." },{ name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." }], weapons: { ranged: [{ id: "red-macro-plasma", name: "Macro Plasma Incinerator", range: '36"', attacks: "D6", skill: "3+", strength: 8, AP: -3, damage: 2, special: "Blast, Hazardous", points: 0, exclusive: ["red-onslaught-gatling"] },{ id: "red-onslaught-gatling", name: "Onslaught Gatling Cannon", range: '24"', attacks: 12, skill: "3+", strength: 6, AP: -1, damage: 1, special: "Devastating Wounds", points: 0, exclusive: ["red-macro-plasma"] },{ id: "red-fragstorm", name: "Fragstorm Grenade Launcher", range: '18"', attacks: "D6", skill: "3+", strength: 4, AP: 0, damage: 1, special: "Blast", points: 0 },{ id: "red-icarus-rocket", name: "Icarus Rocket Pod", range: '24"', attacks: "D3", skill: "3+", strength: 8, AP: -1, damage: 2, special: "Anti-FLY 4+", points: 5 }], melee: [{ id: "red-fist", name: "Redemptor Fist", attacks: 6, skill: "3+", strength: 12, AP: -3, damage: 3, special: "—", points: 0 },{ id: "red-stomps", name: "Stomping Feet", attacks: 3, skill: "4+", strength: 7, AP: -1, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-predator-annihilator", name: "Predator Annihilator", role: "VEHICLE", points: 130, keywords: ["VEHICLE","IMPERIUM","ADEPTUS ASTARTES","PREDATOR ANNIHILATOR","SMOKE"], stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Grinding Advance", description: "If this model did not move this turn, add 1 to its ranged Hit rolls." }], weapons: { ranged: [{ id: "sm-pred-ann-twin-las", name: "Twin Lascannon (turret)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },{ id: "sm-pred-ann-hb", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },{ id: "sm-pred-ann-las-s", name: "Lascannon (sponson)", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["sm-pred-ann-hb"], limit: 2 }], melee: [{ id: "sm-pred-ann-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-land-raider", name: "Land Raider", role: "VEHICLE", points: 240, keywords: ["VEHICLE","TRANSPORT","IMPERIUM","ADEPTUS ASTARTES","LAND RAIDER","SMOKE"], stats: { M: '10"', T: 12, Sv: "2+", W: 16, Ld: "6+", OC: 5 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Power of the Machine Spirit", description: "Can make ranged attacks even while in Engagement Range of enemy units." },{ name: "Transport (12)", description: "Transports up to 12 ADEPTUS ASTARTES INFANTRY (not JUMP PACK)." }], weapons: { ranged: [{ id: "lr-twin-lascannon", name: "Twin Lascannon (sponson x2)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },{ id: "lr-twin-heavy-bolter", name: "Twin Heavy Bolter (hull)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1, Twin-linked", points: 0 }], melee: [{ id: "lr-tracks", name: "Armoured Tracks", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "sm-land-raider-crusader", name: "Land Raider Crusader", role: "VEHICLE", points: 255, keywords: ["VEHICLE","TRANSPORT","IMPERIUM","ADEPTUS ASTARTES","LAND RAIDER","SMOKE"], stats: { M: '10"', T: 12, Sv: "2+", W: 16, Ld: "6+", OC: 5 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Assault Ramp", description: "Each time a unit disembarks after this model makes a Normal move, that unit can still declare a charge this turn." },{ name: "Transport (16)", description: "Transports up to 16 ADEPTUS ASTARTES INFANTRY (not JUMP PACK or TERMINATOR)." }], weapons: { ranged: [{ id: "lrc-hurricane-bolters", name: "Hurricane Bolters (pair)", range: '24"', attacks: 6, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 6", points: 0 },{ id: "lrc-twin-assault-cannon", name: "Twin Assault Cannon (turret)", range: '24"', attacks: 6, skill: "3+", strength: 6, AP: 0, damage: 1, special: "Devastating Wounds, Twin-linked", points: 0 },{ id: "lrc-frag-launchers", name: "Frag Assault Launchers", range: '6"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 0 }], melee: [{ id: "lrc-tracks", name: "Armoured Tracks", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 }] } },
    { id: "sm-repulsor", name: "Repulsor", role: "VEHICLE", points: 210, keywords: ["VEHICLE","TRANSPORT","FLY","IMPERIUM","ADEPTUS ASTARTES","REPULSOR","SMOKE"], stats: { M: '10"', T: 12, Sv: "3+", W: 16, Ld: "6+", OC: 5 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Repulsor Field", description: "Each time an enemy unit ends a move within 1\" of this model, that unit suffers D3 mortal wounds." },{ name: "Transport (10)", description: "Transports up to 10 ADEPTUS ASTARTES INFANTRY (TACTICUS or PHOBOS only)." }], weapons: { ranged: [{ id: "rep-las-talon", name: "Las-talon", range: '36"', attacks: 2, skill: "3+", strength: 14, AP: -4, damage: "D6+2", special: "Heavy, Twin-linked", points: 0, exclusive: ["rep-onslaught"] },{ id: "rep-onslaught", name: "Onslaught Gatling Cannon", range: '24"', attacks: 12, skill: "3+", strength: 6, AP: -1, damage: 1, special: "Devastating Wounds", points: 0, exclusive: ["rep-las-talon"] },{ id: "rep-fragstorm", name: "Fragstorm Grenade Launchers (x4)", range: '18"', attacks: "D6", skill: "3+", strength: 4, AP: 0, damage: 1, special: "Blast", points: 0 },{ id: "rep-icarus", name: "Icarus Rocket Pod", range: '24"', attacks: "D3", skill: "3+", strength: 8, AP: -1, damage: 2, special: "Anti-FLY 4+", points: 5 }], melee: [{ id: "rep-tracks", name: "Armoured Tracks", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 }] } },
    // DEDICATED TRANSPORT
    { id: "sm-rhino", name: "Rhino", role: "DEDICATED TRANSPORT", points: 75, keywords: ["VEHICLE","TRANSPORT","DEDICATED TRANSPORT","IMPERIUM","ADEPTUS ASTARTES","SMOKE"], stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Self-repair", description: "Regains 1 lost wound at start of your Command phase." },{ name: "Transport (10)", description: "Transports up to 10 ADEPTUS ASTARTES INFANTRY (TACTICUS or PHOBOS only, not JUMP PACK or TERMINATOR)." }], weapons: { ranged: [{ id: "sm-rh-storm-bolter", name: "Storm Bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 }], melee: [{ id: "sm-rh-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 }] } },
    { id: "sm-impulsor", name: "Impulsor", role: "DEDICATED TRANSPORT", points: 80, keywords: ["VEHICLE","TRANSPORT","DEDICATED TRANSPORT","FLY","IMPERIUM","ADEPTUS ASTARTES","SMOKE"], stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 }, abilities: [{ name: "Smoke", description: "Once per game, -1 to Hit rolls against this model until start of next turn." },{ name: "Assault Vehicle", description: "Units that disembark can still declare a charge the same turn, even if this model moved." },{ name: "Transport (6)", description: "Transports up to 6 ADEPTUS ASTARTES INFANTRY (TACTICUS or PHOBOS only)." }], weapons: { ranged: [{ id: "imp-twin-storm-bolter", name: "Twin Storm Bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2, Twin-linked", points: 0 }], melee: [{ id: "imp-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 }] } },
  ],
};


// ============================================================
// GAME DATA — TYRANIDS (10th Edition)
// ============================================================
// Source: Codex: Tyranids (September 2023), Wahapedia 10th ed.,
// Munitorum Field Manual 2024. 47 core datasheets.
// Cross-reference the latest GW points document for tournament play.
// Note: Tyranids have no Marks, no Enhancements in the traditional sense
// (they use Hyper-Adaptations and Hive Fleet Adaptations instead).

const TYR_DATA = {
  id: "tyr",
  name: "Tyranids",
  shortName: "TYR",
  color: "#4a0070",
  accentColor: "#c060e0",
  tagline: "The Great Devourer Hungers",
  icon: "🦠",

  armyRule: {
    name: "Shadow in the Warp",
    description: "At the start of the Command phase, if one or more TYRANIDS units from your army are on the battlefield, roll 2D6. If the result is equal to or greater than 9, or if one or more SYNAPSE units from your army are within 12\" of any enemy unit, each enemy unit on the battlefield must take a Battle-shock test. Subtract 1 from each Battle-shock test taken as a result of this ability. In addition, each time a PSYKER unit takes a Psychic test, add 1 to the roll.",
  },

  detachments: [
    {
      name: "Invasion Fleet", dpCost: 3, forceDisposition: "Take and Hold",
      rule: "Synaptic Imperatives: At the start of your Command phase, select one Synaptic Imperative. Until the start of your next Command phase, that Imperative is active for all TYRANIDS units: Aggressive Surge (+3\" to Advance and Charge rolls), Defensive Adaptation (+1 to saving throws in the Fight phase), or Feeding Frenzy (+1 Attack for melee weapons when a charge is made).",
    },
    {
      name: "Crusher Stampede", dpCost: 2, forceDisposition: "Purge the Foe",
      rule: "Hyper-rage: Each time a TYRANIDS MONSTER unit from your army is selected to fight, if it is below its Starting Strength, add 1 to the Hit rolls for its melee weapons. If it is Below Half-strength, add 1 to the Wound rolls as well.",
    },
    {
      name: "Unending Swarm", dpCost: 2, forceDisposition: "Take and Hold",
      rule: "Endless Multitudes: Once per turn, at the start of your Command phase, select one friendly TYRANIDS BATTLELINE unit from your army that has the Endless Multitudes ability. Return D6+2 destroyed models to that unit.",
    },
    {
      name: "Assimilation Swarm", dpCost: 2, forceDisposition: "Take and Hold",
      rule: "Feed the Swarm: At the start of your Command phase, each friendly HARVESTER unit can regenerate: return 1 destroyed non-CHARACTER INFANTRY model to a friendly TYRANIDS unit within 6\", or a MONSTER within 6\" regains D3+1 lost wounds.",
    },
    {
      name: "Vanguard Onslaught", dpCost: 2, forceDisposition: "Reconnaissance",
      rule: "Seeded Broods: During deployment, up to 3 TYRANIDS INFANTRY units from your army can be set up anywhere on the battlefield more than 9\" from all enemy units (instead of in your deployment zone). In addition, the first time each VANGUARD unit attacks each turn, enemy units cannot use the Overwatch or Set to Defend reactions against it.",
    },
    {
      name: "Synaptic Nexus", dpCost: 2, forceDisposition: "Priority Assets",
      rule: "Psychostatic Disruption: At the start of your opponent's Command phase, if one or more friendly SYNAPSE units are within 12\" of any enemy unit, subtract 1 from the Leadership characteristic of all enemy units until the end of the phase. Enemy units within 6\" of a SYNAPSE unit subtract 2 instead.",
    },
  ],

  enhancements: [
    { id: "tyr-e1", detachment: "Invasion Fleet", name: "Adaptive Biology", points: 25, description: "The bearer has the Feel No Pain 5+ ability. At the start of any turn, if the bearer has fewer than its starting wounds, it gains Feel No Pain 4+ instead." },
    { id: "tyr-e2", detachment: "Invasion Fleet", name: "Perfectly Adapted", points: 15, description: "Once per turn, re-roll one Hit roll, Wound roll, Damage roll, Advance roll, Charge roll, or saving throw made for the bearer." },
    { id: "tyr-e3", detachment: "Synaptic Nexus", name: "Synaptic Linchpin", points: 20, description: "While a friendly TYRANIDS unit is within 9\" of the bearer, that unit is within Synapse Range." },
    { id: "tyr-e4", detachment: "Crusher Stampede", name: "Elevated Might", points: 30, description: "The bearer's unit can declare a charge even in a turn when it has Advanced." },
    { id: "tyr-e5", detachment: "Vanguard Onslaught", name: "Ocular Adaptation", points: 20, description: "Add 1 to Hit rolls for models in the bearer's unit. (Winged Tyranid Prime only)" },
    { id: "tyr-e6", detachment: "Synaptic Nexus", name: "Synaptic Tyrant", points: 10, description: "During the Declare Battle Formations step, the bearer (Neurotyrant only) can join a Tyranid Warriors unit, extending its Synapse Range and providing protection." },
  ],

  stratagems: [
    { id: "tyr-s1", detachment: "Vanguard Onslaught", name: "Lurk and Strike", cost: "1 CP", phase: "Movement Phase", description: "Use when a TYRANIDS INFANTRY unit is chosen to move. Remove that unit from the battlefield and place it into Strategic Reserves. It returns in the Reinforcements step of any subsequent Movement phase using the Deep Strike ability." },
    { id: "tyr-s2", detachment: "Invasion Fleet", name: "Voracious Appetite", cost: "1 CP", phase: "Fight Phase", description: "Use when a TYRANIDS unit is chosen to fight. Until the end of the phase, each time a model in that unit makes a melee attack, an unmodified Hit roll of 6 scores 1 additional hit." },
    { id: "tyr-s3", detachment: "Vanguard Onslaught", name: "Aggressive Surge", cost: "1 CP", phase: "Movement Phase", description: "Use when a TYRANIDS unit is chosen to Advance. Add 3\" to the result of the Advance roll for that unit. Until the end of the turn, the unit can still shoot (with Assault weapons) and charge." },
    { id: "tyr-s4", detachment: "Synaptic Nexus", name: "Synaptic Feedback", cost: "2 CP", phase: "Any Phase", description: "Use when an enemy unit targets a SYNAPSE unit from your army. Until the end of the phase, each time that enemy unit makes an attack that targets your unit, on an unmodified Hit roll of 1, the attacking model's unit suffers 1 mortal wound." },
    { id: "tyr-s5", detachment: "Crusher Stampede", name: "Bioweapon Barrage", cost: "1 CP", phase: "Shooting Phase", description: "Use when a TYRANIDS unit is chosen to shoot. Until the end of the phase, ranged weapons equipped by models in that unit gain the Devastating Wounds ability." },
    { id: "tyr-s6", detachment: "Crusher Stampede", name: "Rampaging Monstrosities", cost: "1 CP", phase: "Fight Phase", description: "Use when a TYRANIDS MONSTER unit is chosen to fight. Until the end of the phase, re-roll Hit rolls for that unit's melee weapons." },
    { id: "tyr-s7", detachment: "Invasion Fleet", name: "Instinctive Behaviour", cost: "1 CP", phase: "Any Phase", description: "Use when a TYRANIDS unit that is not within Synapse Range would fail a Battle-shock test. That unit does not fail the Battle-shock test." },
    { id: "tyr-s8", detachment: "Unending Swarm", name: "Corrosive Viscera", cost: "1 CP", phase: "Any Phase", description: "Use when a TYRANIDS MONSTER unit is destroyed. Roll D6 for each unit within 6\": on a 2+, that unit suffers D3 mortal wounds as biomatter detonates." },
  ],

  // Tyranids do not use Marks of Chaos
  marks: [],

  units: [

    // ══════════════════════════════════════════
    // CHARACTERS
    // ══════════════════════════════════════════
    {
      id: "tyr-hive-tyrant",
      name: "Hive Tyrant",
      role: "CHARACTER",
      points: 230,
      keywords: ["CHARACTER","MONSTER","PSYKER","SYNAPSE","TYRANIDS","HIVE TYRANT"],
      stats: { M: '8"', T: 9, Sv: "2+", W: 10, Ld: "6+", OC: 3, Inv: "4+" },
      abilities: [
        { name: "Will of the Hive Mind", description: "Once per turn, when a Stratagem would be used targeting a friendly TYRANIDS unit within 6\", that Stratagem costs 0 CP (used once per turn only)." },
        { name: "Synaptic Imperative", description: "This unit has the SYNAPSE keyword. TYRANIDS units within 12\" are always considered within Synapse Range." },
        { name: "Warlord", description: "This model can be your WARLORD." },
      ],
      weapons: {
        ranged: [
          { id: "ht-venom-cannon", name: "Venom Cannon", range: '36"', attacks: "D3", skill: "2+", strength: 9, AP: -2, damage: 3, special: "Blast", points: 0, exclusive: ["ht-stranglethorn"] },
          { id: "ht-stranglethorn", name: "Stranglethorn Cannon", range: '36"', attacks: "D6+1", skill: "2+", strength: 7, AP: -1, damage: 2, special: "Blast", points: 0, exclusive: ["ht-venom-cannon"] },
        ],
        melee: [
          { id: "ht-bonesword-whip", name: "Bonesword & Lash Whip", attacks: 6, skill: "2+", strength: 9, AP: -2, damage: 3, special: "Twin-linked", points: 0, exclusive: ["ht-scything-talons", "ht-tyrant-talons"] },
          { id: "ht-scything-talons", name: "Scything Talons (pair)", attacks: 4, skill: "2+", strength: 7, AP: -2, damage: 2, special: "Twin-linked", points: 0, exclusive: ["ht-bonesword-whip", "ht-tyrant-talons"] },
          { id: "ht-tyrant-talons", name: "Tyrant Talons", attacks: 5, skill: "2+", strength: 7, AP: -2, damage: 2, special: "—", points: 5, exclusive: ["ht-bonesword-whip", "ht-scything-talons"] },
        ],
      },
    },
    {
      id: "tyr-winged-hive-tyrant",
      name: "Winged Hive Tyrant",
      role: "CHARACTER",
      points: 255,
      keywords: ["CHARACTER","MONSTER","FLY","PSYKER","SYNAPSE","TYRANIDS","HIVE TYRANT"],
      stats: { M: '12"', T: 9, Sv: "2+", W: 10, Ld: "6+", OC: 3, Inv: "4+" },
      abilities: [
        { name: "Will of the Hive Mind", description: "Once per turn, when a Stratagem would be used targeting a friendly TYRANIDS unit within 6\", that Stratagem costs 0 CP." },
        { name: "Synaptic Imperative", description: "SYNAPSE unit. TYRANIDS units within 12\" are always considered within Synapse Range." },
        { name: "Death Throes", description: "Each time this model is destroyed, roll 1D6: on a 4+, each unit within 6\" suffers D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "wht-venom-cannon", name: "Venom Cannon", range: '36"', attacks: "D3", skill: "2+", strength: 9, AP: -2, damage: 3, special: "Blast", points: 0 },
        ],
        melee: [
          { id: "wht-monstrous-bonesword", name: "Monstrous Bonesword", attacks: 6, skill: "2+", strength: 9, AP: -2, damage: 3, special: "—", points: 0, exclusive: ["wht-scything-talons"] },
          { id: "wht-scything-talons", name: "Scything Talons", attacks: 4, skill: "2+", strength: 7, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["wht-monstrous-bonesword"] },
          { id: "wht-prehensile-tail", name: "Prehensile Pincer Tail", attacks: 2, skill: "2+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-swarmlord",
      name: "The Swarmlord",
      role: "CHARACTER",
      points: 310,
      keywords: ["CHARACTER","MONSTER","PSYKER","SYNAPSE","EPIC HERO","TYRANIDS","THE SWARMLORD"],
      stats: { M: '8"', T: 10, Sv: "2+", W: 14, Ld: "5+", OC: 4, Inv: "4+" },
      abilities: [
        { name: "Hive Commander", description: "Once per battle round, at the start of your Movement phase, select one friendly TYRANIDS unit within 24\". That unit can immediately make a Normal move of up to 6\" as if it were the Movement phase." },
        { name: "Will of the Hive Mind", description: "Once per turn, one Stratagem targeting a TYRANIDS unit within 6\" costs 0 CP." },
        { name: "Synaptic Nexus", dpCost: 2, forceDisposition: "Priority Assets", description: "SYNAPSE keyword. All TYRANIDS units within 18\" are considered within Synapse Range." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "swl-bone-sabres", name: "Bone Sabres (pair)", attacks: 8, skill: "2+", strength: 10, AP: -3, damage: 3, special: "Devastating Wounds, Twin-linked", points: 0 },
        ],
      },
    },
    {
      id: "tyr-neurotyrant",
      name: "Neurotyrant",
      role: "CHARACTER",
      points: 105,
      keywords: ["CHARACTER","MONSTER","PSYKER","SYNAPSE","TYRANIDS","NEUROTYRANT"],
      stats: { M: '8"', T: 8, Sv: "3+", W: 7, Ld: "6+", OC: 2, Inv: "4+" },
      abilities: [
        { name: "Psychic Barrage (Aura)", description: "Each time a friendly TYRANIDS PSYKER unit within 6\" would perform a Psychic Ritual, add 1 to the result of each D6 rolled." },
        { name: "Synaptic Relay", description: "SYNAPSE keyword. Friendly TYRANIDS units within 9\" are in Synapse Range." },
      ],
      weapons: {
        ranged: [
          { id: "nt-psychic-scream", name: "Psychic Scream", range: '18"', attacks: "D6", skill: "2+", strength: 5, AP: -1, damage: 1, special: "Psychic, Ignores Cover", points: 0 },
        ],
        melee: [
          { id: "nt-talons", name: "Neurotyrant Talons", attacks: 5, skill: "3+", strength: 6, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-broodlord",
      name: "Broodlord",
      role: "CHARACTER",
      points: 100,
      keywords: ["CHARACTER","INFANTRY","PSYKER","SYNAPSE","TYRANIDS","BROODLORD"],
      stats: { M: '8"', T: 5, Sv: "4+", W: 6, Ld: "6+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Genestealer's Kiss", description: "While this model is leading a unit of GENESTEALERS, each time a model in that unit makes a melee attack, an unmodified Hit roll of 6 generates 1 additional hit." },
        { name: "Synaptic Bond", description: "SYNAPSE keyword. Friendly GENESTEALERS units within 6\" do not need to take Battle-shock tests." },
        { name: "Alien Cunning", description: "This unit can be deployed using the Infiltrators ability (more than 9\" from enemy deployment zone and all enemy units)." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "bl-massive-scything-talons", name: "Massive Scything Talons (pair)", attacks: 7, skill: "2+", strength: 7, AP: -3, damage: 2, special: "Twin-linked, Devastating Wounds", points: 0 },
        ],
      },
    },
    {
      id: "tyr-tervigon",
      name: "Tervigon",
      role: "CHARACTER",
      points: 195,
      keywords: ["CHARACTER","MONSTER","SYNAPSE","TYRANIDS","TERVIGON"],
      stats: { M: '7"', T: 11, Sv: "3+", W: 14, Ld: "6+", OC: 4 },
      abilities: [
        { name: "Spawn Termagants", description: "At the start of your Command phase, if this unit is on the battlefield, you can add a unit of 10 TERMAGANTS to your army. Set them up anywhere within 6\" of this model and more than 1\" from enemy units." },
        { name: "Brood Progenitor", description: "While this model is within 6\" of any friendly TERMAGANTS units, add 1 to the Attacks of melee weapons equipped by models in those units." },
        { name: "SYNAPSE", description: "Friendly TYRANIDS units within 12\" are always in Synapse Range." },
      ],
      weapons: {
        ranged: [
          { id: "ter-stranglethorn", name: "Stranglethorn Cannon", range: '36"', attacks: "D6+1", skill: "3+", strength: 7, AP: -1, damage: 2, special: "Blast", points: 0 },
        ],
        melee: [
          { id: "ter-crushing-claws", name: "Crushing Claws", attacks: 5, skill: "3+", strength: 10, AP: -2, damage: 3, special: "—", points: 0 },
          { id: "ter-massive-scything-talons", name: "Massive Scything Talons", attacks: 4, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-old-one-eye",
      name: "Old One Eye",
      role: "CHARACTER",
      points: 165,
      keywords: ["CHARACTER","MONSTER","EPIC HERO","TYRANIDS","CARNIFEX","OLD ONE EYE"],
      stats: { M: '7"', T: 10, Sv: "2+", W: 10, Ld: "7+", OC: 3 },
      abilities: [
        { name: "Regeneration", description: "At the start of each of your Command phases, this model regains up to D3 lost wounds." },
        { name: "Enraged Thrashing", description: "While this model has fewer wounds remaining than its starting wounds, add 1 to the Attacks characteristic of its melee weapons." },
        { name: "Warlord of the Swarm", description: "While this model is on the battlefield, all friendly CARNIFEX units within 6\" gain +1 to their Hit rolls." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "ooe-crushing-claws", name: "Crushing Claws (pair)", attacks: 6, skill: "4+", strength: 12, AP: -3, damage: "D6", special: "Twin-linked", points: 0 },
          { id: "ooe-scything-talons", name: "Scything Talons (pair)", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "Twin-linked", points: 0 },
        ],
      },
    },
    {
      id: "tyr-winged-prime",
      name: "Winged Tyranid Prime",
      role: "CHARACTER",
      points: 85,
      keywords: ["CHARACTER","INFANTRY","FLY","SYNAPSE","TYRANIDS","WINGED TYRANID PRIME"],
      stats: { M: '12"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Adaptive Leader", description: "While this model is leading a unit, each time a model in that unit makes a melee or ranged attack, re-roll a Hit roll of 1." },
        { name: "SYNAPSE", description: "Friendly TYRANIDS units within 6\" are always in Synapse Range." },
      ],
      weapons: {
        ranged: [
          { id: "wp-devourer", name: "Devourer", range: '18"', attacks: 3, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "wp-bonesword-lash", name: "Bonesword & Lash Whip", attacks: 5, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Twin-linked", points: 0, exclusive: ["wp-scything-talons"] },
          { id: "wp-scything-talons", name: "Scything Talons (pair)", attacks: 5, skill: "3+", strength: 5, AP: -1, damage: 1, special: "Twin-linked", points: 0, exclusive: ["wp-bonesword-lash"] },
        ],
      },
    },
    {
      id: "tyr-deathleaper",
      name: "Deathleaper",
      role: "CHARACTER",
      points: 80,
      keywords: ["CHARACTER","INFANTRY","INFILTRATORS","EPIC HERO","TYRANIDS","LICTOR","DEATHLEAPER"],
      stats: { M: '8"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Terror Made Flesh", description: "Each time this model destroys an enemy CHARACTER, that unit's army loses 1 CP (to a minimum of 0)." },
        { name: "It's Behind You!", description: "Once per battle, at the start of the Fight phase, select one enemy unit within Engagement Range. That unit cannot make attacks this phase." },
        { name: "Prey Spoor Toxins", description: "Each time this model makes a melee attack, an unmodified Wound roll of 5+ causes 1 additional mortal wound." },
        { name: "Lone Operative", description: "While this model is not leading a unit, it cannot be targeted by ranged attacks unless the attacking model is within 12\"." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "dl-rending-claws", name: "Rending Claws & Talons", attacks: 8, skill: "2+", strength: 6, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-parasite-mortrex",
      name: "Parasite of Mortrex",
      role: "CHARACTER",
      points: 65,
      keywords: ["CHARACTER","INFANTRY","FLY","TYRANIDS","PARASITE OF MORTREX"],
      stats: { M: '12"', T: 4, Sv: "4+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Parasitic Implantation", description: "Each time this model destroys an enemy INFANTRY or BEAST model with a melee attack, add 1 to the Ripper Swarms count for this army. At the end of the Fight phase, if the count is 3+, add one unit of 3 RIPPER SWARMS to your army anywhere within 6\" of this model." },
        { name: "Lone Operative", description: "While not leading a unit, cannot be targeted by ranged attacks unless the attacker is within 12\"." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "pm-claws-stinger", name: "Claws & Stinger", attacks: 6, skill: "3+", strength: 5, AP: -2, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-norn-emissary",
      name: "Norn Emissary",
      role: "CHARACTER",
      points: 210,
      keywords: ["CHARACTER","MONSTER","SYNAPSE","TYRANIDS","NORN EMISSARY"],
      stats: { M: '8"', T: 11, Sv: "2+", W: 12, Ld: "5+", OC: 5, Inv: "5+" },
      abilities: [
        { name: "Norn Directive", description: "Once per battle, at the start of your Command phase, select one friendly TYRANIDS unit within 12\". Until the end of the turn, add 1 to the Wound rolls of that unit's attacks." },
        { name: "Synaptic Beacon", description: "SYNAPSE keyword. Friendly TYRANIDS units within 18\" are always in Synapse Range." },
        { name: "Resilient Carapace", description: "Each time an attack is allocated to this model, subtract 1 from the Damage characteristic (minimum 1)." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "ne-bio-electric", name: "Bio-electric Pulse", range: '24"', attacks: 6, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "ne-rending-claws", name: "Massive Rending Claws", attacks: 7, skill: "3+", strength: 12, AP: -3, damage: 3, special: "Anti-MONSTER 4+, Anti-VEHICLE 4+", points: 0 },
        ],
      },
    },

    // ══════════════════════════════════════════
    // BATTLELINE
    // ══════════════════════════════════════════
    {
      id: "tyr-termagants",
      name: "Termagants",
      role: "BATTLELINE",
      points: 60,
      baseSize: 10,
      keywords: ["INFANTRY","BATTLELINE","ENDLESS MULTITUDES","TYRANIDS","TERMAGANTS"],
      stats: { M: '6"', T: 3, Sv: "5+", W: 1, Ld: "8+", OC: 2 },
      abilities: [
        { name: "Endless Multitudes", description: "This unit can have up to 20 models. If it contains 11+ models when mustered, add 1 to the OC of each model." },
        { name: "Skulking Horror", description: "Each time an enemy unit targets this unit with a ranged attack while this unit is within 3\" of a terrain feature, add 1 to the saving throw." },
      ],
      weapons: {
        ranged: [
          { id: "tg-fleshborer", name: "Fleshborer", range: '18"', attacks: 1, skill: "4+", strength: 5, AP: 0, damage: 1, special: "Assault", points: 0 },
          { id: "tg-devourer", name: "Devourer", range: '18"', attacks: 3, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Assault", points: 0, exclusive: ["tg-fleshborer"] },
          { id: "tg-spinefists", name: "Spinefists (pair)", range: '12"', attacks: 2, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Pistol, Twin-linked", points: 0, exclusive: ["tg-fleshborer"] },
          { id: "tg-shardlauncher", name: "Shardlauncher", range: '24"', attacks: 2, skill: "4+", strength: 4, AP: -1, damage: 1, special: "Assault, Lethal Hits", points: 5, exclusive: ["tg-fleshborer"], limit: 2 },
        ],
        melee: [
          { id: "tg-claws", name: "Termagant Claws & Teeth", attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-hormagaunts",
      name: "Hormagaunts",
      role: "BATTLELINE",
      points: 60,
      baseSize: 10,
      keywords: ["INFANTRY","BATTLELINE","ENDLESS MULTITUDES","TYRANIDS","HORMAGAUNTS"],
      stats: { M: '8"', T: 3, Sv: "5+", W: 1, Ld: "8+", OC: 2 },
      abilities: [
        { name: "Endless Multitudes", description: "This unit can have up to 20 models." },
        { name: "Bounding Leap", description: "Each time this unit makes a charge move, add 2\" to the Charge roll result." },
        { name: "Metabolic Overdrive", description: "This unit can move 8\" and can Advance and charge in the same turn." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "hg-hormagaunt-talons", name: "Hormagaunt Talons", attacks: 3, skill: "4+", strength: 3, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-gargoyles",
      name: "Gargoyles",
      role: "BATTLELINE",
      points: 65,
      baseSize: 10,
      keywords: ["INFANTRY","BATTLELINE","FLY","ENDLESS MULTITUDES","TYRANIDS","GARGOYLES"],
      stats: { M: '12"', T: 3, Sv: "5+", W: 1, Ld: "8+", OC: 2 },
      abilities: [
        { name: "Endless Multitudes", description: "This unit can have up to 20 models." },
        { name: "Swooping Dive", description: "Each time this unit makes a charge move, until the end of the turn, add 1 to the Attacks of this unit's melee weapons." },
        { name: "Blinding Venom", description: "Once per fight, after this unit fights, select one enemy unit within Engagement Range and within 3\": until the end of the turn, that enemy unit's Hit rolls are not improved by any modifiers." },
      ],
      weapons: {
        ranged: [
          { id: "gar-fleshborer", name: "Fleshborer", range: '18"', attacks: 1, skill: "4+", strength: 5, AP: 0, damage: 1, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "gar-blinding-claws", name: "Blinding Claws", attacks: 2, skill: "4+", strength: 3, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },

    // ══════════════════════════════════════════
    // ELITE / OTHER INFANTRY
    // ══════════════════════════════════════════
    {
      id: "tyr-genestealers",
      name: "Genestealers",
      role: "ELITE",
      points: 150,
      baseSize: 10,
      keywords: ["INFANTRY","CORE","TYRANIDS","GENESTEALERS"],
      stats: { M: '8"', T: 4, Sv: "5+", W: 2, Ld: "6+", OC: 1, Inv: "5+" },
      abilities: [
        { name: "Lightning Reflexes", description: "This unit has a 5+ invulnerable save." },
        { name: "Alien Cunning", description: "During deployment, this unit can be set up anywhere on the battlefield more than 9\" from enemy deployment zone and all enemy units (Infiltrators)." },
        { name: "Pheromone Trail", description: "The first time this unit is selected to fight each battle round, add 1 to the Attacks of its melee weapons." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "gs-rending-claws", name: "Rending Claws", attacks: 4, skill: "3+", strength: 4, AP: -2, damage: 1, special: "Anti-INFANTRY 4+", points: 0 },
          { id: "gs-scything-talons", name: "Scything Talons", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-tyranid-warriors-melee",
      name: "Tyranid Warriors (Melee)",
      role: "ELITE",
      points: 105,
      baseSize: 3,
      keywords: ["INFANTRY","CORE","SYNAPSE","TYRANIDS","TYRANID WARRIORS"],
      stats: { M: '7"', T: 5, Sv: "4+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "SYNAPSE", description: "Friendly TYRANIDS units within 6\" are always in Synapse Range." },
        { name: "Adaptive Physiology", description: "Each time this unit is selected to fight, if it is below Starting Strength, add 1 to the Attacks of its melee weapons." },
      ],
      weapons: {
        ranged: [
          { id: "twm-deathspitter", name: "Deathspitter", range: '24"', attacks: 3, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "twm-bonesword-lash", name: "Bonesword & Lash Whip", attacks: 3, skill: "4+", strength: 6, AP: -2, damage: 2, special: "Twin-linked", points: 0, exclusive: ["twm-dual-boneswords"] },
          { id: "twm-dual-boneswords", name: "Dual Boneswords", attacks: 4, skill: "4+", strength: 5, AP: -2, damage: 1, special: "Lethal Hits", points: 0, exclusive: ["twm-bonesword-lash"] },
        ],
      },
    },
    {
      id: "tyr-tyranid-warriors-ranged",
      name: "Tyranid Warriors (Ranged)",
      role: "ELITE",
      points: 105,
      baseSize: 3,
      keywords: ["INFANTRY","CORE","SYNAPSE","TYRANIDS","TYRANID WARRIORS"],
      stats: { M: '7"', T: 5, Sv: "4+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "SYNAPSE", description: "Friendly TYRANIDS units within 6\" are always in Synapse Range." },
        { name: "Tactical Fire", description: "Models in this unit do not suffer the penalty to Hit rolls for moving and shooting Heavy weapons." },
      ],
      weapons: {
        ranged: [
          { id: "twr-venom-cannon", name: "Venom Cannon", range: '36"', attacks: "D3", skill: "4+", strength: 9, AP: -2, damage: 3, special: "Blast", points: 0, exclusive: ["twr-barbed-strangler", "twr-deathspitter", "twr-devourer"] },
          { id: "twr-barbed-strangler", name: "Barbed Strangler", range: '24"', attacks: "D6", skill: "4+", strength: 5, AP: -1, damage: 1, special: "Blast, Lethal Hits", points: 0, exclusive: ["twr-venom-cannon", "twr-deathspitter", "twr-devourer"] },
          { id: "twr-deathspitter", name: "Deathspitter", range: '24"', attacks: 3, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0, exclusive: ["twr-venom-cannon", "twr-barbed-strangler", "twr-devourer"] },
          { id: "twr-devourer", name: "Devourer (pair)", range: '18"', attacks: 6, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Assault, Twin-linked", points: 0, exclusive: ["twr-venom-cannon", "twr-barbed-strangler", "twr-deathspitter"] },
        ],
        melee: [
          { id: "twr-scything-talons", name: "Scything Talons (pair)", attacks: 2, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Twin-linked", points: 0 },
        ],
      },
    },
    {
      id: "tyr-zoanthropes",
      name: "Zoanthropes",
      role: "ELITE",
      points: 80,
      baseSize: 3,
      keywords: ["INFANTRY","PSYKER","SYNAPSE","TYRANIDS","ZOANTHROPES"],
      stats: { M: '5"', T: 4, Sv: "5+", W: 3, Ld: "6+", OC: 1, Inv: "3+" },
      abilities: [
        { name: "Warp Field", description: "This unit has a 3+ invulnerable save." },
        { name: "Synapse Conduit", description: "SYNAPSE keyword. Friendly TYRANIDS units within 6\" are always in Synapse Range." },
        { name: "Warp Blast", description: "At the start of your Shooting phase, this unit can make a Warp Blast attack: roll 1D6 per model. Each result of 4+: select one enemy unit within 18\" — that unit suffers 1 mortal wound." },
      ],
      weapons: {
        ranged: [
          { id: "zo-neurothrope-beam", name: "Warp Blast Beam", range: '18"', attacks: 3, skill: "3+", strength: 8, AP: -3, damage: "D3", special: "Psychic, Devastating Wounds", points: 0 },
        ],
        melee: [
          { id: "zo-claws", name: "Claws & Teeth", attacks: 2, skill: "4+", strength: 4, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-lictor",
      name: "Lictor",
      role: "ELITE",
      points: 65,
      keywords: ["INFANTRY","TYRANIDS","LICTOR"],
      stats: { M: '8"', T: 5, Sv: "3+", W: 4, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Chameleonic Skin", description: "While this model is not within Engagement Range of any enemy unit, it cannot be targeted by ranged attacks unless the attacking model is within 12\"." },
        { name: "Pheromone Trail", description: "At the start of the Reinforcements step of your Movement phase, if this model is on the battlefield, you can select one TYRANIDS unit that is in Strategic Reserves. Set it up within 6\" of this model (and more than 3\" from enemy units)." },
        { name: "Feeder Tendrils", description: "Each time this model destroys an enemy model, you gain 1 CP (to a maximum of 1 per phase)." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "li-rending-claws", name: "Rending Claws & Talons", attacks: 7, skill: "3+", strength: 7, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-von-ryans-leapers",
      name: "Von Ryan's Leapers",
      role: "ELITE",
      points: 75,
      baseSize: 3,
      keywords: ["INFANTRY","TYRANIDS","VON RYAN'S LEAPERS"],
      stats: { M: '10"', T: 4, Sv: "3+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Fights First", description: "This unit has the Fights First ability." },
        { name: "Pouncing Leap", description: "Each time this unit makes a charge move, add 2\" to the result. This unit has the Fights First ability when it charges." },
        { name: "Alien Cunning", description: "During deployment, this unit can be set up anywhere more than 9\" from enemy deployment zone and all enemy units (Infiltrators)." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "vrl-leaper-talons", name: "Leaper Talons", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-raveners",
      name: "Raveners",
      role: "ELITE",
      points: 90,
      baseSize: 3,
      keywords: ["INFANTRY","TYRANIDS","RAVENERS"],
      stats: { M: '10"', T: 5, Sv: "4+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Burrowing Assault", description: "At the start of the Reinforcements step of your Movement phase, if this unit is set up underground, you can set it up anywhere on the battlefield more than 9\" from all enemy units (Deep Strike)." },
        { name: "Swift & Deadly", description: "Each time this unit makes a charge move, until the end of the turn, add 1 to the Attacks of its melee weapons." },
      ],
      weapons: {
        ranged: [
          { id: "rav-deathspitter", name: "Deathspitter (pair)", range: '24"', attacks: 3, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault, Twin-linked", points: 0 },
        ],
        melee: [
          { id: "rav-scything-talons", name: "Scything Talons (pair)", attacks: 5, skill: "3+", strength: 5, AP: -1, damage: 1, special: "Twin-linked", points: 0 },
        ],
      },
    },
    {
      id: "tyr-venomthropes",
      name: "Venomthropes",
      role: "ELITE",
      points: 70,
      baseSize: 3,
      keywords: ["INFANTRY","TYRANIDS","VENOMTHROPES"],
      stats: { M: '6"', T: 5, Sv: "4+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Toxic Miasma (Aura)", description: "While a friendly TYRANIDS unit is within 6\" of this unit, each time a model in that unit makes a melee attack, the target does not receive the benefit of cover against that attack." },
        { name: "Shrouding Spores (Aura)", description: "While a friendly TYRANIDS unit is within 6\" of this unit, add 1 to the saving throw of models in that unit against ranged attacks." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "vt-lash-whips", name: "Lash Whips & Tendrils", attacks: 4, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-neurogaunts",
      name: "Neurogaunts",
      role: "ELITE",
      points: 40,
      baseSize: 10,
      keywords: ["INFANTRY","ENDLESS MULTITUDES","TYRANIDS","NEUROGAUNTS"],
      stats: { M: '6"', T: 3, Sv: "6+", W: 1, Ld: "7+", OC: 2 },
      abilities: [
        { name: "Endless Multitudes", description: "This unit can have up to 20 models." },
        { name: "Synaptic Conduit", description: "While this unit is within 6\" of a SYNAPSE unit, add 1 to the OC of models in this unit." },
        { name: "Reactive Swarm", description: "Each time this unit is targeted by a ranged attack, if the attacking model is more than 12\" away, add 1 to the saving throw." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "ng-synaptic-claws", name: "Synaptic Claws", attacks: 2, skill: "5+", strength: 3, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-hive-guard",
      name: "Hive Guard",
      role: "ELITE",
      points: 85,
      baseSize: 3,
      keywords: ["INFANTRY","TYRANIDS","HIVE GUARD"],
      stats: { M: '5"', T: 5, Sv: "3+", W: 3, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Shieldwall", description: "Each time a ranged attack targets a SYNAPSE unit within 3\" of this unit, this unit can intercept that attack. Make a saving throw for the model in this unit closest to the target (use this unit's profile)." },
        { name: "Wireless Targeting", description: "This unit can target enemy units it cannot see, provided a friendly SYNAPSE model can see the target unit." },
      ],
      weapons: {
        ranged: [
          { id: "hg-impaler-cannon", name: "Impaler Cannon", range: '36"', attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 3, special: "Heavy, Indirect Fire", points: 0, exclusive: ["hg-shockcannon"] },
          { id: "hg-shockcannon", name: "Shockcannon", range: '36"', attacks: 3, skill: "4+", strength: 8, AP: -1, damage: 2, special: "Heavy, Devastating Wounds", points: 0, exclusive: ["hg-impaler-cannon"] },
        ],
        melee: [
          { id: "hg-claws", name: "Claws & Teeth", attacks: 2, skill: "4+", strength: 5, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-ripper-swarms",
      name: "Ripper Swarms",
      role: "ELITE",
      points: 40,
      baseSize: 3,
      keywords: ["SWARM","TYRANIDS","RIPPER SWARMS"],
      stats: { M: '5"', T: 3, Sv: "6+", W: 4, Ld: "8+", OC: 4 },
      abilities: [
        { name: "Mindless Feeders", description: "This unit does not need to take Battle-shock tests and cannot be the target of Stratagems." },
        { name: "Objective Secured", description: "If you control an objective at end of Command phase and this unit is within range, it remains under your control until your opponent controls it." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "rs-gnashing-jaws", name: "Gnashing Jaws & Claws", attacks: 6, skill: "5+", strength: 2, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-barbgaunts",
      name: "Barbgaunts",
      role: "ELITE",
      points: 60,
      baseSize: 5,
      keywords: ["INFANTRY","TYRANIDS","BARBGAUNTS"],
      stats: { M: '5"', T: 4, Sv: "4+", W: 1, Ld: "8+", OC: 1 },
      abilities: [
        { name: "Parasitic Barbs", description: "Each time a model in this unit makes a ranged attack, a Hit roll of 6+ inflicts 1 mortal wound on the target (in addition to the normal damage)." },
        { name: "Symbiotic Targeting", description: "Each time this unit is selected to shoot, if a friendly SYNAPSE unit is within 6\", add 1 to Hit rolls for this unit's ranged attacks." },
      ],
      weapons: {
        ranged: [
          { id: "bg-barblauncher", name: "Barblauncher", range: '18"', attacks: 3, skill: "4+", strength: 4, AP: -1, damage: 1, special: "Sustained Hits 1", points: 0 },
        ],
        melee: [
          { id: "bg-claws", name: "Claws & Barbs", attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },

    // ══════════════════════════════════════════
    // MONSTERS / HEAVY
    // ══════════════════════════════════════════
    {
      id: "tyr-carnifex",
      name: "Carnifexes",
      role: "MONSTER",
      points: 95,
      baseSize: 1,
      keywords: ["MONSTER","TYRANIDS","CARNIFEX"],
      stats: { M: '7"', T: 9, Sv: "2+", W: 8, Ld: "7+", OC: 3 },
      abilities: [
        { name: "Living Battering Ram", description: "Each time this model makes a charge move, until the end of the turn, add 1 to the Attacks of its melee weapons." },
        { name: "Berserk Rampage", description: "While this model has fewer wounds remaining than its starting wounds, it gains +1 to its Attacks characteristic." },
      ],
      weapons: {
        ranged: [
          { id: "cfx-twin-devourer", name: "Twin Devourers (pair)", range: '18"', attacks: 12, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Assault, Twin-linked", points: 0, exclusive: ["cfx-twin-stranglethorn", "cfx-bio-plasma", "cfx-venom-cannon"] },
          { id: "cfx-twin-stranglethorn", name: "Twin Stranglethorn Cannons", range: '36"', attacks: "D6+1", skill: "4+", strength: 7, AP: -1, damage: 2, special: "Blast, Twin-linked", points: 5, exclusive: ["cfx-twin-devourer", "cfx-bio-plasma", "cfx-venom-cannon"] },
          { id: "cfx-bio-plasma", name: "Bio-plasma", range: '12"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: 3, special: "Blast, Hazardous", points: 5, exclusive: ["cfx-twin-devourer", "cfx-twin-stranglethorn", "cfx-venom-cannon"] },
          { id: "cfx-venom-cannon", name: "Venom Cannon", range: '36"', attacks: "D3", skill: "4+", strength: 9, AP: -2, damage: 3, special: "Blast", points: 5, exclusive: ["cfx-twin-devourer", "cfx-twin-stranglethorn", "cfx-bio-plasma"] },
        ],
        melee: [
          { id: "cfx-crushing-claws", name: "Crushing Claws (pair)", attacks: 4, skill: "4+", strength: 12, AP: -3, damage: "D6", special: "Twin-linked", points: 0, exclusive: ["cfx-scything-talons", "cfx-monstrous-scything-talons"] },
          { id: "cfx-monstrous-scything-talons", name: "Monstrous Scything Talons (pair)", attacks: 6, skill: "4+", strength: 9, AP: -2, damage: 2, special: "Twin-linked", points: 0, exclusive: ["cfx-crushing-claws", "cfx-scything-talons"] },
          { id: "cfx-scything-talons", name: "Scything Talons (pair)", attacks: 4, skill: "4+", strength: 7, AP: -1, damage: 2, special: "Twin-linked", points: 0, exclusive: ["cfx-crushing-claws", "cfx-monstrous-scything-talons"] },
        ],
      },
    },
    {
      id: "tyr-screamer-killer",
      name: "Screamer-Killer",
      role: "MONSTER",
      points: 115,
      keywords: ["MONSTER","TYRANIDS","CARNIFEX","SCREAMER-KILLER"],
      stats: { M: '7"', T: 9, Sv: "2+", W: 10, Ld: "7+", OC: 3 },
      abilities: [
        { name: "Bio-plasmic Scream", description: "At the start of your Shooting phase, select one enemy unit within 18\". That unit takes D6 mortal wounds (roll separately for each model). Enemy units that lose any models as a result must take a Battle-shock test." },
        { name: "Terrifying Screech", description: "Each time this model makes a charge move, until the end of the turn, all enemy units within 6\" must take a Battle-shock test." },
      ],
      weapons: {
        ranged: [
          { id: "sk-bio-plasmic-scream", name: "Bio-plasmic Scream", range: '18"', attacks: "D6", skill: "4+", strength: 8, AP: -3, damage: 2, special: "Blast, Devastating Wounds", points: 0 },
        ],
        melee: [
          { id: "sk-monstrous-scything-talons", name: "Monstrous Scything Talons (pair)", attacks: 8, skill: "4+", strength: 9, AP: -2, damage: 2, special: "Twin-linked", points: 0 },
        ],
      },
    },
    {
      id: "tyr-tyrannofex",
      name: "Tyrannofex",
      role: "MONSTER",
      points: 210,
      keywords: ["MONSTER","TYRANIDS","TYRANNOFEX"],
      stats: { M: '7"', T: 12, Sv: "2+", W: 14, Ld: "6+", OC: 4 },
      abilities: [
        { name: "Acid Spray", description: "Each time a ranged attack made by this model is resolved against an enemy unit that is within 9\", that attack gains the Ignores Cover ability." },
        { name: "Resilient Carapace", description: "Each time an attack is allocated to this model, subtract 1 from the Damage characteristic (minimum 1)." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "tf-rupture-cannon", name: "Rupture Cannon", range: '48"', attacks: 3, skill: "4+", strength: 14, AP: -3, damage: "D6+2", special: "Heavy", points: 0, exclusive: ["tf-acid-spray", "tf-fleshborer-hive"] },
          { id: "tf-acid-spray", name: "Acid Spray", range: '18"', attacks: "2D6", skill: "Auto", strength: 7, AP: -1, damage: 1, special: "Torrent, Ignores Cover", points: 0, exclusive: ["tf-rupture-cannon", "tf-fleshborer-hive"] },
          { id: "tf-fleshborer-hive", name: "Fleshborer Hive", range: '24"', attacks: 20, skill: "4+", strength: 5, AP: 0, damage: 1, special: "Assault", points: 0, exclusive: ["tf-rupture-cannon", "tf-acid-spray"] },
        ],
        melee: [
          { id: "tf-crushing-claws", name: "Powerful Limbs", attacks: 4, skill: "4+", strength: 9, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-exocrine",
      name: "Exocrine",
      role: "MONSTER",
      points: 185,
      keywords: ["MONSTER","TYRANIDS","EXOCRINE"],
      stats: { M: '6"', T: 11, Sv: "3+", W: 12, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Symbiotic Targeting", description: "Each time this model is selected to shoot, if a friendly SYNAPSE model is within 6\", add 1 to the Hit rolls for this model's ranged attacks." },
        { name: "Indirect Fire", description: "This model's Bio-plasmic Cannon has the Indirect Fire ability when a friendly SYNAPSE model is within 6\"." },
      ],
      weapons: {
        ranged: [
          { id: "exc-bio-plasmic-cannon", name: "Bio-plasmic Cannon", range: '36"', attacks: 6, skill: "4+", strength: 9, AP: -3, damage: 3, special: "Blast", points: 0 },
        ],
        melee: [
          { id: "exc-powerful-limbs", name: "Powerful Limbs", attacks: 3, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-mawloc",
      name: "Mawloc",
      role: "MONSTER",
      points: 115,
      keywords: ["MONSTER","TYRANIDS","MAWLOC"],
      stats: { M: '10"', T: 9, Sv: "3+", W: 10, Ld: "7+", OC: 3 },
      abilities: [
        { name: "Terror From the Deep", description: "The first time this model arrives from underground (Deep Strike), after setting it up, roll 2D6 for each enemy unit within 6\": on an 8+, that unit suffers D3+3 mortal wounds." },
        { name: "Burrow", description: "At the end of your Movement phase, this model can be removed from the battlefield and placed back underground, arriving again in a future turn using Deep Strike." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "ml-gaping-maw", name: "Gaping Maw", attacks: 6, skill: "3+", strength: 10, AP: -3, damage: 3, special: "Anti-INFANTRY 4+", points: 0 },
        ],
      },
    },
    {
      id: "tyr-trygon",
      name: "Trygon",
      role: "MONSTER",
      points: 150,
      keywords: ["MONSTER","TYRANIDS","TRYGON"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 14, Ld: "6+", OC: 4 },
      abilities: [
        { name: "Death From Below", description: "When this model arrives from underground, you can set up one additional TYRANIDS INFANTRY unit within 3\" of this model as if it also arrived from underground." },
        { name: "Tunnel Network", description: "At the start of any of your Movement phases, if this model is on the battlefield, one TYRANIDS INFANTRY unit in Strategic Reserves can arrive anywhere within 6\" of this model." },
      ],
      weapons: {
        ranged: [
          { id: "trg-bio-electric-pulse", name: "Bio-electric Pulse", range: '12"', attacks: 6, skill: "3+", strength: 6, AP: -2, damage: 1, special: "Assault, Pistol", points: 0 },
        ],
        melee: [
          { id: "trg-massive-scything-talons", name: "Massive Scything Talons", attacks: 8, skill: "3+", strength: 9, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-haruspex",
      name: "Haruspex",
      role: "MONSTER",
      points: 155,
      keywords: ["MONSTER","HARVESTER","TYRANIDS","HARUSPEX"],
      stats: { M: '8"', T: 11, Sv: "2+", W: 12, Ld: "7+", OC: 3 },
      abilities: [
        { name: "Digestive Enzymes", description: "Each time this model destroys an enemy model with a melee attack, regain 1 lost wound." },
        { name: "Massive Appetite", description: "Each time this model fights, if it destroys one or more enemy models, add 1 to its Attacks until the end of the phase." },
        { name: "HARVESTER", description: "This unit has the HARVESTER keyword for Assimilation Swarm detachment purposes." },
      ],
      weapons: {
        ranged: [
          { id: "hsp-acid-maw-spray", name: "Acid Maw Spray", range: '12"', attacks: "D6", skill: "Auto", strength: 6, AP: -1, damage: 1, special: "Torrent", points: 0 },
        ],
        melee: [
          { id: "hsp-grasping-tongue", name: "Grasping Tongue", attacks: 3, skill: "4+", strength: 12, AP: -3, damage: "D6", special: "Anti-MONSTER 4+, Anti-VEHICLE 4+", points: 0 },
          { id: "hsp-crushing-claws", name: "Crushing Claws & Talons", attacks: 6, skill: "4+", strength: 9, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-toxicrene",
      name: "Toxicrene",
      role: "MONSTER",
      points: 145,
      keywords: ["MONSTER","TYRANIDS","TOXICRENE"],
      stats: { M: '8"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Hypertoxic Cloud (Aura)", description: "While a friendly TYRANIDS unit is within 6\" of this model, each time a model in that unit makes a melee attack, add 1 to the Wound roll." },
        { name: "Spore Cloud", description: "At the end of the Fight phase, each enemy unit within 3\" of this model suffers D3 mortal wounds on a 3+." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "tox-lash-whips", name: "Massive Lash Whips & Tendrils", attacks: 8, skill: "3+", strength: 6, AP: -1, damage: 2, special: "Lethal Hits", points: 0 },
        ],
      },
    },
    {
      id: "tyr-harpy",
      name: "Harpy",
      role: "MONSTER",
      points: 145,
      keywords: ["MONSTER","FLY","TYRANIDS","HARPY"],
      stats: { M: '16"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Sonic Screech", description: "Once per battle, at the start of the Fight phase, all enemy units within 6\" must take a Battle-shock test." },
        { name: "Spore Mine Cyst", description: "At the start of your Shooting phase, place D3 SPORE MINES within 6\" of this model and more than 3\" from all enemy units." },
        { name: "Strafing Run", description: "Each time this model makes a ranged attack, if it moved this turn, its ranged weapons gain the Assault ability." },
      ],
      weapons: {
        ranged: [
          { id: "hpy-twin-stranglethorn", name: "Twin Stranglethorn Cannon", range: '36"', attacks: "D6+1", skill: "4+", strength: 7, AP: -1, damage: 2, special: "Blast, Twin-linked", points: 0, exclusive: ["hpy-twin-heavy-venom"] },
          { id: "hpy-twin-heavy-venom", name: "Twin Heavy Venom Cannon", range: '48"', attacks: "D3", skill: "4+", strength: 12, AP: -2, damage: 3, special: "Blast, Twin-linked", points: 0, exclusive: ["hpy-twin-stranglethorn"] },
        ],
        melee: [
          { id: "hpy-scything-wings", name: "Scything Wings", attacks: 4, skill: "4+", strength: 7, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-pyrovores",
      name: "Pyrovores",
      role: "MONSTER",
      points: 50,
      baseSize: 1,
      keywords: ["MONSTER","HARVESTER","TYRANIDS","PYROVORES"],
      stats: { M: '7"', T: 6, Sv: "4+", W: 5, Ld: "7+", OC: 2 },
      abilities: [
        { name: "Combustion", description: "When this model is destroyed, roll D6: on a 2+, each unit within 3\" suffers D3 mortal wounds." },
        { name: "HARVESTER", description: "This unit has the HARVESTER keyword." },
      ],
      weapons: {
        ranged: [
          { id: "pyr-flamespurt", name: "Flamespurt", range: '12"', attacks: "D6+1", skill: "Auto", strength: 5, AP: -1, damage: 2, special: "Torrent, Ignores Cover, Devastating Wounds", points: 0 },
        ],
        melee: [
          { id: "pyr-acid-maw", name: "Acid Maw", attacks: 3, skill: "4+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-norn-assimilator",
      name: "Norn Assimilator",
      role: "MONSTER",
      points: 190,
      keywords: ["MONSTER","HARVESTER","SYNAPSE","TYRANIDS","NORN ASSIMILATOR"],
      stats: { M: '7"', T: 11, Sv: "2+", W: 12, Ld: "5+", OC: 5, Inv: "5+" },
      abilities: [
        { name: "Biophagic Flow", description: "At the start of your Command phase, if this model destroyed one or more enemy models last turn, it regains D3+1 lost wounds." },
        { name: "Adaptive Absorption", description: "Each time this model destroys an enemy MONSTER or VEHICLE, it gains one of: +1T, +1W, or +1 Attacks for the rest of the battle (you choose each time)." },
        { name: "SYNAPSE", description: "Friendly TYRANIDS units within 12\" are always in Synapse Range." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "na-bio-electric", name: "Bio-electric Pulse", range: '24"', attacks: 6, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "na-biophagic-claws", name: "Biophagic Claws", attacks: 6, skill: "3+", strength: 12, AP: -3, damage: 3, special: "Anti-MONSTER 4+, Anti-VEHICLE 4+", points: 0 },
          { id: "na-stomping-feet", name: "Stomping Feet", attacks: 3, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-psychophage",
      name: "Psychophage",
      role: "MONSTER",
      points: 135,
      keywords: ["MONSTER","PSYKER","HARVESTER","TYRANIDS","PSYCHOPHAGE"],
      stats: { M: '8"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Predatory Psyker", description: "At the start of your Shooting phase, select one enemy PSYKER unit within 18\". Roll 3D6: if the result exceeds that unit's Toughness, it suffers D3+3 mortal wounds." },
        { name: "Consume Psyche", description: "Each time this model destroys an enemy PSYKER model with any attack, regain D3 lost wounds." },
        { name: "HARVESTER", description: "This unit has the HARVESTER keyword." },
      ],
      weapons: {
        ranged: [
          { id: "psyph-bio-plasmic-spray", name: "Bio-plasmic Spray", range: '12"', attacks: "2D6", skill: "Auto", strength: 6, AP: -2, damage: 1, special: "Torrent, Psychic, Ignores Cover", points: 0 },
        ],
        melee: [
          { id: "psyph-claws-maw", name: "Ossified Claws & Maw", attacks: 5, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-maleceptor",
      name: "Maleceptor",
      role: "MONSTER",
      points: 165,
      keywords: ["MONSTER","PSYKER","SYNAPSE","TYRANIDS","MALECEPTOR"],
      stats: { M: '8"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "4+" },
      abilities: [
        { name: "Psychostatic Feedback", description: "Each time an enemy model within 6\" makes a Psychic ability, it suffers 1 mortal wound on a D6 roll of 4+." },
        { name: "Synaptic Amplifier", description: "SYNAPSE keyword. Friendly TYRANIDS PSYKER units within 12\" add 1 to their Psychic Ritual rolls." },
        { name: "Ocular Detonation", description: "Once per battle, at the start of your Shooting phase, select one enemy unit within 18\". Deal D6 mortal wounds (no save)." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "mal-psychic-overload", name: "Psychic Overload", range: '24"', attacks: 4, skill: "3+", strength: 8, AP: -3, damage: 2, special: "Psychic, Devastating Wounds", points: 0 },
        ],
        melee: [
          { id: "mal-crushing-claws", name: "Crushing Claws & Talons", attacks: 5, skill: "4+", strength: 9, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-biovores",
      name: "Biovores",
      role: "MONSTER",
      points: 65,
      baseSize: 1,
      keywords: ["MONSTER","TYRANIDS","BIOVORES"],
      stats: { M: '5"', T: 5, Sv: "4+", W: 5, Ld: "7+", OC: 1 },
      abilities: [
        { name: "Symbiont Spore Mines", description: "Each time this model shoots with its Spore Mine Launcher and misses, place one SPORE MINE within 6\" of the target unit and more than 3\" from all enemy units." },
      ],
      weapons: {
        ranged: [
          { id: "bio-spore-mine-launcher", name: "Spore Mine Launcher", range: '60"', attacks: 1, skill: "4+", strength: 4, AP: 0, damage: "D3", special: "Indirect Fire, Blast", points: 0 },
        ],
        melee: [
          { id: "bio-claws", name: "Claws & Teeth", attacks: 2, skill: "5+", strength: 4, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "tyr-hive-crone",
      name: "Hive Crone",
      role: "MONSTER",
      points: 155,
      keywords: ["MONSTER","FLY","TYRANIDS","HIVE CRONE"],
      stats: { M: '20"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Hovering", description: "Each time this model makes a Normal move, it can fly over terrain features and other models, but must end its move more than 1\" from all enemy models." },
        { name: "Tentaclid Strike", description: "Each time this model makes an attack with its Tentaclid, if the target is a FLY unit, add 1 to the Wound roll." },
        { name: "Aerial Predator", description: "When targeting FLY units, this model always re-rolls Hit rolls of 1." },
      ],
      weapons: {
        ranged: [
          { id: "hc-drool-cannon", name: "Drool Cannon", range: '12"', attacks: "D6", skill: "Auto", strength: 5, AP: 0, damage: 1, special: "Torrent", points: 0 },
          { id: "hc-tentaclid", name: "Tentaclid", range: '24"', attacks: 2, skill: "3+", strength: 8, AP: -2, damage: 2, special: "Anti-FLY 2+", points: 0 },
        ],
        melee: [
          { id: "hc-scything-wings", name: "Scything Wings", attacks: 4, skill: "3+", strength: 7, AP: -1, damage: 2, special: "—", points: 0 },
          { id: "hc-stinger-tail", name: "Stinger Tail", attacks: 3, skill: "3+", strength: 7, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },

    // ══════════════════════════════════════════
    // DEDICATED TRANSPORT
    // ══════════════════════════════════════════
    {
      id: "tyr-tyrannocyte",
      name: "Tyrannocyte",
      role: "DEDICATED TRANSPORT",
      points: 85,
      keywords: ["MONSTER","TRANSPORT","DEDICATED TRANSPORT","TYRANIDS","TYRANNOCYTE"],
      stats: { M: '0"', T: 8, Sv: "4+", W: 10, Ld: "8+", OC: 0 },
      abilities: [
        { name: "Orbital Drop", description: "During the Declare Battle Formations step, this model can be set up in high orbit. At the start of any of your Movement phases, this model can drop to the battlefield using Deep Strike. When it does, any units it is transporting disembark before the unit deploys." },
        { name: "Immobile", description: "This model cannot move during the Movement phase." },
        { name: "Transport (10)", description: "Transports up to 10 TYRANIDS INFANTRY models or 1 TYRANIDS MONSTER model." },
      ],
      weapons: {
        ranged: [
          { id: "tc-deathspitter-cluster", name: "Deathspitter Cluster (x5)", range: '24"', attacks: 10, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "tc-crushing-tentacles", name: "Crushing Tentacles", attacks: 4, skill: "4+", strength: 6, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
  ],
};

// ============================================================
// FACTION REGISTRY
// ============================================================
// Maps faction ID strings to their full data objects.
// Add new factions here to make them available throughout the app.
const FACTIONS = { csm: CSM_DATA, we: WE_DATA, sm: SM_DATA, tyr: TYR_DATA };

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Computes the set of weapon IDs that are locked due to exclusivity rules.
// Used by WeaponRow to gray out mutually incompatible options in real-time.
function getExcludedWeapons(selectedWeapons, factionData) {
  const excluded = new Set();
  const allWeapons = factionData.units.flatMap((u) => [
    ...(u.weapons?.ranged || []),
    ...(u.weapons?.melee || []),
  ]);
  selectedWeapons.forEach((wId) => {
    const w = allWeapons.find((w) => w.id === wId);
    if (w?.exclusive) w.exclusive.forEach((e) => excluded.add(e));
  });
  return excluded;
}

// Returns true when the viewport width is below the given pixel threshold.
// Re-evaluates on window resize so all consumers stay in sync.
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// Builds a serialisable snapshot of the current army for saving.
// Only mutable per-instance fields are saved; static data is re-hydrated on load.
function buildArmySnapshot(factionId, armyName, pointsLimit, units) {
  return {
    id: Date.now().toString(),
    savedAt: new Date().toLocaleString(),
    factionId,
    armyName,
    pointsLimit,
    selectedDetachments,
    units: units.map((u) => ({
      instanceId: u.instanceId,
      unitId: u.unitId,
      selectedRanged: u.selectedRanged,
      selectedMelee: u.selectedMelee,
      selectedMark: u.selectedMark,
      selectedEnhancement: u.selectedEnhancement,
      totalPoints: u.totalPoints,
      narrativeName: u.narrativeName,
      battleHonours: u.battleHonours,
      battleScars: u.battleScars,
      experience: u.experience,
      notes: u.notes,
    })),
  };
}

// Re-hydrates a saved snapshot by re-attaching static unit data from the faction registry.
// Units whose IDs no longer exist in the data are silently dropped.
function hydrateArmySnapshot(snapshot) {
  const factionData = FACTIONS[snapshot.factionId] || CSM_DATA;
  return {
    factionId: snapshot.factionId || "csm",
    armyName: snapshot.armyName,
    pointsLimit: snapshot.pointsLimit,
    units: snapshot.units
      .map((saved) => {
        const unitData = factionData.units.find((u) => u.id === saved.unitId);
        if (!unitData) return null;
        return { ...saved, unitData };
      })
      .filter(Boolean),
  };
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

// Renders a single characteristic badge for a unit's stat block.
// delta: the net change from all active Honours/Scars (positive = buff, negative = debuff).
// Green border/value for buffs, red for debuffs, normal for unchanged.
function StatBadge({ label, value, delta = 0, accentColor = "#e0c070" }) {
  const isBuff = delta > 0;
  const isDebuff = delta < 0;
  const borderColor = isBuff ? "#4a8a4a" : isDebuff ? "#8a2a2a" : "#8b0000";
  const valueColor = isBuff ? "#70c070" : isDebuff ? "#c07070" : accentColor;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: isBuff ? "rgba(74,138,74,0.12)" : isDebuff ? "rgba(138,42,42,0.2)" : "rgba(180,20,20,0.15)",
      border: `1px solid ${borderColor}`,
      padding: "6px 8px", flex: "1 0 auto", minWidth: 42,
    }}>
      <span style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: valueColor, fontFamily: "var(--font-display)" }}>
        {value}
        {delta !== 0 && <span style={{ fontSize: 9, marginLeft: 2 }}>{delta > 0 ? `+${delta}` : delta}</span>}
      </span>
    </div>
  );
}

// Renders a single selectable weapon row inside a unit's loadout panel.
// Minimum 52px touch target for comfortable mobile tapping.
function WeaponRow({ weapon, selected, disabled, onToggle, accentColor = "#e0c070" }) {
  return (
    <div
      onClick={() => !disabled && onToggle(weapon.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px", marginBottom: 6, minHeight: 52,
        background: selected ? "rgba(180,20,20,0.25)" : disabled ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "#cc2020" : disabled ? "#333" : "#3a3a3a"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, transition: "all 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ width: 22, height: 22, borderRadius: 2, border: `2px solid ${selected ? "#cc2020" : "#555"}`, background: selected ? "#cc2020" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {selected && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: disabled ? "#555" : selected ? accentColor : "#ccc", fontSize: 14, fontWeight: 600 }}>{weapon.name}</div>
        <div style={{ color: "#777", fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
          {weapon.range && `${weapon.range} · `}A{weapon.attacks} · S{weapon.strength} · AP{weapon.AP} · D{weapon.damage}
          {weapon.special && weapon.special !== "—" && ` · ${weapon.special}`}
        </div>
      </div>
      {weapon.points > 0 && <div style={{ color: accentColor, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>+{weapon.points} pts</div>}
    </div>
  );
}

// ============================================================
// ARMY LIST MANAGER
// ============================================================
// Full-screen overlay showing all saved army lists with load/rename/delete.
function ArmyListManager({ savedLists, currentId, onLoad, onDelete, onRename, onNew, onClose }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function startRename(list) { setRenamingId(list.id); setRenameValue(list.armyName); }
  function commitRename(id) { if (renameValue.trim()) onRename(id, renameValue.trim()); setRenamingId(null); }

  const btnStyle = (bg = "#8b0000") => ({ background: bg, border: "none", color: "#e0c070", padding: "10px 14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, WebkitTapHighlightColor: "transparent", flexShrink: 0 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0000", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>My Army Lists</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {savedLists.length === 0 && <div style={{ color: "#444", fontStyle: "italic", fontSize: 14, textAlign: "center", padding: "40px 20px" }}>No saved lists yet. Build an army and hit Save!</div>}
        {savedLists.map((list) => {
          const total = list.units.reduce((s, u) => s + (u.totalPoints || 0), 0);
          const isActive = list.id === currentId;
          const faction = FACTIONS[list.factionId] || CSM_DATA;
          return (
            <div key={list.id} style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${isActive ? "#cc2020" : "#2a2a2a"}`, padding: "12px 14px" }}>
              {renamingId === list.id ? (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commitRename(list.id)} autoFocus style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid #8b0000", color: "#e0c070", padding: "8px 10px", fontSize: 14, fontFamily: "var(--font-display)", outline: "none" }} />
                  <button onClick={() => commitRename(list.id)} style={btnStyle()}>✓</button>
                  <button onClick={() => setRenamingId(null)} style={btnStyle("#333")}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 10, background: faction.color, color: "#fff", padding: "2px 6px", marginRight: 6, fontWeight: 700, textTransform: "uppercase" }}>{faction.shortName}</span>
                    <span style={{ color: isActive ? "#e0c070" : "#ddd", fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{list.armyName}</span>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>Saved {list.savedAt}</div>
                  </div>
                  <div style={{ color: "#e0c070", fontFamily: "var(--font-display)", fontSize: 14, flexShrink: 0, marginLeft: 10 }}>{total}/{list.pointsLimit} pts</div>
                </div>
              )}
              <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>{list.units.length} unit{list.units.length !== 1 ? "s" : ""}</div>
              {confirmDeleteId === list.id ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: "#c07070", fontSize: 13, flex: 1 }}>Delete this list?</span>
                  <button onClick={() => { onDelete(list.id); setConfirmDeleteId(null); }} style={btnStyle("#5a0000")}>Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={btnStyle("#333")}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => { onLoad(list); onClose(); }} style={{ ...btnStyle(), flex: 1 }}>{isActive ? "✓ Loaded" : "Load"}</button>
                  <button onClick={() => startRename(list)} style={{ ...btnStyle("#2a2a2a"), color: "#aaa" }}>Rename</button>
                  <button onClick={() => setConfirmDeleteId(list.id)} style={{ ...btnStyle("#3a0000"), color: "#c07070" }}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid #2a0000" }}>
        <button onClick={() => { onNew(); onClose(); }} style={{ width: "100%", background: "rgba(139,0,0,0.2)", border: "1px solid #8b0000", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>+ New Army</button>
      </div>
    </div>
  );
}

// ============================================================
// ARMY BUILDER
// ============================================================
// Main army construction interface. Owns faction selection, unit instances,
// points tracking, save/load lifecycle, and narrative mode fields.
function ArmyBuilder({ narrativeMode }) {
  const [factionId, setFactionId] = useState("csm");
  const [armyName, setArmyName] = useState("Legion of the Damned");
  const [pointsLimit, setPointsLimit] = useState(2000);
  const [units, setUnits] = useState([]);
  // 11th Edition: multi-detachment system. Array of detachment names.
  const [selectedDetachments, setSelectedDetachments] = useState([]);
  // Game-time stratagem tracker. Set of stratagem IDs marked as used this phase/turn.
  const [usedStratagems, setUsedStratagems] = useState(new Set());
  // Controls whether the stratagem panel is expanded in the builder
  const [showStratagemPanel, setShowStratagemPanel] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showListManager, setShowListManager] = useState(false);
  const [showFactionPicker, setShowFactionPicker] = useState(false);
  const [savedLists, setSavedLists] = useState(() => loadListsFromStorage());
  const [currentListId, setCurrentListId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const isMobile = useIsMobile();

  const factionData = FACTIONS[factionId] || CSM_DATA;
  const totalPoints = units.reduce((sum, u) => sum + u.totalPoints, 0);
  const accent = factionData.accentColor;
  const fColor = factionData.color;

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #555", color: "#e0c070", padding: "10px 12px", fontSize: 15, fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none" };

  // Saves current army to localStorage, overwriting existing record if currentListId is set.
  function saveArmy() {
    const snapshot = buildArmySnapshot(factionId, armyName, pointsLimit, units);
    if (currentListId) snapshot.id = currentListId;
    const existing = loadListsFromStorage();
    const idx = existing.findIndex((l) => l.id === snapshot.id);
    const updated = idx >= 0 ? existing.map((l) => l.id === snapshot.id ? snapshot : l) : [...existing, snapshot];
    saveListsToStorage(updated);
    setSavedLists(updated);
    setCurrentListId(snapshot.id);
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  }

  // Hydrates a saved snapshot into the builder, replacing all current state.
  function loadArmy(snapshot) {
    const { factionId: fid, armyName: name, pointsLimit: limit, units: loadedUnits } = hydrateArmySnapshot(snapshot);
    setFactionId(fid); setArmyName(name); setPointsLimit(limit); setUnits(loadedUnits);
    setSelectedDetachments(snapshot.selectedDetachments || []);
    setCurrentListId(snapshot.id); setExpandedUnit(null);
    setSaveStatus("Loaded!"); setTimeout(() => setSaveStatus(""), 2000);
  }

  // Deletes a list from storage by ID.
  function deleteList(id) {
    const updated = savedLists.filter((l) => l.id !== id);
    saveListsToStorage(updated); setSavedLists(updated);
    if (currentListId === id) setCurrentListId(null);
  }

  // Renames a list in storage and syncs the builder header if the active list was renamed.
  function renameList(id, newName) {
    const updated = savedLists.map((l) => l.id === id ? { ...l, armyName: newName } : l);
    saveListsToStorage(updated); setSavedLists(updated);
    if (id === currentListId) setArmyName(newName);
  }

  // Resets the builder to a blank slate.
  function newArmy() { setArmyName("New Legion"); setPointsLimit(2000); setUnits([]); setExpandedUnit(null); setCurrentListId(null); setSaveStatus(""); }

  // Changes the faction and clears all units.
  function changeFaction(newFactionId) {
    setFactionId(newFactionId); setUnits([]); setExpandedUnit(null); setCurrentListId(null); setSelectedDetachments([]); setUsedStratagems(new Set());
    setArmyName(`New ${FACTIONS[newFactionId].shortName} Army`); setShowFactionPicker(false);
  }

  // Creates a new unit instance and appends to the army list.
  function addUnit(unitData) {
    const newUnit = { instanceId: Date.now() + Math.random(), unitId: unitData.id, name: unitData.name, unitData, selectedRanged: [], selectedMelee: [], selectedMark: "undivided", selectedEnhancement: null, totalPoints: unitData.points, narrativeName: "", battleHonours: [], battleScars: [], experience: 0, notes: "" };
    setUnits((prev) => [...prev, newUnit]); setExpandedUnit(newUnit.instanceId); setShowAddPanel(false);
  }

  // Removes a unit instance by instanceId.
  function removeUnit(instanceId) { setUnits((prev) => prev.filter((u) => u.instanceId !== instanceId)); if (expandedUnit === instanceId) setExpandedUnit(null); }

  // Merges partial changes into a unit and recalculates totalPoints.
  function updateUnit(instanceId, changes) {
    setUnits((prev) => prev.map((u) => {
      if (u.instanceId !== instanceId) return u;
      const updated = { ...u, ...changes };
      let pts = updated.unitData.points;
      const allWeapons = [...(updated.unitData.weapons?.ranged || []), ...(updated.unitData.weapons?.melee || [])];
      [...updated.selectedRanged, ...updated.selectedMelee].forEach((wId) => { const w = allWeapons.find((x) => x.id === wId); if (w) pts += w.points || 0; });
      if (updated.selectedEnhancement) { const enh = factionData.enhancements.find((e) => e.id === updated.selectedEnhancement); if (enh) pts += enh.points; }
      updated.totalPoints = pts;
      return updated;
    }));
  }

  // Toggles a weapon on/off for a unit instance.
  function toggleWeapon(instanceId, weaponId, type) {
    const unit = units.find((u) => u.instanceId === instanceId);
    if (!unit) return;
    const key = type === "ranged" ? "selectedRanged" : "selectedMelee";
    const current = unit[key];
    updateUnit(instanceId, { [key]: current.includes(weaponId) ? current.filter((id) => id !== weaponId) : [...current, weaponId] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>
      {showListManager && <ArmyListManager savedLists={savedLists} currentId={currentListId} onLoad={loadArmy} onDelete={deleteList} onRename={renameList} onNew={newArmy} onClose={() => setShowListManager(false)} />}

      {/* Faction picker overlay */}
      {showFactionPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Choose Faction</span>
            <button onClick={() => setShowFactionPicker(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.values(FACTIONS).map((f) => (
              <button key={f.id} onClick={() => changeFaction(f.id)} style={{ background: factionId === f.id ? `${f.color}44` : "rgba(255,255,255,0.03)", border: `2px solid ${factionId === f.id ? f.color : "#333"}`, color: "#ccc", padding: "18px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                <span style={{ fontSize: 32 }}>{f.icon}</span>
                <div>
                  <div style={{ color: factionId === f.id ? f.accentColor : "#ddd", fontWeight: 700, fontSize: 17, fontFamily: "var(--font-display)" }}>{f.name}</div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>{f.tagline}</div>
                </div>
                {factionId === f.id && <span style={{ marginLeft: "auto", color: f.accentColor, fontSize: 20 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div style={{ background: "rgba(10,0,0,0.95)", border: `1px solid ${fColor}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setShowFactionPicker(true)} style={{ background: `${fColor}33`, border: `1px solid ${fColor}`, color: accent, padding: "8px 12px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>{factionData.icon} {factionData.shortName}</button>
        <input value={armyName} onChange={(e) => setArmyName(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px", minWidth: 0, fontSize: 14, padding: "8px 10px", fontFamily: "var(--font-display)" }} />
        <select value={pointsLimit} onChange={(e) => setPointsLimit(Number(e.target.value))} style={{ background: "#1a0000", border: "1px solid #555", color: "#ccc", padding: "8px 10px", fontSize: 13, WebkitAppearance: "none", flexShrink: 0 }}>
          {[500, 1000, 1500, 2000, 2500, 3000].map((p) => <option key={p} value={p}>{p} pts</option>)}
        </select>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: totalPoints > pointsLimit ? "#ff4444" : accent, fontFamily: "var(--font-display)", lineHeight: 1 }}>{totalPoints}<span style={{ color: "#444", fontWeight: 400 }}>/{pointsLimit}</span></div>
          <div style={{ width: 90, height: 3, background: "#2a0000", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%`, background: totalPoints > pointsLimit ? "#ff4444" : fColor, transition: "width 0.3s" }} /></div>
        </div>
        <button onClick={saveArmy} style={{ background: saveStatus === "Saved!" ? "#1a5a00" : fColor, border: "none", color: accent, padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, transition: "background 0.3s", WebkitTapHighlightColor: "transparent" }}>{saveStatus || "Save"}</button>
        <button onClick={() => setShowListManager(true)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #555", color: "#aaa", padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>Lists {savedLists.length > 0 && <span style={{ color: accent }}>({savedLists.length})</span>}</button>
      </div>

      {/* Add Unit sheet */}
      {showAddPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: `2px solid ${fColor}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: accent, fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>{factionData.icon} Add Unit</span>
            <button onClick={() => setShowAddPanel(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {["CHARACTER","BATTLELINE","ELITE","FAST ATTACK","HEAVY","VEHICLE","DEDICATED TRANSPORT"].map((role) => {
              const roleUnits = factionData.units.filter((u) => u.role === role);
              if (roleUnits.length === 0) return null;
              return (
                <div key={role} style={{ marginBottom: 20 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{role}</div>
                  {roleUnits.map((unit) => (
                    <button key={unit.id} onClick={() => addUnit(unit)} style={{ width: "100%", background: `${fColor}1a`, border: `1px solid ${fColor}`, color: "#ccc", padding: "14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-body)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, WebkitTapHighlightColor: "transparent" }}>
                      <span style={{ color: "#ddd", fontWeight: 600 }}>{unit.name}</span>
                      <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 16, flexShrink: 0, marginLeft: 12 }}>{unit.points} pts</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ── 11th Edition Detachment Points Panel ── */}
      {(() => {
        const dpBudget = pointsLimit >= 2000 ? 3 : 2;
        const usedDP = selectedDetachments.reduce((sum, dName) => {
          const det = factionData.detachments.find((d) => d.name === dName);
          return sum + (det?.dpCost || 0);
        }, 0);
        const remaining = dpBudget - usedDP;
        return (
          <div style={{ border: `1px solid ${fColor}`, background: "rgba(0,0,0,0.35)", padding: "12px 14px", marginBottom: 4 }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                  Detachments
                </span>
                <span style={{ color: "#666", fontSize: 11, marginLeft: 8 }}>11th Ed · DP Budget</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[...Array(dpBudget)].map((_, i) => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: i < usedDP ? fColor : "rgba(255,255,255,0.08)", border: `2px solid ${i < usedDP ? fColor : "#444"}`, transition: "all 0.2s" }} />
                ))}
                <span style={{ color: remaining === 0 ? accent : "#aaa", fontSize: 12, marginLeft: 4, fontFamily: "var(--font-display)" }}>
                  {remaining} DP left
                </span>
              </div>
            </div>

            {/* Detachment list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {factionData.detachments.map((det) => {
                const isSelected = selectedDetachments.includes(det.name);
                const wouldOverBudget = !isSelected && (usedDP + det.dpCost) > dpBudget;
                const is3DP = det.dpCost === 3;
                const has3DPSelected = selectedDetachments.some((n) => {
                  const d = factionData.detachments.find((x) => x.name === n);
                  return d?.dpCost === 3;
                });
                // 3 DP detachments can't mix with others; can't pick if something already selected
                const blocked = !isSelected && (
                  wouldOverBudget ||
                  (is3DP && selectedDetachments.length > 0) ||
                  (!is3DP && has3DPSelected)
                );

                return (
                  <div
                    key={det.name}
                    onClick={() => {
                      if (blocked) return;
                      setSelectedDetachments((prev) =>
                        prev.includes(det.name)
                          ? prev.filter((n) => n !== det.name)
                          : [...prev, det.name]
                      );
                    }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "9px 10px", cursor: blocked ? "not-allowed" : "pointer",
                      background: isSelected ? `${fColor}33` : blocked ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isSelected ? fColor : blocked ? "#2a2a2a" : "#333"}`,
                      opacity: blocked ? 0.45 : 1, transition: "all 0.15s",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{ width: 20, height: 20, borderRadius: 3, border: `2px solid ${isSelected ? fColor : "#555"}`, background: isSelected ? fColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      {isSelected && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span style={{ color: isSelected ? accent : blocked ? "#555" : "#ccc", fontSize: 13, fontWeight: 600 }}>{det.name}</span>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          {det.forceDisposition && (
                            <span style={{ color: "#777", fontSize: 10, padding: "1px 5px", border: "1px solid #444", textTransform: "uppercase", letterSpacing: 1 }}>{det.forceDisposition}</span>
                          )}
                          <span style={{ color: isSelected ? accent : "#888", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)" }}>{det.dpCost}DP</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ color: "#888", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{det.rule}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Combo hint */}
            {pointsLimit < 2000 && (
              <div style={{ color: "#555", fontSize: 11, marginTop: 8 }}>
                ⚠ 3 DP detachments require 2,000+ points
              </div>
            )}
          </div>
        );
      })()}


      {/* ── Stratagem Tracker Panel ── */}
      {(() => {
        // Gather all stratagems from currently selected detachments
        const activeStratagems = factionData.stratagems.filter(
          (s) => selectedDetachments.includes(s.detachment)
        );
        if (activeStratagems.length === 0) return null;

        // Group by phase for organised display
        const byPhase = activeStratagems.reduce((acc, s) => {
          const p = s.phase || "Other";
          if (!acc[p]) acc[p] = [];
          acc[p].push(s);
          return acc;
        }, {});

        const usedCount = activeStratagems.filter((s) => usedStratagems.has(s.id)).length;

        return (
          <div style={{ border: `1px solid ${fColor}55`, background: "rgba(0,0,0,0.3)" }}>
            {/* Header — click to expand/collapse */}
            <div
              onClick={() => setShowStratagemPanel((p) => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
                  Stratagems
                </span>
                <span style={{ color: "#666", fontSize: 11 }}>{activeStratagems.length} available</span>
                {usedCount > 0 && (
                  <span style={{ background: "#3a0000", border: "1px solid #8b0000", color: "#c07070", fontSize: 10, padding: "1px 6px" }}>
                    {usedCount} used
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {usedCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setUsedStratagems(new Set()); }}
                    style={{ background: "#1a0000", border: "1px solid #5a0000", color: "#c07070", fontSize: 10, padding: "3px 8px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                  >
                    Reset All
                  </button>
                )}
                <span style={{ color: "#555", fontSize: 12 }}>{showStratagemPanel ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Expanded stratagem list grouped by phase */}
            {showStratagemPanel && (
              <div style={{ borderTop: `1px solid ${fColor}33`, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(byPhase).map(([phase, strats]) => (
                  <div key={phase}>
                    <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{phase}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {strats.map((s) => {
                        const used = usedStratagems.has(s.id);
                        return (
                          <div
                            key={s.id}
                            style={{
                              padding: "10px 12px",
                              background: used ? "rgba(0,0,0,0.4)" : `${fColor}11`,
                              border: `1px solid ${used ? "#2a2a2a" : fColor + "55"}`,
                              opacity: used ? 0.5 : 1,
                              transition: "all 0.2s",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: used ? 0 : 4 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  color: used ? "#555" : accent,
                                  fontWeight: 700, fontSize: 13,
                                  textDecoration: used ? "line-through" : "none",
                                }}>
                                  {s.name}
                                </span>
                                <span style={{ color: "#666", fontSize: 11, marginLeft: 8 }}>{s.detachment}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                                <span style={{ color: used ? "#444" : fColor, fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)" }}>{s.cost}</span>
                                <button
                                  onClick={() => setUsedStratagems((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(s.id)) next.delete(s.id);
                                    else next.add(s.id);
                                    return next;
                                  })}
                                  style={{
                                    background: used ? "#2a0000" : fColor,
                                    border: "none",
                                    color: used ? "#c07070" : accent,
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontFamily: "var(--font-body)",
                                    WebkitTapHighlightColor: "transparent",
                                    minWidth: 48,
                                  }}
                                >
                                  {used ? "Undo" : "Used"}
                                </button>
                              </div>
                            </div>
                            {!used && (
                              <div style={{ color: "#888", fontSize: 12, lineHeight: 1.5 }}>{s.description}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ color: "#444", fontSize: 11, borderTop: "1px solid #1a1a1a", paddingTop: 8, marginTop: 4 }}>
                  11th Ed: one stratagem per unit per phase. "Used" marks it for this phase — reset between phases or at turn end.
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <button onClick={() => setShowAddPanel(true)} style={{ background: fColor, border: "none", color: accent, padding: "14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-display)", letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>+ Add Unit</button>

      {units.length === 0 && <div style={{ textAlign: "center", padding: "36px 20px", color: "#333", fontStyle: "italic", fontSize: 14 }}>No units added. Begin your warband above.</div>}

      {/* Unit cards */}
      {units.map((unit) => {
        const isExpanded = expandedUnit === unit.instanceId;
        const allSelected = [...unit.selectedRanged, ...unit.selectedMelee];
        const excluded = getExcludedWeapons(allSelected, factionData);
        const mark = factionData.marks?.find((m) => m.id === unit.selectedMark);
        const hasMarks = factionData.marks && factionData.marks.length > 0;
        const { modified: modStats, changes } = applyStatModifiers(unit.unitData.stats, unit.battleHonours || [], unit.battleScars || []);

        return (
          <div key={unit.instanceId} style={{ border: `1px solid ${isExpanded ? fColor : "#2a2a2a"}`, background: "rgba(0,0,0,0.4)", transition: "border-color 0.2s" }}>
            <div onClick={() => setExpandedUnit(isExpanded ? null : unit.instanceId)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", cursor: "pointer", minHeight: 60, WebkitTapHighlightColor: "transparent", borderBottom: isExpanded ? "1px solid #2a0000" : "none" }}>
              <div style={{ padding: "3px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, background: unit.unitData.role === "CHARACTER" ? "#4a0070" : unit.unitData.role === "BATTLELINE" ? "#003a70" : unit.unitData.role === "VEHICLE" || unit.unitData.role === "DEDICATED TRANSPORT" ? "#003a20" : "#3a3000", color: "#ccc" }}>{unit.unitData.role}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {narrativeMode && unit.narrativeName ? (
                  <div><div style={{ color: accent, fontWeight: 700, fontSize: 14 }}>{unit.narrativeName}</div><div style={{ color: "#555", fontSize: 11 }}>{unit.unitData.name}</div></div>
                ) : (
                  <div style={{ color: "#ddd", fontWeight: 600, fontSize: 14 }}>{unit.unitData.name}</div>
                )}
                {mark && mark.id !== "undivided" && <div style={{ fontSize: 11, color: "#aa7030", marginTop: 2 }}>{mark.name}</div>}
              </div>
              <div style={{ color: accent, fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0 }}>{unit.totalPoints} pts</div>
              <button onClick={(e) => { e.stopPropagation(); removeUnit(unit.instanceId); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: "0 4px", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>×</button>
              <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {isExpanded && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Stats — shows modified values with colour indicators */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Characteristics {Object.keys(changes).length > 0 && <span style={{ color: "#aaa", fontWeight: 400 }}>(modified by Honours/Scars)</span>}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(modStats).map(([k, v]) => <StatBadge key={k} label={k} value={v} delta={changes[k] || 0} accentColor={accent} />)}
                  </div>
                </div>

                {/* Abilities */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Abilities</div>
                  {unit.unitData.abilities.map((ab) => (
                    <div key={ab.name} style={{ marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,0.25)", border: "1px solid #2a0000" }}>
                      <div style={{ color: accent, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{ab.name}</div>
                      <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>{ab.description}</div>
                    </div>
                  ))}
                </div>

                {/* Mark of Chaos (CSM only) */}
                {hasMarks && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Mark of Chaos</div>
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                      {factionData.marks.map((m) => <button key={m.id} onClick={() => updateUnit(unit.instanceId, { selectedMark: m.id })} style={{ padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "var(--font-body)", fontSize: 13, background: unit.selectedMark === m.id ? fColor : "rgba(255,255,255,0.03)", border: `1px solid ${unit.selectedMark === m.id ? "#cc2020" : "#333"}`, color: unit.selectedMark === m.id ? accent : "#888", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>{m.name}</button>)}
                    </div>
                    {mark && mark.id !== "undivided" && <div style={{ color: "#aa7030", fontSize: 12, marginTop: 6 }}>Bonus: {mark.bonus}</div>}
                  </div>
                )}

                {/* Ranged weapons */}
                {unit.unitData.weapons?.ranged?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>
                    {unit.unitData.weapons.ranged.map((w) => <WeaponRow key={w.id} weapon={w} selected={unit.selectedRanged.includes(w.id)} disabled={!unit.selectedRanged.includes(w.id) && excluded.has(w.id)} onToggle={(id) => toggleWeapon(unit.instanceId, id, "ranged")} accentColor={accent} />)}
                  </div>
                )}

                {/* Melee weapons */}
                {unit.unitData.weapons?.melee?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>
                    {unit.unitData.weapons.melee.map((w) => <WeaponRow key={w.id} weapon={w} selected={unit.selectedMelee.includes(w.id)} disabled={!unit.selectedMelee.includes(w.id) && excluded.has(w.id)} onToggle={(id) => toggleWeapon(unit.instanceId, id, "melee")} accentColor={accent} />)}
                  </div>
                )}

                {/* Enhancements (characters only) — filtered to selected detachments */}
                {unit.unitData.role === "CHARACTER" && (() => {
                  // Filter enhancements to those from currently selected detachments.
                  // If no detachments selected, show nothing with a prompt instead.
                  const availableEnhancements = factionData.enhancements.filter(
                    (e) => !e.detachment || selectedDetachments.includes(e.detachment)
                  );
                  const noDetachmentSelected = selectedDetachments.length === 0;

                  if (noDetachmentSelected) {
                    return (
                      <div>
                        <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Enhancement</div>
                        <div style={{ padding: "10px 12px", color: "#555", fontSize: 13, fontStyle: "italic", border: "1px solid #2a2a2a" }}>
                          Select a detachment above to see available enhancements.
                        </div>
                      </div>
                    );
                  }

                  if (availableEnhancements.length === 0) return null;

                  return (
                    <div>
                      <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                        Enhancement
                        <span style={{ color: "#555", fontWeight: 400, marginLeft: 6 }}>({selectedDetachments.join(", ")})</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div
                          onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: null })}
                          style={{ padding: "10px 12px", cursor: "pointer", minHeight: 48, display: "flex", alignItems: "center", background: !unit.selectedEnhancement ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${!unit.selectedEnhancement ? "#cc2020" : "#333"}`, color: !unit.selectedEnhancement ? accent : "#888", WebkitTapHighlightColor: "transparent" }}
                        >
                          None
                        </div>
                        {availableEnhancements.map((enh) => (
                          <div
                            key={enh.id}
                            onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: enh.id })}
                            style={{ padding: "10px 12px", cursor: "pointer", background: unit.selectedEnhancement === enh.id ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${unit.selectedEnhancement === enh.id ? "#cc2020" : "#333"}`, WebkitTapHighlightColor: "transparent" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3, gap: 8 }}>
                              <span style={{ color: unit.selectedEnhancement === enh.id ? accent : "#ccc", fontSize: 14, fontWeight: 600 }}>{enh.name}</span>
                              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                                {enh.detachment && (
                                  <span style={{ color: "#555", fontSize: 10, border: "1px solid #333", padding: "1px 5px", textTransform: "uppercase", letterSpacing: 1 }}>{enh.detachment}</span>
                                )}
                                <span style={{ color: accent, fontSize: 13 }}>+{enh.points} pts</span>
                              </div>
                            </div>
                            <div style={{ color: "#777", fontSize: 13, lineHeight: 1.4 }}>{enh.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Narrative / Crusade fields */}
                {narrativeMode && (
                  <div style={{ borderTop: "1px solid #2a0000", paddingTop: 16 }}>
                    <div style={{ color: "#aa5030", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>⚔ Narrative / Crusade</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Unit Name</label><input value={unit.narrativeName} onChange={(e) => updateUnit(unit.instanceId, { narrativeName: e.target.value })} placeholder="Name your warriors..." style={{ ...inputStyle, borderColor: "#3a2000" }} /></div>
                      <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Experience (XP)</label><input type="number" inputMode="numeric" value={unit.experience} onChange={(e) => updateUnit(unit.instanceId, { experience: Number(e.target.value) })} style={{ ...inputStyle, borderColor: "#3a2000" }} /></div>
                      <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Honours / Upgrades</label><input value={unit.battleHonours.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleHonours: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Unyielding, Skulls Taken..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} /></div>
                      <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Scars</label><input value={unit.battleScars.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleScars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Traumatised, Battle-weary..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} /></div>
                      <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Notes</label><textarea value={unit.notes} onChange={(e) => updateUnit(unit.instanceId, { notes: e.target.value })} placeholder="Campaign notes, backstory..." rows={3} style={{ ...inputStyle, color: "#aaa", borderColor: "#3a2000", resize: "vertical" }} /></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// RULES REFERENCE
// ============================================================
// Read-only rules browser supporting both factions.
// Sub-tabs: Army Rule, Detachments, Units (drill-down), Stratagems, Enhancements.
function RulesReference() {
  const [refFactionId, setRefFactionId] = useState("csm");
  const [activeUnit, setActiveUnit] = useState(null);
  const [tab, setTab] = useState("army-rule");
  const isMobile = useIsMobile();
  const faction = FACTIONS[refFactionId];
  const accent = faction.accentColor;

  return (
    <div>
      {/* Faction toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.values(FACTIONS).map((f) => (
          <button key={f.id} onClick={() => { setRefFactionId(f.id); setActiveUnit(null); setTab("army-rule"); }} style={{ flex: 1, padding: "10px", cursor: "pointer", background: refFactionId === f.id ? `${f.color}55` : "rgba(255,255,255,0.03)", border: `2px solid ${refFactionId === f.id ? f.color : "#333"}`, color: refFactionId === f.id ? f.accentColor : "#888", fontFamily: "var(--font-display)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, WebkitTapHighlightColor: "transparent" }}>{f.icon} {f.shortName}</button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        {["army-rule","detachments","units","stratagems","enhancements","11th-edition"].map((t) => (
          <button key={t} onClick={() => { setTab(t); setActiveUnit(null); }} style={{ padding: "10px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, background: tab === t ? faction.color : "rgba(255,255,255,0.03)", border: `1px solid ${tab === t ? "#cc2020" : "#333"}`, color: tab === t ? accent : "#888", fontFamily: "var(--font-body)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1, WebkitTapHighlightColor: "transparent" }}>{t.replace("-"," ")}</button>
        ))}
      </div>

      {tab === "army-rule" && (
        <div>
          <h2 style={{ color: accent, fontFamily: "var(--font-display)", marginBottom: 4, fontSize: 20 }}>{faction.armyRule.name}</h2>
          <div style={{ width: 60, height: 2, background: faction.color, marginBottom: 16 }} />
          <div style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}><div style={{ color: "#999", fontSize: 14, lineHeight: 1.7 }}>{faction.armyRule.description}</div></div>
        </div>
      )}

      {tab === "detachments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* DP budget reminder */}
          <div style={{ padding: "10px 14px", background: `${faction.color}22`, border: `1px solid ${faction.color}55`, fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
            <strong style={{ color: accent }}>11th Edition:</strong> You get <strong style={{ color: accent }}>2 DP</strong> at 1,000 pts and <strong style={{ color: accent }}>3 DP</strong> at 2,000 pts. 3 DP detachments are army-wide and cannot be combined with others. Mix 2 DP + 1 DP, or three 1 DP detachments, for multi-detachment builds.
          </div>
          {["3", "2", "1"].map((cost) => {
            const group = faction.detachments.filter((d) => String(d.dpCost) === cost);
            if (group.length === 0) return null;
            return (
              <div key={cost}>
                <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{cost} DP Detachments</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.map((d) => (
                    <div key={d.name} style={{ padding: 14, background: "rgba(0,0,0,0.3)", border: `1px solid ${cost === "3" ? faction.color : cost === "2" ? "#2a2a2a" : "#1a2a1a"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <span style={{ color: accent, fontWeight: 700, fontSize: 15 }}>{d.name}</span>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center", marginLeft: 8 }}>
                          {d.forceDisposition && <span style={{ color: "#777", fontSize: 10, padding: "2px 6px", border: "1px solid #444", textTransform: "uppercase", letterSpacing: 1 }}>{d.forceDisposition}</span>}
                          <span style={{ color: faction.accentColor, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)" }}>{d.dpCost} DP</span>
                        </div>
                      </div>
                      <div style={{ color: "#999", fontSize: 14, lineHeight: 1.6 }}>{d.rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "units" && (
        <div style={isMobile ? {} : { display: "flex", gap: 16 }}>
          {(!isMobile || !activeUnit) && (
            <div style={isMobile ? {} : { width: 220, flexShrink: 0 }}>
              {["CHARACTER","BATTLELINE","ELITE","FAST ATTACK","HEAVY","VEHICLE","DEDICATED TRANSPORT"].map((role) => {
                const roleUnits = faction.units.filter((u) => u.role === role);
                if (roleUnits.length === 0) return null;
                return (
                  <div key={role} style={{ marginBottom: 14 }}>
                    <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{role}</div>
                    {roleUnits.map((u) => (
                      <div key={u.id} onClick={() => setActiveUnit(u)} style={{ padding: "10px 12px", cursor: "pointer", marginBottom: 4, minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center", background: activeUnit?.id === u.id ? `${faction.color}44` : "rgba(255,255,255,0.03)", border: `1px solid ${activeUnit?.id === u.id ? "#cc2020" : "#333"}`, color: activeUnit?.id === u.id ? accent : "#aaa", fontSize: 14, WebkitTapHighlightColor: "transparent" }}>
                        <span>{u.name}</span><span style={{ color: "#555", fontSize: 12 }}>{u.points} pts ›</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {activeUnit && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile && <button onClick={() => setActiveUnit(null)} style={{ background: `${faction.color}33`, border: `1px solid ${faction.color}`, color: accent, padding: "10px 16px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, WebkitTapHighlightColor: "transparent" }}>‹ Back to Units</button>}
              <h2 style={{ color: accent, fontFamily: "var(--font-display)", marginBottom: 6, fontSize: 20 }}>{activeUnit.name}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>{activeUnit.keywords.map((k) => <span key={k} style={{ padding: "3px 8px", background: `${faction.color}33`, border: `1px solid ${faction.color}55`, color: "#999", fontSize: 10, textTransform: "uppercase" }}>{k}</span>)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>{Object.entries(activeUnit.stats).map(([k, v]) => <StatBadge key={k} label={k} value={v} accentColor={accent} />)}</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Abilities</div>
                {activeUnit.abilities.map((ab) => (<div key={ab.name} style={{ marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}><div style={{ color: accent, fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{ab.name}</div><div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>{ab.description}</div></div>))}
              </div>
              {activeUnit.weapons?.ranged?.length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>{activeUnit.weapons.ranged.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} accentColor={accent} />)}</div>)}
              {activeUnit.weapons?.melee?.length > 0 && (<div><div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>{activeUnit.weapons.melee.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} accentColor={accent} />)}</div>)}
            </div>
          )}
          {!activeUnit && !isMobile && <div style={{ flex: 1, color: "#444", textAlign: "center", padding: 40, fontStyle: "italic" }}>Select a unit to view its datasheet</div>}
        </div>
      )}

      {tab === "stratagems" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: "#666", fontSize: 12, padding: "8px 12px", background: "rgba(0,0,0,0.2)", border: "1px solid #2a2a2a" }}>
            <strong style={{ color: accent }}>11th Edition:</strong> One stratagem per unit per phase. Stratagems are tied to their detachment — you only gain access to stratagems from detachments you have selected in your army.
          </div>
          {/* Group stratagems by detachment */}
          {Object.entries(
            faction.stratagems.reduce((acc, s) => {
              const key = s.detachment || "General";
              if (!acc[key]) acc[key] = [];
              acc[key].push(s);
              return acc;
            }, {})
          ).map(([detName, strats]) => (
            <div key={detName}>
              <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${faction.color}44` }}>{detName}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {strats.map((s) => (
                  <div key={s.id} style={{ padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                      <span style={{ color: accent, fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                      <span style={{ color: faction.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{s.cost}</span>
                    </div>
                    <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.phase}</div>
                    <div style={{ color: "#999", fontSize: 13, lineHeight: 1.5 }}>{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "enhancements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faction.enhancements.map((e) => (<div key={e.id} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: accent, fontWeight: 700, fontSize: 15 }}>{e.name}</span><span style={{ color: accent, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>{e.points} pts</span></div><div style={{ color: "#999", fontSize: 14, lineHeight: 1.5 }}>{e.description}</div></div>))}
        </div>
      )}

      {tab === "11th-edition" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "10px 14px", background: `${faction.color}22`, border: `1px solid ${faction.color}55` }}>
            <div style={{ color: accent, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>11th Edition — June 20, 2026 (Armageddon)</div>
            <div style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>Evolution, not revolution. Your 10th edition codex stays fully legal. Key changes below.</div>
          </div>
          {[
            {
              title: "Detachment Points System",
              icon: "⚔",
              desc: "Instead of one detachment, you get a pool of Detachment Points (DP): 2 DP at 1,000 pts, 3 DP at 2,000 pts. Each detachment costs 1–3 DP. 3 DP detachments are army-wide and cannot combine with others. Mix 1 DP + 2 DP, or three 1 DPs, for bespoke armies. Most existing codex detachments cost 2 DP.",
            },
            {
              title: "Force Dispositions",
              icon: "🎯",
              desc: "Each detachment has a Force Disposition: Take and Hold, Purge the Foe, Disruption, Reconnaissance, or Priority Assets. Your army's Disposition determines your primary mission in Chapter Approved missions. Multi-detachment armies may select one Disposition for tournament play.",
            },
            {
              title: "Stratagem Stacking — Banned",
              icon: "🚫",
              desc: "A unit can only benefit from ONE stratagem per phase. This ends multi-buff combo turns. Notably, Command Re-Roll is itself a stratagem — you must choose between a buff and a re-roll. Expect 6–9 stratagems total in a 2,000-point game depending on detachment choices.",
            },
            {
              title: "Cover = −1 to Hit",
              icon: "🏚",
              desc: "Cover no longer grants a save bonus. Instead, it imposes −1 to Hit rolls on incoming ranged attacks. Monsters and Vehicles must be genuinely obscured to benefit — standing in a terrain footprint is not enough. Infantry in cover also gain the Hidden status.",
            },
            {
              title: "Hidden Status",
              icon: "👁",
              desc: "INFANTRY, BEAST, and SWARM units in cover gain Hidden status unless they have recently fired a weapon. Hidden units cannot be targeted by ranged attacks unless the attacker is within 15\". Moving out of cover or shooting removes Hidden status.",
            },
            {
              title: "Battle-shock Persists",
              icon: "💀",
              desc: "Battle-shocked units are no longer automatically un-shocked at the start of your turn. You must test during your Command phase to remove it. Battle-shocked units cannot use Stratagems, cannot take Actions, and have reduced OC. This makes proactive Battle-shock abilities significantly stronger.",
            },
            {
              title: "Melee Changes",
              icon: "⚔",
              desc: "Engagement range is now 2\" (was 1\"). You declare the target of a charge AFTER rolling the charge distance, removing guesswork. Consolidation now only requires ending on the terrain footprint of an objective (not a specific disc). Invulnerable saves are no longer optional — they are always checked first.",
            },
            {
              title: "New Keywords",
              icon: "🔑",
              desc: "CLEAVE: Grants additional attacks for every 5 models in a target unit — strong vs hordes. CLOSE-QUARTERS: Replaces the PISTOL keyword (still compatible with existing datasheets). MOBILE: Allows units to move through dense terrain. HEAVY: Updated — grants +1 to Hit if the unit moved ≤3\" and wasn't set up this turn. FRAME: Applied to vehicles without standard bases.",
            },
            {
              title: "Objectives",
              icon: "🏴",
              desc: "Round objective markers are gone. Objectives are now tied to terrain features — the entire terrain footprint counts as the objective. This rewards tactical positioning and makes terrain placement matter much more.",
            },
          ].map((rule) => (
            <div key={rule.title} style={{ padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid #2a2a2a" }}>
              <div style={{ color: accent, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{rule.icon} {rule.title}</div>
              <div style={{ color: "#999", fontSize: 13, lineHeight: 1.6 }}>{rule.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CRUSADE SECTION
// ============================================================

// Individual Crusade Unit Card — the core of the Crusade section.
// Displays a unit's full Crusade card with live stat modifications, XP tracker,
// rank progression, Battle Honours picker, Battle Scars picker, and special rules.
// When honours/scars are selected that modify stats, the stat block updates instantly.
function CrusadeUnitCard({ unit, factionId, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [showHonourPicker, setShowHonourPicker] = useState(false);
  const [showScarPicker, setShowScarPicker] = useState(false);
  const [rankUpBanner, setRankUpBanner] = useState(null);

  const factionData = FACTIONS[factionId] || CSM_DATA;
  const accent = factionData.accentColor;
  const fColor = factionData.color;

  // Derives rank from current XP and detects rank-up when XP changes.
  const rank = getRank(unit.xp);
  const nextRank = getNextRank(unit.xp);
  const xpToNext = nextRank ? nextRank.minXP - unit.xp : 0;
  const rankProgress = nextRank ? ((unit.xp - rank.minXP) / (nextRank.minXP - rank.minXP)) * 100 : 100;

  // Applies all active Battle Honours and Battle Scars stat modifiers to base stats.
  const { modified: modStats, changes } = applyStatModifiers(
    unit.baseStats,
    unit.battleHonourIds || [],
    unit.battleScarIds || []
  );

  // All active special rules from Honours and Scars (non-stat effects).
  const activeSpecialRules = [
    ...(unit.battleHonourIds || []).map((id) => ALL_HONOURS.find((h) => h.id === id)).filter(Boolean).filter((h) => h.specialRule).map((h) => ({ name: h.name, rule: h.specialRule, type: "honour" })),
    ...(unit.battleScarIds || []).map((id) => BATTLE_SCARS.find((s) => s.id === id)).filter(Boolean).filter((s) => s.specialRule).map((s) => ({ name: s.name, rule: s.specialRule, type: "scar" })),
  ];

  // Updates XP and shows a rank-up banner if the unit crossed a rank threshold.
  function handleXpChange(newXp) {
    const oldRank = getRank(unit.xp);
    const newRank = getRank(newXp);
    onUpdate({ xp: newXp });
    if (newRank.name !== oldRank.name) {
      setRankUpBanner(newRank);
      setTimeout(() => setRankUpBanner(null), 4000);
    }
  }

  // Toggles a Battle Honour ID in/out of the unit's active list.
  function toggleHonour(id) {
    const current = unit.battleHonourIds || [];
    onUpdate({ battleHonourIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  }

  // Toggles a Battle Scar ID in/out of the unit's active list.
  function toggleScar(id) {
    const current = unit.battleScarIds || [];
    onUpdate({ battleScarIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  }

  // Categorised honours to show — filter by faction restriction and rank availability.
  const availableHonourCategories = [
    { label: "Battle Traits", honours: BATTLE_HONOURS.battleTraits },
    { label: "Weapon Enhancements", honours: BATTLE_HONOURS.weaponEnhancements },
    { label: "Crusade Relics", honours: BATTLE_HONOURS.crusadeRelics.filter((h) => !h.factionRestriction || h.factionRestriction === factionId) },
    ...(factionId === "csm" ? [{ label: "CSM Faction Honours", honours: BATTLE_HONOURS.csmFaction }] : []),
    ...(factionId === "we" ? [{ label: "World Eaters Faction Honours", honours: BATTLE_HONOURS.weFaction }] : []),
    ...(factionId === "tyr" ? [{ label: "Tyranid Bioform Adaptations", honours: BATTLE_HONOURS.tyrFaction }] : []),
  ];

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #444", color: "#ccc", padding: "8px 10px", fontSize: 14, fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none" };

  return (
    <div style={{ border: `1px solid ${expanded ? fColor : "#2a2a2a"}`, background: "rgba(0,0,0,0.45)", marginBottom: 10, position: "relative" }}>

      {/* Rank-up banner — shows briefly when XP crosses a rank threshold */}
      {rankUpBanner && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          background: "linear-gradient(135deg, #4a0070, #8b0000)",
          border: "2px solid #e0c070", padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12, animation: "fadeIn 0.3s",
        }}>
          <span style={{ fontSize: 24 }}>🎖️</span>
          <div>
            <div style={{ color: "#e0c070", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>RANK UP!</div>
            <div style={{ color: "#ccc", fontSize: 13 }}>{unit.unitName} has reached <strong style={{ color: "#e0c070" }}>{rankUpBanner.name}</strong> {rankUpBanner.icon}</div>
          </div>
          <button onClick={() => setRankUpBanner(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Card header */}
      <div onClick={() => setExpanded((p) => !p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", cursor: "pointer", minHeight: 60, WebkitTapHighlightColor: "transparent", borderBottom: expanded ? "1px solid #2a0000" : "none" }}>
        {/* Rank icon */}
        <div style={{ fontSize: 18, flexShrink: 0, color: accent }}>{rank.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)" }}>{unit.unitName || unit.unitType}</div>
          <div style={{ color: "#666", fontSize: 11 }}>{unit.unitType} · {rank.name} · {unit.xp} XP{nextRank ? ` (${xpToNext} to ${nextRank.name})` : " · Max Rank"}</div>
        </div>
        {/* Honour/scar counts */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {(unit.battleHonourIds?.length || 0) > 0 && <span style={{ background: "#1a4a1a", border: "1px solid #3a8a3a", color: "#70c070", fontSize: 10, padding: "2px 6px" }}>⭐ {unit.battleHonourIds.length}</span>}
          {(unit.battleScarIds?.length || 0) > 0 && <span style={{ background: "#4a1a1a", border: "1px solid #8a3a3a", color: "#c07070", fontSize: 10, padding: "2px 6px" }}>💀 {unit.battleScarIds.length}</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>×</button>
        <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* XP and rank progression */}
          <div>
            <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Experience & Rank</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 13 }}>{rank.name} {rank.icon}</span>
                  {nextRank && <span style={{ color: "#666", fontSize: 12 }}>{unit.xp}/{nextRank.minXP} XP</span>}
                </div>
                <div style={{ height: 6, background: "#2a0000", overflow: "hidden", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${rankProgress}%`, background: `linear-gradient(90deg, ${fColor}, ${accent})`, transition: "width 0.4s" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleXpChange(Math.max(0, unit.xp - 1))} style={{ background: "#2a0000", border: "1px solid #5a0000", color: "#e0c070", width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>−</button>
                <input type="number" inputMode="numeric" value={unit.xp} onChange={(e) => handleXpChange(Math.max(0, Number(e.target.value)))} style={{ ...inputStyle, width: 56, textAlign: "center", padding: "4px 6px", fontSize: 16, fontFamily: "var(--font-display)", color: accent }} />
                <button onClick={() => handleXpChange(unit.xp + 1)} style={{ background: fColor, border: "none", color: accent, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>+</button>
              </div>
            </div>

            {/* Rank milestone list */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CRUSADE_RANKS.map((r) => {
                const achieved = unit.xp >= r.minXP;
                return <div key={r.name} style={{ padding: "3px 8px", fontSize: 10, background: achieved ? `${fColor}44` : "rgba(255,255,255,0.03)", border: `1px solid ${achieved ? fColor : "#333"}`, color: achieved ? accent : "#555" }}>{r.icon} {r.name}</div>;
              })}
            </div>
          </div>

          {/* Unit name and notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Unit Name</label>
              <input value={unit.unitName || ""} onChange={(e) => onUpdate({ unitName: e.target.value })} placeholder={`e.g. The Bloodhounds`} style={inputStyle} />
            </div>
            <div>
              <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Backstory / Notes</label>
              <textarea value={unit.notes || ""} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="Campaign history, territorial holdings, rivalries..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>

          {/* Modified stat block */}
          <div>
            <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Characteristics {Object.keys(changes).length > 0 && <span style={{ color: "#aaa", fontWeight: 400 }}>(modified)</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(modStats).map(([k, v]) => <StatBadge key={k} label={k} value={v} delta={changes[k] || 0} accentColor={accent} />)}
            </div>
            {/* Active special rules from Honours/Scars */}
            {activeSpecialRules.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {activeSpecialRules.map((sr) => (
                  <div key={sr.name} style={{ padding: "5px 10px", marginBottom: 4, background: sr.type === "honour" ? "rgba(60,100,60,0.15)" : "rgba(100,40,40,0.2)", border: `1px solid ${sr.type === "honour" ? "#3a6a3a" : "#6a2a2a"}`, fontSize: 12, color: sr.type === "honour" ? "#70c070" : "#c07070" }}>
                    <strong>{sr.name}:</strong> {sr.rule}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Battle Honours */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Battle Honours <span style={{ color: "#4a8a4a" }}>({unit.battleHonourIds?.length || 0})</span></div>
              <button onClick={() => setShowHonourPicker((p) => !p)} style={{ background: "#1a3a1a", border: "1px solid #3a6a3a", color: "#70c070", padding: "5px 10px", cursor: "pointer", fontSize: 11, WebkitTapHighlightColor: "transparent" }}>{showHonourPicker ? "Done" : "+ Add"}</button>
            </div>

            {/* Active honours list */}
            {(unit.battleHonourIds || []).map((id) => {
              const h = ALL_HONOURS.find((x) => x.id === id);
              if (!h) return null;
              return (
                <div key={id} style={{ padding: "8px 10px", marginBottom: 6, background: "rgba(60,100,60,0.12)", border: "1px solid #3a6a3a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ color: "#70c070", fontSize: 13, fontWeight: 600 }}>{h.name}</span>
                      <span style={{ color: "#555", fontSize: 10, marginLeft: 6 }}>{h.type}</span>
                    </div>
                    <button onClick={() => toggleHonour(id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>×</button>
                  </div>
                  <div style={{ color: "#888", fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{h.description}</div>
                </div>
              );
            })}

            {/* Honour picker */}
            {showHonourPicker && (
              <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #3a6a3a", padding: 12, marginTop: 6 }}>
                {availableHonourCategories.map((cat) => (
                  <div key={cat.label} style={{ marginBottom: 14 }}>
                    <div style={{ color: "#4a8a4a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{cat.label}</div>
                    {cat.honours.map((h) => {
                      const isSelected = (unit.battleHonourIds || []).includes(h.id);
                      const rankOk = !h.minRank || unit.xp >= (CRUSADE_RANKS.find((r) => r.name === h.minRank)?.minXP || 0);
                      return (
                        <div key={h.id} onClick={() => rankOk && toggleHonour(h.id)} style={{ padding: "8px 10px", marginBottom: 5, background: isSelected ? "rgba(60,100,60,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${isSelected ? "#3a8a3a" : "#2a2a2a"}`, cursor: rankOk ? "pointer" : "not-allowed", opacity: rankOk ? 1 : 0.4, WebkitTapHighlightColor: "transparent" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: isSelected ? "#70c070" : "#ccc", fontSize: 13, fontWeight: 600 }}>{h.name}</span>
                            <span style={{ color: "#555", fontSize: 11 }}>Min: {h.minRank || "Any"}</span>
                          </div>
                          <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{h.description}</div>
                          {h.statModifiers && Object.keys(h.statModifiers).length > 0 && (
                            <div style={{ color: "#4a8a4a", fontSize: 11, marginTop: 3 }}>Stats: {Object.entries(h.statModifiers).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}</div>
                          )}
                          {h.specialRule && <div style={{ color: "#4a8a4a", fontSize: 11, marginTop: 2 }}>→ {h.specialRule}</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Battle Scars */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Battle Scars <span style={{ color: "#8a3a3a" }}>({unit.battleScarIds?.length || 0})</span></div>
              <button onClick={() => setShowScarPicker((p) => !p)} style={{ background: "#3a1a1a", border: "1px solid #6a3a3a", color: "#c07070", padding: "5px 10px", cursor: "pointer", fontSize: 11, WebkitTapHighlightColor: "transparent" }}>{showScarPicker ? "Done" : "+ Add"}</button>
            </div>

            {/* Active scars */}
            {(unit.battleScarIds || []).map((id) => {
              const s = BATTLE_SCARS.find((x) => x.id === id);
              if (!s) return null;
              return (
                <div key={id} style={{ padding: "8px 10px", marginBottom: 6, background: "rgba(100,40,40,0.15)", border: "1px solid #6a2a2a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ color: "#c07070", fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                      {s.recoverable && <span style={{ color: "#555", fontSize: 10, marginLeft: 6 }}>(Recoverable, {s.recoveryCost} RP)</span>}
                    </div>
                    <button onClick={() => toggleScar(id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>×</button>
                  </div>
                  <div style={{ color: "#888", fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{s.description}</div>
                </div>
              );
            })}

            {/* Scar picker */}
            {showScarPicker && (
              <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #6a2a2a", padding: 12, marginTop: 6 }}>
                <div style={{ color: "#6a2a2a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Battle Scars</div>
                {BATTLE_SCARS.map((s) => {
                  const isSelected = (unit.battleScarIds || []).includes(s.id);
                  return (
                    <div key={s.id} onClick={() => toggleScar(s.id)} style={{ padding: "8px 10px", marginBottom: 5, background: isSelected ? "rgba(100,40,40,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${isSelected ? "#8a2a2a" : "#2a2a2a"}`, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: isSelected ? "#c07070" : "#ccc", fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ color: s.recoverable ? "#8a6a2a" : "#6a2a2a", fontSize: 11 }}>{s.recoverable ? `Recoverable (${s.recoveryCost} RP)` : "Permanent"}</span>
                      </div>
                      <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{s.description}</div>
                      {s.statModifiers && Object.keys(s.statModifiers).length > 0 && (
                        <div style={{ color: "#8a4a4a", fontSize: 11, marginTop: 3 }}>Stats: {Object.entries(s.statModifiers).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CRUSADE ORDER OF BATTLE
// ============================================================

// Full Crusade management section — independent from the army builder.
// Manages crusade rosters (Order of Battle) with unit Crusade cards,
// Requisition Points tracking, campaign supply limit, battle log, and agendas.
function CrusadeSection() {
  // Load saved rosters from localStorage on first render.
  const [rosters, setRosters] = useState(() => loadCrusadeFromStorage());

  // activeRosterId: which crusade roster is currently being managed.
  const [activeRosterId, setActiveRosterId] = useState(null);

  // showRosterPicker: controls the roster selection/creation overlay.
  const [showRosterPicker, setShowRosterPicker] = useState(false);

  // tab: which sub-section of the Crusade panel is active.
  const [tab, setTab] = useState("order-of-battle");

  // showAddUnitSheet: controls the unit-type picker for adding units to the Order of Battle.
  const [showAddUnitSheet, setShowAddUnitSheet] = useState(false);

  const isMobile = useIsMobile();

  // The active roster object, derived from the rosters array by activeRosterId.
  const activeRoster = rosters.find((r) => r.id === activeRosterId) || null;

  // Persists roster changes to localStorage and updates state.
  function persistRosters(updated) {
    saveCrusadeToStorage(updated);
    setRosters(updated);
  }

  // Creates a new crusade roster with default values.
  function createRoster(factionId) {
    const factionData = FACTIONS[factionId] || CSM_DATA;
    const newRoster = {
      id: Date.now().toString(),
      name: `${factionData.name} Crusade`,
      factionId,
      requisitionPoints: 5,          // standard starting RP
      supplyLimit: 50,                // standard starting supply limit (pts)
      supplyUsed: 0,
      crusadePoints: 0,
      biomassPoints: 0,           // Tyranids-specific: earned by consuming prey worlds
      battleTally: { victories: 0, draws: 0, defeats: 0 },
      units: [],                      // array of Crusade unit objects
      battleLog: [],                  // array of battle records
      agendaLog: [],                  // completed agendas
      notes: "",
      createdAt: new Date().toLocaleString(),
    };
    const updated = [...rosters, newRoster];
    persistRosters(updated);
    setActiveRosterId(newRoster.id);
    setShowRosterPicker(false);
  }

  // Updates a field on the active roster.
  function updateRoster(changes) {
    if (!activeRoster) return;
    persistRosters(rosters.map((r) => r.id === activeRosterId ? { ...r, ...changes } : r));
  }

  // Adds a new unit to the active roster's Order of Battle.
  function addCrusadeUnit(unitData) {
    if (!activeRoster) return;
    const newUnit = {
      id: Date.now().toString(),
      unitType: unitData.name,
      unitName: "",
      unitDataId: unitData.id,
      factionId: activeRoster.factionId,
      baseStats: { ...unitData.stats },
      basePoints: unitData.points,
      xp: 0,
      battleHonourIds: [],
      battleScarIds: [],
      notes: "",
    };
    updateRoster({ units: [...activeRoster.units, newUnit] });
    setShowAddUnitSheet(false);
  }

  // Updates a specific crusade unit within the active roster.
  function updateCrusadeUnit(unitId, changes) {
    if (!activeRoster) return;
    updateRoster({ units: activeRoster.units.map((u) => u.id === unitId ? { ...u, ...changes } : u) });
  }

  // Removes a unit from the active roster's Order of Battle.
  function removeCrusadeUnit(unitId) {
    if (!activeRoster) return;
    updateRoster({ units: activeRoster.units.filter((u) => u.id !== unitId) });
  }

  // Deletes an entire roster.
  function deleteRoster(id) {
    const updated = rosters.filter((r) => r.id !== id);
    persistRosters(updated);
    if (activeRosterId === id) setActiveRosterId(updated[0]?.id || null);
  }

  const factionData = activeRoster ? FACTIONS[activeRoster.factionId] : null;
  const accent = factionData?.accentColor || "#e0c070";
  const fColor = factionData?.color || "#8b0000";

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #444", color: "#ccc", padding: "9px 10px", fontSize: 14, fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none" };

  return (
    <div>
      {/* Add Unit to Crusade sheet */}
      {showAddUnitSheet && activeRoster && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: `2px solid ${fColor}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: accent, fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Add to Order of Battle</span>
            <button onClick={() => setShowAddUnitSheet(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {["CHARACTER","BATTLELINE","ELITE","FAST ATTACK","HEAVY","VEHICLE","DEDICATED TRANSPORT"].map((role) => {
              const roleUnits = (FACTIONS[activeRoster.factionId]?.units || []).filter((u) => u.role === role);
              if (roleUnits.length === 0) return null;
              return (
                <div key={role} style={{ marginBottom: 20 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{role}</div>
                  {roleUnits.map((unit) => (
                    <button key={unit.id} onClick={() => addCrusadeUnit(unit)} style={{ width: "100%", background: `${fColor}1a`, border: `1px solid ${fColor}`, color: "#ccc", padding: "14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-body)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, WebkitTapHighlightColor: "transparent" }}>
                      <span style={{ color: "#ddd", fontWeight: 600 }}>{unit.name}</span>
                      <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0, marginLeft: 12 }}>{unit.points} pts</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No roster selected */}
      {!activeRoster && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚔</div>
          <div style={{ color: "#e0c070", fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>No Crusade Roster</div>
          <div style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>Create a Crusade roster to track your warband's journey through the campaign.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300, margin: "0 auto" }}>
            {Object.values(FACTIONS).map((f) => (
              <button key={f.id} onClick={() => createRoster(f.id)} style={{ background: `${f.color}33`, border: `2px solid ${f.color}`, color: f.accentColor, padding: "14px 20px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>
                {f.icon} New {f.name} Crusade
              </button>
            ))}
            {rosters.length > 0 && (
              <button onClick={() => setShowRosterPicker(true)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #555", color: "#aaa", padding: "14px 20px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>
                Load Existing Roster ({rosters.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Roster picker overlay */}
      {showRosterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Crusade Rosters</span>
            <button onClick={() => setShowRosterPicker(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {rosters.map((r) => {
              const f = FACTIONS[r.factionId] || CSM_DATA;
              return (
                <div key={r.id} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.4)", border: `1px solid ${activeRosterId === r.id ? f.color : "#2a2a2a"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, background: f.color, color: "#fff", padding: "2px 6px", marginRight: 6, fontWeight: 700, textTransform: "uppercase" }}>{f.shortName}</span>
                      <span style={{ color: "#ddd", fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{r.name}</span>
                    </div>
                    <span style={{ color: "#666", fontSize: 12 }}>{r.units.length} units</span>
                  </div>
                  <div style={{ color: "#555", fontSize: 12, marginBottom: 10 }}>{r.crusadePoints} CP · {r.requisitionPoints} RP · Created {r.createdAt}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setActiveRosterId(r.id); setShowRosterPicker(false); }} style={{ flex: 1, background: "#8b0000", border: "none", color: "#e0c070", padding: "9px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, WebkitTapHighlightColor: "transparent" }}>Load</button>
                    <button onClick={() => deleteRoster(r.id)} style={{ background: "#3a0000", border: "1px solid #5a0000", color: "#c07070", padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, WebkitTapHighlightColor: "transparent" }}>Delete</button>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Create New Roster</div>
              {Object.values(FACTIONS).map((f) => (
                <button key={f.id} onClick={() => createRoster(f.id)} style={{ width: "100%", background: `${f.color}33`, border: `1px solid ${f.color}`, color: f.accentColor, padding: "12px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, WebkitTapHighlightColor: "transparent" }}>
                  {f.icon} New {f.name} Crusade
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active roster content */}
      {activeRoster && (
        <div>
          {/* Roster header */}
          <div style={{ background: `rgba(0,0,0,0.5)`, border: `1px solid ${fColor}`, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <input value={activeRoster.name} onChange={(e) => updateRoster({ name: e.target.value })} style={{ ...inputStyle, fontSize: 17, fontFamily: "var(--font-display)", color: accent, background: "transparent", border: "none", padding: "0 0 4px 0", width: "auto", minWidth: 200 }} />
                <div style={{ color: "#666", fontSize: 11 }}>{factionData?.icon} {factionData?.name} · Created {activeRoster.createdAt}</div>
              </div>
              <button onClick={() => setShowRosterPicker(true)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #555", color: "#aaa", padding: "6px 12px", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-body)", textTransform: "uppercase", letterSpacing: 1, WebkitTapHighlightColor: "transparent" }}>Switch</button>
            </div>

            {/* Stats row: CP, RP, Supply, Tally */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Crusade Points", key: "crusadePoints", color: "#e0c070" },
                { label: "Requisition RP", key: "requisitionPoints", color: "#70a0e0" },
                { label: "Supply Limit", key: "supplyLimit", color: "#70c070" },
                ...(activeRoster.factionId === "tyr" ? [{ label: "Biomass Points", key: "biomassPoints", color: "#c060e0" }] : []),
              ].map(({ label, key, color }) => (
                <div key={key} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2a2a", padding: "8px 12px", flex: "1 1 80px" }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => updateRoster({ [key]: Math.max(0, activeRoster[key] - 1) })} style={{ background: "#2a0000", border: "1px solid #5a0000", color: "#e0c070", width: 24, height: 24, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>−</button>
                    <span style={{ color, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{activeRoster[key]}</span>
                    <button onClick={() => updateRoster({ [key]: activeRoster[key] + 1 })} style={{ background: "#8b0000", border: "none", color: "#e0c070", width: 24, height: 24, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>+</button>
                  </div>
                </div>
              ))}
              {/* Battle tally */}
              <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2a2a", padding: "8px 12px", flex: "1 1 100px" }}>
                <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Battle Tally</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["V", "victories", "#70c070"], ["D", "draws", "#c0c070"], ["L", "defeats", "#c07070"]].map(([label, key, color]) => (
                    <div key={key} onClick={() => updateRoster({ battleTally: { ...activeRoster.battleTally, [key]: activeRoster.battleTally[key] + 1 } })} style={{ cursor: "pointer", textAlign: "center", WebkitTapHighlightColor: "transparent" }}>
                      <div style={{ color, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{activeRoster.battleTally[key]}</div>
                      <div style={{ color: "#555", fontSize: 10 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
            {["order-of-battle","requisitions","agendas","battle-log"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, background: tab === t ? fColor : "rgba(255,255,255,0.03)", border: `1px solid ${tab === t ? "#cc2020" : "#333"}`, color: tab === t ? accent : "#888", fontFamily: "var(--font-body)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1, WebkitTapHighlightColor: "transparent" }}>{t.replace(/-/g, " ")}</button>
            ))}
          </div>

          {/* ── ORDER OF BATTLE ── */}
          {tab === "order-of-battle" && (
            <div>
              <button onClick={() => setShowAddUnitSheet(true)} style={{ width: "100%", background: fColor, border: "none", color: accent, padding: "13px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, WebkitTapHighlightColor: "transparent" }}>
                + Add Unit to Order of Battle
              </button>
              {activeRoster.units.length === 0 && <div style={{ textAlign: "center", padding: "30px 20px", color: "#444", fontStyle: "italic", fontSize: 14 }}>No units on your Order of Battle yet.</div>}
              {activeRoster.units.map((unit) => (
                <CrusadeUnitCard key={unit.id} unit={unit} factionId={activeRoster.factionId} onUpdate={(changes) => updateCrusadeUnit(unit.id, changes)} onRemove={() => removeCrusadeUnit(unit.id)} />
              ))}
            </div>
          )}

          {/* ── REQUISITIONS ── */}
          {tab === "requisitions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>You have <span style={{ color: "#70a0e0", fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 16 }}>{activeRoster.requisitionPoints} RP</span> to spend.</div>
              {REQUISITIONS.map((req) => {
                const canAfford = activeRoster.requisitionPoints >= req.cost;
                return (
                  <div key={req.id} style={{ padding: 14, background: "rgba(0,0,0,0.3)", border: `1px solid ${canAfford ? "#2a4a2a" : "#2a2a2a"}`, opacity: canAfford ? 1 : 0.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: canAfford ? "#e0c070" : "#888", fontWeight: 700, fontSize: 14 }}>{req.name}</span>
                      <span style={{ color: "#70a0e0", fontWeight: 700, fontSize: 14 }}>{req.cost} RP</span>
                    </div>
                    <div style={{ color: "#999", fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{req.description}</div>
                    <button
                      disabled={!canAfford}
                      onClick={() => updateRoster({ requisitionPoints: activeRoster.requisitionPoints - req.cost })}
                      style={{ background: canAfford ? fColor : "#2a2a2a", border: "none", color: canAfford ? accent : "#555", padding: "8px 14px", cursor: canAfford ? "pointer" : "not-allowed", fontFamily: "var(--font-body)", fontSize: 13, WebkitTapHighlightColor: "transparent" }}
                    >
                      Spend {req.cost} RP
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AGENDAS ── */}
          {tab === "agendas" && (
            <div>
              <div style={{ color: "#999", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                Set agendas before each battle. When completed, award the listed XP and Crusade Points.
              </div>

              {/* Tyranid Devouring Worlds panel */}
              {activeRoster.factionId === "tyr" && (
                <div style={{ padding: 14, background: "rgba(74,0,112,0.2)", border: "1px solid #6a0099", marginBottom: 16 }}>
                  <div style={{ color: "#c060e0", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Devouring Worlds</div>
                  <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                    Earn Biomass Points via Tyranid agendas. Spend them on upgrades between battles:
                  </div>
                  {[
                    { name: "Enhanced Organisms", cost: 2, effect: "One unit gains 5 XP immediately (once per consumed world)" },
                    { name: "The Swarm Grows", cost: 2, effect: "Increase Supply Limit by 100 points" },
                    { name: "Biological Resources", cost: 1, effect: "Gain 1 free Requisition Point" },
                    { name: "Rare Bioforms", cost: 2, effect: "Use Renowned Heroes Requisition for 1 RP less" },
                  ].map((u) => (
                    <div key={u.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div>
                        <span style={{ color: "#c060e0", fontSize: 12, fontWeight: 600 }}>{u.name} ({u.cost} BP): </span>
                        <span style={{ color: "#888", fontSize: 12 }}>{u.effect}</span>
                      </div>
                      <button
                        disabled={(activeRoster.biomassPoints || 0) < u.cost}
                        onClick={() => updateRoster({ biomassPoints: Math.max(0, (activeRoster.biomassPoints || 0) - u.cost) })}
                        style={{ background: (activeRoster.biomassPoints || 0) >= u.cost ? "#4a0070" : "#2a2a2a", border: "1px solid #6a0099", color: (activeRoster.biomassPoints || 0) >= u.cost ? "#c060e0" : "#555", padding: "4px 10px", cursor: (activeRoster.biomassPoints || 0) >= u.cost ? "pointer" : "not-allowed", fontSize: 11, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
                      >Spend</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {CRUSADE_AGENDAS.filter((a) => !a.factionRestriction || a.factionRestriction === activeRoster.factionId).map((ag) => (
                  <div key={ag.id} style={{ padding: 14, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: accent, fontWeight: 700, fontSize: 14 }}>{ag.name}</span>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                        {ag.xpReward > 0 && <span style={{ color: "#e0c070", fontSize: 12 }}>+{ag.xpReward} XP</span>}
                        {ag.cpReward > 0 && <span style={{ color: "#70a0e0", fontSize: 12 }}>+{ag.cpReward} CP</span>}
                        {ag.biomassReward > 0 && <span style={{ color: "#c060e0", fontSize: 12 }}>+{ag.biomassReward} BP</span>}
                      </div>
                    </div>
                    <div style={{ color: "#999", fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{ag.description}</div>
                    <button
                      onClick={() => {
                        updateRoster({
                          crusadePoints: activeRoster.crusadePoints + (ag.cpReward || 0),
                          biomassPoints: (activeRoster.biomassPoints || 0) + (ag.biomassReward || 0),
                          agendaLog: [...(activeRoster.agendaLog || []), { id: ag.id, name: ag.name, completedAt: new Date().toLocaleString() }],
                        });
                      }}
                      style={{ background: fColor, border: "none", color: accent, padding: "8px 14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, WebkitTapHighlightColor: "transparent" }}
                    >
                      Mark Complete{ag.cpReward > 0 ? ` (+${ag.cpReward} CP)` : ""}{ag.biomassReward > 0 ? ` (+${ag.biomassReward} BP)` : ""}
                    </button>
                  </div>
                ))}
              </div>
              {(activeRoster.agendaLog?.length || 0) > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Completed Agendas</div>
                  {activeRoster.agendaLog.map((a, i) => (
                    <div key={i} style={{ padding: "8px 12px", background: "rgba(0,0,0,0.2)", border: "1px solid #2a0000", marginBottom: 6 }}>
                      <div style={{ color: "#70c070", fontSize: 13 }}>{a.name}</div>
                      <div style={{ color: "#555", fontSize: 11 }}>{a.completedAt}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── BATTLE LOG ── */}
          {tab === "battle-log" && (
            <BattleLogSection roster={activeRoster} onUpdate={updateRoster} factionData={factionData} />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BATTLE LOG SECTION
// ============================================================
// Sub-component of CrusadeSection for recording and viewing battle results.
function BattleLogSection({ roster, onUpdate, factionData }) {
  const [newBattle, setNewBattle] = useState({ opponent: "", result: "Victory", agendas: "", notes: "", cpEarned: 0 });
  const accent = factionData?.accentColor || "#e0c070";
  const fColor = factionData?.color || "#8b0000";

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #444", color: "#ccc", padding: "9px 10px", fontSize: 14, fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none" };

  // Records a battle result, updates the tally, and awards CP.
  function addBattle() {
    if (!newBattle.opponent) return;
    const cpGained = newBattle.result === "Victory" ? 3 : newBattle.result === "Draw" ? 1 : 0;
    onUpdate({
      battleLog: [{ id: Date.now().toString(), date: new Date().toLocaleString(), ...newBattle, cpEarned: cpGained }, ...(roster.battleLog || [])],
      battleTally: { ...roster.battleTally, [newBattle.result === "Victory" ? "victories" : newBattle.result === "Draw" ? "draws" : "defeats"]: (roster.battleTally[newBattle.result === "Victory" ? "victories" : newBattle.result === "Draw" ? "draws" : "defeats"] || 0) + 1 },
      crusadePoints: (roster.crusadePoints || 0) + cpGained,
    });
    setNewBattle({ opponent: "", result: "Victory", agendas: "", notes: "", cpEarned: 0 });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={newBattle.opponent} onChange={(e) => setNewBattle((p) => ({ ...p, opponent: e.target.value }))} placeholder="Opponent army / player..." style={inputStyle} />
        <select value={newBattle.result} onChange={(e) => setNewBattle((p) => ({ ...p, result: e.target.value }))} style={{ ...inputStyle, background: "#1a0000" }}>
          <option>Victory</option><option>Draw</option><option>Defeat</option>
        </select>
        <input value={newBattle.agendas} onChange={(e) => setNewBattle((p) => ({ ...p, agendas: e.target.value }))} placeholder="Agendas completed..." style={inputStyle} />
        <textarea value={newBattle.notes} onChange={(e) => setNewBattle((p) => ({ ...p, notes: e.target.value }))} placeholder="Battle notes, highlights..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        <button onClick={addBattle} style={{ background: fColor, border: "none", color: accent, padding: "13px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>Record Battle</button>
      </div>

      {(!roster.battleLog || roster.battleLog.length === 0) && <div style={{ color: "#444", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: 16 }}>No battles recorded yet. For Khorne!</div>}
      {(roster.battleLog || []).map((b) => (
        <div key={b.id} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.3)", border: `1px solid ${b.result === "Victory" ? "#3a5a00" : b.result === "Defeat" ? "#5a0000" : "#3a3a00"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#ccc", fontSize: 14, fontWeight: 600 }}>vs. {b.opponent}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {b.cpEarned > 0 && <span style={{ color: "#70a0e0", fontSize: 12 }}>+{b.cpEarned} CP</span>}
              <span style={{ fontSize: 13, fontWeight: 600, color: b.result === "Victory" ? "#70c070" : b.result === "Defeat" ? "#c07070" : "#c0c070" }}>{b.result}</span>
            </div>
          </div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{b.date}</div>
          {b.agendas && <div style={{ color: "#777", fontSize: 12, marginTop: 4 }}>Agendas: {b.agendas}</div>}
          {b.notes && <div style={{ color: "#777", fontSize: 12, marginTop: 3 }}>{b.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// Root component. Manages the four top-level tabs (Builder, Rules, Crusade, Campaign),
// the Narrative Mode toggle, and global CSS (fonts, scrollbars, safe-area insets).
// Mobile: fixed bottom tab bar. Desktop: top tab bar.
export default function App() {
  const [activeTab, setActiveTab] = useState("builder");
  const [narrativeMode, setNarrativeMode] = useState(false);
  const isMobile = useIsMobile();

  // Four top-level tabs — Crusade is now its own dedicated section.
  const tabs = [
    { id: "builder", label: "Builder", icon: "⚔" },
    { id: "rules", label: "Rules", icon: "📖" },
    { id: "crusade", label: "Crusade", icon: "🎖" },
    { id: "campaign", label: "Campaign", icon: "🗺" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0000",
      fontFamily: "var(--font-body)",
      "--font-display": "'Cinzel', 'Trajan Pro', Georgia, serif",
      "--font-body": "'Crimson Text', 'Palatino Linotype', Georgia, serif",
      color: "#ccc",
      paddingBottom: isMobile ? "calc(64px + env(safe-area-inset-bottom, 0px))" : 0,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        input::placeholder, textarea::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0000; }
        ::-webkit-scrollbar-thumb { background: #5a0000; }
        body { background: #0a0000; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        button, [role="button"], input, select { touch-action: manipulation; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #1a0000 0%, #0f0000 100%)", borderBottom: "2px solid #8b0000", padding: isMobile ? "10px 14px" : "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22, color: "#8b0000", flexShrink: 0 }}>✠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 15 : 22, color: "#e0c070", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Chaos Army Builder</h1>
          <div style={{ color: "#5a0000", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>CSM · WE · SM · TYR · 11th Edition</div>
        </div>
        {activeTab === "builder" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Narrative</span>
            <div onClick={() => setNarrativeMode((p) => !p)} style={{ width: 44, height: 26, background: narrativeMode ? "#8b0000" : "#222", border: `1px solid ${narrativeMode ? "#cc2020" : "#444"}`, borderRadius: 13, cursor: "pointer", position: "relative", transition: "all 0.2s", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ position: "absolute", top: 3, left: narrativeMode ? 21 : 3, width: 18, height: 18, background: narrativeMode ? "#e0c070" : "#555", borderRadius: "50%", transition: "all 0.2s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Desktop top tab bar */}
      {!isMobile && (
        <div style={{ background: "#0f0000", borderBottom: "1px solid #2a0000", display: "flex" }}>
          {tabs.map((t) => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "12px 24px", background: "none", border: "none", borderBottom: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`, color: activeTab === t.id ? "#e0c070" : "#666", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>{t.label}</button>)}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: isMobile ? "100%" : 1100, margin: "0 auto", padding: isMobile ? "14px 12px" : "24px 16px" }}>
        {activeTab === "builder" && <ArmyBuilder narrativeMode={narrativeMode} />}
        {activeTab === "rules" && <RulesReference />}
        {activeTab === "crusade" && <CrusadeSection />}
        {activeTab === "campaign" && <NarrativeHub />}
      </div>

      {!isMobile && <div style={{ textAlign: "center", padding: 20, color: "#2a0000", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>In the grim darkness of the far future, there is only war.</div>}

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f0000", borderTop: "2px solid #8b0000", display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 2px", minHeight: 56, background: "none", border: "none", borderTop: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`, color: activeTab === t.id ? "#e0c070" : "#555", cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NARRATIVE CAMPAIGN HUB
// ============================================================
// Standalone campaign management panel — separate from the Crusade system.
// Tracks campaign name, warband, territory control, battle log, and Crusade Points.
function NarrativeHub() {
  const [campaign, setCampaign] = useState({ name: "The Whispered Crusade", warband: "Sons of the Fell Hour", territories: [], battleLog: [], crusadePoints: 0 });
  const [newTerritory, setNewTerritory] = useState({ name: "", bonus: "" });
  const [newBattle, setNewBattle] = useState({ opponent: "", result: "Victory", notes: "" });

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #333", color: "#ccc", padding: "10px 12px", fontSize: 15, fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none" };

  // Appends a territory and awards +1 CP.
  function addTerritory() {
    if (!newTerritory.name) return;
    setCampaign((p) => ({ ...p, territories: [...p.territories, { id: Date.now(), ...newTerritory }], crusadePoints: p.crusadePoints + 1 }));
    setNewTerritory({ name: "", bonus: "" });
  }

  // Prepends a battle record and awards CP by result.
  function addBattle() {
    if (!newBattle.opponent) return;
    setCampaign((p) => ({ ...p, battleLog: [{ id: Date.now(), date: new Date().toLocaleDateString(), ...newBattle }, ...p.battleLog], crusadePoints: p.crusadePoints + (newBattle.result === "Victory" ? 3 : newBattle.result === "Draw" ? 1 : 0) }));
    setNewBattle({ opponent: "", result: "Victory", notes: "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}>
      <div style={{ padding: 16, background: "rgba(0,0,0,0.5)", border: "1px solid #5a2000", display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Campaign Name</label><input value={campaign.name} onChange={(e) => setCampaign((p) => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, color: "#e0c070", borderColor: "#5a2000", fontSize: 16, fontFamily: "var(--font-display)" }} /></div>
        <div><label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Warband Name</label><input value={campaign.warband} onChange={(e) => setCampaign((p) => ({ ...p, warband: e.target.value }))} style={{ ...inputStyle, borderColor: "#5a2000" }} /></div>
        <div style={{ background: "rgba(139,0,0,0.2)", border: "1px solid #8b0000", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Crusade Points</span><span style={{ color: "#e0c070", fontSize: 32, fontWeight: 700, fontFamily: "var(--font-display)" }}>{campaign.crusadePoints}</span></div>
      </div>
      <div>
        <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Territory Control</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <input value={newTerritory.name} onChange={(e) => setNewTerritory((p) => ({ ...p, name: e.target.value }))} placeholder="Territory name..." style={inputStyle} />
          <input value={newTerritory.bonus} onChange={(e) => setNewTerritory((p) => ({ ...p, bonus: e.target.value }))} placeholder="Strategic bonus..." style={inputStyle} />
          <button onClick={addTerritory} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>Claim Territory (+1 CP)</button>
        </div>
        {campaign.territories.length === 0 && <div style={{ color: "#444", fontStyle: "italic", fontSize: 13, padding: 10 }}>No territories claimed yet.</div>}
        {campaign.territories.map((t) => (<div key={t.id} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid #3a2000", marginBottom: 8 }}><div style={{ color: "#e0c070", fontSize: 14, fontWeight: 600 }}>{t.name}</div>{t.bonus && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{t.bonus}</div>}</div>))}
      </div>
      <div>
        <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Battle Log</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <input value={newBattle.opponent} onChange={(e) => setNewBattle((p) => ({ ...p, opponent: e.target.value }))} placeholder="Opponent / Army..." style={inputStyle} />
          <select value={newBattle.result} onChange={(e) => setNewBattle((p) => ({ ...p, result: e.target.value }))} style={{ ...inputStyle, background: "#1a0000" }}><option>Victory</option><option>Draw</option><option>Defeat</option></select>
          <input value={newBattle.notes} onChange={(e) => setNewBattle((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes..." style={inputStyle} />
          <button onClick={addBattle} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>Record Battle</button>
        </div>
        {campaign.battleLog.length === 0 && <div style={{ color: "#444", fontStyle: "italic", fontSize: 13, padding: 10 }}>No battles recorded.</div>}
        {campaign.battleLog.map((b) => (<div key={b.id} style={{ padding: "12px 14px", marginBottom: 8, background: "rgba(0,0,0,0.3)", border: `1px solid ${b.result === "Victory" ? "#3a5a00" : b.result === "Defeat" ? "#5a0000" : "#3a3a00"}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#ccc", fontSize: 14, fontWeight: 600 }}>vs. {b.opponent}</span><span style={{ fontSize: 13, fontWeight: 600, color: b.result === "Victory" ? "#70c070" : b.result === "Defeat" ? "#c07070" : "#c0c070" }}>{b.result}</span></div><div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{b.date}</div>{b.notes && <div style={{ color: "#777", fontSize: 13, marginTop: 5 }}>{b.notes}</div>}</div>))}
      </div>
    </div>
  );
}