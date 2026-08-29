# OpenCube Intel — Devpost copy (draft)

Draft copy for the submission form. **Nothing has been submitted.** Every claim
below is grounded in the accepted production run
`5fc062f1-3f5c-46ae-8f7f-9981ab11b669` and in code that exists in the
repository.

---

## Project name

**OpenCube Intel**

## One-line description

Don't personalize outreach first — prove there's a reason to reach out.

## Short description (≈40 words)

An autonomous intelligence team that investigates local businesses, verifies its
own findings against independent sources, and deterministically rejects
unsupported reasons to contact them. Built on the Google Gen AI SDK with Gemini
on Vertex AI, served from a Google ADK application on Cloud Run. In its
production run it rejected 27 of 30 possible outreach reasons. "Do not contact"
is a successful outcome.

## Category

Taskmaster

## Elevator pitch

You assign a market-opportunity task and close the tab. Four specialists execute
it in the background on Google Cloud: three AI agents that discover, investigate
and independently verify, and one deterministic decision engine — no model at
all — that decides whether the evidence adds up. Most of the time it decides it
doesn't, and says so with the sources attached.

---

## The problem

Prospecting local businesses by hand is slow, but that is not the real friction.

The real problem is not *finding* businesses — anyone can list two hundred med
spas in Miami-Dade in seconds. It is determining whether there is a legitimate,
observable, evidence-backed reason to contact any of them.

Every prospecting tool, AI-assisted or not, runs in the same direction: find
lead → personalize message → contact. The personalization improves every year.
The *reason* is never checked. Better writing on top of an unverified premise is
a more convincing wrong guess — and the cost of being wrong isn't a wasted
email, it's a business owner who now associates your name with someone who
invented a problem to sell them something.

This is friction from running the outreach side of OpenCube Studio, an
AI-automation practice working with local service businesses. It was not
invented for a hackathon.

## What it does

OpenCube Intel reverses the order: find business → investigate → challenge the
hypothesis → verify what matters → **reject unsupported reasons** → only then
identify a potential fit.

You assign a task to a team of four:

1. **Market Scout** *(AI agent)* — searches a market neighbourhood by
   neighbourhood via the Places API and filters deterministically to the target
   county. Selection never inspects website content, so it can't prefer
   businesses likely to produce an interesting answer.
2. **Business Investigator** *(AI agent)* — reads each business's own public
   pages and records observations tied to the URL they came from. Evidence and
   interpretation are stored separately.
3. **Verification Agent** *(AI agent)* — finds what sources the business does
   *not* control say about the same claim. A business can never be its own
   second opinion.
4. **Opportunity Matcher** *(deterministic decision engine — not an LLM)* — puts
   the two side by side and applies a fixed 18-cell table. Same evidence in,
   same answer out.

Three outcomes, never collapsed into one: **worth exploring**, **do not contact
on this basis**, and **do not contact yet — human review**. A run that rejects
everything has worked perfectly.

The differentiator is that `DO NOT CONTACT` is a first-class product output,
persisted with its reasoning and rendered with the evidence chain that produced
it — not a filtered-out row.

**The real production run:** 40 raw candidates → 10 businesses → 30 opportunities
evaluated → 10 independent verification checks → 30 deterministic decisions.
2 matched, 27 not matched, 1 unresolved. **27 of 30 possible reasons to reach out
were rejected.** End to end in ≈3m54s, with no task retries.

## How we built it

**Google Cloud, end to end.** A single Cloud Run service (`opencube-intel`,
`us-east1`, private) serves the product API, the internal task handlers and the
frontend's read routes from one Google ADK application — one deployment, one
identity.

`POST /runs` never investigates. It validates, writes a `QUEUED` run to
Firestore, enqueues one discovery task, and returns `202` in about a third of a
second. Everything after that is Cloud Tasks: one SCOUT task fans out ten
parallel investigation tasks, and the last worker to finish enqueues a single
finalize task. Firestore is the canonical workflow state — nothing in the
asynchronous path touches in-memory session state, so any instance can serve any
task and an instance dying loses nothing.

