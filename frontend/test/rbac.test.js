import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditTeam, canDeleteTeam, canManageMembers, canManageProjects, canDeleteProject, canManageTasks, getTeamRole, canCreateTeam, canViewReports } from "../src/utils/rbac.js";
import { invitationReturn, authLink } from "../src/utils/authReturn.js";

test("Admin and Team Lead share team operations; Intern and legacy roles are denied", () => {
  for (const can of [canEditTeam, canManageMembers, canManageProjects, canDeleteProject, canManageTasks]) {
    assert.equal(can("Admin"), true); assert.equal(can("Team Lead"), true);
    assert.equal(can("Intern"), false); assert.equal(can("Owner"), false);
  }
  assert.equal(canDeleteTeam("Admin"), true); assert.equal(canDeleteTeam("Team Lead"), true);
});
test("team membership uses scoped roles and only Admin overrides unrelated teams", () => {
  const team = { manager: { _id: "manager" }, members: [{ user: { _id: "lead" }, role: "Team Lead" }, { user: "member", role: "Intern" }] };
  assert.equal(getTeamRole(team, "manager"), "Team Lead"); assert.equal(getTeamRole(team, "lead"), "Team Lead");
  assert.equal(getTeamRole(team, "member"), "Intern"); assert.equal(getTeamRole(team, "outsider"), null);
  globalThis.localStorage = { getItem: () => JSON.stringify({id:"outsider",role:"Team Lead"}) };
  assert.equal(getTeamRole(team,"outsider"),null);
  globalThis.localStorage = { getItem: () => JSON.stringify({id:"outsider",role:"Admin"}) };
  assert.equal(getTeamRole(team,"outsider"),"Admin");
  delete globalThis.localStorage;
});
test("creation and reports require global or explicitly scoped management capabilities", () => {
  for (const can of [canCreateTeam,canViewReports]) {
    assert.equal(can({role:"Admin"}),true); assert.equal(can({role:"Team Lead"}),true);
    assert.equal(can({role:"Intern",jobTitle:"Admin"}),false);
    assert.equal(can({role:"Intern",capabilities:{canCreateTeams:true,canViewReports:true}}),true);
  }
});
test("authentication return path preserves invitation and rejects open redirects", () => {
  const path = `/invitations/${"a".repeat(64)}`;
  const url = authLink("/register", path);
  assert.equal(invitationReturn(url.slice(url.indexOf("?"))), path);
  for (const unsafe of ["https://evil.example", "//evil.example", "/dashboard", path + "/../admin"]) {
    assert.equal(invitationReturn(`?returnTo=${encodeURIComponent(unsafe)}`), "");
  }
});
