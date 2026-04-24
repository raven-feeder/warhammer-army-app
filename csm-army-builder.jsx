import { useState, useEffect } from "react";

// ============================================================
// DATA LAYER - Chaos Space Marines
// ============================================================

// Central data store for all Chaos Space Marines game content.
// Contains detachment rules, enhancements, stratagems, and unit datasheets.
// Each unit definition includes stats, abilities, and available weapons with
// their points costs and mutual-exclusivity constraints (the `exclusive` field).
const CSM_DATA = {
  detachmentRules: {
    name: "Slaves to Darkness",
    rules: [
      {
        name: "Mark of Chaos",
        description:
          "Each unit in your army can be dedicated to one of the four Chaos Gods (Khorne, Tzeentch, Nurgle, Slaanesh) or remain Undivided. Each Mark grants different bonuses and restrictions.",
      },
      {
        name: "Dark Pacts",
        description:
          "Once per turn, one unit in your army can make a Dark Pact. Roll one D6: on a 2+, that unit gains a bonus ability until the end of the phase. On a 1, the unit suffers D3 mortal wounds.",
      },
      {
        name: "Veterans of the Long War",
        description:
          "Chaos Space Marines units gain +1 to wound rolls against units with the Imperium keyword when targeting models that have a Wounds characteristic of 1.",
      },
    ],
  },

  enhancements: [
    { id: "e1", name: "Blade of the Relentless", points: 20, description: "Bearer's melee weapons gain +1 Strength and +1 Damage." },
    { id: "e2", name: "Mark of the Chosen", points: 15, description: "Bearer gains the Chosen keyword and +1 to all saving throws." },
    { id: "e3", name: "Sigil of Corruption", points: 25, description: "Once per battle, bearer can call upon the Dark Gods. All friendly units within 6\" gain +1 Attack until end of phase." },
    { id: "e4", name: "Warpforged Armour", points: 30, description: "Bearer gains a 4+ invulnerable save." },
  ],

  stratagems: [
    { id: "s1", name: "Fury of the Damned", cost: "1 CP", phase: "Fight Phase", description: "Use when a CSM unit is chosen to fight. Until the end of the phase, that unit's melee weapons have the Lethal Hits ability." },
    { id: "s2", name: "Chaos Undivided", cost: "2 CP", phase: "Command Phase", description: "Use at the start of your command phase. One friendly CSM unit within 12\" of your WARLORD regains D3 lost wounds." },
    { id: "s3", name: "Warpfire Baptism", cost: "1 CP", phase: "Shooting Phase", description: "Use when a SORCERER in your army is chosen to shoot. Until end of phase, that unit's ranged weapons gain the Devastating Wounds ability." },
    { id: "s4", name: "Hateful Assault", cost: "1 CP", phase: "Fight Phase", description: "Use when a BERZERKERS unit is chosen to fight. That unit can fight twice this phase." },
  ],

  units: [
    {
      id: "chaos-lord",
      name: "Chaos Lord",
      role: "CHARACTER",
      points: 80,
      keywords: ["CHARACTER", "INFANTRY", "CHAOS LORD", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 5, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Lord of Chaos", description: "Friendly CHAOS SPACE MARINES CORE units within 6\" can re-roll hit rolls of 1." },
        { name: "Warlord", description: "This model can be your WARLORD. If it is, select one Warlord Trait for it." },
      ],
      weapons: {
        ranged: [
          { id: "combi-bolter", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
          { id: "plasma-pistol", name: "Plasma Pistol", range: '12"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Pistol, Hazardous", points: 5, exclusive: ["plasma-pistol"] },
          { id: "bolt-pistol", name: "Bolt Pistol", range: '12"', attacks: 1, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Pistol", points: 0, exclusive: ["plasma-pistol"] },
        ],
        melee: [
          { id: "chainsword", name: "Chainsword", attacks: 5, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0, exclusive: ["power-fist", "daemon-blade"] },
          { id: "power-fist", name: "Power Fist", attacks: 4, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["chainsword", "daemon-blade"] },
          { id: "daemon-blade", name: "Daemon Blade", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 2, special: "Anti-IMPERIUM 4+", points: 15, exclusive: ["chainsword", "power-fist"] },
        ],
      },
      options: ["Can take one Enhancement", "Can be dedicated to a Mark of Chaos"],
    },
    {
      id: "chaos-marines",
      name: "Chaos Space Marines",
      role: "BATTLELINE",
      points: 130,
      baseSize: 10,
      keywords: ["INFANTRY", "CORE", "CHAOS", "CHAOS SPACE MARINES", "BATTLELINE"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Despoilers", description: "At the start of the Fight phase, if this unit is within Engagement Range of an enemy unit, it can make a free attack with a Close Combat Weapon in addition to its normal attacks." },
      ],
      weapons: {
        ranged: [
          { id: "boltgun", name: "Boltgun", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 1", points: 0 },
          { id: "csm-plasma-gun", name: "Plasma Gun", range: '24"', attacks: 1, skill: "3+", strength: 7, AP: -2, damage: 1, special: "Rapid Fire 1, Hazardous", points: 5, exclusive: ["csm-melta", "csm-flamer", "boltgun"], limit: 2 },
          { id: "csm-melta", name: "Meltagun", range: '12"', attacks: 1, skill: "3+", strength: 9, AP: -4, damage: "D6", special: "Melta 2", points: 5, exclusive: ["csm-plasma-gun", "csm-flamer", "boltgun"], limit: 2 },
          { id: "csm-flamer", name: "Flamer", range: '12"', attacks: "D6", skill: "Auto", strength: 4, AP: 0, damage: 1, special: "Ignores Cover, Torrent", points: 5, exclusive: ["csm-plasma-gun", "csm-melta", "boltgun"], limit: 2 },
        ],
        melee: [
          { id: "csm-chainsword", name: "Chainsword", attacks: 3, skill: "4+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "csm-power-weapon", name: "Power Weapon", attacks: 3, skill: "4+", strength: 5, AP: -2, damage: 1, special: "—", points: 5, exclusive: ["csm-chainsword"], limit: 1 },
        ],
      },
      options: ["Champion can take Aspiring Champion upgrade (+10pts)"],
    },
    {
      id: "chosen",
      name: "Chosen",
      role: "ELITE",
      points: 200,
      baseSize: 5,
      keywords: ["INFANTRY", "CORE", "CHAOS", "CHOSEN", "CHAOS SPACE MARINES"],
      stats: { M: '6"', T: 4, Sv: "3+", W: 2, Ld: "6+", OC: 2 },
      abilities: [
        { name: "Chosen Warriors", description: "Each model in this unit can take a different weapon loadout from the options list." },
        { name: "Aura of Dark Glory", description: "Friendly CHAOS SPACE MARINES units within 6\" gain +1 to their Leadership characteristic." },
      ],
      weapons: {
        ranged: [
          { id: "chosen-bolter", name: "Combi-bolter", range: '24"', attacks: 2, skill: "3+", strength: 4, AP: 0, damage: 1, special: "Rapid Fire 2", points: 0 },
        ],
        melee: [
          { id: "chosen-chainsword", name: "Chainsword", attacks: 4, skill: "3+", strength: 4, AP: -1, damage: 1, special: "—", points: 0 },
          { id: "chosen-power-fist", name: "Power Fist", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 2, special: "—", points: 10, exclusive: ["chosen-chainsword"], limit: 2 },
          { id: "chosen-lightning-claws", name: "Lightning Claws (pair)", attacks: 5, skill: "3+", strength: 5, AP: -2, damage: 1, special: "Twin-Linked", points: 10, exclusive: ["chosen-chainsword"], limit: 2 },
        ],
      },
    },
    {
      id: "obliterators",
      name: "Obliterators",
      role: "HEAVY",
      points: 140,
      baseSize: 2,
      keywords: ["INFANTRY", "DAEMON", "CHAOS", "OBLITERATORS", "CHAOS SPACE MARINES"],
      stats: { M: '5"', T: 6, Sv: "2+", W: 4, Ld: "6+", OC: 1 },
      abilities: [
        { name: "Fleshmetal Guns", description: "Each time this unit shoots, choose one weapon profile from the Fleshmetal Guns options. All models in the unit use that profile." },
        { name: "Daemon Resilience", description: "This unit has a 4+ invulnerable save." },
      ],
      weapons: {
        ranged: [
          { id: "fleshmetal-heavy", name: "Fleshmetal (Heavy)", range: '24"', attacks: 2, skill: "4+", strength: 8, AP: -2, damage: 3, special: "Heavy", points: 0 },
          { id: "fleshmetal-assault", name: "Fleshmetal (Assault)", range: '12"', attacks: 4, skill: "4+", strength: 5, AP: -1, damage: 1, special: "Assault", points: 0 },
        ],
        melee: [
          { id: "obliterator-fists", name: "Crushing Fists", attacks: 3, skill: "4+", strength: 8, AP: -2, damage: 3, special: "—", points: 0 },
        ],
      },
    },
    {
      id: "predator",
      name: "Predator Annihilator",
      role: "VEHICLE",
      points: 150,
      keywords: ["VEHICLE", "CHAOS", "PREDATOR", "SMOKE", "CHAOS SPACE MARINES"],
      stats: { M: '10"', T: 10, Sv: "3+", W: 11, Ld: "6+", OC: 3 },
      abilities: [
        { name: "Smoke", description: "Once per game, at the start of your movement phase, this model can use its Smoke Launchers. Until the start of your next turn, ranged weapons that target this model suffer -1 to their hit rolls." },
      ],
      weapons: {
        ranged: [
          { id: "twin-lascannon", name: "Twin Lascannon", range: '48"', attacks: 2, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy, Twin-linked", points: 0 },
          { id: "predator-heavy-bolter", name: "Heavy Bolter (sponson)", range: '36"', attacks: 3, skill: "3+", strength: 5, AP: -1, damage: 2, special: "Heavy, Sustained Hits 1", points: 10, limit: 2 },
          { id: "predator-lascannon-sponson", name: "Lascannon (sponson)", range: '48"', attacks: 1, skill: "3+", strength: 12, AP: -3, damage: "D6+1", special: "Heavy", points: 15, exclusive: ["predator-heavy-bolter"], limit: 2 },
        ],
        melee: [
          { id: "predator-crush", name: "Armoured Tracks", attacks: 3, skill: "4+", strength: 6, AP: 0, damage: 1, special: "—", points: 0 },
        ],
      },
    },
  ],
};

// List of all available Marks of Chaos a unit can be dedicated to.
// Each mark grants a different in-game bonus displayed in the army builder UI.
const MARKS = [
  { id: "undivided", name: "Undivided", bonus: "No specific bonus" },
  { id: "khorne", name: "Mark of Khorne", bonus: "+1 Attack in Fight phase" },
  { id: "tzeentch", name: "Mark of Tzeentch", bonus: "+1 to invulnerable saves (min 4+)" },
  { id: "nurgle", name: "Mark of Nurgle", bonus: "+1 Toughness" },
  { id: "slaanesh", name: "Mark of Slaanesh", bonus: "+1 to Advance and Charge rolls" },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Computes the set of weapon IDs that should be locked/unavailable for selection.
// Iterates over all currently selected weapons, looks up each weapon's `exclusive`
// list, and collects every ID that is mutually incompatible with the current selection.
// The returned Set is used by WeaponRow to visually disable conflicting options in real-time.
function getExcludedWeapons(selectedWeapons) {
  const excluded = new Set();
  selectedWeapons.forEach((wId) => {
    const allWeapons = CSM_DATA.units.flatMap((u) => [
      ...(u.weapons?.ranged || []),
      ...(u.weapons?.melee || []),
    ]);
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

// ============================================================
// COMPONENTS
// ============================================================

// Renders a single characteristic badge (e.g. M, T, Sv, W) for a unit's stat block.
// Displays the stat label above the value in a styled dark box.
// Uses flex:1 so badges share available width evenly on mobile.
function StatBadge({ label, value }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "rgba(180,20,20,0.15)", border: "1px solid #8b0000",
      padding: "6px 8px", flex: "1 0 auto", minWidth: 42,
    }}>
      <span style={{ fontSize: 10, color: "#888", fontFamily: "var(--font-body)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#e0c070", fontFamily: "var(--font-display)" }}>{value}</span>
    </div>
  );
}

// Renders a single selectable weapon row inside a unit's loadout panel.
// Displays the weapon's name, stat line, and optional points cost.
// Touch targets are minimum 52px tall. WebkitTapHighlightColor is removed
// to prevent the grey flash that appears on iOS when tapping.
function WeaponRow({ weapon, selected, disabled, onToggle }) {
  return (
    <div
      onClick={() => !disabled && onToggle(weapon.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px", marginBottom: 6, minHeight: 52,
        background: selected ? "rgba(180,20,20,0.25)" : disabled ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "#cc2020" : disabled ? "#333" : "#3a3a3a"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Checkbox indicator */}
      <div style={{
        width: 22, height: 22, borderRadius: 2,
        border: `2px solid ${selected ? "#cc2020" : "#555"}`,
        background: selected ? "#cc2020" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {selected && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
      </div>
      {/* Name + stat line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: disabled ? "#555" : selected ? "#e0c070" : "#ccc", fontSize: 14, fontWeight: 600 }}>{weapon.name}</div>
        <div style={{ color: "#777", fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
          {weapon.range && `${weapon.range} · `}A{weapon.attacks} · S{weapon.strength} · AP{weapon.AP} · D{weapon.damage}
          {weapon.special && weapon.special !== "—" && ` · ${weapon.special}`}
        </div>
      </div>
      {weapon.points > 0 && (
        <div style={{ color: "#e0c070", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>+{weapon.points} pts</div>
      )}
    </div>
  );
}

// ============================================================
// ARMY BUILDER
// ============================================================

// Main army construction interface. Manages the list of unit instances added to the army,
// tracks total points against the chosen limit, and handles all unit-level state changes
// (weapon selection, mark, enhancement, narrative fields). Accepts a `narrativeMode` prop
// that reveals per-unit campaign fields (custom name, XP, honours, scars, notes).
// On mobile, "Add Unit" opens a full-screen bottom sheet instead of an inline button row.
function ArmyBuilder({ narrativeMode }) {
  const [armyName, setArmyName] = useState("Legion of the Damned");
  const [pointsLimit, setPointsLimit] = useState(2000);
  const [units, setUnits] = useState([]);
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const isMobile = useIsMobile();

  // Derived value: sum of totalPoints across all unit instances in the current army list.
  const totalPoints = units.reduce((sum, u) => sum + u.totalPoints, 0);

  // Shared style for text inputs and textareas — sized for comfortable mobile typing.
  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #555",
    color: "#e0c070", padding: "10px 12px", fontSize: 15,
    fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none",
  };

  // Creates a new unit instance from the selected unit data and appends it to the army list.
  // Each instance gets a unique instanceId (timestamp + random) so multiple copies of the
  // same unit type can coexist independently. Narrative fields are initialised as empty.
  // Auto-expands the newly added unit and closes the add panel on mobile.
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

  // Removes a unit instance from the army list by its instanceId.
  // Also clears the expanded panel if the removed unit was currently open.
  function removeUnit(instanceId) {
    setUnits((prev) => prev.filter((u) => u.instanceId !== instanceId));
    if (expandedUnit === instanceId) setExpandedUnit(null);
  }

  // Applies a partial update (any fields in `changes`) to a specific unit instance.
  // After merging the changes, recalculates the unit's totalPoints from scratch:
  // base cost + any points-costing weapons currently selected + enhancement cost (if any).
  // This ensures the points tracker stays accurate after every user interaction.
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
          const enh = CSM_DATA.enhancements.find((e) => e.id === updated.selectedEnhancement);
          if (enh) pts += enh.points;
        }
        updated.totalPoints = pts;
        return updated;
      })
    );
  }

  // Toggles a weapon's selected state for a given unit instance.
  // Determines whether to operate on the ranged or melee selection list based on `type`,
  // then either adds or removes the weaponId before calling updateUnit to persist the change
  // and trigger a points recalculation.
  function toggleWeapon(instanceId, weaponId, type) {
    const unit = units.find((u) => u.instanceId === instanceId);
    if (!unit) return;
    const key = type === "ranged" ? "selectedRanged" : "selectedMelee";
    const current = unit[key];
    const isSelected = current.includes(weaponId);
    updateUnit(instanceId, {
      [key]: isSelected ? current.filter((id) => id !== weaponId) : [...current, weaponId],
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>

      {/* ── Sticky points bar ── */}
      <div style={{
        background: "rgba(10,0,0,0.95)",
        border: "1px solid #8b0000",
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <input
          value={armyName}
          onChange={(e) => setArmyName(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 140px", minWidth: 0, fontSize: 14, padding: "8px 10px", color: "#e0c070", fontFamily: "var(--font-display)" }}
        />
        <select
          value={pointsLimit}
          onChange={(e) => setPointsLimit(Number(e.target.value))}
          style={{ background: "#1a0000", border: "1px solid #555", color: "#ccc", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-body)", WebkitAppearance: "none", flexShrink: 0 }}
        >
          {[500, 1000, 1500, 2000, 2500, 3000].map((p) => (
            <option key={p} value={p}>{p} pts</option>
          ))}
        </select>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: totalPoints > pointsLimit ? "#ff4444" : "#e0c070", fontFamily: "var(--font-display)", lineHeight: 1 }}>
            {totalPoints}<span style={{ color: "#444", fontWeight: 400 }}>/{pointsLimit}</span>
          </div>
          <div style={{ width: 90, height: 3, background: "#2a0000", marginTop: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%`, background: totalPoints > pointsLimit ? "#ff4444" : "#8b0000", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {/* ── Full-screen Add Unit sheet (mobile) ── */}
      {showAddPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0000", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1a0000", borderBottom: "2px solid #8b0000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", color: "#e0c070", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Add Unit</span>
            <button onClick={() => setShowAddPanel(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 30, lineHeight: 1, cursor: "pointer", padding: "0 4px", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {CSM_DATA.units.map((unit) => (
              <button
                key={unit.id}
                onClick={() => addUnit(unit)}
                style={{
                  background: "rgba(139,0,0,0.15)", border: "1px solid #8b0000", color: "#ccc",
                  padding: "16px 14px", cursor: "pointer", fontSize: 15, fontFamily: "var(--font-body)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  textAlign: "left", WebkitTapHighlightColor: "transparent",
                }}
              >
                <div>
                  <div style={{ color: "#ddd", fontWeight: 600, fontSize: 15 }}>{unit.name}</div>
                  <div style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>{unit.role}</div>
                </div>
                <div style={{ color: "#e0c070", fontFamily: "var(--font-display)", fontSize: 16, flexShrink: 0, marginLeft: 12 }}>{unit.points} pts</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Unit button ── */}
      <button
        onClick={() => setShowAddPanel(true)}
        style={{
          background: "#8b0000", border: "none", color: "#e0c070", padding: "14px",
          cursor: "pointer", fontSize: 15, fontFamily: "var(--font-display)",
          letterSpacing: 1, textTransform: "uppercase", WebkitTapHighlightColor: "transparent",
        }}
      >
        + Add Unit
      </button>

      {/* ── Empty state ── */}
      {units.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 20px", color: "#333", fontStyle: "italic", fontSize: 14 }}>
          No units added yet. Begin your Legion above.
        </div>
      )}

      {/* ── Unit cards ── */}
      {units.map((unit) => {
        const isExpanded = expandedUnit === unit.instanceId;
        const allSelected = [...unit.selectedRanged, ...unit.selectedMelee];
        const excluded = getExcludedWeapons(allSelected);
        const mark = MARKS.find((m) => m.id === unit.selectedMark);

        return (
          <div key={unit.instanceId} style={{ border: `1px solid ${isExpanded ? "#8b0000" : "#2a2a2a"}`, background: "rgba(0,0,0,0.4)", transition: "border-color 0.2s" }}>

            {/* Collapsed row — tap to expand */}
            <div
              onClick={() => setExpandedUnit(isExpanded ? null : unit.instanceId)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "14px 12px",
                cursor: "pointer", minHeight: 60, WebkitTapHighlightColor: "transparent",
                borderBottom: isExpanded ? "1px solid #2a0000" : "none",
              }}
            >
              <div style={{
                padding: "3px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1,
                textTransform: "uppercase", flexShrink: 0,
                background: unit.unitData.role === "CHARACTER" ? "#4a0070" : unit.unitData.role === "BATTLELINE" ? "#003a70" : unit.unitData.role === "VEHICLE" ? "#003a20" : "#3a3000",
                color: "#ccc",
              }}>{unit.unitData.role}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {narrativeMode && unit.narrativeName ? (
                  <div>
                    <div style={{ color: "#e0c070", fontWeight: 700, fontSize: 14 }}>{unit.narrativeName}</div>
                    <div style={{ color: "#555", fontSize: 11 }}>{unit.unitData.name}</div>
                  </div>
                ) : (
                  <div style={{ color: "#ddd", fontWeight: 600, fontSize: 14 }}>{unit.unitData.name}</div>
                )}
                {mark && mark.id !== "undivided" && <div style={{ fontSize: 11, color: "#aa7030", marginTop: 2 }}>{mark.name}</div>}
              </div>
              <div style={{ color: "#e0c070", fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0 }}>{unit.totalPoints} pts</div>
              <button
                onClick={(e) => { e.stopPropagation(); removeUnit(unit.instanceId); }}
                style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: "0 4px", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
              >×</button>
              <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Stats — wraps to fill width on small screens */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Characteristics</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(unit.unitData.stats).map(([k, v]) => <StatBadge key={k} label={k} value={v} />)}
                  </div>
                </div>

                {/* Abilities */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Abilities</div>
                  {unit.unitData.abilities.map((ab) => (
                    <div key={ab.name} style={{ marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,0.25)", border: "1px solid #2a0000" }}>
                      <div style={{ color: "#e0c070", fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{ab.name}</div>
                      <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>{ab.description}</div>
                    </div>
                  ))}
                </div>

                {/* Mark of Chaos — horizontally scrollable row of pill buttons */}
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Mark of Chaos</div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                    {MARKS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updateUnit(unit.instanceId, { selectedMark: m.id })}
                        style={{
                          padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                          fontFamily: "var(--font-body)", fontSize: 13,
                          background: unit.selectedMark === m.id ? "#8b0000" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${unit.selectedMark === m.id ? "#cc2020" : "#333"}`,
                          color: unit.selectedMark === m.id ? "#e0c070" : "#888",
                          transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
                        }}
                      >{m.name}</button>
                    ))}
                  </div>
                  {mark && mark.id !== "undivided" && (
                    <div style={{ color: "#aa7030", fontSize: 12, marginTop: 6 }}>Bonus: {mark.bonus}</div>
                  )}
                </div>

                {/* Ranged weapons */}
                {unit.unitData.weapons?.ranged?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>
                    {unit.unitData.weapons.ranged.map((w) => (
                      <WeaponRow key={w.id} weapon={w}
                        selected={unit.selectedRanged.includes(w.id)}
                        disabled={!unit.selectedRanged.includes(w.id) && excluded.has(w.id)}
                        onToggle={(id) => toggleWeapon(unit.instanceId, id, "ranged")}
                      />
                    ))}
                  </div>
                )}

                {/* Melee weapons */}
                {unit.unitData.weapons?.melee?.length > 0 && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>
                    {unit.unitData.weapons.melee.map((w) => (
                      <WeaponRow key={w.id} weapon={w}
                        selected={unit.selectedMelee.includes(w.id)}
                        disabled={!unit.selectedMelee.includes(w.id) && excluded.has(w.id)}
                        onToggle={(id) => toggleWeapon(unit.instanceId, id, "melee")}
                      />
                    ))}
                  </div>
                )}

                {/* Enhancement — characters only */}
                {unit.unitData.role === "CHARACTER" && (
                  <div>
                    <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Enhancement</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: null })}
                        style={{
                          padding: "10px 12px", cursor: "pointer", fontSize: 14, minHeight: 48,
                          display: "flex", alignItems: "center",
                          background: !unit.selectedEnhancement ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${!unit.selectedEnhancement ? "#cc2020" : "#333"}`,
                          color: !unit.selectedEnhancement ? "#e0c070" : "#888",
                          WebkitTapHighlightColor: "transparent",
                        }}>None</div>
                      {CSM_DATA.enhancements.map((enh) => (
                        <div key={enh.id} onClick={() => updateUnit(unit.instanceId, { selectedEnhancement: enh.id })}
                          style={{
                            padding: "10px 12px", cursor: "pointer",
                            background: unit.selectedEnhancement === enh.id ? "rgba(180,20,20,0.25)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${unit.selectedEnhancement === enh.id ? "#cc2020" : "#333"}`,
                            WebkitTapHighlightColor: "transparent",
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ color: unit.selectedEnhancement === enh.id ? "#e0c070" : "#ccc", fontSize: 14, fontWeight: 600 }}>{enh.name}</span>
                            <span style={{ color: "#e0c070", fontSize: 13 }}>+{enh.points} pts</span>
                          </div>
                          <div style={{ color: "#777", fontSize: 13, lineHeight: 1.4 }}>{enh.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Narrative fields — fully stacked single-column */}
                {narrativeMode && (
                  <div style={{ borderTop: "1px solid #2a0000", paddingTop: 16 }}>
                    <div style={{ color: "#aa5030", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>⚔ Narrative Campaign</div>
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
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Honours / Special Abilities</label>
                        <input value={unit.battleHonours.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleHonours: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Veteran Warriors, Blessed by Khorne..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} />
                      </div>
                      <div>
                        <label style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Battle Scars</label>
                        <input value={unit.battleScars.join(", ")} onChange={(e) => updateUnit(unit.instanceId, { battleScars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Warp-Touched, Plagued..." style={{ ...inputStyle, color: "#ccc", borderColor: "#3a2000" }} />
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

// Read-only rules browser with four internal sub-tabs.
// On mobile the "units" tab uses a drill-down pattern: tapping a unit
// navigates to a full-detail view with a Back button rather than a side-by-side layout.
// All sub-tab buttons are horizontally scrollable to fit on narrow screens.
function RulesReference() {
  const [activeUnit, setActiveUnit] = useState(null);
  const [tab, setTab] = useState("detachment");
  const isMobile = useIsMobile();

  return (
    <div>
      {/* Scrollable sub-tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        {["detachment", "units", "stratagems", "enhancements"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setActiveUnit(null); }}
            style={{
              padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              background: tab === t ? "#8b0000" : "rgba(255,255,255,0.03)",
              border: `1px solid ${tab === t ? "#cc2020" : "#333"}`,
              color: tab === t ? "#e0c070" : "#888",
              fontFamily: "var(--font-body)", textTransform: "uppercase", fontSize: 12, letterSpacing: 1,
              transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
            }}
          >{t}</button>
        ))}
      </div>

      {/* Detachment rules */}
      {tab === "detachment" && (
        <div>
          <h2 style={{ color: "#e0c070", fontFamily: "var(--font-display)", marginBottom: 4, fontSize: 20 }}>{CSM_DATA.detachmentRules.name}</h2>
          <div style={{ width: 60, height: 2, background: "#8b0000", marginBottom: 20 }} />
          {CSM_DATA.detachmentRules.rules.map((rule) => (
            <div key={rule.name} style={{ marginBottom: 14, padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ color: "#e0c070", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{rule.name}</div>
              <div style={{ color: "#999", fontSize: 14, lineHeight: 1.6 }}>{rule.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Units tab */}
      {tab === "units" && (
        <div style={isMobile ? {} : { display: "flex", gap: 16 }}>
          {/* Unit list — hidden on mobile when drilling into a unit */}
          {(!isMobile || !activeUnit) && (
            <div style={isMobile ? {} : { width: 200, flexShrink: 0 }}>
              {CSM_DATA.units.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setActiveUnit(u)}
                  style={{
                    padding: "12px 14px", cursor: "pointer", marginBottom: 6,
                    minHeight: 56, display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: activeUnit?.id === u.id ? "rgba(139,0,0,0.4)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${activeUnit?.id === u.id ? "#cc2020" : "#333"}`,
                    color: activeUnit?.id === u.id ? "#e0c070" : "#aaa",
                    fontSize: 14, WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div>
                    <div>{u.name}</div>
                    <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", marginTop: 2 }}>{u.role}</div>
                  </div>
                  <span style={{ color: "#555", fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>
          )}

          {/* Unit detail view */}
          {activeUnit && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Back button on mobile */}
              {isMobile && (
                <button
                  onClick={() => setActiveUnit(null)}
                  style={{
                    background: "rgba(139,0,0,0.2)", border: "1px solid #8b0000",
                    color: "#e0c070", padding: "10px 16px", cursor: "pointer",
                    fontFamily: "var(--font-body)", fontSize: 13, marginBottom: 16,
                    display: "flex", alignItems: "center", gap: 6, WebkitTapHighlightColor: "transparent",
                  }}
                >‹ Back to Units</button>
              )}
              <h2 style={{ color: "#e0c070", fontFamily: "var(--font-display)", marginBottom: 8, fontSize: 20 }}>{activeUnit.name}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
                {activeUnit.keywords.map((k) => (
                  <span key={k} style={{ padding: "3px 8px", background: "rgba(139,0,0,0.2)", border: "1px solid #5a0000", color: "#999", fontSize: 10, textTransform: "uppercase" }}>{k}</span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                {Object.entries(activeUnit.stats).map(([k, v]) => <StatBadge key={k} label={k} value={v} />)}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Abilities</div>
                {activeUnit.abilities.map((ab) => (
                  <div key={ab.name} style={{ marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
                    <div style={{ color: "#e0c070", fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{ab.name}</div>
                    <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>{ab.description}</div>
                  </div>
                ))}
              </div>
              {activeUnit.weapons?.ranged?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ranged Weapons</div>
                  {activeUnit.weapons.ranged.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} />)}
                </div>
              )}
              {activeUnit.weapons?.melee?.length > 0 && (
                <div>
                  <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Melee Weapons</div>
                  {activeUnit.weapons.melee.map((w) => <WeaponRow key={w.id} weapon={w} selected={false} disabled={false} onToggle={() => {}} />)}
                </div>
              )}
            </div>
          )}
          {!activeUnit && !isMobile && (
            <div style={{ flex: 1, color: "#444", textAlign: "center", padding: 40, fontStyle: "italic" }}>Select a unit to view its datasheet</div>
          )}
        </div>
      )}

      {/* Stratagems — single-column cards */}
      {tab === "stratagems" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CSM_DATA.stratagems.map((s) => (
            <div key={s.id} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#e0c070", fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <span style={{ color: "#8b0000", fontWeight: 700, fontSize: 15, flexShrink: 0, marginLeft: 8 }}>{s.cost}</span>
              </div>
              <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.phase}</div>
              <div style={{ color: "#999", fontSize: 14, lineHeight: 1.5 }}>{s.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Enhancements — single-column cards */}
      {tab === "enhancements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CSM_DATA.enhancements.map((e) => (
            <div key={e.id} style={{ padding: 16, background: "rgba(0,0,0,0.3)", border: "1px solid #2a0000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#e0c070", fontWeight: 700, fontSize: 15 }}>{e.name}</span>
                <span style={{ color: "#e0c070", fontSize: 14, flexShrink: 0, marginLeft: 8 }}>{e.points} pts</span>
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
// Maintains campaign-level state: name, warband name, a territory list,
// a chronological battle log, and a running Crusade Points total.
// Crusade Points are awarded automatically: +1 per territory claimed,
// +3 for a Victory, +1 for a Draw, and +0 for a Defeat.
// All sections stack in a single column on mobile.
function NarrativeHub() {
  const [campaign, setCampaign] = useState({
    name: "The Whispered Crusade",
    warband: "Sons of the Fell Hour",
    territories: [],
    battleLog: [],
    crusadePoints: 0,
  });
  const [newTerritory, setNewTerritory] = useState({ name: "", bonus: "" });
  const [newBattle, setNewBattle] = useState({ opponent: "", result: "Victory", notes: "" });

  // Shared input style — full-width, 48px+ touch targets, no iOS default chrome.
  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid #333",
    color: "#ccc", padding: "10px 12px", fontSize: 15,
    fontFamily: "var(--font-body)", outline: "none", WebkitAppearance: "none",
  };

  // Validates that a name has been entered, then appends the new territory
  // to the campaign's territory list and awards +1 Crusade Point. Clears the input fields after saving.
  function addTerritory() {
    if (!newTerritory.name) return;
    setCampaign((prev) => ({
      ...prev,
      territories: [...prev.territories, { id: Date.now(), ...newTerritory }],
      crusadePoints: prev.crusadePoints + 1,
    }));
    setNewTerritory({ name: "", bonus: "" });
  }

  // Validates that an opponent has been entered, then prepends the battle record to the
  // top of the battle log (most recent first) with today's date auto-stamped.
  // Awards Crusade Points based on result: Victory = +3, Draw = +1, Defeat = +0.
  // Clears the input fields after saving.
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
          <button onClick={addTerritory} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>
            Claim Territory (+1 CP)
          </button>
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
          <button onClick={addBattle} style={{ background: "#8b0000", border: "none", color: "#e0c070", padding: "14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 15, WebkitTapHighlightColor: "transparent" }}>
            Record Battle
          </button>
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

// Root application component. Manages top-level navigation between the three main sections
// (Army Builder, Rules Reference, Narrative Campaign) via a tab bar, and owns the
// `narrativeMode` toggle passed down into ArmyBuilder.
// On mobile: tab bar is fixed to the bottom of the screen (native app convention).
//            The header is compact and the content area uses tighter padding.
// On desktop: tab bar appears below the header at the top.
// Global CSS handles Google Fonts, scrollbar styling, safe-area insets for iOS notch /
// Android gesture bar, and prevents double-tap zoom on interactive elements.
export default function App() {
  const [activeTab, setActiveTab] = useState("builder");
  const [narrativeMode, setNarrativeMode] = useState(false);
  const isMobile = useIsMobile();

  const tabs = [
    { id: "builder", label: "Builder", icon: "⚔" },
    { id: "rules", label: "Rules", icon: "📖" },
    { id: "narrative", label: "Campaign", icon: "🗺" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0000",
      fontFamily: "var(--font-body)",
      "--font-display": "'Cinzel', 'Trajan Pro', Georgia, serif",
      "--font-body": "'Crimson Text', 'Palatino Linotype', Georgia, serif",
      color: "#ccc",
      // Reserve space at bottom for the fixed mobile tab bar (56px bar + safe area)
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
        /* Prevent iOS text size inflation on rotation */
        body { background: #0a0000; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        /* Prevent double-tap zoom delay on buttons and tappable divs */
        button, [role="button"], input, select { touch-action: manipulation; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(180deg, #1a0000 0%, #0f0000 100%)",
        borderBottom: "2px solid #8b0000",
        padding: isMobile ? "10px 14px" : "16px 24px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 22, color: "#8b0000", flexShrink: 0 }}>✠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 15 : 22,
            color: "#e0c070", fontWeight: 900, letterSpacing: 2, textTransform: "uppercase",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            Chaos Space Marines
          </h1>
          <div style={{ color: "#5a0000", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>Slaves to Darkness</div>
        </div>

        {/* Narrative mode toggle — only shown on Builder tab */}
        {activeTab === "builder" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ color: "#666", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>Narrative</span>
            <div
              onClick={() => setNarrativeMode((p) => !p)}
              style={{
                width: 44, height: 26, background: narrativeMode ? "#8b0000" : "#222",
                border: `1px solid ${narrativeMode ? "#cc2020" : "#444"}`,
                borderRadius: 13, cursor: "pointer", position: "relative",
                transition: "all 0.2s", flexShrink: 0, WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: narrativeMode ? 21 : 3,
                width: 18, height: 18, background: narrativeMode ? "#e0c070" : "#555",
                borderRadius: "50%", transition: "all 0.2s",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop top tab bar ── */}
      {!isMobile && (
        <div style={{ background: "#0f0000", borderBottom: "1px solid #2a0000", display: "flex" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "12px 28px", background: "none", border: "none",
                borderBottom: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`,
                color: activeTab === t.id ? "#e0c070" : "#666",
                cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13,
                letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s",
              }}
            >{t.label}</button>
          ))}
        </div>
      )}

      {/* ── Page content ── */}
      <div style={{ maxWidth: isMobile ? "100%" : 1100, margin: "0 auto", padding: isMobile ? "14px 12px" : "24px 16px" }}>
        {activeTab === "builder" && <ArmyBuilder narrativeMode={narrativeMode} />}
        {activeTab === "rules" && <RulesReference />}
        {activeTab === "narrative" && <NarrativeHub />}
      </div>

      {/* ── Desktop footer ── */}
      {!isMobile && (
        <div style={{ textAlign: "center", padding: 20, color: "#2a0000", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
          In the grim darkness of the far future, there is only war.
        </div>
      )}

      {/* ── Mobile bottom navigation bar ──
          Fixed to viewport bottom. Uses env(safe-area-inset-bottom) so it clears
          the iOS home indicator and Android gesture strip on notched devices. */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#0f0000", borderTop: "2px solid #8b0000",
          display: "flex", zIndex: 50,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "10px 4px", minHeight: 56,
                background: "none", border: "none",
                borderTop: `3px solid ${activeTab === t.id ? "#8b0000" : "transparent"}`,
                color: activeTab === t.id ? "#e0c070" : "#555",
                cursor: "pointer", transition: "all 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 10, marginTop: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
