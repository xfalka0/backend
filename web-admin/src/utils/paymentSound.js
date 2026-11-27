const SOUND_STORAGE_KEY = 'admin_payment_sound';

let audioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    return audioCtx;
}

/**
 * Unlocks/resumes the browser AudioContext on user gesture so future
 * real-time payment chimes play without being blocked by autoplay policy.
 */
export function unlockPaymentAudio() {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
}

export function isPaymentSoundEnabled() {
    try {
        return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function setPaymentSoundEnabled(enabled) {
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // ignore storage errors
    }
}

function scheduleBellPartial(ctx, startTime, freq, peakGain, duration, type = 'sine') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
}

/**
 * Plays a crisp metallic "trinkk" cash-register / coin chime via Web Audio API.
 */
export function playTrinkkSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const trigger = () => {
        const now = ctx.currentTime + 0.01;
        // First bright metallic strike (G6 + shimmer overtone)
        scheduleBellPartial(ctx, now, 1567.98, 0.18, 0.18, 'sine');
        scheduleBellPartial(ctx, now, 3135.96, 0.07, 0.14, 'triangle');

        // Second higher ring (C7 + C8 shimmer) for the classic "trinkk!" tail
        scheduleBellPartial(ctx, now + 0.075, 2093.0, 0.22, 0.48, 'sine');
        scheduleBellPartial(ctx, now + 0.075, 4186.01, 0.08, 0.32, 'triangle');
    };

    if (ctx.state === 'suspended') {
        ctx.resume().then(trigger).catch(() => {});
    } else {
        trigger();
    }
}
