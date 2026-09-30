# Phase 12 — Workspace & Team Members

## Workspace model

- One OmniSocial owner login creates one workspace.
- Team members use their own OmniSocial login.
- The workspace is the future billing boundary.
- Social accounts, posts, schedules, usage, and subscription state can be associated with the workspace without removing legacy `profile_id` ownership.

## Plan foundation

| Plan | Monthly | Team members | Social accounts | Posts/month |
| --- | ---: | ---: | ---: | ---: |
| Starter | ₹999 / $9 | 5 | 10 | 100 |
| Pro | ₹1,999 / $19 | 20 | 30 | 500 |
| Premium | ₹2,999 / $29 | 50 | 100 | 2,000 |

Phase 12 stores the selected plan and enforces the team-member limit. Stripe checkout, payment verification, upgrades/downgrades, and usage billing remain in the billing phase.

## Compatibility rule

Existing profile-based publishing remains unchanged in Phase 12. Workspace-aware publishing reads/writes will be migrated in the dedicated team publishing phase so OAuth and publishing behavior are not changed accidentally during the architecture migration.
