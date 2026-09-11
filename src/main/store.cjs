const fs = require('node:fs/promises');
const path = require('node:path');
const { validateState, emptyState, applyCommand } = require('../core/model.cjs');
class Store {
  constructor(directory) { this.directory = directory; this.file = path.join(directory, 'workspace.json'); this.state = null; this.history = []; this.queue = Promise.resolve(); this.warning = null; }
  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try { this.state = validateState(JSON.parse(await fs.readFile(this.file, 'utf8'))); }
    catch (err) {
      if (err.code === 'ENOENT') this.state = emptyState();
      else {
        await fs.copyFile(this.file, path.join(this.directory, `workspace-damaged-${Date.now()}.json`)).catch(() => {});
        try { this.state = validateState(JSON.parse(await fs.readFile(this.file + '.bak', 'utf8'))); this.warning = '主记录异常，已恢复上次备份。原文件已保留。'; }
        catch { throw new Error('工作区无法读取。原文件已保留，请使用备份恢复，避免覆盖现有记录。'); }
      }
    }
    return this.snapshot();
  }
  snapshot() { return structuredClone(this.state); }
  serial(action) {
    const next = this.queue.then(action);
    this.queue = next.catch(() => {});
    return next;
  }
  async persist(state) {
    const tmp = this.file + '.tmp';
    const handle = await fs.open(tmp, 'w');
    try { await handle.writeFile(JSON.stringify(state, null, 2), 'utf8'); await handle.sync(); } finally { await handle.close(); }
    // Backup the last validated state, rather than copying a possibly damaged file.
    if (this.state) await fs.writeFile(this.file + '.bak', JSON.stringify(this.state, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }
  command(cmd) { return this.serial(async () => {
    const next = applyCommand(this.state, cmd);
    await this.persist(next);
    if (cmd.type !== 'settings') { this.history.push(this.snapshot()); if (this.history.length > 20) this.history.shift(); }
    this.state = next; return this.snapshot();
  }); }
  undo() { return this.serial(async () => {
    if (!this.history.length) throw new Error('没有可撤销的操作');
    const next = structuredClone(this.history.at(-1)); next.settings = this.state.settings;
    await this.persist(next); this.history.pop(); this.state = next; return this.snapshot();
  }); }
  replace(value) { return this.serial(async () => {
    const next = validateState(value); await this.persist(next); this.history.push(this.snapshot());
    if (this.history.length > 20) this.history.shift(); this.state = next; return this.snapshot();
  }); }
}
module.exports = { Store };
