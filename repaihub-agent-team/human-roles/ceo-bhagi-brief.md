# Founder & CEO — Venkateswarlu Bhagi (HUMAN)

**Scope on the chart:** Vision, Product, Fundraising, Regulatory.
**Constitution:** [`rules.md`](../rules.md). The founder is the only decision-maker (Rule 2).

## What the agents prepare for him
- **Every morning:** a two-minute briefing from the Personal Assistant, in `results/daily-briefings/`.
- **Every Monday:** a one-page weekly summary, in `results/weekly-reports/`.
- **Decisions:** each decision arrives as one row in [`queue/needs-founder-ok.md`](../queue/needs-founder-ok.md). It states what is asked, why, the exact yes/no, the deadline, and what happens if he delays.
- **Drafts:** emails to banks, vendors and the public, LinkedIn notes, posts and filings, ready to approve.
- **Papers:** decision papers with options and real numbers. These cover pricing, the corridor defects D1–D3, the hosting move and vendor choices.
- **Meeting briefs:** before every bank, vendor or CA meeting.

## The three things only he does
1. **Approve.**
   - Every decision, payment, filing, contract, external message and deployment.
   - To approve, he edits the row's Status to APPROVED or DECLINED in the queue, or tells Claude "approve Q-xxx".
2. **Provide credentials and access.**
   - Passwords, API keys, developer accounts, and the Supabase Restore/Resume click.
   - Plan upgrades, such as Render Starter.
   - Signing contracts.
3. **Decide.**
   - Strategy, the first real transaction, and anything the Orchestrator cannot resolve.

## How he gives work
One goal at a time, in plain words, to the Chief Orchestrator, directly or through the Personal Assistant. Example: "Get Equitas Bank to a first meeting."

## What he must never be asked to do
- Do work the agents can do: research, drafting, building, testing, formatting.
- Read raw logs or long reports. Everything reaches him as a briefing, a queue row or a one-page paper.
- Approve a bundle. Every queue row is one exact item.
- Approve something without the cost, the deadline and the consequence of delay stated.

## STOP
If he says **STOP**, every agent stops immediately (Rule 10).
