import { BladesHelpers } from '../../../systems/blades-in-the-dark/module/blades-helpers.js';
import { BladesActorSheet } from '../../../systems/blades-in-the-dark/module/blades-actor-sheet.js';
import { BladesSheet } from '../../../systems/blades-in-the-dark/module/blades-sheet.js';
import { openFormDialog } from '../../../systems/blades-in-the-dark/module/lib/dialog-compat.js';
import {
  ABILITIES_PACK,
  ALTERNATE_SHEETS_ID,
  CLASSES_PACK,
  ITEMS_PACK,
  MAX_VETERAN_ABILITIES,
  MODULE_ID,
  escapeHtml,
  getRootElement,
  hasSpecialArmourAutomation,
  isInvestigatorClassIcon,
  localize,
  normalizeName,
} from './shared.js';
import { wrapMethod } from './wrappers.js';

let addContext = null;

Hooks.once('ready', async () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  registerBaseSheetAbilityOrdering();
  registerBaseSheetClassDrops();
  registerBaseSheetItemFilters();
  registerBaseSheetClassDeletes();
  await registerAlternateSheetItemFilters();
  await registerAlternateSheetAbilityOrdering();
  await registerAlternateSheetVeteranControl();
  await registerAlternateSheetClassDropFix();
});

function registerBaseSheetAbilityOrdering() {
  wrapMethod(
    BladesActorSheet.prototype,
    'getData',
    async function (wrapped, ...args) {
      const sheetData = await wrapped(...args);
      sortOwnedAbilitySlots(sheetData?.items);
      return sheetData;
    },
    {
      libWrapperTarget:
        'CONFIG.Actor.sheetClasses.character["blades.BladesActorSheet"].cls.prototype.getData',
      label: 'BladesActorSheet.prototype.getData',
    }
  );
}

function registerBaseSheetClassDrops() {
  wrapMethod(
    BladesActorSheet.prototype,
    '_onDropItem',
    async function (wrapped, event, droppedItem, ...args) {
      const item = await fromUuid(droppedItem?.uuid);
      if (this.actor?.type !== 'character' || !(await isInvestigatorClassCandidate(item))) {
        return wrapped(event, droppedItem, ...args);
      }

      event?.preventDefault?.();
      await switchBaseSheetInvestigatorClass(this.actor, item);
    },
    {
      libWrapperTarget:
        'CONFIG.Actor.sheetClasses.character["blades.BladesActorSheet"].cls.prototype._onDropItem',
      label: 'BladesActorSheet.prototype._onDropItem',
      type: 'MIXED',
    }
  );
}

function registerBaseSheetItemFilters() {
  wrapMethod(
    BladesSheet.prototype,
    '_onItemAddClick',
    async function (wrapped, event, ...args) {
      const itemType = event?.currentTarget?.dataset?.itemType;
      if (!['ability', 'class', 'item'].includes(itemType) || this.actor?.type !== 'character') {
        return wrapped(event, ...args);
      }

      if (itemType === 'ability' && isInvestigatorActor(this.actor)) {
        event.preventDefault();
        return openInvestigatorAbilityDialog(this.actor);
      }

      if (itemType === 'class') {
        event.preventDefault();
        return openInvestigatorClassDialog(this.actor);
      }

      return withAddContext({ actor: this.actor, itemType }, () => wrapped(event, ...args));
    },
    {
      libWrapperTarget:
        'CONFIG.Actor.sheetClasses.character["blades.BladesActorSheet"].cls.prototype._onItemAddClick',
      label: 'BladesSheet.prototype._onItemAddClick',
      type: 'MIXED',
    }
  );

  wrapMethod(
    BladesHelpers,
    'getAllItemsByType',
    async function (wrapped, itemType, ...args) {
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
    },
    {
      libWrapperTarget: 'BladesHelpers.getAllItemsByType',
      label: 'BladesHelpers.getAllItemsByType',
    }
  );
}

function registerBaseSheetClassDeletes() {
  Hooks.on('renderBladesActorSheet', (app, html) => {
    const actor = app.actor;
    if (actor?.type !== 'character' || !isInvestigatorActor(actor) || !actor.isOwner) return;

    getRootElement(html)
      ?.querySelectorAll('.item[data-item-id] .item-delete')
      .forEach((control) => {
        const itemId = control.closest('.item')?.dataset?.itemId;
        const item = actor.items.get(itemId);
        if (!isInvestigatorClass(item)) return;

        control.addEventListener(
          'click',
          async () => {
            await clearActorAbilityState(actor);
          },
          { capture: true, once: true }
        );
      });
  });
}

