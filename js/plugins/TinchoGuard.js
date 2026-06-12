//=============================================================================
// TinchoGuard.js — blindaje contra eventos huerfanos de saves viejos.
//=============================================================================
/*:
 * @plugindesc Eventos de saves que ya no existen en el mapa se desactivan en vez de crashear.
 * @help
 * Cuando un save serializo Game_Events que despues fueron eliminados del
 * mapa (p.ej. la deduplicacion de Ezeiza), el refresh tras comprar/usar
 * items tiraba "Cannot read properties of undefined (reading 'pages')".
 * Este guard los marca como borrados y sigue. Complementa al bump de
 * versionId (que recarga el mapa al cargar el save).
 */
(function() {
    'use strict';
    var _GE_refresh = Game_Event.prototype.refresh;
    Game_Event.prototype.refresh = function() {
        if (!$dataMap || !$dataMap.events || !$dataMap.events[this._eventId]) {
            this._erased = true;
            this._pageIndex = -2;
            return;
        }
        _GE_refresh.call(this);
    };
})();
