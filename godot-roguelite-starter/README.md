# Godot Roguelite Starter

A top-down 3D gameplay prototype built with Godot 4 and GDScript. It uses built-in meshes and requires no imported art.

## Gameplay

- Eight-direction movement and mouse aiming.
- Projectile firing with a configurable cooldown.
- Chasing enemies and contact damage.
- Increasing spawn rate and enemy health.
- Health, score, and elapsed-time display.
- Defeat screen and restart.
- Camera follow and a simple lit arena.

## Run

Import `project.godot` through Godot 4's Project Manager, open the project, and press **F5**.

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse |
| Shoot | Left mouse button or Space |
| Restart after defeat | R |

## Code structure

- [Player](src/actors/player/player.gd): movement, aiming, and firing.
- [Enemy](src/actors/enemies/chaser_enemy.gd): chasing and contact damage.
- [Projectile](src/combat/projectile.gd): projectile behavior.
- [Game loop](src/main/main.gd): spawning and difficulty.
- [Main scene](src/main/main.tscn): arena and interface layout.
- [Architecture notes](docs/ORGANIZATION.md): project organization.

This is a starter prototype. Additional enemy types, upgrades, encounters, and a complete run structure remain future work.
