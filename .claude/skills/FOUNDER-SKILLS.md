# Founder Skills (11) — installed for REPAIHUB

Source: https://github.com/Jakeschincariol/founder-skill (MIT, © Jake Schincariol — see `FOUNDER-SKILL-LICENSE`), commit `fd9385b`.
Installed project-local so they run as plain slash commands in Claude Code from this repo:

`/founder-board` → `/founder-competitors` → `/founder-consumer` → `/founder-pricing` → `/founder-offer` → `/founder-cfo` → `/founder-marketing` → `/founder-brand` → `/founder-ops` → `/founder-launch` → `/founder-plan`

Outputs go to `founder/` at the repo root. Tools are standard-library Python 3.8+ (no installs).

Changes from upstream: tests moved to `founder-tests/` (path in `_load.py` adjusted); the upstream packaging test (`test_repo.py`, checks the plugin manifest/README of the upstream repo) was removed. Run: `python3 -m unittest discover -s .claude/skills/founder-tests` (22 tests).
