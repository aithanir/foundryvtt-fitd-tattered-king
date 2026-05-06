# Developer Journal: Competency Label Adapter

`fitd-ttk-competencies` is a presentation adapter. It makes the Blades in the
Dark system look like Tattered King at the table, while keeping the upstream
BitD actor and item data model intact.

## Core Rule

BitD keys are canonical in code and data. TTK labels are presentation only.

Do not add new skill keys, migrate actor data paths, or write game logic against
TTK labels such as `Assault`, `Research`, or `Tradecraft`. Use the existing BitD
keys:

- Actor actions: `system.attributes.<attribute>.skills.<skill>.value`
- Class item starting skills: `system.base_skills.<skill>`
- Roll calls: BitD action or attribute keys such as `hunt`, `prowess`, `sway`

## Presentation Mapping

The label mapping is intentionally presentation-first. The BitD sheet order is
kept, and labels are assigned so the visible TTK competency grid reads well.

| BitD key   | TTK label   |
| ---------- | ----------- |
| `hunt`     | Assault     |
| `study`    | Fabricate   |
| `survey`   | Finesse     |
| `tinker`   | Maneuver    |
| `finesse`  | Esoteric    |
| `prowl`    | Medical     |
| `skirmish` | Research    |
| `wreck`    | Tradecraft  |
| `attune`   | Bureaucracy |
| `command`  | Influence   |
| `consort`  | Network     |
| `sway`     | Streetwise  |

| BitD attribute key | Sheet group label | Resistance label |
| ------------------ | ----------------- | ---------------- |
| `insight`          | Practicality      | Physique         |
| `prowess`          | Knowledge         | Insight          |
| `resolve`          | Interpersonal     | Composure        |

The group and resistance labels intentionally diverge. On actor sheets,
`insight` is shown as the Practicality group because that is where the
presentation grid needs those visible competencies. In resistance rolls,
`insight` displays as Physique.

## Current Adapter Seams

The module uses these extension points in `scripts/competencies.js`:

- `Actor.getComputedAttributes()` is wrapped to relabel actor sheet attribute
  data before rendering.
- `BladesHelpers.getRollLabel()` is wrapped so roll dialogs and chat cards use
  TTK competency or resistance labels.
- `BladesHelpers.getAttributeLabel()` is wrapped for helper consumers that ask
  for an action or group label.
- Render hooks update labels and tooltips that bypass computed actor data,
  especially `bitd-alternate-sheets` class item starting-skill grids.

Use `libWrapper` where it behaves cleanly. The static `BladesHelpers` methods
are directly guarded because the BitD system calls them through module-scoped
imports, and libWrapper can attribute those calls to the system package instead
of this module.

## Adding Code That Uses Competencies

When writing module code:

- Store and compare BitD keys, not TTK labels.
- Use TTK labels only at the final display boundary.
- Add new display text to `languages/en.json`.
- Keep mapping changes synchronized with root `AGENTS.md` and
  `refs/ttk-design/competencies-summary.md`.
- Prefer helper functions or i18n keys over duplicating mapping tables in new
  modules.

Good:

```js
const skillKey = 'skirmish';
const label = game.i18n.localize('FITD-TTK-COMPETENCIES.Skill.skirmish');
```

Avoid:

```js
const skillKey = 'Research';
```

## Manual Regression Checklist

After changing the adapter or mappings:

- Base actor sheet renders TTK group and competency labels.
- Alternate actor sheet renders TTK group and competency labels.
- Action roll dialogs and chat cards use TTK competency labels.
- Resistance roll dialogs and chat cards use TTK resistance labels.
- Class item sheets in editable compendiums show TTK starting-skill labels.
- Editing actor action dots still writes BitD actor paths.
- Editing class item starting skills still writes `system.base_skills.<bitd key>`.
- Behavior is the same with `lib-wrapper` enabled and disabled.
