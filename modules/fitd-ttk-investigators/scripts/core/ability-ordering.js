import { MODULE_ID, hasSpecialArmourAutomation } from '../shared.js';

export function sortOwnedAbilitySlots(items, isInvestigatorAbility) {
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

export function sortAbilityList(abilities, options = {}) {
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
