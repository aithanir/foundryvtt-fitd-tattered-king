import { DEFAULT_ACTOR_ICONS, isInvestigatorClassIcon } from './shared.js';

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
