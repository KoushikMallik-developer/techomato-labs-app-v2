import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeGainParam() {
  return { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}

function makeFakeAudioContext({ startsSuspended = true } = {}) {
  let state = startsSuspended ? 'suspended' : 'running';
  const resume = vi.fn(() => {
    state = 'running';
    return Promise.resolve();
  });
  const ctx = {
    get state() {
      return state;
    },
    currentTime: 0,
    resume,
    createOscillator: vi.fn(() => ({
      type: '',
      frequency: makeGainParam(),
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: makeGainParam(), connect: vi.fn().mockReturnThis() })),
    destination: {},
  };
  return ctx;
}

/** audio.js keeps its AudioContext/oscillator/gain as module-level singletons,
 * so every test needs a fresh module instance to avoid leaking state. */
async function freshAudioModule() {
  vi.resetModules();
  return import('./audio');
}

let originalAudioContext;

beforeEach(() => {
  originalAudioContext = window.AudioContext;
});

afterEach(() => {
  window.AudioContext = originalAudioContext;
  vi.restoreAllMocks();
});

describe('primeAudio', () => {
  it('reports no Web Audio support and returns null', async () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    const { primeAudio } = await freshAudioModule();
    const warn = vi.fn();
    expect(primeAudio(warn)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no Web Audio support/));
  });

  it('creates the context once and reuses it on subsequent calls', async () => {
    const fake = makeFakeAudioContext();
    window.AudioContext = vi.fn(() => fake);
    const { primeAudio } = await freshAudioModule();
    const first = primeAudio();
    const second = primeAudio();
    expect(first).toBe(fake);
    expect(second).toBe(fake);
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: true });
    window.AudioContext = vi.fn(() => fake);
    const { primeAudio } = await freshAudioModule();
    primeAudio();
    expect(fake.resume).toHaveBeenCalledTimes(1);
  });

  it('warns if the browser still blocks playback after resume() resolves', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: true });
    fake.resume = vi.fn(() => Promise.resolve()); // resolves but state stays "suspended"
    window.AudioContext = vi.fn(() => fake);
    const { primeAudio } = await freshAudioModule();
    const warn = vi.fn();
    primeAudio(warn);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/blocked audio playback/));
  });

  it('warns if resume() itself rejects', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: true });
    fake.resume = vi.fn(() => Promise.reject(new Error('denied')));
    window.AudioContext = vi.fn(() => fake);
    const { primeAudio } = await freshAudioModule();
    const warn = vi.fn();
    primeAudio(warn);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/blocked audio playback/));
  });
});

describe('updateBuzzer / stopBuzzer', () => {
  it('does nothing when there is no Web Audio support', async () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    const { updateBuzzer, stopBuzzer } = await freshAudioModule();
    expect(() => updateBuzzer(true, 440)).not.toThrow();
    expect(() => stopBuzzer()).not.toThrow();
  });

  it('creates the oscillator/gain nodes once and ramps the gain up when turned on', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: false });
    window.AudioContext = vi.fn(() => fake);
    const { updateBuzzer } = await freshAudioModule();
    updateBuzzer(true, 440);
    expect(fake.createOscillator).toHaveBeenCalledTimes(1);
    expect(fake.createGain).toHaveBeenCalledTimes(1);
    const osc = fake.createOscillator.mock.results[0].value;
    expect(osc.start).toHaveBeenCalledTimes(1);
    const gainNode = fake.createGain.mock.results[0].value;
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, 0, 0.008);
  });

  it('only retunes the oscillator frequency when it actually changes', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: false });
    window.AudioContext = vi.fn(() => fake);
    const { updateBuzzer } = await freshAudioModule();
    updateBuzzer(true, 440);
    const osc = fake.createOscillator.mock.results[0].value;
    expect(osc.frequency.setTargetAtTime).toHaveBeenCalledTimes(1);
    updateBuzzer(true, 440);
    expect(osc.frequency.setTargetAtTime).toHaveBeenCalledTimes(1);
    updateBuzzer(true, 880);
    expect(osc.frequency.setTargetAtTime).toHaveBeenCalledTimes(2);
  });

  it('ramps the gain down when turned off', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: false });
    window.AudioContext = vi.fn(() => fake);
    const { updateBuzzer } = await freshAudioModule();
    updateBuzzer(true, 440);
    const gainNode = fake.createGain.mock.results[0].value;
    updateBuzzer(false, 0);
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.02);
  });

  it('treats freq<=0 as off even when "on" is true', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: false });
    window.AudioContext = vi.fn(() => fake);
    const { updateBuzzer } = await freshAudioModule();
    updateBuzzer(true, 440);
    const gainNode = fake.createGain.mock.results[0].value;
    gainNode.gain.setTargetAtTime.mockClear();
    updateBuzzer(true, 0);
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.02);
  });

  it('stopBuzzer silences immediately and is a no-op if never started', async () => {
    const fake = makeFakeAudioContext({ startsSuspended: false });
    window.AudioContext = vi.fn(() => fake);
    const { updateBuzzer, stopBuzzer } = await freshAudioModule();
    stopBuzzer(); // no nodes yet — must not throw
    updateBuzzer(true, 440);
    const gainNode = fake.createGain.mock.results[0].value;
    stopBuzzer();
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
  });
});
