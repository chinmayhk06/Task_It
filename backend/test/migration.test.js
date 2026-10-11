const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planMigration } = require('../src/services/rbacMigration');
test('legacy migration is explicit, preserves invitation secrets and job titles, and is idempotent', () => {
  const snapshot = { users: [{_id:'u',role:'Developer'}, {_id:'a',role:'Super Admin'}], teams: [{_id:'t',owner:'u',members:[{user:'u',role:'Owner'}],invitations:[{role:'Intern',tokenHash:'unchanged',expiresAt:new Date(1234),status:'pending'}]}] };
  const original = structuredClone(snapshot);
  const plan=planMigration(snapshot);
  assert.deepEqual(snapshot, original); assert.deepEqual(plan.errors,[]);
  assert.deepEqual(plan.userUpdates[0],{_id:'u',role:'Member',jobTitle:'Developer'});
  assert.equal(plan.userUpdates[1].role,'Admin');
  assert.equal(plan.teamUpdates[0].manager,'u'); assert.equal(plan.teamUpdates[0].members[0].role,'Team Lead');
  assert.equal(plan.teamUpdates[0].invitations[0].tokenHash,'unchanged');
  assert.equal(plan.teamUpdates[0].invitations[0].expiresAt.getTime(),1234);
  const migrated={users:plan.userUpdates,teams:plan.teamUpdates};
  assert.deepEqual(planMigration(migrated),{errors:[],userUpdates:[],teamUpdates:[]});
});
test('migration refuses unknown roles, missing relationships, duplicate members and Admin invitations', () => {
  const users=[{_id:'u',role:'Unknown'},{_id:'a',role:'Admin',jobTitle:''}];
  const result=planMigration({users,teams:[{_id:'t',manager:'a',members:[{user:'a',role:'Team Lead'}],invitations:[{role:'Admin'}]}],projects:[{_id:'p'}],tasks:[{_id:'task'}],documents:[{_id:'doc'}]});
  assert.equal(result.errors.length,5);
  assert.ok(planMigration({users,teams:[{_id:'t',manager:'a',members:[{user:'a',role:'Member'},{user:'a',role:'Member'}]}]}).errors.some(e=>e.includes('duplicate')));
});
