export const MODULE_ID = 'fitd-ttk-investigators';
export const I18N_PREFIX = 'FITD-TTK-INVESTIGATORS';

export const ABILITIES_PACK = `${MODULE_ID}.ability`;
export const CLASSES_PACK = `${MODULE_ID}.class`;
export const ITEMS_PACK = `${MODULE_ID}.item`;
export const ALTERNATE_SHEETS_ID = 'bitd-alternate-sheets';

export const MAX_VETERAN_ABILITIES = 3;
export const SPECIAL_ARMOUR_ICON =
  'modules/fitd-ttk-investigators/styles/assets/icons/ttk-ability-icon.special-armor.png';
export const SPECIAL_ARMOUR_PATH = 'system.armor-uses.special';

export const DEFAULT_ACTOR_ICONS = new Set(['icons/svg/mystery-man.svg']);

const CLASS_ICON_PREFIX = `modules/${MODULE_ID}/styles/assets/icons/ttk-investigator-icon.`;

export function isInvestigatorClassIcon(icon) {
  return typeof icon === 'string' && icon.startsWith(CLASS_ICON_PREFIX) && icon.endsWith('.png');
}

export function getAutomationEntries(item) {
  const automation = item?.flags?.[MODULE_ID]?.automation ?? [];
  return Array.isArray(automation) ? automation : [];
}

export function hasSpecialArmourAutomation(item) {
  return getAutomationEntries(item).some(isSpecialArmourAutomationEntry);
}

export function isSpecialArmourAutomationEntry(entry) {
  return entry?.kind === 'specialArmour' && entry?.slot === 'special';
}

export function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? null;
}

export function localize(key, data = null) {
  const fullKey = `${I18N_PREFIX}.${key}`;
  return data ? game.i18n.format(fullKey, data) : game.i18n.localize(fullKey);
}

export function localizeOptional(key) {
  const fullKey = `${I18N_PREFIX}.${key}`;
  return game.i18n.has(fullKey) ? game.i18n.localize(fullKey) : null;
}

export function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

export function escapeCss(value) {
  if (typeof globalThis.CSS?.escape === 'function') {
    return globalThis.CSS.escape(value);
  }

  return String(value ?? '').replace(/["\\]/g, '\\$&');
}
