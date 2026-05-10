import { BladesHelpers } from '../../../systems/blades-in-the-dark/module/blades-helpers.js';
import { BladesActorSheet } from '../../../systems/blades-in-the-dark/module/blades-actor-sheet.js';
import { BladesSheet } from '../../../systems/blades-in-the-dark/module/blades-sheet.js';

const MODULE_ID = 'fitd-ttk-investigators';
const ABILITIES_PACK = `${MODULE_ID}.ability`;
const CLASSES_PACK = `${MODULE_ID}.class`;
const ITEMS_PACK = `${MODULE_ID}.item`;

let addContext = null;

Hooks.once('ready', async () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  registerBaseSheetAbilityOrdering();
  registerBaseSheetItemFilters();
  await registerAlternateSheetItemFilters();
  await registerAlternateSheetAbilityOrdering();
  await registerAlternateSheetClassDropFix();
});

function registerBaseSheetAbilityOrdering() {
  wrapMethod(BladesActorSheet.prototype, 'getData', async function (wrapped, ...args) {
    const sheetData = await wrapped(...args);
    sortOwnedAbilitySlots(sheetData?.items);
    return sheetData;
  });
}

function registerBaseSheetItemFilters() {
  wrapMethod(BladesSheet.prototype, '_onItemAddClick', function (wrapped, event, ...args) {
    const itemType = event?.currentTarget?.dataset?.itemType;
    if (!['ability', 'item'].includes(itemType) || this.actor?.type !== 'character') {
      return wrapped(event, ...args);
    }

    return withAddContext({ actor: this.actor, itemType }, () => wrapped(event, ...args));
  });

  wrapMethod(BladesHelpers, 'getAllItemsByType', async function (wrapped, itemType, ...args) {
    const items = await wrapped(itemType, ...args);
    if (itemType === 'class') return filterToInvestigatorClasses(items);
    if (itemType === 'ability') {
      return addContext?.itemType === 'ability'
        ? filterAbilitiesForActor(items, addContext.actor)
        : filterToInvestigatorAbilities(items);
    }
    if (itemType !== 'item') return items;

    if (addContext?.itemType === 'item') {
      return filterItemsForActor(items, addContext.actor);
    }

    return filterToInvestigatorItems(items);
  });
}

async function registerAlternateSheetItemFilters() {
  if (!game.modules.get('bitd-alternate-sheets')?.active) return;

  const { Utils } = await import('../../bitd-alternate-sheets/scripts/utils.js');
  wrapMethod(Utils, 'getSourcedItemsByType', async function (wrapped, itemType, ...args) {
    if (itemType === 'ability') {
      return getInvestigatorAbilities();
    }

    if (itemType === 'item') {
      return getInvestigatorItems();
    }

    return wrapped(itemType, ...args);
  });
}

