Hooks.once('init', async function () {
  console.log('fitd-ttk-harm | Initializing Tattered King: Harm module');

  game.settings.register('fitd-ttk-harm', 'enableHarmTracker', {
    name: 'Enable Tattered King: Harm',
    hint: 'Enable the Tattered King: Harm tools for the Blades in the Dark system.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Load JSON schema
  const harmCommonSchema = await fetch('modules/fitd-ttk-harm/schemas/harm-common.json').then((r) =>
    r.json()
  );
  const harmCardSchema = await fetch('modules/fitd-ttk-harm/schemas/harm-card.json').then((r) =>
    r.json()
  );
  const harmConditionsSchema = await fetch(
    'modules/fitd-ttk-harm/schemas/harm-conditions.json'
  ).then((r) => r.json());

  game.modules.get('fitd-ttk-harm').schemas = {
    harmCommon: harmCommonSchema,
    harmCard: harmCardSchema,
    harmConditions: harmConditionsSchema,
  };

  // Validation function
  game.modules.get('fitd-ttk-harm').validateData = function (type, data) {
    const schema = this.schemas[type];
    if (!schema) throw new Error(`Unknown schema type: ${type}`);
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (!valid) {
      console.error('Validation errors:', validate.errors);
      throw new Error(`Invalid ${type} data: ${validate.errors.map((e) => e.message).join(', ')}`);
    }
    return true;
  };
});

Hooks.once('ready', function () {
  if (!game.settings.get('fitd-ttk-harm', 'enableHarmTracker')) return;
  if (game.system?.id !== 'blades-in-the-dark') return;

  console.log('fitd-ttk-harm | Harm tools enabled for Blades in the Dark.');
});
