// AutoCiv initialization for main menu

// Create AutoCiv config object
var autocivConfig = {
    needsToSave: false,
    needsToReloadHotkeys: false,
    set: function (key, value)
    {
        Engine.ConfigDB_CreateValue("user", key, value);
        this.needsToSave = true;
        this.needsToReloadHotkeys = this.needsToReloadHotkeys || key.startsWith("hotkey.");
    },
    get: function (key) { return Engine.ConfigDB_GetValue("user", key) },
    save: function ()
    {
        if (this.needsToSave) Engine.ConfigDB_SaveChanges("user");
        if (this.needsToReloadHotkeys) Engine.ReloadHotkeys();
    }
};

function autociv_initCheck()
{
    let state = {
        "reasons": new Set(),
        "showReadme": false,
        "showSuggestDefaultChanges": false
    };

    // Check settings
    {
        let settings = Engine.ReadJSONFile("moddata/autociv_default_config.json");

        // Reset all autociv settings to default. Custom autociv settings added won't be affected.
        if (autocivConfig.get("autociv.settings.reset.all") === "true")
        {
            for (let key in settings)
                autocivConfig.set(key, settings[key]);
            autocivConfig.save();
            state.reasons.add("AutoCiv settings reset by user.");
            return state;
        }

        const allHotkeys = new Set(Object.keys(Engine.GetHotkeyMap()));
        // Normal check. Check for entries missing
        for (let key in settings)
        {
            if (key.startsWith("hotkey."))
            {
                if (!allHotkeys.has(key.substring("hotkey.".length)))
                {
                    autocivConfig.set(key, settings[key]);
                    state.reasons.add("New AutoCiv hotkey(s) added.");
                }
            }
            else if (autocivConfig.get(key) == "")
            {
                autocivConfig.set(key, settings[key]);
                state.reasons.add("New AutoCiv setting(s) added.");
            }
        }
    }

    // Check for showSuggestDefaultChanges
    {
        const key = "autociv.mainmenu.suggestDefaultChanges";
        if (autocivConfig.get(key) == "true")
        {
            state.showSuggestDefaultChanges = true;
            autocivConfig.set(key, "false");
        }
    }

    // Check if show readme (first time user case)
    {
        const key = "autociv.settings.autociv_readme.seen";
        if (autocivConfig.get(key) == "false")
        {
            state.showReadme = true;
            autocivConfig.set(key, "true");
        }
    }

    autocivConfig.save();
    return state;
}

// Set global hotkey for readme (using correct Engine API)
Engine.SetGlobalHotkey("autociv.open.autociv_readme", "Press", () =>
{
    Engine.OpenChildPage("page_autociv_readme.xml");
});

// Store state globally
var autocivState = null;

function showAutoCivMessages() {
    if (!autocivState) return;

    const currentState = autocivState;
    autocivState = null; // Clear to prevent multiple shows

    // Show reasons message if any
    if (currentState.reasons.size != 0) {
        let message = ["AutoCiv made some changes.\n"].
            concat(Array.from(currentState.reasons).map(v => ` · ${v}`)).
            join("\n");

        messageBox(500, 300, message,
            "AutoCiv mod notice",
            ["Ok"],
            []
        );
    }

    // Show suggest changes message if needed
    if (currentState.showSuggestDefaultChanges) {
        let message = `
Some default settings will improve with AutoCiv if changed.

Do you want to make these changes?

Disable hotkey:
"hotkey.camera.lastattackfocus" = "Space"

Add auto-queue hotkeys:
hotkey.session.queueunit.autoqueueoff = "Alt+W"
hotkey.session.queueunit.autoqueueon = "Alt+Q"
        `;

        messageBox(500, 300, message,
            "AutoCiv mod notice",
            ["Ok, change", "No"],
            [() =>
            {
                autocivConfig.set("hotkey.camera.lastattackfocus", "");
                autocivConfig.set("hotkey.session.queueunit.autoqueueoff", "Alt+W");
                autocivConfig.set("hotkey.session.queueunit.autoqueueon", "Alt+Q");
                autocivConfig.save();
            },
            () => {}]
        );
    }

    // Show readme
    if (currentState.showReadme) {
        Engine.OpenChildPage("page_autociv_readme.xml");
    }
}

function tryShowMessages() {
    if (!autocivState) return false;

    // Check if we're in the right context
    if (typeof messageBox === 'undefined') return false;

    showAutoCivMessages();
    return true;
}

// Hook into the main menu initialization
if (typeof init === 'function') {
    const originalInit = init;
    init = function(data, hotloadData) {
        // Run AutoCiv initialization first
        autocivState = autociv_initCheck();

        // Call the original init
        const result = originalInit(data, hotloadData);

        // Try to show messages if needed
        if (autocivState.reasons.size != 0 || autocivState.showSuggestDefaultChanges || autocivState.showReadme) {
            if (!tryShowMessages()) {
                // Use onTick if immediate show fails
                let tickCount = 0;
                const checkTick = function() {
                    tickCount++;
                    if (tryShowMessages()) {
                        // Success - remove the handler
                        if (globalOnTick) {
                            const idx = globalOnTick.indexOf(checkTick);
                            if (idx !== -1) globalOnTick.splice(idx, 1);
                        }
                    } else if (tickCount > 60) { // ~1 second at 60fps
                        if (globalOnTick) {
                            const idx = globalOnTick.indexOf(checkTick);
                            if (idx !== -1) globalOnTick.splice(idx, 1);
                        }
                        // Force show anyway
                        if (typeof messageBox !== 'undefined') {
                            showAutoCivMessages();
                        }
                    }
                };
                globalOnTick.push(checkTick);
            }
        }

        return result;
    };
}
