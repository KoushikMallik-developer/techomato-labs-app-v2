/**
 * Starter circuits: the "New project" template gallery, the auto-created
 * first project for new accounts, and the in-editor "Load an example
 * sketch" list. Every builder returns a fresh {parts, wires, code} document
 * (own ids each call) so two projects created from the same template never
 * share references.
 *
 * Wiring here connects component pins directly to Arduino pins/GND rather
 * than routing through specific breadboard holes (the breadboard part is
 * still placed on-canvas for realism, it just isn't load-bearing in these
 * seed circuits) — this keeps template authoring simple while producing
 * circuits that solve and simulate correctly. Users can still wire through
 * breadboard holes freely once editing.
 */
import { rid } from '@/lib/id';
import { wireColor } from '@/features/editor/engine/constants';

function mkPart(id, type, x, y, props = {}, rot = 0) {
  return { id, type, x, y, rot, props };
}
function mkWire(a, b) {
  return { id: rid('w-'), a, b };
}
function colorize(doc) {
  return { ...doc, wires: doc.wires.map((w, i) => ({ ...w, color: wireColor(w.a, w.b, i) })) };
}
function withIds(doc) {
  // Re-stamp every part/wire id so repeated builds of the same template
  // never collide inside one project.
  const suffix = rid('-');
  const remap = new Map();
  const parts = doc.parts.map((p) => {
    const nid = p.id + suffix;
    remap.set(p.id, nid);
    return { ...p, id: nid };
  });
  const rewire = (key) => {
    const [id, pin] = key.split('.');
    return `${remap.get(id) || id}.${pin}`;
  };
  const wires = doc.wires.map((w) => ({ ...w, id: rid('w-'), a: rewire(w.a), b: rewire(w.b) }));
  return { parts, wires, code: doc.code };
}

function ledLeg(id, x, y, color, pin, gndPin = 'ard.GND1') {
  const led = mkPart(`${id}led`, 'led', x, y, { color });
  const res = mkPart(`${id}res`, 'resistor', x, y + 40, { ohms: 220 });
  return {
    parts: [led, res],
    wires: [
      mkWire(`${led.id}.A`, `ard.${pin}`),
      mkWire(`${led.id}.K`, `${res.id}.1`),
      mkWire(`${res.id}.2`, gndPin),
    ],
  };
}

const CODE_BLANK = `void setup() {
  // put your setup code here, runs once
}

void loop() {
  // put your main code here, runs repeatedly
}
`;

const CODE_BLINK = `// The built-in "L" LED and the red LED share pin 13.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`;

const CODE_TRAFFIC = `const int RED = 13;
const int YELLOW = 12;
const int GREEN = 11;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(GREEN, HIGH);
  delay(2000);
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, HIGH);
  delay(500);
  digitalWrite(YELLOW, LOW);
  digitalWrite(RED, HIGH);
  delay(2000);
  digitalWrite(RED, LOW);
}
`;

const CODE_PARKING = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Drag the HC-SR04 sensor up or down to change the distance.
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int TRIG = 7;
const int ECHO = 6;
const int RED = 13;
const int GREEN = 9;
const int BUZZER = 8;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(RED, OUTPUT);
  pinMode(GREEN, OUTPUT);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Parking sensor");
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duration = pulseIn(ECHO, HIGH);
  int cm = duration * 0.034 / 2;

  lcd.setCursor(0, 1);
  lcd.print("Dist: ");
  lcd.print(cm);
  lcd.print(" cm     ");
  Serial.println("distance = " + String(cm) + " cm");

  if (cm < 20) {
    digitalWrite(RED, HIGH);
    digitalWrite(GREEN, LOW);
    tone(BUZZER, 1200, 80);
  } else {
    digitalWrite(RED, LOW);
    digitalWrite(GREEN, HIGH);
  }
  delay(200);
}
`;

const CODE_RGB = `// Cycles the RGB LED through a rainbow using PWM.
const int R = 9, G = 10, B = 11;

