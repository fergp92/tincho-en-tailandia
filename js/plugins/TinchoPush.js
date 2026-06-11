//=============================================================================
// TinchoPush.js — empuja NPCs caminando contra ellos. Algunos se enojan.
//=============================================================================
/*:
 * @plugindesc Empujon de NPCs por choque + enojo opcional con pelea.
 * @help
 * Tags en la NOTA del evento:
 *   <push>      El NPC se puede empujar (1 tile en la direccion del choque).
 *               Si no hay lugar atras, se corre a un costado (anti-bloqueo).
 *   <push:N>    Igual, pero al SEGUNDO empujon se enoja y pelea (troop N).
 *               Despues de la pelea (gane o pierda) queda calmado para
 *               siempre (self-switch D) y se deja empujar normal.
 *
 * Requiere: Common Event 3 (la escena de enojo; lee el troop de la
 * variable 17) y el SE 'Push'.
 */
(function() {
    'use strict';

    var ANGER_VAR = 17;      // variable con el troop id del enojado
    var ANGER_CE = 3;        // common event de la pelea
    var ANGER_AT_PUSH = 2;   // se enoja al 2do empujon

    function pushData(event) {
        var ev = event.event();
        if (!ev || !ev.note) return null;
        var m = ev.note.match(/<push(?::(\d+))?>/i);
        if (!m) return null;
        return { troop: m[1] ? Number(m[1]) : 0 };
    }

    Game_Event.prototype.tpPushable = function() {
        if (this._erased || !this.page()) return false;
        if (this._priorityType !== 1) return false;
        return !!pushData(this);
    };

    Game_Event.prototype.tpCalmado = function() {
        return $gameSelfSwitches.value([this._mapId, this._eventId, 'D']);
    };

    Game_Event.prototype.tpStepAside = function() {
        var dirs = [2, 4, 6, 8];
        for (var i = 0; i < dirs.length; i++) {
            if (this.canPass(this.x, this.y, dirs[i])) {
                this.moveStraight(dirs[i]);
                return true;
            }
        }
        return false;
    };

    Game_Event.prototype.tpShove = function(d) {
        var moved = false;
        if (this.canPass(this.x, this.y, d)) {
            this.moveStraight(d);
            moved = true;
        } else {
            // anti-bloqueo: probar los costados
            var side = (d === 2 || d === 8) ? [4, 6] : [2, 8];
            for (var i = 0; i < side.length; i++) {
                if (this.canPass(this.x, this.y, side[i])) {
                    this.moveStraight(side[i]);
                    moved = true;
                    break;
                }
            }
        }
        if (moved) {
            AudioManager.playSe({ name: 'Push', volume: 90, pitch: 100, pan: 0 });
            this.requestBalloon(Math.random() < 0.4 ? 6 : 8); // sudor o silencio
        } else {
            this.requestBalloon(6);
        }
        return moved;
    };

    Game_Event.prototype.tpPushed = function(d) {
        var data = pushData(this);
        if (!data) return;
        this._tpPushCount = (this._tpPushCount || 0) + 1;
        var angry = data.troop > 0 && !this.tpCalmado();
        if (angry && this._tpPushCount >= ANGER_AT_PUSH) {
            // se pudrio: pelea
            $gameSelfSwitches.setValue([this._mapId, this._eventId, 'D'], true);
            $gameVariables.setValue(ANGER_VAR, data.troop);
            $gameTemp.tpAngryEvent = this;
            this.requestBalloon(5); // furia
            this.turnTowardPlayer();
            $gameTemp.reserveCommonEvent(ANGER_CE);
            return;
        }
        this.tpShove(d);
    };

    var _GP_moveStraight = Game_Player.prototype.moveStraight;
    Game_Player.prototype.moveStraight = function(d) {
        if (!this.canPass(this.x, this.y, d) &&
            !$gameMap.isEventRunning() && !$gameMessage.isBusy()) {
            var x2 = $gameMap.roundXWithDirection(this.x, d);
            var y2 = $gameMap.roundYWithDirection(this.y, d);
            var evs = $gameMap.eventsXyNt(x2, y2).filter(function(e) {
                return e.tpPushable();
            });
            if (evs.length > 0) {
                evs[0].tpPushed(d);
            }
        }
        _GP_moveStraight.call(this, d);
    };

    // hook para que el CE pueda correr al enojado tras la pelea
    window.TinchoPush = {
        afterFight: function() {
            var ev = $gameTemp.tpAngryEvent;
            if (ev) {
                ev.tpStepAside();
                $gameTemp.tpAngryEvent = null;
            }
        }
    };
})();
