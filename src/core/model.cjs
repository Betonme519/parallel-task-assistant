const {validateWorkflow,setWorkflow,syncWorkflowStatus}=require('./workflow.cjs');
const { randomUUID } = require('node:crypto');
const STATUSES = ['active', 'paused', 'done'];
const COLORS = ['blue', 'violet', 'teal', 'amber', 'rose'];
const fail = message => { throw new Error(message); };
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('内容为空或超过长度限制');
  return value.trim();
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) fail('记录标识无效');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('时间格式无效');
  return value;
}
function validateState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.tasks) || value.tasks.length > 500) fail('不支持的备份格式');
  const ids = new Set();
  const tasks = value.tasks.map(t => {
    id(t.id); if (ids.has(t.id)) fail('重复的任务标识'); ids.add(t.id);
    if (!STATUSES.includes(t.status) || !COLORS.includes(t.color) || !Array.isArray(t.nodes) || t.nodes.length > 500) fail('任务格式无效');
    const nodeIds = new Set();
    return { id: t.id, title: text(t.title, 80, true), nextStep: text(t.nextStep ?? '', 240), color: t.color,
      hidden: t.hidden === true, workflow: validateWorkflow(t.workflow), status: t.status, archived: t.archived === true, createdAt: date(t.createdAt), updatedAt: date(t.updatedAt),
      nodes: t.nodes.map(n => {
        id(n.id); if (nodeIds.has(n.id)) fail('重复的节点标识'); nodeIds.add(n.id);
        return { id: n.id, title: text(n.title, 140, true), note: text(n.note ?? '', 2000), at: date(n.at),
          image: n.image == null ? null : id(n.image) };
      }) };
  });
  return { version: 1, tasks, settings: {
    side: value.settings?.side === 'left' ? 'left' : 'right',
    pinned: value.settings?.pinned === true,
    reducedMotion: value.settings?.reducedMotion === true,
    displayId: Number.isInteger(value.settings?.displayId) ? value.settings.displayId : null,
  }};
}
function emptyState() { return { version: 1, tasks: [], settings: { side: 'right', pinned: false, reducedMotion: false, displayId: null } }; }
function applyCommand(original, cmd, now = new Date().toISOString()) {
  const state = structuredClone(original);
  if (!cmd || typeof cmd.type !== 'string') fail('操作无效');
  if (cmd.type === 'create') {
    if (state.tasks.length >= 500) fail('任务已达 500 条，请先导出备份');
    const title = text(cmd.title, 80, true);
    const nodeTitle = text(cmd.nodeTitle || cmd.steps?.[cmd.currentStep||0] || cmd.steps?.[0] || '开始这项工作', 140, true);
    const task = { id: randomUUID(), title, nextStep: text(cmd.nextStep || '', 240),
      color: COLORS.includes(cmd.color) ? cmd.color : 'blue', status: 'active', archived: false,
      createdAt: now, updatedAt: now, nodes: [{ id: randomUUID(), title: nodeTitle, note: text(cmd.note || '', 2000), at: now, image: cmd.image ? id(cmd.image) : null }] };
    if(cmd.steps!==undefined){
      let titles=cmd.steps, current=cmd.currentStep;
      if(Array.isArray(titles)&&titles.length){
        titles=titles.map(x=>text(x,140,true));
        if(cmd.nodeTitle?.trim()&&!titles.includes(nodeTitle)){titles=[nodeTitle,...titles];if(current>0)current++;}
        if(task.nextStep&&!titles.includes(task.nextStep))titles.splice(Math.min((current||0)+1,titles.length),0,task.nextStep);
      }
      setWorkflow(task,titles,current);
    }
    state.tasks.unshift(task);
  } else if (cmd.type === 'settings') {
    state.settings = { ...state.settings, ...cmd.settings };
  } else if (cmd.type === 'demo') {
    if (state.tasks.length) fail('示例仅能在空白工作区中载入');
    return demoState(now);
  } else {
    const task = state.tasks.find(t => t.id === cmd.taskId);
    if (!task) fail('找不到这条时间线');
    if(cmd.type==='visibility'){if(typeof cmd.hidden!=='boolean')fail('隐藏设置无效');task.hidden=cmd.hidden;} else if (cmd.type === 'advance') {
      if(!task.workflow||task.workflow.current>=task.workflow.steps.length)fail('没有可以推进的步骤');
      if(task.nodes.length>=500)fail('此任务节点已达 500 条');
      const completed=task.workflow.steps[task.workflow.current].title;task.workflow.current++;syncWorkflowStatus(task);
      task.nodes.push({id:randomUUID(),title:task.status==='done'?'流程已完成':task.workflow.steps[task.workflow.current].title,note:`已完成：${completed}`,at:now,image:null});
    } else if (cmd.type === 'append') {
      if (task.nodes.length >= 500) fail('此任务节点已达 500 条');
      task.nodes.push({ id: randomUUID(), title: text(cmd.title, 140, true), note: text(cmd.note || '', 2000), at: now, image: cmd.image ? id(cmd.image) : null });
      if (cmd.nextStep !== undefined) task.nextStep = text(cmd.nextStep, 240);
      if (cmd.status !== undefined) { if (!STATUSES.includes(cmd.status)) fail('状态无效'); task.status = cmd.status; }
    } else if (cmd.type === 'edit') {
      task.title = text(cmd.title, 80, true); task.nextStep = text(cmd.nextStep ?? '', 240);
      if (!COLORS.includes(cmd.color) || !STATUSES.includes(cmd.status)) fail('状态或颜色无效');
      task.color = cmd.color; task.status = cmd.status;
    } else if (cmd.type === 'archive') task.archived = cmd.archived !== false;
    else fail('未知操作');
    if(cmd.steps!==undefined)setWorkflow(task,cmd.steps,cmd.currentStep);
    else if(task.workflow && cmd.currentStep!==undefined){task.workflow=validateWorkflow({...task.workflow,current:cmd.currentStep});syncWorkflowStatus(task);}
    else if(task.workflow && cmd.status==='done'){task.workflow.current=task.workflow.steps.length;syncWorkflowStatus(task);}
    else if(task.workflow && cmd.status && cmd.status!=='done' && task.workflow.current===task.workflow.steps.length){task.workflow.current=task.workflow.steps.length-1;syncWorkflowStatus(task);}
    task.updatedAt = now;
  }
  return validateState(state);
}
function demoState(now = new Date().toISOString()) {
  const state = emptyState();
  const descriptions = [
    ['把想法做成作品', 'blue', ['收集灵感与参考', '确定第一版方向', '打磨交互细节'], '试用一次完整流程'],
    ['给生活留一点空白', 'teal', ['写下想去的地方', '整理周末计划'], '挑一个晴天出发'],
    ['读完一本好书', 'violet', ['开始第一章', '记下喜欢的句子'], '读完下一章'],
    ['新的学习计划', 'amber', ['明确学习目标'], '安排第一段专注时间'],
  ];
  descriptions.forEach(([title, color, nodes, nextStep], i) => {
    const createdAt = new Date(Date.parse(now) - 86400000 * (3 + i)).toISOString();
    state.tasks.push({ id: randomUUID(), title, color, status: 'active', archived: false, createdAt, updatedAt: now, nextStep,
      nodes: nodes.map((title, j) => ({ id: randomUUID(), title, note: j === nodes.length - 1 ? '这是示例记录，你可以修改，也可以归档。' : '',
        at: new Date(Date.parse(now) - (nodes.length - 1 - j) * 3600000 * 14).toISOString(), image: null })) });
  });
  return state;
}
module.exports = { validateState, emptyState, applyCommand, demoState, STATUSES, COLORS };
