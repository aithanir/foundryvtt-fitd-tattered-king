import {
  ABILITY_USES_FLAG,
  MODULE_ID,
  SPECIAL_ARMOUR_ICON,
  SPECIAL_ARMOUR_PATH,
  escapeCss,
  escapeHtml,
  getAutomationEntries,
  getModuleSourceId,
  getRootElement,
  getRollReminderEntries,
  getUsageAutomationEntry,
  hasSpecialArmourAutomation,
  isSpecialArmourAutomationEntry,
  localize,
  localizeOptional,
  normalizeName,
} from './shared.js';
import { isInvestigatorActor } from './core/investigator-items.js';
import { wrapMethod } from './wrappers.js';
import { BladesActor } from '../../../systems/blades-in-the-dark/module/blades-actor.js';

let pendingRollReminderPanel = null;

Hooks.once('ready', () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  Hooks.on('renderBladesActorSheet', enhanceSpecialArmour);
  Hooks.on('renderBladesAlternateActorSheet', enhanceSpecialArmour);
  Hooks.on('renderBladesActorSheet', enhanceUsageTracking);
  Hooks.on('renderBladesAlternateActorSheet', enhanceUsageTracking);
  Hooks.on('renderDialog', injectPendingRollReminders);
  Hooks.on('renderApplication', injectPendingRollReminders);
  Hooks.on('renderApplicationV2', injectPendingRollReminders);
  registerRollReminders();
  registerAutomationApi();
});

function enhanceSpecialArmour(app, html, data) {
  const actor = app.actor;
  if (actor?.type !== 'character') return;

  const items = getSpecialArmourItems(actor, data);
  if (items.length === 0) return;

  const root = getRootElement(html);
  if (!root) return;

  annotateSpecialArmourCheckbox(root, items);
  addSpecialArmourItemControls(root, actor, items);
}

function enhanceUsageTracking(app, html, data) {
  const actor = app.actor;
  if (!isInvestigatorActor(actor)) return;

  const root = getRootElement(html);
  if (!root) return;

  const items = getUsageItems(actor, data);
  if (items.length > 0) addUsageItemControls(root, actor, items);
}

function getSpecialArmourItems(actor, data) {
  return uniqueItemsById([
    ...actor.items.filter(isSpecialArmourItem),
    ...getSelectedVirtualAutomationItems(data),
  ]);
}

function isSpecialArmourItem(item) {
  return hasSpecialArmourAutomation(item);
}

function getSelectedVirtualAutomationItems(data) {
  const abilities = data?.available_playbook_abilities;
  if (!Array.isArray(abilities)) return [];

  return abilities.filter((item) => {
    const progress = Number(item?._progress) || 0;
    return progress > 0 && isSpecialArmourItem(item);
  });
}

function getUsageItems(actor, data) {
  return uniqueItemsById([
    ...actor.items.filter((item) => item.type === 'ability' && getUsageAutomationEntry(item)),
    ...getSelectedVirtualAutomationItems(data).filter(getUsageAutomationEntry),
  ]);
}

