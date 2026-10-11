# Team invitations and permissions

Owners and TeamLeads can invite an email address as Intern or TeamLead. Registration is not required before sending. Team Details lists pending and expired invitations and provides resend/revoke controls. Resending rotates the token and renews its seven-day lifetime; revoked and accepted invitations cannot be resent. Revoke an expired invitation to create a replacement with a different role.

The invitation page preserves its destination through registration, password login, and Google login. Acceptance requires the signed-in user's current email to match the invited address and a server-verified email value. Google login records the provider's verified email. Password accounts can request a single-use verification code on the invitation page; codes expire after 30 minutes. Resend and verification requests have a one-minute cooldown. Changing an account's email does not verify the new address.

Invitation tokens have 256 bits of randomness; only SHA-256 digests are stored. Tokens are sent through SMTP and never returned by team APIs. Acceptance updates membership and consumes the invitation in one conditional MongoDB update on the Team document. Retries by the same recipient succeed without duplicating membership or overwriting an existing role. Replaying an accepted invitation after removal does not restore access. Optimistic version checks prevent concurrent team saves from overwriting acceptance. MongoDB transactions or a replica set are not required.

Owners and TeamLeads share team editing, member management, project/task management, invitation management, repository linking, reports, and dashboard access. Only the canonical Owner can delete a team or transfer ownership. Transfer selects an existing member, makes the previous Owner a TeamLead, and retains exactly one Owner. Existing safeguards requiring removal of projects before team deletion and tasks before project deletion remain. Global account roles do not grant team privileges. Any authenticated user can create a team and becomes its Owner.

## Configuration

Backend variables required for invitation delivery:

| Variable | Purpose |
| --- | --- |
| `FRONTEND_URL` | Production: `https://task-it-gamma-six.vercel.app` (no trailing slash); invitation links use this value. |
| `EMAIL_HOST` | SMTP host. |
| `EMAIL_USER` | SMTP username. |
| `EMAIL_PASS` | SMTP password. |
| `EMAIL_PORT` | Optional; defaults to `587`. Use `465` for implicit TLS. |
| `EMAIL_FROM` | Optional sender; defaults to `"Task It" <EMAIL_USER>`. |
| `EMAIL_DISCLAIMER` | Optional organization-required plain-text disclaimer, appended unchanged to the text email and HTML-escaped in the HTML email. SMTP/gateway disclaimers remain untouched. |

Existing `MONGO_URI`, `JWT_SECRET`, Firebase service-account configuration, and frontend `VITE_API_URL` / Firebase configuration remain unchanged. No new authentication provider is introduced. Missing SMTP configuration or delivery failure returns a retryable error; a saved invitation remains visible for resend. Other existing notification emails retain their previous best-effort behavior.

Existing teams/users require no data backfill. Existing Google users must sign in with Google again or complete email verification before accepting an invitation. Deploy the Team schema's `invitations.tokenHash` index through the normal Mongoose index process (or create it explicitly if production disables automatic indexes). The frontend host must serve the SPA for `/invitations/*`, as for other client routes. Use HTTPS for the deployed frontend/API.

## Validation

Email-template update: **23/23 backend tests passed**, including five template/link/escaping/disclaimer tests and the existing 18 invitation/authentication/RBAC integration tests. New invitations and resends use the same responsive black/white/gray HTML template, include the invited email and seven-day notice, and retain a plain-text URL fallback. SMTP provider, token generation, lifetime, verification, and acceptance logic are unchanged.

Verified on 2026-10-11: backend integration tests **18/18 passed**; frontend regression tests **3/3 passed**; all backend source syntax checks, frontend ESLint, production build, and `git diff --check` passed. The production build reports a bundle-size advisory; the existing repository-linking code emits a Mongoose deprecation warning during tests. Neither check fails. Real SMTP delivery and live Google sign-in were not exercised; their boundaries are mocked in integration tests.

