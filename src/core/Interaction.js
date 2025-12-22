/**
 * Interaction.js
 * Translates discrete DOM events into continuous signal perturbations.
 */

import { signals } from './Signals.js';

export class Interaction {
    constructor() {
        this.isMouseDown = false;
        this.lastPosition = { x: 0.5, y: 0.5 };
        
        this.init();
    }

    init() {
        window.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mousedown', (e) => this.handleDown(e));
        window.addEventListener('mouseup', (e) => this.handleUp(e));
        window.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.handleTouch(e), { passive: false });
        window.addEventListener('touchend', () => this.handleUp());
    }

    handleMove(e) {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        signals.setCursor(x, y);

        // Movement increases energy and focus
        const dx = x - this.lastPosition.x;
        const dy = y - this.lastPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        signals.perturb('energy', dist * 2);
        signals.perturb('focus', 0.2 + dist * 5);

        if (this.isMouseDown) {
            signals.perturb('drag', dist * 10);
        }
        
        this.lastPosition = { x, y };
    }

    handleDown(e) {
        this.isMouseDown = true;
        // High-register activation hint
        signals.perturb('energy', 0.3);
        signals.perturb('focus', 0.8);
        signals.perturb('resonance', 0.6);
    }

    handleUp() {
        this.isMouseDown = false;
        signals.perturb('focus', 0.2);
    }

    handleTouch(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.handleMove({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            if (e.type === 'touchstart') this.handleDown();
        }
        e.preventDefault();
    }
}
