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
  i18n/           en.ts / es.ts dictionaries, the provider, the useI18n hook
  lib/            api client, transport types, status colours, formatting
  components/     app shell, tables, and the ui/ primitives they share
  pages/          one file per screen
public/brand/     the official OpenCube logo, unmodified
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

## Language

The UI ships in English and Spanish, switchable from the top bar and remembered
per browser. All copy lives in `src/i18n/en.ts` and `src/i18n/es.ts`; the
`Dictionary` type makes a missing Spanish key a build error rather than an
English string leaking into a Spanish screen. The chosen language also drives
`Intl`, so dates, numbers and relative times follow it.

**What stays in English in both languages** is back-end data, not UI copy:
opportunity names, service names, catalog definitions, evidence observations
and the stored decision sentence. Those are pipeline records — translating them
in the browser would invent content the system never produced. The plain
explanation of each decision *is* translated, because it is keyed to the
reason code rather than rewriting the record.

## Copy

Written for someone who runs a business, not someone who built the pipeline.
"Hypothesis" is *what we found*, "verification" is a *second opinion*, and
"match status" is *can we help?*. The underlying record names still appear
where they are literally the data — a reason code, a status value — but never
as the explanation.

## Design notes

Light surfaces throughout, following the approved reference: a white navigation
rail, a soft warm-grey canvas, white cards. Dark is spent on exactly one panel
per screen — the headline result — where it earns its weight.

The logo is the real asset at `public/brand/opencube-logo.png`, byte-identical
to `design-references/opencube-logo.png`. It is never redrawn: the empty canvas
around the artwork is cropped by CSS (`.brand-logo` in `index.css`), computed
from the measured content box, so the file itself is untouched.

Orange is the brand accent and is spent on the logo, navigation, links and the
single most important number on a screen — never on a data mark, so it can
never be mistaken for a status.

Three status layers are kept visually distinct, because conflating them is the
mistake the product exists to avoid:

| Layer | Values | Read as |
|---|---|---|
| Epistemic | `CONFIRMED` / `CONTRADICTED` / `INSUFFICIENT_EVIDENCE` | what the Investigator concluded |
| Independent | `SUPPORTS` / `CONTRADICTS` / `INSUFFICIENT_EVIDENCE` / `NO_INDEPENDENT_SOURCE` / `FAILED` | what an outside source said |
| Commercial | `MATCHED` / `NOT_MATCHED` / `UNRESOLVED` | whether OpenCube can act on it |

Chart fills use green / amber / rose / slate / violet / cyan, validated against
both the light canvas and the dark panel for colour-vision separation and 3:1
contrast. Segments always render in that order so green and rose are never
neighbours — that pair is the classic red/green confusion and cannot be tuned
into compliance. Every distribution ships its labels and counts as text, so
identity is never carried by colour alone.
