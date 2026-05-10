# AGENTS.md

## Repo purpose

This repo contains multiple Foundry VTT v14 modules for a Forged in the Dark investigative horror game.

## Repo layout

- `modules/fitd-ttk-competencies`: labels/adapters for custom competencies
- `modules/fitd-ttk-playbooks`: playbook/class and ability compendium content
- `modules/fitd-ttk-harm-cards`: harm card content and optional support

## Supported stack

- Foundry VTT v14
- System: `blades-in-the-dark`
- Optional/recommended: `bitd-alternate-sheets`
- Optional/recommended for wrappers: `lib-wrapper`

## Architecture rule

Extend, do not fork.

Do not modify upstream packages. Do not replace whole actor sheets or roll engines unless explicitly requested.

Prefer:

- Foundry hooks
- i18n
- compendium packs
- small adapter functions
- `libWrapper` wrappers
- defensive render hooks
- CSS

Avoid:

- schema changes
- new skill keys
- copied upstream source
- brittle DOM patches
- hard dependencies on optional modules unless unavoidable

## Competency policy

Keep BitD internal keys.

Presentation mapping:

- `hunt` → Assault
- `study` → Fabricate
- `survey` → Finesse
- `tinker` → Maneuver
- `finesse` → Esoteric
- `prowl` → Medical
- `skirmish` → Research
- `wreck` → Tradecraft
- `attune` → Bureaucracy
- `command` → Influence
- `consort` → Network
- `sway` → Streetwise

Columns:

- `insight` → Practicality group / Physique resistance
- `prowess` → Knowledge group / Insight resistance
- `resolve` → Interpersonal group / Composure resistance

## External references

If available locally, inspect:

- `upstream/foundryvtt-blades-in-the-dark`
- `upstream/foundry-bitd-alternate-sheets`
- `refs/foundry-v14-notes`
- `refs/ttk-design-docs`

If those folders are absent, ask the user before making assumptions about upstream internals.

## Done means

For code changes, provide:

- changed files summary
- manual Foundry test checklist
- compatibility notes
