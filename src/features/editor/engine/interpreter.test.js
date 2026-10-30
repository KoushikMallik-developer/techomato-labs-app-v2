import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { transpile, createInterpreter } from './interpreter';
import { TEMPLATES, buildTemplate, EXAMPLES } from '@/lib/templates';

const sandboxScript = readFileSync('public/sandbox.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

/**
 * Runs the real public/sandbox.html in-process: the page script gets a fake parent window, and `Worker`
 * is replaced by something that runs the worker source in-process. `intervals` collects the page's
 * watchdog timer so a test can fire it by hand.
 */
function loopbackSpawn(onMessage, { hostile, intervals = [] } = {}) {
  let deliver;
  const fakeParent = { postMessage: (m) => setTimeout(() => onMessage(m), 0) };
  class FakeWorker {
    constructor(blob) {
      // eslint-disable-next-line no-new-func
      new Function('postMessage', 'addEventListener', 'setInterval', blob.parts[0])(
        (m) => setTimeout(() => this.onmessage({ data: m }), 0),
        (_type, fn) => {
          this.handler = fn;
        },
        () => 0,
      );
    }
    postMessage(data) {
      setTimeout(() => this.handler({ data }), 0);
    }
    terminate() {}
  }
  class FakeBlob {
    constructor(parts) {
      this.parts = parts;
    }
  }
  // eslint-disable-next-line no-new-func
  new Function('parent', 'addEventListener', 'Worker', 'Blob', 'URL', 'setInterval', sandboxScript)(
    fakeParent,
    (_type, fn) => {
      deliver = fn;
    },
    FakeWorker,
    FakeBlob,
    { createObjectURL: (b) => b },
    (fn) => intervals.push(fn),
  );
  hostile?.((m) => onMessage(m));
  return { post: (data) => setTimeout(() => deliver({ source: fakeParent, data }), 0), kill() {} };
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const API_NAMES = [
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'tone', 'noTone',
  'delay', 'delayMicroseconds', 'millis', 'micros', 'map', 'constrain', 'random',
  'abs', 'min', 'max', 'pow', 'sqrt', 'sq', 'F', 'Serial', 'pulseIn', '__lcd', '__servo', '__int', '__y',
  'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
];

/** Every sketch shipped with the app must transpile to syntactically valid JS. */
function expectValidTranspile(code) {
  const js = transpile(code);
  expect(() => new AsyncFunction(...API_NAMES, js)).not.toThrow();
}

describe('transpile', () => {
  for (const t of TEMPLATES) {
    it(`template "${t.key}" transpiles cleanly`, () => {
      expectValidTranspile(buildTemplate(t.key).code);
    });
  }
  for (const ex of EXAMPLES) {
    it(`example "${ex.name}" transpiles cleanly`, () => {
      expectValidTranspile(ex.code);
    });
  }

  it('turns a typed int declaration into a truncated let', () => {
    const js = transpile('void setup(){ int x = 5.7; }\nvoid loop(){}');
    expect(js).toContain('let x = __int(5.7);');
  });

  it('awaits delay() and user-defined functions but not built-in API calls', () => {
    const js = transpile('void blink(){ delay(10); }\nvoid setup(){ blink(); digitalWrite(13, HIGH); }\nvoid loop(){}');
    expect(js).toContain('await delay(10)');
    expect(js).toContain('await blink()');
    expect(js).not.toMatch(/await\s+digitalWrite/);
  });

  it('awaits digitalRead and analogRead because their value comes from the page', () => {
    const js = transpile('void setup(){}\nvoid loop(){ if (digitalRead(2) == HIGH) { analogRead(A0); } }');
    expect(js).toContain('await digitalRead(2)');
    expect(js).toContain('await analogRead(A0)');
  });

  it('rewrites LiquidCrystal_I2C and Servo constructors', () => {
    const js = transpile('LiquidCrystal_I2C lcd(0x27, 16, 2);\nServo arm;\nvoid setup(){}\nvoid loop(){}');
    expect(js).toContain('const lcd = __lcd(0x27, 16, 2);');
    expect(js).toContain('const arm = __servo();');
  });
});

describe('createInterpreter (runtime, not just transpile syntax)', () => {
  // Regression: `new AsyncFunction(...names, body)` throws if `names` contains a
  // reserved word (e.g. 'true'/'false') even when the transpiled body itself is
  // valid JS — syntax-only checks above wouldn't catch that class of bug.
  for (const t of TEMPLATES) {
    it(`template "${t.key}" runs setup()+loop() without a runtime/construction error`, async () => {
      const doc = buildTemplate(t.key);
      let serial = '';
      const interp = createInterpreter({
        getDoc: () => doc,
        serialWrite: (text) => {
          serial += text;
        },
        requestRender: () => {},
        spawn: loopbackSpawn,
      });
      interp.run(doc.code);
      await new Promise((r) => setTimeout(r, 60));
      interp.stop();
      await new Promise((r) => setTimeout(r, 10));
      expect(serial).not.toContain('❌');
    });
  }

  it('ends the run when the sandbox asks for something outside the allowlist', async () => {
    const doc = buildTemplate('blink');
    let serial = '';
    let send;
    const interp = createInterpreter({
      getDoc: () => doc,
      serialWrite: (text) => {
        serial += text;
      },
      requestRender: () => {},
      spawn: (onMessage) => loopbackSpawn(onMessage, { hostile: (emit) => (send = emit) }),
    });
    const done = interp.run(doc.code);
    send({ t: 'call', fn: 'constructor', args: [] });
    await done;
    expect(serial).toContain('❌ Unsupported call: constructor');
  });

  it('ends the run when the sandbox floods the app with calls', async () => {
    const doc = buildTemplate('blink');
    let serial = '';
    let send;
    const interp = createInterpreter({
      getDoc: () => doc,
      serialWrite: (text) => {
        serial += text;
      },
      requestRender: () => {},
      spawn: (onMessage) => loopbackSpawn(onMessage, { hostile: (emit) => (send = emit) }),
    });
    const done = interp.run(doc.code);
    for (let i = 0; i < 2001; i++) send({ t: 'call', fn: 'Serial.print', args: ['x'] });
    await done;
    expect(serial).toContain('❌ The sketch is making too many calls per second.');
  });

  it('ends the run when the sketch stops sending heartbeats (a loop that never waits)', async () => {
    const doc = buildTemplate('blink');
    let serial = '';
    const intervals = [];
    const interp = createInterpreter({
      getDoc: () => doc,
      serialWrite: (text) => {
        serial += text;
      },
      requestRender: () => {},
      spawn: (onMessage) => loopbackSpawn(onMessage, { intervals }),
    });
    const done = interp.run(doc.code);
    await new Promise((r) => setTimeout(r, 30));
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 4000);
    intervals[0](); // the page's watchdog: the Worker has not beaten for 4 s
    clock.mockRestore();
    await done;
    expect(serial).toContain('❌ The sketch is stuck in a loop');
  });
});
