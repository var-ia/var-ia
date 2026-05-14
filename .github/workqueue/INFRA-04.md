---
id: INFRA-04
status: done
priority: 14
dependencies: [INFRA-02]
packages: [cli]
layer: INFRA
effort: medium
---

# Watch Channels

## What
Add notification outputs to `wikihistory watch` and `wikihistory cron`: Slack webhook, email, and webhook URL.

## Why
Re-observation (INFRA-02) detects new events but relies on the user to check the exit code. For real monitoring, users need push notifications: a Slack message when a fandom page gets a new revert war, an email when a BLP is recategorized. Watch channels make the observation engine reactive.

## Context
Read first:
- `packages/cli/src/index.ts` — CLI dispatch, watch command
- `packages/cli/src/commands/analyze.ts` — observation diff output

## Implementation
1. Add `--notify slack` flag: sends a Slack webhook with delta summary
2. Add `--notify email` flag: sends via `sendmail` or SMTP env vars
3. Add `--notify webhook <url>`: generic POST with JSON body
4. Default behavior (no flag): same as today — stdout only
5. Notification fires only when new events exist (no empty notifications)

## Invariants
- Notification format: text summary, not raw JSON
- Slack webhook URL from env `SLACK_WEBHOOK_URL` or `--slack-url`
- Email from env `SMTP_*` or system sendmail
- Notification failure is non-fatal — warn to stderr, continue

## Acceptance
- [ ] `--notify slack` sends a formatted message to Slack
- [ ] `--notify email` sends via sendmail
- [ ] No notification when delta is empty (no new events)
- [ ] Gate: build, lint, typecheck, test
