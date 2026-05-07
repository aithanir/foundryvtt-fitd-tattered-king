# fitd-ttk-investigators

This module is primarily a content module.

It should define Item compendium packs for:

- classes
- abilities
- items

Use BitD system Item types:

- `class`
- `ability`
- `item`

Do not require `bitd-alternate-sheets`; recommend it only.

Playbook data should continue using BitD internal keys such as `hunt`, `study`, `skirmish`, etc., because `fitd-ttk-competencies` handles presentation labels.

## Source of truth

Authoritative source lives in:

- `modules/fitd-ttk-investigators/src`

Do not hand-edit:

- `modules/fitd-ttk-investigators/build`

Treat as generated deliverables:

- `modules/fitd-ttk-investigators/packs`

Legacy migration scratch space may exist under:

- `_unshipped/investigators-legacy-packs`
- `_unshipped/investigators-legacy-src`

Those are migration aids, not authoritative source.

## Authoring pipeline

The intended workflow is:

- YAML source
- generated Foundry document JSON
- `fvtt package pack`
- LevelDB compendium packs

Use:

- `pnpm run generate:investigators`
- `pnpm run pack:investigators`
- `pnpm run build:investigators`

`build/` is a build artifact and should stay out of git.

## Authoring format

Long-form text fields such as:

- `description`
- `experience_clues`
- `additional_info`

should be:

- plain text or light markdown
- never Foundry-authored HTML
- serialized as `|-` block scalars for consistency

For now, generated documents preserve plain text and markdown verbatim.

## Source file grouping

Use these authoring conventions:

- `src/classes/`: one YAML file per class
- `src/abilities/`: one YAML file per class, containing multiple abilities
- `src/items/`: grouped collections such as `common.yaml`

Use clean display names. Do not add BitD-style prefixes like `(A)` or `(C)`.

## Schema and validation expectations

Keep BitD internal keys in source data.

Validation should:

- preserve required string fields even if blank during migration/conversion
- report failing entry index, `id`, and `name` when possible
- reject unknown class references from abilities or items

## Class, ability, and item conventions

Class source currently targets simple fields such as:

- `name`
- `description`
- `experience_clues`
- `base_skills`
- `img`

Ability source starts simple:

- plain text description first
- reserve `automation`, `effects`, and `flags` for later enhancements

Item source uses BitD item fields such as:

- `load`
- `uses`
- `class`
- `description`
- optional custom authoring `tags`

## Icons

Use shared icon conventions:

- classes: `ttk-investigator-icon...`
- abilities: `ttk-ability-icon...`
- items: `ttk-item-icon...`

Do not invent one-off unique icons unless there is a clear use-case.

## Tooling and security

Repo JavaScript tooling uses ESLint flat config:

- `eslint.config.mjs`

Current CI/security work assumes:

- GitHub Actions
- Dependabot
- `pnpm audit`
- Trivy
- Gitleaks

Dependabot currently ignores major-version bumps for:

- `eslint`
- `eslint-config-prettier`

until that migration is chosen intentionally.
