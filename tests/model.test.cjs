const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyState, applyCommand, validateState, demoState } = require('../src/core/model.cjs');
const { dockBounds, isInRect, activationRect } = require('../src/main/dock.cjs');
const { OfflineVisionProvider } = require('../src/main/ai.cjs');
const now = '2026-09-06T00:00:00.000Z';
const create = (state = emptyState()) => applyCommand(state, {type:'create',title:'我的项目',nodeTitle:'确定方向'},now);
test('create does not mutate original and adds a real timestamped node', () => {
  const original = emptyState(), next = create(original); assert.equal(original.tasks.length,0);
  assert.equal(next.tasks[0].nodes[0].title,'确定方向'); assert.equal(next.tasks[0].createdAt,now);
});
test('append keeps existing history and explicit status/next step', () => {
  const original = create(), id = original.tasks[0].id;
  const next = applyCommand(original,{type:'append',taskId:id,title:'完成测试',status:'done',nextStep:''},now);
  assert.equal(next.tasks[0].nodes.length,2); assert.equal(original.tasks[0].nodes.length,1); assert.equal(next.tasks[0].status,'done');
});
test('empty title and excessively long title are rejected', () => {
  for (const title of ['', '  ', 'x'.repeat(81)]) assert.throws(() => applyCommand(emptyState(),{type:'create',title}),/内容/);
});
test('unknown task cannot silently create an update', () => assert.throws(() => applyCommand(create(),{type:'append',taskId:'unknown',title:'x'}),/找不到/));
test('archive and restore preserve all nodes', () => {
  let s = create(), id = s.tasks[0].id; s = applyCommand(s,{type:'archive',taskId:id}); assert.equal(s.tasks[0].archived,true);
  s = applyCommand(s,{type:'archive',taskId:id,archived:false}); assert.equal(s.tasks[0].archived,false); assert.equal(s.tasks[0].nodes.length,1);
});
test('invalid status and asset traversal are rejected', () => {
  const s = create(), taskId = s.tasks[0].id;
  assert.throws(() => applyCommand(s,{type:'append',taskId,title:'x',status:'maybe'}));
  assert.throws(() => applyCommand(s,{type:'append',taskId,title:'x',image:'../../secret'}));
});
test('backup validation rejects duplicate IDs, oversized history and invalid dates', () => {
  let s = create(); s.tasks.push(structuredClone(s.tasks[0])); assert.throws(() => validateState(s),/重复/);
  s = create(); s.tasks[0].createdAt = 'tomorrow'; assert.throws(() => validateState(s),/时间/);
  s = create(); s.tasks[0].nodes = Array(501).fill(s.tasks[0].nodes[0]); assert.throws(() => validateState(s));
});
test('settings normalization excludes injected properties', () => {
  const s = applyCommand(emptyState(), {type:'settings',settings:{side:'left',pinned:true,execute:'evil'}});
  assert.equal(s.settings.side,'left'); assert.equal(s.settings.pinned,true); assert.equal(s.settings.execute,undefined);
});
test('demo requires explicitly empty workspace', () => { assert.equal(demoState().tasks.length,4); assert.throws(() => applyCommand(create(),{type:'demo'})); });
test('dock placement handles offset and negative-coordinate monitors', () => {
  const b = dockBounds({x:-1920,y:0,width:1920,height:1040}); assert.equal(b.height,660); assert.equal(b.y,190);
  const activation = activationRect({x:-448,y:120,width:448,height:800},'right');
  assert.ok(isInRect({x:-2,y:520},activation)); assert.ok(!isInRect({x:-30,y:520},activation));
});
test('dock fits laptop height without covering taskbar', () => { const b = dockBounds({x:0,y:0,width:1366,height:728}); assert.equal(b.height,660); assert.equal(b.y,34); });
test('offline AI never invents a proposal', async () => { const result = await new OfflineVisionProvider().analyze({image:'sample'}); assert.equal(result.status,'unconfigured'); assert.equal(result.proposal,null); });

test('minimal widget uses narrow geometry on either monitor',()=>{const b=dockBounds({x:-1920,y:0,width:1920,height:1040},'widget');assert.equal(b.width,280);assert.equal(b.height,1016);assert.equal(b.y,12);});

test('hiding a task preserves its content and can be reversed',()=>{const s=applyCommand(emptyState(),{type:'create',title:'任务',nodeTitle:'等待回复'}),t=s.tasks[0];const hidden=applyCommand(s,{type:'visibility',taskId:t.id,hidden:true});assert.equal(hidden.tasks[0].hidden,true);assert.deepEqual(hidden.tasks[0].nodes,t.nodes);assert.equal(applyCommand(hidden,{type:'visibility',taskId:t.id,hidden:false}).tasks[0].hidden,false);});
