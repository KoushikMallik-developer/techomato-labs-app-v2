/**
 * Arduino sketch runtime: a regex-based source-to-async-JS transpiler plus
 * the pinMode/digitalWrite/Serial/etc. API the transpiled sketch runs
 * against. The transpiled code runs in a sandboxed iframe (public/sandbox.html), because sketches
 * come from other users; it reaches this page only through the allowlisted calls in `run` below. Not a real C++ parser — sequential regex passes handle the
 * subset of Arduino syntax the examples/templates use (typed declarations,
 * simple function defs, LiquidCrystal_I2C/Servo constructors) and turn
 * blocking calls (delay, pulseIn, user functions) into `await`-able async
 * functions so a sketch's `for(;;)` loop cooperatively yields to the
 * browser instead of freezing the tab. See the implementation plan's note
 * on why this approach is lower-risk than a hand-written AST interpreter.
 */
import { clamp, ard } from './geometry';
import { sim, resetSim } from './engineStore';
import { solveCircuit, resetSolverWarnings } from './solver';
import { updateBuzzer } from './audio';

const STOP = Symbol('stop');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(x) {
  if (typeof x === 'boolean') return x ? '1' : '0';
  if (typeof x === 'number') return Number.isInteger(x) ? String(x) : x.toFixed(2);
  if (x === undefined || x === null) return '';
  return String(x);
}

const pinKeyOf = (doc, n) => ard(doc).id + '.' + (n < 14 ? 'D' + n : 'A' + (n - 14));
const pinName = (n) => (n < 14 ? 'pin ' + n : 'A' + (n - 14));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DECL_TYPES = [
  'unsigned\\s+long', 'unsigned\\s+int', 'unsigned\\s+char',
  'int', 'long', 'float', 'double', 'bool', 'boolean', 'byte', 'short', 'word', 'size_t', 'char',
  'uint8_t', 'uint16_t', 'uint32_t',
];
const INT_TYPES = new Set(['int', 'long', 'byte', 'short', 'word', 'size_t', 'unsigned long', 'unsigned int', 'uint8_t', 'uint16_t', 'uint32_t']);
const TYPE_ALT = DECL_TYPES.join('|');