**Two Google agent frameworks, at two layers.** The analytical specialists —
Market Scout, Business Investigator, Verification Agent — are built on the
**Google Gen AI SDK** (`google-genai`), calling Gemini through **Vertex AI**
with response schemas constraining every output. The Gen AI SDK is one of the
hackathon's accepted Google agent frameworks. **Google ADK** is the application
and runtime layer: the project was scaffolded with `google-agents-cli`, and the
service runs as an ADK FastAPI application with ADK's runner, session and
artifact services and its Cloud Trace export. The ADK scaffold's sample
`root_agent` in `app/agent.py` was kept as generated and is not part of the
production analytical workflow.

Gemini reasons only over source material explicitly supplied to it. Verification
uses Google Search grounding for source *discovery* only — its prose is never
persisted as evidence — and reasons in a second, separate call over
independently fetched material. Every source URL a model emits is validated
downstream against the URLs actually fetched, so a fabricated citation can't
reach the record.

**The Matcher makes zero model calls — neither SDK reaches it.** Reconciliation is a fixed lookup over
`(investigator status × verification state)`, auditable line by line. It writes
only to its own collection, creates no evidence, and never mutates upstream
state — enforced by a test that asserts this structurally via AST rather than by
convention.

**Stack:** Python 3.12, FastAPI, Pydantic, Google Gen AI SDK, Google ADK, Cloud Run,
Cloud Tasks, Firestore (Native mode), Places API (New), IAM/OIDC · React 19,
TypeScript, Vite, Tailwind CSS v4 · pytest, Vitest, ruff, uv.

## Challenges we ran into

**Making "no" a first-class result.** Every instinct in a lead-gen system is to
maximise leads. Persisting rejections, rendering them with their full evidence
chain, and refusing to let a single supportive outside source rescue a
contradicted hypothesis meant designing *against* the product's own apparent
interest. Three cells of the reconciliation table resolve to `UNRESOLVED` rather
than to a commercial answer, and they are frozen.

**At-least-once delivery without transactions.** Cloud Tasks can redeliver
anything. The instinct is a progress counter and a "finalization started" flag —
both are traps. A counter is corrupted permanently by a single redelivery, and a
flag whose commit isn't atomic with the enqueue can strand a run forever if the
worker dies between them. We derive progress by query at read time and let Cloud
Tasks' server-side name uniqueness admit exactly one finalize task. The result:
no Firestore transaction anywhere in the production path.

**Distinguishing "the check failed" from "the check found nothing."** Collapsing
technical failure and epistemic insufficiency into one status quietly turns
infrastructure problems into analytical conclusions. They're separate enums, and
a verification that found no independent source is recorded as exactly that.

**A UI that renders disagreement instead of hiding it.** Three status layers —
what we found, what an outside source said, whether we can act — never share a
colour role or a column, because collapsing them would hide exactly the conflict
the verification loop exists to produce.

## Accomplishments we're proud of

- **27 of 30 rejected.** A prospecting system that argues itself out of nine out
  of ten reasons to contact someone, and shows its work for each one.
- **The deterministic Matcher.** The only component that decides whether a human
  gets contacted is the only one that cannot improvise. That's a product claim we
  can defend line by line.
- **A clean production run:** 12 tasks, zero retries, ≈3m54s end to end, correct
  fan-out and exactly-once finalization on the first real execution.
- **Provenance that survives to the screen.** Investigator evidence and
  verification evidence stay distinguishable from Firestore all the way to the
  interface, so a user can tell what *we* saw from what *someone else* saw.
- **A decision log.** Every significant choice — including the rejected
  alternatives and a known limitation we chose not to paper over — is written
  down in `DECISIONS.md`.

## What we learned

**The bottleneck in outreach isn't writing, it's justification.** Once we
separated evidence from interpretation, most "opportunities" stopped surviving.
That was uncomfortable and it was the right answer.

**Determinism is a feature you can sell.** "A language model decided you should
be contacted" and "a fixed, readable rule decided, from these two sources" are
very different sentences. Putting the model on the investigation side and the
policy on the decision side made the system easier to explain, easier to test,
and easier to trust.

**Idempotency is a design decision, not a cleanup step.** Every place we reached
for a counter or a flag, the correct answer was to derive state or to let the
infrastructure enforce uniqueness.

**An interface can lie without saying anything false.** A free-text instruction
box the backend ignores, a toggle that changes nothing, a status column that
merges disagreement — each is a small lie of implication. We removed them.

