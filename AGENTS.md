# AGENTS.md — WebAppGPX

## Quick start
- `npm run dev` — Vite dev server
- `npm run build` — typechecks (`tsc -b`) then Vite build
- `npm run lint` — ESLint flat config
- `npm run preview` — `build && wrangler dev` (NOT `vite preview`)
- `npm run deploy` — `build && wrangler deploy`

## Project structure
- `src/App.tsx` — root component: sidebar (WaypointList) + map (MapView) + modals
- `src/hooks/useRoute.ts` — **single source of truth** for waypoints (useState, no Zustand)
- `src/types/route.types.ts` — Waypoint, Route, Group types
- `src/store/routeStore.ts` — `useGroups()` hook + `useGroupMetrics()` + core algorithms. Groups are the single source of truth for planning.
- `src/services/routingService.ts` — OSRM calls (public API, no key)
- `src/lib/supabase.ts` — Supabase client (direct frontend, no backend)

## Architectural constraints
- **No external state library** — project uses `useState` + custom hooks. Adding Zustand requires `npm install zustand`
- **Groups system** — `useGroups()` hook in `src/store/routeStore.ts` manages groups as the planning source of truth. Groups are inline in the waypoint list (not a separate modal). `useGroupMetrics()` provides computed distance/duration per group.
- **`PlanningModal` reads from groups** — no longer uses localStorage for rows. Planning is now a **projection** of the groups state.
- **Group creation** — Shift+drag a waypoint onto another in the sidebar to create a group. Groups can also be created/extended via buttons in the group rows.
- **Key algorithms** in `routeStore.ts`: `createGroup`, `rebaseGroupIndices` (re-index after reorder), `mergeOverlappingGroups`, `computeGroupMetrics`, `computePlanningRows`. All exported and testable.

## TypeScript quirks (`tsconfig.app.json`)
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `erasableSyntaxOnly: true` — no `enum`, no `namespace`. Use `as const` or union types.
- `noUnusedLocals: true`, `noUnusedParameters: true` — will break build on unused code
- `target: "es2023"`, `module: "esnext"`, `moduleResolution: "bundler"`
- TypeScript ~6.0 (not 5.x)

## Key dependencies
- **React 19**, **Vite 8**, **@cloudflare/vite-plugin**
- **@dnd-kit/core + @dnd-kit/sortable** — drag-and-drop for waypoints
- **react-leaflet + leaflet** — map component
- **@supabase/supabase-js** — direct frontend calls
- **exceljs** — Excel export in PlanningModal
- **Tailwind CSS v3** (PostCSS)

## Deployment (Cloudflare Pages)
- Both `wrangler.toml` and `wrangler.jsonc` exist — **JSONC wins** (overrides TOML)
- `not_found_handling: single-page-application` — SPA fallback for client-side routing
- `compatibility_flags: ["nodejs_compat"]`
- Static site, no Pages Functions

## Conventions
- **French UI** — all labels, comments, error messages in French
- `generateId()` — `Math.random().toString(36).substring(2, 9)` (not uuid)
- Waypoint markers use numbered colored circles via `createNumberedIcon`

## Testing
- **No test framework** — no test script in package.json, no test runner installed
