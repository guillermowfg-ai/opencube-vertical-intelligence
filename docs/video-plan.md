# OpenCube Intel — demo video plan

Handoff document for the submission video. **Nothing here has been recorded
yet.**

- **Target length:** 3:50. Hard ceiling 4:00.
- **Primary language:** English. The Spanish UI appears briefly as a product
  capability, not as narration.
- **Format:** screen recording of the real product, voice-over narration.

---

## The timing problem, and how to solve it honestly

The accepted production run took **≈3m54s** end to end. The video must be under
4:00. You therefore cannot show a real run at 1× and show anything else.

**The fix:** record the execution as **one continuous, unbroken take** from
`Launch` to `COMPLETED`, then **uniformly speed that single clip up** in the
edit. A constant-rate speed-up of one uninterrupted take is still a recording of
a real execution — nothing is removed, nothing is reordered, and the viewer can
see the clock advance. Label it on screen (`3× speed`) and say so in narration.

**What does not qualify as live proof:** cutting from "launching…" to "done!",
splicing two takes together, or dropping the waiting sections. If the execution
segment is spliced, stop calling it live proof and present it as a recap
instead.

The storyboard below allocates **1:20 of screen time** to the execution clip.
At ≈3m54s of real time that is a **≈2.9× uniform speed-up** — round to 3× and
let the clip end a few seconds early.

### Decision needed before recording

A fresh live run produces fresh numbers, which will not be the accepted run's
40 / 10 / 30 / 2 / 27 / 1. Two workable options:

1. **Recommended.** Record the live execution as a new run, then — in the same
   continuous session — navigate to the accepted run
   `5fc062f1-3f5c-46ae-8f7f-9981ab11b669` in the task list for the results and
   evidence sections. Both are real, both are on screen, and the transition is
   visible and honest ("here is the run I documented"). No number is ever
   misattributed.
2. Record a new run and adopt *its* figures everywhere — README,
   `architecture.md`, Devpost, narration. More work, and it discards the
   already-audited run.

Do not mix: never narrate the accepted run's counts over a different run's
screen.

---

## Storyboard

### 0:00 – 0:25 · The friction (BYOF)

**On screen:** title card, then a plain list of local businesses — the kind
anyone can generate in seconds.

> "Finding local businesses to sell to is easy. I can generate two hundred med
> spas in Miami in about four seconds. That has never been the hard part.
>
> The hard part is knowing whether there is a real, checkable reason to contact
> any of them. Every prospecting tool out there finds a lead and then writes a
> better message. Nobody checks the reason. Better writing on top of a wrong
> guess is just a more convincing wrong guess.
>
> This is friction from my own business. So we built the opposite."

**Cut on:** the thesis card — *Don't personalize outreach first. Prove there's a
reason to reach out.*

---

### 0:25 – 0:50 · The product shell — task and team

**On screen:** Command Centre → **New Task** → Market Opportunity Intelligence →
the team step, showing all four members. Hold ~2s on the Opportunity Matcher
card, where it reads **Decision engine — no language model at all**.

> "OpenCube Intel is not a chatbot. You assign a task to a team.
>
> Three of them are AI agents. The fourth — the one that actually decides
> whether a business gets contacted — is not a model at all. It's a fixed set of
> rules that gives the same answer for the same evidence, every time. That's
> deliberate: models investigate, deterministic policy decides."

Continue through Task configuration and the written-out instruction.

> "The settings are fixed for this version, and the app tells you why. What
> you're asking for is written out from those settings — not from a text box the
> backend would ignore."

---

### 0:50 – 2:10 · Launch and background execution *(the continuous clip)*

**On screen:** press **Start this task**. Then the live activity view for the
whole run, uniformly sped up. Show the `3× speed` badge from the first frame of
the clip.

> "I press start, and the browser is done — the API returns in about a third of
> a second. Nothing analytical happens on that request.
>
> I can close this tab. The work is running on Google Cloud without me."

**Around the 25% mark of the clip**, cut *within the same session* to the Google
Cloud console — this is supporting infrastructure evidence, not the execution
proof, so it can be its own clip:

- **Cloud Run** → service `opencube-intel`, revision `opencube-intel-00002-mk2`,
  `us-east1`, showing it is **not** publicly invocable.
