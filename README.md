# INSPECT-QC · Manufacturing AI

A 5-page steelworks monitoring dashboard: production overview, reference
operating values, machine incident/emergency handling with downtime costing,
product defect root-cause tracing, and a model-performance validation report.
React + TypeScript + Vite + Tailwind + Recharts on the frontend, a real
Express + SQLite API on the backend.

## Run it

Two processes: the API and the dashboard.

```bash
# Terminal 1 — backend (installs its own dependencies, separate package.json)
npm run server:install
npm run server:dev        # http://localhost:4000

# Terminal 2 — frontend
npm install
npm run dev                # http://localhost:5173 (proxies /api to :4000)
```

Or run both at once from the root: `npm run server:install && npm install && npm run dev:all`
(uses `concurrently`; Ctrl+C stops both).

`npm run build` type-checks and produces a production frontend bundle in
`dist/`. The server has its own `npm run build` (in `server/`) that compiles
to `server/dist/`, run with `npm start`.

## Environment

Both apps read a `.env` file (committed as `.env.example` — copy and edit,
or use the defaults as-is for local dev):

- `server/.env` — `PORT` (default 4000), `DB_PATH` (default
  `./data.sqlite`, relative to `server/`), `CORS_ORIGIN` (left unset in dev —
  any `http://localhost:<port>` / `http://127.0.0.1:<port>` origin is
  allowed automatically, since Vite picks whatever port is free; set a
  comma-separated list to pin allowed origins in production)
- `.env` (root) — `VITE_API_BASE_URL`, left empty in dev since the Vite
  proxy handles `/api` locally; set it only when the frontend needs to
  reach a backend that isn't proxied (e.g. separate deployments)

## 1. Project structure

```
server/                     Express + SQLite API (its own package.json)
  src/
    index.ts                 Route definitions, CORS, .env loading
    db.ts                     SQLite schema + seed-on-first-run
    repo.ts                   All SQL, mapped to/from the API's JSON shapes
    seedData.ts               The synthetic dataset the DB is seeded from
    types.ts                  Mirrors the frontend's src/types
  data.sqlite                 The actual database file (gitignored)

src/
  types/index.ts             Shared TypeScript types, incl. Bootstrap (the
                              shape returned by GET /api/bootstrap)
  lib/
    api.ts                    Thin fetch wrapper around every endpoint
    calculations.ts           Every cost/severity/explainability formula
    labels.ts                 Presentation-only label maps (not data)
  context/
    AppDataContext.tsx         Fetches /api/bootstrap on mount, exposes it
                              plus derived totals, and turns every mutation
                              (edit a standard value, acknowledge/stop a
                              machine, ...) into an API call
  components/                 Layout, UI primitives, one file per chart
  pages/
    FactoryOverview.tsx        Page 1
    StandardValues.tsx         Page 2
    MachineIncidents.tsx       Page 3
    ProductDefects.tsx         Page 4
    ModelPerformance.tsx       Page 5 — detection accuracy, localization,
                              robustness, FAR/FRR, root-cause correlation,
                              explainability, technical implementation
```

## 2. How the 5 pages work

**Factory Overview (`/`)** — KPI cards, charts, and a machine-health heatmap,
all derived from data fetched once at app start. Clicking a machine row,
chart bar, or heatmap cell routes to `/machine-incidents?machine=<id>`.

**Standard Values (`/standard-values`)** — Pick a machine, see its reference
window per parameter. "Edit Values" → "Save Changes" sends a `PATCH
/api/standard-values/:machineId/:parameter`, which updates the SQLite row;
every other page reads the new value on its next fetch.

**Machine Incidents (`/machine-incidents?machine=<id>`)** — Live-reading vs.
standard-value comparison, an Emergency card with Acknowledge / Stop Machine
/ Notify Maintenance buttons wired to `POST /api/incidents/:id/...`
endpoints (Stop Machine also flips the machine's status to `down` in the
same request), and a live downtime-cost calculation.

**Product Defects (`/product-defects?machine=<id>`)** — Defect table with
computed rework/scrap/total loss and severity. Selecting a row shows the
associated machine-parameter snapshot, a confidence score, and a
"Probable Root-Cause Candidate" panel — worded as a possible contributing
factor, never proven causation.

