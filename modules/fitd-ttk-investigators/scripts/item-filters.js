import { BladesHelpers } from '../../../systems/blades-in-the-dark/module/blades-helpers.js';
import { BladesSheet } from '../../../systems/blades-in-the-dark/module/blades-sheet.js';

const MODULE_ID = 'fitd-ttk-investigators';
const ABILITIES_PACK = `${MODULE_ID}.ability`;
const CLASSES_PACK = `${MODULE_ID}.class`;
const ITEMS_PACK = `${MODULE_ID}.item`;

let addContext = null;

Hooks.once('ready', async () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  registerBaseSheetItemFilters();
  await registerAlternateSheetItemFilters();
  await registerAlternateSheetClassDropFix();
});

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

  return items.sort((a, b) => a.name.localeCompare(b.name));
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

function wrapMethod(target, methodName, wrapper) {
  if (typeof target?.[methodName] !== 'function') {
    return;
  }

  const original = target[methodName];
  target[methodName] = function (...args) {
    return wrapper.call(this, original.bind(this), ...args);
  };
}
