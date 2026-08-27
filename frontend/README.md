# OpenCube Intel — frontend

The operator interface for the OpenCube vertical-intelligence platform.

It is a read-only lens over the backend in `../opencube-intel`. It renders runs,
the businesses investigated in them, and the opportunities the pipeline
reconciled — with the evidence behind each decision. It never classifies,
never decides, and never writes: every analytical value on screen was produced
by the pipeline and persisted before this app asked for it.

## Running it

```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

`/api/*` is proxied to `http://127.0.0.1:8000` by default. Point it elsewhere
with `OPENCUBE_API_URL` in `.env.local` (or the environment). Everything goes
through one origin, so the browser never needs CORS and the backend's private
Cloud Run posture is untouched.

### Backing it with data

Against a real backend, run the API locally with Google credentials available:

```bash
cd ../opencube-intel && uv run uvicorn app.fast_api_app:app --port 8000
```

Without cloud credentials, the fixture server serves the same routers over an
in-memory store:

```bash
cd ../opencube-intel && uv run python scripts/dev_fixture_api.py
```

Its documents are fixtures, but every `OpportunityMatch` in it is produced by
the real `opportunity_matcher.build_match`, so the UI is exercised against the
real reconciliation matrix.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with the `/api` proxy |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

## Layout

```
src/
  lib/            api client, transport types, status vocabulary, formatting
  components/     app shell, tables, and the ui/ primitives they share
  pages/          one file per screen
```

`src/lib/` is re-included in `.gitignore` on purpose — see the comment there.

## Screens

- **Overview** — platform KPIs, the three pipeline distributions, notable
  matched opportunities, recent runs.
- **Runs / Run detail** — lifecycle, derived progress, the businesses
  investigated, and the run's opportunities.
- **Opportunities / Opportunity detail** — the decision chain: hypothesis →
  evidence → independent verification → deterministic reconciliation.
- **Businesses** — canonical records aggregated across runs.
- **Catalog** — the declarative opportunity and capability vocabularies, served
  by the backend rather than restated here.

## Design notes

Light surfaces throughout; the navigation rail is the only dark one. Orange is
the brand accent and is spent on navigation, links and the single most
important number on a screen — never on a data mark, so it can never be
mistaken for a status.

Three status layers are kept visually distinct, because conflating them is the
mistake the product exists to avoid:

| Layer | Values | Read as |
|---|---|---|
| Epistemic | `CONFIRMED` / `CONTRADICTED` / `INSUFFICIENT_EVIDENCE` | what the Investigator concluded |
| Independent | `SUPPORTS` / `CONTRADICTS` / `INSUFFICIENT_EVIDENCE` / `NO_INDEPENDENT_SOURCE` / `FAILED` | what an outside source said |
| Commercial | `MATCHED` / `NOT_MATCHED` / `UNRESOLVED` | whether OpenCube can act on it |

Chart fills use teal / rose / amber / slate / blue, validated for colour-vision
separation and 3:1 contrast against the light surface. Every distribution ships
its labels and counts as text, so identity is never carried by colour alone.