**Model Performance (`/model-performance`)** — A validation-report page
covering detection/classification accuracy, localization, robustness,
false-accept/false-reject tradeoffs (with a live threshold slider), root-cause
correlation, explainability/confidence, and the technical implementation.
It's explicit that there's no trained model behind this build — the metrics
are illustrative, shaped like a real evaluation report; the root-cause hit
rate and defect-location mix are computed live from the actual data.

## 3. Where the data lives

**Source of truth: `server/data.sqlite`**, seeded on first run from
`server/src/seedData.ts` (only when the tables are empty — safe to restart).
Delete `server/data.sqlite*` to force a clean re-seed.

The frontend holds no data of its own. `AppDataContext` fetches everything
once via `GET /api/bootstrap` and calls the mutation endpoints in
`src/lib/api.ts` for every edit. `src/lib/labels.ts` is the one exception —
pure presentation strings (status labels), never fetched.

## 4. Where the calculations happen

All in `src/lib/calculations.ts`, as small pure functions with no UI or
network dependency: `downtimeCost`, `reworkCost`/`scrapCost`/`productLoss`,
`getParameterSeverity` (normal/warning/critical classification),
`productSeverity` (business-impact severity for a defect), `parameterContribution`
(deviation-based explainability heuristic), `rootCauseHitRate` (computed
over the real defect + standard-value records), and `accuracyFromConfusion`.
`AppDataContext` composes these into the KPI totals and per-machine loss
breakdown the UI renders.

## 5. Replacing the seed data with a real CSV/API/sensor feed

`server/src/seedData.ts` exports plain arrays matching the types in
`server/src/types.ts`. To go live:

1. Replace the seed step in `server/src/db.ts` with a real ingestion job
   (CSV import, IoT/MQTT subscriber, ERP sync) writing into the same SQLite
   tables — or point `repo.ts` at a different database entirely; it's the
   only file that talks SQL.
2. Keep the JSON shapes `repo.ts` returns identical (or adapt with a small
   mapper) and the frontend keeps working unchanged — it only depends on
   `Bootstrap`'s shape, not on the data's origin.
3. For live sensor readings specifically, add a WebSocket/poll layer in
   `server/src/index.ts` that updates the `readings` table as frames arrive;
   the frontend already re-fetches `/api/bootstrap` on load and would pick
   up a periodic-refresh or push layer with the same shape.

## 6. Connecting a real AI/ML defect detection model

`productSeverity()` and `parameterContribution()` on the frontend, and the
`class_metrics`/`confusion_matrix`/`robustness_conditions`/`far_frr_curve`
rows seeded in SQLite, are deliberately explainable stand-ins, not a trained
model. To add a real one:

- Have the model write its predictions (defect type, confidence, the
  parameter-contribution/explainability output) into `product_defects` via
  `repo.ts`, in the same shape already there — the UI already renders
  `confidence` and a contribution chart per product.
- Replace the seeded rows in `class_metrics` / `kv_store` (confusion matrix,
  robustness conditions, FAR/FRR curve) with the model's real evaluation
  output on each retrain; `GET /api/model-metrics` doesn't care where the
  numbers came from.
- The "Probable Root-Cause Candidate" and "Model Performance" pages already
  separate measured/computed values from anything model-provided — keep
  that distinction when wiring in real inference so the UI doesn't overstate
  what's actually been validated.

## 7. API reference

| Method & path | Purpose |
|---|---|
| `GET /api/bootstrap` | Everything the frontend needs in one call |
| `GET /api/machines`, `/readings`, `/standard-values`, `/incidents`, `/product-defects`, `/production`, `/model-metrics`, `/heatmap`, `/config` | Individual resources |
| `PATCH /api/standard-values/:machineId/:parameter` | Edit a reference range |
| `POST /api/incidents/:id/acknowledge` | Acknowledge an emergency |
| `POST /api/incidents/:id/stop` | Stop the machine (also flips machine status to `down`) |
| `POST /api/incidents/:id/notify-maintenance` | Flag maintenance notified |
| `PATCH /api/incidents/:id/cost-per-minute` | Edit an incident's downtime cost rate |
