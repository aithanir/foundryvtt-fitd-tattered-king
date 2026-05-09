import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import Ajv from 'ajv';
import YAML from 'yaml';

const MODULE_ID = 'fitd-ttk-investigators';
const MODULE_DIR = path.resolve('modules', MODULE_ID);
const SRC_DIR = path.join(MODULE_DIR, 'src');
const BUILD_DIR = path.join(MODULE_DIR, 'build', 'packs');
const COMMON_ITEMS_FILE_ID = 'common';

const SKILL_ATTRIBUTE = {
  hunt: 'insight',
  study: 'insight',
  survey: 'insight',
  tinker: 'insight',
  finesse: 'prowess',
  prowl: 'prowess',
  skirmish: 'prowess',
  wreck: 'prowess',
  attune: 'resolve',
  command: 'resolve',
  consort: 'resolve',
  sway: 'resolve',
};

const TTK_SKILL_TO_BITD_SKILL = {
  assault: 'hunt',
  fabricate: 'study',
  finesse: 'survey',
  maneuver: 'tinker',
  esoteric: 'finesse',
  medical: 'prowl',
  research: 'skirmish',
  tradecraft: 'wreck',
  bureaucracy: 'attune',
  influence: 'command',
  network: 'consort',
  streetwise: 'sway',
};

const BITD_SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE);
const TTK_SKILL_KEYS = Object.keys(TTK_SKILL_TO_BITD_SKILL);

const DEFAULT_ABILITY_ICON =
  'modules/fitd-ttk-investigators/styles/assets/icons/ttk-ability-icon.default.png';
const DEFAULT_ITEM_ICON =
  'modules/fitd-ttk-investigators/styles/assets/icons/ttk-item-icon.default.png';

async function main() {
  const schemas = await loadSchemas();
  const classes = (
    await loadYamlDocuments(path.join(SRC_DIR, 'classes'), schemas.class, 'class')
  ).map(normalizeClassSource);
  const abilities = await loadYamlDocuments(
    path.join(SRC_DIR, 'abilities'),
    schemas.ability,
    'ability'
  );
  const items = await loadItemDocuments(schemas.item, classes);

  validateCrossReferences(classes, abilities, items);

  await resetBuildOutput();
  await writeDocuments('classes', classes.map(buildClassDocument));
  await writeDocuments('abilities', abilities.map(buildAbilityDocument));
  await writeDocuments('items', items.map(buildItemDocument));

  console.log(
    `${MODULE_ID} | Generated ${classes.length} classes, ${abilities.length} abilities, ${items.length} items.`
  );
}

function normalizeClassSource(source) {
  return {
    ...source,
    base_skills: normalizeBaseSkills(source),
  };
}

function normalizeBaseSkills(source) {
  const skillKeys = Object.keys(source.base_skills);
  const keySet = resolveBaseSkillKeySet(skillKeys, source);

  if (keySet === 'bitd') {
    return source.base_skills;
  }

  return Object.fromEntries(
    Object.entries(source.base_skills).map(([skill, value]) => [
      TTK_SKILL_TO_BITD_SKILL[skill],
      value,
    ])
  );
}

function resolveBaseSkillKeySet(skillKeys, source) {
  const hasOnlyBitdKeys = hasExactKeys(skillKeys, BITD_SKILL_KEYS);
  const hasOnlyTtkKeys = hasExactKeys(skillKeys, TTK_SKILL_KEYS);

  if (hasOnlyBitdKeys) return 'bitd';
  if (hasOnlyTtkKeys) return 'ttk';

  throw new Error(
    `Class "${source.name}" base_skills must use either all BitD keys or all lower-case TTK labels. Do not mix key sets.`
  );
}

function hasExactKeys(actualKeys, expectedKeys) {
  if (actualKeys.length !== expectedKeys.length) return false;
  const actual = new Set(actualKeys);
  return expectedKeys.every((key) => actual.has(key));
}

