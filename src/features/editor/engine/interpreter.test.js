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
  'abs', 'min', 'max', 'pow', 'sqrt', 'sq', 'F', 'Serial', 'pulseIn', '__lcd', '__servo', '__dht', '__neo', 'isnan', '__int', '__y',
  'DHT11', 'DHT22', 'NEO_GRB', 'NEO_RGB', 'NEO_KHZ800',
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

  it('also accepts the older "x = Type(...)" constructor style', () => {
    const js = transpile('Adafruit_NeoPixel strip = Adafruit_NeoPixel(8, PIN, NEO_GRB + NEO_KHZ800);\nDHT dht = DHT(2, DHT22);\nvoid setup(){}\nvoid loop(){}');
    expect(js).toContain('const strip = __neo(8, PIN, NEO_GRB + NEO_KHZ800);');
    expect(js).toContain('const dht = __dht(2, DHT22);');
    expect(() => new (Object.getPrototypeOf(async function () {}).constructor)('__neo', '__dht', 'PIN', 'NEO_GRB', 'NEO_KHZ800', 'DHT22', js)).not.toThrow();
  });

  it('rewrites DHT and NeoPixel constructors and awaits sensor reads', () => {
    const js = transpile('DHT dht(2, DHT11);\nAdafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);\nvoid setup(){}\nvoid loop(){ float t = dht.readTemperature(); }');
    expect(js).toContain('const dht = __dht(2, DHT11);');
    expect(js).toContain('const strip = __neo(8, 6, NEO_GRB + NEO_KHZ800);');
    expect(js).toContain('let t = await dht.readTemperature();');
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

  it('simulates a DHT11, a joystick and a NeoPixel strip wired to the board', async () => {
    const { sim } = await import('./engineStore');
    const doc = buildTemplate('blank');
    // Off the breadboard, so their pins only connect through the wires below.
    const part = (id, type, props = {}, x = 0) => ({ id, type, x: 900 + x, y: 900, rot: 0, props });
    const ardId = doc.parts.find((p) => p.type === 'arduino').id; // template ids are generated
    const wire = (a, b, i) => ({ id: `w${i}`, a, b: b.replace('ard.', `${ardId}.`), color: '#ffd166' });
    doc.parts.push(part('dht1', 'dht', { temp: 31.5, hum: 40 }), part('joy1', 'joystick', { x: 1, y: 0.5 }, 200), part('neo1', 'neopixel', {}, 400));
    doc.wires = [
      ['dht1.VCC', 'ard.5V'], ['dht1.GND', 'ard.GND1'], ['dht1.DATA', 'ard.D2'],
      ['joy1.VCC', 'ard.5V'], ['joy1.GND', 'ard.GND1'], ['joy1.VRX', 'ard.A0'], ['joy1.VRY', 'ard.A1'],
      ['neo1.VCC', 'ard.5V'], ['neo1.GND', 'ard.GND2'], ['neo1.DIN', 'ard.D6'],
    ].map(([a, b], i) => wire(a, b, i));
    doc.code = `#include <DHT.h>
#include <Adafruit_NeoPixel.h>
DHT dht(2, DHT11);
Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
void setup() { Serial.begin(9600); dht.begin(); strip.begin(); strip.setBrightness(128); }
void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.println("t=" + String(t) + " h=" + String(h) + " f=" + String(dht.readTemperature(true)));
  Serial.println("x=" + String(analogRead(A0)) + " y=" + String(analogRead(A1)));
  strip.setPixelColor(0, strip.Color(255, 0, 0));
  strip.setPixelColor(1, 0, 255, 0);
  strip.show();
  delay(1000);
}`;
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
    await vi.waitFor(() => expect(sim.neoColors.neo1?.length).toBe(8), { timeout: 3000 });
    const colors = sim.neoColors.neo1;
    interp.stop();
    expect(serial).not.toContain('❌');
    expect(serial).toContain('t=31.5 h=40 f=88.7');
    expect(serial).toMatch(/x=1023 y=51[12]/);
    expect(colors.slice(0, 3)).toEqual([0x800000, 0x008000, 0]); // dimmed to half by setBrightness(128)
  });

  it('warns once, and reads NaN, when no DHT sensor is wired to the pin', async () => {
    const doc = buildTemplate('blank');
    doc.code = 'DHT dht(2, DHT11);\nvoid setup(){}\nvoid loop(){ Serial.println(isnan(dht.readTemperature()) ? "nan" : "num"); delay(5); }';
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
    await vi.waitFor(() => expect(serial.match(/nan/g)?.length).toBeGreaterThan(2), { timeout: 3000 });
    interp.stop();
    expect(serial.match(/No DHT sensor/g)).toHaveLength(1);
  });

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