/** Source-to-source: a (very approximate) subset of Arduino/C++ -> async JS. */
export function transpile(src) {
  let s = src;

  // 1. strip #include lines
  s = s.replace(/^[ \t]*#include\s*[<"][^>"]*[>"][ \t]*$/gm, '');

  // 2. LiquidCrystal_I2C lcd(0x27, 16, 2);
  s = s.replace(/\bLiquidCrystal_I2C\s+(\w+)\s*\(([^)]*)\)\s*;/g, 'const $1 = __lcd($2);');
  // 3. Servo arm;
  s = s.replace(/\bServo\s+(\w+)\s*;/g, 'const $1 = __servo();');
  // 3b. DHT dht(DHTPIN, DHT11);  Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
  // Both `DHT dht(2, DHT11);` and the older `DHT dht = DHT(2, DHT11);` are in tutorials.
  s = s.replace(/\bDHT\s+(\w+)\s*(?:=\s*DHT\s*)?\(([^)]*)\)\s*;/g, 'const $1 = __dht($2);');
  s = s.replace(/\bAdafruit_NeoPixel\s+(\w+)\s*(?:=\s*Adafruit_NeoPixel\s*)?\(([^)]*)\)\s*;/g, 'const $1 = __neo($2);');

  // 4. #define NAME value
  s = s.replace(/^[ \t]*#define\s+(\w+)\s+(.+)$/gm, 'const $1 = $2;');

  // 5. strip forward declarations (prototype with no body)
  s = s.replace(/^[ \t]*(?:void|int|long|float|double|bool|byte|char)\s+\w+\s*\([^)]*\)\s*;[ \t]*$/gm, '');

  // 6. function definitions -> async function, bare param names only
  const fns = [];
  s = s.replace(
    /\b(?:void|int|long|float|double|bool|boolean|byte|char|unsigned long|unsigned int)\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
    (m, name, params) => {
      fns.push(name);
      const plist = params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const cleaned = p.replace(/\[\]/g, '').replace(/&/g, '').trim();
          const tokens = cleaned.split(/\s+/);
          return tokens[tokens.length - 1].replace(/^\*+/, '');
        })
        .join(', ');
      return `async function ${name}(${plist}) {`;
    },
  );

  // Declarations don't have to start the line (`if (x) { int y = 1; }`), just
  // follow a statement/block boundary, so anchor on that instead of `^`.
  const LEAD = '(^|[{;])[ \\t]*';

  // 7a. arrays with braces: TYPE name[] = {a,b,c};  or  TYPE name[N] = {a,b,c};
  s = s.replace(
    new RegExp(`${LEAD}(const\\s+)?(?:${TYPE_ALT})\\s+(\\w+)\\s*\\[\\s*\\d*\\s*\\]\\s*=\\s*\\{([^}]*)\\}\\s*;`, 'gm'),
    (m, lead, isConst, name, items) => `${lead}${isConst ? 'const' : 'let'} ${name} = [${items}];`,
  );
  // 7b. 2D arrays with braces: TYPE name[N][M] = {{...},{...}};
  s = s.replace(
    new RegExp(`${LEAD}(const\\s+)?(?:${TYPE_ALT})\\s+(\\w+)\\s*\\[\\s*\\d*\\s*\\]\\s*\\[\\s*\\d*\\s*\\]\\s*=\\s*(\\{[\\s\\S]*?\\});`, 'gm'),
    (m, lead, isConst, name, body) => `${lead}${isConst ? 'const' : 'let'} ${name} = ${body.replace(/\{/g, '[').replace(/\}/g, ']')};`,
  );
  // 7c. uninitialized arrays: TYPE name[N];
  s = s.replace(
    new RegExp(`${LEAD}(const\\s+)?(?:${TYPE_ALT})\\s+(\\w+)\\s*\\[\\s*(\\d+)\\s*\\]\\s*;`, 'gm'),
    (m, lead, isConst, name, size) => `${lead}let ${name} = new Array(${size}).fill(0);`,
  );

  // 7d. for-loop init declarations: for (int i = 0; ...) -- not caught by the
  // LEAD-anchored pass below since it's preceded by '(', not '^'/'{'/';'.
  s = s.replace(new RegExp(`\\bfor\\s*\\(\\s*(?:${TYPE_ALT})\\s+(\\w+)\\s*=`, 'g'), 'for (let $1 =');

  // 8. scalar declarations, with or without initializer
  s = s.replace(
    new RegExp(`${LEAD}(const\\s+)?(${TYPE_ALT})\\s+(\\w+)\\s*=\\s*([^;]+);`, 'gm'),
    (m, lead, isConst, type, name, expr) => {
      const norm = type.replace(/\s+/g, ' ');
      const val = INT_TYPES.has(norm) ? `__int(${expr})` : expr;
      return `${lead}${isConst ? 'const' : 'let'} ${name} = ${val};`;
    },
  );
  s = s.replace(
    new RegExp(`${LEAD}(const\\s+)?(?:${TYPE_ALT})\\s+(\\w+)\\s*;`, 'gm'),
    (m, lead, isConst, name) => `${lead}${isConst ? 'const' : 'let'} ${name};`,
  );

  // 9. strip remaining bare casts like (int)x
  s = s.replace(/\((?:int|float|long|double)\)(?=\s*\w)/g, '');

  // 10. await-prefix calls that wait for the page (delay/pulseIn/analog+digitalRead) and user-defined
  // function *calls* only — must not match the function's own declaration line.
  const awaitable = ['delay', 'delayMicroseconds', 'pulseIn', 'digitalRead', 'analogRead', ...fns];
  const awRe = new RegExp('(?<![.\\w])(?<!function\\s)(?<!await\\s)(' + awaitable.map(esc).join('|') + ')\\s*\\(', 'g');
  s = s.replace(awRe, 'await $1(');
  // Sensor reads ask the page, so they are awaited too: dht.readTemperature() -> await dht.readTemperature()
  s = s.replace(/(?<![.\w])(\w+)\.(readTemperature|readHumidity)\s*\(/g, 'await $1.$2(');

  // 11. cooperative yields at the top of every loop body
  s = s.replace(/\b(while\s*\([^{};]*\)|for\s*\([^{}]*\)|do)([ \t]*)\{/g, (m, head, ws) => `${head}${ws}{\n await __y();`);

  return `${s}\nreturn { setup: typeof setup === 'function' ? setup : async () => {}, loop: typeof loop === 'function' ? loop : async () => {} };`;
}

/** Builds the Arduino API surface bound to one run's cancellation token. */
function makeApi({ getDoc, log, resolve }, my) {
  const alive = () => {
    if (sim.runId !== my) throw STOP;
  };

  function pinSt(p) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 19) {
      throw new Error(`Invalid pin ${p}. Use 0–13 for digital pins or A0–A5 for analog.`);
    }
    return [sim.pins[n], n];
  }

  function pinMode(p, m) {
    alive();
    const [st] = pinSt(p);
    st.mode = m;
    if (st.mode !== 'OUTPUT') {
      st.out = 0;
      st.tone = 0;
    }
    resolve();
  }
  function digitalWrite(p, v) {
    alive();
    const [st, n] = pinSt(p);
    if (st.mode !== 'OUTPUT') {
      log(`⚠️ digitalWrite(${pinName(n)}, ...) was called before pinMode(${pinName(n)}, OUTPUT) — treating it as OUTPUT.`);
      st.mode = 'OUTPUT';
    }
    st.out = v ? 5 : 0;
    resolve();
  }
  function digitalRead(p) {
    alive();
    const [, n] = pinSt(p);
    return sim.volt(pinKeyOf(getDoc(), n)) > 2.5 ? 1 : 0;
  }
  function analogRead(p) {
    alive();
    const [, n] = pinSt(p);
    const v = sim.volt(pinKeyOf(getDoc(), n));
    return clamp(Math.round((v / 5) * 1023), 0, 1023);
  }
  function analogWrite(p, v) {
    alive();
    const [st] = pinSt(p);
    st.mode = 'OUTPUT';
    st.out = (clamp(v, 0, 255) / 255) * 5;
    resolve();
  }
  function tone(p, freq, dur) {
    alive();
    const [st] = pinSt(p);
    // Real tone() drives the pin itself (no pinMode/digitalWrite needed first).
    // The solver models pins as DC sources, so approximate the square wave as
    // a driven HIGH — same simplification already used for analogWrite/PWM.
    st.mode = 'OUTPUT';
    st.out = 5;
    st.tone = freq;
    resolve();
    if (dur) {
      const runId = sim.runId;
      setTimeout(() => {
        if (sim.runId === runId) {
          st.tone = 0;
          st.out = 0;
          resolve();
        }
      }, dur);
    }
  }
  function noTone(p) {
    alive();
    const [st] = pinSt(p);
    st.tone = 0;
    st.out = 0;
    resolve();
  }
  async function delay(ms) {
    const target = performance.now() + Math.max(0, ms);
    while (performance.now() < target) {
      alive();
      await sleep(Math.max(0, Math.min(40, target - performance.now())));
    }
    alive();
  }
  const Serial = {
    begin() {},
    print(x) {
      log.write(fmt(x));
    },
    println(x) {
      log.write(fmt(x) + '\n');
    },
  };

  async function pulseIn(p, _level, _timeout) {
    alive();
    const doc = getDoc();
    const [, n] = pinSt(p);
    const echoNode = sim.node(pinKeyOf(doc, n));
    const sonarPart = doc.parts.find((part) => part.type === 'sonar' && sim.node(part.id + '.ECHO') === echoNode && echoNode >= 0);
    if (!sonarPart) {
      log(`⚠️ pulseIn(${pinName(n)}) — no ultrasonic sensor's ECHO pin is wired to this pin.`);
      await delay(1);
      return 0;
    }
    if (!sim.sonarOn[sonarPart.id]) {
      log("⚠️ The ultrasonic sensor isn't powered — check its VCC/GND wiring.");
      await delay(1);
      return 0;
    }
    const cm = sonarPart.props.cm ?? 50;
    const us = Math.round((cm * 2) / 0.034);
    await delay(Math.min(us / 1000, 25));
    alive();
    return us;
  }

  // Warn once per run, not on every loop() call.
  function warnOnce(key, msg) {
    if (sim.warned.has(key)) return;
    sim.warned.add(key);
    log(msg);
  }

  // `kind`: 't' (°C), 'f' (°F) or 'h' (% humidity). NaN, like the real library, when nothing answers.
  function dhtRead(p, kind) {
    alive();
    const doc = getDoc();
    const [, n] = pinSt(p);
    const pinNode = sim.node(pinKeyOf(doc, n));
    const part = doc.parts.find((x) => x.type === 'dht' && pinNode >= 0 && sim.node(x.id + '.DATA') === pinNode);
    if (!part) {
      warnOnce('dht-wire', `⚠️ No DHT sensor's DATA pin is wired to ${pinName(n)}.`);
      return NaN;
    }
    if (!sim.dhtOn[part.id]) {
      warnOnce('dht-power', "⚠️ The DHT sensor isn't powered — check its VCC/GND wiring.");
      return NaN;
    }
    const t = part.props.temp ?? 24;
    if (kind === 'h') return part.props.hum ?? 50;
    return kind === 'f' ? (t * 9) / 5 + 32 : t;
  }

  // strip.show(): the colours (0xRRGGBB) the sketch set, dimmed by setBrightness.
  function neoShow(p, colors, brightness) {
    alive();
    const [, n] = pinSt(p);
    if (!Array.isArray(colors) || colors.length > 64) throw new Error('A NeoPixel strip can have up to 64 LEDs here.');
    const k = clamp(Number(brightness) || 0, 0, 255) / 255;
    const dim = (c, shift) => Math.round((((c >> shift) & 255) * k)) << shift;
    sim.neoByPin[n] = colors.map((c) => {
      const v = Number(c) >>> 0;
      return dim(v, 16) | dim(v, 8) | dim(v, 0);
    });
    resolve();
  }

  function __lcd() {
    sim.lcd.init = true;
    return {
      init() {
        alive();
        sim.lcd.init = true;
      },
      begin() {
        alive();
        sim.lcd.init = true;
      },
      backlight() {
        alive();
        sim.lcd.bl = true;
        resolve();
      },
      noBacklight() {
        alive();
        sim.lcd.bl = false;
        resolve();
      },
      clear() {
        alive();
        sim.lcd.rows = [Array(16).fill(' '), Array(16).fill(' ')];
        sim.lcd.col = 0;
        sim.lcd.row = 0;
        resolve();
      },
      setCursor(c, r) {
        alive();
        sim.lcd.col = c;
        sim.lcd.row = r;
      },
      print(x) {
        alive();
        for (const ch of fmt(x)) {
          if (sim.lcd.row >= 0 && sim.lcd.row < 2 && sim.lcd.col >= 0 && sim.lcd.col < 16) {
            sim.lcd.rows[sim.lcd.row][sim.lcd.col] = ch;
          }
          sim.lcd.col++;
        }
        resolve();
      },
    };
  }

  function __servo() {
    let attachedPin = null;
    const api = {
      attach(p) {
        alive();
        const [st, n] = pinSt(p);
        st.mode = 'SERVO';
        if (st.servo === undefined) st.servo = 90;
        attachedPin = n;
        resolve();
      },
      write(angle) {
        alive();
        if (attachedPin == null) return;
        sim.pins[attachedPin].servo = clamp(angle, 0, 180);
        resolve();
      },
      writeMicroseconds(us) {
        api.write(Math.round(((us - 544) / (2400 - 544)) * 180));
      },
      read() {
        return attachedPin == null ? 90 : (sim.pins[attachedPin].servo ?? 90);
      },
    };
    return api;
  }

  return {
    // Math, timing and constants live in public/sandbox.html; only what touches the board is here.
    names: ['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'tone', 'noTone', 'Serial', 'pulseIn', '__lcd', '__servo', 'dhtRead', 'neoShow'],
    values: [pinMode, digitalWrite, digitalRead, analogRead, analogWrite, tone, noTone, Serial, pulseIn, __lcd, __servo, dhtRead, neoShow],
  };
}