void setColor(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void loop() {
  setColor(255, 0, 0);
  delay(500);
  setColor(0, 255, 0);
  delay(500);
  setColor(0, 0, 255);
  delay(500);
  setColor(255, 255, 0);
  delay(500);
}

void setup() {
  pinMode(R, OUTPUT);
  pinMode(G, OUTPUT);
  pinMode(B, OUTPUT);
}
`;

const CODE_SERVO_SEG = `#include <Servo.h>
Servo arm;
const int segPins[] = {2, 3, 4, 5, 6, 7, 8}; // a b c d e f g
const bool digits[10][7] = {
  {1,1,1,1,1,1,0}, {0,1,1,0,0,0,0}, {1,1,0,1,1,0,1}, {1,1,1,1,0,0,1}, {0,1,1,0,0,1,1},
  {1,0,1,1,0,1,1}, {1,0,1,1,1,1,1}, {1,1,1,0,0,0,0}, {1,1,1,1,1,1,1}, {1,1,1,1,0,1,1}
};

void showDigit(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(segPins[i], digits[d][i] ? HIGH : LOW);
}

void setup() {
  for (int i = 0; i < 7; i++) pinMode(segPins[i], OUTPUT);
  arm.attach(9);
}

void loop() {
  for (int d = 0; d < 10; d++) {
    showDigit(d);
    arm.write(d * 18);
    delay(400);
  }
}
`;

const CODE_SENSORS = `// Reads a knob, a light sensor, and a motion sensor.
const int PIR = 2;

void setup() {
  pinMode(PIR, INPUT);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);
  int light = analogRead(A1);
  int motion = digitalRead(PIR);
  Serial.println("knob=" + String(knob) + " light=" + String(light) + " motion=" + String(motion));
  delay(300);
}
`;

const CODE_RELAY_MOTOR = `// Press the button to toggle the relay, which switches the motor.
const int BUTTON = 2;
const int RELAY = 8;
bool motorOn = false;
bool lastBtn = false;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(RELAY, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool btn = digitalRead(BUTTON) == LOW;
  if (btn && !lastBtn) {
    motorOn = !motorOn;
    digitalWrite(RELAY, motorOn ? HIGH : LOW);
    Serial.println(motorOn ? "Motor ON" : "Motor OFF");
  }
  lastBtn = btn;
  delay(30);
}
`;

const BUILDERS = {
  blank: () => ({
    parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250)],
    wires: [],
    code: CODE_BLANK,
  }),
  blink: () => {
    const l = ledLeg('l1', 90, 20, 'red', 'D13');
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), ...l.parts],
      wires: l.wires,
      code: CODE_BLINK,
    };
  },
  traffic: () => {
    const r = ledLeg('r1', 60, 20, 'red', 'D13');
    const y = ledLeg('y1', 160, 20, 'yellow', 'D12');
    const g = ledLeg('g1', 260, 20, 'green', 'D11');
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), ...r.parts, ...y.parts, ...g.parts],
      wires: [...r.wires, ...y.wires, ...g.wires],
      code: CODE_TRAFFIC,
    };
  },
  parking: () => {
    const lcd = mkPart('lcd1', 'lcd', 460, 500);
    const sonar = mkPart('us1', 'sonar', 380, 30);
    const buzz = mkPart('bz1', 'buzzer', 380, 150);
    const red = ledLeg('r1', 60, 20, 'red', 'D13');
    const green = ledLeg('g1', 150, 20, 'green', 'D9');
    return {
      parts: [
        mkPart('bb', 'breadboard', 0, 0),
        mkPart('ard', 'arduino', 30, 250),
        lcd, sonar, buzz,
        ...red.parts, ...green.parts,
      ],
      wires: [
        ...red.wires, ...green.wires,
        mkWire('us1.VCC', 'ard.5V'), mkWire('us1.TRIG', 'ard.D7'), mkWire('us1.ECHO', 'ard.D6'), mkWire('us1.GND', 'ard.GND1'),
        mkWire('bz1.P', 'ard.D8'), mkWire('bz1.N', 'ard.GND2'),
        mkWire('lcd1.GND', 'ard.GND1'), mkWire('lcd1.VCC', 'ard.5V'), mkWire('lcd1.SDA', 'ard.A4'), mkWire('lcd1.SCL', 'ard.A5'),
      ],
      code: CODE_PARKING,
    };
  },
  rgbled: () => {
    const rgb = mkPart('rgb1', 'rgbled', 150, 30);
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), rgb],
      wires: [
        mkWire('rgb1.R', 'ard.D9'), mkWire('rgb1.G', 'ard.D10'), mkWire('rgb1.B', 'ard.D11'), mkWire('rgb1.GND', 'ard.GND1'),
      ],
      code: CODE_RGB,
    };
  },
  servoseg: () => {
    const servo = mkPart('sv1', 'servo', 380, 40);
    const seg = mkPart('seg1', 'sevenseg', 200, 40);
    const pins = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    const chans = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), servo, seg],
      wires: [
        mkWire('sv1.S', 'ard.D9'), mkWire('sv1.VCC', 'ard.5V'), mkWire('sv1.GND', 'ard.GND1'),
        mkWire('seg1.COM', 'ard.GND2'),
        ...chans.map((ch, i) => mkWire(`seg1.${ch}`, `ard.${pins[i]}`)),
      ],
      code: CODE_SERVO_SEG,
    };
  },
  sensors: () => {
    const pot = mkPart('pot1', 'pot', 120, 480, { pos: 0.5 });
    const ldr = mkPart('ldr1', 'ldr', 220, 480, { light: 70 });
    const pir = mkPart('pir1', 'pir', 320, 40);
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), pot, ldr, pir],
      wires: [
        mkWire('pot1.A', 'ard.5V'), mkWire('pot1.W', 'ard.A0'), mkWire('pot1.B', 'ard.GND1'),
        mkWire('ldr1.A', 'ard.5V'), mkWire('ldr1.B', 'ard.A1'),
        mkWire('pir1.VCC', 'ard.5V'), mkWire('pir1.OUT', 'ard.D2'), mkWire('pir1.GND', 'ard.GND2'),
      ],
      code: CODE_SENSORS,
    };
  },
  relaymotor: () => {
    const relay = mkPart('rl1', 'relay', 220, 40);
    const motor = mkPart('mo1', 'motor', 340, 40);
    const btn = mkPart('bt1', 'button', 120, 40);
    return {
      parts: [mkPart('bb', 'breadboard', 0, 0), mkPart('ard', 'arduino', 30, 250), relay, motor, btn],
      wires: [
        mkWire('bt1.1', 'ard.D2'), mkWire('bt1.2', 'ard.GND1'),
        mkWire('rl1.IN', 'ard.D8'), mkWire('rl1.GND', 'ard.GND2'),
        mkWire('rl1.COM', 'ard.5V'), mkWire('rl1.NO', 'mo1.+'), mkWire('mo1.-', 'ard.GND1'),
      ],
      code: CODE_RELAY_MOTOR,
    };
  },
};

/** Shared tag vocabulary used by both the project tag picker and gallery filter chips. */
export const TAGS = [
  'beginner', 'sensors', 'leds', 'display', 'motor', 'automotive', 'pwm', 'lcd', 'servo', 'relay',
];

export const TEMPLATES = [
  { key: 'blank', name: 'Blank breadboard', hint: 'Just a breadboard and an Arduino — start from scratch.' },
  { key: 'blink', name: 'Blink an LED', hint: 'The classic first circuit.' },
  { key: 'traffic', name: 'Traffic light', hint: 'Three LEDs cycling red / yellow / green.' },
  { key: 'parking', name: 'Parking sensor', hint: 'Ultrasonic distance sensor, LCD readout, and a buzzer.' },
  { key: 'rgbled', name: 'RGB color cycle', hint: 'PWM-fade an RGB LED through colors.' },
  { key: 'servoseg', name: 'Servo + 7-segment counter', hint: 'A servo arm and a digit display counting together.' },
  { key: 'sensors', name: 'Sensor playground', hint: 'A knob, a light sensor, and a motion sensor logging to serial.' },
  { key: 'relaymotor', name: 'Relay-switched motor', hint: 'A button toggles a relay that drives a motor.' },
];

/** Builds a fresh {parts, wires, code} document for a template key. */
export function buildTemplate(key) {
  const builder = BUILDERS[key] || BUILDERS.blank;
  return colorize(withIds(builder()));
}

/** In-editor "Load an example sketch" list — code only, reuses live parts. */
export const EXAMPLES = [
  { name: 'Parking sensor (LCD + HC-SR04)', code: CODE_PARKING },
  {
    name: 'Knob-controlled blink', code: `// Turn the knob (A0) to change how fast the red LED blinks.
