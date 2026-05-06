# AGENTS.md

## Project

This workspace contains Foundry VTT v14 modules for a Forged in the Dark investigative horror game.

The current supported stack is:

- Foundry VTT v14
- System: `blades-in-the-dark` by Dez384
- Optional sheet module: `bitd-alternate-sheets` by justinross
- Preferred extension style: modules, compendia, wrappers, hooks, settings, and CSS
- Avoid forks unless explicitly requested

## Core design goal

Do not modify upstream packages directly.

Treat these as read-only references unless the user explicitly asks for an upstream contribution:

- `upstream/foundryvtt-blades-in-the-dark`
- `upstream/foundry-bitd-alternate-sheets`

The modules in `modules/` should extend or adapt the upstream packages while preserving compatibility with future upstream updates.

## Important project modules

- `modules/fitd-ttk-case-files`: case file content and workflows tools
- `modules/fitd-ttk-competencies`: presentation layer for custom competencies
- `modules/fitd-ttk-investigators`: content packs for classes/playbooks and abilities
- `modules/fitd-ttk-harm`: harm card content and optional workflow tools

## TTK competency mapping

Keep the BitD internal actor data keys. Do not introduce new skill keys unless explicitly asked.

Use this presentation mapping:

- `hunt` → Tradecraft
- `study` → Research
- `survey` → Medical
- `tinker` → Esoteric

- `finesse` → Finesse
- `prowl` → Maneuver
- `skirmish` → Assault
- `wreck` → Fabricate

- `attune` → Bureaucracy
- `command` → Influence
- `consort` → Network
- `sway` → Streetwise

Attribute/group mapping:

- `insight` column → Knowledge competency group; Insight resistance trait
- `prowess` column → Practicality competency group; Physique resistance trait
- `resolve` column → Interpersonal competency group; Composure resistance trait

## Architecture rules

Prefer:

- `Hooks`
- `libWrapper` wrappers where available
- Foundry settings
- i18n labels
- small adapter functions
- defensive DOM enhancement only when needed
- compendium packs for authored content

Avoid:

- editing upstream source
- replacing entire actor sheets
- replacing entire roll engines
- changing actor data schema
- changing BitD item schema
- hardcoding against fragile DOM unless no better seam exists
- adding new dependencies without asking

## Foundry module conventions

Target Foundry v14.

Use `module.json` with:

- `id`
- `title`
- `version`
- `compatibility`
- `relationships`
- `esmodules`
- `styles`
- `languages`
- `packs` where relevant

For Item compendium packs, include:

- `type: "Item"`
- `system: "blades-in-the-dark"`

## Testing expectations

When changing code, provide a short manual test checklist.

Important test cases:

- base BitD character sheet renders
- alternate sheet renders, if active
- competency labels appear
- resistance labels appear
- competency roll still works
- resistance roll still works
- class/playbook drag-drop still works
- disabling `bitd-alternate-sheets` does not break the module
- disabling `fitd-ttk-competencies` restores normal BitD labels

## Coding style

Use plain JavaScript ES modules.

Prefer small files:

- `mapping.js`
- `labels.js`
- `hooks.js`
- `settings.js`
- `validation.js`

Do not over-engineer.

Use defensive guards around optional APIs and optional modules.

## Rules design guidance

The VTT should support:

- memory
- presentation
- persistence
- reuse
- light workflow support

It should not replace:

- GM judgment
- position/effect adjudication
- fictional interpretation
- mystery ambiguity
- dramatic framing