function uniqueItemsById(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = item.uuid ?? item.id ?? item._id ?? item.name;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function annotateSpecialArmourCheckbox(root, items) {
  const checkbox = root.querySelector(`input[name="${SPECIAL_ARMOUR_PATH}"]`);
  if (!checkbox) return;

  const label = checkbox.id
    ? root.querySelector(`label[for="${escapeCss(checkbox.id)}"]`)
    : checkbox.closest('label');
  if (!label) return;

  const tooltip = items.map(formatAutomationItemTooltip).join('\n');
  label.classList.add('fitd-ttk-special-armour-label');
  label.dataset.tooltip = tooltip;
  label.title = tooltip;
}

function addSpecialArmourItemControls(root, actor, items) {
  for (const item of items) {
    for (const container of findItemContainers(root, item)) {
      if (container.querySelector('.fitd-ttk-special-armour-button')) continue;

      const button = buildSpecialArmourButton(actor, item);
      insertSpecialArmourButton(container, button);
    }
  }
}

function findItemContainers(root, item) {
  const containers = [];

  for (const element of root.querySelectorAll('.item[data-item-id]')) {
    if (element.dataset.itemId === item.id) containers.push(element);
  }

  for (const element of root.querySelectorAll('.ability-block')) {
    if (
      element.dataset.abilityOwnedId === item.id ||
      element.dataset.abilityId === item.id ||
      normalizeName(element.dataset.abilityName) === normalizeName(item.name)
    ) {
      containers.push(element);
    }
  }

  return containers;
}

function insertSpecialArmourButton(container, button) {
  const postControl = container.querySelector('.item-control.item-post');
  if (postControl) {
    postControl.after(button);
    return;
  }

  const abilityName = container.querySelector('.ability-name');
  if (abilityName) {
    abilityName.after(button);
    return;
  }

  const body = container.querySelector('.item-body');
  if (body) {
    body.append(button);
    return;
  }

  container.append(button);
}

function buildSpecialArmourButton(actor, item) {
  const spent = isSpecialArmourSpent(actor);
  const button = document.createElement('a');
  button.href = '#';
  button.role = 'button';
  button.ariaLabel = spent ? localize('SpecialArmourSpent') : localize('UseSpecialArmour');
  button.className = 'fitd-ttk-special-armour-button';
  button.dataset.disabled = String(spent || !actor.isOwner);
  button.dataset.tooltip = formatAutomationItemTooltip(item);
  button.title = formatAutomationItemTooltip(item);
  button.innerHTML = `<img src="${SPECIAL_ARMOUR_ICON}" alt=""><span>SA</span>`;

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (spent || !actor.isOwner) return;
    await expendSpecialArmour(actor, item);
  });

  return button;
}

function addUsageItemControls(root, actor, items) {
  for (const item of items) {
    for (const container of findItemContainers(root, item)) {
      if (container.querySelector('.fitd-ttk-usage-button')) continue;

      const button = buildUsageButton(actor, item);
      insertUsageButton(container, button);
      container.classList.toggle('fitd-ttk-usage-used', getUsageState(actor, item).used >= 1);
    }
  }
}

function insertUsageButton(container, button) {
  const specialArmourButton = container.querySelector('.fitd-ttk-special-armour-button');
  if (specialArmourButton) {
    specialArmourButton.after(button);
    return;
  }

  insertSpecialArmourButton(container, button);
}

function buildUsageButton(actor, item) {
  const usage = getUsageAutomationEntry(item);
  const state = getUsageState(actor, item);
  const used = state.used >= usage.limit;
  const button = document.createElement('a');
  button.href = '#';
  button.role = 'button';
  button.className = 'fitd-ttk-usage-button';
  button.dataset.used = String(used);
  button.dataset.disabled = String(!actor.isOwner);
  button.dataset.tooltip = formatUsageTooltip(item, usage, used);
  button.title = formatUsageTooltip(item, usage, used);
  button.innerHTML = `<span>${escapeHtml(formatUsageButtonLabel(usage, used))}</span>`;

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!actor.isOwner) return;
    await toggleAbilityUse(actor, item);
  });

  return button;
}

async function toggleAbilityUse(actor, item) {
  const usage = getUsageAutomationEntry(item);
  if (!usage) return;

  const state = getUsageState(actor, item);
  const wasUsed = state.used >= usage.limit;
  const used = state.used >= usage.limit ? 0 : usage.limit;
  await setAbilityUse(actor, item, { used, limit: usage.limit, refresh: usage.refresh });
  if (wasUsed && used === 0) await postManualAbilityResetChat(actor, item, usage);
  renderActorSheets(actor);
}

function getUsageState(actor, item) {
  const sourceId = getModuleSourceId(item);
  const state = actor.getFlag?.(MODULE_ID, ABILITY_USES_FLAG)?.[sourceId] ?? {};
  return {
    used: Number(state.used) || 0,
    limit: Number(state.limit) || Number(getUsageAutomationEntry(item)?.limit) || 1,
    refresh: state.refresh ?? getUsageAutomationEntry(item)?.refresh ?? 'session',
  };
}

async function setAbilityUse(actor, item, state) {
  const sourceId = getModuleSourceId(item);

  if (state.used > 0) {
    await actor.update({
      [`flags.${MODULE_ID}.${ABILITY_USES_FLAG}.${sourceId}`]: {
        used: state.used,
        limit: state.limit,
        refresh: state.refresh,
      },
    });
    return;
  }

  await clearAbilityUse(actor, sourceId);
}

