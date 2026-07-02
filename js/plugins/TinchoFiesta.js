//=============================================================================
// TinchoFiesta.js — Modo Pedo + Chamuyo de Mauri + Itinerario de Fede
//=============================================================================
/*:
 * @plugindesc Efectos de borrachera, chamuyo (C) e itinerario (I).
 * @help
 * MODO PEDO (variable 1):
 *   40+  tropezones: cada tanto un paso se va a cualquier lado
 *   60+  mareo: la pantalla se sacude suave cada unos segundos
 *   80+  micro-blackouts... y al volver, a veces hay una ladyboy
 *        al lado tuyo que antes NO estaba.
 *
 * TECLA C — Chamuyo de Mauri: frente a un NPC con tag <push>, Mauri
 *   lo encara. Exito: Amigos de Mauri +1. Fracaso: Dignidad -1, y si
 *   el NPC es de los calientes (<push:N>) capaz se ofende y pelea.
 *   Un intento por NPC (self-switch C).
 *
 * TECLA I — Itinerario de Fede: el quest log del viaje, con el estado
 *   real de la noche y los comentarios de Fede.
 */
(function() {
    'use strict';

    var PEDO_VAR = 1;
    var AMIGOS_VAR = 4;
    var KARMA_VAR = 12;
    var DIG_VAR = 14;
    var ANGER_VAR = 17;
    var ANGER_CE = 3;
    var CHAMU_HINT_SW = 23;

    Input.keyMapper[67] = 'tchamu';   // C
    Input.keyMapper[73] = 'titiner';  // I

    function effectsOk() {
        return SceneManager._scene instanceof Scene_Map &&
               !$gameMap.isEventRunning() && !$gameMessage.isBusy() &&
               !$gamePlayer.isTransferring() && $gameSwitches.value(16);
    }

    function pedo() {
        return $gameVariables.value(PEDO_VAR);
    }

    //=========================================================================
    // 1) MODO PEDO
    //=========================================================================

    // --- tropezones: tras cada paso real, chance de un paso extra random ---
    var _GP_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function() {
        var wasMoving = this.isMoving();
        _GP_moveByInput.call(this);
        if (!wasMoving && this.isMoving() && effectsOk()) {
            var p = pedo();
            var chance = p >= 80 ? 0.22 : p >= 60 ? 0.15 : p >= 40 ? 0.08 : 0;
            if (chance > 0 && Math.random() < chance) {
                this._tpStumble = true;
            }
        }
    };

    var _GP_updateStop = Game_Player.prototype.updateStop;
    Game_Player.prototype.updateStop = function() {
        _GP_updateStop.call(this);
        if (this._tpStumble && !this.isMoving() && effectsOk()) {
            this._tpStumble = false;
            var dirs = [2, 4, 6, 8];
            var d = dirs[Math.floor(Math.random() * 4)];
            if (this.canPass(this.x, this.y, d)) {
                this.requestBalloon(6);
                this.moveStraight(d);
            }
        }
    };

    // --- mareo + blackouts por timer ---
    var lastSway = 0;
    var lastBlackout = 0;
    var blackoutPhase = 0;   // 0 nada, 1 fundido, 2 volviendo
    var blackoutTimer = 0;

    var _SM_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _SM_update.call(this);
        if (!effectsOk() && blackoutPhase === 0) return;
        var f = Graphics.frameCount;
        var p = pedo();
        // mareo
        if (p >= 60 && blackoutPhase === 0 && f - lastSway > 420) {
            lastSway = f;
            $gameScreen.startShake(2, 4, 50);
        }
        // blackout
        if (p >= 80 && blackoutPhase === 0 && f - lastBlackout > 1500 &&
            f > 600 && effectsOk()) {
            lastBlackout = f;
            blackoutPhase = 1;
            blackoutTimer = 0;
            $gameScreen.startFadeOut(25);
        }
        if (blackoutPhase === 1) {
            blackoutTimer++;
            if (blackoutTimer >= 45) {
                if (Math.random() < 0.5) spawnLadyboyNearby();
                $gameScreen.startFadeIn(35);
                blackoutPhase = 2;
                blackoutTimer = 0;
            }
        } else if (blackoutPhase === 2) {
            blackoutTimer++;
            if (blackoutTimer >= 40) blackoutPhase = 0;
        }
    };

    // --- la ladyboy que aparece de la nada ---
    var LB_LINES = [
        ["Hola guapo! You were dancing", "with me! You no remember?"],
        ["You buy me drink 5 minutes ago!", "You say I am your best friend!"],
        ["Sawatdee ka! You give me your", "Instagram! We are friends now!"],
        ["You promise me wedding invitation!", "I am Ploy friend! Jajaja!"],
    ];

    function ladyboyEventData(id, x, y, lines) {
        var cmds = [{ code: 101, indent: 0, parameters: ["", 0, 0, 2] }];
        lines.forEach(function(l) {
            cmds.push({ code: 401, indent: 0, parameters: [l] });
        });
        cmds.push({ code: 101, indent: 0, parameters: ["Untitled design (6)", 3, 0, 2] });
        cmds.push({ code: 401, indent: 0, parameters: ["...no tengo NINGUN recuerdo", "de esto."] });
        cmds.push({ code: 0, indent: 0, parameters: [] });
        return {
            id: id, name: "LB_Blackout", note: "<push>", x: x, y: y,
            pages: [{
                conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                    selfSwitchCh: "A", selfSwitchValid: false, switch1Id: 1, switch1Valid: false,
                    switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 },
                directionFix: false,
                image: { tileId: 0, characterName: "ladyboy" + (1 + Math.floor(Math.random() * 3)),
                         direction: 2, pattern: 1, characterIndex: 0 },
                list: cmds,
                moveFrequency: 3, moveSpeed: 3, moveType: 0, priorityType: 1,
                stepAnime: false, through: false, trigger: 0, walkAnime: true,
                moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false }
            }]
        };
    }

    // La ladyboy fantasma vive como clase propia que carga sus datos de
    // evento consigo misma. Antes se inyectaba en $dataMap.events y el save
    // serializaba un Game_Event sin respaldo en el JSON del mapa: al cargar,
    // event() devolvia undefined y hablarle (o la tecla F cerca) tiraba
    // "Cannot read property 'pages' of undefined". Con la clase global,
    // JsonEx restaura el prototipo al cargar y event() sigue funcionando.
    function Game_TinchoLB() { this.initialize.apply(this, arguments); }
    Game_TinchoLB.prototype = Object.create(Game_Event.prototype);
    Game_TinchoLB.prototype.constructor = Game_TinchoLB;
    Game_TinchoLB.prototype.initialize = function(mapId, eventId, data) {
        this._tpData = data;
        Game_Event.prototype.initialize.call(this, mapId, eventId);
    };
    Game_TinchoLB.prototype.event = function() { return this._tpData; };
    window.Game_TinchoLB = Game_TinchoLB;

    function spawnLadyboyNearby() {
        try {
            var spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function(o) {
                return [$gamePlayer.x + o[0], $gamePlayer.y + o[1]];
            }).filter(function(s) {
                return $gameMap.isPassable(s[0], s[1], 2) &&
                       $gameMap.eventsXy(s[0], s[1]).length === 0;
            });
            if (!spots.length) return;
            var s = spots[Math.floor(Math.random() * spots.length)];
            var id = Math.max($gameMap._events.length, $dataMap.events.length);
            var lines = LB_LINES[Math.floor(Math.random() * LB_LINES.length)];
            var ev = new Game_TinchoLB($gameMap._mapId, id,
                                       ladyboyEventData(id, s[0], s[1], lines));
            $gameMap._events[id] = ev;
            ev.requestBalloon(4); // corazon
            var scene = SceneManager._scene;
            if (scene && scene._spriteset) {
                var sp = new Sprite_Character(ev);
                scene._spriteset._characterSprites.push(sp);
                scene._spriteset._tilemap.addChild(sp);
            }
        } catch (e) {
            // nunca romper el juego por una alucinacion
        }
    }

    //=========================================================================
    // 2) TECLA C — chamuyo de Mauri
    //=========================================================================
    function pushNote(event) {
        var ev = event.event();
        if (!ev || !ev.note) return null;
        var m = ev.note.match(/<push(?::(\d+))?>/i);
        return m ? { troop: m[1] ? Number(m[1]) : 0 } : null;
    }

    function tryChamuyo() {
        if (!effectsOk()) return;
        var d = $gamePlayer.direction();
        var x2 = $gameMap.roundXWithDirection($gamePlayer.x, d);
        var y2 = $gameMap.roundYWithDirection($gamePlayer.y, d);
        var evs = $gameMap.eventsXyNt(x2, y2).filter(function(e) {
            return !e._erased && e.page() && pushNote(e);
        });
        if (!evs.length) {
            if (!$gameSwitches.value(CHAMU_HINT_SW)) {
                $gameSwitches.setValue(CHAMU_HINT_SW, true);
                $gameMessage.add("\\c[6]Tecla C frente a un desconocido:");
                $gameMessage.add("Mauri lo encara por vos.\\c[0]");
            }
            return;
        }
        var ev = evs[0];
        var key = [ev._mapId, ev.eventId(), 'C'];
        if ($gameSelfSwitches.value(key)) {
            $gameMessage.add("\\c[4]MAURI:\\c[0] A ese ya lo encare.");
            $gameMessage.add("No se chamuya dos veces, hermano.");
            return;
        }
        $gameSelfSwitches.setValue(key, true);
        ev.turnTowardPlayer();
        var chance = 0.5 + $gameVariables.value(KARMA_VAR) * 0.03 -
                     (pedo() >= 60 ? 0.15 : 0);
        if (Math.random() < chance) {
            ev.requestBalloon(4);
            AudioManager.playSe({ name: 'Applause1', volume: 70, pitch: 110, pan: 0 });
            $gameVariables.setValue(AMIGOS_VAR, $gameVariables.value(AMIGOS_VAR) + 1);
            $gameMessage.add("\\c[4]MAURI:\\c[0] Listo. Ya somos amigos.");
            $gameMessage.add("Le caimos bien. Obvio.");
            $gameMessage.add("\\c[6]Amigos de Mauri +1\\c[0]");
            ev.tpStepAside && ev.tpStepAside();
        } else {
            ev.requestBalloon(8);
            $gameVariables.setValue(DIG_VAR, $gameVariables.value(DIG_VAR) - 1);
            $gameMessage.add("\\c[4]MAURI:\\c[0] ...bueno, no siempre sale.");
            $gameMessage.add("\\c[6]Momento incomodo. Dignidad -1\\c[0]");
            var pd = pushNote(ev);
            if (pd && pd.troop > 0 && Math.random() < 0.25 &&
                !$gameSelfSwitches.value([ev._mapId, ev.eventId(), 'D'])) {
                $gameSelfSwitches.setValue([ev._mapId, ev.eventId(), 'D'], true);
                $gameVariables.setValue(ANGER_VAR, pd.troop);
                $gameTemp.tpAngryEvent = ev;
                ev.requestBalloon(5);
                $gameTemp.reserveCommonEvent(ANGER_CE);
            }
        }
    }

    //=========================================================================
    // 3) TECLA I — itinerario de Fede
    //=========================================================================
    function siguientePaso() {
        if (!$gameSwitches.value(6)) {                    // capitulo 1
            var m = $gameMap.mapId();
            if (m === 1) {
                return $gameSwitches.value(25) ?
                    "encontrar el pasaporte de Tincho" :
                    "check-in, seguridad y al embarque";
            }
            if (m === 3) return "pasar migraciones (sonreí)";
            if (m === 4) return "regatear el taxi a la ciudad";
            if ($gameSwitches.value(28)) return "buscar a Fede en la calle de Khao San";
            if (m === 14 || m === 9 || m === 15) return "probar el Bar y el Casino";
            return "KHAO SAN ROAD (barrera este de la ciudad)";
        }
        if (!$gameSwitches.value(18)) return "seguir a Fer: alitas en Soi 6";
        if (!$gameSwitches.value(21)) return "al muelle: ferry a la Full Moon";
        if (!$gameSwitches.value(20)) return "FULL MOON PARTY (no perder a Mauri)";
        return "la boda. Con la frente en alto.";
    }

    function itinerarioLines() {
        var L = [];
        var done = function(t) { L.push("\\c[3][x]\\c[0] " + t); };
        var todo = function(t) { L.push("\\c[6][ ]\\c[0] " + t); };
        var nota = function(t) { L.push("\\c[7]    " + t + "\\c[0]"); };
        L.push("\\c[14]=== ITINERARIO OFICIAL ===\\c[0]");
        L.push("\\c[14](carpeta de Fede, no tocar)\\c[0]");
        L.push("\\c[2]>> SIGUIENTE:\\c[0] " + siguientePaso());
        L.push("");
        if (!$gameSwitches.value(6)) {
            done("Sobrevivir Ezeiza");
            ($gameMap.mapId() >= 3 ? done : todo)("Pasar migraciones 'sobrio'");
            ($gameSwitches.value(3) ? done : todo)("Khao San Road");
            todo("Volver al hotel SIN multas");
            nota("presupuesto multas: 0 baht (ja)");
        } else {
            done("Capitulo 1: Bangkok (LEGENDARIO)");
            nota("multa: " + ($gameParty.gold() < 1000 ? "si, hubo" : "evitada-ish"));
            ($gameSwitches.value(18) ? done : todo)("Las alitas de Fer (POSTA existen)");
            if ($gameSwitches.value(19)) {
                done("Tincho maquillado (NO estaba en el plan)");
            }
            ($gameSwitches.value(21) ? done : todo)("Ferry de medianoche");
            ($gameSwitches.value(20) ? done : todo)("FULL MOON PARTY");
            todo("Volver enteros a Buenos Aires");
        }
        L.push("");
        L.push("\\c[2][!]\\c[0] NO PERDER A MAURI");
        nota("estado: en revisión permanente");
        L.push("\\c[7]Pedo " + pedo() + "% | Amigos " +
               $gameVariables.value(AMIGOS_VAR) + " | Fotos " +
               $gameVariables.value(3) + "\\c[0]");
        return L;
    }

    function Window_Itinerario() { this.initialize.apply(this, arguments); }
    Window_Itinerario.prototype = Object.create(Window_Base.prototype);
    Window_Itinerario.prototype.constructor = Window_Itinerario;
    Window_Itinerario.prototype.initialize = function() {
        var w = 520, h = Graphics.boxHeight - 80;
        Window_Base.prototype.initialize.call(this,
            (Graphics.boxWidth - w) / 2, 40, w, h);
        this.refresh();
    };
    Window_Itinerario.prototype.refresh = function() {
        this.contents.clear();
        var lines = itinerarioLines();
        for (var i = 0; i < lines.length; i++) {
            this.drawTextEx(lines[i], 8, i * 30);
        }
    };

    var itinWindow = null;
    function toggleItinerario() {
        var scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map)) return;
        if (itinWindow && itinWindow.parent) {
            scene.removeChild(itinWindow);
            itinWindow = null;
            return;
        }
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return;
        AudioManager.playSe({ name: 'Book1', volume: 80, pitch: 100, pan: 0 });
        itinWindow = new Window_Itinerario();
        scene.addChild(itinWindow);
    }

    var _SM_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        if (itinWindow) { this.removeChild(itinWindow); itinWindow = null; }
        _SM_terminate.call(this);
    };

    //=========================================================================
    // input
    //=========================================================================
    var _GP_update2 = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _GP_update2.call(this, sceneActive);
        if (!sceneActive) return;
        if (Input.isTriggered('tchamu')) tryChamuyo();
        if (Input.isTriggered('titiner')) toggleItinerario();
    };

    window.TinchoFiesta = {
        tryChamuyo: tryChamuyo,
        toggleItinerario: toggleItinerario,
        spawnLadyboyNearby: spawnLadyboyNearby,
        siguientePaso: siguientePaso
    };
})();
