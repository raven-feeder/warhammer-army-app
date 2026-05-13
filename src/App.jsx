// ============================================================
// IMPORTS
// ============================================================
import { useState, useEffect } from "react";

// ============================================================
// FIREBASE CONFIGURATION (CLOUD SAVES)
// ============================================================
// To enable cloud saves:
//   1. Go to https://firebase.google.com and create a free project
//   2. Enable Authentication (Google, Apple, Email/Password) in the Firebase console
//   3. Enable Firestore Database in the Firebase console
//   4. Run: npm install firebase
//   5. Replace the placeholder values below with your project config keys
//   6. Uncomment all lines marked FIREBASE STEP 1 / STEP 2
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

// Namespaced key under which all saved army lists are persisted in localStorage.
const STORAGE_KEY = "csm_army_lists_v3";

// Reads all saved army lists from localStorage.
// Returns an empty array if nothing has been saved yet or if JSON parsing fails.
function loadListsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Serialises the provided army lists array and writes it to localStorage.
// Called any time the user saves, renames, or deletes a list.
function saveListsToStorage(lists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    console.error("localStorage write failed — storage quota may be full.");
  }
}

// ============================================================
// GAME DATA — CHAOS SPACE MARINES (10th Edition)
// ============================================================
// Source: Codex: Chaos Space Marines (2024), Wahapedia 10th ed.
// Points and rules are accurate as of the 2024 codex release.
// Always cross-reference with the latest GW points document for tournament play.