async function loadSchemas() {
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  return {
    class: ajv.compile(await readJson(path.join(SRC_DIR, 'schemas', 'class.schema.json'))),
    ability: ajv.compile(await readJson(path.join(SRC_DIR, 'schemas', 'ability.schema.json'))),
    item: ajv.compile(await readJson(path.join(SRC_DIR, 'schemas', 'item.schema.json'))),
  };
}

async function loadYamlDocuments(directory, validate, label, normalize = (entry) => entry) {
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.yaml')).sort();
  const documents = [];

  for (const file of files) {
    const filePath = path.join(directory, file);
    const fileId = path.basename(file, '.yaml');
    const parsed = YAML.parse(await fs.readFile(filePath, 'utf8'));
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    for (const [index, entry] of entries.entries()) {
      const valid = validate(entry);
      if (!valid) {
        const errors = validate.errors
          .map((error) => `${error.instancePath || '/'} ${error.message}`)
          .join('; ');
        const entryLabel = formatEntryLabel(entry, index);
        throw new Error(`${label} source ${filePath} ${entryLabel} failed validation: ${errors}`);
      }
      documents.push(normalize(entry, { file, fileId, filePath, index }));
    }
  }

  assertUnique(documents, 'id', label);
  return documents;
}

async function loadItemDocuments(validate, classes) {
  const classNameById = new Map(classes.map((entry) => [entry.id, entry.name]));
  return loadYamlDocuments(path.join(SRC_DIR, 'items'), validate, 'item', (entry, context) =>
    normalizeItemSource(entry, context.fileId, classNameById)
  );
}

function normalizeItemSource(source, fileId, classNameById) {
  if (source.class || fileId === COMMON_ITEMS_FILE_ID) {
    return source;
  }

  const className = classNameById.get(fileId);
  if (!className) {
    throw new Error(
      `Item source file "${fileId}.yaml" does not match a class id. Add the file to common.yaml or create a matching class source.`
    );
  }

  return {
    ...source,
    class: className,
  };
}

function formatEntryLabel(entry, index) {
  const parts = [`entry ${index + 1}`];
  if (entry?.id) parts.push(`id "${entry.id}"`);
  if (entry?.name) parts.push(`name "${entry.name}"`);
  return `(${parts.join(', ')})`;
}

function validateCrossReferences(classes, abilities, items) {
  const classNames = new Set(classes.map((entry) => entry.name));

  for (const ability of abilities) {
    if (!classNames.has(ability.class)) {
      throw new Error(`Ability "${ability.name}" references unknown class "${ability.class}".`);
    }
  }

  for (const item of items) {
    if (item.class && !classNames.has(item.class)) {
      throw new Error(`Item "${item.name}" references unknown class "${item.class}".`);
    }
  }

  assertUnique(classes, 'name', 'class');
  assertUnique(items, 'name', 'item');
}

function buildClassDocument(source, index) {
  const id = documentId(`class:${source.id}`);
  const baseSkills = Object.fromEntries(
    Object.entries(source.base_skills).map(([skill, value]) => [skill, String(value)])
  );

  return withKey('items', {
    _id: id,
    name: source.name,
    type: 'class',
    img: source.img,
    system: {
      description: source.description,
      logic: '',
      experience_clues: source.experience_clues,
      base_skills: baseSkills,
    },
    effects: buildClassEffects(source, id),
    folder: null,
    sort: sortValue(index),
    flags: buildFlags(source),
    ownership: { default: 0 },
    _stats: buildStats(),
  });
}

function buildClassEffects(source, itemId) {
  const origin = `Compendium.${MODULE_ID}.class.${itemId}`;
  const playbookChanges = [
    {
      key: 'system.playbook',
      value: source.name,
      priority: null,
      type: 'override',
    },
    {
      key: 'system.experience_clues',
      value: source.experience_clues,
      priority: null,
      type: 'add',
    },
  ];

  if (source.acquaintances_label) {
    playbookChanges.push({
      key: 'system.acquaintances_label',
      value: source.acquaintances_label,
      priority: null,
      type: 'override',
    });
  }

  const ratingChanges = Object.entries(source.base_skills)
    .filter(([, value]) => Number(value) > 0)
    .map(([skill, value]) => ({
      key: `system.attributes.${SKILL_ATTRIBUTE[skill]}.skills.${skill}.min`,
      value: Number(value),
      priority: null,
      type: 'add',
    }));

  return [
    buildTransferEffect({
      id: documentId(`class-effect:${source.id}:playbook`),
      name: `${source.name} Playbook`,
      origin,
      changes: playbookChanges,
    }),
    buildTransferEffect({
      id: documentId(`class-effect:${source.id}:ratings`),
      name: `${source.name} Starting Ratings`,
      origin,
      changes: ratingChanges,
    }),
  ].filter((effect) => effect.system.changes.length > 0);
}

