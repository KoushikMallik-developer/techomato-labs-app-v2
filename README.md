# Techomato Labs

A browser-based Arduino circuit simulator and sharing site: drag parts onto a breadboard, wire them up, write real
Arduino sketches, and run the simulation — plus a dashboard, a public gallery, and account settings.

Serverless: the browser talks to Firebase (Auth + Firestore) through `src/lib/api.js`. Security lives in
`firestore.rules`, not in any server code.

## Stack

- **React** (plain JS) + **Vite**
- **Redux Toolkit** + **react-redux** for state
- **react-router-dom** (`BrowserRouter`; `vercel.json` rewrites every path to `index.html`)
- **three.js** for the 3D circuit view
- **Vitest** + **Testing Library** for tests

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build
npm run lint       # eslint
npm run test       # vitest
```

## Project structure

```
src/
  app/            # store, router, root App component
  lib/            # storage, ids, the Firebase data layer (api.js, firebase.js), starter templates
  styles/         # global/page/editor CSS (ported design system, light + dark themes)
  components/     # shared, feature-agnostic UI (Nav, Modal, Toast, cards, ...)
  features/
    auth/         # session slice, guards, login/signup/forgot pages
    theme/        # light/dark/system theme slice
    ui/           # modal + toast host state
    landing/      # marketing landing page
    projects/     # your projects dashboard + folder/tag/publish/import modals
    gallery/      # Community Circuits, circuit page, comments, saved circuits, public profiles (/u/:handle), reports
    discussions/  # Discussions: posts, comments, one level of replies, likes
    notifications/# likes/comments on your circuits and replies to your discussions
    lessons/      # guided lessons (static) and the step panel shown in the editor
    settings/     # profile/appearance/password/account settings
    editor/       # the circuit editor (engine/ holds the 2D/3D render + solver + Arduino interpreter)
