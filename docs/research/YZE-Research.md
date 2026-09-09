# Year Zero Engine Research for Espaciokoop Lagunak

## Overview
The Year Zero Engine (YZE) is a modular tabletop RPG system created by Free League Publishing, used in games like Mutant: Year Zero, Tales from the Loop, Forbidden Lands, etc.

## Key Features from SRD
- **Accessible**: Easy to learn, complexity added incrementally
- **Fast and Decisive**: Minimizes non-action dice rolling/bookkeeping
- **Risks & Rewards**: Push mechanics (re-roll with cost)
- **Player-Centric**: Focus on player characters as protagonists
- **Story Driven**: Designed for dramatic, memorable moments
- **Adaptable**: Modular skills/talents as building blocks
- **Dice Pools vs Step Dice**: Two main versions (D6 pools or polyhedral step dice)
- **Tools**: Character sheets, dice, custom cards, time measurement (Round/Stretch/Shift)
- **Safety**: Emphasis on player consent and comfort

## Core Mechanics
1. **Attributes**: Strength, Agility, Wits, Empathy (1-5 scale in dice pool version)
2. **Skills**: Broad capabilities with specialties
3. **Dice Pool**: Roll attribute + skill dice (d6s), count 6s as successes
4. **Pushing**: Re-roll non-6 dice for cost (typically damage/stress)
5. **Combat**: Quick, deadly, uses initiative (sometimes via cards)
6. **Time**: Round (5-10s combat), Stretch (5-10min exploration), Shift (5-10h travel)
7. **Camp Mechanics**: Rest, sleep, exploration, hazards (mishaps table)
8. **Gear & Resources**: Tracking, crafting, condition tracking

## License Analysis (Free Tabletop License v1.1)

Fuente: [Year Zero Engine License Agreement, version 1.1](https://freeleaguepublishing.com/wp-content/uploads/2026/03/Year-Zero-Engine-License-Agreement-version-1.1.pdf) (PDF oficial de Free League Publishing).

- **Permitted**: Copy, use, modify, translate, distribute YZE SRD in print, PDF, or VTT module as part of your own game (clause 1)
- **Explicitly excluded**: clause 1 does **not** cover video games. Espaciokoop Lagunak's core (SeriousProton/C++ engine) is a video game, so it cannot claim FTL coverage — only an eventual Foundry/VTT module could, see `docs/research/YZE-INTEGRATION-PROPOSAL.md`
- **Prohibited**: 
  - Using other Free League artwork/text/materials not in SRD
  - Using Free League brands/logos (except logo with conditions)
  - Stating/impliying Free League endorsement/sponsorship/affiliation
- **Requirements**:
  - Include notice: "This game is not affiliated with, sponsored, or endorsed by Fria Ligan AB. The Year Zero Engine System Reference Document is used under Fria Ligan AB’s Free Tabletop License."
  - Include copy/link to license with each publication
  - Clearly state if using generative AI tools
- **Ownership**: 
  - Free League owns YZE SRD
  - You own your Game made under license
  - Free League can independently create similar works (not prohibited unless knowing copying)
- **AI Restriction**: Must disclose generative AI use in supplement
- **Termination**: License terminates automatically if breach terms

## Compatibility with Espaciokoop Lagunak Standalone-First Principle

See `docs/research/YZE-INTEGRATION-PROPOSAL.md` for the full breakdown after
the FTL-1.1 video-game exclusion review (PR #860):

- ✅ **Category A — abstract inspiration** (no SRD text/terminology copied):
  allowed in the video game core, not covered by or subject to the FTL.
- ✅ **Category B — Foundry/VTT module using the SRD as-is**: covered by
  clause 1 of the FTL, but only outside the video game core, as a separate
  Foundry integration with its own attribution.
- ❌ **Adapters inside `src/` claiming FTL coverage**: not viable — clause 1
  explicitly excludes video games, so this path was dropped from the proposal.

## Risk Assessment: Medium
- Need to comply with FTL attribution/notice requirements (Category B only)
- Cannot use Free League IP outside SRD (artwork, specific game settings, logos beyond permitted use)
- Must not imply endorsement
- Generative AI use requires disclosure
- Cannot claim FTL coverage for the video game core (clause 1 excludes video games)
