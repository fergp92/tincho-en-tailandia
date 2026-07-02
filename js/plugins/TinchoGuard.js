//=============================================================================
// TinchoGuard.js — blindaje contra eventos huerfanos de saves viejos.
//=============================================================================
/*:
 * @plugindesc Eventos de saves que ya no existen en el mapa se desactivan en vez de crashear.
 * @help
 * Cuando un save serializo Game_Events que despues fueron eliminados del
 * mapa (deduplicacion de Ezeiza) o que nunca existieron en el JSON (las
 * ladyboys fantasma que TinchoFiesta inyectaba en runtime hasta 2026-07),
 * cualquier camino que llegue a event().pages tiraba
 * "Cannot read properties of undefined (reading 'pages')":
 *   - refresh() tras comprar/usar items
 *   - start() al hablarle al evento
 *   - page() desde la camara de Seba (tecla F)
 * Este guard hace inofensivos esos caminos y borra el huerfano en el
 * primer update. Complementa al bump de versionId (que recarga el mapa
 * al cargar el save) y a Game_TinchoLB (ladyboys que si se serializan).
 */
(function() {
    'use strict';

    function orphaned(ev) {
        return !ev.event();
    }

    var _GE_refresh = Game_Event.prototype.refresh;
    Game_Event.prototype.refresh = function() {
        if (orphaned(this)) {
            this._erased = true;
            this._pageIndex = -2;
            return;
        }
        _GE_refresh.call(this);
    };

    var _GE_page = Game_Event.prototype.page;
    Game_Event.prototype.page = function() {
        if (orphaned(this)) return null;
        return _GE_page.call(this);
    };

    var _GE_list = Game_Event.prototype.list;
    Game_Event.prototype.list = function() {
        var page = this.page();
        return page ? _GE_list.call(this) : null;
    };

    var _GE_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (orphaned(this)) return;
        _GE_start.call(this);
    };

    // limpieza proactiva: el huerfano desaparece en el primer frame
    var _GE_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        if (!this._erased && orphaned(this)) {
            this._erased = true;
            this._pageIndex = -2;
            return;
        }
        _GE_update.call(this);
    };
})();
