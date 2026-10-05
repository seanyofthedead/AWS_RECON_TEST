# Agentic Reconciliation session handoff

Updated October 4, 2026. Continue work in `C:\Users\peder\Documents\AWS_recon_test` using mock data, as explicitly selected by the user. Keep Cognito sign-in. Do not switch to another reconciliation repo or enable business API mode without a new instruction.

## Repository and review

GitHub repository: https://github.com/seanyofthedead/AWS_RECON_TEST. Its default branch is `master`. At verification, GitHub master was `cc2a5f3fb67ec61aa3bf1494a76a4255f9dc97c8`, which merged the review and deployment configuration through PR 2. The active GitHub CLI account was `seanyofthedead`; verify it before future remote operations.

The original brainstorming is on master in [findings.md](reviews/2026-10-03/findings.md): 24 findings, prioritized enhancements, and 12 acceptance checks. The adjacent README, audit script, and audit results are also committed. Preserve these findings; read them before implementing changes. They reviewed a modified local working tree, so their observations do not all establish deployed behavior.

The local checkout was on `feature/api-integration` with pre-existing modified source files and untracked API adapters. Those changes are not all on GitHub. Preserve them and inspect the current status before switching branches, staging, or changing files. A merged deployment ZIP does not establish that the committed source reproduces that ZIP.

## Confirmed AWS deployment

The functioning deployment is https://staging.d30lp656izv8a2.amplifyapp.com/. Its authenticated interface displays `Agentic Reconciliation` and `FEMA · DEMO`.

The live asset `assets/index-CycBS08t.js` exactly matched the corresponding asset in the tracked `amplify-dist.zip` at commit `9d13b61` and master. That commit is dated May 20, 2026; the exact AWS upload date and first successful deployment date remain unverified. The asset SHA256 was `e18d4a8c43f33a8bf25f6cd144e8431c072a20188b9093dd1778b1d16b196bfb`.

The deployed bundle defaults to the mock data provider. It also includes API adapter code targeting `https://s9ka7orxaj.execute-api.us-east-1.amazonaws.com`, with cases, review, escalation, and batch routes. Backend functionality was not verified. Cognito is a functioning external authentication service; the mock business-data setup is not completely offline.

## Authentication results

The verified Cognito configuration is region `us-east-1`, pool `us-east-1_XAmbH9Qna`, client `4s9nn63db1h6cphejuirj7afnp`, and hosted domain `us-east-1xambh9qna.auth.us-east-1.amazoncognito.com`. The original local repo successfully signed in and rendered at `http://localhost:5175/executive`; the deployed staging app also rendered after sign-in.

The user supplied a corrected password during this session. It succeeded for the demo account. Do not save passwords in documentation, memory, scripts, or commits. Earlier incorrect-password findings were superseded for this verified XAmb setup. Obtain credentials from the user when needed in a future session.

Merged, self-service, current GitHub AgenticRecon, and historical mock-only frontends also authenticated and rendered locally when given the verified XAmb settings through process environment overrides. These tests did not change their saved configuration or prove backend functionality. Default development settings are missing in several of those copies. The current GitHub AgenticRecon passed on retry after an initial password-field timeout.

An older saved configuration pointed at pool `us-east-1_LFHcRzj3K`, which belonged to a separate app. Its hosted domain returned `Domain does not exist`, and on October 4, 2026 the pool's OpenID discovery document returned 404, so the pool no longer exists. See [the AWS configuration audit](reviews/2026-10-04-aws-config-audit.md). No successful deployment of the newer AgenticRecon repo was confirmed.

The `recon_test` and `agent-frontend` copies rendered without Cognito and have no applicable password test.

## Local evidence and next session

Detailed login reports remain outside the repo under `C:\Users\peder\Documents\recon-login-tests-2026-10-04`, `recon-login-retry-latest-2026-10-04`, `recon-login-local-latest-2026-10-04`, and `recon-other-options-latest-2026-10-04`. The latter's combined-results.json records the final per-version results. Those reports were not committed. Test-created dev servers were stopped.

Start by reading this note and the original findings, inspecting Git status, and keeping the mock provider selected. For local preview use `npm run dev -- --host localhost --port 5175 --strictPort` with local Cognito callbacks configured for `http://localhost:5175/`. Check existing env settings without exposing secrets. Keep authentication, rendered app behavior, and backend verification as separate claims. This handoff commit includes documentation only.
