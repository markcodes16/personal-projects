# Personal Projects

Projects in Python, TypeScript, and GDScript, focused on game tooling, progress tracking, and gameplay systems.

## Portfolio quick start

For software-engineering reviews, start with **[Magnet Dash](magnet-dash/)** (playable browser game, TypeScript engine, persistence, automated tests), then **[Deadlock Companion](deadlock-companion/)** (Python desktop architecture, SQLite and data adapters). **[Deadlock Training Journal](deadlock-training-journal/)** demonstrates a full-stack React app with a hosted-auth/D1 dependency. The **[Godot starter](godot-roguelite-starter/)** is intentionally a gameplay prototype rather than a shipped game.

Each project has its own README. Development/hosting caveats are documented per project; no trained machine-learning model is claimed in this repository.

## Projects

| Project | Overview | Technologies |
| --- | --- | --- |
| [Magnet Dash](magnet-dash/) | One-tap magnetic runner prototype with daily circuits, local best runs, and an ad experiment sandbox | TypeScript, React, Canvas, Vite |
| [Deadlock Companion](deadlock-companion/) | Windows desktop tool for reviewing match data, recording sessions with OBS, taking notes, and tracking practice | Python, Tkinter, SQLite, OBS WebSocket |
| [Deadlock Training Journal](deadlock-training-journal/) | Web app with 24 lessons, hero practice tracks, session logging, and progress stored per user | TypeScript, React, Tailwind CSS, Drizzle ORM, Cloudflare D1 |
| [Godot Roguelite Starter](godot-roguelite-starter/) | Top-down 3D prototype with player movement, aiming, projectiles, chasing enemies, and escalating difficulty | Godot 4, GDScript |

## Exploring the code

- **Desktop application design:** The Companion separates its interface, data adapters, storage, and profile calculations. Start with [core.py](deadlock-companion/core.py) and [profile_stats.py](deadlock-companion/profile_stats.py).
- **Web application data flow:** The Training Journal includes an API route, authentication integration, and a database schema. Start with [the training route](deadlock-training-journal/app/api/training/route.ts) and [the schema](deadlock-training-journal/db/schema.ts).
- **Gameplay systems:** The Roguelite Starter separates player, enemy, projectile, and game-loop behavior. Start with [main.gd](godot-roguelite-starter/src/main/main.gd) and [player.gd](godot-roguelite-starter/src/actors/player/player.gd).

Each project has its own setup instructions. The Companion requires Windows and external OBS configuration. The Training Journal requires its platform services for hosted authentication and persistence. The Godot project is a starter prototype.