async function registerAlternateSheetItemFilters() {
  if (!game.modules.get('bitd-alternate-sheets')?.active) return;

  const { Utils } = await import('../../bitd-alternate-sheets/scripts/utils.js');
  wrapMethod(
    Utils,
    'getSourcedItemsByType',
    async function (wrapped, itemType, ...args) {
      if (itemType === 'ability') {
        return getInvestigatorAbilities();
      }

      if (itemType === 'item') {
        return getInvestigatorItems();
      }

      return wrapped(itemType, ...args);
    },
    { label: 'Alternate Utils.getSourcedItemsByType' }
  );
}

async function registerAlternateSheetAbilityOrdering() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');

  // Alternate sheet render data includes virtual ability state; direct wrapping
  // preserves the known-compatible internal call flow when libWrapper is active.
  wrapMethod(
    BladesAlternateActorSheet.prototype,
    'getData',
    async function (wrapped, ...args) {
      const sheetData = await wrapped(...args);
      sortAbilityList(sheetData?.available_playbook_abilities);
      return sheetData;
    },
    { label: 'BladesAlternateActorSheet.prototype.getData' }
  );
}

async function registerAlternateSheetVeteranControl() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  Hooks.on('renderBladesAlternateActorSheet', (app, html) => {
    enhanceAlternateSheetVeteranControl(app, html);
  });
}

async function registerAlternateSheetClassDropFix() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');
  const { Utils } = await import('../../bitd-alternate-sheets/scripts/utils.js');
  const { queueUpdate } = await import('../../bitd-alternate-sheets/scripts/lib/update-queue.js');

  // This internal alternate-sheet seam may consume class drops, so keep it as a
  // direct MIXED wrapper instead of routing it through a libWrapper target path.
  wrapMethod(
    BladesAlternateActorSheet.prototype,
    'switchPlaybook',
    async function (wrapped, newPlaybookItem, ...args) {
      const isInvestigatorNewClass = await isInvestigatorClassCandidate(newPlaybookItem);
      if (!isInvestigatorNewClass) {
        return wrapped(newPlaybookItem, ...args);
      }

      return switchInvestigatorClass(this, newPlaybookItem, { Utils, queueUpdate });
    },
    {
      label: 'BladesAlternateActorSheet.prototype.switchPlaybook',
      type: 'MIXED',
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

async function switchInvestigatorClass(sheet, classItem, { Utils, queueUpdate }) {
  const actor = sheet.actor;
  if (actor?.type !== 'character' || !actor.isOwner) return;

  await clearActorAbilityState(actor, queueUpdate);
  await sheet.switchToPlaybookAcquaintances(classItem);
  await setActorAttributesFromClass(actor, classItem, { Utils, queueUpdate });
  await ensureActorClass(actor, classItem, queueUpdate);
  await updateActorIconFromClass(actor, classItem, queueUpdate);
  await waitForRenderCycle();
  sheet.render(false);
}

async function switchBaseSheetInvestigatorClass(actor, classItem) {
  if (actor?.type !== 'character' || !actor.isOwner) return;

  await clearActorAbilityState(actor);
  await ensureActorClass(actor, classItem);
  await updateActorIconFromClass(actor, classItem);
  actor.sheet?.render(false);
}

async function setActorAttributesFromClass(actor, classItem, { Utils, queueUpdate }) {
  const attributes = await Utils.getStartingAttributes(classItem);
  for (const attribute of Object.values(attributes)) {
    attribute.exp = String(attribute.exp);
    attribute.exp_max = String(attribute.exp_max);
  }

  await queueUpdate(() => actor.update({ system: { attributes } }, { render: false }));
}

async function ensureActorClass(actor, classItem, queueUpdate = null) {
  if (actor?.type !== 'character' || !actor.isOwner) return;

  const existingClassIds = actor.items
    .filter((item) => item.type === 'class')
    .map((item) => item.id);
  if (existingClassIds.length > 0) {
    await queuedActorUpdate(queueUpdate, () =>
      actor.deleteEmbeddedDocuments('Item', existingClassIds, { render: false })
    );
  }

  const classData = classItem.toObject();
  await queuedActorUpdate(queueUpdate, () =>
    actor.createEmbeddedDocuments('Item', [classData], { render: false })
  );
}

async function clearActorAbilityState(actor, queueUpdate = null) {
  if (actor?.type !== 'character' || !actor.isOwner) return;

  const abilityIds = actor.items.filter((item) => item.type === 'ability').map((item) => item.id);
  if (abilityIds.length > 0) {
    await queuedActorUpdate(queueUpdate, () =>
      actor.deleteEmbeddedDocuments('Item', abilityIds, { render: false })
    );
  }

  if (actor.getFlag(ALTERNATE_SHEETS_ID, 'multiAbilityProgress')) {
    await queuedActorUpdate(queueUpdate, () =>
      actor.unsetFlag(ALTERNATE_SHEETS_ID, 'multiAbilityProgress', { render: false })
    );
  }
}

async function updateActorIconFromClass(actor, classItem, queueUpdate = null) {
  const classIcon = classItem.img;
  if (!isInvestigatorClassIcon(classIcon)) return;
  if (actor.img === classIcon) return;

  await queuedActorUpdate(queueUpdate, () => actor.update({ img: classIcon }, { render: false }));
}

async function queuedActorUpdate(queueUpdate, callback) {
  return queueUpdate ? queueUpdate(callback) : callback();
}

async function waitForRenderCycle() {
  await new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(resolve);
      return;
    }

    globalThis.setTimeout(resolve, 0);
  });
}

