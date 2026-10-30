/**
 * Guided lessons. Each one starts a new circuit from a template and shows its steps beside the editor.
 * Static content: no Firestore reads.
 */
export const LESSONS = [
  {
    id: 'blink',
    template: 'blink',
    level: 'Beginner',
    title: 'Blink an LED',
    summary: 'Your first sketch: turn an LED on and off with digitalWrite and delay.',
    steps: [
      'Look at the board: a red LED and its resistor sit on the breadboard, wired to pin D13 and GND.',
      'Open the Sketch tab. setup() runs once and sets pin 13 as an OUTPUT; loop() runs again and again.',
      'Press Run (or Ctrl+Enter). The LED blinks once a second.',
      'Stop, change both delay(1000) calls to delay(200) and run again. The blink gets faster.',
      'Click the LED and pick another colour in the Inspector. Save with Ctrl+S.',
    ],
  },
  {
    id: 'traffic',
    template: 'traffic',
    level: 'Beginner',
    title: 'Traffic light',
    summary: 'Drive three LEDs in order, using constants for the pin numbers.',
    steps: [
      'Three LEDs are wired to D13 (red), D12 (yellow) and D11 (green).',
      'In the sketch, find the const int lines: naming pins makes the code easier to read.',
      'Run it and watch the lights cycle. Each digitalWrite turns one light on or off.',
      'Make the green light last twice as long by doubling its delay.',
      'Challenge: add a short yellow phase between red and green, like a real traffic light.',
    ],
  },
  {
    id: 'rgb',
    template: 'rgbled',
    level: 'Beginner',
    title: 'RGB colours with PWM',
    summary: 'Mix colours by fading the red, green and blue legs of one LED with analogWrite.',
    steps: [
      'The RGB LED has three colour legs on D9, D10 and D11 (PWM pins) and one GND leg.',
      'analogWrite(pin, 0..255) sets how bright each colour is, not just on or off.',
      'Run the sketch: the LED fades through the rainbow.',
      'Open the Plotter tab and add Serial.println lines for the colour values to watch them change.',
      'Challenge: make the LED hold pure purple (red + blue) for one second each cycle.',
    ],
  },
  {
    id: 'sensors',
    template: 'sensors',
    level: 'Intermediate',
    title: 'Read sensors',
    summary: 'Read a knob, a light sensor and a motion sensor, and log their values.',
    steps: [
      'The knob and light sensor go to analog pins; analogRead returns 0 to 1023.',
      'The motion sensor is digital: digitalRead returns HIGH when it sees movement.',
      'Run the sketch and open the Serial tab to see the readings.',
      'Switch to the Plotter tab to see the same numbers as a live graph.',
      'While it runs, drag the knob or the light sensor to change its value, or click the motion sensor, and watch the graph react.',
    ],
  },
  {
    id: 'parking',
    template: 'parking',
    level: 'Intermediate',
    title: 'Parking sensor',
    summary: 'Measure distance with an ultrasonic sensor and show it on an LCD, with a buzzer warning.',
    steps: [
      'The HC-SR04 sends a sound pulse on TRIG and times the echo on ECHO.',
      'The sketch turns the echo time into centimetres and prints them on the I2C LCD.',
      'Run it, then drag the ultrasonic sensor to change the distance. The LCD and the LEDs follow.',
      'Below a set distance the buzzer sounds. Find that number in the sketch and change it.',
      'Challenge: make the buzzer beep faster as the object gets closer.',
    ],
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
