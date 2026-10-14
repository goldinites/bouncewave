# PING PONG (Retrowave / Synthwave Edition)

A retro-futuristic, synthwave-themed Canvas Pong game decomposed and refactored into a modern TypeScript web application with Vite, full strict typing, modular architecture, and automated tests.

---

## 🚀 Features

- **Procedural Synthwave Music Engine**: Dynamic Web Audio API synthesizer generating multitrack retro synthwave music with adaptive intensity responding in real-time to ball speeds, rallies, and game points.
- **Dynamic 2D Visualizer**:
  - Laser light show with audio spectrum analyzer and oscilloscope.
  - Memphis 80s/90s geometric aesthetic with CRT/VHS scanlines, chromatic glitching, and OSD playback timer.
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
│   ├── audio/                   # Web Audio API engine
│   │   ├── AudioEngine.ts       # AudioContext lifecycle and coordination
│   │   ├── MusicEngine.ts       # Procedural synth sequencer & audio analyzer
│   │   └── SoundEffects.ts      # Synthesized sound effects (paddle, bounce, score, game over)
│   ├── constants/               # Named constants (eliminated all magic numbers)
│   │   ├── audio.constants.ts   # Musical scales, chords, basslines, SFX frequencies
│   │   ├── difficulty.constants.ts # Speeds, error margins, and acceleration per difficulty
│   │   ├── game.constants.ts    # Board dimensions, speeds, colors, scoring rules
│   │   └── visual.constants.ts  # Particle lifetimes, lasers, screen shake/flash
│   ├── core/                    # Core game engine logic
│   │   ├── AiController.ts      # CPU opponent logic
│   │   ├── Game.ts              # Game coordinator & main requestAnimationFrame loop
│   │   ├── InputHandler.ts      # Keyboard, mouse, touch, and orientation events
│   │   └── Physics.ts           # Collision detection, ball sub-stepping, deflections
│   ├── entities/                # Game domain entities
│   │   ├── Ball.ts              # Ball state, speed, trail, and dynamic radius
│   │   ├── Paddle.ts            # Paddle movement, glow, smoothing, and spark particles
│   │   └── ParticleSystem.ts    # Particle bursts and expanding shockwave rings
│   ├── i18n/                    # Localization subsystem
│   │   ├── I18nManager.ts       # Language switcher and translation provider
│   │   └── translations.ts      # EN and RU dictionaries
│   ├── render/                  # Canvas 2D rendering subsystem
│   │   ├── BackgroundRenderer.ts# Laser show visualizer & Memphis VHS graphics
│   │   ├── CourtRenderer.ts     # Neon boundaries and dashed center line
│   │   ├── EntityRenderer.ts    # Glowing paddles, plasma ball, and particles
│   │   ├── HudRenderer.ts       # Neon scoreboard and "GET READY" indicator
│   │   └── Renderer.ts          # Main rendering coordinator, DPR scaling, screen shake/flash
│   ├── storage/                 # Data persistence
│   │   └── SettingsStorage.ts   # LocalStorage service with schema validation & defaults
│   ├── styles/                  # Styling
│   │   └── main.css             # CRT overlay, glitch title, neon buttons & responsive layout
│   └── types/                   # TypeScript interfaces & types
│       ├── audio.types.ts
│       ├── difficulty.types.ts
│       ├── game.types.ts
│       └── i18n.types.ts
└── tests/                       # Unit tests (Vitest)
    ├── ai.test.ts
    ├── ball.test.ts
    ├── i18n.test.ts
    ├── math.test.ts
    ├── paddle.test.ts
    ├── physics.test.ts
    └── storage.test.ts
```

---

## 💻 Available Scripts

- `npm run dev` — Run local development server with Hot Module Reloading (HMR) at http://localhost:3000.
- `npm run build` — Typecheck (`tsc`) and compile optimized production bundle to `dist/`.
- `npm run preview` — Locally preview the production build.
- `npm test` — Run all unit test suites via Vitest.
- `npm run lint` — Lint codebase with ESLint.
- `npm run lint:fix` — Automatically fix ESLint lint errors.
- `npm run format` — Format all files with Prettier.
- `npm run format:check` — Check code formatting with Prettier.
