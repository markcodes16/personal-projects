# Deadlock Training Journal

A web application for organizing Deadlock practice through 24 lessons and Mina, Warden, Abrams, and Pocket training tracks.

## Features

- Lesson progression and practice-session logging.
- Hero-specific practice tracks.
- Progress and sessions stored per authenticated user.
- A bundled [training guide](public/Deadlock_Eternus_Training_Guide.md).

Lesson gates are self-assessed practice targets. The application does not fetch Steam or tracker data or estimate player rank.

## Technologies and structure

- TypeScript and React for the interface.
- Tailwind CSS for styling.
- Drizzle ORM and Cloudflare D1 for persistence.
- Platform authentication for hosted user identity.

Start with [app/page.tsx](app/page.tsx), [app/api/training/route.ts](app/api/training/route.ts), and [db/schema.ts](db/schema.ts).

## Development and deployment

The package specifies Node.js 22.13 or newer and pnpm 11.19.0. The repository includes lifecycle scripts for dependency installation, development, and builds. The install scripts require Bash.

The hosted application depends on its platform authentication and D1 services. The included `.openai/hosting.json` is a template with the `DB` binding; the original deployment identifier is omitted. Configure a new deployment and its services before publishing your own instance.

Database migrations are generated from `db/schema.ts`. See `package.json`, `vite.config.ts`, and the `scripts/` directory for the supported workflow.
