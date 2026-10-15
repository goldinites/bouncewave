# PING PONG (Retrowave / Synthwave Edition)

A retro-futuristic, synthwave-themed Canvas Pong game decomposed and refactored into a modern TypeScript web application with Vite, full strict typing, modular architecture, and automated tests.

---

## 🚀 Features

- **Procedural Synthwave Music Engine**: Dynamic Web Audio API synthesizer generating multitrack retro synthwave music with adaptive intensity responding in real-time to ball speeds, rallies, and game points.
- **Dynamic 2D Visualizer**:
  - Laser light show with audio spectrum analyzer and oscilloscope.
  - Memphis 80s/90s geometric aesthetic with CRT/VHS scan lines, chromatic glitching, and OSD playback timer.
- **Physics & Particle Engine**: Accurate sub-step deflection collisions, acceleration, particle bursts, shockwave rings, and screen shake.
- **AI Opponents**: 4 configurable difficulty levels (Easy, Normal, Hard, Insane) with realistic human-like error modeling.
- **Full Localization (i18n)**: English and Russian languages supported.
- **Persistent Storage**: Player settings (difficulty, sound FX, music, language) saved to `localStorage`.
- **Responsive & Mobile Support**: Full touch gestures, desktop keyboard, mouse, and auto-rotated mobile portrait/landscape handling.

---

## 🏗 Architecture & Project Structure

The project follows clean architecture principles with single-responsibility modular design:

```
├── .prettierrc                  # Prettier formatting rules
├── .prettierignore              # Prettier ignore patterns
├── eslint.config.js             # Flat ESLint configuration (TypeScript + Prettier)
├── index.html                   # Clean HTML entry point
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json                # Strict TypeScript configuration
├── vite.config.ts               # Bundler configuration with aliases & Vitest setup
├── src/
│   ├── index.ts                 # Application bootstrap entry point
│   ├── app/                     # Composition root and main requestAnimationFrame loop
│   ├── match/                   # Rules and simulation: no DOM, sound or canvas
│   │   ├── config.ts            # Court, paddle and ball sizes, winning score
│   │   ├── difficulty.ts        # Difficulty levels and their AI / ball settings
│   │   ├── MatchFlow.ts         # Phases, serves, scoring, finale timing
│   │   ├── Physics.ts           # Ball movement, collisions, bounce angles
│   │   └── …                    # Ball, Paddle, AiController, heat
│   ├── fx/                      # Presentation reacting to the match: shake, particles, drama, climax
│   ├── render/                  # Canvas 2D rendering; backgrounds/ holds one class per background
│   ├── audio/                   # Web Audio: music/ (sequencer, tracks) and sfx/
│   ├── input/                   # Keyboard, mouse, touch and orientation
│   ├── ui/                      # DOM menus
│   ├── i18n/                    # EN and RU dictionaries
│   ├── settings/                # User settings and their LocalStorage persistence
│   ├── shared/                  # Domain-free helpers: math, color palette
│   ├── debug/                   # FPS overlay (F3 or ?fps)
│   └── styles/                  # CRT overlay, glitch title, neon buttons & responsive layout
└── tests/                       # Unit tests (Vitest)
```

**Where constants live.** A tuning value sits at the top of the module that uses it, next to
the code it tunes (exported only when a test needs it). Values read by several modules live in
the owning folder's `config.ts`, grouped into objects such as `PADDLE.WIDTH` or `COURT.HEIGHT`.
Only domain-free values (the palette, math) go to `shared/`.

---

## 💻 Available Scripts

- `npm run dev` — Run a local development server with Hot Module Reloading (HMR) at http://localhost:3000.
- `npm run build` — Typecheck (`tsc`) and compile an optimized production bundle to `dist/`.
- `npm run preview` — Locally preview the production build.
- `npm test` — Run all unit test suites via Vitest.
- `npm run lint` — Lint codebase with ESLint.
- `npm run lint:fix` — Automatically fix ESLint lint errors.
- `npm run format` — Format all files with Prettier.
- `npm run format:check` — Check code formatting with Prettier.
