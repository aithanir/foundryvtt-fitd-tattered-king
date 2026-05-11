import { BladesHelpers } from '../../../../systems/blades-in-the-dark/module/blades-helpers.js';
import { openFormDialog } from '../../../../systems/blades-in-the-dark/module/lib/dialog-compat.js';
import {
  MAX_VETERAN_ABILITIES,
  MODULE_ID,
  escapeHtml,
  localize,
  normalizeName,
} from '../shared.js';
import { sortAbilityList } from '../core/ability-ordering.js';
import {
  getActorClassName,
  getInvestigatorAbilities,
  isInvestigatorAbility,
  normalizeClassName,
} from '../core/investigator-items.js';

export async function openInvestigatorAbilityDialog(actor, { veteranOnly = false } = {}) {
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

export function getVeteranAbilityCount(actor) {
  const actorClass = getActorClassName(actor);
  if (!actorClass) return 0;

  return actor.items.filter((item) => isVeteranAbility(actorClass, item)).length;
}

function isVeteranAbility(actorClass, item) {
  if (item?.type !== 'ability' || !isInvestigatorAbility(item)) return false;
  const abilityClass = normalizeClassName(item.system?.class);
  return Boolean(abilityClass && abilityClass !== actorClass);
}
