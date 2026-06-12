//=============================================================================
// TinchoHud.js — medidor de Pedo visual (gauge) + efectos consistentes.
//=============================================================================
/*:
 * @plugindesc Barra de Pedo arriba a la izquierda + pantalla roja atada a la variable.
 * @help
 * Reemplaza al viejo CE2 (que dibujaba un numero blanco y se perdia al
 * cambiar de mapa). La barra aparece en todo Scene_Map cuando el switch 16
 * esta ON, siempre — aunque el Pedo sea 0 — asi nunca dudas si funciona.
 *
 * Colores: blanco (0-19), verde (20-39), amarillo (40-59),
 * naranja (60-79), rojo (80+). A 80+ la barra late.
 *
 * Pantalla roja: overlay proporcional al Pedo desde 50 (no usa el tint del
 * engine, asi no pisa los tintes nocturnos de los mapas). Si el Pedo baja
 * (bano, agua, alitas) el rojo se va SOLO.
 *
 * Ademas auto-sanea tints ROJIZOS viejos que hayan quedado pegados de
 * eventos del Cap. 1 cuando el Pedo ya no los justifica.
 */
(function() {
    'use strict';

    var PEDO_VAR = 1;
    var HUD_SWITCH = 16;

    function pedo() {
        return $gameVariables.value(PEDO_VAR);
    }

    function levelColor(v) {
        if (v >= 80) return '#ff3030';
        if (v >= 60) return '#ff8800';
        if (v >= 40) return '#ffd700';
        if (v >= 20) return '#66dd66';
        return '#ffffff';
    }

    //--------------------------------------------------------------- gauge
    // Botella de Chang que se llena con el Pedo: la botella gris (vacia)
    // de fondo y la version a color revelandose de ABAJO hacia arriba.
    function Sprite_PedoGauge() {
        this.initialize.apply(this, arguments);
    }
    Sprite_PedoGauge.prototype = Object.create(Sprite.prototype);
    Sprite_PedoGauge.prototype.constructor = Sprite_PedoGauge;

    Sprite_PedoGauge.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(96, 150);
        this.x = 8;
        this.y = 6;
        this._lastValue = -1;
        this._pulse = 0;
        this._empty = ImageManager.loadBitmap('img/system/', 'chang_empty', 0, true);
        this._full = ImageManager.loadBitmap('img/system/', 'chang_full', 0, true);
    };

    Sprite_PedoGauge.prototype.update = function() {
        Sprite.prototype.update.call(this);
        var v = pedo().clamp(0, 100);
        this.visible = $gameSwitches.value(HUD_SWITCH) &&
                       !$gameMessage.isBusy();
        if (!this.visible) return;
        if (!this._empty.isReady() || !this._full.isReady()) return;
        this._pulse++;
        if (v !== this._lastValue || (v >= 80 && this._pulse % 10 === 0)) {
            this._lastValue = v;
            this.redraw(v);
        }
    };

    Sprite_PedoGauge.prototype.redraw = function(v) {
        var b = this.bitmap;
        b.clear();
        var bw = this._full.width;
        var bh = this._full.height;
        var bx = 4, by = 16;
        // etiqueta
        b.fontSize = 13;
        b.textColor = '#ffffff';
        b.outlineColor = '#000000';
        b.outlineWidth = 4;
        b.drawText('PEDO', 0, 0, 60, 13, 'left');
        // botella vacia (gris)
        b.blt(this._empty, 0, 0, bw, bh, bx, by);
        // relleno: la parte de abajo de la botella a color, segun el %
        var fillH = Math.round(bh * v / 100);
        if (fillH > 0) {
            var blink = v >= 80 && this._pulse % 20 < 10;
            b.paintOpacity = blink ? 200 : 255;
            b.blt(this._full, 0, bh - fillH, bw, fillH, bx, by + bh - fillH);
            b.paintOpacity = 255;
        }
        // marcas de umbral (40 tropiezos, 60 carcel, 80 blackout)
        [40, 60, 80].forEach(function(t) {
            var ty = by + bh - Math.round(bh * t / 100);
            b.fillRect(bx + bw + 2, ty, 6, 1, 'rgba(255,255,255,0.8)');
        });
        // porcentaje al costado
        b.fontSize = 14;
        b.textColor = levelColor(v);
        b.drawText(v + '%', bx + bw + 10, by + bh - 20, 50, 16, 'left');
    };

    //------------------------------------------------------------- overlay
    function Sprite_PedoOverlay() {
        this.initialize.apply(this, arguments);
    }
    Sprite_PedoOverlay.prototype = Object.create(ScreenSprite.prototype);
    Sprite_PedoOverlay.prototype.constructor = Sprite_PedoOverlay;

    Sprite_PedoOverlay.prototype.initialize = function() {
        ScreenSprite.prototype.initialize.call(this);
        this.setColor(180, 20, 20);
        this.opacity = 0;
    };

    Sprite_PedoOverlay.prototype.update = function() {
        var v = pedo();
        var target = v >= 50 ? Math.min(120, (v - 50) * 2.4) : 0;
        // acercarse suave al objetivo
        this.opacity += (target - this.opacity) * 0.08;
        if (Math.abs(target - this.opacity) < 1) this.opacity = target;
    };

    //----------------------------------------------------- scene plumbing
    var _SM_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function() {
        _SM_createDisplayObjects.call(this);
        this._pedoOverlay = new Sprite_PedoOverlay();
        this._pedoGauge = new Sprite_PedoGauge();
        var idx = this.children.indexOf(this._windowLayer);
        if (idx < 0) idx = this.children.length;
        this.addChildAt(this._pedoOverlay, idx);
        this.addChildAt(this._pedoGauge, idx + 1);
        // limpiar el sprite legacy del viejo CE2 si quedo colgado
        if ($gameScreen._pedoPicSprite) {
            $gameScreen._pedoPicSprite = null;
            $gameScreen._pedoBmp = null;
        }
    };

    var _SM_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _SM_update.call(this);
        if (this._pedoOverlay) this._pedoOverlay.update();
        // auto-sanear tint ROJIZO pegado cuando el Pedo no lo justifica
        // (tintes nocturnos azules/oscuros no se tocan)
        if (pedo() < 50) {
            var t = $gameScreen.tone();
            if (t && t[0] > 20 && t[0] > t[2] + 30 && t[0] > t[1] + 30) {
                $gameScreen.startTint([0, 0, 0, 0], 45);
            }
        }
    };
})();
