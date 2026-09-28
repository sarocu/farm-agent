# Farm

Monorepo for the **CSA farm application** — a platform to manage crops,
customers, events, aerial imagery, planting areas, seasons, subscriptions,
and harvest calendars for a Community Supported Agriculture farm.

## Structure

```
Farm/
├── apps/          # Deployable applications (added in later phases)
└── packages/
    ├── types/     # @farm/types — shared domain TypeScript types
    └── ui/        # @farm/ui   — shared React component library
```

This is a [npm workspaces](https://docs.npmjs.com/cli/commands/npm-workspaces)
monorepo. All packages are ESM (`"type": "module"`).

## Getting started

```sh
npm install
```

## Scripts

Run from the repository root:

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run build`     | Build every workspace package                |
| `npm run dev`       | Run the dev/watch script in every workspace  |
| `npm run typecheck` | Type-check every workspace package           |
| `npm run test`      | Run tests in every workspace package         |

To target a single workspace, use npm's `--workspace` flag, e.g.:

```sh
npm run typecheck --workspace @farm/types
npm run build --workspace @farm/ui
```

## Tooling

- **TypeScript** (`tsconfig.base.json`) shared by every package, with
  `target: ES2023`, `module/moduleResolution: NodeNext`, `strict`,
  `noUncheckedIndexedAccess`, `declaration`, and `skipLibCheck`.
- **Vite** powers the `@farm/ui` library build.
