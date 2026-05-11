import {
  ALTERNATE_SHEETS_ID,
  MAX_VETERAN_ABILITIES,
  escapeHtml,
  getRootElement,
  localize,
} from '../shared.js';
import { switchInvestigatorClass } from '../core/actor-class.js';
import { sortAbilityList } from '../core/ability-ordering.js';
import {
  getInvestigatorAbilities,
  getInvestigatorItems,
  isInvestigatorActor,
  isInvestigatorClassCandidate,
} from '../core/investigator-items.js';
import { getVeteranAbilityCount, openInvestigatorAbilityDialog } from '../ui/ability-dialog.js';
import { wrapMethod } from '../wrappers.js';

export async function registerAlternateSheetItemFilters() {
  if (!game.modules.get('bitd-alternate-sheets')?.active) return;

  const { Utils } = await import('../../../bitd-alternate-sheets/scripts/utils.js');
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

export async function registerAlternateSheetAbilityOrdering() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');

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

export async function registerAlternateSheetVeteranControl() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  Hooks.on('renderBladesAlternateActorSheet', (app, html) => {
    enhanceAlternateSheetVeteranControl(app, html);
  });
}

export async function registerAlternateSheetClassDropFix() {
  if (!game.modules.get(ALTERNATE_SHEETS_ID)?.active) return;

  const { BladesAlternateActorSheet } =
    await import('../../../bitd-alternate-sheets/scripts/blades-alternate-actor-sheet.js');
  const { Utils } = await import('../../../bitd-alternate-sheets/scripts/utils.js');
  const { queueUpdate } =
    await import('../../../bitd-alternate-sheets/scripts/lib/update-queue.js');

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