async function clearAbilityUse(actor, sourceId) {
  await actor.update({
    [`flags.${MODULE_ID}.${ABILITY_USES_FLAG}.-=${sourceId}`]: null,
  });
}

function formatUsageButtonLabel(usage, used) {
  return localize(used ? 'UsageButtonUsed' : 'UsageButtonAvailable', {
    use: formatUsageLimit(usage),
  });
}

function formatUsageTooltip(item, usage, used) {
  return localize(used ? 'UsageTooltipUsed' : 'UsageTooltipAvailable', {
    ability: item.name,
    limit: usage.limit,
    refresh: localize(`Refresh.${usage.refresh}`),
  });
}

function formatUsageLimit(usage) {
  return localize('UsageLimit', {
    limit: usage.limit,
    refresh: localize(`Refresh.${usage.refresh}`),
  });
}

async function openBeatResetDialog() {
  const content = `
    <form class="fitd-ttk-beat-reset-form">
      ${['scene', 'operation', 'session']
        .map(
          (refresh, index) => `
            <label class="fitd-ttk-beat-choice">
              <input type="radio" name="refresh" value="${refresh}" ${index === 0 ? 'checked' : ''}>
              <span>
                <strong>${escapeHtml(localize(`Beat.${refresh}`))}</strong>
                <small>${escapeHtml(localize(`BeatHelp.${refresh}`))}</small>
              </span>
            </label>
          `
        )
        .join('')}
    </form>
  `;

  if (typeof globalThis.Dialog?.confirm === 'function') {
    return globalThis.Dialog.confirm({
      title: localize('BeatResetTitle'),
      content,
      yes: async (html) => {
        const root = getRootElement(html);
        const refresh = root?.querySelector('input[name="refresh"]:checked')?.value ?? 'scene';
        return resetAbilityUses(refresh);
      },
      no: () => false,
      defaultYes: false,
    });
  }

  return resetAbilityUses('scene');
}

async function resetAbilityUses(refresh) {
  if (!game.user?.isGM || !['scene', 'operation', 'session'].includes(refresh)) return 0;

  let resetCount = 0;
  const resetEntries = [];
  const actors = game.actors.filter(
    (actor) => actor.type === 'character' && isInvestigatorActor(actor)
  );

  for (const actor of actors) {
    const uses = foundry.utils.deepClone(actor.getFlag(MODULE_ID, ABILITY_USES_FLAG) ?? {});
    const deleteUpdates = {};

    for (const [sourceId, state] of Object.entries(uses)) {
      if (state?.refresh !== refresh) continue;
      resetEntries.push({
        actorName: actor.name,
        abilityName: getAbilityNameForUsageSource(actor, sourceId),
        usage: {
          limit: Number(state.limit) || 1,
          refresh: state.refresh,
        },
      });
      deleteUpdates[`flags.${MODULE_ID}.${ABILITY_USES_FLAG}.-=${sourceId}`] = null;
      resetCount += 1;
    }

    if (Object.keys(deleteUpdates).length > 0) {
      await actor.update(deleteUpdates);
      renderActorSheets(actor);
    }
  }

  await postBeatResetChat(refresh, resetCount, resetEntries);
  return resetCount;
}

async function postBeatResetChat(refresh, resetCount, resetEntries) {
  const content = `
    <div class="fitd-ttk-beat-reset-chat">
      <div class="chat-label label-stripe-chat">${escapeHtml(localize(`BeatChatTitle.${refresh}`))}</div>
      <div class="description">
        <p>${escapeHtml(
          localize('BeatChatBody', {
            refresh: localize(`Refresh.${refresh}`),
            count: resetCount,
          })
        )}</p>
        ${formatResetEntryList(resetEntries)}
      </div>
    </div>
  `;

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker(),
    content,
  });
}