```

Each `features/*` folder owns its Redux slice, pages, and components. `src/lib/api.js` is the single seam between
the UI and data storage (Firebase Auth + Firestore); components and slices never import Firebase directly.

The circuit editor deliberately keeps two kinds of state separate (see `features/editor/editorSlice.js`): the
persisted project document (parts/wires/code, selection, view mode) lives in Redux, while the simulator's per-frame
output (LED brightness, servo angle, live sensor readings, buzzer state) lives in a plain module outside Redux
(`engine/engineStore.js`) so the render loop never dispatches at animation-frame rate.

### The circuit editor engine (`features/editor/engine/`)

| File | Responsibility |
| --- | --- |
| `constants.js` | Part types, pin maps, colors, resistor bands, palette/icons |
| `geometry.js` | Board math (grid snapping, breadboard rows, pin positions) |
| `svgParts.js` | Per-part SVG drawing functions |
| `board.js` | 2D render loop + pointer/drag/wire/pan/zoom interaction |
| `solver.js` | Modified nodal analysis circuit solver (Gaussian elimination, LED/diode companion model) |
| `interpreter.js` | Regex-based Arduino-sketch-to-async-JS transpiler + runtime (`pinMode`, `digitalWrite`, `tone`, `Serial`, ...) |
| `audio.js` | Web Audio buzzer playback, driven by the solver's live output |
| `render3d.js` | three.js 3D view (lazy-loaded, code-split out of the main bundle) |
| `engineStore.js` | The `sim` singleton — fast-changing simulation output kept outside Redux |

## Features

- **Editor:** 2D/3D board, 21 parts besides the breadboard and Arduino (including a DHT11 sensor, joystick and 8-LED NeoPixel strip), Arduino sketches
  with `Servo`, `LiquidCrystal_I2C`, `DHT` and `Adafruit_NeoPixel`, a serial monitor and a serial **plotter**, keyboard
  shortcuts (press `?`), import of exported `.json` circuits and Arduino `.ino` sketches.
- **Community Circuits:** search (typing filters what is loaded; Enter searches every circuit by the start of its name),
  tags, likes, comments, remix, **Save** for later (`/saved`), **Report** (reviewed in the admin panel), **Download image**
  (PNG), public author pages (`/u/<handle>`), built-in sample circuits by `@dev`.
- **Discussions** (`/discussions`): posts, comments, replies to comments, likes.
- **Notifications** (`/notifications`): likes and comments on your circuits, replies to your discussions.
- **Lessons** (`/lessons`): step-by-step projects that open in the editor with the steps beside it.

## Status

Fully working end-to-end against Firebase: app shell, auth, projects dashboard, gallery, and settings are
wired up, and the circuit editor has a complete 2D drag-and-wire board, MNA circuit solver, Arduino sketch runtime
(Run/Stop with live serial output and part visuals), buzzer audio, and a view-only 3D mode. Data lives in Firebase (see below).

## Firebase setup

1. Create a Firebase project; add a **Web app** and copy its config into `.env` (see `.env.example`).
2. **Authentication** -> enable Email/Password, and Google / GitHub if you want them (GitHub needs an OAuth app).
   Add your deploy domain to Authentication -> Settings -> Authorized domains.
3. **Authentication -> Templates -> customize action URL** to `https://<your-domain>/verify-email` for the
   verification email and `https://<your-domain>/reset-password` for the reset email (the pages read `oobCode`).
4. **Firestore** -> create a database. Then, from this folder: `npm i -g firebase-tools`, `firebase login`,
   `firebase use --add` (pick your project; this creates `.firebaserc`), and deploy the rules and indexes with
   `firebase deploy --only firestore`.
   **Wait until every index shows "Enabled"** (Firestore -> Indexes) — the gallery and search error until then.
   Run `firebase deploy --only firestore` again whenever `firestore.rules` or `firestore.indexes.json` change.
   **Never leave the database in test mode** — `firestore.rules` is the only thing protecting your data.
   Before deploying rule changes, run `npm run test:rules` (needs a recent JDK, 21 or newer, for the Firestore emulator).
5. **Admin**: create a normal account in Authentication, then add a document `admins/<that user's uid>` (any fields)
   in the Firestore console. Rules forbid clients from writing `admins`. Log in at `/admin`.
   The admin panel has four tabs: **Overview** (counts, plus charts of new users, circuits shared to Community and discussion
   posts per hour for a day or per day for 7 or 30 days; each bar counts at most 100, posts 50, shown as "100+"), **Review queue**,
   **Reports** (grouped by circuit or discussion; the newest 50 are loaded) and **Users**, which lists users (newest first, 20 at a time; search matches the *start* of a name, email
   or handle; each row shows circuit counts, and the Community count opens that user's published circuits); **Disable** blocks a user from writing anything (the
   rules check a `disabledUsers/<uid>` document) and signs them out at their next login, **Enable** undoes it. This is
   not Firebase's own "disable user" switch, which needs a server (Admin SDK).
6. Recommended: restrict the web API key to your domain (Google Cloud -> APIs & Services -> Credentials). Create a
   reCAPTCHA v3 key, register it under App Check, put it in `VITE_RECAPTCHA_SITE_KEY`, then enforce App Check for
   Firestore and Authentication. App Check is off while `VITE_RECAPTCHA_SITE_KEY` is unset or blank. Before you enforce:
   add `localhost` and your Vercel domains to the reCAPTCHA key, and for `npm run dev` copy the debug token the browser
   console prints into Firebase console -> App Check -> Apps -> Manage debug tokens (otherwise local requests are refused).
   On the Blaze plan also set a billing budget alert (Spark has a hard daily quota).
7. Hosting (Vercel): import the repo (framework preset **Vite**, build `npm run build`, output `dist`, Node 20+). Add the
   `VITE_FIREBASE_*` variables (and `VITE_RECAPTCHA_SITE_KEY`) under Settings -> Environment Variables for Production and
   Preview; without the Firebase ones the site stays blank and the browser console says which variable is missing. Add the Vercel domain to Firebase authorized domains. `vercel.json` sets the security headers. `/sandbox.html` must keep its own Content-Security-Policy
   (it runs other users' sketch code in a locked-down iframe). After a deploy, open the editor, press Run on a sample
   circuit and check the browser console for CSP errors; also check Google/GitHub sign-in.

Limits baked into the rules: 5 circuits, 3 folders, 500 follows and 200 saved circuits per user, one report per user per
circuit, a cooldown between new circuits (30 s), new discussions (60 s) and comments or discussion replies (10 s), project
lists capped at 100 (a circuit page shows its newest 50 comments, a discussion its first 100 comments and replies).
Notifications are written by the person who acts, and the rules only accept one that matches a real like, comment or
reply of theirs. There are no follow notifications (finding who owns a handle needs a server). Circuits shared before
the search existed only show up in name search after their owner saves them once. Known limits: the gallery loads 10 circuits at a time and search / "Following" / "Most liked" only
see what is loaded; deleting a circuit leaves its likes/comments orphaned (unreachable); if you delete a user's circuit
in the Firestore console, lower `limits/<uid>.projectCount` by hand; admin and user share one Firebase session.
