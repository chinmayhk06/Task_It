const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planMigration } = require('../src/services/rbacMigration');
test('legacy migration is explicit, preserves invitation secrets and job titles, and is idempotent', () => {
  const snapshot = { users: [{_id:'u',role:'Developer'}, {_id:'a',role:'Super Admin'}], teams: [{_id:'t',owner:'u',members:[{user:'u',role:'Owner'}],invitations:[{role:'Intern',tokenHash:'unchanged',expiresAt:new Date(1234),status:'pending'}]}] };
  const original = structuredClone(snapshot);
  const plan=planMigration(snapshot);
  assert.deepEqual(snapshot, original); assert.deepEqual(plan.errors,[]);
  assert.deepEqual(plan.userUpdates[0],{_id:'u',role:'Intern',jobTitle:'Developer'});
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
  assert.ok(planMigration({users,teams:[{_id:'t',manager:'a',members:[{user:'a',role:'Intern'},{user:'a',role:'Intern'}]}]}).errors.some(e=>e.includes('duplicate')));
});

test('previous Member roles migrate to Intern without altering data or relationships', () => {
  const invite = { _id:'i', role:'Member', email:'invited@example.com', tokenHash:'secret-hash', status:'accepted', acceptedBy:'u', acceptedAt:new Date(500), expiresAt:new Date(1000) };
  const snapshot = {
    users:[{_id:'a',role:'Admin',jobTitle:''},{_id:'u',role:'Member',jobTitle:'Researcher'}],
    teams:[{_id:'t',manager:'a',members:[{user:'a',role:'Team Lead'},{user:'u',role:'Member',custom:'preserved'}],invitations:[invite]}],
    projects:[{_id:'p',team:'t',owner:'u'}],tasks:[{_id:'task',project:'p',assignee:'u'}],documents:[{_id:'d',project:'p'}],
  };
  const before = structuredClone(snapshot), plan = planMigration(snapshot);
  assert.deepEqual(snapshot,before); assert.deepEqual(plan.errors,[]);
  assert.deepEqual(plan.userUpdates,[{_id:'u',role:'Intern',jobTitle:'Researcher'}]);
  assert.deepEqual(plan.teamUpdates[0].members[1],{user:'u',role:'Intern',custom:'preserved'});
  assert.deepEqual(plan.teamUpdates[0].invitations[0],{...invite,role:'Intern'});
  const migrated={...snapshot,users:snapshot.users.map(u=>({...u,...plan.userUpdates.find(v=>v._id===u._id)})),teams:snapshot.teams.map(t=>({...t,...plan.teamUpdates.find(v=>v._id===t._id)}))};
  assert.deepEqual(planMigration(migrated),{errors:[],userUpdates:[],teamUpdates:[]});
});

test('all supported account role variants map explicitly and preserve descriptive job titles', () => {
  const cases={'Super Admin':'Admin','Project Manager':'Team Lead',TeamLead:'Team Lead',Owner:'Team Lead',Developer:'Intern','Frontend Developer':'Intern','Backend Developer':'Intern','ML Engineer':'Intern',Member:'Intern',Intern:'Intern',Admin:'Admin','Team Lead':'Team Lead'};
  for(const [from,to] of Object.entries(cases)) {
    const plan=planMigration({users:[{_id:'u',role:from,jobTitle:'Keep this title'}],teams:[]});
    assert.deepEqual(plan.errors,[]);
    if(from===to) assert.equal(plan.userUpdates.length,0);
    else assert.deepEqual(plan.userUpdates,[{_id:'u',role:to,jobTitle:'Keep this title'}]);
  }
});

test('migration never guesses a missing or conflicting manager, or accepts Owner invitations', () => {
  const users=[{_id:'a',role:'Admin',jobTitle:''},{_id:'b',role:'Team Lead',jobTitle:''}];
  for(const team of [{_id:'t',members:[]},{_id:'t',manager:'a',owner:'b',members:[]},{_id:'t',manager:'a',members:[{user:'a',role:'Team Lead'}],invitations:[{role:'Owner'}]}]) {
    const plan=planMigration({users,teams:[team]}); assert.equal(plan.errors.length,1); assert.equal(plan.teamUpdates.length,0);
  }
});
