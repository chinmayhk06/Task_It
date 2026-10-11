# Task_It authorization and installation

Only three authorization labels are supported: **Admin**, **Team Lead**, and **Member**. `User.jobTitle` is optional descriptive text and never grants permissions. Legacy labels are accepted only by the explicit migration tool.

| Operation | Admin | Team Lead | Member |
| --- | --- | --- | --- |
| Create teams | Yes | Yes | No, unless granted Team Lead in a team |
| View teams/projects | All | Authorized teams | Authorized teams |
| Manage team details, members, invitations, projects, tasks, assignments, documents, repositories | All | Teams where designated manager or Team Lead member | No |
| Update task status/progress and subtask completion | All | Managed teams | Own assigned tasks only |
| Reports | All teams | Managed teams | No |
| Dashboard | All teams | Authorized team data | Authorized projects and own tasks |
| Delete teams/projects | Yes, subject to relationship safeguards | Managed teams, same safeguards | No |
| Reassign designated manager; administer account roles/users | Yes | No | No |

Account and team scopes remain separate. `User.role` is Admin, Team Lead, or Member. `Team.members[].role` and invitation roles are Team Lead or Member. An account Team Lead can create teams, but does not automatically manage teams where they hold Member membership. A team-scoped Team Lead can manage that team and create a new team; invitations never change account-wide roles or grant Admin. Admin access is checked against the current database account on every authenticated request, not a JWT role claim.

`Team.manager` references exactly one designated manager, who must also have Team Lead membership. Creating a team sets both references. There is no Owner authorization role. The manager cannot leave, be removed, or be demoted until an Admin reassigns the manager. `POST /api/team/:id/manager` accepts `{ "userId": "..." }`; the target must be active and either an account Admin/Team Lead or an existing team Team Lead. The former manager becomes a team Member. Admin UI supports selecting an eligible user outside the team.

Public password registration permits Member (default) or Team Lead; Google creates Member accounts. Neither accepts Admin. Only authenticated Admin user-management routes can create/promote Admin accounts. Self-removal of administrative access and loss of the last active Admin are blocked. Reassign managed teams before deactivating/deleting their manager or demoting their account to Member. Users with work references cannot be hard-deleted; deactivate them instead. Team members with assigned tasks must have those tasks reassigned before leaving/removal.

Team deletion is blocked while projects exist; project deletion is blocked while tasks or documents exist. Moving a project with tasks to another team is blocked; moving a task revalidates its assignee against the destination team. Project `owner` remains an internal creator reference, displayed as “Created by”; it grants no authorization.

## Fresh production database

1. Set `MONGO_URI` to a **new explicitly named MongoDB database**. Use MongoDB Atlas or a replica set: Admin mutations, team creation, manager reassignment, bootstrap, and migration use transactions. A standalone MongoDB server is insufficient for these operations. Existing development data is not reset or migrated automatically.
2. Retain `JWT_SECRET`, Firebase, SMTP, and optional Cloudinary settings. No provider changes are required. Keep `FRONTEND_URL=https://task-it-gamma-six.vercel.app` without a trailing slash. Frontend production `VITE_API_URL=https://task-it-nvyh.onrender.com` (the client adds `/api`). Keep the SPA rewrite for invitation deep links.
3. Create the first Admin privately using the process below. The application also starts with an empty database before bootstrap; public registration can never occupy the Admin role.
4. Start the backend. Its startup guard reads role/relationship data and refuses legacy or inconsistent records without modifying them. Ensure normal Mongoose indexes are created, including unique user email and invitation-token lookup. No migration is needed for a fresh database.

## Private first-Admin bootstrap

Run from `backend` on a trusted machine/process with database access. Set temporary environment variables through your secret manager or an interactive secret input; do not commit them, pass passwords on the command line, or reuse SMTP credentials:

- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_EMAIL` (new email address)
- `BOOTSTRAP_ADMIN_PASSWORD` (at least 16 characters)
- Existing `MONGO_URI`, including the intended database name

```text
npm run bootstrap:admin -- --confirm-database EXACT_DATABASE_NAME
```

The command hashes the password, requires an exact database-name confirmation, creates a new Admin, and refuses to overwrite/promote an existing email. It refuses if any Admin or legacy Super Admin exists, including an inactive one. Concurrent bootstrap calls are serialized; at most one succeeds. Remove all `BOOTSTRAP_ADMIN_*` variables immediately afterward. Subsequent Admin creation/promotion uses the protected Users UI/API. There is no public bootstrap endpoint or permanent bootstrap password.

## Explicit legacy development migration

Do not point these commands at production accidentally. Stop old and new application instances and background writers before applying. Take your normal full MongoDB backup first. Run from `backend` with the intended development `MONGO_URI`:

```text
npm run migrate:rbac
```

This defaults to a read-only dry run and reports database name, proposed user/team counts, and inconsistencies. Mapping:

- Super Admin → Admin.
- Project Manager / account Owner / TeamLead → Team Lead.
- Developer, Frontend Developer, Backend Developer, ML Engineer, Intern → Member; preserve the old job label in `jobTitle` when absent.
- Existing canonical Admin, Team Lead, Member remain unchanged.
- Team Owner/TeamLead → Team Lead; Intern → Member; designated manager comes from existing `manager` or legacy `owner`, retaining creator/manager control even when the account becomes Member.
- Invitation TeamLead/Intern roles map to Team Lead/Member; tokens, hashes, status, email, expiry, and acceptance metadata are preserved. Admin invitations and unknown roles are rejected.

Unknown roles, missing/inactive managers, duplicate/missing members, orphan projects/tasks/documents, or assignments outside a project team require explicit repair and another dry run. The tool does not guess team relationships or delete records. Back up and decide correct relationships with the data owner.

After reviewing a clean dry run, create a protected backup directory and apply:

```text
npm run migrate:rbac -- --apply --confirm-database EXACT_DATABASE_NAME --backup backups/rbac-before.json
```

The destination must be a **new file**. It contains sensitive raw users/teams/projects/tasks/documents as lossless MongoDB Extended JSON; protect it with appropriate filesystem access controls (including Windows ACLs). `backend/backups/` is ignored by Git. A transaction verifies the database still matches the snapshot before committing all changes together. Errors abort the transaction; the backup is retained. Re-running the dry run after success should report zero changes. `rbac_controls` serializes administrative transactions and is not user data.

For rollback, stop writers, restore the full database backup (or restore each of the five snapshot collections with BSON Extended JSON decoding and original ObjectIds/dates), and restore the matching previous application version. Do not import Extended JSON as ordinary JSON strings. Never overwrite a live database with the snapshot while writers are running. No real database migration or bootstrap was executed during this implementation.

## Validation and local changes

Tests use an isolated temporary MongoDB replica set with real Express/JWT/Mongoose operations. SMTP and Firebase identity verification are mocked; no real email, cloud upload, deployed service, or production database is modified.

```text
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Backend has no configured lint command. Syntax-check all backend source/scripts with `node --check`. Tests cover all three roles, account/team scope separation, cross-team isolation, own-task restrictions, manager reassignment, protected Admin promotion, concurrent bootstrap, invitation acceptance/resend/revoke/verification/races, document access, relationship safeguards, and migration dry-run/confirmation/backup/idempotence.

