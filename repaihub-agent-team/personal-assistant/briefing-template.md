# Daily briefing template

The Founder's Personal Assistant writes one briefing each morning to `results/daily-briefings/<yyyy-mm-dd>.md`, using this structure. It should take two minutes to read on a phone.

Rules for every briefing:
- Only real numbers and real events (Rule 9). If something is unknown, write "unknown", plus how to find it.
- No section may be left out. If a section has nothing, write "Nothing today."
- Never include personal or family matters.

---

```markdown
# Briefing — <Weekday, d Month yyyy>

## 1. The one thing today
<The single most important action for the founder today, in one sentence, and why.>

## 2. Decisions waiting on you
| # | Decision (queue row) | Deadline | If you delay |
|---|---|---|---|
| Q-xxx | <exact yes/no question> | <date> | <concrete consequence> |

Approve or decline by editing the row's Status in `queue/needs-founder-ok.md`, or tell Claude "approve Q-xxx".

## 3. Yesterday's progress
- <Milestone, which agent, link to result>

## 4. Today's calendar
- <time> — <meeting> — <brief link>

## 5. Emails needing replies
| From | Subject | Draft ready? | Queue row |
|---|---|---|---|

## 6. Blockers and risks
- <Blocker> — owner — what unblocks it

## 7. Launch gates
| Gate | Status |
|---|---|
| 1. AD-I bank agreement | |
| 2. Vendor KYB (Zūm Rails, IDfy, Persona) | |
| 3. Integration & testing | |
| 4. Pilot transactions | |
| 5. Public launch | |

## 8. Website health
<Result of the last scheduled monitor run: pass/fail, time, link.>
```
