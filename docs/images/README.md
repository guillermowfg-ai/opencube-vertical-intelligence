# Screenshot assets

Drop the submission screenshots here using exactly these filenames. The README
already references them in HTML comments at the right positions — swap each
comment for the matching image tag once the file exists, so GitHub never renders
a broken image in the meantime.

| File | Shot | Referenced in |
|---|---|---|
| `command-center.png` | Command Centre with a task running | `README.md`, intro |
| `new-task.png` | New Task flow — work, team, settings, instruction | `README.md`, "Product experience" |
| `team.png` | Team screen, with the Opportunity Matcher marked as a decision engine | `README.md`, "What OpenCube Intel does" |
| `do-not-contact.png` | Evidence chain ending in **Do not contact on this basis** | `README.md`, "Real example" |

To publish one, replace its comment in `README.md`:

```markdown
<!-- Screenshot: docs/images/team.png — the Team screen -->
```

with:

```markdown
![The OpenCube Intel team screen](docs/images/team.png)
```

## Before committing a screenshot

- No account name, email address or avatar in the browser chrome.
- No bookmarks bar, no other tabs, no notification banners.
- No Google Cloud billing page, project picker showing other projects, tokens or
  terminal credentials.
- Capture at 1440px browser width or wider; PNG.
- Real data only — screenshots of the accepted production run, never mock-ups.

The architecture diagram is not a screenshot. It lives at `docs/architecture.svg`
and is generated from `docs/architecture.md`.
