# fitd-ttk-competencies

This module implements TTK competencies as a presentation/adapter layer over the existing BitD data model.

## Hard rule

Do not change stored actor data paths.

Keep:

- `system.attributes.insight.skills.hunt`
- `system.attributes.insight.skills.study`
- etc.

Relabel them only.

## Preferred seams

Look first at:

- `Actor.getComputedAttributes`
- `BladesHelpers.getRollLabel`
- `BladesHelpers.getAttributeLabel`
- Foundry i18n
- sheet render hooks
- CSS

Use `libWrapper` for wrappers when possible.

## Do not

- replace the whole BitD actor sheet
- replace the whole alternate sheet
- rewrite the roll system
- introduce new skill keys
- patch upstream files