- **Cloud Tasks** → queue `opencube-intel-runs`, max 5 concurrent dispatches.
- **Cloud Run logs** → the SCOUT `200`, the ten `/tasks/investigate` `200`s
  overlapping, the single `/tasks/finalize` `200`, and **zero retries**.

> "One queued task fans out into twelve. Ten businesses investigated in
> parallel, each one its own Cloud Task, signed with an OIDC token — the service
> is private, so nothing else can call these endpoints.
>
> Every task returned two hundred. No retries. And when the last worker
> finished, it scheduled the finalize step — Cloud Tasks admits exactly one of
> those, no matter how many workers race for it."

Return to the live activity view for the remainder of the clip, through
`COMPLETED`.

> "Three minutes fifty-four, start to finish."

---

### 2:10 – 3:05 · Results — 27 of 30 rejected

**On screen:** the completed task's results. Land hard on the rejection
headline.

> "Ten businesses. Thirty possible reasons to reach out.
>
> Two are worth exploring. One needs a person to look at it. **Twenty-seven were
> rejected.**
>
> That's the product. OpenCube didn't find me more leads — it removed reasons I
> couldn't defend. 'Do not contact' isn't a failure here. It's the system
> working."

Scroll the opportunities list so the three distinct status layers are visible —
what our research found, what an outside source said, and whether we can act.

> "And it never collapses those into one column, because the disagreement
> between them is the whole point."

**Optional 3s:** flip the language switch to Spanish, then back.

---

### 3:05 – 3:40 · One rejection, all the way down

**On screen:** open **No Filter Medical Spa → "Hard to book online"** and walk
the evidence chain top to bottom.

> "Here's one. We thought this business might be hard to book with online.
>
> What we saw: their own pages, with prominent booking. What an independent
> source said — a site they don't control: booking is available. Our own
> hypothesis, contradicted from both directions.
>
> The decision engine rejected it. **Do not contact on this basis.**
>
> And that phrasing is exact. Not 'never contact this business' — this specific
> reason doesn't hold. Another one might."

**If time allows (≈5s):** cut to the `UNRESOLVED` case.

> "This one our research couldn't settle, and one outside source agreed with the
> claim anyway. That's not enough. It goes to a human, not to a salesperson."

---

### 3:40 – 3:50 · Architecture and close

**On screen:** `docs/architecture.svg`, full frame, then the thesis card.

> "Cloud Run, Cloud Tasks, Firestore, Gemini on Vertex AI, built on Google's
> Agent Development Kit. Three agents investigate and verify. One deterministic
> engine decides.
>
> Less outreach. Better reasons."

---

## Shot list

| # | Shot | Source | Notes |
|---|---|---|---|
| 1 | Title / thesis cards | Slide | Brand orange on light |
| 2 | Command Centre | Product | |
| 3 | New Task: work → team → settings → instruction | Product | Hold on the Matcher card |
| 4 | **Launch → COMPLETED** | Product | **One unbroken take.** Uniform 3× |
| 5 | Cloud Run service + revision | Console | Show private / not publicly invocable |
| 6 | Cloud Tasks queue | Console | Name, region, concurrency 5 |
| 7 | Cloud Run logs | Console | 1 + 10 + 1 × `200`, no retries |
| 8 | Results, rejection headline | Product | The 27-of-30 beat |
| 9 | Spanish toggle | Product | ~3s |
| 10 | Evidence chain → DO NOT CONTACT | Product | The money shot |
| 11 | `UNRESOLVED` case | Product | Optional |
| 12 | Architecture diagram | `docs/architecture.svg` | |

## Production notes

- Record at 1920×1080 or higher; the browser at ~1440px wide keeps the interface
  from feeling cramped.
- Hide bookmarks, personal tabs, notification banners and any account name.
- **Never show the Google Cloud billing page, a project selector with other
  projects, an access token, or a terminal with credentials.**
- The `3× speed` badge stays on screen for the whole execution clip.
- Narrate in English throughout. Spanish is a visual beat only.
- Say "one observed run", not "typically" or "always", about the timings.
- Do not say "Gemini decided" about the Opportunity Matcher — the entire
  differentiator is that it did not.
