# Project organization

## Folder map

```text
res://
├── assets/                 # Imported audio, models, materials, textures
│   ├── audio/
│   ├── materials/
│   ├── models/
│   └── textures/
├── docs/                   # Design and technical notes
├── src/
│   ├── actors/
│   │   ├── enemies/        # Enemy scenes and behaviors
│   │   └── player/         # Player scene and behavior
│   ├── combat/             # Projectiles, damage, status effects
│   ├── main/               # Run orchestration and top-level scene
│   ├── resources/          # Custom Resource classes and data assets
│   ├── systems/            # Run-wide systems: upgrades, loot, saving
│   ├── ui/                 # Reusable menus and HUD components
│   └── world/              # Arenas, rooms, props, generation
└── tests/                  # Automated tests when a test add-on is introduced
```

Empty directories contain `.gdkeep` files so Git preserves the structure.

## Architectural rules

1. Keep a scene beside its main script. A player scene and player script live together.
2. Prefer signals upward and direct calls downward. An enemy emits `died`; the run controller decides how scoring works.
3. Put tunable content in custom Resources once values need many variants. Enemy statistics and upgrades are good candidates.
4. Use autoloads sparingly. Saving, settings, and scene transitions can justify one; ordinary gameplay usually does not.
5. Keep actors independently runnable when practical. It makes iteration and testing faster.
6. Do not make one global `GameManager` own everything. Split systems when their responsibilities and lifetimes differ.

## Suggested growth path

### Milestone 1: Core loop

Keep the current movement, aiming, damage, spawning, score, and restart loop working.

### Milestone 2: Data-driven content

Create `EnemyData` and `UpgradeData` custom Resources. Add an upgrade selection screen and weighted loot table.

### Milestone 3: Run structure

Add waves or procedural rooms, an elite encounter, a boss, and a run-complete state.

### Milestone 4: Persistence

Add settings and meta-progression saves. Save plain data, not live scene nodes.

## Naming conventions

- Files and folders: `snake_case`
- GDScript classes: `PascalCase`
- Nodes: `PascalCase`
- Signals, variables, and functions: `snake_case`
- Private implementation methods: prefix with `_`

