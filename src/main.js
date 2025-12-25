/**
 * main.js
 * Application entry point. Coordinates systems and the main loop.
 */

import { signals } from './core/Signals.js';
import { Interaction } from './core/Interaction.js';
import { audioEngine } from './audio/AudioEngine.js';
import { Renderer } from './visuals/Renderer.js';

class App {
    constructor() {
        this.renderer = new Renderer('gl-canvas');
        this.interaction = null;
        this.statusLabel = document.getElementById('interaction-status');
        this.startScreen = document.getElementById('start-screen');
        this.audioFaulted = false;
        
        this.initialized = false;
        this.initEventListeners();
        this.loop();
    }

    initEventListeners() {
        this.startScreen.addEventListener('click', () => this.initialize());
    }

    async initialize() {
        if (this.initialized) return;
        
        this.startScreen.classList.add('hidden');
        await audioEngine.init();
        
        this.interaction = new Interaction();
        this.initialized = true;
    }

    loop() {
        // 1. Update Signals (Smoothing & Inertia)
        signals.update();
        
        // 2. Update Audio (Modulation)
        if (!this.audioFaulted) {
            try {
                audioEngine.update();
            } catch (err) {
                this.audioFaulted = true;
                console.error('Audio update failed; visuals continue.', err);
            }
        }
        
        // 3. Render Visuals
        this.renderer.draw();
        
        // 4. Update UI labels
        this.updateUI();
        
        requestAnimationFrame(() => this.loop());
    }

    updateUI() {
        const energy = signals.params.energy;
        let state = 'IDLE_BIAS';
        if (energy > 0.6) state = 'HIGH_INTENSITY_BIAS';
        else if (energy > 0.2) state = 'INTERACTION_BIAS';
        
        this.statusLabel.innerText = `${state} // E:${energy.toFixed(2)}`;
    }
}

// Start application
new App();
