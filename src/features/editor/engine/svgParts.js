import {
  LED_COLORS, BAND, fmtOhms, LEG,
  ARD_PINS, ARD_LABELS, ARD_TOP, ARD_BOTTOM, PWM, BB_ROWS, BB_PINS,
} from './constants';
import { esc, ck } from './geometry';
import { sim } from './engineStore';

/** Filled in by board.js each render with the set of occupied breadboard holes. */
export let OCC = new Set();
export function setOcc(next) {
  OCC = next;
}

export const DEFS = `<defs><pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" fill="none" style="stroke:var(--grid)" stroke-width="1"/><path d="M100 0H0V100" fill="none" style="stroke:var(--grid-major)" stroke-width="1.2"/></pattern>${Object.entries(
  LED_COLORS,
)
  .map(
    ([k, c]) =>
      `<radialGradient id="glow-${k}"><stop offset="0" stop-color="${c.fill}" stop-opacity=".9"/><stop offset=".45" stop-color="${c.fill}" stop-opacity=".35"/><stop offset="1" stop-color="${c.fill}" stop-opacity="0"/></radialGradient>`,
  )
  .join('')}</defs>`;

export const DRAW = {
  breadboard(p) {
    let s = `<rect x="0" y="0" width="330" height="200" rx="6" fill="#eef0f2" stroke="#c3c9cf"/>
<rect x="4" y="89" width="322" height="12" rx="2" fill="#dde1e5"/>
<line x1="14" y1="3.5" x2="316" y2="3.5" stroke="#e5484d" stroke-width="1.2"/><line x1="14" y1="26.5" x2="316" y2="26.5" stroke="#2f7bd6" stroke-width="1.2"/>
<line x1="14" y1="173.5" x2="316" y2="173.5" stroke="#2f7bd6" stroke-width="1.2"/><line x1="14" y1="196.5" x2="316" y2="196.5" stroke="#e5484d" stroke-width="1.2"/>`;
    const tf = 'font-family="Instrument Sans,sans-serif" font-size="7" text-anchor="middle"';
    const tx = tf + ' fill="#7d858e"';
    const tr = tf + ' fill="#e5484d"';
    s += `<text x="7" y="13" ${tr}>+</text><text x="7" y="23" ${tx}>−</text><text x="7" y="183" ${tx}>−</text><text x="7" y="193" ${tr}>+</text>`;
    for (const r in BB_ROWS) s += `<text x="8" y="${BB_ROWS[r] + 2.5}" ${tx}>${r}</text>`;
    for (const c of [1, 5, 10, 15, 20, 25, 30])
      s += `<text x="${10 + 10 * c}" y="34.5" ${tx}>${c}</text><text x="${10 + 10 * c}" y="163" ${tx}>${c}</text>`;
    for (const pin in BB_PINS) {
      const [x, y] = BB_PINS[pin];
      const used = OCC.has(ck(p.x + x, p.y + y));
      s += `<rect x="${x - 2.1}" y="${y - 2.1}" width="4.2" height="4.2" rx=".8" fill="${used ? '#16181b' : '#4f555c'}"/>`;
    }
    return s;
  },
  arduino() {
    const st = sim.running ? sim.pins[13] : null;
    const L = st && st.mode === 'OUTPUT' ? st.out / 5 : 0;
    let s = `<rect x="0" y="0" width="280" height="190" rx="10" fill="#00838a" stroke="#006a70" stroke-width="2"/>
<rect x="-14" y="30" width="40" height="46" rx="3" fill="#c4c9cf" stroke="#8d949c"/><rect x="-10" y="36" width="30" height="34" rx="2" fill="#aeb4bb"/>
<rect x="-10" y="118" width="34" height="46" rx="4" fill="#26282b"/><circle cx="7" cy="141" r="8" fill="#111"/>
<rect x="84" y="104" width="24" height="10" rx="5" fill="#d5d9de"/>
<rect x="44" y="96" width="18" height="18" rx="2" fill="#c9ced4"/><circle cx="53" cy="105" r="5" fill="#e5484d"/>
<rect x="120" y="100" width="118" height="28" rx="2" fill="#1d2126"/>`;
    for (let i = 0; i < 14; i++)
      s += `<rect x="${123 + i * 8.2}" y="96" width="4" height="4" fill="#c9ced4"/><rect x="${123 + i * 8.2}" y="128" width="4" height="4" fill="#c9ced4"/>`;
    s += `<text x="212" y="76" text-anchor="middle" font-family="Instrument Sans,sans-serif" font-weight="700" font-size="24" fill="#fff" fill-opacity=".92">UNO</text>
<text x="212" y="88" text-anchor="middle" font-family="Instrument Sans,sans-serif" font-size="7.5" letter-spacing="2" fill="#bfe9ea">ARDUINO</text>`;
    if (L > 0.05) s += `<circle cx="75" cy="51" r="9" fill="url(#glow-yellow)" opacity="${L}"/>`;
    s += `<rect x="70" y="48" width="10" height="6" rx="1.5" fill="${L > 0.05 ? '#ffb020' : '#6e5320'}"/><text x="84" y="54" font-size="7" fill="#fff" font-family="Instrument Sans,sans-serif">L</text>
<rect x="70" y="62" width="10" height="6" rx="1.5" fill="${sim.running ? '#6dff8a' : '#2f5a3a'}"/><text x="84" y="68" font-size="7" fill="#fff" font-family="Instrument Sans,sans-serif">ON</text>
<rect x="32" y="5" width="234" height="14" rx="1.5" fill="#1b1d20"/><rect x="52" y="171" width="61" height="14" rx="1.5" fill="#1b1d20"/><rect x="142" y="171" width="91" height="14" rx="1.5" fill="#1b1d20"/>
<text x="206" y="50" text-anchor="middle" font-size="6.5" fill="#bfe9ea" font-family="Instrument Sans,sans-serif">DIGITAL (PWM ~)</text>
<text x="82" y="144" text-anchor="middle" font-size="6.5" fill="#bfe9ea" font-family="Instrument Sans,sans-serif">POWER</text>
<text x="188" y="144" text-anchor="middle" font-size="6.5" fill="#bfe9ea" font-family="Instrument Sans,sans-serif">ANALOG IN</text>`;
    const mono = 'font-family="JetBrains Mono,monospace" font-size="7" fill="#eefafa"';
    for (const id of ARD_TOP) {
      const [x, y] = ARD_PINS[id];
      const lab = id.startsWith('D') && PWM.has(+id.slice(1)) ? '~' + ARD_LABELS[id] : ARD_LABELS[id];
      s += `<rect x="${x - 2.8}" y="${y - 2.8}" width="5.6" height="5.6" fill="#454a51"/><text transform="translate(${x + 2.5} 23) rotate(-90)" text-anchor="end" ${mono}>${lab}</text>`;
    }
    for (const id of ARD_BOTTOM) {
      const [x, y] = ARD_PINS[id];
      s += `<rect x="${x - 2.8}" y="${y - 2.8}" width="5.6" height="5.6" fill="#454a51"/><text transform="translate(${x + 2.5} 166) rotate(-90)" text-anchor="start" ${mono}>${ARD_LABELS[id]}</text>`;
    }
    return s;
  },
  led(p) {
    const c = LED_COLORS[p.props.color] || LED_COLORS.red;
    const burned = sim.running && sim.burned[p.id];
    const b = sim.running && !burned ? sim.ledB[p.id] || 0 : 0;
    const fill = burned ? '#4a4a4a' : c.fill;
    let s = `<line x1="-5" y1="2" x2="-5" y2="24" ${LEG}/><line x1="5" y1="2" x2="5" y2="24" ${LEG}/>
<text x="11" y="21" font-size="9" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">+</text>`;
    if (b > 0.02) s += `<circle cx="0" cy="-8" r="${20 + 12 * b}" fill="url(#glow-${p.props.color})" opacity="${Math.min(1, 0.3 + b)}"/>`;
    s += `<path d="M-10 1V-8A10 10 0 0 1 10 -8V1Z" fill="${fill}" fill-opacity="${burned ? 1 : 0.5 + 0.5 * b}" stroke="rgba(0,0,0,.35)"/>
<rect x="-12" y="0" width="24" height="4" rx="1.5" fill="${fill}" fill-opacity="${burned ? 1 : 0.65 + 0.35 * b}" stroke="rgba(0,0,0,.35)"/>
<path d="M-5 -10A5 6 0 0 1 -1 -15" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    if (b > 0.3) s += `<circle cx="0" cy="-6" r="4" fill="#fff" opacity="${(b - 0.3).toFixed(2)}"/>`;
    if (burned) s += `<path d="M-5 -12L5 -2M5 -12L-5 -2" stroke="#ff453a" stroke-width="2"/><text x="0" y="-22" text-anchor="middle" font-size="12">\u{1F4A8}</text>`;
    return s;
  },
  resistor(p) {
    const v = p.props.ohms;
    const str = String(v);
    let s = `<line x1="-40" y1="0" x2="-17" y2="0" ${LEG}/><line x1="17" y1="0" x2="40" y2="0" ${LEG}/>
<rect x="-19" y="-6.5" width="38" height="13" rx="6" fill="#dcc193" stroke="#b89a66"/>`;
    [
      [-11, +str[0]],
      [-5, +str[1]],
      [1, str.length - 2],
    ].forEach(([x, d]) => (s += `<rect x="${x}" y="-6.2" width="3.4" height="12.4" fill="${BAND[d]}"/>`));
    s += `<rect x="10" y="-6.2" width="3.4" height="12.4" fill="#c9a227"/>
<text x="0" y="-11" text-anchor="middle" font-size="8.5" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${fmtOhms(v)}</text>`;
    return s;
  },
  button(p) {
    const on = sim.running && p.pressed;
    return `<line x1="-30" y1="0" x2="-15" y2="0" ${LEG}/><line x1="15" y1="0" x2="30" y2="0" ${LEG}/>
<g data-ctl="button"><rect x="-16" y="-16" width="32" height="32" rx="3" fill="#2a2d31" stroke="#1a1c1f"/>
${[
  [-11, -11],
  [11, -11],
  [-11, 11],
  [11, 11],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#55595f"/>`)
  .join('')}
<circle r="${on ? 8.3 : 9.5}" fill="${on ? '#b8322d' : '#e5484d'}" stroke="#7d1f1b"/><circle cx="-2.5" cy="-2.5" r="3" fill="#fff" opacity="${on ? 0.12 : 0.3}"/></g>`;
  },
  pot(p) {
    const pos = p.props.pos ?? 0.5;
    const a = ((-135 + 270 * pos) * Math.PI) / 180;
    const x2 = (Math.sin(a) * 9).toFixed(2);
    const y2 = (-6 - Math.cos(a) * 9).toFixed(2);
    return `${[-10, 0, 10].map((x) => `<line x1="${x}" y1="10" x2="${x}" y2="26" ${LEG}/>`).join('')}
<g data-ctl="pot"><rect x="-21" y="-26" width="42" height="38" rx="4" fill="#2456c9" stroke="#183e98"/>
<circle cx="0" cy="-6" r="13" fill="#e3e6ea" stroke="#9aa1aa"/><circle cx="0" cy="-6" r="10" fill="#cfd4da"/>
<line x1="0" y1="-6" x2="${x2}" y2="${y2}" stroke="#23272d" stroke-width="2.5" stroke-linecap="round"/></g>
<text x="0" y="41" text-anchor="middle" font-size="8.5" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${Math.round(pos * 100)}%</text>`;
  },
  buzzer(p) {
    const on = sim.running && sim.buzz[p.id];
    return `<line x1="-5" y1="12" x2="-5" y2="26" ${LEG}/><line x1="5" y1="12" x2="5" y2="26" ${LEG}/>
<circle cx="0" cy="-2" r="18" fill="#1d1f22" stroke="#3a3d42" stroke-width="1.5"/>
<circle cx="0" cy="-2" r="12" fill="none" stroke="#35383d" stroke-width="1.5"/><circle cx="0" cy="-2" r="3" fill="#050505"/>
<text x="-12" y="-9" font-size="8" fill="#c9ced4" font-family="Instrument Sans,sans-serif">+</text>
${on ? '<g stroke="#ffd166" stroke-width="2" fill="none" stroke-linecap="round"><path d="M23 -12A14 14 0 0 1 23 8"/><path d="M29 -17A21 21 0 0 1 29 13" opacity=".6"/></g>' : ''}`;
  },
  lcd(p) {
    const on = sim.running && sim.lcdOn[p.id];
    const i2c = on && sim.lcdI2C[p.id];
    const data = i2c && sim.lcd.init;
    const bl = on && (!data || sim.lcd.bl);
    let s = [-75, -65, -55, -45].map((x) => `<line x1="${x}" y1="28" x2="${x}" y2="40" ${LEG}/>`).join('');
    s += `<rect x="-90" y="-36" width="180" height="66" rx="3" fill="#1f7a3a" stroke="#17602d"/>
${[
  [-84, -30],
  [84, -30],
  [-84, 24],
  [84, 24],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f3d1d"/>`)
  .join('')}
<rect x="-80" y="-31" width="160" height="44" rx="2" fill="#16181b"/>
<rect x="-76" y="-27" width="152" height="36" rx="1" fill="${bl ? '#3f6fe0' : '#1c2f66'}"/>`;
    if (data) {
      const ink = sim.lcd.bl ? '#f2f6ff' : '#8ea3d8';
      sim.lcd.rows.forEach((row, r) =>
        row.forEach((chr, c) => {
          if (chr !== ' ')
            s += `<text x="${-74.5 + c * 9.43}" y="${r ? 4 : -12}" font-family="JetBrains Mono,monospace" font-size="11.5" fill="${ink}">${esc(chr)}</text>`;
        }),
      );
    } else if (on) {
      for (let c = 0; c < 16; c++)
        s += `<rect x="${-74.5 + c * 9.43}" y="-22" width="7.6" height="11" fill="#fff" opacity=".22"/>`;
    }
    s += ['GND', 'VCC', 'SDA', 'SCL']
      .map((l, i) => `<text x="${-75 + i * 10}" y="24" text-anchor="middle" font-size="4.6" fill="#e6f3ea" font-family="Instrument Sans,sans-serif">${l}</text>`)
      .join('');
    s += `<text x="62" y="24" text-anchor="middle" font-size="6" fill="#e6f3ea" font-family="Instrument Sans,sans-serif">I2C 0x27</text>`;
    return s;
  },
  sonar(p) {
    const cm = Math.round(p.props.cm ?? 50);
    let s = [-15, -5, 5, 15].map((x) => `<line x1="${x}" y1="16" x2="${x}" y2="34" ${LEG}/>`).join('');
    s += `<g data-ctl="sonar"><rect x="-45" y="-22" width="90" height="40" rx="3" fill="#1b5fae" stroke="#154b8a"/>
${[-24, 24]
  .map(
    (x) =>
      `<circle cx="${x}" cy="-2" r="15" fill="#c9ced4" stroke="#8d949c"/><circle cx="${x}" cy="-2" r="11" fill="#2b2f35"/><circle cx="${x}" cy="-2" r="11" fill="none" stroke="#454a51" stroke-dasharray="1.5 1.5" stroke-width="3"/>`,
  )
  .join('')}
<rect x="-6" y="-18" width="12" height="6" rx="3" fill="#d5d9de"/>
<text x="0" y="14" text-anchor="middle" font-size="5.5" fill="#dbe8f7" font-family="Instrument Sans,sans-serif">HC-SR04</text>
${['VCC', 'TRIG', 'ECHO', 'GND'].map((l, i) => `<text transform="translate(${-15 + i * 10 + 2} 9) rotate(-90)" font-size="4.5" fill="#dbe8f7" font-family="Instrument Sans,sans-serif">${l}</text>`).join('')}</g>
<text x="0" y="-30" text-anchor="middle" font-size="9.5" font-weight="600" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">↕ ${cm} cm</text>`;
    return s;
  },
  rgbled(p) {
    const ch = (c) => (sim.running && !sim.burned[p.id + ':' + c] ? sim.ledB[p.id + ':' + c] || 0 : 0);
    const br = ch('R');
    const bg = ch('G');
    const bb = ch('B');
    const peak = Math.max(br, bg, bb);
    let s = ['R', 'G', 'B', 'GND'].map((l, i) => `<line x1="${-15 + i * 10}" y1="2" x2="${-15 + i * 10}" y2="24" ${LEG}/>`).join('');
    if (peak > 0.03) s += `<circle cx="0" cy="-8" r="${20 + 12 * peak}" fill="url(#glow-white)" opacity="${Math.min(0.5, peak * 0.5)}"/>`;
    s += `<path d="M-12 1V-9A12 12 0 0 1 12 -9V1Z" fill="#eef0f2" fill-opacity="0.5" stroke="rgba(0,0,0,.3)"/>
<rect x="-14" y="0" width="28" height="4" rx="1.5" fill="#c9ced4" stroke="rgba(0,0,0,.3)"/>
${[
  [-15, '#ff3b30', br],
  [-5, '#30d158', bg],
  [5, '#2f8bff', bb],
]
  .map(([x, col, b]) => `<circle cx="${x}" cy="-6" r="3" fill="${col}" opacity="${0.25 + 0.75 * b}"/>`)
  .join('')}
<text x="15" y="21" font-size="9" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">−</text>`;
    return s;
  },
  diode(p) {
    const on = sim.running && sim.dOn[p.id];
    return `<line x1="-16" y1="0" x2="-6" y2="0" ${LEG}/><line x1="6" y1="0" x2="16" y2="0" ${LEG}/>
<rect x="-8" y="-5" width="16" height="10" rx="2" fill="#2a2d31" stroke="${on ? '#ffd166' : '#1a1c1f'}"/>
<rect x="5" y="-5" width="2.2" height="10" fill="#c9ced4"/><path d="M-4 -3 0 0-4 3" fill="none" stroke="#9aa1aa" stroke-width="1.1"/>`;
  },
  capacitor() {
    return `<line x1="-10" y1="0" x2="-3" y2="0" ${LEG}/><line x1="3" y1="0" x2="10" y2="0" ${LEG}/>
<rect x="-3.4" y="-12" width="2.8" height="24" rx="1" fill="#3a6b5c" stroke="#274a3f"/><rect x="0.6" y="-12" width="2.8" height="24" rx="1" fill="#3a6b5c" stroke="#274a3f"/>
<text x="0" y="-16" text-anchor="middle" font-size="7.5" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">cap</text>`;
  },
  toggle(p) {
    const on = !!p.props.on;
    return `<line x1="-15" y1="0" x2="-8" y2="0" ${LEG}/><line x1="8" y1="0" x2="15" y2="0" ${LEG}/>
<g data-ctl="toggle"><rect x="-9" y="-7" width="18" height="14" rx="7" fill="#2a2d31" stroke="#1a1c1f"/>
<circle cx="${on ? 3.5 : -3.5}" cy="0" r="5.4" fill="${on ? '#30d158' : '#8a9098'}"/></g>
<text x="0" y="14" text-anchor="middle" font-size="7.5" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${on ? 'ON' : 'OFF'}</text>`;
  },
  ldr(p) {
    const light = p.props.light ?? 70;
    return `<line x1="-10" y1="0" x2="-6" y2="0" ${LEG}/><line x1="6" y1="0" x2="10" y2="0" ${LEG}/>
<g data-ctl="ldr"><circle r="9" fill="#dcdf5f" fill-opacity="${0.35 + 0.55 * (light / 100)}" stroke="#8f9430"/>
<path d="M-5 -3q5 5 10 0M-5 3q5-5 10 0" stroke="#4a4d1a" stroke-width="1" fill="none"/></g>
<text x="0" y="-14" text-anchor="middle" font-size="8" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${light < 30 ? '\u{1F319}' : '☀️'} ${Math.round(light)}%</text>`;
  },
  pir(p) {
    const on = sim.running && p.triggered;
    let s = ['VCC', 'OUT', 'GND'].map((l, i) => `<line x1="${-10 + i * 10}" y1="2" x2="${-10 + i * 10}" y2="26" ${LEG}/>`).join('');
    if (on) s += `<circle cx="0" cy="-6" r="24" fill="url(#glow-white)" opacity=".4"/>`;
    s += `<g data-ctl="pir"><path d="M-24 2A24 24 0 0 1 24 2Z" fill="${on ? '#eafff0' : '#e9ecef'}" stroke="#b9bfc6"/>
<path d="M-15 2A15 15 0 0 1 15 2Z" fill="none" stroke="#b9bfc6" stroke-width="1"/>
<rect x="-24" y="0" width="48" height="4" rx="1.5" fill="#c9ced4"/></g>
<text x="0" y="-8" text-anchor="middle" font-size="8" font-family="Instrument Sans,sans-serif" fill="${on ? '#0a8a3f' : 'var(--canvas-ink)'}">${on ? 'motion!' : 'PIR'}</text>`;
    return s;
  },
  relay(p) {
    const on = sim.running && sim.relayOn[p.id];
    let s = ['IN', 'GND', 'COM', 'NO', 'NC'].map((l, i) => `<line x1="${-20 + i * 10}" y1="2" x2="${-20 + i * 10}" y2="26" ${LEG}/>`).join('');
    s += `<rect x="-26" y="-22" width="52" height="24" rx="3" fill="#2b6bd6" stroke="#1d4f9e"/>
<rect x="-14" y="-18" width="16" height="16" rx="1.5" fill="#1d1f22"/>
<circle cx="18" cy="-14" r="3" fill="${on ? '#30d158' : '#3a3d42'}"/>
<text x="0" y="-2" text-anchor="middle" font-size="6" fill="#e6f0ff" font-family="Instrument Sans,sans-serif">RELAY</text>`;
    return s;
  },
  transistor(p) {
    const on = sim.running && sim.transOn[p.id];
    return `<line x1="-10" y1="0" x2="-10" y2="20" ${LEG}/><line x1="0" y1="0" x2="0" y2="20" ${LEG}/><line x1="10" y1="0" x2="10" y2="20" ${LEG}/>
<path d="M-14 0A14 14 0 0 1 14 0Z" fill="#2a2d31" stroke="${on ? '#ffd166' : '#1a1c1f'}"/>
${['E', 'B', 'C'].map((l, i) => `<text x="${-10 + i * 10}" y="-3" text-anchor="middle" font-size="5.5" fill="#9aa1aa" font-family="Instrument Sans,sans-serif">${l}</text>`).join('')}`;
  },
  motor(p) {
    const spd = sim.running ? sim.motorSpeed[p.id] || 0 : 0;
    let s = `<line x1="-8" y1="0" x2="-8" y2="22" ${LEG}/><line x1="8" y1="0" x2="8" y2="22" ${LEG}/>
<circle r="20" fill="#4a4e54" stroke="#2f3236" stroke-width="2"/><circle r="8" fill="#c9ced4"/><rect x="-1.5" y="-27" width="3" height="8" fill="#9aa1aa"/>`;
    if (spd > 0.03) s += `<circle r="12" fill="none" stroke="#ffd166" stroke-width="1.6" stroke-dasharray="4 3" opacity="${0.4 + 0.6 * spd}"/>`;
    s += `<text x="0" y="34" text-anchor="middle" font-size="8" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${Math.round(spd * 100)}%</text>`;
    return s;
  },
  servo(p) {
    const a = sim.servoA[p.id] ?? 90;
    const rad = ((a - 90) * Math.PI) / 180;
    const hx = (Math.sin(rad) * 16).toFixed(2);
    const hy = (-8 - Math.cos(rad) * 16).toFixed(2);
    let s = ['GND', 'VCC', 'S'].map((l, i) => `<line x1="${-10 + i * 10}" y1="30" x2="${-10 + i * 10}" y2="34" ${LEG}/>`).join('');
    s += `<rect x="-22" y="-20" width="44" height="48" rx="3" fill="#2456c9" stroke="#183e98"/>
<circle cx="0" cy="-8" r="7" fill="#e3e6ea"/>
<line x1="0" y1="-8" x2="${hx}" y2="${hy}" stroke="#e3e6ea" stroke-width="4" stroke-linecap="round"/>
<text x="0" y="16" text-anchor="middle" font-size="7.5" fill="#dfe8ff" font-family="Instrument Sans,sans-serif">${Math.round(a)}°</text>`;
    return s;
  },
  joystick(p) {
    const kx = (((p.props.x ?? 0.5) - 0.5) * 24).toFixed(1);
    const ky = (-2 + ((p.props.y ?? 0.5) - 0.5) * 24).toFixed(1);
    const pressed = sim.running && p.pressed;
    return `${[-20, -10, 0, 10, 20].map((x) => `<line x1="${x}" y1="24" x2="${x}" y2="34" ${LEG}/>`).join('')}
<rect x="-28" y="-28" width="56" height="52" rx="5" fill="#1d1f22" stroke="#3a3d42"/>
<circle cx="0" cy="-2" r="19" fill="#2a2d31" stroke="#4a4e54"/>
<g data-ctl="joystick"><circle cx="${kx}" cy="${ky}" r="11" fill="${pressed ? '#55595f' : '#3a3d42'}" stroke="#6b7078" stroke-width="2"/><circle cx="${kx}" cy="${ky}" r="5" fill="#6b7078"/></g>`;
  },
  dht(p) {
    const t = Math.round(p.props.temp ?? 24);
    const h = Math.round(p.props.hum ?? 50);
    return `${[-10, 0, 10].map((x) => `<line x1="${x}" y1="12" x2="${x}" y2="26" ${LEG}/>`).join('')}
<g data-ctl="dht"><rect x="-17" y="-28" width="34" height="40" rx="3" fill="#3aa0d8" stroke="#22709e"/>
${[-21, -14, -7, 0].map((y) => `<rect x="-11" y="${y}" width="22" height="3" rx="1.5" fill="#22709e"/>`).join('')}</g>
<text x="0" y="41" text-anchor="middle" font-size="8.5" font-family="Instrument Sans,sans-serif" style="fill:var(--canvas-ink)">${t}°C · ${h}%</text>`;
  },
  neopixel(p) {
    const colors = sim.running ? sim.neoColors[p.id] || [] : [];
    const hex = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
    return `${[-10, 0, 10].map((x) => `<line x1="${x}" y1="12" x2="${x}" y2="22" ${LEG}/>`).join('')}
<rect x="-58" y="-12" width="116" height="24" rx="4" fill="#111" stroke="#333"/>
${Array.from({ length: 8 }, (_, i) => {
  const c = Number(colors[i]) || 0;
  const x = -53 + i * 14;
  return `<rect x="${x}" y="-5" width="10" height="10" rx="2" fill="${c ? hex(c) : '#2b2b2b'}" stroke="#555"/>${c ? `<circle cx="${x + 5}" cy="0" r="9" fill="${hex(c)}" opacity=".35"/>` : ''}`;
}).join('')}`;
  },
  sevenseg(p) {
    const on = sim.running ? sim.segOn[p.id] || {} : {};
    const R = '#ff3b30';
    const OFF = '#3a1210';
    const seg = (id, x, y, horiz) => `<rect x="${x}" y="${y}" width="${horiz ? 16 : 4}" height="${horiz ? 4 : 16}" rx="2" fill="${on[id] ? R : OFF}"/>`;
    let s = `<line x1="-31.5" y1="40" x2="-31.5" y2="44" ${LEG}/><line x1="-22.5" y1="40" x2="-22.5" y2="44" ${LEG}/><line x1="-13.5" y1="40" x2="-13.5" y2="44" ${LEG}/><line x1="-4.5" y1="40" x2="-4.5" y2="44" ${LEG}/>
<line x1="4.5" y1="40" x2="4.5" y2="44" ${LEG}/><line x1="13.5" y1="40" x2="13.5" y2="44" ${LEG}/><line x1="22.5" y1="40" x2="22.5" y2="44" ${LEG}/><line x1="31.5" y1="40" x2="31.5" y2="44" ${LEG}/>
<line x1="0" y1="-40" x2="0" y2="-44" ${LEG}/>
<rect x="-24" y="-38" width="48" height="76" rx="4" fill="#1d1f22" stroke="#0f1012"/>
${seg('a', -8, -34, true)}${seg('g', -8, -2, true)}${seg('d', -8, 30, true)}
${seg('f', -10, -32, false)}${seg('b', 8, -32, false)}${seg('e', -10, 0, false)}${seg('c', 8, 0, false)}
<circle cx="16" cy="30" r="2.4" fill="${on.dp ? R : OFF}"/>`;
    return s;
  },
};

export function curve(a, b) {
  const my = (a[1] + b[1]) / 2;
  return `M${a[0]} ${a[1]}C${a[0]} ${my} ${b[0]} ${my} ${b[0]} ${b[1]}`;
}