const CSM_DATA = {
  id: "csm",
  name: "Chaos Space Marines",
  shortName: "CSM",
  color: "#8b0000",
  accentColor: "#e0c070",
  tagline: "Slaves to Darkness",
  icon: "✠",

  // ── Army Rule ──
  armyRule: {
    name: "Dark Pacts",
    description: "Once per turn, when a unit from your army is selected to shoot or fight, you can make a Dark Pact for that unit. Roll one D6: on a 2+, until the end of the phase that unit's weapons have either Lethal Hits or Sustained Hits 1 (your choice). On a 1, that unit suffers D3 mortal wounds.",
  },

  // ── Detachments ──
  detachments: [
    {
      name: "Veterans of the Long War",
      rule: "Focus of Hatred: Select one enemy unit at the start of your Command phase. Until your next Command phase, friendly CSM CORE units that target that unit get +1 to wound rolls.",
    },
    {
      name: "Renegade Raiders",
      rule: "Swift Hunters: Friendly CSM units can re-roll Advance rolls. Units that Advance can still shoot with Assault weapons. Units that Advance and charge in the same turn do not suffer the -1 to hit rolls.",
    },
    {
      name: "Creations of Bile",
      rule: "Grotesque Experiments: At the start of the battle, each non-DAMNED INFANTRY unit gains one of: +1 WS, +1 BS, +1 Strength (melee), +1 Toughness, +1 Attack, or +2\" Move.",
    },
    {
      name: "Soulforged Warpack",
      rule: "Daemonic Onslaught: Each time a friendly CHAOS VEHICLE or DAEMON unit makes an attack, re-roll a Hit roll of 1.",
    },
  ],

  // ── Enhancements (Veterans of the Long War) ──
  enhancements: [
    { id: "csm-e1", name: "Blade of the Relentless", points: 20, description: "Bearer's melee weapons gain +1 Strength and +1 Damage." },
    { id: "csm-e2", name: "Mark of the Chosen", points: 15, description: "Bearer gains the Chosen keyword and +1 to all saving throws." },
    { id: "csm-e3", name: "Sigil of Corruption", points: 25, description: "Once per battle, at the start of the Fight phase, all friendly CSM units within 6\" gain +1 Attack until end of phase." },
    { id: "csm-e4", name: "Warpforged Armour", points: 30, description: "Bearer gains a 4+ invulnerable save." },
    { id: "csm-e5", name: "Cursed Fang", points: 10, description: "Improve the AP of one of the bearer's melee weapons by 1. That weapon also has the Precision ability." },
    { id: "csm-e6", name: "Shroud of Obfuscation", points: 15, description: "Bearer has the Stealth and Lone Operative abilities." },
  ],

  // ── Stratagems ──
  stratagems: [
    { id: "csm-s1", name: "Hateful Assault", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM unit is chosen to fight. Until the end of the phase, that unit's melee weapons have the Lethal Hits ability." },
    { id: "csm-s2", name: "Malicious Volleys", cost: "1 CP", phase: "Shooting Phase", description: "Use when a CSM INFANTRY unit is chosen to shoot. Until end of phase, add 1 to the Attacks of that unit's bolt weapons." },
    { id: "csm-s3", name: "Veterans of the Long War", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM CORE unit is selected to fight. Until the end of the phase, add 1 to wound rolls for that unit's melee weapons against IMPERIUM units." },
    { id: "csm-s4", name: "Warpfire Baptism", cost: "1 CP", phase: "Shooting Phase", description: "Use when a SORCERER in your army is chosen to shoot. Until end of phase, that unit's ranged weapons gain the Devastating Wounds ability." },
    { id: "csm-s5", name: "Death to the False Emperor", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM unit fights. Until the end of the phase, each unmodified hit roll of 6 for that unit scores 1 additional hit against IMPERIUM units." },
    { id: "csm-s6", name: "Chaos Undivided", cost: "2 CP", phase: "Command Phase", description: "Use at the start of your command phase. One friendly CSM unit within 12\" of your WARLORD regains D3 lost wounds." },
    { id: "csm-s7", name: "Daemonic Ritual", cost: "1 CP", phase: "Movement Phase", description: "Use at the start of your Movement phase. Select a CSM CHARACTER. Until the end of the phase, that model can attempt to summon a DAEMON unit." },
    { id: "csm-s8", name: "Warp Surge", cost: "2 CP", phase: "Fight Phase", description: "Use when a POSSESSED or GREATER POSSESSED unit is chosen to fight. Until the end of the phase, add 2 to the Attacks of models in that unit." },
  ],

  // ── Marks of Chaos ──
  // World Eaters are all Khorne-dedicated; CSM can take any mark
  marks: [
    { id: "undivided", name: "Undivided", bonus: "No specific bonus — pure Chaos" },
    { id: "khorne", name: "Mark of Khorne", bonus: "+1 Attack in the Fight phase" },
    { id: "tzeentch", name: "Mark of Tzeentch", bonus: "5+ invulnerable save (or improve existing by 1)" },
    { id: "nurgle", name: "Mark of Nurgle", bonus: "+1 Toughness" },
    { id: "slaanesh", name: "Mark of Slaanesh", bonus: "+1\" to Advance and Charge rolls" },
  ],

  // ── Unit Roster ──
  units: [
    // ════════════════════════════════════════
    // CHARACTERS
    // ════════════════════════════════════════
    {
      id: "csm-abaddon",
      name: "Abaddon the Despoiler",
      role: "CHARACTER",
      points: 310,
      keywords: ["CHARACTER", "INFANTRY", "TERMINATOR", "EPIC HERO", "CHAOS UNDIVIDED", "CHAOS", "ABADDON THE DESPOILER"],
      stats: { M: '6"', T: 5, Sv: "2+", W: 9, Ld: "5+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Paragon of Hatred (Aura)", description: "While a friendly HERETIC ASTARTES unit is within 6\" of this model, each time a model in that unit makes an attack, you can re-roll the Hit roll." },
        { name: "Lord of the Traitor Legions (Aura)", description: "While a friendly HERETIC ASTARTES unit is within 6\" of this model, you can re-roll Leadership and Battle-shock tests for that unit." },
        { name: "Dark Destiny", description: "Once per battle, when Abaddon makes a Dark Pact roll, if the result is 7+ (two dice), he gains 1 CP instead of suffering mortal wounds on a 1." },
        { name: "Warmaster", description: "Abaddon must be your WARLORD if included in your army." },
      ],
      weapons: {
        ranged: [
          { id: "abd-talon", name: "Talon of Horus", range: '24"', attacks: 4, skill: "2+", strength: 5, AP: -2, damage: 1, special: "Sustained Hits 1", points: 0 },
        ],
        melee: [
          { id: "abd-drach", name: "Drach'nyen", attacks: 8, skill: "2+", strength: 14, AP: -4, damage: 3, special: "Devastating Wounds", points: 0 },
          { id: "abd-talon-melee", name: "Talon of Horus (melee)", attacks: 14, skill: "2+", strength: 7, AP: -3, damage: 1, special: "Devastating Wounds, Sustained Hits 1", points: 0 },
        ],
      },
    },
    {
      id: "csm-chaos-lord",
      name: "Chaos Lord",
      role: "CHARACTER",
      points: 75,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS LORD", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 5, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Lord of Chaos", description: "Once per battle round, when a friendly CSM unit within 6\" is targeted with a Stratagem, reduce the CP cost by 1." },
        { name: "Warlord Trait", description: "If this model is your WARLORD, select one Warlord Trait." },
      ],
      weapons: {
        ranged: [
          { id: "cl-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "cl-plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["cl-plasma-pistol"] },
          { id: "cl-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0, exclusive: ["cl-plasma-pistol"] },
        ],
        melee: [
          { id: "cl-chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cl-power-fist", "cl-daemon-blade", "cl-accursed"] },
          { id: "cl-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cl-chainsword", "cl-daemon-blade", "cl-accursed"] },
          { id: "cl-daemon-blade", name: "Daemon Blade", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 2, special: "Anti-IMPERIUM 4+", points: 15, exclusive: ["cl-chainsword", "cl-power-fist", "cl-accursed"] },
          { id: "cl-accursed", name: "Accursed Weapon", attacks: 5, skill: "3+", strength: 5, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cl-chainsword", "cl-power-fist", "cl-daemon-blade"] },
        ],
      },
    },
    {
      id: "csm-chaos-lord-terminator",
      name: "Chaos Lord in Terminator Armour",
      role: "CHARACTER",
      points: 100,
      keywords: ["CHARACTER", "INFANTRY", "TERMINATOR", "CHAOS LORD", "CHAOS SPACE MARINES"],
      stats: { M: '5"', T: 5, Sv: "2+", W: 6, Ld: "6+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Lord of Chaos", description: "Once per battle round, when a friendly CSM unit within 6\" is targeted with a Stratagem, reduce the CP cost by 1." },
        { name: "Deep Strike", description: "This unit can be set up anywhere on the battlefield that is more than 9\" from all enemy models." },
      ],
      weapons: {
        ranged: [
          { id: "clt-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "clt-combi-weapon", name: "Combi-weapon", range: '24"', attacks: 1, skill: "3+", strength: 4, AP: -1, damage: 1, special: "Rapid Fire 1, Devastating Wounds", points: 5, exclusive: ["clt-combi"] },
        ],
        melee: [
          { id: "clt-chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["clt-power-fist", "clt-lightning-claws"] },
          { id: "clt-power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["clt-chainsword", "clt-lightning-claws"] },
          { id: "clt-lightning-claws", name: "Paired Lightning Claws", attacks: 6, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 5, exclusive: ["clt-chainsword", "clt-power-fist"] },
        ],
      },
    },
    {
      id: "csm-dark-apostle",
      name: "Dark Apostle",
      role: "CHARACTER",
      points: 65,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS", "DARK APOSTLE", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "5+", OC: 1 },
      abilities: [
        { name: "Dark Zealotry", description: "While this unit is leading a unit, each time a model in that unit makes a melee attack, add 1 to the Wound roll." },
        { name: "Demagogue", description: "Once per battle, at the start of any phase, select one friendly HERETIC ASTARTES unit that is Battle-shocked within 12\". That unit is no longer Battle-shocked." },
        { name: "Malign Sacrifice", description: "At the start of the Fight phase, if this unit contains a Dark Disciple, select one enemy unit within Engagement Range. Roll 1D6: on 2-5, that enemy suffers 1 mortal wound; on 6, D3 mortal wounds. The Dark Disciple is then destroyed." },
      ],
      weapons: {
        ranged: [
          { id: "da-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
        ],
        melee: [
          { id: "da-crozius", name: "Accursed Crozius", attacks: 5, skill: "3+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-sorcerer",
      name: "Sorcerer",
      role: "CHARACTER",
      points: 80,
      keywords: ["CHARACTER", "INFANTRY", "PSYKER", "CHAOS", "SORCERER", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Psychic Ritual", description: "At the start of your Shooting phase, this model can perform a Psychic Ritual. Select one enemy unit within 18\" and roll 3D6. If the total exceeds the target's Toughness, deal D3 mortal wounds." },
        { name: "Warp Finesse", description: "While this model is leading a unit, each time a model in that unit makes an attack, you can re-roll one Hit roll or one Wound roll." },
      ],
      weapons: {
        ranged: [
          { id: "sorc-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
          { id: "sorc-plasma", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["sorc-bolt-pistol"] },
        ],
        melee: [
          { id: "sorc-force", name: "Force Weapon", attacks: 4, skill: "3+", strength: 5, AP: -1, damage: "D3", special: "Psychic", points: 0 },
        ],
      },
    },
    {
      id: "csm-warpsmith",
      name: "Warpsmith",
      role: "CHARACTER",
      points: 75,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS", "WARPSMITH", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Master of Machines", description: "At the end of your Movement phase, this model can repair one friendly VEHICLE within 3\". That model regains up to D3 lost wounds." },
        { name: "Warp Curse", description: "At the start of the Shooting phase, select one enemy VEHICLE within 18\". Until the end of the phase, worsen that model's Save by 1." },
      ],
      weapons: {
        ranged: [
          { id: "ws-flamer", name: "Mechatendril Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 0 },
        ],
        melee: [
          { id: "ws-axe", name: "Hellforged Axe", attacks: 4, skill: "3+", strength: 6, AP: -2, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-master-executions",
      name: "Master of Executions",
      role: "CHARACTER",
      points: 80,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS", "MASTER OF EXECUTIONS", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Cruel Hunter", description: "While this model is leading a unit, each time that unit Piles In or Consolidates, each model can move up to 6\" instead of 3\"." },
        { name: "Decapitating Strike", description: "Each time this model makes a melee attack, an unmodified Hit roll of 6 causes 2 additional mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "me-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
        ],
        melee: [
          { id: "me-axe", name: "Axe of Dismemberment", attacks: 5, skill: "3+", strength: 8, AP: -3, damage: 2, special: "Devastating Wounds", points: 0 },
        ],
      },
    },
    {
      id: "csm-daemon-prince",
      name: "Heretic Astartes Daemon Prince",
      role: "CHARACTER",
      points: 155,
      keywords: ["CHARACTER", "MONSTER", "CHAOS", "DAEMON", "DAEMON PRINCE", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 9, Sv: "3+", W: 9, Ld: "6+", OC: 3, Inv: "4+" },
      abilities: [
        { name: "Daemonic Terror", description: "Once per battle, at the start of the Fight phase, all enemy units within 6\" must take a Battle-shock test." },
        { name: "Warp-touched Form", description: "Each time this model makes a charge move, until the end of the turn, add 1 to the Attacks of this model's melee weapons." },
        { name: "Deadly Demise D3", description: "When this model is destroyed, roll 1D6 for each unit within 6\": on a 4+, that unit suffers D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "dp-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
        ],
        melee: [
          { id: "dp-hellforged-strike", name: "Hellforged Weapons – strike", attacks: 6, skill: "3+", strength: 7, AP: -2, damage: 3, special: "—", points: 0, exclusive: ["dp-talons"] },
          { id: "dp-hellforged-sweep", name: "Hellforged Weapons – sweep", attacks: 12, skill: "3+", strength: 5, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["dp-talons"] },
          { id: "dp-talons", name: "Paired Malefic Talons", attacks: 7, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Twin-linked", points: 10, exclusive: ["dp-hellforged-strike", "dp-hellforged-sweep"] },
        ],
      },
    },

    // ════════════════════════════════════════
    // BATTLELINE
    // ════════════════════════════════════════
    {
      id: "csm-legionaries",
      name: "Legionaries",
      role: "BATTLELINE",
      points: 80,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "CHAOS", "LEGIONARIES", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Death to the False Emperor", description: "Each time a model in this unit makes a melee attack against an IMPERIUM unit, on an unmodified Hit roll of 6, score 1 additional hit." },
        { name: "Hateful Assault", description: "Each time this unit fights, if it made a charge move this turn, add 1 to the Attacks characteristic of melee weapons equipped by models in this unit." },
      ],
      weapons: {
        ranged: [
          { id: "leg-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },
          { id: "leg-plasma", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["leg-melta", "leg-flamer", "leg-boltgun"], limit: 2 },
          { id: "leg-melta", name: "Meltagun", range: '12"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["leg-plasma", "leg-flamer", "leg-boltgun"], limit: 2 },
          { id: "leg-flamer", name: "Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Torrent, Ignores Cover", points: 5, exclusive: ["leg-plasma", "leg-melta", "leg-boltgun"], limit: 2 },
          { id: "leg-autocannon", name: "Autocannon", range: '48"', attacks: 2, skill: "3+", strength: 9, AP: -1, damage: 3, special: "Heavy", points: 10, exclusive: ["leg-plasma", "leg-melta", "leg-flamer", "leg-boltgun"], limit: 1 },
        ],
        melee: [
          { id: "leg-chainsword", name: "Chainsword", attacks: 3, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "leg-power-fist", name: "Power Fist (Champion)", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, limit: 1 },
        ],
      },
    },
    {
      id: "csm-cultist-mob",
      name: "Cultist Mob",
      role: "BATTLELINE",
      points: 50,
      baseSize: 10,
      keywords: ["INFANTRY", "CORE", "CHAOS", "CULTIST MOB", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 3, Sv: "6+", W: 1, Ld: "7+", OC: 2 },
      abilities: [
        { name: "Fanatical Devotion", description: "Each time a model in this unit would lose a wound, roll 1D6. On a 6+, that wound is not lost." },
        { name: "Tide of Traitors", description: "Once per battle, at the end of your Movement phase, if this unit has been destroyed, you can set it back up anywhere on the battlefield with its starting number of models, more than 9\" from all enemy units." },
      ],
      weapons: {
        ranged: [
          { id: "cult-autopistol", name: "Autopistol", range: '12"', attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Pistol", points: 0 },
          { id: "cult-autogun", name: "Autogun", range: '24"', attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0, exclusive: ["cult-autopistol"] },
        ],
        melee: [
          { id: "cult-knife", name: "Brutal Assault Weapon", attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },

    // ════════════════════════════════════════
    // ELITE / OTHER
    // ════════════════════════════════════════
    {
      id: "csm-chosen",
      name: "Chosen",
      role: "ELITE",
      points: 150,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "CHAOS", "CHOSEN", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Chosen Warriors", description: "Each model in this unit can be equipped with a different weapon loadout." },
        { name: "Aura of Dark Glory", description: "Friendly CSM CORE units within 6\" gain +1 to Leadership." },
      ],
      weapons: {
        ranged: [
          { id: "cho-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "cho-plasma", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["cho-combi"], limit: 2 },
        ],
        melee: [
          { id: "cho-chainsword", name: "Chainsword", attacks: 4, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["cho-power-fist", "cho-lightning-claws"] },
          { id: "cho-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["cho-chainsword", "cho-lightning-claws"], limit: 2 },
          { id: "cho-lightning-claws", name: "Lightning Claws (pair)", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 10, exclusive: ["cho-chainsword", "cho-power-fist"], limit: 2 },
        ],
      },
    },
    {
      id: "csm-terminators",
      name: "Chaos Terminator Squad",
      role: "ELITE",
      points: 175,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "TERMINATOR", "CHAOS", "CHAOS SPACE MARINES"],
      stats: { M: '5"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Deep Strike", description: "This unit can be set up anywhere on the battlefield more than 9\" from all enemy units." },
        { name: "Terminator Resilience", description: "Each time an attack is allocated to a model in this unit, subtract 1 from the Damage characteristic (minimum 1)." },
      ],
      weapons: {
        ranged: [
          { id: "term-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "term-combi-melta", name: "Combi-melta", range: '24"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2, Rapid Fire 1", points: 10, exclusive: ["term-combi"], limit: 2 },
          { id: "term-combi-plasma", name: "Combi-plasma", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 8, exclusive: ["term-combi"], limit: 2 },
          { id: "term-reaper", name: "Reaper Autocannon", range: '36"', attacks: 4, skill: "3+", strength: 7, AP: -1, damage: 1, special: "Heavy", points: 10, exclusive: ["term-combi"], limit: 1 },
        ],
        melee: [
          { id: "term-chainfist", name: "Chainfist", attacks: 3, skill: "4+", strength: 8, AP: -4, damage: 2, special: "Anti-VEHICLE 4+", points: 0 },
          { id: "term-lightning-claws", name: "Lightning Claws (pair)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0, exclusive: ["term-chainfist"] },
          { id: "term-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["term-chainfist", "term-lightning-claws"] },
        ],
      },
    },
    {
      id: "csm-possessed",
      name: "Possessed",
      role: "ELITE",
      points: 130,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "CHAOS", "DAEMON", "POSSESSED", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 5, Sv: "3+", W: 3, Ld: "6+", OC: 2, Inv: "5+" },
      abilities: [
        { name: "Daemonic Might", description: "Add 1 to the Attacks characteristic of melee weapons equipped by models in this unit." },
        { name: "Warp-touched Resilience", description: "Each time a model in this unit would lose a wound, roll 1D6. On a 5+, that wound is not lost." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "poss-mutations", name: "Hideous Mutations", attacks: 4, skill: "3+", strength: 6, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-obliterators",
      name: "Obliterators",
      role: "ELITE",
      points: 140,
      baseSize: 2,
      keywords: ["INFANTRY", "CHAOS", "DAEMON", "OBLITERATORS", "CHAOS SPACE MARINES"],
      stats: { M: '5"', T: 6, Sv: "2+", W: 4, Ld: "6+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Fleshmetal Guns", description: "Each time this unit is chosen to shoot, select one Fleshmetal Guns weapon profile to use." },
        { name: "Deep Strike", description: "This unit can be set up anywhere on the battlefield more than 9\" from all enemy units." },
        { name: "Daemon Resilience", description: "This unit has a 4+ invulnerable save." },
      ],
      weapons: {
        ranged: [
          { id: "obl-heavy", name: "Fleshmetal Guns – heavy", range: '24"', attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 3, special: "Heavy", points: 0 },
          { id: "obl-assault", name: "Fleshmetal Guns – assault", range: '12"', attacks: 4, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0 },
          { id: "obl-melta", name: "Fleshmetal Guns – melta", range: '12"', attacks: 2, skill: "4+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0 },
        ],
        melee: [
          { id: "obl-fists", name: "Crushing Fists", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-havocs",
      name: "Havocs",
      role: "HEAVY",
      points: 115,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "CHAOS", "HAVOCS", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Malicious Volleys", description: "Each time a model in this unit makes a ranged attack with a bolt weapon, add 1 to the Attacks characteristic of that weapon." },
        { name: "Fire Discipline", description: "Models in this unit do not suffer the penalty to Hit rolls for moving and shooting Heavy weapons." },
      ],
      weapons: {
        ranged: [
          { id: "hav-boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },
          { id: "hav-autocannon", name: "Autocannon", range: '48"', attacks: 2, skill: "3+", strength: 9, AP: -1, damage: 3, special: "Heavy", points: 10, exclusive: ["hav-boltgun", "hav-lascannon", "hav-heavy-bolter", "hav-missile"], limit: 4 },
          { id: "hav-lascannon", name: "Lascannon", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["hav-boltgun", "hav-autocannon", "hav-heavy-bolter", "hav-missile"], limit: 4 },
          { id: "hav-heavy-bolter", name: "Heavy Bolter", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 5, exclusive: ["hav-boltgun", "hav-autocannon", "hav-lascannon", "hav-missile"], limit: 4 },
          { id: "hav-missile", name: "Missile Launcher", range: '48"', attacks: 1, skill: "3+", strength: 10, AP: -2, damage: "D6", special: "Heavy, Indirect Fire", points: 15, exclusive: ["hav-boltgun", "hav-autocannon", "hav-lascannon", "hav-heavy-bolter"], limit: 4 },
        ],
        melee: [
          { id: "hav-chainsword", name: "Chainsword", attacks: 2, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-raptors",
      name: "Raptors",
      role: "FAST ATTACK",
      points: 80,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "JUMP PACK", "CHAOS", "RAPTORS", "CHAOS SPACE MARINES"],
      stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Jump Pack Assault", description: "During the Declare Battle Formations step, this unit can be placed into Strategic Reserves for free." },
        { name: "Swift Raptors", description: "This unit can charge in the same turn it arrived from Strategic Reserves." },
      ],
      weapons: {
        ranged: [
          { id: "rapt-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
          { id: "rapt-plasma", name: "Plasma Pistol (x2)", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 8, exclusive: ["rapt-bolt-pistol"] },
        ],
        melee: [
          { id: "rapt-chainsword", name: "Chainsword", attacks: 3, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "rapt-lightning-claws", name: "Lightning Claws (Champion)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 10, limit: 1 },
        ],
      },
    },
    {
      id: "csm-warp-talons",
      name: "Warp Talons",
      role: "FAST ATTACK",
      points: 95,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "JUMP PACK", "DAEMON", "CHAOS", "WARP TALONS", "CHAOS SPACE MARINES"],
      stats: { M: '12"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 1, Inv: "5+" },
      abilities: [
        { name: "Warp Fracture", description: "The first time this unit arrives from Deep Strike, select one enemy unit within 9\". Until the end of the turn, that enemy unit cannot use Overwatch or Set to Defend." },
        { name: "Daemonic", description: "This unit has a 5+ invulnerable save." },
        { name: "Deep Strike", description: "This unit can be set up anywhere on the battlefield more than 9\" from all enemy units." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "wt-warp-talons", name: "Warp Talons", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0 },
        ],
      },
    },

    // ════════════════════════════════════════
    // VEHICLES / HEAVY SUPPORT
    // ════════════════════════════════════════
    {
      id: "csm-helbrute",
      name: "Helbrute",
      role: "VEHICLE",
      points: 145,
      keywords: ["VEHICLE", "WALKER", "CHAOS", "HELBRUTE", "CHAOS SPACE MARINES"],
      stats: { M: '8"', T: 9, Sv: "3+", W: 8, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Crazed", description: "Each time this model is selected to fight, roll 1D6. On a 1, this model suffers 1 mortal wound. On a 5+, add 1 to this model's Attacks this phase." },
        { name: "Enraged Desperation", description: "While this model has fewer than half its starting Wounds, add 2 to its Attacks characteristic." },
      ],
      weapons: {
        ranged: [
          { id: "hb-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0 },
          { id: "hb-twin-lascannon", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 10, exclusive: ["hb-multi-melta"] },
          { id: "hb-plasma-cannon", name: "Plasma Cannon", range: '36"', attacks: "D3", skill: "3+", strength: 8, AP: -3, damage: 2, special: "Blast, Hazardous", points: 10, exclusive: ["hb-multi-melta"] },
        ],
        melee: [
          { id: "hb-fist", name: "Helbrute Fist", attacks: 4, skill: "4+", strength: 12, AP: -3, damage: 3, special: "—", points: 0, exclusive: ["hb-hammer"] },
          { id: "hb-hammer", name: "Helbrute Power Scourge", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 5, exclusive: ["hb-fist"] },
        ],
      },
    },
    {
      id: "csm-predator-annihilator",
      name: "Chaos Predator Annihilator",
      role: "VEHICLE",
      points: 135,
      keywords: ["VEHICLE", "CHAOS", "PREDATOR ANNIHILATOR", "SMOKE", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Smoke", description: "Once per game, at the start of your Movement phase, this model can use Smoke Launchers. Until the start of your next turn, ranged weapons targeting this model suffer -1 to Hit rolls." },
        { name: "Grinding Advance", description: "Each time this model makes a ranged attack, if it did not move this turn, add 1 to the Hit roll." },
      ],
      weapons: {
        ranged: [
          { id: "pred-ann-twin-las", name: "Twin Lascannon (turret)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },
          { id: "pred-ann-hb-sponson", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },
          { id: "pred-ann-las-sponson", name: "Lascannon (sponson)", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["pred-ann-hb-sponson"], limit: 2 },
        ],
        melee: [
          { id: "pred-ann-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-predator-destructor",
      name: "Chaos Predator Destructor",
      role: "VEHICLE",
      points: 130,
      keywords: ["VEHICLE", "CHAOS", "PREDATOR DESTRUCTOR", "SMOKE", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Smoke", description: "Once per game, at the start of your Movement phase, use Smoke Launchers. Until the start of your next turn, ranged weapons targeting this model suffer -1 to Hit rolls." },
        { name: "Grinding Advance", description: "Each time this model makes a ranged attack, if it did not move this turn, add 1 to the Hit roll." },
      ],
      weapons: {
        ranged: [
          { id: "pred-des-autocannon", name: "Predator Autocannon (turret)", range: '48"', attacks: 4, skill: "3+", strength: 9, AP: -1, damage: 3, special: "Heavy", points: 0 },
          { id: "pred-des-hb-sponson", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },
          { id: "pred-des-las-sponson", name: "Lascannon (sponson)", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 20, exclusive: ["pred-des-hb-sponson"], limit: 2 },
        ],
        melee: [
          { id: "pred-des-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-chaos-land-raider",
      name: "Chaos Land Raider",
      role: "VEHICLE",
      points: 245,
      keywords: ["VEHICLE", "TRANSPORT", "CHAOS", "LAND RAIDER", "SMOKE", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 12, Sv: "2+", W: 16, Ld: "6+", OC: 5 },
      abilities: [
        { name: "Smoke", description: "Once per game, use Smoke Launchers. Until the start of your next turn, ranged weapons targeting this model suffer -1 to Hit rolls." },
        { name: "Power of the Machine Spirit", description: "Each time this model is selected to shoot, it can make ranged attacks even if it is within Engagement Range of enemy units." },
        { name: "Transport (12)", description: "This model can transport up to 12 HERETIC ASTARTES INFANTRY models (excluding JUMP PACK models)." },
      ],
      weapons: {
        ranged: [
          { id: "lr-twin-lascannon", name: "Twin Lascannon (sponson x2)", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },
          { id: "lr-twin-bolter", name: "Twin Heavy Bolter (hull)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1, Twin-linked", points: 0 },
        ],
        melee: [
          { id: "lr-tracks", name: "Armoured Tracks", attacks: 6, skill: "4+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-forgefiend",
      name: "Forgefiend",
      role: "VEHICLE",
      points: 185,
      keywords: ["VEHICLE", "WALKER", "DAEMON", "CHAOS", "FORGEFIEND", "CHAOS SPACE MARINES"],
      stats: { M: '9"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" },
      abilities: [
        { name: "Daemonic", description: "This model has a 5+ invulnerable save." },
        { name: "Infernal Relentlessness", description: "Each time this model makes a ranged attack, re-roll a Hit roll of 1 if the target is the closest eligible enemy unit." },
        { name: "Deadly Demise D3", description: "When this model is destroyed, roll 1D6 for each unit within 6\": on a 4+, that unit suffers D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "ff-ecto", name: "Ectoplasma Cannon (x2)", range: '36"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: "D3+1", special: "Blast, Rapid Fire 1, Hazardous", points: 0, exclusive: ["ff-hades"] },
          { id: "ff-hades", name: "Hades Autocannon (x2)", range: '36"', attacks: 6, skill: "4+", strength: 9, AP: -1, damage: 3, special: "Rapid Fire 3", points: 0, exclusive: ["ff-ecto"] },
          { id: "ff-ecto-head", name: "Ectoplasma Head", range: '18"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: 3, special: "Blast", points: 5, limit: 1 },
        ],
        melee: [
          { id: "ff-claws", name: "Daemonic Jaws", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "csm-maulerfiend",
      name: "Maulerfiend",
      role: "VEHICLE",
      points: 150,
      keywords: ["VEHICLE", "WALKER", "DAEMON", "CHAOS", "MAULERFIEND", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" },
      abilities: [
        { name: "Daemonic", description: "This model has a 5+ invulnerable save." },
        { name: "Scent of Blood", description: "+1 to charge rolls. If the target is below starting strength, +2 instead." },
        { name: "Deadly Demise D3", description: "When destroyed, roll 1D6 for each unit within 6\": on a 4+, D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "mf-lasher", name: "Lasher Tendrils", range: '6"', attacks: 4, skill: "Auto", strength: 6, AP: -1, damage: 1, special: "Torrent", points: 0 },
        ],
        melee: [
          { id: "mf-claws", name: "Power Scourges", attacks: 6, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["mf-magma"] },
          { id: "mf-magma", name: "Magma Cutters (pair)", attacks: 4, skill: "3+", strength: 10, AP: -4, damage: "D6", special: "Anti-VEHICLE 4+", points: 10, exclusive: ["mf-claws"] },
        ],
      },
    },
    {
      id: "csm-rhino",
      name: "Chaos Rhino",
      role: "DEDICATED TRANSPORT",
      points: 75,
      keywords: ["VEHICLE", "TRANSPORT", "DEDICATED TRANSPORT", "SMOKE", "CHAOS", "CHAOS SPACE MARINES"],
      stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Smoke", description: "Once per game, use Smoke Launchers. Until the start of your next turn, ranged weapons targeting this model suffer -1 to Hit rolls." },
        { name: "Self-repair", description: "At the start of your Command phase, this model regains 1 lost wound." },
        { name: "Transport (10)", description: "This model can transport 10 HERETIC ASTARTES INFANTRY models (not JUMP PACK or TERMINATOR)." },
      ],
      weapons: {
        ranged: [
          { id: "rh-combi-bolter", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
        ],
        melee: [
          { id: "rh-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
  ],
};

// ============================================================
// GAME DATA — WORLD EATERS (10th Edition)
// ============================================================
// Source: Codex: World Eaters (2025), Wahapedia 10th ed.
// All units carry the KHORNE keyword and are dedicated to the Blood God.
// No psykers, no sorcery, no subtlety. Only blood.

const WE_DATA = {
  id: "we",
  name: "World Eaters",
  shortName: "WE",
  color: "#8b1a00",
  accentColor: "#ff6030",
  tagline: "Blood for the Blood God!",
  icon: "🩸",

  // ── Army Rule ──
  armyRule: {
    name: "Blessings of Khorne",
    description: "At the start of each battle round, roll 8D6. Spend matching dice to activate up to 2 Blessings of Khorne until the end of the battle round. Blessings include: Rage-fuelled Invigoration (+2\" Move, any pair), Wrathful Onslaught (Lethal Hits melee, double 4+), Merciless Butchers (Sustained Hits 1 melee, double 5+), Savage Momentum (Pile In/Consolidate 6\", double 6+), Decapitating Strikes (Devastating Wounds vs Infantry, triple 3+), and Blood-mad Rampage (re-roll Charge rolls, triple 4+).",
  },

  // ── Detachments ──
  detachments: [
    {
      name: "Berzerker Warband",
      rule: "Relentless Rage: Each time a friendly WORLD EATERS unit makes a Pile In or Consolidate move, add 1\" to the distance. Also: Blood Tithe — each time an enemy model is destroyed by a WORLD EATERS melee attack, add 1 to your Blood Tithe points total.",
    },
    {
      name: "Cult of Blood",
      rule: "Frenzied Charge: Each time a WORLD EATERS unit makes a charge move, add D3\" to the Charge roll. Rush to the Fray: Friendly WORLD EATERS units within 6\" of an objective marker gain +1 to Charge rolls.",
    },
    {
      name: "Goretrack Onslaught",
      rule: "Unstoppable Advance: Friendly WORLD EATERS VEHICLE units can move through terrain features. Each time such a unit makes a Normal move, Advance, or charge move, it can move through any terrain feature that is not a building.",
    },
  ],

  // ── Enhancements ──
  enhancements: [
    { id: "we-e1", name: "Helm of Brazen Ire", points: 20, description: "Bearer has a 4+ invulnerable save. Each time this model is selected to fight, it can fight twice (but must target different units on the second fight)." },
    { id: "we-e2", name: "Berzerker Glaive", points: 15, description: "Bearer's melee weapons have the Devastating Wounds ability. Add 1 to the bearer's Attacks characteristic." },
    { id: "we-e3", name: "Favoured of Khorne", points: 25, description: "Once per battle, at the start of the Fight phase, add 3 to the Attacks of all melee weapons equipped by the bearer until end of phase." },
    { id: "we-e4", name: "Blood-forged Armour", points: 20, description: "Reduce all damage dealt to the bearer by 1 (minimum 1). Bearer also ignores the penalty for moving and shooting Heavy weapons." },
    { id: "we-e5", name: "Skull Helm of Khorne", points: 30, description: "While enemy units are within 6\" of bearer, subtract 2 from their Leadership characteristic. Enemy units that fail Battle-shock tests within 6\" of this model suffer D3 mortal wounds." },
  ],

  // ── Stratagems ──
  stratagems: [
    { id: "we-s1", name: "Skulls for the Skull Throne!", cost: "1 CP", phase: "Fight Phase", description: "Use when a WORLD EATERS unit is chosen to fight. Until the end of the phase, each time a model in that unit makes a melee attack, an unmodified Hit roll of 6 scores 1 additional hit." },
    { id: "we-s2", name: "Frenzied Resilience", cost: "2 CP", phase: "Any Phase", description: "Use when a WORLD EATERS INFANTRY unit would lose wounds. Until the end of the phase, models in that unit have a 5+ Feel No Pain." },
    { id: "we-s3", name: "Hack and Slash", cost: "1 CP", phase: "Fight Phase", description: "Use when a WORLD EATERS unit is chosen to fight. Until the end of the phase, each time a model in that unit makes a melee attack that destroys an enemy model, that model can immediately make 1 additional attack with the same weapon." },
    { id: "we-s4", name: "Blood Offering", cost: "1 CP", phase: "Command Phase", description: "Use at the start of your Command phase. Select one friendly WORLD EATERS unit that has destroyed at least one enemy model this battle. That unit regains D3 lost wounds and ignores Battle-shock until your next Command phase." },
    { id: "we-s5", name: "Daemontide", cost: "1 CP", phase: "Movement Phase", description: "Use in your Movement phase. Select one WORLD EATERS DAEMON unit. That unit can immediately make a Normal move of up to 6\" even though it is not your Movement phase." },
    { id: "we-s6", name: "A Worthy Skull", cost: "1 CP", phase: "Fight Phase", description: "Use when a WORLD EATERS CHARACTER is chosen to fight. Until the end of the phase, add 2 to the Attacks of melee weapons equipped by that model." },
  ],

  // World Eaters are ALL Khorne — no mark selection needed
  marks: [],

  // ── Unit Roster ──
  units: [
    // ════════════════════════════════════════
    // CHARACTERS
    // ════════════════════════════════════════
    {
      id: "we-angron",
      name: "Angron",
      role: "CHARACTER",
      points: 340,
      keywords: ["MONSTER", "CHARACTER", "FLY", "EPIC HERO", "CHAOS", "KHORNE", "DAEMON", "PRIMARCH", "ANGRON"],
      stats: { M: '14"', T: 11, Sv: "2+", W: 16, Ld: "5+", OC: 6, Inv: "4+" },
      abilities: [
        { name: "Supreme Commander", description: "Angron must be your WARLORD if included in your army." },
        { name: "The Blood God's Favour", description: "Each time you make a Blessings of Khorne roll, if Angron is on the battlefield, you can re-roll up to six of the D6 rolled." },
        { name: "Overwhelming Wrath (Aura)", description: "Each time an enemy unit within 6\" is selected to Fall Back, that unit must take a Leadership test. If failed, that unit must Remain Stationary instead." },
        { name: "Driven by Ultimate Rage (Aura)", description: "While a friendly WORLD EATERS unit is within 6\" of Angron, ignore modifiers to Move, Advance, Charge, and Weapon Skill for that unit." },
        { name: "Reborn in Blood", description: "If Angron is destroyed, you may spend a triple 6 from your Blessings roll to resurrect him with 8 wounds remaining anywhere on the battlefield using Deep Strike." },
        { name: "Deadly Demise D6", description: "When destroyed, roll 1D6 for each unit within 6\": on a 4+, that unit suffers D6 mortal wounds." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "ang-strike", name: "Samni'arius and Spinegrinder – strike", attacks: 8, skill: "2+", strength: 14, AP: -3, damage: "D6+2", special: "Devastating Wounds", points: 0, exclusive: ["ang-sweep"] },
          { id: "ang-sweep", name: "Samni'arius and Spinegrinder – sweep", attacks: 16, skill: "2+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0, exclusive: ["ang-strike"] },
        ],
      },
    },
    {
      id: "we-kharn",
      name: "Khârn the Betrayer",
      role: "CHARACTER",
      points: 85,
      keywords: ["CHARACTER", "INFANTRY", "EPIC HERO", "CHAOS", "KHORNE", "KHARN THE BETRAYER"],
      stats: { M: '8"', T: 4, Sv: "3+", W: 5, Ld: "5+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "The Betrayer", description: "Each time this model is selected to fight, after it has fought, roll 1D6. On a 1, this model must fight again — but must target a friendly unit if possible." },
        { name: "Slaughter Incarnate", description: "Each time this model makes a melee attack, add 1 to the Hit roll. Unmodified Hit rolls of 6 score 1 additional hit." },
        { name: "Direct the Slaughter", description: "Once per battle round, reduce the CP cost of a Stratagem used on a WORLD EATERS unit within 12\" by 1." },
      ],
      weapons: {
        ranged: [
          { id: "kh-plasma", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 0 },
        ],
        melee: [
          { id: "kh-gorechild", name: "Gorechild", attacks: 8, skill: "2+", strength: 6, AP: -2, damage: 2, special: "Anti-INFANTRY 4+, Sustained Hits 1", points: 0 },
        ],
      },
    },
    {
      id: "we-lord-juggernaut",
      name: "Lord on Juggernaut",
      role: "CHARACTER",
      points: 135,
      keywords: ["CHARACTER", "MOUNTED", "CHAOS", "KHORNE", "LORD ON JUGGERNAUT"],
      stats: { M: '10"', T: 6, Sv: "3+", W: 7, Ld: "6+", OC: 2, Inv: "4+" },
      abilities: [
        { name: "Direct the Slaughter", description: "Once per battle round, reduce the CP cost of a Stratagem used on a WORLD EATERS unit within 12\" by 1." },
        { name: "Devastating Assault", description: "Each time this model makes a Charge move, until end of turn its melee weapons gain Devastating Wounds." },
        { name: "Lord of Murder", description: "While within 3\" of WORLD EATERS INFANTRY units, this model has Lone Operative." },
      ],
      weapons: {
        ranged: [
          { id: "lj-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
          { id: "lj-plasma", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["lj-bolt-pistol"] },
        ],
        melee: [
          { id: "lj-axe", name: "Axe of Khorne", attacks: 6, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Anti-INFANTRY 4+", points: 0, exclusive: ["lj-fist"] },
          { id: "lj-fist", name: "Power Fist", attacks: 5, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["lj-axe"] },
          { id: "lj-juggernaut", name: "Juggernaut Bladed Horn", attacks: 3, skill: "3+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "we-lord-invocatus",
      name: "Lord Invocatus",
      role: "CHARACTER",
      points: 155,
      keywords: ["CHARACTER", "MOUNTED", "EPIC HERO", "CHAOS", "KHORNE", "LORD INVOCATUS"],
      stats: { M: '14"', T: 6, Sv: "3+", W: 7, Ld: "6+", OC: 2, Inv: "4+" },
      abilities: [
        { name: "On Wings of Blood", description: "Lord Invocatus is mounted on a Chaos Bike. He can move over other models and terrain features as if they were not there." },
        { name: "Direct the Slaughter", description: "Once per battle round, reduce the CP cost of a Stratagem used on a WORLD EATERS unit within 12\" by 1." },
        { name: "Filled with Fury", description: "Each time Lord Invocatus makes a Charge move, select one enemy unit he moved within 1\" of. That enemy unit suffers D3+1 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "li-plasma", name: "Twin Plasma Pistols", range: '12"', attacks: 2, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 0 },
        ],
        melee: [
          { id: "li-krak", name: "Krak'arth", attacks: 7, skill: "2+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0 },
          { id: "li-juggernaut", name: "Juggernaut Bladed Horn", attacks: 4, skill: "3+", strength: 8, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "we-master-executions",
      name: "Master of Executions",
      role: "CHARACTER",
      points: 80,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS", "KHORNE", "MASTER OF EXECUTIONS"],
      stats: { M: '8"', T: 4, Sv: "3+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Cruel Hunter", description: "While leading a unit, each time that unit Piles In or Consolidates, each model can move up to 6\"." },
        { name: "Decapitating Strike", description: "Each unmodified Hit roll of 6 causes 2 additional mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "weme-bolt", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
        ],
        melee: [
          { id: "weme-axe", name: "Axe of Dismemberment", attacks: 5, skill: "3+", strength: 8, AP: -3, damage: 2, special: "Devastating Wounds", points: 0 },
        ],
      },
    },
    {
      id: "we-daemon-prince",
      name: "Daemon Prince of Khorne",
      role: "CHARACTER",
      points: 200,
      keywords: ["CHARACTER", "MONSTER", "CHAOS", "KHORNE", "DAEMON", "DAEMON PRINCE"],
      stats: { M: '10"', T: 10, Sv: "2+", W: 10, Ld: "6+", OC: 3, Inv: "4+" },
      abilities: [
        { name: "Lord of Murder", description: "While within 3\" of WORLD EATERS INFANTRY, this model has Lone Operative." },
        { name: "Devastating Assault", description: "Each time this model makes a Charge move, until end of turn its melee weapons gain Devastating Wounds." },
        { name: "Direct the Slaughter", description: "Once per battle round, reduce CP cost of a Stratagem for a WORLD EATERS unit within 12\" by 1." },
        { name: "Deadly Demise D3", description: "When destroyed, roll 1D6 for each unit within 6\": on a 4+, D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "wedp-cannon", name: "Infernal Cannon", range: '24"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Rapid Fire 1", points: 0 },
        ],
        melee: [
          { id: "wedp-strike", name: "Hellforged Weapons – strike", attacks: 8, skill: "2+", strength: 8, AP: -2, damage: 3, special: "—", points: 0, exclusive: ["wedp-sweep"] },
          { id: "wedp-sweep", name: "Hellforged Weapons – sweep", attacks: 16, skill: "2+", strength: 6, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["wedp-strike"] },
        ],
      },
    },
    {
      id: "we-slaughterbound",
      name: "Slaughterbound",
      role: "CHARACTER",
      points: 100,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS", "KHORNE", "SLAUGHTERBOUND"],
      stats: { M: '8"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 1, Inv: "5+" },
      abilities: [
        { name: "Bloodbound Champion", description: "While this model is leading a unit, each time a model in that unit makes a melee attack, re-roll Hit rolls of 1." },
        { name: "Skull Taker", description: "Each time this model destroys an enemy CHARACTER with a melee attack, this model regains D3 lost wounds." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "sb-lacerator", name: "Lacerator and Daemonic Claw", attacks: 6, skill: "3+", strength: 6, AP: -2, damage: 2, special: "Twin-linked", points: 0 },
        ],
      },
    },

    // ════════════════════════════════════════
    // BATTLELINE
    // ════════════════════════════════════════
    {
      id: "we-berzerkers",
      name: "Khorne Berzerkers",
      role: "BATTLELINE",
      points: 180,
      baseSize: 10,
      keywords: ["INFANTRY", "CORE", "CHAOS", "KHORNE", "KHORNE BERZERKERS"],
      stats: { M: '8"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Bane of Cowards", description: "Each time an enemy unit (excluding MONSTERS and VEHICLES) within Engagement Range Falls Back, models in that enemy unit must take Desperate Escape tests." },
        { name: "Chainaxe Frenzy", description: "Add 1 to the Attacks characteristic of melee weapons equipped by models in this unit if they made a charge move this turn." },
      ],
      weapons: {
        ranged: [
          { id: "bzk-bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0 },
          { id: "bzk-plasma", name: "Plasma Pistol (Champion)", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["bzk-bolt-pistol"], limit: 1 },
        ],
        melee: [
          { id: "bzk-chainblade", name: "Chainblade", attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "bzk-eviscerator", name: "Khornate Eviscerator (x2)", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "Devastating Wounds", points: 5, limit: 2 },
          { id: "bzk-icon", name: "Icon of Khorne", attacks: 2, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Bearer re-rolls Charge rolls", points: 0, limit: 1 },
        ],
      },
    },
    {
      id: "we-jakhals",
      name: "Jakhals",
      role: "BATTLELINE",
      points: 70,
      baseSize: 10,
      keywords: ["INFANTRY", "CORE", "CHAOS", "KHORNE", "JAKHALS"],
      stats: { M: '8"', T: 4, Sv: "5+", W: 1, Ld: "7+", OC: 2 },
      abilities: [
        { name: "Khorne's Hounds", description: "Each time this unit is selected to fight, if it made a charge move this turn, add 1 to Hit rolls for attacks made by models in this unit." },
        { name: "Frenzied Pack", description: "Each time this unit is destroyed, roll 1D6. On a 4+, you can set it back up with its full model count anywhere more than 9\" from all enemy units." },
      ],
      weapons: {
        ranged: [
          { id: "jak-pistol", name: "Autopistol", range: '12"', attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Pistol", points: 0 },
        ],
        melee: [
          { id: "jak-blades", name: "Jakhal Blades", attacks: 2, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "jak-mancleaver", name: "Mancleaver (Pack Leader)", attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "—", points: 0, limit: 1 },
          { id: "jak-icon", name: "Icon of Khorne", attacks: 1, skill: "4+", strength: 3, AP: 0, damage: 1, special: "Bearer re-rolls Charge rolls", points: 0, limit: 1 },
        ],
      },
    },

    // ════════════════════════════════════════
    // ELITE / OTHER
    // ════════════════════════════════════════
    {
      id: "we-eightbound",
      name: "Eightbound",
      role: "ELITE",
      points: 140,
      baseSize: 3,
      keywords: ["INFANTRY", "CHAOS", "KHORNE", "DAEMON", "EIGHTBOUND"],
      stats: { M: '8"', T: 5, Sv: "3+", W: 4, Ld: "6+", OC: 2, Inv: "4+" },
      abilities: [
        { name: "Bound by Eight", description: "Each time a model in this unit would lose a wound, roll 1D6. On a 4+, that wound is not lost." },
        { name: "Eightbound Rage", description: "Add 1 to the Attacks characteristic of melee weapons equipped by models in this unit." },
        { name: "Daemonic Resilience", description: "This unit has a 4+ invulnerable save." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "eb-twinclaws", name: "Eightbound Eviscerators", attacks: 5, skill: "3+", strength: 7, AP: -2, damage: 2, special: "Devastating Wounds", points: 0 },
        ],
      },
    },
    {
      id: "we-exalted-eightbound",
      name: "Exalted Eightbound",
      role: "ELITE",
      points: 180,
      baseSize: 3,
      keywords: ["INFANTRY", "CHAOS", "KHORNE", "DAEMON", "EXALTED EIGHTBOUND"],
      stats: { M: '8"', T: 5, Sv: "3+", W: 5, Ld: "6+", OC: 2, Inv: "4+" },
      abilities: [
        { name: "Exalted Fury", description: "Each time a model in this unit makes a melee attack, an unmodified Hit roll of 6 scores 1 additional hit." },
        { name: "Bound by Eight", description: "Each time a model in this unit would lose a wound, roll 1D6. On a 4+, that wound is not lost." },
        { name: "Daemonic Resilience", description: "This unit has a 4+ invulnerable save." },
      ],
      weapons: {
        ranged: [],
        melee: [
          { id: "xeb-claws-strike", name: "Exalted Eviscerators – strike", attacks: 4, skill: "2+", strength: 9, AP: -3, damage: 3, special: "Devastating Wounds", points: 0, exclusive: ["xeb-claws-sweep"] },
          { id: "xeb-claws-sweep", name: "Exalted Eviscerators – sweep", attacks: 8, skill: "2+", strength: 6, AP: -2, damage: 1, special: "—", points: 0, exclusive: ["xeb-claws-strike"] },
        ],
      },
    },
    {
      id: "we-terminators",
      name: "World Eaters Chaos Terminators",
      role: "ELITE",
      points: 190,
      baseSize: 5,
      keywords: ["INFANTRY", "TERMINATOR", "CHAOS", "KHORNE", "CHAOS TERMINATORS"],
      stats: { M: '7"', T: 5, Sv: "2+", W: 3, Ld: "6+", OC: 1, Inv: "4+" },
      abilities: [
        { name: "Deep Strike", description: "This unit can be set up anywhere on the battlefield more than 9\" from all enemy units." },
        { name: "Terminator Resilience", description: "Each time an attack is allocated to a model in this unit, subtract 1 from the Damage characteristic (minimum 1)." },
        { name: "Bloodthirsty Rampage", description: "Add 1 to the Attacks characteristic of melee weapons when this unit makes a charge move." },
      ],
      weapons: {
        ranged: [
          { id: "wet-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "wet-combi-melta", name: "Combi-melta", range: '24"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2, Rapid Fire 1", points: 10, exclusive: ["wet-combi"], limit: 2 },
        ],
        melee: [
          { id: "wet-chainfist", name: "Chainfist", attacks: 3, skill: "4+", strength: 8, AP: -4, damage: 2, special: "Anti-VEHICLE 4+", points: 0, exclusive: ["wet-lightning-claws", "wet-power-fist"] },
          { id: "wet-lightning-claws", name: "Lightning Claws (pair)", attacks: 4, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-linked", points: 0, exclusive: ["wet-chainfist", "wet-power-fist"] },
          { id: "wet-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["wet-chainfist", "wet-lightning-claws"] },
        ],
      },
    },

    // ════════════════════════════════════════
    // VEHICLES / HEAVY SUPPORT
    // ════════════════════════════════════════
    {
      id: "we-helbrute",
      name: "World Eaters Helbrute",
      role: "VEHICLE",
      points: 150,
      keywords: ["VEHICLE", "WALKER", "CHAOS", "KHORNE", "HELBRUTE"],
      stats: { M: '9"', T: 9, Sv: "3+", W: 8, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Crazed", description: "Each time this model is selected to fight, roll 1D6. On a 5+, add 1 to Attacks this phase." },
        { name: "Khorne's Fury", description: "Each time this model makes a charge move, until end of turn, melee weapons gain Devastating Wounds." },
      ],
      weapons: {
        ranged: [
          { id: "wehb-multi-melta", name: "Multi-melta", range: '18"', attacks: 2, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 0, exclusive: ["wehb-twin-las"] },
          { id: "wehb-twin-las", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 10, exclusive: ["wehb-multi-melta"] },
        ],
        melee: [
          { id: "wehb-fist", name: "Helbrute Fist", attacks: 5, skill: "4+", strength: 12, AP: -3, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "we-forgefiend",
      name: "World Eaters Forgefiend",
      role: "VEHICLE",
      points: 190,
      keywords: ["VEHICLE", "WALKER", "DAEMON", "CHAOS", "KHORNE", "FORGEFIEND"],
      stats: { M: '9"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" },
      abilities: [
        { name: "Daemonic", description: "5+ invulnerable save." },
        { name: "Infernal Relentlessness", description: "Re-roll Hit rolls of 1 against the closest eligible enemy unit." },
        { name: "Deadly Demise D3", description: "When destroyed, roll D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "weff-hades", name: "Hades Autocannon (x2)", range: '36"', attacks: 6, skill: "4+", strength: 9, AP: -1, damage: 3, special: "Rapid Fire 3", points: 0, exclusive: ["weff-ecto"] },
          { id: "weff-ecto", name: "Ectoplasma Cannon (x2)", range: '36"', attacks: "D3", skill: "4+", strength: 8, AP: -3, damage: "D3+1", special: "Blast, Rapid Fire 1, Hazardous", points: 0, exclusive: ["weff-hades"] },
        ],
        melee: [
          { id: "weff-claws", name: "Daemonic Jaws", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "we-maulerfiend",
      name: "World Eaters Maulerfiend",
      role: "VEHICLE",
      points: 150,
      keywords: ["VEHICLE", "WALKER", "DAEMON", "CHAOS", "KHORNE", "MAULERFIEND"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 12, Ld: "6+", OC: 3, Inv: "5+" },
      abilities: [
        { name: "Daemonic", description: "5+ invulnerable save." },
        { name: "Savage Exaltation", description: "+1 to Hit and Wound rolls against targets below starting strength." },
        { name: "Scent of Blood", description: "+1 to charge rolls (+2 if target is below half strength)." },
        { name: "Deadly Demise D3", description: "When destroyed, D6 for each unit within 6\": 4+ = D3 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "wemf-lasher", name: "Lasher Tendrils", range: '6"', attacks: 4, skill: "Auto", strength: 6, AP: -1, damage: 1, special: "Torrent", points: 0 },
        ],
        melee: [
          { id: "wemf-scourges", name: "Power Scourges", attacks: 7, skill: "3+", strength: 8, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["wemf-magma"] },
          { id: "wemf-magma", name: "Magma Cutters (pair)", attacks: 5, skill: "3+", strength: 10, AP: -4, damage: "D6", special: "Anti-VEHICLE 4+", points: 10, exclusive: ["wemf-scourges"] },
        ],
      },
    },
    {
      id: "we-lord-of-skulls",
      name: "Khorne Lord of Skulls",
      role: "VEHICLE",
      points: 480,
      keywords: ["VEHICLE", "TITANIC", "WALKER", "DAEMON", "CHAOS", "KHORNE", "LORD OF SKULLS"],
      stats: { M: '10"', T: 16, Sv: "2+", W: 26, Ld: "6+", OC: 8, Inv: "4+" },
      abilities: [
        { name: "Towering", description: "This model can be seen and can target units even over terrain features. Cannot benefit from cover." },
        { name: "Skull Cannon Barrage", description: "Each time this model shoots, if it has not moved this turn, add 1 to its ranged Hit rolls." },
        { name: "Daemonic", description: "4+ invulnerable save." },
        { name: "Deadly Demise D6", description: "When destroyed, D6 for each unit within 6\": 4+ = D6 mortal wounds." },
      ],
      weapons: {
        ranged: [
          { id: "los-cannon", name: "Skull Cannon", range: '60"', attacks: 4, skill: "3+", strength: 14, AP: -3, damage: "D6+2", special: "Heavy, Devastating Wounds", points: 0 },
          { id: "los-hades", name: "Hades Gatling Cannon", range: '36"', attacks: 12, skill: "3+", strength: 8, AP: -2, damage: 2, special: "Rapid Fire 6", points: 0 },
        ],
        melee: [
          { id: "los-axe-strike", name: "Titanic Axe – strike", attacks: 6, skill: "3+", strength: 20, AP: -4, damage: "D6+4", special: "Devastating Wounds", points: 0, exclusive: ["los-axe-sweep"] },
          { id: "los-axe-sweep", name: "Titanic Axe – sweep", attacks: 12, skill: "3+", strength: 12, AP: -2, damage: 2, special: "—", points: 0, exclusive: ["los-axe-strike"] },
        ],
      },
    },
    {
      id: "we-predator-annihilator",
      name: "World Eaters Predator Annihilator",
      role: "VEHICLE",
      points: 135,
      keywords: ["VEHICLE", "CHAOS", "KHORNE", "PREDATOR ANNIHILATOR", "SMOKE"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Smoke", description: "Once per game, use Smoke Launchers. Until the start of your next turn, ranged weapons targeting this model suffer -1 to Hit rolls." },
        { name: "Meet Any Challenge", description: "Any time an opponent ends a Normal, Advance or Fall Back move within 9\" of this model, you can immediately disembark any units inside." },
      ],
      weapons: {
        ranged: [
          { id: "wepa-twin-las", name: "Twin Lascannon (turret)", range: '48"', attacks: 2, skill: "4+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked, Rapid Fire 2", points: 0 },
          { id: "wepa-hb-sponson", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },
        ],
        melee: [
          { id: "wepa-tracks", name: "Armoured Tracks", attacks: 4, skill: "4+", strength: 7, AP: -1, damage: 2, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "we-rhino",
      name: "World Eaters Chaos Rhino",
      role: "DEDICATED TRANSPORT",
      points: 75,
      keywords: ["VEHICLE", "TRANSPORT", "DEDICATED TRANSPORT", "SMOKE", "CHAOS", "KHORNE", "RHINO"],
      stats: { M: '12"', T: 9, Sv: "3+", W: 10, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Smoke", description: "Once per game, use Smoke Launchers. Until start of next turn, -1 to Hit rolls against this model." },
        { name: "Meet Any Challenge", description: "Any time an opponent ends a move within 9\" of this Rhino, you can immediately disembark any units inside." },
        { name: "Transport (12)", description: "This model can transport 12 WORLD EATERS INFANTRY models (not POSSESSED or TERMINATOR)." },
      ],
      weapons: {
        ranged: [
          { id: "werh-combi", name: "Combi-bolter", range: '24"', attacks: 2, skill: "4+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
        ],
        melee: [
          { id: "werh-tracks", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 7, AP: -1, damage: 1, special: "—", points: 0 },
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
const FACTIONS = {
  csm: CSM_DATA,
  we: WE_DATA,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Computes the set of weapon IDs that should be locked/unavailable for selection.
// Iterates over all currently selected weapons, looks up each weapon's `exclusive`
// list, and collects every ID that is mutually incompatible with the current selection.
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

// Builds a plain serialisable snapshot of the current army state for saving.
// Only mutable per-instance fields are stored; static data is re-hydrated on load.
function buildArmySnapshot(factionId, armyName, pointsLimit, units) {
  return {
    id: Date.now().toString(),
    savedAt: new Date().toLocaleString(),
    factionId,
    armyName,
    pointsLimit,
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

// Re-hydrates a saved army snapshot back into full unit instances by looking up
// static data from the appropriate faction's unit roster via unitId.
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

// Renders a single characteristic badge (e.g. M, T, Sv, W, Inv) for a unit's stat block.
// Uses flex:1 to share available width evenly across all badges on mobile.
function StatBadge({ label, value, accentColor = "#e0c070" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "rgba(180,20,20,0.15)", border: "1px solid #8b0000",
      padding: "6px 8px", flex: "1 0 auto", minWidth: 42,
    }}>
      <span style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: accentColor, fontFamily: "var(--font-display)" }}>{value}</span>
    </div>
  );
}

// Renders a single selectable weapon row inside a unit's loadout panel.
// Minimum 52px touch target height for comfortable mobile tapping.
// WebkitTapHighlightColor removes the grey flash on iOS.
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
      <div style={{
        width: 22, height: 22, borderRadius: 2,
        border: `2px solid ${selected ? "#cc2020" : "#555"}`,
        background: selected ? "#cc2020" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {selected && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: disabled ? "#555" : selected ? accentColor : "#ccc", fontSize: 14, fontWeight: 600 }}>{weapon.name}</div>
        <div style={{ color: "#777", fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
          {weapon.range && `${weapon.range} · `}A{weapon.attacks} · S{weapon.strength} · AP{weapon.AP} · D{weapon.damage}
          {weapon.special && weapon.special !== "—" && ` · ${weapon.special}`}
        </div>
      </div>
      {weapon.points > 0 && (
        <div style={{ color: accentColor, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>+{weapon.points} pts</div>
      )}
    </div>
  );
}

// ============================================================
// ARMY LIST MANAGER
// ============================================================

// Full-screen overlay showing all saved army lists with load, rename, and delete actions.
// Props: savedLists, currentId, onLoad, onDelete, onRename, onNew, onClose
function ArmyListManager({ savedLists, currentId, onLoad, onDelete, onRename, onNew, onClose }) {
  // renamingId: which list (if any) is currently in rename edit mode
  const [renamingId, setRenamingId] = useState(null);
  // renameValue: the live text in the rename input field
  const [renameValue, setRenameValue] = useState("");
  // confirmDeleteId: which list is pending a delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Opens the inline rename input for a given list, pre-filled with current name.
  function startRename(list) {
    setRenamingId(list.id);
    setRenameValue(list.armyName);
  }

  // Validates input, commits the rename, and closes the rename input.
  function commitRename(id) {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  }

  const btnStyle = (bg = "#8b0000") => ({
    background: bg, border: "none", color: "#e0c070",
    padding: "10px 14px", cursor: "pointer", fontFamily: "var(--font-body)",
    fontSize: 14, WebkitTapHighlightColor: "transparent", flexShrink: 0,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0a0000", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>My Army Lists</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, lineHeight: 1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {savedLists.length === 0 && (
          <div style={{ color: "#444", fontStyle: "italic", fontSize: 14, textAlign: "center", padding: "40px 20px" }}>
            No saved lists yet. Build an army and hit Save!
          </div>
        )}
        {savedLists.map((list) => {
          const total = list.units.reduce((s, u) => s + (u.totalPoints || 0), 0);
          const isActive = list.id === currentId;
          const faction = FACTIONS[list.factionId] || CSM_DATA;
          return (
            <div key={list.id} style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${isActive ? "#cc2020" : "#2a2a2a"}`, padding: "12px 14px" }}>
              {/* Rename input */}
              {renamingId === list.id ? (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commitRename(list.id)}
                    autoFocus
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid #8b0000", color: "#e0c070", padding: "8px 10px", fontSize: 14, fontFamily: "var(--font-display)", outline: "none" }}
                  />
                  <button onClick={() => commitRename(list.id)} style={btnStyle()}>✓</button>
                  <button onClick={() => setRenamingId(null)} style={btnStyle("#333")}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    {/* Faction badge */}
                    <span style={{ fontSize: 10, background: faction.color, color: "#fff", padding: "2px 6px", marginRight: 6, fontWeight: 700, textTransform: "uppercase" }}>{faction.shortName}</span>
                    <span style={{ color: isActive ? "#e0c070" : "#ddd", fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{list.armyName}</span>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>Saved {list.savedAt}</div>
                  </div>
                  <div style={{ color: "#e0c070", fontFamily: "var(--font-display)", fontSize: 14, flexShrink: 0, marginLeft: 10 }}>{total}/{list.pointsLimit} pts</div>
                </div>
              )}
              <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
                {list.units.length} unit{list.units.length !== 1 ? "s" : ""}
              </div>
              {/* Delete confirmation */}
              {confirmDeleteId === list.id ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: "#c07070", fontSize: 13, flex: 1 }}>Delete this list?</span>
                  <button onClick={() => { onDelete(list.id); setConfirmDeleteId(null); }} style={btnStyle("#5a0000")}>Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={btnStyle("#333")}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => { onLoad(list); onClose(); }} style={{ ...btnStyle(), flex: 1 }}>
                    {isActive ? "✓ Loaded" : "Load"}
                  </button>
                  <button onClick={() => startRename(list)} style={{ ...btnStyle("#2a2a2a"), color: "#aaa" }}>Rename</button>
                  <button onClick={() => setConfirmDeleteId(list.id)} style={{ ...btnStyle("#3a0000"), color: "#c07070" }}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New army button */}
      <div style={{ padding: 14, borderTop: "1px solid #2a0000" }}>
        <button onClick={() => { onNew(); onClose(); }} style={{ width: "100%", background: "rgba(139,0,0,0.2)", border: "1px solid #8b0000", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>
          + New Army
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ARMY BUILDER
// ============================================================

// Main army construction interface. Owns the full army state including faction selection,
// unit instances, points tracking, save/load lifecycle, and narrative mode fields.
// On mobile, Add Unit and My Lists use full-screen overlays.
function ArmyBuilder({ narrativeMode }) {
  // ── Core army state ──
  const [factionId, setFactionId] = useState("csm");     // currently selected faction
  const [armyName, setArmyName] = useState("Legion of the Damned");
  const [pointsLimit, setPointsLimit] = useState(2000);
  const [units, setUnits] = useState([]);
  const [expandedUnit, setExpandedUnit] = useState(null);

  // ── UI state ──
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showListManager, setShowListManager] = useState(false);
  const [showFactionPicker, setShowFactionPicker] = useState(false);

  // ── Save state ──
  const [savedLists, setSavedLists] = useState(() => loadListsFromStorage());
  const [currentListId, setCurrentListId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");

  const isMobile = useIsMobile();

  // Derived: the full data object for the currently selected faction
  const factionData = FACTIONS[factionId] || CSM_DATA;

  // Derived: running points total across all unit instances
  const totalPoints = units.reduce((sum, u) => sum + u.totalPoints, 0);

  // Shared input style for form fields
  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #555",
    color: "#e0c070", padding: "10px 12px", fontSize: 15,
    fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none",
  };

  // ── Save / Load / Manage ──

  // Serialises current army state and persists to localStorage.
  // Overwrites existing record if currentListId is set, otherwise appends a new entry.
  function saveArmy() {
    const snapshot = buildArmySnapshot(factionId, armyName, pointsLimit, units);
    if (currentListId) snapshot.id = currentListId;
    const existing = loadListsFromStorage();
    const idx = existing.findIndex((l) => l.id === snapshot.id);
    const updated = idx >= 0
      ? existing.map((l) => (l.id === snapshot.id ? snapshot : l))
      : [...existing, snapshot];
    saveListsToStorage(updated);
    setSavedLists(updated);
    setCurrentListId(snapshot.id);
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
    // FIREBASE: if (auth.currentUser) { setDoc(doc(db, "users", auth.currentUser.uid, "armies", snapshot.id), snapshot); }
  }

  // Hydrates a saved snapshot into the builder, replacing all current army state.
  function loadArmy(snapshot) {
    const { factionId: fid, armyName: name, pointsLimit: limit, units: loadedUnits } = hydrateArmySnapshot(snapshot);
    setFactionId(fid);
    setArmyName(name);
    setPointsLimit(limit);
    setUnits(loadedUnits);
    setCurrentListId(snapshot.id);
    setExpandedUnit(null);
    setSaveStatus("Loaded!");
    setTimeout(() => setSaveStatus(""), 2000);
  }

  // Removes a list from storage by ID. Clears currentListId if the deleted list was loaded.
  function deleteList(id) {
    const updated = savedLists.filter((l) => l.id !== id);
    saveListsToStorage(updated);
    setSavedLists(updated);
    if (currentListId === id) setCurrentListId(null);
  }

  // Renames a saved list in storage and syncs the builder header if the active list was renamed.
  function renameList(id, newName) {
    const updated = savedLists.map((l) => l.id === id ? { ...l, armyName: newName } : l);
    saveListsToStorage(updated);
    setSavedLists(updated);
    if (id === currentListId) setArmyName(newName);
  }

  // Resets the builder to a blank slate without touching saved lists.
  function newArmy() {
    setArmyName("New Legion");
    setPointsLimit(2000);
    setUnits([]);
    setExpandedUnit(null);
    setCurrentListId(null);
    setSaveStatus("");
  }

  // Changes the faction and clears all units (different factions have different unit pools).
  function changeFaction(newFactionId) {
    setFactionId(newFactionId);
    setUnits([]);
    setExpandedUnit(null);
    setCurrentListId(null);
    const f = FACTIONS[newFactionId];
    setArmyName(`New ${f.shortName} Army`);
    setShowFactionPicker(false);
  }

  // ── Unit management ──

  // Creates a new unit instance from selected unit data and appends it to the army.
  function addUnit(unitData) {
    const newUnit = {
      instanceId: Date.now() + Math.random(),
      unitId: unitData.id,
      name: unitData.name,
      unitData,
      selectedRanged: [],
      selectedMelee: [],
      selectedMark: "undivided",
      selectedEnhancement: null,
      totalPoints: unitData.points,
      narrativeName: "",
      battleHonours: [],
      battleScars: [],
      experience: 0,
      notes: "",
    };
    setUnits((prev) => [...prev, newUnit]);
    setExpandedUnit(newUnit.instanceId);
    setShowAddPanel(false);
  }

  // Removes a unit instance by instanceId and clears expanded state if needed.
  function removeUnit(instanceId) {
    setUnits((prev) => prev.filter((u) => u.instanceId !== instanceId));
    if (expandedUnit === instanceId) setExpandedUnit(null);
  }

  // Merges partial changes into a unit instance and recalculates totalPoints.
  function updateUnit(instanceId, changes) {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.instanceId !== instanceId) return u;
        const updated = { ...u, ...changes };
        let pts = updated.unitData.points;
        const allWeapons = [
          ...(updated.unitData.weapons?.ranged || []),
          ...(updated.unitData.weapons?.melee || []),
        ];
        [...updated.selectedRanged, ...updated.selectedMelee].forEach((wId) => {
          const w = allWeapons.find((x) => x.id === wId);
          if (w) pts += w.points || 0;
        });
        if (updated.selectedEnhancement) {
          const enh = factionData.enhancements.find((e) => e.id === updated.selectedEnhancement);
          if (enh) pts += enh.points;
        }
        updated.totalPoints = pts;
        return updated;
      })
    );
  }

  // Toggles a weapon on/off for a unit instance, routing to ranged or melee list by type.
  function toggleWeapon(instanceId, weaponId, type) {
    const unit = units.find((u) => u.instanceId === instanceId);
    if (!unit) return;
    const key = type === "ranged" ? "selectedRanged" : "selectedMelee";
    const current = unit[key];
    updateUnit(instanceId, {
      [key]: current.includes(weaponId)
        ? current.filter((id) => id !== weaponId)
        : [...current, weaponId],
    });
  }

  const accent = factionData.accentColor;
  const factionColor = factionData.color;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>

      {/* Overlays */}
      {showListManager && (
        <ArmyListManager savedLists={savedLists} currentId={currentListId} onLoad={loadArmy} onDelete={deleteList} onRename={renameList} onNew={newArmy} onClose={() => setShowListManager(false)} />
      )}

      {/* Faction picker overlay */}
      {showFactionPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Choose Faction</span>
            <button onClick={() => setShowFactionPicker(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.values(FACTIONS).map((f) => (
              <button
                key={f.id}
                onClick={() => changeFaction(f.id)}
                style={{
                  background: factionId === f.id ? `${f.color}44` : "rgba(255,255,255,0.03)",
                  border: `2px solid ${factionId === f.id ? f.color : "#333"}`,
                  color: "#ccc", padding: "18px 16px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 16,
                  textAlign: "left", WebkitTapHighlightColor: "transparent",
                }}
              >
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

      {/* Sticky header bar */}
      <div style={{ background: "rgba(10,0,0,0.95)", border: `1px solid ${factionColor}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10 }}>
        {/* Faction selector button */}
        <button
          onClick={() => setShowFactionPicker(true)}
          style={{ background: `${factionColor}33`, border: `1px solid ${factionColor}`, color: accent, padding: "8px 12px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
        >
          {factionData.icon} {factionData.shortName}
        </button>

        {/* Army name input */}
        <input value={armyName} onChange={(e) => setArmyName(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px", minWidth: 0, fontSize: 14, padding: "8px 10px", fontFamily: "var(--font-display)" }} />

        {/* Points limit */}
        <select value={pointsLimit} onChange={(e) => setPointsLimit(Number(e.target.value))} style={{ background: "#1a0000", border: "1px solid #555", color: "#ccc", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-body)", WebkitAppearance: "none", flexShrink: 0 }}>
          {[500, 1000, 1500, 2000, 2500, 3000].map((p) => <option key={p} value={p}>{p} pts</option>)}
        </select>

        {/* Points counter */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: totalPoints > pointsLimit ? "#ff4444" : accent, fontFamily: "var(--font-display)", lineHeight: 1 }}>
            {totalPoints}<span style={{ color: "#444", fontWeight: 400 }}>/{pointsLimit}</span>
          </div>
          <div style={{ width: 90, height: 3, background: "#2a0000", marginTop: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%`, background: totalPoints > pointsLimit ? "#ff4444" : factionColor, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Save button */}
        <button onClick={saveArmy} style={{ background: saveStatus === "Saved!" ? "#1a5a00" : factionColor, border: "none", color: accent, padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, transition: "background 0.3s", WebkitTapHighlightColor: "transparent" }}>
          {saveStatus || "Save"}
        </button>

        {/* My Lists button */}
        <button onClick={() => setShowListManager(true)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #555", color: "#aaa", padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
          Lists {savedLists.length > 0 && <span style={{ color: accent }}>({savedLists.length})</span>}
        </button>
      </div>

      {/* Add Unit full-screen sheet */}
      {showAddPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: `2px solid ${factionColor}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: accent, fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>
              {factionData.icon} Add Unit — {factionData.name}
            </span>
            <button onClick={() => setShowAddPanel(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          {/* Group units by role */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {["CHARACTER", "BATTLELINE", "ELITE", "FAST ATTACK", "HEAVY", "VEHICLE", "DEDICATED TRANSPORT"].map((role) => {
              const roleUnits = factionData.units.filter((u) => u.role === role);
              if (roleUnits.length === 0) return null;
              return (
                <div key={role} style={{ marginBottom: 20 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{role}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {roleUnits.map((unit) => (
                      <button key={unit.id} onClick={() => addUnit(unit)} style={{ background: `${factionColor}1a`, border: `1px solid ${factionColor}`, color: "#ccc", padding: "14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-body)", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                        <span style={{ color: "#ddd", fontWeight: 600 }}>{unit.name}</span>
                        <span style={{ color: accent, fontFamily: "var(--font-display)", fontSize: 16, flexShrink: 0, marginLeft: 12 }}>{unit.points} pts</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Unit button */}
      <button onClick={() => setShowAddPanel(true)} style={{ background: factionColor, border: "none", color: accent, padding: "14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-display)", letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent" }}>
        + Add Unit
      </button>

      {/* Empty state */}
      {units.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 20px", color: "#333", fontStyle: "italic", fontSize: 14 }}>
          No units added. Begin your warband above.
        </div>
      )}

      {/* Unit cards */}
      {units.map((unit) => {
        const isExpanded = expandedUnit === unit.instanceId;
        const allSelected = [...unit.selectedRanged, ...unit.selectedMelee];
        const excluded = getExcludedWeapons(allSelected, factionData);
        const mark = factionData.marks?.find((m) => m.id === unit.selectedMark);
        const hasMarks = factionData.marks && factionData.marks.length > 0;

        return (
          <div key={unit.instanceId} style={{ border: `1px solid ${isExpanded ? factionColor : "#2a2a2a"}`, background: "rgba(0,0,0,0.4)", transition: "border-color 0.2s" }}>
            {/* Collapsed unit row */}
            <div onClick={() => setExpandedUnit(isExpanded ? null : unit.instanceId)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", cursor: "pointer", minHeight: 60, WebkitTapHighlightColor: "transparent", borderBottom: isExpanded ? "1px solid #2a0000" : "none" }}>
              <div style={{ padding: "3px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, background: unit.unitData.role === "CHARACTER" ? "#4a0070" : unit.unitData.role === "BATTLELINE" ? "#003a70" : unit.unitData.role === "VEHICLE" || unit.unitData.role === "DEDICATED TRANSPORT" ? "#003a20" : "#3a3000", color: "#ccc" }}>{unit.unitData.role}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {narrativeMode && unit.narrativeName ? (
                  <div>
                    <div style={{ color: accent, fontWeight: 700, fontSize: 14 }}>{unit.narrativeName}</div>
                    <div style={{ color: "#555", fontSize: 11 }}>{unit.unitData.name}</div>
                  </div>
                ) : (
                  <div style={{ color: "#ddd", fontWeight: 600, fontSize: 14 }}>{unit.unitData.name}</div>
                )}
                {mark && mark.id !== "undivided" && <div style={{ fontSize: 11, color: "#aa7030", marginTop: 2 }}>{mark.name}</div>}
              </div>
              <div style={{ color: accent, fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0 }}>{unit.totalPoints} pts</div>
              <button onClick={(e) => { e.stopPropagation(); removeUnit(unit.instanceId); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: "0 4px", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>×</button>
              <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Stats */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Characteristics</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(unit.unitData.stats).map(([k, v]) => <StatBadge key={k} label={k} value={v} accentColor={accent} />)}
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

                {/* Mark of Chaos (CSM only — World Eaters don't have marks) */}
                {hasMarks && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Mark of Chaos</div>
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                      {factionData.marks.map((m) => (
                        <button key={m.id} onClick={() => updateUnit(unit.instanceId, { selectedMark: m.id })} style={{ padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "var(--font-body)", fontSize: 13, background: unit.selectedMark === m.id ? factionColor : "rgba(255,255,255,0.03)", border: `1px solid ${unit.selectedMark === m.id ? "#cc2020" : "#333"}`, color: unit.selectedMark === m.id ? accent : "#888", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                    {mark && mark.id !== "undivided" && <div style={{ color: "#aa7030", fontSize: 12, marginTop: 6 }}>Bonus: {mark.bonus}</div>}
                  </div>
                )}

                {/* Ranged weapons */}
                {unit.unitData.weapons?.ranged?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>
                    {unit.unitData.weapons.ranged.map((w) => (
                      <WeaponRow key={w.id} weapon={w} selected={unit.selectedRanged.includes(w.id)} disabled={!unit.selectedRanged.includes(w.id) && excluded.has(w.id)} onToggle={(id) => toggleWeapon(unit.instanceId, id, "ranged")} accentColor={accent} />
                    ))}
                  </div>
                )}

                {/* Melee weapons */}
                {unit.unitData.weapons?.melee?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>
                    {unit.unitData.weapons.melee.map((w) => (
                      <WeaponRow key={w.id} weapon={w} selected={unit.selectedMelee.includes(w.id)} disabled={!unit.selectedMelee.includes(w.id) && excluded.has(w.id)} onToggle={(id) => toggleWeapon(unit.instanceId, id, "melee")} accentColor={accent} />
                    ))}
                  </div>
                )}

                {/* Enhancements (characters only) */}
                {unit.unitData.role === "CHARACTER" && factionData.enhancements.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Enhancement</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: null })} style={{ padding: "10px 12px", cursor: "pointer", minHeight: 48, display: "flex", alignItems: "center", background: !unit.selectedEnhancement ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${!unit.selectedEnhancement ? "#cc2020" : "#333"}`, color: !unit.selectedEnhancement ? accent : "#888", WebkitTapHighlightColor: "transparent" }}>None</div>
                      {factionData.enhancements.map((enh) => (
                        <div key={enh.id} onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: enh.id })} style={{ padding: "10px 12px", cursor: "pointer", background: unit.selectedEnhancement === enh.id ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)", border: `1px solid ${unit.selectedEnhancement === enh.id ? "#cc2020" : "#333"}`, WebkitTapHighlightColor: "transparent" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ color: unit.selectedEnhancement === enh.id ? accent : "#ccc", fontSize: 14, fontWeight: 600 }}>{enh.name}</span>
                            <span style={{ color: accent, fontSize: 13 }}>+{enh.points} pts</span>
                          </div>
                          <div style={{ color: "#777", fontSize: 13, lineHeight: 1.4 }}>{enh.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Narrative / Crusade fields */}
                {narrativeMode && (
                  <div style={{ borderTop: "1px solid #2a0000", paddingTop: 16 }}>
                    <div style={{ color: "#aa5030", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>⚔ Narrative / Crusade</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Unit Name</label>
                        <input value={unit.narrativeName} onChange={(e) => updateUnit(unit.instanceId, { narrativeName: e.target.value })} placeholder="Name your warriors..." style={{ ...inputStyle, borderColor: "#3a2000" }} />
                      </div>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Experience (XP)</label>
                        <input type="number" inputMode="numeric" value={unit.experience} onChange={(e) => updateUnit(unit.instanceId, { experience: Number(e.target.value) })} style={{ ...inputStyle, borderColor: "#3a2000" }} />
                      </div>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Honours / Crusade Upgrades</label>
                        <input value={unit.battleHonours.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleHonours: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Veteran Warriors, Skulls Taken..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} />
                      </div>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Scars</label>
                        <input value={unit.battleScars.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleScars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Warp-Touched, Bloodied..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} />
                      </div>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Notes</label>
                        <textarea value={unit.notes} onChange={(e) => updateUnit(unit.instanceId, { notes: e.target.value })} placeholder="Campaign notes, backstory, territory holdings..." rows={3} style={{ ...inputStyle, color: "#aaa", borderColor: "#3a2000", resize: "vertical" }} />
                      </div>
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

// Read-only rules browser. Supports both factions via a faction selector at the top.
// Sub-tabs: Army Rule, Detachments, Units (drill-down on mobile), Stratagems, Enhancements.
function RulesReference() {
  const [refFactionId, setRefFactionId] = useState("csm");
  const [activeUnit, setActiveUnit] = useState(null);
  const [tab, setTab] = useState("army-rule");
  const isMobile = useIsMobile();

  const faction = FACTIONS[refFactionId];
  const accent = faction.accentColor;

  const tabs = ["army-rule", "detachments", "units", "stratagems", "enhancements"];

  return (
    <div>
      {/* Faction toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.values(FACTIONS).map((f) => (
          <button key={f.id} onClick={() => { setRefFactionId(f.id); setActiveUnit(null); setTab("army-rule"); }} style={{ flex: 1, padding: "10px", cursor: "pointer", background: refFactionId === f.id ? `${f.color}55` : "rgba(255,255,255,0.03)", border: `2px solid ${refFactionId === f.id ? f.color : "#333"}`, color: refFactionId === f.id ? f.accentColor : "#888", fontFamily: "var(--font-display)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, WebkitTapHighlightColor: "transparent" }}>
            {f.icon} {f.shortName}
          </button>
        ))}
      </div>

      {/* Sub-tab bar — scrollable */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => { setTab(t); setActiveUnit(null); }} style={{ padding: "10px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, background: tab === t ? faction.color : "rgba(255,255,255,0.03)", border: `1px solid ${tab === t ? "#cc2020" : "#333"}`, color: tab === t ? accent : "#888", fontFamily: "var(--font-body)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1, transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Army Rule */}
      {tab === "army-rule" && (
        <div>
          <h2 style={{ color: accent, fontFamily: "var(--font-display)", marginBottom: 4, fontSize: 20 }}>{faction.armyRule.name}</h2>
          <div style={{ width: 60, height: 2, background: faction.color, marginBottom: 16 }} />
          <div style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
            <div style={{ color: "#999", fontSize: 14, lineHeight: 1.7 }}>{faction.armyRule.description}</div>
          </div>
        </div>
      )}

      {/* Detachments */}
      {tab === "detachments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faction.detachments.map((d) => (
            <div key={d.name} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ color: accent, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{d.name}</div>
              <div style={{ color: "#999", fontSize: 14, lineHeight: 1.6 }}>{d.rule}</div>
            </div>
          ))}
        </div>
      )}

      {/* Units — drill-down on mobile */}
      {tab === "units" && (
        <div style={isMobile ? {} : { display: "flex", gap: 16 }}>
          {(!isMobile || !activeUnit) && (
            <div style={isMobile ? {} : { width: 220, flexShrink: 0 }}>
              {["CHARACTER", "BATTLELINE", "ELITE", "FAST ATTACK", "HEAVY", "VEHICLE", "DEDICATED TRANSPORT"].map((role) => {
                const roleUnits = faction.units.filter((u) => u.role === role);
                if (roleUnits.length === 0) return null;
                return (
                  <div key={role} style={{ marginBottom: 14 }}>
                    <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{role}</div>
                    {roleUnits.map((u) => (
                      <div key={u.id} onClick={() => setActiveUnit(u)} style={{ padding: "10px 12px", cursor: "pointer", marginBottom: 4, minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center", background: activeUnit?.id === u.id ? `${faction.color}44` : "rgba(255,255,255,0.03)", border: `1px solid ${activeUnit?.id === u.id ? "#cc2020" : "#333"}`, color: activeUnit?.id === u.id ? accent : "#aaa", fontSize: 14, WebkitTapHighlightColor: "transparent" }}>
                        <span>{u.name}</span>
                        <span style={{ color: "#555", fontSize: 12 }}>{u.points} pts ›</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {activeUnit && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile && (
                <button onClick={() => setActiveUnit(null)} style={{ background: `${faction.color}33`, border: `1px solid ${faction.color}`, color: accent, padding: "10px 16px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, WebkitTapHighlightColor: "transparent" }}>
                  ‹ Back to Units
                </button>
              )}
              <h2 style={{ color: accent, fontFamily: "var(--font-display)", marginBottom: 6, fontSize: 20 }}>{activeUnit.name}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {activeUnit.keywords.map((k) => <span key={k} style={{ padding: "3px 8px", background: `${faction.color}33`, border: `1px solid ${faction.color}55`, color: "#999", fontSize: 10, textTransform: "uppercase" }}>{k}</span>)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                {Object.entries(activeUnit.stats).map(([k, v]) => <StatBadge key={k} label={k} value={v} accentColor={accent} />)}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Abilities</div>
                {activeUnit.abilities.map((ab) => (
                  <div key={ab.name} style={{ marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
                    <div style={{ color: accent, fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{ab.name}</div>
                    <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>{ab.description}</div>
                  </div>
                ))}
              </div>
              {activeUnit.weapons?.ranged?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>
                  {activeUnit.weapons.ranged.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} accentColor={accent} />)}
                </div>
              )}
              {activeUnit.weapons?.melee?.length > 0 && (
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>
                  {activeUnit.weapons.melee.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} accentColor={accent} />)}
                </div>
              )}
            </div>
          )}
          {!activeUnit && !isMobile && <div style={{ flex: 1, color: "#444", textAlign: "center", padding: 40, fontStyle: "italic" }}>Select a unit to view its datasheet</div>}
        </div>
      )}

      {/* Stratagems */}
      {tab === "stratagems" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faction.stratagems.map((s) => (
            <div key={s.id} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: accent, fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <span style={{ color: faction.color, fontWeight: 700, fontSize: 15, flexShrink: 0, marginLeft: 8 }}>{s.cost}</span>
              </div>
              <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.phase}</div>
              <div style={{ color: "#999", fontSize: 14, lineHeight: 1.5 }}>{s.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Enhancements */}
      {tab === "enhancements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faction.enhancements.map((e) => (
            <div key={e.id} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: accent, fontWeight: 700, fontSize: 15 }}>{e.name}</span>
                <span style={{ color: accent, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>{e.points} pts</span>
              </div>
              <div style={{ color: "#999", fontSize: 14, lineHeight: 1.5 }}>{e.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NARRATIVE CAMPAIGN HUB
// ============================================================

// Standalone campaign management panel for narrative/crusade play.
// Tracks campaign name, warband, territory control, battle log, and Crusade Points.
// CP awards: +1 per territory, +3 Victory, +1 Draw, +0 Defeat.
function NarrativeHub() {
  const [campaign, setCampaign] = useState({
    name: "The Whispered Crusade",
    warband: "Sons of the Fell Hour",
    faction: "csm",
    territories: [],
    battleLog: [],
    crusadePoints: 0,
  });
  const [newTerritory, setNewTerritory] = useState({ name: "", bonus: "" });
  const [newBattle, setNewBattle] = useState({ opponent: "", result: "Victory", notes: "" });

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #333",
    color: "#ccc", padding: "10px 12px", fontSize: 15,
    fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none",
  };

  // Appends a new territory and awards +1 CP. Clears form fields after saving.
  function addTerritory() {
    if (!newTerritory.name) return;
    setCampaign((prev) => ({
      ...prev,
      territories: [...prev.territories, { id: Date.now(), ...newTerritory }],
      crusadePoints: prev.crusadePoints + 1,
    }));
    setNewTerritory({ name: "", bonus: "" });
  }

  // Prepends a battle record (newest first) and awards CP based on result. Clears form after saving.
  function addBattle() {
    if (!newBattle.opponent) return;
    setCampaign((prev) => ({
      ...prev,
      battleLog: [{ id: Date.now(), date: new Date().toLocaleDateString(), ...newBattle }, ...prev.battleLog],
      crusadePoints: prev.crusadePoints + (newBattle.result === "Victory" ? 3 : newBattle.result === "Draw" ? 1 : 0),
    }));
    setNewBattle({ opponent: "", result: "Victory", notes: "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}>
      {/* Campaign header */}
      <div style={{ padding: 16, background: "rgba(0,0,0,0.5)", border: "1px solid #5a2000", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Campaign Name</label>
          <input value={campaign.name} onChange={(e) => setCampaign((p) => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, color: "#e0c070", borderColor: "#5a2000", fontSize: 16, fontFamily: "var(--font-display)" }} />
        </div>
        <div>
          <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Warband Name</label>
          <input value={campaign.warband} onChange={(e) => setCampaign((p) => ({ ...p, warband: e.target.value }))} style={{ ...inputStyle, borderColor: "#5a2000" }} />
        </div>
        <div style={{ background: "rgba(139,0,0,0.2)", border: "1px solid #8b0000", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Crusade Points</span>
          <span style={{ color: "#e0c070", fontSize: 32, fontWeight: 700, fontFamily: "var(--font-display)" }}>{campaign.crusadePoints}</span>
        </div>
      </div>

      {/* Territory Control */}
      <div>
        <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Territory Control</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <input value={newTerritory.name} onChange={(e) => setNewTerritory((p) => ({ ...p, name: e.target.value }))} placeholder="Territory name..." style={inputStyle} />
          <input value={newTerritory.bonus} onChange={(e) => setNewTerritory((p) => ({ ...p, bonus: e.target.value }))} placeholder="Strategic bonus..." style={inputStyle} />
          <button onClick={addTerritory} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>Claim Territory (+1 CP)</button>
        </div>
        {campaign.territories.length === 0 && <div style={{ color: "#444", fontStyle: "italic", fontSize: 13, padding: 10 }}>No territories claimed yet.</div>}
        {campaign.territories.map((t) => (
          <div key={t.id} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid #3a2000", marginBottom: 8 }}>
            <div style={{ color: "#e0c070", fontSize: 14, fontWeight: 600 }}>{t.name}</div>
            {t.bonus && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{t.bonus}</div>}
          </div>
        ))}
      </div>

      {/* Battle Log */}
      <div>
        <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Battle Log</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <input value={newBattle.opponent} onChange={(e) => setNewBattle((p) => ({ ...p, opponent: e.target.value }))} placeholder="Opponent / Army..." style={inputStyle} />
          <select value={newBattle.result} onChange={(e) => setNewBattle((p) => ({ ...p, result: e.target.value }))} style={{ ...inputStyle, background: "#1a0000" }}>
            <option>Victory</option>
            <option>Draw</option>
            <option>Defeat</option>
          </select>
          <input value={newBattle.notes} onChange={(e) => setNewBattle((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes..." style={inputStyle} />
          <button onClick={addBattle} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>Record Battle</button>
        </div>
        {campaign.battleLog.length === 0 && <div style={{ color: "#444", fontStyle: "italic", fontSize: 13, padding: 10 }}>No battles recorded.</div>}
        {campaign.battleLog.map((b) => (
          <div key={b.id} style={{ padding: "12px 14px", marginBottom: 8, background: "rgba(0,0,0,0.3)", border: `1px solid ${b.result === "Victory" ? "#3a5a00" : b.result === "Defeat" ? "#5a0000" : "#3a3a00"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#ccc", fontSize: 14, fontWeight: 600 }}>vs. {b.opponent}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: b.result === "Victory" ? "#70c070" : b.result === "Defeat" ? "#c07070" : "#c0c070" }}>{b.result}</span>
            </div>
            <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{b.date}</div>
            {b.notes && <div style={{ color: "#777", fontSize: 13, marginTop: 5 }}>{b.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

// Root component. Manages the three top-level tabs (Builder, Rules, Campaign),
// the Narrative Mode toggle, and global CSS (fonts, scrollbars, safe-area insets).
// Mobile: fixed bottom tab bar with icons. Desktop: top tab bar.
export default function App() {
  const [activeTab, setActiveTab] = useState("builder");
  const [narrativeMode, setNarrativeMode] = useState(false);
  const isMobile = useIsMobile();

  // Tab definitions — icon shown in mobile bottom bar
  const tabs = [
    { id: "builder", label: "Builder", icon: "⚔" },
    { id: "rules", label: "Rules", icon: "📖" },
    { id: "narrative", label: "Campaign", icon: "🗺" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0000",
      fontFamily: "var(--font-body)",
      "--font-display": "'Cinzel', 'Trajan Pro', Georgia, serif",
      "--font-body": "'Crimson Text', 'Palatino Linotype', Georgia, serif",
      color: "#ccc",
      paddingBottom: isMobile ? "calc(56px + env(safe-area-inset-bottom, 0px))" : 0,
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
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #1a0000 0%, #0f0000 100%)", borderBottom: "2px solid #8b0000", padding: isMobile ? "10px 14px" : "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22, color: "#8b0000", flexShrink: 0 }}>✠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 15 : 22, color: "#e0c070", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Chaos Army Builder
          </h1>
          <div style={{ color: "#5a0000", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>CSM · World Eaters · 10th Edition</div>
        </div>
        {/* Narrative toggle — only on Builder tab */}
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
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "12px 28px", background: "none", border: "none", borderBottom: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`, color: activeTab === t.id ? "#e0c070" : "#666", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: isMobile ? "100%" : 1100, margin: "0 auto", padding: isMobile ? "14px 12px" : "24px 16px" }}>
        {activeTab === "builder" && <ArmyBuilder narrativeMode={narrativeMode} />}
        {activeTab === "rules" && <RulesReference />}
        {activeTab === "narrative" && <NarrativeHub />}
      </div>

      {/* Desktop footer */}
      {!isMobile && <div style={{ textAlign: "center", padding: 20, color: "#2a0000", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>In the grim darkness of the far future, there is only war.</div>}

      {/* Mobile bottom nav — safe-area aware for iOS notch and Android gesture strip */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f0000", borderTop: "2px solid #8b0000", display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", minHeight: 56, background: "none", border: "none", borderTop: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`, color: activeTab === t.id ? "#e0c070" : "#555", cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 10, marginTop: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}