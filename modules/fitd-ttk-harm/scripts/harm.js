Hooks.once("init", async function() {
  console.log("fitd-ttk-harm | Initializing Tattered King: Harm module");

  game.settings.register("fitd-ttk-harm", "enableHarmTracker", {
    name: "Enable Tattered King: Harm",
    hint: "Enable the Tattered King: Harm tools for the Blades in the Dark system.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", function() {
  if (!game.settings.get("fitd-ttk-harm", "enableHarmTracker")) return;
  if (game.system?.id !== "blades-in-the-dark") return;

  console.log("fitd-ttk-harm | Harm tools enabled for Blades in the Dark.");
});