// Hold the button (pin 2) to light the green LED.
const int RED = 13;
const int GREEN = 9;
const int BUTTON = 2;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Ready!");
}

void loop() {
  int pot = analogRead(A0);
  int wait = map(pot, 0, 1023, 60, 1000);
  Serial.println("pot = " + String(pot) + ", wait = " + String(wait) + " ms");

  digitalWrite(RED, HIGH);
  waitAndCheck(wait);
  digitalWrite(RED, LOW);
  waitAndCheck(wait);
}

// Waits, but keeps checking the button so it feels responsive
void waitAndCheck(int ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    digitalWrite(GREEN, digitalRead(BUTTON) == LOW ? HIGH : LOW);
    delay(10);
  }
}
`,
  },
  {
    name: 'PWM dimmer', code: `// The knob on A0 sets the green LED's brightness using PWM (pin 9).
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int pot = analogRead(A0);
  int level = map(pot, 0, 1023, 0, 255);
  analogWrite(9, level);
  Serial.println("brightness: " + String(level));
  delay(100);
}
`,
  },
  {
    name: 'Button plays a scale', code: `// Press the button to play a scale on the buzzer (pin 8).
const int BUZZER = 8;
const int BUTTON = 2;
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {
  pinMode(13, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Press the button to play a scale");
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {
    for (int i = 0; i < 8; i++) {
      Serial.println("note " + String(notes[i]) + " Hz");
      tone(BUZZER, notes[i]);
      digitalWrite(13, HIGH);
      delay(160);
      digitalWrite(13, LOW);
      delay(40);
    }
    noTone(BUZZER);
  }
  delay(20);
}
`,
  },
  { name: 'Classic blink', code: CODE_BLINK },
];
