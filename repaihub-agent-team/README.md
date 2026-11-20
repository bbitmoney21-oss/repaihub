# REPAIHUB Agent Company

This folder is the AI workforce of **REPAIHUB Remittance Inc.**, a Canada–India remittance company. Its primary corridor is India → Canada (NRO repatriation), and it is FINTRAC-registered (N300002485).

The workforce has 26 agents, each one a Markdown file, organised from the founder's own organisation chart. Three human seats stay human: the founder and CEO Venkateswarlu Bhagi, the CFO Satwik, and the CA Partner SriHarsha. Agents work on disk. They read tasks, write files and peer-review each other. Anything that needs a decision goes to one approval queue. **The founder is the only decision-maker.**

**The rules in one line:** never copy another company; the founder decides everything; nothing is sent, posted, spent, signed or deployed without his yes; no real money before the AD-I bank agreement; and STOP means stop (full text: [`rules.md`](rules.md)).

## How to run it
1. **Give a goal.**
   - Tell the Chief Orchestrator one goal in plain words, directly or through the Personal Assistant.
   - Example: "Get Equitas Small Finance Bank to a first meeting."
2. **The Orchestrator breaks it down.**
   - It writes the goal and its tasks to files (`results/goals/`, `tasks/`).
   - It assigns each task to the right department agent.
3. **Agents work in files.**
   - Each task goes through draft → peer review (including the "nothing copied" check) → approval queue → execute → verify → report.
   - Finished work lands in `results/`.
4. **The founder approves.**
   - Every decision, payment, filing, contract, external message and deployment waits in [`queue/needs-founder-ok.md`](queue/needs-founder-ok.md).
   - He marks the exact row APPROVED or DECLINED, or tells Claude "approve Q-xxx".
5. **The founder gets briefed.**
   - Every morning the Personal Assistant writes a two-minute briefing (`results/daily-briefings/`).
   - Every Monday a one-page weekly summary arrives (`results/weekly-reports/`).

## The three things only the founder does
1. **Approve.** Every decision, payment, filing, contract, external message and deployment.
2. **Provide credentials and access.** Passwords, API keys, developer accounts, the Supabase Restore/Resume click, plan upgrades and signing contracts.
3. **Decide.** Strategy, the first real transaction, and anything the Orchestrator cannot resolve.

## How it runs around the clock
Scheduled Claude runs start fresh sessions that read this folder and act as the agents:
- **Agent company run:**
  - The Orchestrator reads the queue and the open tasks and works the backlogs.
  - The Personal Assistant writes the morning briefing.
  - The weekly report is written on Mondays.
  - Work is committed to the `agents/workspace` branch. That branch never deploys anything.
- **Website monitor** (QA Lead + DevOps):
  - tests the live site and cleans up its test accounts;
  - if something breaks, prepares a tested fix and queues the deployment for the founder's yes.

The founder gets a phone notification only when something needs him.

## Folder map
```
repaihub-agent-team/
  README.md                 this file
  rules.md                  the 11-rule constitution, binding on every agent
  ORG_CHART.md              who is who, the gap each added agent fills, counts
  orchestrator/             Chief Orchestrator (goals → tasks, weekly report)
  departments/
    leadership/             CTO, Business Analyst
    engineering/            Backend, Frontend, Mobile, DevOps
    quality/                QA Lead, Test Automation
    finance/                Financial Analyst, Banking Relations, Treasury
    compliance/             Security & Compliance, Head of Compliance & Partnerships, Legal, Fraud & Risk
    data/                   Data Analyst
    growth/                 Head of Growth & Marketing, Community & Social, Content Writer
    support/                Customer Support Lead, Support Agent
  advisors/                 NRI Financial, Fintech Legal Counsel, Banking Industry (research only)
  human-roles/              briefs for the founder, the CFO and the CA Partner
  personal-assistant/       the founder's assistant, briefing template, email triage rules
  shared/                   task and hand-off templates, brand and voice
  queue/needs-founder-ok.md the approval queue: nothing leaves without the founder's yes
  knowledge/                company facts (read before every task), decisions log
  results/                  finished work, daily briefings, weekly reports
  tasks/                    open task files (created by the Orchestrator)
```

## Before you use the team
- **The approval queue is the control panel.** If a row is not marked APPROVED, it does not happen.
- **The CA portal is SriHarsha's.** No agent ever touches it. Agents only prepare data and drafts as files for him.
- **The AD-I bank agreement is the launch gate.** No real money moves until it is signed and the founder approves the first transaction.