async function registerAlternateSheetAbilityOrdering() {
  if (!game.modules.get('bitd-alternate-sheets')?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');

  wrapMethod(BladesAlternateActorSheet.prototype, 'getData', async function (wrapped, ...args) {
    const sheetData = await wrapped(...args);
    sortAbilityList(sheetData?.available_playbook_abilities);
    return sheetData;
  });
}

async function registerAlternateSheetClassDropFix() {
  if (!game.modules.get('bitd-alternate-sheets')?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');

  wrapMethod(
    BladesAlternateActorSheet.prototype,
    'switchPlaybook',
    async function (wrapped, newPlaybookItem, ...args) {
      await wrapped(newPlaybookItem, ...args);

      if (!isInvestigatorClass(newPlaybookItem)) return;
      await ensureActorClass(this.actor, newPlaybookItem);
      await updateActorIconFromClass(this.actor, newPlaybookItem);
    }
  );
}

async function withAddContext(context, callback) {
  const previousContext = addContext;
  addContext = context;

  try {
    return await callback();
  } finally {
    addContext = previousContext;
  }
}

async function ensureActorClass(actor, classItem) {
  if (actor?.type !== 'character' || !actor.isOwner) return;

  const existingClassIds = actor.items
    .filter((item) => item.type === 'class')
    .map((item) => item.id);
  if (existingClassIds.length > 0) {
    await actor.deleteEmbeddedDocuments('Item', existingClassIds);
  }

  const classData = classItem.toObject();
  delete classData._id;
  await actor.createEmbeddedDocuments('Item', [classData]);
}

async function updateActorIconFromClass(actor, classItem) {
  const classIcon = classItem.img;
  if (!isInvestigatorClassIcon(classIcon)) return;
  if (!canReplaceActorIcon(actor.img)) return;
  if (actor.img === classIcon) return;

  await actor.update({ img: classIcon });
}

function filterAbilitiesForActor(abilities, actor) {
  return filterEntriesForActor(filterToInvestigatorAbilities(abilities), actor);
}

function filterItemsForActor(items, actor) {
  return filterEntriesForActor(filterToInvestigatorItems(items), actor);
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

function filterToInvestigatorAbilities(items) {
  return items.filter(isInvestigatorAbility);
}

function filterToInvestigatorItems(items) {
  return items.filter(isInvestigatorItem);
}

function filterToInvestigatorClasses(items) {
  return items.filter(isInvestigatorClass);
}

async function getInvestigatorAbilities() {
  return getInvestigatorEntries('ability', ABILITIES_PACK);
}

async function getInvestigatorItems() {
  return getInvestigatorEntries('item', ITEMS_PACK);
}

async function getInvestigatorEntries(type, packId) {
  const packItems = await getInvestigatorPackEntries(type, packId);
  const worldItems = game.items.filter(
    (item) => item.type === type && isFromInvestigatorPack(item, packId)
  );
  const items = worldItems.concat(packItems);

  return type === 'ability' ? sortAbilityList(items) : items.sort((a, b) => a.name.localeCompare(b.name));
}

async function getInvestigatorPackEntries(type, packId) {
  const pack = game.packs.get(packId);
  if (!pack) return [];

  const documents = await pack.getDocuments();
  return documents.filter((item) => item.type === type);
}

function isInvestigatorAbility(item) {
  return isFromInvestigatorPack(item, ABILITIES_PACK);
}

function isInvestigatorItem(item) {
  return isFromInvestigatorPack(item, ITEMS_PACK);
}

function isInvestigatorClass(item) {
  return item.type === 'class' && isFromInvestigatorPack(item, CLASSES_PACK);
}

function isFromInvestigatorPack(item, packId) {
  if (item.pack === packId) return true;
  if (item.compendium?.collection === packId) return true;

  const sourceId = item.flags?.core?.sourceId;
  if (typeof sourceId === 'string' && sourceId.startsWith(`Compendium.${packId}.`)) {
    return true;
  }

  return Boolean(item.flags?.[MODULE_ID]?.sourceId);
}

function getActorClassName(actor) {
  const classItem = actor?.items?.find((item) => item.type === 'class');
  return normalizeClassName(classItem?.name ?? actor?.system?.playbook);
}

function normalizeClassName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function canReplaceActorIcon(actorIcon) {
  if (!actorIcon) return true;
  return actorIcon === 'icons/svg/mystery-man.svg' || isInvestigatorClassIcon(actorIcon);
}

function isInvestigatorClassIcon(icon) {
  return (
    typeof icon === 'string' &&
    icon.startsWith(`modules/${MODULE_ID}/styles/assets/icons/ttk-investigator-icon.`) &&
    icon.endsWith('.png')
  );
}

function sortOwnedAbilitySlots(items) {
  if (!Array.isArray(items)) return;

  const sortedAbilities = sortAbilityList(
    items.filter((item) => item.type === 'ability' && isInvestigatorAbility(item)),
    { ownedSelected: true }
  );
  let abilityIndex = 0;

  for (const [index, item] of items.entries()) {
    if (item.type === 'ability' && isInvestigatorAbility(item)) {
      items[index] = sortedAbilities[abilityIndex];
      abilityIndex += 1;
    }
  }
}

function sortAbilityList(abilities, options = {}) {
  if (!Array.isArray(abilities)) return abilities;
  return abilities.sort((a, b) => compareAbilities(a, b, options));
}

function compareAbilities(a, b, options) {
  return (
    compareNumbers(abilityBucket(a, options), abilityBucket(b, options)) ||
    compareNumbers(abilitySequence(a), abilitySequence(b)) ||
    normalizeAbilityName(a).localeCompare(normalizeAbilityName(b))
  );
}

function abilityBucket(item, options) {
  const selected = isAbilitySelected(item, options);
  const specialArmour = isSpecialArmourAbility(item);

  if (selected && specialArmour) return 0;
  if (selected) return 1;
  if (specialArmour) return 2;
  return 3;
}

function isAbilitySelected(item, options = {}) {
  if (options.ownedSelected) return true;
  if (item?._progress !== undefined) return Number(item._progress) > 0;
  if (item?._ownedId) return true;
  return Boolean(item?.system?.purchased);
}

function isSpecialArmourAbility(item) {
  const automation = item?.flags?.[MODULE_ID]?.automation ?? [];
  return automation.some((entry) => entry?.kind === 'specialArmour' && entry?.slot === 'special');
}

function abilitySequence(item) {
  const sequence = Number(item?.flags?.[MODULE_ID]?.sequence);
  if (Number.isFinite(sequence)) return sequence;

  const sort = Number(item?.sort);
  return Number.isFinite(sort) ? sort : Number.MAX_SAFE_INTEGER;
}

function normalizeAbilityName(item) {
  return String(item?.name ?? '').trim();
}

function compareNumbers(a, b) {
  return a === b ? 0 : a - b;
}

function wrapMethod(target, methodName, wrapper) {
  if (typeof target?.[methodName] !== 'function') {
    return;
  }

  const original = target[methodName];
  target[methodName] = function (...args) {
    return wrapper.call(this, original.bind(this), ...args);
  };
}