Run `npm test` in both `backend` and `frontend`, plus `npm run lint` and `npm run build` in `frontend`. Backend integration tests start an isolated MongoDB server via the development-only `mongodb-memory-server` dependency. The first run downloads a MongoDB binary; subsequent runs reuse its cache. SMTP and Google identity verification are mocked, while JWT handling, Express routes, Mongoose models, MongoDB atomic updates, and password authentication run normally. No production data or real email recipients are used.

Backend syntax check in PowerShell:

```powershell
Get-ChildItem backend/src -Filter *.js -Recurse | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed" }
}
```

## Changed files

- Backend models: `src/models/Team.js`, `src/models/User.js`.
- Backend controllers: `src/controllers/teamController.js`, new `src/controllers/invitationController.js`.
- Backend services: new `src/services/invitationService.js`, `src/services/authService.js`, `src/services/projectService.js`.
- Backend routing/validation/email: `src/routes/teamRoutes.js`, `src/routes/authRoutes.js`, `src/validators/teamValidator.js`, `src/utils/emailService.js`.
- Backend test setup: `package.json`, `package-lock.json`, new `test/invitations.test.js`.
- Frontend pages: `src/pages/auth/Login.jsx`, `src/pages/auth/Register.jsx`, `src/pages/team/TeamDetails.jsx`, `src/pages/team/EditTeam.jsx`, new `src/pages/team/Invitation.jsx`.
- Frontend routing/services/helpers: `src/routes/AppRoutes.jsx`, `src/services/api.js`, `src/services/teamService.js`, `src/utils/rbac.js`, new `src/utils/authReturn.js`.
- Frontend test/privacy setup: `package.json`, `index.html`, new `test/rbac.test.js`.
- This document: `INVITATIONS.md`.

Pre-existing lockfile changes were preserved; the frontend lockfile was not edited for this feature.

## Production email rollout

The local `backend/.env` already has `FRONTEND_URL=https://task-it-gamma-six.vercel.app`. The checked-in `backend/.env.production.example` documents the same setting; it is a reference, not an automatic Render environment update. In the Render backend service, set that exact `FRONTEND_URL` value and redeploy this backend source. Keep the existing SMTP configuration and credentials in Render; no new provider is needed. If the organization requires a disclaimer not already appended by its mail gateway, put its exact approved plain-text wording in `EMAIL_DISCLAIMER`. No existing organization disclaimer was found in the repository.

The production frontend setting is now checked in as `frontend/.env.production`: `VITE_API_URL=https://task-it-nvyh.onrender.com` (without `/api`, which the client adds). Ensure Vercel's Production environment uses the same value, since platform environment variables override Vite env files. Redeploy the current frontend source, including the invitation page from the preceding change. Local development keeps `frontend/.env` pointing at localhost.

Read-only live checks on 2026-10-11 found:

- Frontend root: HTTP 200.
- Direct `/invitations/<synthetic-invalid-token>` request: HTTP 200, serving the same SPA shell. Hosting fallback works.
- The deployed JavaScript bundle uses `https://task-it-nvyh.onrender.com/api`, matching the deployed Render backend.
- Render root: HTTP 200; unauthenticated `/api/auth/profile`: HTTP 401, as expected for a protected endpoint.
- The deployed JavaScript bundle does **not** contain `/invitations/:token`; the invitation page is not yet deployed. Serving the shell alone does not complete the invitation flow.
- Render currently returns `Access-Control-Allow-Origin: *`. The current local backend config uses `FRONTEND_URL` for CORS; verify the exact frontend origin after its redeployment.

No remote Render/Vercel settings or deployments were modified. Re-run `node backend/scripts/check-invitation-deployment.js` after rollout. It uses a generated invalid token and read-only requests, and exits unsuccessfully while the deployed invitation route is absent. Browser runtime verification was unavailable because the browser sandbox failed to initialize; these results come from HTTP responses and inspection of the deployed bundle.

Files added/updated specifically for the email-template improvement: `backend/src/utils/invitationEmail.js`, `backend/src/services/invitationService.js`, `backend/test/invitationEmail.test.js`, `backend/test/invitations.test.js`, `backend/scripts/check-invitation-deployment.js`, `backend/.env.production.example`, `frontend/.env.production`, and this document.