/** Default transport: a hidden sandboxed iframe with no access to this page's storage, cookies or login. */
function iframeSpawn(onMessage) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.hidden = true;
  frame.src = `${import.meta.env.BASE_URL}sandbox.html`;
  const listen = (e) => {
    if (e.source === frame.contentWindow) onMessage(e.data);
  };
  window.addEventListener('message', listen);
  document.body.appendChild(frame);
  return {
    post: (m) => frame.contentWindow.postMessage(m, '*'),
    kill() {
      window.removeEventListener('message', listen);
      frame.remove();
    },
  };
}

const RPC = ['pinMode', 'digitalWrite', 'analogWrite', 'tone', 'noTone', 'digitalRead', 'analogRead', 'pulseIn', 'dhtRead', 'neoShow'];
const REMOTE_OBJECTS = ['__lcd', '__servo'];
// shortcut: a flat cap per second; raise it if a legitimate sketch ever trips it, or drop it once calls are batched.
const MAX_CALLS_PER_SECOND = 2000; // each pin call re-solves the circuit (~1 ms), so far more than this saturates the page

/**
 * Creates one interpreter bound to a board (via getDoc/serialWrite/requestRender
 * hooks). `run`/`stop` can be called repeatedly — each run gets a fresh
 * cancellation token and a fresh sandbox, so a previous run can never affect a new one.
 * `spawn(onMessage)` creates the sandbox; tests pass their own.
 */
