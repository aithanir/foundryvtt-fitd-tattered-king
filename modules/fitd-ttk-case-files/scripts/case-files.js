Hooks.once('init', async function () {
  console.log('fitd-ttk-case-files | Initializing Tattered King: Case Files module');

  game.settings.register('fitd-ttk-case-files', 'enableCaseFiles', {
    name: 'Enable Tattered King: Case Files',
    hint: 'Enable the Tattered King: Case Files tools for the Blades in the Dark system.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Load JSON schemas
  const mysteryCommonSchema = await fetch(
    'modules/fitd-ttk-case-files/schemas/mystery-common.json'
  ).then((r) => r.json());
  const caseFileSchema = await fetch('modules/fitd-ttk-case-files/schemas/case-file.json').then(
    (r) => r.json()
  );
  const evidenceCardSchema = await fetch('modules/fitd-ttk-case-files/schemas/evidence.json').then(
    (r) => r.json()
  );
  const mysteryCardSchema = await fetch(
    'modules/fitd-ttk-case-files/schemas/mystery-card.json'
  ).then((r) => r.json());

  game.modules.get('fitd-ttk-case-files').schemas = {
    mysteryCommon: mysteryCommonSchema,
    caseFile: caseFileSchema,
    evidenceCard: evidenceCardSchema,
    mysteryCard: mysteryCardSchema,
  };

  // Validation function
  game.modules.get('fitd-ttk-case-files').validateData = function (type, data) {
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
  if (!game.settings.get('fitd-ttk-case-files', 'enableCaseFiles')) return;
  if (game.system?.id !== 'blades-in-the-dark') return;

  console.log('fitd-ttk-case-files | Case Files tools enabled for Blades in the Dark.');
});
