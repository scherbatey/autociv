AutocivControls.StatsOverlay = class
{
    autociv_statsOverlay = Engine.GetGUIObjectByName("autociv_statsOverlay");
    showResources = Engine.ConfigDB_GetValue("user", "autociv.stats.resources") == "true";
    showAllies = Engine.ConfigDB_GetValue("user", "autociv.stats.alliesview") == "true";
    showMilitary = Engine.ConfigDB_GetValue("user", "autociv.stats.militarycomposition") == "true";
    showKD = Engine.ConfigDB_GetValue("user", "autociv.stats.kdratio") == "true";

    preStatsDefault = {
        " Player   ": state => this.stateName(state), // Player name
        "■ ": state => this.stateStrength(state), // Player color
        "# ": state => `${state.playerNumber}`, // Player number
    };
    preStatsTeam = {
        "T ": state => state.team != -1 ? `${state.team + 1}` : "", // Team number
    };

    listTeamRepresentatives = {};
    listUndefeatedPlayerIndices = [];
    preStatsSeenBefore = {};
    stateStrengthsCached = {};
    widths = {}; // static widths for preStatsDefault and preStatsTeam
    tickPeriod = 1;
    textFont = "mono-stroke-10";
    configKey_visible = "autociv.session.statsOverlay.visible";
    configKey_brightnessThreshold = "autociv.session.statsOverlay.brightnessThreshold";
    configKey_symbolizeRating = "autociv.session.statsOverlay.symbolizeRating";

    constructor()
    {
        this.autociv_statsOverlay.hidden = Engine.ConfigDB_GetValue("user", this.configKey_visible) == "false";
        this.autociv_brightnessThreshold = Engine.ConfigDB_GetValue("user", this.configKey_brightnessThreshold);
        this.autociv_symbolizeRating = Engine.ConfigDB_GetValue("user", this.configKey_symbolizeRating) == "true";

        // Precompute static widths for preStatsDefault and preStatsTeam
        let contentlist = { ...this.preStatsDefault, ...this.preStatsTeam };
        for (let name in contentlist)
            this.widths[name] = name.length;

        this.autociv_statsOverlay.onTick = this.onTick.bind(this);
        this.updatePlayerLists();
        registerPlayersFinishedHandler(this.updatePlayerLists.bind(this));
        this.update();
        registerConfigChangeHandler(this.onConfigChanges.bind(this));
    }

    onConfigChanges(changes)
    {
        let needsUpdate = false;

        if (changes.has(this.configKey_visible))
        {
            this.autociv_statsOverlay.hidden = Engine.ConfigDB_GetValue("user", this.configKey_visible) == "false";
            needsUpdate = true;
        }
        if (changes.has(this.configKey_brightnessThreshold))
        {
            this.autociv_brightnessThreshold = Engine.ConfigDB_GetValue("user", this.configKey_brightnessThreshold);
            needsUpdate = true;
        }
        if (changes.has(this.configKey_symbolizeRating))
        {
            this.autociv_symbolizeRating = Engine.ConfigDB_GetValue("user", this.configKey_symbolizeRating) == "true";
            needsUpdate = true;
        }

        // Handle stats-related config keys
        if (changes.has("autociv.stats.resources"))
        {
            this.showResources = Engine.ConfigDB_GetValue("user", "autociv.stats.resources") == "true";
            needsUpdate = true;
        }
        if (changes.has("autociv.stats.alliesview"))
        {
            this.showAllies = Engine.ConfigDB_GetValue("user", "autociv.stats.alliesview") == "true";
            needsUpdate = true;
        }
        if (changes.has("autociv.stats.militarycomposition"))
        {
            this.showMilitary = Engine.ConfigDB_GetValue("user", "autociv.stats.militarycomposition") == "true";
            needsUpdate = true;
        }
        if (changes.has("autociv.stats.kdratio"))
        {
            this.showKD = Engine.ConfigDB_GetValue("user", "autociv.stats.kdratio") == "true";
            needsUpdate = true;
        }

        if (needsUpdate)
            this.update();
    }

    stateName(state)
    {
        if (state.state == "defeated")
            return `[icon="icon_defeated_autociv" displace="-2 3"]${state.name}`;
        else if (state.state == "won")
            return `[icon="icon_won_autociv" displace="-2 3"]${state.name}`;
        return state.name;
    }

    stateStrength(state)
    {
        if (!this.autociv_symbolizeRating || (controlsPlayer(g_ViewedPlayer) && !g_IsNetworked))
            return "\u25A0";
        if (!this.stateStrengthsCached[state.playerNumber])
        {
            let aiDiff = 1;
            let userRating = 1200;

            try {
                aiDiff = g_InitAttributes.settings.PlayerData[state.playerNumber].AIDiff;
                userRating = splitRatingFromNick(state.name).rating;
            } catch (err) {}

            if (userRating > 1800 || aiDiff === 5)
                this.stateStrengthsCached[state.playerNumber] = "\u25B2";
            else if (userRating > 1600 || aiDiff === 4)
                this.stateStrengthsCached[state.playerNumber] = "\u25C6";
            else if (userRating > 1400 || aiDiff === 3)
                this.stateStrengthsCached[state.playerNumber] = "\u25A0";
            else if (userRating > 1200 || aiDiff === 2)
                this.stateStrengthsCached[state.playerNumber] = "\u25AC";
            else
                this.stateStrengthsCached[state.playerNumber] = "\u25A1";
        }
        return this.stateStrengthsCached[state.playerNumber];
    }

    toggle()
    {
        this.autociv_statsOverlay.hidden = !this.autociv_statsOverlay.hidden;
        Engine.ConfigDB_CreateAndSaveValue(
            "user",
            this.configKey_visible,
            this.autociv_statsOverlay.hidden ? "false" : "true"
        );
    }

    onTick()
    {
        if (this.autociv_statsOverlay.hidden)
            return;

        if (g_LastTickTime % this.tickPeriod == 0)
            this.update();
    }

    updatePlayerLists()
    {
        this.listUndefeatedPlayerIndices = [];
        this.listTeamRepresentatives = {};
        for (let i = 1; i < g_Players.length; ++i)
        {
            if (g_Players[i].state !== "defeated")
            {
                this.listUndefeatedPlayerIndices.push(i - 1);
                const group = g_Players[i].team;
                if (group != -1 && !this.listTeamRepresentatives[group])
                    this.listTeamRepresentatives[group] = i;
            }
        }
    }

    maxIndex(list)
    {
        let index = this.listUndefeatedPlayerIndices[0] ?? 0;
        let value = list[index];
        for (let i = index + 1; i < list.length; i++)
            if (this.listUndefeatedPlayerIndices.includes(i) && list[i] > value)
            {
                value = list[i];
                index = i;
            }
        return index;
    }

    minIndex(list)
    {
        let index = this.listUndefeatedPlayerIndices[0] ?? 0;
        let value = list[index];
        for (let i = index + 1; i < list.length; i++)
            if (this.listUndefeatedPlayerIndices.includes(i) && list[i] < value)
            {
                value = list[i];
                index = i;
            }
        return index;
    }

    playerColor(state)
    {
        return brightenedColor(g_DiplomacyColors.getPlayerColor(state.playerNumber), this.autociv_brightnessThreshold);
    }

    teamColor(state)
    {
        return brightenedColor(g_DiplomacyColors.getPlayerColor([this.listTeamRepresentatives[state.team] || state.playerNumber]), this.autociv_brightnessThreshold);
    }

    leftPadTrunc(text, size)
    {
        return text.substring(0, size).padStart(size);
    }

    rightPadTruncPreStats(text, num)
    {
        let key = `${text} ${num}`;
        if (!this.preStatsSeenBefore[key])
        {
            const Regexp = /(^\[.*?\])(.*)/;
            let str = "";
            if (num > 2 && Regexp.test(text))
                str = text.replace(Regexp, "$1") + splitRatingFromNick(text.replace(Regexp, "$2")).nick.slice(0, num - 4).padEnd(num - 3);
            else if (num > 2)
                str = splitRatingFromNick(text).nick.slice(0, num - 1).padEnd(num);
            else
                str = text.padEnd(num);
            this.preStatsSeenBefore[key] = str;
        }
        return this.preStatsSeenBefore[key];
    }

    calcWidth(rowLength)
    {
        if (rowLength <= 0) return 0;
        let spaceSize = this.autociv_statsOverlay.getPreferredTextSize(" ", this.textFont);
        let bufferZone = this.autociv_statsOverlay.buffer_zone || 0;
        return Math.ceil(spaceSize.width * 0.62 * rowLength + bufferZone * 2);
    }

    calcHeight(rowQuantity)
    {
        if (rowQuantity <= 0) return 0;
        let spaceSize = this.autociv_statsOverlay.getPreferredTextSize(" ", this.textFont);
        let bufferZone = this.autociv_statsOverlay.buffer_zone || 0;
        return Math.ceil(spaceSize.width * 1.2 * rowQuantity + bufferZone);
    }

    computeSize(rowQuantity, rowLength)
    {
        if (rowQuantity <= 0 || rowLength <= 0)
            return "0 0 0 0";
        return `100%-${this.calcWidth(rowLength)} 100%-220-${this.calcHeight(rowQuantity)} 100% 100%-220`;
    }

    // Build the current stats columns based on config flags
    getCurrentStats()
    {
        const stats = {};

        // Always show phase and population
        stats[" P"] = state => state.phase;
        stats[" Pop"] = state => state.classCounts_Support + state.classCounts_Infantry + state.classCounts_Cavalry;

        // Military composition columns (if enabled)
        if (this.showMilitary)
        {
            // Support column label depends on showResources (original mod behavior)
            stats[this.showResources ? " Sup" : " Fem"] = state => state.classCounts_Support;
            stats[" Inf"] = state => state.classCounts_Infantry;
            stats[" Cav"] = state => state.classCounts_Cavalry;
            stats[" Sig"] = state => state.classCounts_Siege;
            stats[" Chp"] = state => state.classCounts_Champion;
            stats[" Mel"] = state => state.classCounts_Melee;
            stats[" Ran"] = state => state.classCounts_Ranged;
        }

        // Resource columns (if enabled)
        if (this.showResources)
        {
            stats["   Food"] = state => Math.round(state.resourceCounts["food"]);
            stats["   Wood"] = state => Math.round(state.resourceCounts["wood"]);
            stats["  Stone"] = state => Math.round(state.resourceCounts["stone"]);
            stats["  Metal"] = state => Math.round(state.resourceCounts["metal"]);
            stats[" Tec"] = state => state.researchedTechsCount;
        }

        // KD columns (if enabled)
        if (this.showKD)
        {
            stats[" Kill"] = state => state.enemyUnitsKilledTotal ?? 0;
            stats[" Loss"] = state => state.unitsLost ?? 0;
            stats["   KDr"] = state => {
                const kills = state.enemyUnitsKilledTotal ?? 0;
                const losses = state.unitsLost ?? 0;
                return losses ? Math.round(kills * 100 / losses) / 100 : 0;
            };
        }

        return stats;
    }

    update()
    {
        Engine.ProfileStart("AutocivControls.statsOverlay:update");

        const playerStates = Engine.GuiInterfaceCall("autociv_GetStatsOverlay").players;

        if (!playerStates)
        {
            Engine.ProfileStop();
            return;
        }

        const filteredStates = playerStates.filter((state, index) =>
        {
            if (index == 0)
                return false;

            state.playerNumber = index;

            if (g_IsObserver)
                return true;

            if (index == g_ViewedPlayer)
                return true;

            if (!g_IsNetworked)
                return false;

            if (this.showAllies)
            {
                if (!playerStates[g_ViewedPlayer])
                    return false;

                const hasSharedLos = playerStates[g_ViewedPlayer].hasSharedLos?.[index] || false;
                const isMutualAlly = g_Players[g_ViewedPlayer]?.isMutualAlly?.[index] || false;

                return hasSharedLos && isMutualAlly;
            }

            return false;
        });

        if (filteredStates.length === 0)
        {
            this.autociv_statsOverlay.caption = "";
            this.autociv_statsOverlay.size = "0 0 0 0";
            Engine.ProfileStop();
            return;
        }

        // Build current stats columns based on flags
        const currentStats = this.getCurrentStats();
        const statsWidths = {};
        for (let key in currentStats)
            statsWidths[key] = key.length;

        // Build header
        const preStatsDefaultKeys = Object.keys(this.preStatsDefault);
        const preStatsTeamKeys = Object.keys(this.preStatsTeam);
        const statsKeys = Object.keys(currentStats);

        const headerParts = [
            ...preStatsDefaultKeys.map(key => this.leftPadTrunc(key, this.widths[key])),
            ...preStatsTeamKeys.map(key => this.leftPadTrunc(key, this.widths[key])),
            ...statsKeys.map(key => this.leftPadTrunc(key, statsWidths[key]))
        ];
        let header = headerParts.join("");
        const rowLength = header.length;
        header = setStringTags(header, { "color": "250 250 250" }) + "\n";

        // Compute min/max for each stat column (only for stats, not pre-stats)
        const values = {};
        for (let stat of statsKeys)
        {
            let list = filteredStates.map(currentStats[stat]);
            values[stat] = {
                "list": list,
                "min": this.minIndex(list),
                "max": this.maxIndex(list),
            };
        }

        // Build each player's line
        const entries = filteredStates.map((state, index) =>
        {
            // Pre-stats default part (name, strength symbol, player number)
            const preStatsDefaultStr = preStatsDefaultKeys
                .map(key => this.rightPadTruncPreStats(this.preStatsDefault[key](state), this.widths[key]))
                .join("");

            // Pre-stats team part
            const preStatsTeamStr = preStatsTeamKeys
                .map(key => this.rightPadTruncPreStats(this.preStatsTeam[key](state), this.widths[key]))
                .join("");

            // Stats part
            const statsStr = statsKeys.map(stat =>
            {
                let text = this.leftPadTrunc(values[stat].list[index].toString(), statsWidths[stat]);
                switch (index)
                {
                    case values[stat].max: return setStringTags(text, { "color": "230 230 0" });
                    case values[stat].min: return setStringTags(text, { "color": "255 100 100" });
                    default: return text;
                }
            }).join("");

            const fullLine = preStatsDefaultStr + preStatsTeamStr + statsStr;

            if (state.state == "defeated")
                return setStringTags(fullLine, { "color": "255 255 255 128" });

            return setStringTags(preStatsDefaultStr, { "color": this.playerColor(state) }) +
                   setStringTags(preStatsTeamStr, { "color": this.teamColor(state) }) +
                   statsStr;
        }).join("\n");

        this.autociv_statsOverlay.caption = "";
        this.autociv_statsOverlay.size = this.computeSize(filteredStates.length + 1, rowLength);
        this.autociv_statsOverlay.caption = setStringTags(header + entries, {
            "color": "250 250 250 250",
            "font": this.textFont
        });

        Engine.ProfileStop();
    }
};
