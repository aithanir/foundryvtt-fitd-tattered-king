Hooks.once('init', async function () {
  console.log('fitd-ttk-reality-fracture | Initializing Tattered King: Reality Fracture module');

  game.settings.register('fitd-ttk-reality-fracture', 'enableRealityFracture', {
    name: 'Enable Reality Fracture',
    hint: 'Enable the Tattered King: Reality Fracture tools for the Blades in the Dark system.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once('ready', function () {
  if (!game.settings.get('fitd-ttk-reality-fracture', 'enableRealityFracture')) return;
  if (game.system?.id !== 'blades-in-the-dark') return;

  console.log('fitd-ttk-reality-fracture | Reality Fracture tools enabled for Blades in the Dark.');
});
