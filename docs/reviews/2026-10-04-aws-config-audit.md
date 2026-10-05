# AWS configuration audit

October 4, 2026. This audit checks which Amplify, Cognito, and API Gateway resources referenced by this repository belong to Agentic Reconciliation, and which were carried over from a separate Amplify app. The header badge (`USCG CIP · Demo` in source, `FEMA · Demo` in the deployed bundle) was confirmed as carried over and removed in `df2c6c3`.

All tests used public, unauthenticated endpoints. No credentials were submitted and nothing in AWS was changed. AWS account ownership was not checked, because no AWS console or API access was available.

## Verdicts

| Resource | Verdict | Action |
|---|---|---|
| Amplify app `d30lp656izv8a2`, `staging` branch | Hosts this app | Keep |
| Cognito pool `us-east-1_XAmbH9Qna`, client `4s9nn63db1h6cphejuirj7afnp`, domain `us-east-1xambh9qna` | Configured for this app | Keep |
| API Gateway `s9ka7orxaj` | Does not serve this app | Removed `VITE_API_BASE_URL` from `.env.production` |
| Cognito pool `us-east-1_LFHcRzj3K` (handoff notes only) | Separate app; pool no longer exists | Removed its client, domain, and account ID from the handoff note |

## Evidence

### Amplify app `d30lp656izv8a2`

- `https://staging.d30lp656izv8a2.amplifyapp.com/` serves `index.html` that loads `assets/index-CycBS08t.js`. That is the entry chunk in this repository's `amplify-dist.zip`.
- The live `index.html` is `Last-Modified: Wed, 20 May 2026 13:56:21 GMT`, three minutes after commit `9d13b61` (13:53 GMT), which rebuilt that ZIP.
- No other common branch subdomain (`main`, `master`, `prod`, `production`, `dev`, `develop`, `demo`) responds, so no other app is visibly hosted there.

### Cognito pool `XAmbH9Qna` and client `4s9nn63db1h6cphejuirj7afnp`

The pool's discovery document and JWKS respond. Callback URLs registered on the app client were probed through `/oauth2/authorize`. A registered URL redirects to `/login`. An unregistered one redirects to `/error?error=redirect_mismatch`.

| Redirect URI | Result |
|---|---|
| `https://staging.d30lp656izv8a2.amplifyapp.com/` | Registered |
| `http://localhost:5175/` | Registered |
| `http://localhost:5173/`, `5174`, `5176`, `3000`, `4173`, `8080` | Rejected |
| `https://main.d30lp656izv8a2.amplifyapp.com/` | Rejected |
| `https://example.com/` | Rejected |

The client accepts this app's staging site and its dev port. Port 5175 is set in `vite.config.ts` and is not a Vite default. No callback for a different app was found among the URIs tested. The hosted UI uses Cognito's default theme and has no USCG or FEMA branding.

The client's hosted UI theme is dated January 20, 2026, before this repository's first commit (February 28, 2026). The pool predates the repository, so it may first have been created for an earlier copy of this app. Its current callbacks fit only this app.

### API Gateway `s9ka7orxaj`

- The API exists: requests return API Gateway `{"message":"Not Found"}` with an `apigw-requestid` header.
- Every route the deployed API adapter calls returns 404, including `/api/cases`, `/api/escalations`, and stage-prefixed variants. CORS preflights from the staging origin also return 404.
- Committed source never reads `VITE_API_BASE_URL`. Only the deployed bundle's uncommitted API adapter uses it, and that bundle defaults to the mock provider.

The API does not serve this app. It is either the other app's backend or one that was never built out for this app. The variable was removed so that a future API adapter cannot point at it by default.

### Cognito pool `LFHcRzj3K`

- `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_LFHcRzj3K/.well-known/openid-configuration` returns 404, and its hosted domain returns 400. The pool is gone.
- Commit `9d13b61` had already moved the deployed build off this pool.

## Remaining items

- `amplify-dist.zip` was rebuilt from current source on October 5, 2026 (entry chunk `assets/index-Col0nlBE.js`). It has no badge and no `s9ka7orxaj` URL. The live site keeps serving the old bundle (`assets/index-CycBS08t.js`, with `FEMA · Demo`) until the new ZIP is uploaded to Amplify.
- The deployed bundle also bakes in `VITE_APP_REDIRECT_SIGN_IN_LOCAL=http://localhost:5175/`, which came from an uncommitted local env file.
- Confirm in the AWS console that the pool, the Amplify app, and the API sit in the intended account, and decide whether to delete API `s9ka7orxaj` if nothing else uses it.
