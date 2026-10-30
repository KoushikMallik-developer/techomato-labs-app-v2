/**
 * Buzzer audio: a single persistent oscillator+gain node, muted/unmuted and
 * retuned as the solver's `sim.buzz`/`sim.buzzFreq` output changes, rather
 * than creating/tearing down nodes on every state change.
 *
 * Browsers only let an AudioContext actually play sound if it's resumed
 * synchronously inside a real user-gesture event handler (a click) —
 * resuming it later from inside a dispatch -> effect -> async-interpreter
 * chain is too far removed for some browsers' autoplay policies to count.
 * `primeAudio()` exists specifically to be called directly from the Run
 * button's onClick, before any of that indirection.
 */
let ctx = null;
let osc = null;
let gain = null;
let currentFreq = 0;
let currentOn = false;

/** Call directly from a click handler (e.g. the Run button) so the browser
 * counts the resume as happening within a genuine user gesture.
 * `warn` (optional) reports a context the browser refused to start, so a
 * blocked AudioContext surfaces in the serial console instead of just
 * producing silence that looks identical to a wiring mistake. */
export function primeAudio(warn) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    warn?.('⚠️ This browser has no Web Audio support, so the buzzer will be silent.');
    return null;
  }
  if (!ctx) ctx = new AudioContextCtor();
  if (ctx.state === 'suspended') {
    ctx.resume().then(
      () => {
        if (ctx.state !== 'running') {
          warn?.('⚠️ The browser blocked audio playback, so the buzzer will be silent. Click anywhere on the page and press Run again.');
        }
      },
      () => warn?.('⚠️ The browser blocked audio playback, so the buzzer will be silent.'),
    );
  }
  return ctx;
}

function ensureNodes() {
  const c = primeAudio();
  if (!c) return null;
  if (!osc) {
    osc = c.createOscillator();
    gain = c.createGain();
    osc.type = 'square';
    gain.gain.value = 0;
    osc.connect(gain).connect(c.destination);
    osc.start();
  }
  return c;
}

/** Called every time the circuit re-solves; cheap no-op when nothing changed. */
export function updateBuzzer(on, freq) {
  const c = ensureNodes();
  if (!c) return;
  if (on && freq > 0) {
    if (freq !== currentFreq) {
      osc.frequency.setTargetAtTime(freq, c.currentTime, 0.01);
      currentFreq = freq;
    }
    if (!currentOn) {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setTargetAtTime(0.15, c.currentTime, 0.008);
      currentOn = true;
    }
  } else if (currentOn) {
    gain.gain.cancelScheduledValues(c.currentTime);
    gain.gain.setTargetAtTime(0, c.currentTime, 0.02);
    currentOn = false;
  }
}

/** Silences immediately — called when leaving the editor. */
export function stopBuzzer() {
  if (!ctx || !gain) return;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
  currentOn = false;
}