Changed areas: backend User/Team/Project/Task/Document schemas; shared RBAC/roles/transaction helpers; authentication/team/user/project/task/invitation/dashboard/report services and controllers; document/GitHub/settings enforcement; auth/team/user/report routes and validators; migration/bootstrap scripts and tests. Frontend changes cover RBAC helpers, protected routes/sidebar, registration, team/project/task/document/report/user/settings controls, manager reassignment, and tests. Monochrome UI and existing JWT/Firebase flows remain.

No GitHub push or deployment is part of this change. Render needs the fresh database URI (replica-set capable) and private one-time Admin bootstrap; retain existing email/authentication settings. Deploy backend/frontend together only when separately authorized, because legacy Owner/TeamLead clients are incompatible with the canonical roles.

## Changed-file manifest

Final local verification (2026-10-11): backend **35/35 tests passed**, frontend **4/4 tests passed**, frontend ESLint passed, **60 backend source/script syntax checks passed**, production build passed, and `git diff --check` passed. Backend has no lint configuration. The build retains a large-bundle advisory; repository-linking tests retain the existing Mongoose `new` option deprecation warning. Real SMTP/Firebase/Cloudinary services and browser interaction were not exercised by these tests.

Paths relative to the repository root:

- .gitignore
- backend/package.json
- backend/scripts/bootstrap-admin.js
- backend/scripts/migrate-rbac.js
- backend/src/controllers/documentController.js
- backend/src/controllers/githubController.js
- backend/src/controllers/reportController.js
- backend/src/controllers/settingsController.js
- backend/src/controllers/teamController.js
- backend/src/controllers/userController.js
- backend/src/middleware/authMiddleware.js
- backend/src/models/Document.js
- backend/src/models/Project.js
- backend/src/models/Task.js
- backend/src/models/Team.js
- backend/src/models/User.js
- backend/src/routes/authRoutes.js
- backend/src/routes/reportRoutes.js
- backend/src/routes/teamRoutes.js
- backend/src/routes/userRoutes.js
- backend/src/server.js
- backend/src/services/adminBootstrap.js
- backend/src/services/authService.js
- backend/src/services/dashboardService.js
- backend/src/services/invitationService.js
- backend/src/services/projectService.js
- backend/src/services/rbacMigration.js
- backend/src/services/reportService.js
- backend/src/services/taskService.js
- backend/src/services/teamService.js
- backend/src/services/userService.js
- backend/src/utils/rbac.js
- backend/src/utils/rbacWrite.js
- backend/src/utils/roles.js
- backend/src/validators/authValidator.js
- backend/src/validators/taskValidator.js
- backend/src/validators/teamValidator.js
- backend/test/invitations.test.js
- backend/test/migration.test.js
- frontend/src/components/layout/Sidebar.jsx
- frontend/src/components/tasks/TaskDetailsModal.jsx
- frontend/src/components/tasks/TaskFormModal.jsx
- frontend/src/components/team/EmptyState.jsx
- frontend/src/components/team/TeamCard.jsx
- frontend/src/pages/auth/Register.jsx
- frontend/src/pages/documents/DocumentsPage.jsx
- frontend/src/pages/projects/ProjectDetails.jsx
- frontend/src/pages/projects/ProjectsPage.jsx
- frontend/src/pages/reports/Reports.jsx
- frontend/src/pages/settings/SettingsPage.jsx
- frontend/src/pages/tasks/TaskList.jsx
- frontend/src/pages/team/EditTeam.jsx
- frontend/src/pages/team/Invitation.jsx
- frontend/src/pages/team/TeamDetails.jsx
- frontend/src/pages/team/TeamList.jsx
- frontend/src/pages/users/UsersPage.jsx
- frontend/src/routes/AppRoutes.jsx
- frontend/src/services/reportService.js
- frontend/src/services/teamService.js
- frontend/src/utils/rbac.js
- frontend/test/rbac.test.js
- INVITATIONS.md
- RBAC.md
