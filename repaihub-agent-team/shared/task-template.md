# Task template

The Chief Orchestrator creates one file per task in `tasks/<id>-<slug>.md` from this template. Every field is required. A task without done criteria is not a task. All work is bound by [`rules.md`](../rules.md): Rule 1, never copy from another company, applies to every task.

```markdown
# T-<id>: <short title>

**Goal:** <the founder's goal this serves, linked to results/goals/...>
**Owner agent:** <one agent>
**Peer reviewer:** <a different agent>
**Created:** <yyyy-mm-dd> · **Deadline:** <yyyy-mm-dd>
**Status:** DRAFT | IN REVIEW | WAITING FOR FOUNDER (Q-xxx) | APPROVED | EXECUTING | VERIFYING | DONE | HELD (reason)

## Task
<What to produce or change, in one or two sentences.>

## Context
- <Why it matters, which launch gate it serves>
- <Inputs: files, facts, previous results>
- <Constraints from company facts or the decisions log>

## Done criteria
- [ ] <Observable, testable result 1>
- [ ] <Observable, testable result 2>
- [ ] Peer review passed, including "nothing copied from another company" (Rule 1)
- [ ] If it is a decision, payment, filing, contract, external message or deployment: an approved queue row exists (Rules 2–3)
- [ ] For any product change: the outward-corridor regression passed (Rule 8)

## Must not
- <Task-specific limits, e.g. "no production migration", "quote only the prices in company facts">

## Log
- <yyyy-mm-dd> <agent>: <what happened>

## Result
<Link to the file in results/, plus verification evidence>
```
