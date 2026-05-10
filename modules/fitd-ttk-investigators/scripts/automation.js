const MODULE_ID = 'fitd-ttk-investigators';
const SPECIAL_ARMOUR_PATH = 'system.armor-uses.special';

Hooks.once('ready', () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  Hooks.on('renderBladesActorSheet', enhanceSpecialArmour);
  Hooks.on('renderBladesAlternateActorSheet', enhanceSpecialArmour);
});

function enhanceSpecialArmour(app, html) {
  const actor = app.actor;
  if (actor?.type !== 'character') return;

  const items = getSpecialArmourItems(actor);
  if (items.length === 0) return;

  const root = getRootElement(html);
  if (!root) return;

  annotateSpecialArmourCheckbox(root, items);
  addSpecialArmourItemControls(root, actor, items);
}

function getSpecialArmourItems(actor) {
  return actor.items.filter((item) => {
    const automation = item.flags?.[MODULE_ID]?.automation ?? [];
    return automation.some((entry) => entry?.kind === 'specialArmour' && entry?.slot === 'special');
  });
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

  const label = container.querySelector('label');
  if (label) {
    label.append(button);
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
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fitd-ttk-special-armour-button';
  button.disabled = spent || !actor.isOwner;
  button.dataset.tooltip = formatAutomationItemTooltip(item);
  button.title = formatAutomationItemTooltip(item);
  button.innerHTML = `<i class="fa-solid fa-shield-halved" aria-hidden="true"></i><span>${escapeHtml(
    spent ? localize('SpecialArmourSpent') : localize('UseSpecialArmour')
  )}</span>`;

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    await expendSpecialArmour(actor, item);
  });

  return button;
}

async function expendSpecialArmour(actor, item) {
  if (!actor.isOwner || isSpecialArmourSpent(actor)) return;

  const confirmed = await confirmSpecialArmourUse(item);
  if (!confirmed) return;

  await actor.update({ [SPECIAL_ARMOUR_PATH]: true });
  await postSpecialArmourChat(actor, item);
}

async function confirmSpecialArmourUse(item) {
  const content = `
    <p><strong>${escapeHtml(
      game.i18n.format(`${MODULE_ID}.SpecialArmourConfirm`, { ability: item.name })
    )}</strong></p>
    <p>${escapeHtml(item.system?.description ?? '')}</p>
    <p>${escapeHtml(localize('SpecialArmourConfirmHint'))}</p>
  `;

  if (typeof globalThis.Dialog?.confirm === 'function') {
    return globalThis.Dialog.confirm({
      title: localize('ExpendSpecialArmour'),
      content,
      yes: () => true,
      no: () => false,
      defaultYes: false,
    });
  }

  return window.confirm(
    `${game.i18n.format(`${MODULE_ID}.SpecialArmourConfirm`, { ability: item.name })}\n\n${
      item.system?.description ?? ''
    }`
  );
}

async function postSpecialArmourChat(actor, item) {
  const content = `<p>${escapeHtml(
    game.i18n.format(`${MODULE_ID}.SpecialArmourChat`, { ability: item.name })
  )}</p>`;

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker({ actor }),
    content,
  });
}

function isSpecialArmourSpent(actor) {
  return Boolean(foundry.utils.getProperty(actor, SPECIAL_ARMOUR_PATH));
}

function formatAutomationItemTooltip(item) {
  return game.i18n.format(`${MODULE_ID}.SpecialArmourTooltip`, {
    ability: item.name,
    description: item.system?.description ?? '',
  });
}

function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? null;
}

function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
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
