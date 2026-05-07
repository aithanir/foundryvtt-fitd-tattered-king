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
- Use BitD internal action keys in `base_skills`.
- Put display grouping in `class`, not in the item or ability name.
- Put custom authoring tags in `tags`; the generator stores them in module
  flags for later automation.
- Start abilities as plain text. Use `automation`, `effects`, and `flags` later
  when we add richer support.
