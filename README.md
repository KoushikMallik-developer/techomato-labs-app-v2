# Techomato Labs

A browser-based Arduino circuit simulator and sharing site: drag parts onto a breadboard, wire them up, write real
Arduino sketches, and run the simulation — plus a dashboard, a public gallery, and account settings.

Serverless: the browser talks to Firebase (Auth + Firestore) through `src/lib/api.js`. Security lives in
`firestore.rules`, not in any server code.

## Stack

- **React** (plain JS) + **Vite**
- **Redux Toolkit** + **react-redux** for state
- **react-router-dom** (`HashRouter`)
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
    gallery/      # public gallery + circuit detail page + comments
    settings/     # profile/appearance/password/account settings
    editor/       # the circuit editor (engine/ holds the 2D/3D render + solver + Arduino interpreter)
```

Each `features/*` folder owns its Redux slice, pages, and components. `src/lib/api.js` is the single seam between
the UI and data storage — it's backed by `localStorage` today; swapping it for real HTTP calls should not require
touching any component or slice.

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

## Status

Fully working end-to-end against the mock data layer: app shell, auth, projects dashboard, gallery, and settings are
wired up, and the circuit editor has a complete 2D drag-and-wire board, MNA circuit solver, Arduino sketch runtime
(Run/Stop with live serial output and part visuals), buzzer audio, and a view-only 3D mode. Data lives in Firebase (see below).

## Firebase setup

1. Create a Firebase project; add a **Web app** and copy its config into `.env` (see `.env.example`).
2. **Authentication** -> enable Email/Password, and Google / GitHub if you want them (GitHub needs an OAuth app).
   Add your deploy domain to Authentication -> Settings -> Authorized domains.
3. **Authentication -> Templates -> customize action URL** to `https://<your-domain>/verify-email` for the
   verification email and `https://<your-domain>/reset-password` for the reset email (the pages read `oobCode`).
4. **Firestore** -> create a database, then deploy the rules and index: `firebase deploy --only firestore`.
   **Never leave the database in test mode** — `firestore.rules` is the only thing protecting your data.
5. **Admin**: create a normal account in Authentication, then add a document `admins/<that user's uid>` (any fields)
   in the Firestore console. Rules forbid clients from writing `admins`. Log in at `/admin`.
6. Recommended: enable App Check and set a billing budget alert.

Known limits: the gallery loads all approved circuits and filters in the browser; deleting a circuit leaves its
likes/comments subcollections orphaned (unreachable); admin and user share one Firebase session.
