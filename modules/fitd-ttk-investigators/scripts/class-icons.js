const MODULE_ID = 'fitd-ttk-investigators';
const CLASS_ICON_PREFIX = `modules/${MODULE_ID}/styles/assets/icons/ttk-investigator-icon.`;
const DEFAULT_ACTOR_ICONS = new Set(['icons/svg/mystery-man.svg']);

Hooks.on('createItem', async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (item.type !== 'class') return;

  const actor = item.parent;
  if (actor?.documentName !== 'Actor') return;
  if (actor.type !== 'character') return;
  if (!actor.isOwner) return;

  const classIcon = item.img;
  if (!isInvestigatorClassIcon(classIcon)) return;
  if (!canReplaceActorIcon(actor.img)) return;
  if (actor.img === classIcon) return;

  await actor.update({ img: classIcon });
});

function canReplaceActorIcon(actorIcon) {
  if (!actorIcon) return true;
  return DEFAULT_ACTOR_ICONS.has(actorIcon) || isInvestigatorClassIcon(actorIcon);
}

function isInvestigatorClassIcon(icon) {
  return typeof icon === 'string' && icon.startsWith(CLASS_ICON_PREFIX) && icon.endsWith('.png');
}
