const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../src/main/store.cjs');
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(path.resolve(__dirname,'../work/'),'store-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true})); const store = new Store(dir); await store.init(); return store;
}
test.before(async () => fs.mkdir(path.resolve(__dirname,'../work'),{recursive:true}));
test('records survive reopening the store', async t => {
  const s = await fixture(t); await s.command({type:'create',title:'持久化',nodeTitle:'保存'});
  const reopened = new Store(s.directory); await reopened.init(); assert.equal(reopened.state.tasks[0].title,'持久化');
});
test('concurrent writes are serialized without lost updates', async t => {
  const s = await fixture(t); await Promise.all(Array.from({length:20},(_,i) => s.command({type:'create',title:`任务${i}`})));
  const disk = JSON.parse(await fs.readFile(s.file,'utf8')); assert.equal(disk.tasks.length,20); assert.equal(s.state.tasks.length,20);
});
test('undo preserves later preference changes', async t => {
  const s = await fixture(t); await s.command({type:'create',title:'可撤销'}); await s.command({type:'settings',settings:{side:'left'}});
  await s.undo(); assert.equal(s.state.tasks.length,0); assert.equal(s.state.settings.side,'left');
});
test('invalid commands do not poison later operations', async t => {
  const s = await fixture(t); await assert.rejects(s.command({type:'create',title:''}));
  await s.command({type:'create',title:'成功'}); assert.equal(s.state.tasks.length,1);
});
test('failed disk write does not change in-memory state or undo history', async t => {
  const s = await fixture(t); const persist = s.persist; s.persist = async () => { throw new Error('disk full'); };
  await assert.rejects(s.command({type:'create',title:'不应保存'}),/disk full/); assert.equal(s.state.tasks.length,0); assert.equal(s.history.length,0);
  s.persist = persist; await s.command({type:'create',title:'恢复写入'}); assert.equal(s.state.tasks.length,1);
});
test('corruption recovers a validated backup and preserves damaged file', async t => {
  const s = await fixture(t); await s.command({type:'create',title:'保留下来'}); await s.command({type:'create',title:'后一次'});
  await fs.writeFile(s.file,'broken'); const reopened = new Store(s.directory); await reopened.init();
  assert.equal(reopened.state.tasks.length,1); assert.match(reopened.warning,/恢复/);
  assert.ok((await fs.readdir(s.directory)).some(name => name.startsWith('workspace-damaged')));
});
test('unrecoverable corruption stops instead of replacing data with empty state', async t => {
  const s = await fixture(t); await fs.writeFile(s.file,'broken');
  await assert.rejects(new Store(s.directory).init(),/避免覆盖/); assert.equal(await fs.readFile(s.file,'utf8'),'broken');
});
test('invalid import leaves current workspace untouched', async t => {
  const s = await fixture(t); await s.command({type:'create',title:'原数据'}); await assert.rejects(s.replace({version:99,tasks:[]}));
  assert.equal(s.state.tasks[0].title,'原数据');
});
