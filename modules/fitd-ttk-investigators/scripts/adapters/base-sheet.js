import { BladesHelpers } from '../../../../systems/blades-in-the-dark/module/blades-helpers.js';
import { BladesActorSheet } from '../../../../systems/blades-in-the-dark/module/blades-actor-sheet.js';
import { BladesSheet } from '../../../../systems/blades-in-the-dark/module/blades-sheet.js';
import { getRootElement } from '../shared.js';
import { clearActorAbilityState, switchBaseSheetInvestigatorClass } from '../core/actor-class.js';
import { sortOwnedAbilitySlots } from '../core/ability-ordering.js';
import {
  filterAbilitiesForActor,
  filterItemsForActor,
  filterToInvestigatorAbilities,
  filterToInvestigatorClasses,
  filterToInvestigatorItems,
  isInvestigatorAbility,
  isInvestigatorActor,
  isInvestigatorClass,
  isInvestigatorClassCandidate,
} from '../core/investigator-items.js';
import { openInvestigatorAbilityDialog } from '../ui/ability-dialog.js';
import { openInvestigatorClassDialog } from '../ui/class-dialog.js';
import { wrapMethod } from '../wrappers.js';

let addContext = null;

export function registerBaseSheetAbilityOrdering() {
  wrapMethod(
    BladesActorSheet.prototype,
    'getData',
    async function (wrapped, ...args) {
      const sheetData = await wrapped(...args);
      sortOwnedAbilitySlots(sheetData?.items, isInvestigatorAbility);
      return sheetData;
    },
    {
      libWrapperTarget:
        'CONFIG.Actor.sheetClasses.character["blades.BladesActorSheet"].cls.prototype.getData',
      label: 'BladesActorSheet.prototype.getData',
    }
  );
}

export function registerBaseSheetClassDrops() {
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

export function registerBaseSheetItemFilters() {
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

export function registerBaseSheetClassDeletes() {
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

async function withAddContext(context, callback) {
  const previousContext = addContext;
  addContext = context;

  try {
    return await callback();
  } finally {
    addContext = previousContext;
  }
}
