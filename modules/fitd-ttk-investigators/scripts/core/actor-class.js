import { ALTERNATE_SHEETS_ID, isInvestigatorClassIcon } from '../shared.js';

export async function switchInvestigatorClass(sheet, classItem, { Utils, queueUpdate }) {
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

export async function switchBaseSheetInvestigatorClass(actor, classItem) {
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

export async function clearActorAbilityState(actor, queueUpdate = null) {
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
