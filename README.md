# Personal Projects

Projects in Python, TypeScript, and GDScript, focused on game tooling, progress tracking, and gameplay systems.

## Projects

| Project | Overview | Technologies |
| --- | --- | --- |
| [Deadlock Companion](deadlock-companion/) | Windows desktop tool for reviewing match data, recording sessions with OBS, taking notes, and tracking practice | Python, Tkinter, SQLite, OBS WebSocket |
| [Deadlock Training Journal](deadlock-training-journal/) | Web app with 24 lessons, hero practice tracks, session logging, and progress stored per user | TypeScript, React, Tailwind CSS, Drizzle ORM, Cloudflare D1 |
| [Godot Roguelite Starter](godot-roguelite-starter/) | Top-down 3D prototype with player movement, aiming, projectiles, chasing enemies, and escalating difficulty | Godot 4, GDScript |

## Exploring the code

- **Desktop application design:** The Companion separates its interface, data adapters, storage, and profile calculations. Start with [core.py](deadlock-companion/core.py) and [profile_stats.py](deadlock-companion/profile_stats.py).
- **Web application data flow:** The Training Journal includes an API route, authentication integration, and a database schema. Start with [the training route](deadlock-training-journal/app/api/training/route.ts) and [the schema](deadlock-training-journal/db/schema.ts).
- **Gameplay systems:** The Roguelite Starter separates player, enemy, projectile, and game-loop behavior. Start with [main.gd](godot-roguelite-starter/src/main/main.gd) and [player.gd](godot-roguelite-starter/src/actors/player/player.gd).

Each project has its own setup instructions. The Companion requires Windows and external OBS configuration. The Training Journal requires its platform services for hosted authentication and persistence. The Godot project is a starter prototype.