async function postManualAbilityResetChat(actor, item, usage) {
  const content = `
    <div class="fitd-ttk-ability-reset-chat">
      <div class="chat-label label-stripe-chat">${escapeHtml(localize('ManualResetTitle'))}</div>
      <div class="description">
        <p>${escapeHtml(
          localize('ManualResetBody', {
            actor: actor.name,
            ability: item.name,
            usage: formatUsageLimit(usage),
          })
        )}</p>
      </div>
    </div>
  `;

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker({ actor }),
    whisper: globalThis.ChatMessage.getWhisperRecipients('GM').map((user) => user.id),
    content,
  });
}

function formatResetEntryList(resetEntries) {
  if (resetEntries.length === 0) return '';

  return `
    <ul class="fitd-ttk-reset-list">
      ${resetEntries
        .map(
          (entry) => `
            <li>${escapeHtml(
              localize('BeatChatResetLine', {
                actor: entry.actorName,
                ability: entry.abilityName,
                usage: formatUsageLimit(entry.usage),
              })
            )}</li>
          `
        )
        .join('')}
    </ul>
  `;
}

function getAbilityNameForUsageSource(actor, sourceId) {
  const item = actor.items.find((candidate) => getModuleSourceId(candidate) === sourceId);
  return item?.name ?? sourceId;
}

function renderActorSheets(actor) {
  actor.sheet?.render(false);
  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.actor?.id === actor.id) app.render(false);
  }
}

function registerAutomationApi() {
  game.fitdTtkInvestigators = {
    ...(game.fitdTtkInvestigators ?? {}),
    markBeat,
    openBeatResetDialog,
    resetAbilityUses,
  };
}

function markBeat(refresh = null) {
  return refresh ? resetAbilityUses(refresh) : openBeatResetDialog();
}

function registerRollReminders() {
  wrapMethod(
    BladesActor.prototype,
    'rollAttributePopup',
    async function (wrapped, attributeName, ...args) {
      pendingRollReminderPanel = buildRollReminderPanel(this, attributeName);
      try {
        return await wrapped(attributeName, ...args);
      } finally {
        pendingRollReminderPanel = null;
      }
    },
    {
      libWrapperTarget: 'CONFIG.Actor.documentClass.prototype.rollAttributePopup',
      label: 'BladesActor.prototype.rollAttributePopup',
    }
  );
}

function injectPendingRollReminders(_app, html) {
  if (!pendingRollReminderPanel) return;

  const root = getRootElement(html);
  if (!root?.querySelector) return;

  const form = root.querySelector('form.bitd-roll-dialog');
  if (!form || form.querySelector('.fitd-ttk-roll-reminders')) return;

  form.insertAdjacentHTML('afterbegin', pendingRollReminderPanel);
}

function buildRollReminderPanel(actor, attributeName) {
  if (!isInvestigatorActor(actor)) return null;

  const groups = getOwnedRollReminderGroups(actor, attributeName);
  if (groups.length === 0) return null;

  return `
    <section class="fitd-ttk-roll-reminders">
      <p>${escapeHtml(localize('RollReminderIntro'))}</p>
      ${groups
        .map(
          (group) => `
            <div class="fitd-ttk-roll-reminder-group">
              <h3>${escapeHtml(group.label)}</h3>
              <ul>
                ${group.reminders
                  .map(
                    ({ item, entry }) => `
                      <li>
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(entry.condition)}</small>
                      </li>
                    `
                  )
                  .join('')}
              </ul>
            </div>
          `
        )
        .join('')}
    </section>
  `;
}

