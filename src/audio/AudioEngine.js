/**
 * AudioEngine.js
 * Living ambient sound instrument using Tone.js.
 */

import * as Tone from 'tone';
import { signals } from '../core/Signals.js';

export class AudioEngine {
    constructor() {
        this.initialized = false;
        
        // Chords: DbM7 add9, Fm7 add11, DbM7 add9, Fm7 add11
        this.chords = [
            ['Db2', 'Ab2', 'C3', 'Eb3', 'F3'],
            ['F2', 'C3', 'Eb3', 'Ab3', 'Bb3'],
            ['Db2', 'Ab2', 'C3', 'Eb3', 'F3'],
            ['F2', 'C3', 'Eb3', 'Ab3', 'Bb3'],
        ];
        
        this.currentChordIndex = 0;
        this.chordTransitionTime = 0;
        this.superSawActive = false;
    }

    async init() {
        if (this.initialized) return;
        await Tone.start();
        
        // --- MASTER CHAIN ---
        this.master = new Tone.Gain(0.9).toDestination();
        this.limiter = new Tone.Limiter(-2).connect(this.master);
        this.reverb = new Tone.Reverb({ decay: 9, wet: 0.35 }).connect(this.limiter);
        this.delay = new Tone.FeedbackDelay("8n", 0.25).connect(this.reverb);
        this.fxSend = new Tone.Gain(0.35).connect(this.delay);
        
        // --- LAYER 1: Polyphonic Pad (The Bed) ---
        this.pad = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 4, release: 8, releaseCurve: 'exponential' }
        });
        this.pad.connect(this.limiter);
        this.pad.connect(this.fxSend);
        this.pad.set({ volume: -12 });

        // --- LAYER 2: Monophonic Ordered (Melodic structure) ---
        this.monoShelf = new Tone.MonoSynth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 2 },
            filter: { Q: 2, type: 'lowpass', rolloff: -24 }
        });
        this.monoShelf.connect(this.limiter);
        this.monoShelf.connect(this.fxSend);
        this.monoShelf.volume.value = -16;

        // --- LAYER 3: Monophonic Probabilistic (Grains/Texture) ---
        this.grainSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' }
        });
        this.grainSynth.connect(this.limiter);
        this.grainSynth.connect(this.fxSend);
        // --- LAYER 4: Melodic Foreground (Drag gesture) ---
        this.leadSynth = new Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 },
            filter: { Q: 1, type: 'lowpass' }
        });
        this.leadSynth.connect(this.limiter);
        this.leadSynth.connect(this.fxSend);
        this.leadSynth.volume.value = -100; // Start silent

        // --- LAYER 5: Super-saw mass (Click + Drag) ---
        this.superSaw = new Tone.MonoSynth({
            oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
            envelope: { attack: 0.6, decay: 0.8, sustain: 0.7, release: 2.4 },
            filter: { Q: 0.8, type: 'lowpass', rolloff: -24 }
        });
        this.superSawDist = new Tone.Distortion({ distortion: 0.15, wet: 0.1 }).connect(this.limiter);
        this.superSawDry = new Tone.Gain(1).connect(this.limiter);
        this.superSaw.connect(this.superSawDist);
        this.superSaw.connect(this.superSawDry);
        this.superSaw.connect(this.fxSend);
        this.superSaw.volume.value = -100;

        this.initialized = true;
        this.startGenerativeLoop();

        // Keep the super-saw oscillator running; drag controls its audible level.
        const chord = this.chords[this.currentChordIndex];
        const baseNote = chord[1] ?? chord[0];
        const note = Tone.Frequency(baseNote).transpose(-2).toFrequency();
        this.superSaw.triggerAttack(note);
        this.superSawActive = true;
    }

    startGenerativeLoop() {
        // Chord progression logic
        Tone.Transport.scheduleRepeat((time) => {
            const energy = signals.params.energy;
            
            // Interaction influences chord change probability
            if (Math.random() < 0.1 + energy * 0.2) {
                this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
                this.playChord(time);
            }
        }, "4n");

        // Monophonic Ordered Loop
        Tone.Transport.scheduleRepeat((time) => {
            if (Math.random() < 0.3 + signals.params.energy * 0.4) {
                const chord = this.chords[this.currentChordIndex];
                const note = chord[Math.floor(Math.random() * 3)]; // Lower notes
                this.monoShelf.triggerAttackRelease(note, "2n", time);
            }
        }, "2n");

        // Monophonic Probabilistic (High Register)
        Tone.Transport.scheduleRepeat((time) => {
            const focus = signals.params.focus;
            const velocity = signals.params.velocity;
            const probability = Math.min(1, 0.05 + focus * 0.4 + velocity * 0.8);
            if (Math.random() < probability) {
                const chord = this.chords[this.currentChordIndex];
                // Transpose up 2 octaves for high register
                const noteBase = chord[Math.floor(Math.random() * chord.length)];
                const note = Tone.Frequency(noteBase).transpose(24);
                const velocityAmp = 0.2 + focus * 0.4 + velocity * 0.4;
                this.grainSynth.triggerAttackRelease(note, "16n", time, velocityAmp);
            }
        }, "8n");

        Tone.Transport.start();
        this.playChord(Tone.now());
    }

    playChord(time) {
        const chord = this.chords[this.currentChordIndex];
        this.pad.releaseAll(time);
        this.pad.triggerAttack(chord, time);
    }

    update() {
        if (!this.initialized) return;
        
        const energy = signals.params.energy;
        const focus = signals.params.focus;
        const sharpness = signals.params.sharpness;
        const dragActive = signals.params.dragActive;
        const dragForce = signals.params.dragForce;
        
        // Modulate pad volume and filter
        this.pad.volume.rampTo(-15 + energy * 10, 0.1);
        
        // Modulate shelf synth based on energy
        const cutoff = 400 + energy * 4000;
        this.monoShelf.filter.frequency.rampTo(cutoff, 0.1);

        // Lead Synth (Drag) logic
        const drag = signals.params.drag;
        if (drag > 0.05) {
            const pos = signals.params.position;
            // Map Y position to high register notes in the current chord
            const chord = this.chords[this.currentChordIndex];
            const noteIndex = Math.floor((1 - pos.y) * chord.length);
            const noteBase = chord[noteIndex];
            const note = Tone.Frequency(noteBase).transpose(12 + drag * 12).toFrequency();
            
            this.leadSynth.frequency.rampTo(note, 0.05);
            this.leadSynth.volume.rampTo(-15 + drag * 10, 0.1);
            if (this.leadSynth.oscillator?.state !== 'started') {
                this.leadSynth.triggerAttack(note);
            }
        } else {
            this.leadSynth.volume.rampTo(-100, 0.5);
            if (this.leadSynth.volume.value < -80 && this.leadSynth.oscillator?.state === 'started') {
                this.leadSynth.triggerRelease();
            }
        }

        // Super-saw mass (continuous oscillator, drag-modulated gain/timbre)
        const chord = this.chords[this.currentChordIndex];
        const baseNote = chord[1] ?? chord[0];
        const dynamic = dragForce * dragActive;
        const note = Tone.Frequency(baseNote).transpose(-2 + dynamic * 5).toFrequency();
        const cutoffTarget = 350 + dynamic * 1800 + sharpness * 2200;
        const attack = 0.6 - sharpness * 0.4;
        const distAmount = 0.05 + sharpness * 0.45;
        const spread = 14 + dynamic * 35;

        this.superSaw.envelope.attack = Math.max(0.08, attack);
        this.superSaw.filter.Q.value = 0.6 + sharpness * 6;
        this.superSaw.filter.frequency.rampTo(cutoffTarget, 0.2);
        if (this.superSaw.oscillator?.spread !== undefined) {
            this.superSaw.oscillator.spread = spread;
        }
        this.superSawDist.wet.rampTo(0.08 + Math.min(0.4, sharpness * 0.6) * dragActive, 0.2);
        this.superSawDist.distortion = distAmount;
        const targetVolume = -100 + dragActive * (70 + dynamic * 14);
        this.superSaw.volume.rampTo(targetVolume, 0.2);

        if (!this.superSawActive) {
            this.superSaw.triggerAttack(note);
            this.superSawActive = true;
        }
        this.superSaw.frequency.rampTo(note, 0.1);
    }
}

export const audioEngine = new AudioEngine();
