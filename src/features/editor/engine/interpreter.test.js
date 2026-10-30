import { describe, it, expect } from 'vitest';
import { transpile, createInterpreter } from './interpreter';
import { TEMPLATES, buildTemplate, EXAMPLES } from '@/lib/templates';

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
      });
      interp.run(doc.code);
      await new Promise((r) => setTimeout(r, 60));
      interp.stop();
      await new Promise((r) => setTimeout(r, 10));
      expect(serial).not.toContain('❌');
    });
  }
});
