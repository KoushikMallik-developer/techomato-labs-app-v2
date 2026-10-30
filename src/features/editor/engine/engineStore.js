/**
 * Per-frame simulation output, deliberately kept OUTSIDE Redux (see the
 * "Redux vs engine-internal state split" note in the implementation plan).
 * The board renderer (draw2d.js) reads this every animation frame; the
 * Arduino interpreter (interpreter.js, next build phase) and circuit
 * solver (solver.js) write into it. Redux only knows about the coarse
 * `running` boolean mirrored in editorSlice.
 *
 * `resetSim()` gives back a fresh object with the same shape so a new
 * Run never leaks state from a previous run.
 */
export function freshPins() {
  return Array.from({ length: 20 }, () => ({ mode: 'INPUT', out: 0, tone: 0, servo: 90 }));
}

export function freshLcd() {
  return { rows: [Array(16).fill(' '), Array(16).fill(' ')], col: 0, row: 0, bl: false, init: false };
}

export function createSim() {
  return {
    running: false,
    runId: 0,
    t0: 0,
    pins: freshPins(),
    volt: () => 0,
    node: () => -1,
    ledB: {},
    ledI: {},
    dOn: {},
    burned: {},
    buzz: {},
    buzzFreq: 0,
    warned: new Set(),
    lcd: freshLcd(),
    lcdOn: {},
    lcdI2C: {},
    sonarOn: {},
    relayOn: {},
    transOn: {},
    motorSpeed: {},
    segOn: {},
    dhtOn: {}, // partId -> powered
    neoByPin: {}, // Arduino pin -> the colours last sent with strip.show()
    neoColors: {}, // partId -> the colours its DIN pin receives
    servoA: {},
    servoPin: {},
  };
}

/** The single live sim instance for the currently mounted editor. */
export const sim = createSim();

/** Resets sim state but preserves `runId` — callers manage that counter
 * themselves (increment before reset) so a stale async interpreter loop
 * can never mistake a reset-but-different run for its own. */
export function resetSim() {
  const keepRunId = sim.runId;
  Object.assign(sim, createSim());
  sim.runId = keepRunId;
}
