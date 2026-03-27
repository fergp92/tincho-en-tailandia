/*:
 * @plugindesc Hides the game title text on the title screen, showing only the background image and command window.
 * @author PixelForge
 *
 * @help Just enable this plugin. The title text will be hidden.
 */

(function() {
    Scene_Title.prototype.drawGameTitle = function() {
        // Do nothing - title text is hidden
    };
})();
