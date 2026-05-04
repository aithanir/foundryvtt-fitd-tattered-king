Hooks.once("init", async function() {
  console.log("fitd-ttk-case-files | Initializing Tattered King: Case Files module");

  game.settings.register("fitd-ttk-case-files", "enableCaseFiles", {
    name: "Enable Tattered King: Case Files",
    hint: "Enable the Tattered King: Case Files tools for the Blades in the Dark system.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", function() {
  if (!game.settings.get("fitd-ttk-case-files", "enableCaseFiles")) return;
  if (game.system?.id !== "blades-in-the-dark") return;

  console.log("fitd-ttk-case-files | Case Files tools enabled for Blades in the Dark.");
});