function buildAbilityDocument(source, index) {
  return withKey('items', {
    _id: documentId(`ability:${source.id}`),
    name: source.name,
    type: 'ability',
    img: source.img ?? DEFAULT_ABILITY_ICON,
    system: {
      description: source.description,
      class: source.class,
      price: String(source.price ?? 1),
      purchased: false,
      class_default: Boolean(source.class_default),
      logic: '',
    },
    effects: source.effects ?? [],
    folder: null,
    sort: sortValue(index),
    flags: buildFlags(source, {
      automation: source.automation ?? [],
      ...(source.flags ?? {}),
    }),
    ownership: { default: 0 },
    _stats: buildStats(),
  });
}

function buildItemDocument(source, index) {
  return withKey('items', {
    _id: documentId(`item:${source.id}`),
    name: source.name,
    type: 'item',
    img: source.img ?? DEFAULT_ITEM_ICON,
    system: {
      description: source.description,
      logic: '',
      class: source.class ?? '',
      load: String(source.load),
      uses: String(source.uses ?? 1),
      additional_info: source.additional_info ?? '',
      equipped: false,
      num_available: String(source.num_available ?? 1),
    },
    effects: [],
    folder: null,
    sort: sortValue(index),
    flags: buildFlags(source),
    ownership: { default: 0 },
    _stats: buildStats(),
  });
}

function buildTransferEffect({ id, name, origin, changes }) {
  return {
    _id: id,
    name,
    img: 'systems/blades-in-the-dark/styles/assets/icons/Icon.3_13.png',
    origin,
    duration: {
      value: null,
      units: 'seconds',
      expiry: null,
      expired: false,
    },
    disabled: false,
    type: 'base',
    system: { changes },
    description: '',
    tint: '#ffffff',
    transfer: true,
    statuses: [],
    sort: 0,
    flags: {},
    _stats: buildStats(),
    start: null,
    showIcon: 1,
    folder: null,
    _key: `!items.effects!${origin.split('.').at(-1)}.${id}`,
  };
}

function buildFlags(source, extra = {}) {
  return {
    [MODULE_ID]: {
      sourceId: source.id,
      tags: source.tags ?? [],
      ...extra,
    },
  };
}

function buildStats() {
  return {
    coreVersion: '14.360',
    systemId: 'blades-in-the-dark',
    systemVersion: '6.1.1',
    createdTime: null,
    modifiedTime: null,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null,
  };
}

async function writeDocuments(packName, documents) {
  const outDir = path.join(BUILD_DIR, packName);
  await fs.mkdir(outDir, { recursive: true });

  for (const document of documents) {
    const fileName = `${slugify(document.name)}_${document._id}.json`;
    await fs.writeFile(path.join(outDir, fileName), `${JSON.stringify(document, null, 2)}\n`);
  }
}

async function resetBuildOutput() {
  await fs.rm(BUILD_DIR, { recursive: true, force: true });
  await fs.mkdir(BUILD_DIR, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function withKey(collection, document) {
  return {
    ...document,
    _key: `!${collection}!${document._id}`,
  };
}

function documentId(value) {
  const digest = crypto.createHash('sha256').update(value).digest('base64url');
  return digest.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

function sortValue(index) {
  return (index + 1) * 100000;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function assertUnique(entries, key, label) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[key])) {
      throw new Error(`Duplicate ${label} ${key}: ${entry[key]}`);
    }
    seen.add(entry[key]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
