//=============================================================================
// TinchoCamara.js — la camara de Seba. Tecla F = foto a lo que tenes adelante.
//=============================================================================
/*:
 * @plugindesc Camara de Seba (tecla F): fotos a cosas taggeadas <foto>.
 * @help
 * Tags en la NOTA del evento:
 *   <foto>       Sujeto fotogenico: Fotos de Seba (var 3) +1. Una sola vez.
 *   <foto:leg>   FOTO LEGENDARIA: +2, fanfarria. Escasas (4 en todo el juego).
 *
 * Sin tag pero con nombre que matchee policia/security/officer/bouncer/
 * inmigra -> gag de autoridad (sin foto). Nombre con 'seba' -> gag de Seba.
 * Sin evento adelante -> selfie (no cuenta, son para el grupo de wsp).
 *
 * Alcance: 3 tiles en la direccion que miras (sirve por encima de
 * mostradores). El primer F muestra el hint (switch 24 lo recuerda).
 * Las fotos ya sacadas se guardan en el save ($gameSystem).
 */
(function() {
    'use strict';

    var FOTO_VAR = 3;        // Fotos de Seba
    var HINT_SWITCH = 24;    // ya se mostro el hint de la camara
    var RANGE = 3;           // tiles de alcance hacia adelante

    Input.keyMapper[70] = 'tfoto';   // tecla F = Foto

    var FOTO_LINES = [
        "Seba: CONTENIDO. Esa va al grupo.",
        "Seba: Tssss... portada del album.",
        "Seba: Esa la imprimo y la cuelgo.",
        "Seba: Clic. Material pal discurso."
    ];
    var LEGEND_LINES = [
        "Seba: PARÁ PARÁ PARÁ...",
        "Seba: Esta foto paga el viaje entero."
    ];
    var REPEAT_LINES = [
        "Seba: Ya la tengo a esa, papá.",
        "Seba: Dos veces lo mismo no. Soy artista."
    ];
    var MEH_LINES = [
        "Seba: ...No. Eso no es contenido.",
        "Seba: ¿Qué le ves? Buscá algo con onda."
    ];
    var SELFIE_LINES = [
        "Seba: ¿Selfie? Las selfies no cuentan,",
        "son para el grupo de WhatsApp."
    ];
    var AUTHORITY_LINE = "Seba: Guardá ESO. ¿Querés que nos deporten?";
    var SEBA_LINE = "Seba: A mí no. Yo SACO las fotos.";

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function fotoTag(event) {
        var ev = event.event();
        if (!ev || !ev.note) return null;
        var m = ev.note.match(/<foto(?::(leg))?>/i);
        if (!m) return null;
        return { leg: !!m[1] };
    }

    function specialName(event) {
        var ev = event.event();
        if (!ev || !ev.name) return null;
        if (/policia|security|officer|bouncer|inmigra/i.test(ev.name)) return 'authority';
        if (/seba/i.test(ev.name)) return 'seba';
        return null;
    }

    Game_System.prototype.tfotoShots = function() {
        if (!this._tfotoShots) this._tfotoShots = {};
        return this._tfotoShots;
    };

    function shotKey(event) {
        return event._mapId + ':' + event._eventId;
    }

    function clickSe() {
        AudioManager.playSe({ name: 'Switch2', volume: 90, pitch: 120, pan: 0 });
        $gameScreen.startFlash([255, 255, 255, 200], 20);
    }

    function showHintOnce() {
        if ($gameSwitches.value(HINT_SWITCH)) return false;
        $gameSwitches.setValue(HINT_SWITCH, true);
        $gameMessage.add("\\c[6]Seba trajo la cámara: tocá F y le");
        $gameMessage.add("saca una foto a lo que tengas adelante");
        $gameMessage.add("(hasta 3 pasos).\\c[0] Lo fotogénico suma");
        $gameMessage.add("\\c[6]Fotos de Seba\\c[0]. Hay LEGENDARIAS.");
        return true;
    }

    // primer evento "visible" mirando hacia adelante, hasta RANGE tiles
    function findTarget() {
        var d = $gamePlayer.direction();
        var x = $gamePlayer.x;
        var y = $gamePlayer.y;
        for (var i = 0; i < RANGE; i++) {
            x = $gameMap.roundXWithDirection(x, d);
            y = $gameMap.roundYWithDirection(y, d);
            var evs = $gameMap.events().filter(function(e) {
                return e.pos(x, y) && !e._erased && e.page();
            });
            if (evs.length > 0) {
                // si hay varios en el tile, priorizar el taggeado
                evs.sort(function(a, b) {
                    return (fotoTag(b) ? 1 : 0) - (fotoTag(a) ? 1 : 0);
                });
                return evs[0];
            }
        }
        return null;
    }

    function tryFoto() {
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return false;
        if (!$gamePlayer.canMove()) return false;
        if (showHintOnce()) return true;

        clickSe();
        var target = findTarget();

        if (!target) {
            // selfie
            if (!$gameTemp._tfotoSelfieDicho) {
                $gameTemp._tfotoSelfieDicho = true;
                SELFIE_LINES.forEach(function(l) { $gameMessage.add(l); });
            } else if (Math.random() < 0.2) {
                $gameMessage.add("Seba: Otra selfie no. Buscáme CONTENIDO.");
            }
            return true;
        }

        var special = specialName(target);
        var tag = fotoTag(target);

        if (special === 'seba' && !tag) {
            target.requestBalloon(8);
            $gameMessage.add(SEBA_LINE);
            return true;
        }
        if (special === 'authority' && !tag) {
            target.requestBalloon(5);
            target.turnTowardPlayer();
            $gameMessage.add(AUTHORITY_LINE);
            return true;
        }
        if (!tag) {
            $gameMessage.add(pick(MEH_LINES));
            return true;
        }

        var key = shotKey(target);
        if ($gameSystem.tfotoShots()[key]) {
            target.requestBalloon(8);
            $gameMessage.add(pick(REPEAT_LINES));
            return true;
        }

        $gameSystem.tfotoShots()[key] = true;
        var gain = tag.leg ? 2 : 1;
        $gameVariables.setValue(FOTO_VAR, $gameVariables.value(FOTO_VAR) + gain);

        if (tag.leg) {
            target.requestBalloon(4);
            AudioManager.playSe({ name: 'Applause1', volume: 90, pitch: 100, pan: 0 });
            $gameScreen.startFlash([255, 255, 200, 255], 40);
            $gameMessage.add(pick(LEGEND_LINES));
            $gameMessage.add("\\c[14]*** FOTO LEGENDARIA (+2) ***\\c[0]");
            $gameMessage.add("Fotos de Seba: \\c[6]\\V[" + FOTO_VAR + "]\\c[0]");
        } else {
            target.requestBalloon(1);
            $gameMessage.add(pick(FOTO_LINES));
            $gameMessage.add("Fotos de Seba: \\c[6]\\V[" + FOTO_VAR + "]\\c[0]");
        }
        return true;
    }

    var _GP_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _GP_update.call(this, sceneActive);
        if (sceneActive && Input.isTriggered('tfoto')) {
            tryFoto();
        }
    };

    window.TinchoCamara = { tryFoto: tryFoto, findTarget: findTarget };
})();
