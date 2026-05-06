import { BladesHelpers } from '../../../systems/blades-in-the-dark/module/blades-helpers.js';

const MODULE_ID = 'fitd-ttk-competencies';

const ATTRIBUTE_LABELS = {
  insight: 'FITD-TTK-COMPETENCIES.Attribute.insight',
  prowess: 'FITD-TTK-COMPETENCIES.Attribute.prowess',
  resolve: 'FITD-TTK-COMPETENCIES.Attribute.resolve',
};

const RESISTANCE_LABELS = {
  insight: 'FITD-TTK-COMPETENCIES.Roll.insight',
  prowess: 'FITD-TTK-COMPETENCIES.Roll.prowess',
  resolve: 'FITD-TTK-COMPETENCIES.Roll.resolve',
};

const SKILL_LABELS = {
  hunt: 'FITD-TTK-COMPETENCIES.Skill.hunt',
  study: 'FITD-TTK-COMPETENCIES.Skill.study',
  survey: 'FITD-TTK-COMPETENCIES.Skill.survey',
  tinker: 'FITD-TTK-COMPETENCIES.Skill.tinker',
  finesse: 'FITD-TTK-COMPETENCIES.Skill.finesse',
  prowl: 'FITD-TTK-COMPETENCIES.Skill.prowl',
  skirmish: 'FITD-TTK-COMPETENCIES.Skill.skirmish',
  wreck: 'FITD-TTK-COMPETENCIES.Skill.wreck',
  attune: 'FITD-TTK-COMPETENCIES.Skill.attune',
  command: 'FITD-TTK-COMPETENCIES.Skill.command',
  consort: 'FITD-TTK-COMPETENCIES.Skill.consort',
  sway: 'FITD-TTK-COMPETENCIES.Skill.sway',
};

const ROLL_LABELS = {
  ...RESISTANCE_LABELS,
  ...SKILL_LABELS,
};

Hooks.once('init', function () {
  console.log(`${MODULE_ID} | Initializing Tattered King: Competencies module`);

  game.settings.register(MODULE_ID, 'enableCompetencyLabels', {
    name: 'Enable Tattered King competency labels',
    hint: 'Relabel Blades in the Dark actions and resistance attributes without changing actor data.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once('ready', function () {
  if (game.system?.id !== 'blades-in-the-dark') return;
  if (!game.settings.get(MODULE_ID, 'enableCompetencyLabels')) return;

  registerGetComputedAttributesWrapper();
  registerHelperWrappers();
  registerRenderHooks();

  console.log(`${MODULE_ID} | Competency label adapter enabled for Blades in the Dark.`);
});

function registerGetComputedAttributesWrapper() {
  const actorClass = CONFIG.Actor?.documentClass;
  if (typeof actorClass?.prototype?.getComputedAttributes !== 'function') {
    console.warn(
      `${MODULE_ID} | Actor.getComputedAttributes was not found; sheet labels not wrapped.`
    );
    return;
  }

  const wrapper = function (wrapped, ...args) {
    return applySheetLabels(wrapped(...args));
  };

  if (game.modules.get('lib-wrapper')?.active) {
    libWrapper.register(
      MODULE_ID,
      'CONFIG.Actor.documentClass.prototype.getComputedAttributes',
      wrapper,
      'WRAPPER'
    );
    return;
  }

  const original = actorClass.prototype.getComputedAttributes;
  actorClass.prototype.getComputedAttributes = function (...args) {
    return wrapper.call(this, original.bind(this), ...args);
  };
}

function registerHelperWrappers() {
  wrapStaticHelper('getRollLabel', function (wrapped, rollName, ...args) {
    return getRollLabel(rollName) ?? wrapped(rollName, ...args);
  });

  wrapStaticHelper('getAttributeLabel', function (wrapped, attributeName, ...args) {
    return getAttributeLabel(attributeName) ?? wrapped(attributeName, ...args);
  });
}

function wrapStaticHelper(methodName, wrapper) {
  if (typeof BladesHelpers?.[methodName] !== 'function') {
    console.warn(
      `${MODULE_ID} | BladesHelpers.${methodName} was not found; roll labels not wrapped.`
    );
    return;
  }

  // The BitD system calls these helpers through module-scoped imports. A direct
  // wrapper avoids libWrapper attributing those helper calls to the system package.
  const original = BladesHelpers[methodName];
  BladesHelpers[methodName] = function (...args) {
    return wrapper.call(this, original.bind(this), ...args);
  };
}

function registerRenderHooks() {
  Hooks.on('renderBladesAlternateActorSheet', updateRenderedAttributeLabels);
  Hooks.on('renderBladesAlternateClassSheet', updateRenderedAttributeLabels);
}

function applySheetLabels(attributes) {
  if (!attributes || typeof attributes !== 'object') return attributes;

  const relabeled = foundry.utils.deepClone(attributes);

  for (const [attributeName, attribute] of Object.entries(relabeled)) {
    if (!attribute || typeof attribute !== 'object') continue;

    const attributeLabel = ATTRIBUTE_LABELS[attributeName];
    if (attributeLabel) attribute.label = attributeLabel;

    for (const [skillName, skill] of Object.entries(attribute.skills ?? {})) {
      const skillLabel = SKILL_LABELS[skillName];
      if (skillLabel) skill.label = skillLabel;
    }
  }

  return relabeled;
}

function getRollLabel(attributeName) {
  if (typeof attributeName !== 'string') return null;
  return ROLL_LABELS[attributeName] ?? null;
}

function getAttributeLabel(attributeName) {
  if (typeof attributeName !== 'string') return null;
  return ATTRIBUTE_LABELS[attributeName] ?? SKILL_LABELS[attributeName] ?? null;
}

function updateRenderedAttributeLabels(_app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  for (const [attributeName, labelKey] of Object.entries(ATTRIBUTE_LABELS)) {
    const label = game.i18n.localize(labelKey);
    for (const element of root.querySelectorAll(`.attributes-${attributeName} .attribute-label`)) {
      element.textContent = label;
      element.dataset.tooltip = label;
    }
  }

  for (const [skillName, labelKey] of Object.entries(SKILL_LABELS)) {
    const label = game.i18n.localize(labelKey);
    for (const element of root.querySelectorAll(`[data-roll-attribute="${skillName}"]`)) {
      element.textContent = label;
      element.dataset.tooltip = label;
    }
  }
}
