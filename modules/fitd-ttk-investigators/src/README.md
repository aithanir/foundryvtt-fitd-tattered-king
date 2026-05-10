# TTK Investigator Pack Source

This directory is the authoring source of truth for `fitd-ttk-investigators`.

Author content in YAML, then generate Foundry document JSON:

```bash
pnpm run generate:investigators
```

Pack generated JSON into LevelDB compendia:

```bash
pnpm run pack:investigators
```

The generated JSON in `build/packs` and the LevelDB packs in `packs` are build
artifacts. Do not hand-edit generated pack output unless you intend to unpack or
port those changes back into `src`.

## Rules

- Use clean display names. Do not add BitD-style prefixes such as `(A)` or
  `(C)`.
- Use either all BitD internal action keys or all lower-case TTK labels in
  `base_skills`. Do not mix key sets; `finesse` is ambiguous because it is both
  a BitD key and a TTK label.
- Generated Foundry documents always use BitD internal action keys in
  `system.base_skills` and active effect paths.
- Put display grouping in `class`, not in the item or ability name. For item
  YAML, the generator infers `class` from class-specific source filenames such
  as `items/academic.yaml`; `items/common.yaml` stays unclassed/general.
- Put custom authoring tags in `tags`; the generator stores them in module
  flags for later automation.
- Author abilities in their intended class presentation order. The generator
  stores that order as a module `sequence` flag; add an explicit `sequence`
  field only when an ability needs to sort somewhere other than its YAML
  position.
- Author `description`, `experience_clues`, and `additional_info` as plain text
  or light markdown.
- Always serialize long-form text fields such as `description`,
  `experience_clues`, and `additional_info` as `|-` block scalars for
  consistency.
- Do not author Foundry editor HTML in `src`. Legacy HTML belongs in migration
  input only.
- For now, the generator preserves plain text and markdown verbatim in the
  generated documents.
- Start abilities as plain text. Use `automation`, `effects`, and `flags`
  later when we add richer support.
