const MODULE_ID = 'fitd-ttk-investigators';
const I18N_PREFIX = 'FITD-TTK-INVESTIGATORS';
const SPECIAL_ARMOUR_ICON =
  'modules/fitd-ttk-investigators/styles/assets/icons/ttk-ability-icon.special-armor.png';
const SPECIAL_ARMOUR_PATH = 'system.armor-uses.special';

Hooks.once('ready', () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  Hooks.on('renderBladesActorSheet', enhanceSpecialArmour);
  Hooks.on('renderBladesAlternateActorSheet', enhanceSpecialArmour);
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

function getSpecialArmourItems(actor, data) {
  return uniqueItemsById([
    ...actor.items.filter(isSpecialArmourItem),
    ...getSelectedVirtualAutomationItems(data),
  ]);
}

function isSpecialArmourItem(item) {
  const automation = item.flags?.[MODULE_ID]?.automation ?? [];
  return automation.some((entry) => entry?.kind === 'specialArmour' && entry?.slot === 'special');
}

function getSelectedVirtualAutomationItems(data) {
  const abilities = data?.available_playbook_abilities;
  if (!Array.isArray(abilities)) return [];

  return abilities.filter((item) => {
    const progress = Number(item?._progress) || 0;
    return progress > 0 && isSpecialArmourItem(item);
  });
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
    <p><strong>${escapeHtml(
      game.i18n.format(`${I18N_PREFIX}.SpecialArmourConfirm`, { ability: item.name })
    )}</strong></p>
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
    `${game.i18n.format(`${I18N_PREFIX}.SpecialArmourConfirm`, { ability: item.name })}\n\n${
      item.system?.description ?? ''
    }`
  );
  return confirmed ? options[0] : false;
}

async function postSpecialArmourChat(actor, item, choice) {
  const content = `
    <div class="dice-tooltip blades-die-tooltip fitd-ttk-special-armour-chat">
      <div class="chat-label label-stripe-chat">${escapeHtml(item.name)}</div>
      <div class="chat-label-small label-stripe-chat-small">${escapeHtml(
        game.i18n.format(`${I18N_PREFIX}.SpecialArmourChat`, {
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
  return game.i18n.format(`${I18N_PREFIX}.SpecialArmourTooltip`, {
    ability: item.name,
    description: item.system?.description ?? '',
  });
}

function getSpecialArmourOptions(item) {
  const automation = item.flags?.[MODULE_ID]?.automation ?? [];
  const specialArmour = automation.find(
    (entry) => entry?.kind === 'specialArmour' && entry?.slot === 'special'
  );
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

function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? null;
}

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function localizeOptional(key) {
  const fullKey = `${I18N_PREFIX}.${key}`;
  return game.i18n.has(fullKey) ? game.i18n.localize(fullKey) : null;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function escapeCss(value) {
  if (typeof globalThis.CSS?.escape === 'function') {
    return globalThis.CSS.escape(value);
  }

  return String(value ?? '').replace(/["\\]/g, '\\$&');
}
