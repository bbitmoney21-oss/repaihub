# REPAIHUB Remittance Inc. — Organisation chart

This chart is built from the founder's own organisation chart. Human seats stay human. Every vacant seat is filled by an agent. Where the chart had no one to do a job the business needs, a gap-fill agent was ADDED. Every agent is bound by [`rules.md`](rules.md).

## Charted seats
| Role | Status | Scope | File |
|---|---|---|---|
| Founder & CEO — Venkateswarlu Bhagi | HUMAN | Vision, Product, Fundraising, Regulatory | [human-roles/ceo-bhagi-brief.md](human-roles/ceo-bhagi-brief.md) |
| CFO — Satwik | HUMAN | Co-founder / Contract Finance, Investor Relations, Fundraising, Financial Controls | [human-roles/cfo-satwik-brief.md](human-roles/cfo-satwik-brief.md) |
| CA Partner (India) — SriHarsha | HUMAN | Form 15CB (now Form 146), FEMA Filings | [human-roles/ca-partner-sriharsha-brief.md](human-roles/ca-partner-sriharsha-brief.md) |
| CTO | AGENT (was Vacant) | API, Backend, Security, Infra | [departments/leadership/cto-agent.md](departments/leadership/cto-agent.md) |
| Backend Engineer | AGENT (was Vacant) | Node.js, PostgreSQL, Supabase | [departments/engineering/backend-engineer-agent.md](departments/engineering/backend-engineer-agent.md) |
| Financial Analyst | AGENT (was Vacant) | FX Modelling, Reporting | [departments/finance/financial-analyst-agent.md](departments/finance/financial-analyst-agent.md) |
| Security & Compliance Engineer | AGENT (was Vacant) | Encryption, Audit, FINTRAC | [departments/compliance/security-compliance-engineer-agent.md](departments/compliance/security-compliance-engineer-agent.md) |
| Head of Compliance & Partnerships | AGENT (was Vacant) | Setu, Razorpay, Bank Onboarding | [departments/compliance/head-of-compliance-partnerships-agent.md](departments/compliance/head-of-compliance-partnerships-agent.md) |
| Legal | AGENT (was Vacant) | FINTRAC MSB, RBI FEMA, DTAA | [departments/compliance/legal-agent.md](departments/compliance/legal-agent.md) |
| Banking Relations | AGENT (was Vacant) | HDFC, ICICI, NRO Partners | [departments/finance/banking-relations-agent.md](departments/finance/banking-relations-agent.md) |
| Head of Growth & Marketing | AGENT (was Vacant) | NRI Diaspora, Canada Channels | [departments/growth/head-of-growth-marketing-agent.md](departments/growth/head-of-growth-marketing-agent.md) |
| Community & Social Lead | AGENT (was Vacant) | WhatsApp, Instagram, Events | [departments/growth/community-social-lead-agent.md](departments/growth/community-social-lead-agent.md) |

## Advisor seats
Formal legal or financial advice requires a licensed human and the founder's decision.

| Role | Status | Scope | File |
|---|---|---|---|
| NRI Financial Advisor | AGENT (was Vacant) | DTAA & Cross-Border Tax | [advisors/nri-financial-advisor-agent.md](advisors/nri-financial-advisor-agent.md) |
| Fintech Legal Counsel | AGENT (was Vacant) | MSB, AML/KYC, OSFI | [advisors/fintech-legal-counsel-agent.md](advisors/fintech-legal-counsel-agent.md) |
| Banking Industry Advisor | AGENT (was Vacant) | Canada Bank Relationships | [advisors/banking-industry-advisor-agent.md](advisors/banking-industry-advisor-agent.md) |

## ADDED gap-fill agents
| Role | Status | Gap it fills | File |
|---|---|---|---|
| Chief Orchestrator | ADDED | No one coordinates the agents, resolves conflicts or reports weekly to the founder. Also runs the Technical Program Manager function for cross-department work. | [orchestrator/orchestrator.md](orchestrator/orchestrator.md) |
| Founder's Personal Assistant | ADDED | No one triages the founder's email, keeps his calendar or briefs him daily. Reports only to the founder. | [personal-assistant/personal-assistant.md](personal-assistant/personal-assistant.md) |
| Business Analyst | ADDED | No one writes requirements, user stories or process maps. | [departments/leadership/business-analyst-agent.md](departments/leadership/business-analyst-agent.md) |
| Frontend Developer | ADDED | No one owns the web interface. | [departments/engineering/frontend-developer-agent.md](departments/engineering/frontend-developer-agent.md) |
| Mobile Developer | ADDED | No one builds the native iOS and Android apps. | [departments/engineering/mobile-developer-agent.md](departments/engineering/mobile-developer-agent.md) |
| DevOps Engineer | ADDED | No one owns hosting, CI/CD, environments or monitoring. | [departments/engineering/devops-engineer-agent.md](departments/engineering/devops-engineer-agent.md) |
| QA Lead | ADDED | No one owns test strategy or release gates. | [departments/quality/qa-lead-agent.md](departments/quality/qa-lead-agent.md) |
| Test Automation Engineer | ADDED | No one builds automated suites or regression packs. | [departments/quality/test-automation-engineer-agent.md](departments/quality/test-automation-engineer-agent.md) |
| Customer Support Lead | ADDED | No one owns support quality or escalation rules. | [departments/support/customer-support-lead-agent.md](departments/support/customer-support-lead-agent.md) |
| Support Agent | ADDED | No one handles individual customer questions. | [departments/support/support-agent.md](departments/support/support-agent.md) |
| Fraud & Risk Analyst | ADDED | No one owns fraud scoring, transaction monitoring or corridor risk. | [departments/compliance/fraud-risk-analyst-agent.md](departments/compliance/fraud-risk-analyst-agent.md) |
| Treasury Operations Analyst | ADDED | No one plans funding, liquidity or payout scheduling. | [departments/finance/treasury-operations-analyst-agent.md](departments/finance/treasury-operations-analyst-agent.md) |
| Data Analyst | ADDED | No one builds dashboards, metrics or insight notes. | [departments/data/data-analyst-agent.md](departments/data/data-analyst-agent.md) |
| Content Writer | ADDED | No one writes trust content, guides or copy. | [departments/growth/content-writer-agent.md](departments/growth/content-writer-agent.md) |

## Counts
| Group | Count |
|---|---|
| Human seats (briefs, not agent files) | 3 |
| Charted vacant seats filled by agents | 9 |
| Advisor seats filled by agents | 3 |
| ADDED gap-fill agents | 14 |
| **Agent files total** | **26** |

## Reporting lines
```
Founder & CEO (Bhagi) ── decides everything (Rule 2)
 ├── Founder's Personal Assistant ── reports only to the founder
 └── Chief Orchestrator ── one goal at a time; weekly report → Personal Assistant
      ├── Leadership: CTO · Business Analyst
      ├── Engineering: Backend · Frontend · Mobile · DevOps
      ├── Quality: QA Lead · Test Automation
      ├── Finance: Financial Analyst · Banking Relations · Treasury   (Financial Analyst and Treasury work for CFO Satwik)
      ├── Compliance: Security & Compliance · Head of Compliance & Partnerships · Legal · Fraud & Risk
      ├── Data: Data Analyst
      ├── Growth: Head of Growth & Marketing · Community & Social · Content Writer
      ├── Support: Customer Support Lead · Support Agent
      └── Advisors: NRI Financial · Fintech Legal Counsel · Banking Industry
CA Partner (SriHarsha) ── human; CA portal is his alone (Rule 7)
```
