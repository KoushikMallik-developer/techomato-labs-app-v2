import { buildTemplate } from '@/lib/templates';

/**
 * Built-in sample circuits by @dev, shown at the end of Community Circuits. They live in the code, not in
 * Firestore, so they need no seeding and cost no reads. They cannot be liked or commented on (no document to write to).
 */
export const SAMPLE_AUTHOR = 'dev';

const SEEDS = [
  { template: 'blink', name: 'My First Blink', tags: ['beginner'], likes: 42, description: 'The classic first circuit, cleaned up for sharing.' },
  { template: 'traffic', name: 'Tiny Traffic Light', tags: ['beginner', 'automotive'], likes: 31, description: 'Three LEDs, one loop, zero stress.' },
  { template: 'parking', name: 'Garage Parking Sensor', tags: ['sensors', 'lcd'], likes: 88, description: 'Ultrasonic sensor + LCD readout, buzzes when you get close.' },
  { template: 'rgbled', name: 'RGB Mood Light', tags: ['leds', 'pwm'], likes: 57, description: 'Smooth PWM color cycling for a desk lamp.' },
  { template: 'servoseg', name: 'Servo Score Counter', tags: ['servo', 'display'], likes: 24, description: 'A servo arm and a digit display counting together.' },
  { template: 'relaymotor', name: 'One-Button Fan Switch', tags: ['relay', 'motor'], likes: 19, description: 'A button toggles a relay-driven motor.' },
];

const DAY = 86400000;
let cache;

/** The samples in gallery-item shape, newest first like the rest of the gallery. Built once, on first use. */
export function getSamples() {
  cache ??= SEEDS.map(({ template, likes, ...rest }, i) => ({
    ...rest,
    ...buildTemplate(template),
    id: `sample-${template}`,
    author: SAMPLE_AUTHOR,
    ownerId: '',
    likeCount: likes,
    liked: false,
    createdAt: 0,
    updatedAt: 0,
    publishedAt: Date.UTC(2026, 0, 1) - i * DAY,
  }));
  return cache;
}

export const getSample = (id) => getSamples().find((s) => s.id === id);

export const isSampleId = (id) => typeof id === 'string' && id.startsWith('sample-');
