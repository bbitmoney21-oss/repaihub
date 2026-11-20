# Hand-off template

Use this whenever work passes from one agent to another. Append the hand-off to the task file under "Log", or save it as `tasks/<id>-handoff-<n>.md` if it is long. Every hand-off is bound by [`rules.md`](../rules.md). Rule 1 applies: never copy from another company.

```markdown
## Hand-off — T-<id> — <yyyy-mm-dd>
**From:** <agent> → **To:** <agent>
**Reason:** <review | implementation | testing | escalation | decision prep>

### What is done
- <Finished items, with links to files and commits>

### What the receiver must do
- <Exact next step and its done criteria>

### Evidence
- <Test output, screenshots, sources: real results only (Rule 9)>

### Open risks and unknowns
- <Anything unverified, and how to verify it>

### Rule checks by the sender
- [ ] Nothing copied from another company (Rule 1)
- [ ] Nothing sent, posted, spent, signed, filed or deployed without an approved queue row (Rules 2–3)
- [ ] No real money touched (Rule 4); CA portal not touched (Rule 7)
- [ ] No defaults or invented data used (Rule 9)
```

The receiver must acknowledge the hand-off in the task log before starting. If anything is missing, the receiver sends it back rather than guessing.