function filterAbilitiesForActor(abilities, actor) {
  return filterEntriesForActor(filterToInvestigatorAbilities(abilities), actor);
}

function filterItemsForActor(items, actor) {
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
      normalizeAbilityName(a).localeCompare(normalizeAbilityName(b))
    );
  });
}

function itemBucketForActor(item, actorClass) {
  const itemClass = normalizeClassName(item.system?.class);
  return itemClass && itemClass === actorClass ? 0 : 1;
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

  return type === 'ability'
    ? sortAbilityList(items)
    : items.sort((a, b) => a.name.localeCompare(b.name));
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

async function isInvestigatorClassCandidate(item) {
  if (isInvestigatorClass(item)) return true;
  if (item?.type !== 'class') return false;

  const classes = await getInvestigatorPackEntries('class', CLASSES_PACK);
  return classes.some((classItem) => classItem.id === item.id || classItem.name === item.name);
}

function isInvestigatorActor(actor) {
  return actor?.type === 'character' && actor.items?.some((item) => isInvestigatorClass(item));
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
  if (options.ignoreSelection) return isSpecialArmourAbility(item) ? 0 : 1;

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

async function openInvestigatorAbilityDialog(actor, { veteranOnly = false } = {}) {
  if (!actor?.isOwner) return;

  const veteranCount = getVeteranAbilityCount(actor);
  const veteranSlotsRemaining = Math.max(0, MAX_VETERAN_ABILITIES - veteranCount);
  const canSelectVeteran = veteranSlotsRemaining > 0;
  const classAbilities = veteranOnly ? [] : await getAbilityDialogCandidates(actor, false);
  const veteranAbilities = canSelectVeteran ? await getAbilityDialogCandidates(actor, true) : [];
  const abilities = veteranOnly ? veteranAbilities : classAbilities.concat(veteranAbilities);

  if ((veteranOnly ? veteranAbilities : classAbilities).length === 0) {
    ui.notifications.warn(localize('VeteranNoCandidates'));
    return;
  }

  const content = buildAbilityDialogContent({
    classAbilities,
    veteranAbilities,
    veteranOnly,
    canSelectVeteran,
    veteranSlotsRemaining,
  });
  const result = await openAbilityDialogV2({
    title: localize(veteranOnly ? 'VeteranDialogTitle' : 'AbilityDialogTitle'),
    content,
    okLabel: game.i18n.localize('Add'),
    cancelLabel: game.i18n.localize('Cancel'),
  });

  if (!result) return;

  const selectedAsVeteran = veteranOnly || result.veteran === 'on';
  const selectedId = selectedAsVeteran ? result.select_veteran_ability : result.select_ability;
  if (!selectedId) return;

  const selectedAbility = abilities.find((ability) => ability.id === selectedId);
  if (!selectedAbility) return;

  if (selectedAsVeteran && getVeteranAbilityCount(actor) >= MAX_VETERAN_ABILITIES) {
    ui.notifications.warn(localize('VeteranLimitReached'));
    return;
  }

  await addAbilityToActor(actor, selectedAbility, { veteran: selectedAsVeteran });
}

async function openInvestigatorClassDialog(actor) {
  if (!actor?.isOwner) return;

  const classes = sortByName(await getInvestigatorPackEntries('class', CLASSES_PACK));
  const content = `
    <form class="items-to-add">
      <div class="items-list">
        <div class="item-group">
          <header>${escapeHtml(game.i18n.localize('BITD.Class'))}</header>
          ${classes
            .map(
              (classItem) => `
                <div class="item-block">
                  <input
                    id="select-class-${escapeHtml(classItem.id)}"
                    type="radio"
                    name="select_class"
                    value="${escapeHtml(classItem.id)}"
                  >
                  <label for="select-class-${escapeHtml(classItem.id)}">
                    ${escapeHtml(classItem.name)}
                  </label>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    </form>
  `;
  const result = await openFormDialog({
    title: localize('ClassDialogTitle'),
    content,
    okLabel: game.i18n.localize('Add'),
    cancelLabel: game.i18n.localize('Cancel'),
  });
  if (!result?.select_class) return;

  const classItem = classes.find((item) => item.id === result.select_class);
  if (!classItem) return;

  await switchBaseSheetInvestigatorClass(actor, classItem);
}

async function getAbilityDialogCandidates(actor, veteran) {
  const actorClass = getActorClassName(actor);
  const ownedNames = new Set(
    actor.items.filter((item) => item.type === 'ability').map((item) => normalizeName(item.name))
  );
  const abilities = await getInvestigatorAbilities();

  return abilities.filter((ability) => {
    const abilityClass = normalizeClassName(ability.system?.class);
    if (!abilityClass || ownedNames.has(normalizeName(ability.name))) return false;
    return veteran ? abilityClass !== actorClass : abilityClass === actorClass;
  });
}

function buildAbilityDialogContent({
  classAbilities,
  veteranAbilities,
  veteranOnly,
  canSelectVeteran,
  veteranSlotsRemaining,
}) {
  const veteranControl = veteranOnly
    ? ''
    : `
      <input
        id="fitd-ttk-veteran-toggle"
        class="fitd-ttk-veteran-mode"
        type="checkbox"
        name="veteran"
        ${canSelectVeteran ? '' : 'disabled'}
      >
      <label class="fitd-ttk-veteran-toggle" for="fitd-ttk-veteran-toggle">
        ${escapeHtml(localize('VeteranToggle'))}
      </label>
      <p class="notes">${escapeHtml(
        localize(canSelectVeteran ? 'VeteranSlotsRemaining' : 'VeteranLimitReached', {
          count: veteranSlotsRemaining,
        })
      )}</p>
    `;

  const container = document.createElement('div');
  container.innerHTML = `
    <div
      class="items-to-add fitd-ttk-ability-dialog ${veteranOnly ? 'fitd-ttk-veteran-only' : ''}"
      data-veteran="${veteranOnly ? 'true' : 'false'}"
    >
      ${veteranControl}
      <div class="items-list fitd-ttk-class-ability-list" style="${veteranOnly ? 'display: none;' : ''}">
        ${sortedAbilityGroups(classAbilities)
          .map(([className, group]) => buildAbilityDialogGroup(className, group, 'select_ability'))
          .join('')}
      </div>
      <div class="items-list fitd-ttk-veteran-ability-list" style="${veteranOnly ? '' : 'display: none;'}">
        ${sortedAbilityGroups(veteranAbilities)
          .map(([className, group]) =>
            buildAbilityDialogGroup(className, group, 'select_veteran_ability')
          )
          .join('')}
      </div>
    </div>
  `;

  wireAbilityDialogToggle(container);
  return container;
}

async function openAbilityDialogV2({ title, content, okLabel, cancelLabel }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    return openFormDialog({
      title,
      content: content.outerHTML,
      okLabel,
      cancelLabel,
    });
  }

  return DialogV2.wait({
    window: { title },
    content,
    buttons: [
      {
        action: 'ok',
        label: okLabel,
        icon: 'fas fa-check',
        default: true,
        callback: (event, button) => serializeAbilityDialog(button.form),
      },
      {
        action: 'cancel',
        label: cancelLabel,
        icon: 'fas fa-times',
        callback: () => undefined,
      },
    ],
  });
}

function serializeAbilityDialog(form) {
  if (!form) return {};

  return {
    veteran: form.elements.veteran?.checked ? 'on' : undefined,
    select_ability: form.elements.select_ability?.value || undefined,
    select_veteran_ability: form.elements.select_veteran_ability?.value || undefined,
  };
}

function wireAbilityDialogToggle(content) {
  const toggle = content.querySelector('.fitd-ttk-veteran-mode');
  if (!toggle) return;

  const update = () => {
    const classList = content.querySelector('.fitd-ttk-class-ability-list');
    const veteranList = content.querySelector('.fitd-ttk-veteran-ability-list');
    if (!classList || !veteranList) return;

    classList.style.display = toggle.checked ? 'none' : '';
    veteranList.style.display = toggle.checked ? '' : 'none';
  };

  toggle.addEventListener('change', update);
  update();
}

function buildAbilityDialogGroup(className, abilities, inputName) {
  return `
    <div class="item-group">
      <header>${escapeHtml(className)}</header>
      ${abilities
        .map((ability) => {
          const description = BladesHelpers.stripHtml(ability.system?.description || '');
          return `
            <div class="item-block">
              <input
                id="${escapeHtml(inputName)}-${escapeHtml(ability.id)}"
                type="radio"
                name="${escapeHtml(inputName)}"
                value="${escapeHtml(ability.id)}"
              >
              <label for="${escapeHtml(inputName)}-${escapeHtml(ability.id)}" title="${escapeHtml(description)}">
                ${escapeHtml(BladesHelpers.trimClassFromName(ability.name))}
              </label>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function sortedAbilityGroups(abilities) {
  return Object.entries(groupAbilitiesByClass(abilities))
    .sort(([classA], [classB]) => classA.localeCompare(classB))
    .map(([className, group]) => [className, sortAbilityList(group, { ignoreSelection: true })]);
}

function sortByName(items) {
  return items.sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
}

function groupAbilitiesByClass(abilities) {
  return abilities.reduce((groups, ability) => {
    const className = ability.system?.class || game.i18n.localize('BITD.Generic');
    groups[className] ??= [];
    groups[className].push(ability);
    return groups;
  }, {});
}

async function addAbilityToActor(actor, ability, { veteran = false } = {}) {
  const data = ability.toObject();
  delete data._id;

  if (veteran) {
    data.flags ??= {};
    data.flags[MODULE_ID] ??= {};
    data.flags[MODULE_ID].veteran = true;
  }

  await actor.createEmbeddedDocuments('Item', [data]);
}

function enhanceAlternateSheetVeteranControl(app, html) {
  const actor = app.actor;
  if (!isInvestigatorActor(actor) || !actor.isOwner) return;

  const root = getRootElement(html);
  const abilityList = root?.querySelector('.ability-list.check-list');
  if (!abilityList || abilityList.querySelector('.fitd-ttk-veteran-ability')) return;

  const remaining = Math.max(0, MAX_VETERAN_ABILITIES - getVeteranAbilityCount(actor));
  if (remaining <= 0) return;

  const row = buildAlternateVeteranRow(actor, remaining);
  abilityList.append(row);
  row.addEventListener('change', async (event) => {
    if (!event.target?.matches('.fitd-ttk-veteran-checkbox')) return;
    event.preventDefault();
    await openInvestigatorAbilityDialog(actor, { veteranOnly: true });
    app.render(false);
  });
}

function buildAlternateVeteranRow(actor, remaining) {
  const row = document.createElement('div');
  row.className = 'ability-block fitd-ttk-veteran-ability';
  row.dataset.abilityName = localize('VeteranAbilityName');

  row.innerHTML = `
    <div class="ability-checkboxes">
      ${Array.from({ length: remaining }, (_, index) => {
        const slot = index + 1;
        const id = `character-${actor.id}-veteran-${slot}`;
        return `
          <input
            type="checkbox"
            class="fitd-ttk-veteran-checkbox"
            id="${escapeHtml(id)}"
            data-veteran-slot="${slot}"
          >
        `;
      }).join('')}
    </div>
    <label>
      <span class="ability-name">${escapeHtml(localize('VeteranAbilityName'))}:</span>
      <span class="ability-description">${escapeHtml(localize('VeteranAbilityDescription'))}</span>
    </label>
  `;

  return row;
}

function getVeteranAbilityCount(actor) {
  const actorClass = getActorClassName(actor);
  if (!actorClass) return 0;

  return actor.items.filter((item) => isVeteranAbility(actorClass, item)).length;
}

function isVeteranAbility(actorClass, item) {
  if (item?.type !== 'ability' || !isInvestigatorAbility(item)) return false;
  const abilityClass = normalizeClassName(item.system?.class);
  return Boolean(abilityClass && abilityClass !== actorClass);
}

function isSpecialArmourAbility(item) {
  return hasSpecialArmourAutomation(item);
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