## What's next

- Deterministic evidence and hypothesis IDs derived from
  `(investigation_id, opportunity_id, source_url)`, closing the one known
  duplication window when a worker dies mid-investigation.
- A stuck-run watchdog, so a run that outlives its retry budget resolves itself.
- More verticals and geographies, and more task templates — added only when the
  backend can genuinely execute them.
- `provider_capabilities` steering which opportunity definitions get evaluated,
  rather than being recorded context.
- Authenticated multi-tenant access, so Product Mode can be public.

## Testing instructions

**Fastest path — nothing to install:** open <https://opencube-intel-judge-djgg4gps5q-ue.a.run.app>. It is the real product
serving the real completed production runs, read-only.

**No Google Cloud account, no cost — the full interface in two commands.** A
fixture server serves the real API routers over an in-memory store, and every
decision in it is produced by the real Matcher, so the UI is exercised against
the real reconciliation table.

```bash
# terminal 1
cd opencube-intel && uv sync && uv run python scripts/dev_fixture_api.py

# terminal 2
cd frontend && npm install && npm run dev     # http://127.0.0.1:5173
```

**Tests** (fully mocked, no credentials, no spend):

```bash
cd opencube-intel && uv run pytest tests/unit    # 189 passing
cd frontend && npm test                          # 78 passing
```

Running against real Google Cloud requires ADC
(`gcloud auth application-default login`), a Firestore database, and a Cloud
Tasks queue. Full instructions are in the repository README.

## Security & judge access

The production Cloud Run service is **private** — there is no `allUsers` binding,
only the runtime service account holds `run.invoker` scoped to that one service,
and Cloud Tasks signs every internal delivery with an OIDC token.

Hosted Judge Mode — <https://opencube-intel-judge-djgg4gps5q-ue.a.run.app> — is a **separate** Cloud Run service serving the
real completed production data, read-only. Launching a task is absent rather
than disabled, at four layers: the bundle is compiled read-only so the write is
eliminated at build time; the judge server registers only `GET` routes, so
`POST /runs` and the `/tasks/*` handlers answer `404` rather than `401`; its
runtime identity holds Firestore *viewer* and nothing else — no Vertex AI, no
Cloud Tasks, no way to invoke the production service; and the private core keeps
its IAM check, answering `403` to anonymous callers.

Public access came from disabling the Cloud Run invoker IAM check on the judge
service alone. The organisation enforces Domain Restricted Sharing, so an
`allUsers` binding is refused — and no organisation policy was relaxed to get
around it.

Everything a judge needs to evaluate the system is visible without executing
anything: the full source, the decision log, the architecture, and the real run's
results with their complete evidence chains.

## New-project disclosure

This project is submitted by **Guillermo Paz** as an individual entrant.

OpenCube Studio is the pre-existing brand I operate under — the AI-automation
practice whose prospecting friction this product addresses, and the source of
the logo asset. That brand context predates the hackathon.

**OpenCube Intel — including the submitted codebase and implementation — was
designed and built by me, Guillermo Paz, during the hackathon submission
period.** The repository's Git history evidences it: the initial commit is
dated 23 August 2026, every commit falls inside the submission period, and no
pre-existing application code was imported.

Standard open-source libraries and frameworks were used as dependencies (the
Google Gen AI SDK, Google ADK, FastAPI, Pydantic, React, Vite, Tailwind). The
project was scaffolded with Google's `agents-cli` (v1.4.0), and its generated
files — the retained Terraform and the ADK scaffold's sample agent — are
identifiable as such in the Git history. AI coding assistants were used
throughout development.

## Built with

`google-genai` · `google-adk` · `gemini` · `vertex-ai` · `google-cloud-run` · `google-cloud-tasks`
· `firestore` · `google-places-api` · `python` · `fastapi` · `pydantic` ·
`react` · `typescript` · `vite` · `tailwindcss`

## Links

- **Repository:** <https://github.com/guillermowfg-ai/opencube-vertical-intelligence>
- **Architecture:** `docs/architecture.md`
- **Decision log:** `DECISIONS.md`
- **Demo video:** *(to record — see `docs/video-plan.md`)*
- **Hosted judge view (read-only):** <https://opencube-intel-judge-djgg4gps5q-ue.a.run.app>