function getOwnedRollReminderGroups(actor, attributeName) {
  const groups = new Map();

  for (const reminder of getOwnedRollReminders(actor, attributeName)) {
    const key = getRollBenefitKey(reminder.entry);
    const group = groups.get(key) ?? {
      label: formatRollBenefit(reminder.entry),
      reminders: [],
    };
    group.reminders.push(reminder);
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

function getOwnedRollReminders(actor, attributeName) {
  const trigger = getRollTrigger(attributeName);
  return actor.items
    .filter((item) => item.type === 'ability')
    .flatMap((item) =>
      getRollReminderEntries(item)
        .filter((entry) => reminderMatchesTrigger(entry, trigger))
        .map((entry) => ({ item, entry }))
    );
}

function getRollTrigger(attributeName) {
  if (['insight', 'prowess', 'resolve'].includes(attributeName)) return 'resistance';
  return 'competency';
}

function reminderMatchesTrigger(entry, trigger) {
  const entryTrigger = entry.trigger ?? 'any';
  return entryTrigger === 'any' || entryTrigger === trigger;
}

function formatRollBenefit(entry) {
  const type = entry.benefit?.type;
  const value = entry.benefit?.value;

  if (type === 'dice') return localize('RollBenefit.dice', { value: value ?? 1 });
  if (type === 'effect') return localize('RollBenefit.effect', { value: value ?? 1 });
  if (type === 'position') return localize('RollBenefit.position');
  if (type === 'stressCost') return localize('RollBenefit.stressCost', { value: value ?? -1 });
  if (type === 'rollSubstitute') return localize('RollBenefit.rollSubstitute');

  return localize('RollBenefit.other');
}

function getRollBenefitKey(entry) {
  return `${entry.benefit?.type ?? 'other'}:${entry.benefit?.value ?? ''}`;
}

async function expendSpecialArmour(actor, item) {
  if (!actor.isOwner || isSpecialArmourSpent(actor)) return;

  const choice = await confirmSpecialArmourUse(item);
  if (!choice) return;

  await actor.update({ [SPECIAL_ARMOUR_PATH]: true });
  await postSpecialArmourChat(actor, item, choice);
}

async function confirmSpecialArmourUse(item) {
  const options = getSpecialArmourOptions(item);
  const content = `
    <p><strong>${escapeHtml(localize('SpecialArmourConfirm', { ability: item.name }))}</strong></p>
    <form>
      ${options
        .map(
          (option, index) => `
            <label class="fitd-ttk-special-armour-choice">
              <input type="radio" name="choice" value="${option.kind}" ${index === 0 ? 'checked' : ''}>
              <span>${escapeHtml(option.label)}</span>
            </label>
          `
        )
        .join('')}
    </form>
    <p>${escapeHtml(localize('SpecialArmourConfirmHint'))}</p>
  `;

  if (typeof globalThis.Dialog?.confirm === 'function') {
    return globalThis.Dialog.confirm({
      title: localize('ExpendSpecialArmour'),
      content,
      yes: (html) => {
        const root = getRootElement(html);
        const value = root?.querySelector('input[name="choice"]:checked')?.value;
        return options.find((option) => option.kind === value) ?? options[0];
      },
      no: () => false,
      defaultYes: false,
    });
  }

  const confirmed = window.confirm(
    `${localize('SpecialArmourConfirm', { ability: item.name })}\n\n${item.system?.description ?? ''}`
  );
  return confirmed ? options[0] : false;
}

async function postSpecialArmourChat(actor, item, choice) {
  const content = `
    <div class="dice-tooltip blades-die-tooltip fitd-ttk-special-armour-chat">
      <div class="chat-label label-stripe-chat">${escapeHtml(item.name)}</div>
      <div class="chat-label-small label-stripe-chat-small">${escapeHtml(
        localize('SpecialArmourChat', {
          choice: choice.chatLabel || choice.label,
        })
      )}</div>
      <div class="description"><p>${escapeHtml(item.system?.description ?? '')}</p></div>
    </div>
  `;

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker({ actor }),
    content,
  });
}

function isSpecialArmourSpent(actor) {
  return Boolean(foundry.utils.getProperty(actor, SPECIAL_ARMOUR_PATH));
}

function formatAutomationItemTooltip(item) {
  return localize('SpecialArmourTooltip', {
    ability: item.name,
    description: item.system?.description ?? '',
  });
}

function getSpecialArmourOptions(item) {
  const specialArmour = getAutomationEntries(item).find(isSpecialArmourAutomationEntry);
  const triggers = Array.isArray(specialArmour?.triggers) ? specialArmour.triggers : [];
  const options = triggers.map((trigger) => getSpecialArmourOption(trigger)).filter(Boolean);

  return options.length > 0 ? options : [getSpecialArmourOption('use')];
}

function getSpecialArmourOption(trigger) {
  const key = String(trigger ?? '').trim();
  if (!key) return null;

  return {
    kind: key,
    label: localize(`SpecialArmourChoice.${key}`),
    chatLabel: localizeOptional(`SpecialArmourChatChoice.${key}`),
  };
}
