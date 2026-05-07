import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import YAML from 'yaml';
const { Scalar, isMap, isScalar, isSeq } = YAML;

const DEFAULT_INPUT = '_unshipped/investigators-legacy-packs';
const DEFAULT_OUTPUT = '_unshipped/investigators-legacy-src';
const LONG_FORM_FIELDS = new Set(['description', 'experience_clues', 'additional_info']);
const REQUIRED_STRING_FIELDS = new Set(['description', 'experience_clues']);

const SKILL_KEYS = [
  'hunt',
  'study',
  'survey',
  'tinker',
  'finesse',
  'prowl',
  'skirmish',
  'wreck',
  'attune',
  'command',
  'consort',
  'sway',
];

async function main() {
  const inputRoot = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
  const outputRoot = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);

  const classes = await loadPack(path.join(inputRoot, 'classes'));
  const abilities = await loadPack(path.join(inputRoot, 'abilities'));
  const items = await loadPack(path.join(inputRoot, 'items'));

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(outputRoot, 'classes'), { recursive: true });
  await fs.mkdir(path.join(outputRoot, 'abilities'), { recursive: true });
  await fs.mkdir(path.join(outputRoot, 'items'), { recursive: true });

  for (const document of sortByName(classes)) {
    const source = classToSource(document);
    await writeYaml(path.join(outputRoot, 'classes', `${source.id}.yaml`), source);
  }

  const abilitiesByClass = groupBy(sortByName(abilities).map(abilityToSource), (entry) =>
    slugify(entry.class || 'general')
  );
  for (const [classId, entries] of sortEntries(abilitiesByClass)) {
    await writeYaml(path.join(outputRoot, 'abilities', `${classId}.yaml`), entries);
  }

  await writeYaml(
    path.join(outputRoot, 'items', 'common.yaml'),
    sortByName(items).map(itemToSource)
  );

  console.log(
    `fitd-ttk-investigators | Converted ${classes.length} classes, ${abilities.length} abilities, ${items.length} items to ${outputRoot}.`
  );
}

async function loadPack(directory) {
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  const documents = [];
  for (const file of files) {
    documents.push(JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')));
  }
  return documents;
}

function classToSource(document) {
  return omitEmpty({
    id: sourceId(document),
    name: document.name,
    img: document.img,
    description: normalizeRichText(document.system?.description ?? ''),
    experience_clues: normalizeRichText(document.system?.experience_clues ?? ''),
    base_skills: normalizeBaseSkills(document.system?.base_skills ?? {}),
    tags: sourceTags(document),
  });
}

function abilityToSource(document) {
  return omitEmpty({
    id: sourceId(document),
    class: document.system?.class ?? '',
    name: document.name,
    img: document.img,
    description: normalizeRichText(document.system?.description ?? ''),
    price: numberOrDefault(document.system?.price, 1),
    class_default: Boolean(document.system?.class_default),
    tags: sourceTags(document),
    automation: sourceAutomation(document),
  });
}

function itemToSource(document) {
  return omitEmpty({
    id: sourceId(document),
    name: document.name,
    img: document.img,
    description: normalizeRichText(document.system?.description ?? ''),
    load: numberOrDefault(document.system?.load, 0),
    uses: numberOrDefault(document.system?.uses, 1),
    class: document.system?.class ?? '',
    additional_info: normalizeRichText(document.system?.additional_info ?? ''),
    num_available: numberOrDefault(document.system?.num_available, 1),
    tags: sourceTags(document),
  });
}

function normalizeBaseSkills(baseSkills) {
  const normalized = {};
  for (const skill of SKILL_KEYS) {
    const value = baseSkills[skill];
    normalized[skill] = numberOrDefault(Array.isArray(value) ? value[0] : value, 0);
  }
  return normalized;
}

function sourceId(document) {
  return document.flags?.['fitd-ttk-investigators']?.sourceId ?? slugify(document.name);
}

function sourceTags(document) {
  return document.flags?.['fitd-ttk-investigators']?.tags ?? [];
}

function sourceAutomation(document) {
  return document.flags?.['fitd-ttk-investigators']?.automation ?? [];
}

function normalizeRichText(value) {
  if (!value) return '';

  const text = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?(p|div|section|article|blockquote)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<\/?(strong|b)[^>]*>/gi, '**')
    .replace(/<\/?(em|i)[^>]*>/gi, '_')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(text)
    .replace(/^-+\s*\n([^\n])/gm, '- $1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n- \n/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value) {
  const named = value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");

  return named
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function omitEmpty(source) {
  const cleaned = {};
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === '' && !REQUIRED_STRING_FIELDS.has(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function groupBy(entries, getKey) {
  const groups = new Map();
  for (const entry of entries) {
    const key = getKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
}

function sortEntries(map) {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sortByName(entries) {
  return [...entries].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function writeYaml(filePath, value) {
  const document = new YAML.Document(value);
  applyPreferredScalarStyles(document.contents);
  await fs.writeFile(filePath, `${document.toString({ lineWidth: 100 })}\n`);
}

function applyPreferredScalarStyles(node, parentKey = null) {
  if (!node) return;

  if (isMap(node)) {
    for (const item of node.items) {
      const key = isScalar(item.key) ? String(item.key.value) : null;
      applyPreferredScalarStyles(item.value, key);
    }
    return;
  }

  if (isSeq(node)) {
    for (const item of node.items) {
      applyPreferredScalarStyles(item, parentKey);
    }
    return;
  }

  if (
    isScalar(node) &&
    typeof node.value === 'string' &&
    parentKey &&
    LONG_FORM_FIELDS.has(parentKey)
  ) {
    node.type = Scalar.BLOCK_LITERAL;
  }
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