export function createInterpreter({ getDoc, serialWrite, requestRender, spawn = iframeSpawn }) {
  let box = null;

  function log(msg) {
    serialWrite(msg + '\n');
  }
  log.write = serialWrite;

  function resolve() {
    solveCircuit(getDoc(), log);
    updateBuzzer(sim.buzz.__any, sim.buzzFreq);
    requestRender();
  }

  function endBox() {
    box?.kill();
    box = null;
  }

  function run(code, { onStop } = {}) {
    endBox();
    sim.runId++;
    const my = sim.runId;
    resetSim();
    sim.runId = my;
    sim.running = true;
    sim.t0 = performance.now();
    resetSolverWarnings();
    log('▶ Running…');
    resolve();
    requestRender();

    let js;
    try {
      js = transpile(code);
    } catch (e) {
      log('❌ Could not read sketch: ' + e.message);
      sim.running = false;
      requestRender();
      onStop?.();
      return Promise.resolve();
    }

    const api = makeApi({ getDoc, log, resolve }, my);
    const table = Object.fromEntries(api.names.map((n, i) => [n, api.values[i]]));
    // Everything the sandboxed sketch may ask this page to do; anything else ends the run.
    const rpc = {
      ...Object.fromEntries(RPC.map((n) => [n, table[n]])),
      'Serial.print': table.Serial.print,
      'Serial.println': table.Serial.println,
    };
    const objects = new Map();

    return new Promise((done) => {
      let ended = false;
      let startTimer;
      let windowStart = 0;
      let calls = 0;
      const mine = spawn(onMessage);
      box = mine;

      function finish(error) {
        if (ended) return;
        ended = true;
        clearTimeout(startTimer);
        mine.kill();
        if (box === mine) box = null;
        if (sim.runId === my) {
          if (error) log('❌ ' + error);
          sim.running = false;
          requestRender();
          onStop?.();
        }
        done();
      }

      startTimer = setTimeout(() => finish('The sketch sandbox did not start.'), 5000);

      async function onMessage(m) {
        if (ended || sim.runId !== my || !m || typeof m !== 'object') return;
        const now = performance.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          calls = 0;
        }
        if (++calls > MAX_CALLS_PER_SECOND) return finish('The sketch is making too many calls per second.');
        const args = Array.isArray(m.args) ? m.args : [];
        try {
          if (m.t === 'ready') {
            clearTimeout(startTimer);
            mine.post({ t: 'run', js });
          } else if (m.t === 'end') {
            finish(m.error);
          } else if (m.t === 'new' && REMOTE_OBJECTS.includes(m.kind)) {
            objects.set(m.oid, table[m.kind]());
          } else if (m.t === 'obj' && Object.hasOwn(objects.get(m.oid) ?? {}, m.method)) {
            objects.get(m.oid)[m.method](...args);
          } else if (m.t === 'call' && Object.hasOwn(rpc, m.fn)) {
            const value = await rpc[m.fn](...args);
            if (m.id) mine.post({ t: 'ret', id: m.id, value });
          } else {
            finish('Unsupported call: ' + String(m.fn ?? m.method ?? m.t));
          }
        } catch (e) {
          if (e !== STOP) finish(e.message);
        }
      }
    });
  }

  function stop() {
    endBox();
    sim.runId++;
    const doc = getDoc();
    for (const p of doc.parts) {
      p.pressed = false;
      p.triggered = false;
    }
    resetSim();
    sim.running = false;
    log('■ Stopped');
    resolve();
    requestRender();
  }

  return { run, stop };
}
