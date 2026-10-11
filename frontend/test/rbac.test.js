import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditTeam, canDeleteTeam, canManageMembers, canManageProjects, canDeleteProject, canManageTasks, getTeamRole } from "../src/utils/rbac.js";
import { invitationReturn, authLink } from "../src/utils/authReturn.js";

test("Owner and TeamLead share operational permissions, deletion remains Owner only", () => {
  for (const can of [canEditTeam, canManageMembers, canManageProjects, canDeleteProject, canManageTasks]) {
    assert.equal(can("Owner"), true); assert.equal(can("TeamLead"), true);
    assert.equal(can("Intern"), false); assert.equal(can("Super Admin"), false);
  }
  assert.equal(canDeleteTeam("Owner"), true); assert.equal(canDeleteTeam("TeamLead"), false);
});
test("team membership uses team roles and supports populated IDs and legacy Member", () => {
  const team = { owner: { _id: "owner" }, members: [{ user: { _id: "lead" }, role: "TeamLead" }, { user: "intern", role: "Member" }] };
  assert.equal(getTeamRole(team, "owner"), "Owner"); assert.equal(getTeamRole(team, "lead"), "TeamLead");
  assert.equal(getTeamRole(team, "intern"), "Intern"); assert.equal(getTeamRole(team, "outsider"), null);
});
test("authentication return path preserves invitation and rejects open redirects", () => {
  const path = `/invitations/${"a".repeat(64)}`;
  const url = authLink("/register", path);
  assert.equal(invitationReturn(url.slice(url.indexOf("?"))), path);
  for (const unsafe of ["https://evil.example", "//evil.example", "/dashboard", path + "/../admin"]) {
    assert.equal(invitationReturn(`?returnTo=${encodeURIComponent(unsafe)}`), "");
  }
});
