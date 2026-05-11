import { ABILITIES_PACK, CLASSES_PACK, ITEMS_PACK, MODULE_ID } from '../shared.js';
import { sortAbilityList } from './ability-ordering.js';

export function filterAbilitiesForActor(abilities, actor) {
  return filterEntriesForActor(filterToInvestigatorAbilities(abilities), actor);
}

export function filterItemsForActor(items, actor) {
  return sortItemsForActor(filterEntriesForActor(filterToInvestigatorItems(items), actor), actor);
}

function filterEntriesForActor(entries, actor) {
  const actorClass = getActorClassName(actor);

  return entries.filter((item) => {
    const itemClass = normalizeClassName(item.system?.class);
    if (!itemClass) return true;
    if (!actorClass) return false;
    return itemClass === actorClass;
  });
}

function sortItemsForActor(items, actor) {
  const actorClass = getActorClassName(actor);

  return items.sort((a, b) => {
    return (
      compareNumbers(itemBucketForActor(a, actorClass), itemBucketForActor(b, actorClass)) ||
      normalizeItemName(a).localeCompare(normalizeItemName(b))
    );
  });
}

function itemBucketForActor(item, actorClass) {
  const itemClass = normalizeClassName(item.system?.class);
  return itemClass && itemClass === actorClass ? 0 : 1;
}

export function filterToInvestigatorAbilities(items) {
  return items.filter(isInvestigatorAbility);
}

export function filterToInvestigatorItems(items) {
  return items.filter(isInvestigatorItem);
}

export function filterToInvestigatorClasses(items) {
  return items.filter(isInvestigatorClass);
}

export async function getInvestigatorAbilities() {
  return getInvestigatorEntries('ability', ABILITIES_PACK);
}

export async function getInvestigatorItems() {
  return getInvestigatorEntries('item', ITEMS_PACK);
}

async function getInvestigatorEntries(type, packId) {
  const packItems = await getInvestigatorPackEntries(type, packId);
  const worldItems = game.items.filter(
    (item) => item.type === type && isFromInvestigatorPack(item, packId)
  );
  const items = worldItems.concat(packItems);

  return type === 'ability'
    ? sortAbilityList(items)
    : items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getInvestigatorPackEntries(type, packId) {
  const pack = game.packs.get(packId);
  if (!pack) return [];

  const documents = await pack.getDocuments();
  return documents.filter((item) => item.type === type);
}

export function isInvestigatorAbility(item) {
  return isFromInvestigatorPack(item, ABILITIES_PACK);
}

export function isInvestigatorItem(item) {
  return isFromInvestigatorPack(item, ITEMS_PACK);
}

export function isInvestigatorClass(item) {
  return item?.type === 'class' && isFromInvestigatorPack(item, CLASSES_PACK);
}

export async function isInvestigatorClassCandidate(item) {
  if (isInvestigatorClass(item)) return true;
  if (item?.type !== 'class') return false;

  const classes = await getInvestigatorPackEntries('class', CLASSES_PACK);
  return classes.some((classItem) => classItem.id === item.id || classItem.name === item.name);
}

export function isInvestigatorActor(actor) {
  return actor?.type === 'character' && actor.items?.some((item) => isInvestigatorClass(item));
}

function isFromInvestigatorPack(item, packId) {
  if (item?.pack === packId) return true;
  if (item?.compendium?.collection === packId) return true;

  const sourceId = item?.flags?.core?.sourceId;
  if (typeof sourceId === 'string' && sourceId.startsWith(`Compendium.${packId}.`)) {
    return true;
  }

  return Boolean(item?.flags?.[MODULE_ID]?.sourceId);
}

export function getActorClassName(actor) {
  const classItem = actor?.items?.find((item) => item.type === 'class');
  return normalizeClassName(classItem?.name ?? actor?.system?.playbook);
}

export function normalizeClassName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeItemName(item) {
  return String(item?.name ?? '').trim();
}

function compareNumbers(a, b) {
  return a === b ? 0 : a - b;
}
