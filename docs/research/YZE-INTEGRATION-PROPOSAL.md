# 5 Ways to Integrate Year Zero Engine Concepts in Espaciokoop Lagunak (Standalone-First)

## Principle Reminder
Espaciokoop Lagunak core must remain functional without any external dependencies. Integrations must be optional adapters that depend on the core, not vice versa.

## Proposed Integration Approaches

### 1. Attribute System Inspiration (Category A: Pure Inspiration)
**Concept**: Adapt YZE's four-attribute model (Strength, Agility, Wits, Empathy) as inspiration for Espaciokoop's attribute system.
**Implementation**:
- Study how YZE balances broad attributes with skills/specialties
- Create Espaciokoop's own attribute system inspired by the concept but with different names/scales
- Example: Replace with "Might, Finesse, Insight, Rapport" or similar thematic attributes
- **Standalone Check**: Core uses only Espaciokoop-defined attributes; no YZE references in core code

### 2. Push Mechanic as Optional Rule Module (Category C: Optional Adapter)
**Concept**: Implement YZE's "push" mechanic (re-roll with cost) as an optional rules module.
**Implementation**:
- Core: Basic success/failure roll system (attribute + skill vs threshold)
- Optional Module: "yrze-push-adapter" that adds:
  - Push action: Re-roll failed dice at cost of 1 stress/damage
  - Stress tracking system (integrates with existing stress mechanics if present)
  - Configuration to enable/disable per campaign
- **Standalone Check**: Core roll system works without module; module imports core but core doesn't import module

### 3. Time Measurement System (Category B: Licensed Reference)
**Concept**: Adapt YZE's time units (Round/Stretch/Shift) with proper attribution.
**Implementation**:
- Core: Generic time tracking system (turns, phases, periods)
- Documentation: Reference YZE as inspiration with proper FTL attribution
- Optional: Provide YZE-aligned time tracking as separate configuration
- Attribution Example: "Time measurement concepts inspired by Year Zero Engine (used under Free League Free Tabletop License)"
- **Standalone Check**: Core time system functions independently; documentation references are for clarity only

### 4. Camp/Mishap System as Foundry VTT Module (Category C: Optional Adapter)
**Concept**: Create a Foundry VTT module that adds YZE-style camp mechanics and mishaps.
**Implementation**:
- Core: Basic rest/recovery system
- Foundry Module: "espaciokoop-adapter-yze-camp" that adds:
  - Camp phase management
  - Random mishap table (food spoilage, flooding, fire, etc.)
  - Stress/condition tracking from mishaps
  - Gear loss/breakage mechanics
- **Standalone Check**: Core game playable without Foundry or module; module requires both

### 5. Dice Pool System as Alternative Resolution (Category C: Optional Adapter)
**Concept**: Offer YZE's dice pool system as an optional dice resolution method.
**Implementation**:
- Core: Default resolution system (single die, card draw, etc.)
- Optional Adapter: "yrze-dice-pool" providing:
  - Dice pool builder (attribute + skill = d6s)
  - Success counting (rolls of 6)
  - Push mechanics integration
  - Configuration to select resolution system per game
- **Standalone Check**: Core resolution works with default system; adapter provides alternative

## Implementation Guidelines
1. **Isolation**: All YZE-specific code lives in `src/adapters/yrze-*` or similar
2. **Dependency Flow**: `core` → `adapter` (never reverse)
3. **Configuration**: Feature flags to enable/disable adapters
4. **Attribution**: Proper FTL credit in documentation/UI when used
5. **Testing**: Adapters tested in isolation; core tested without adapters
6. **Updates**: Follow FTL version changes (check for new SRD/license versions)

## Files to Create/Modify
- `docs/research/YZE-Research.md` (created)
- `docs/ADAPTERS.md` - Document adapter pattern
- `src/adapters/yrze-attributes/` - Attribute inspiration implementation
- `src/adapters/yrze-push/` - Push mechanic module
- `src/adapters/yrze-time/` - Time measurement reference
- `src/adapters/yrze-camp-foundry/` - Foundry VTT camp module
- `src/adapters/yrze-dice/` - Dice pool resolution system
- `package.json` - Add adapter dependencies as optional
- `README.md` - Document standalone principle and adapter usage

## Verification Checklist
[ ] Core game runs and is playable without any YZE adapters installed
[ ] Each adapter can be enabled/disabled independently
[ ] No YZE imports in core/src/
[ ] Proper attribution where YZE concepts are used
[ ] Adapters follow existing Espaciokoop patterns
[ ] Documentation explains standalone-first approach