import {homeTimeline,bindHomeActions} from './home-timeline.js';
import {mountVision,mountVoice} from './capture.js';
import {renderWidget,moveWidget} from './reel.js';
import { $, $$, escape as e, icon, formatDate, shortDate, statusNames, colorPicker } from './ui.js';
const bridge = window.flowline;
let state, metadata, selectedId, filter = 'active', canUndo = false, busy = false, dragDepth = 0, toastTimer, wheelAt = 0;
const modal = $('#modal');
let modalReturnWidget = false;
async function switchView(view) {setDock(await call('view',view));}
async function call(method, ...args) {
  const result = await bridge[method](...args);
  if (!result.ok) throw new Error(result.error.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
  return result.value;
}
function toast(message, error = false) {
  clearTimeout(toastTimer); document.querySelectorAll('#toast, #widget-toast, .modal-notice').forEach(notice=>notice.hidden=true); let el = $('#toast'); if(document.body.dataset.view==='widget'&&!modal.open){el=$('#widget-toast');if(!el){el=document.createElement('div');el.id='widget-toast';el.setAttribute('role','status');$('#widget').append(el);}} if (modal.open) { el = $('.modal-notice',modal); if (!el) { el=document.createElement('p');el.className='modal-notice';el.setAttribute('role','status');$('.modal-head',modal).after(el); } } el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 6500 : 3200);
}
function visibleTasks() { return state.tasks.filter(t => !t.archived && (document.body.dataset.view!=='widget'||!t.hidden) && (filter === 'done' ? t.status === 'done' : t.status !== 'done')); }
function currentTask() { const tasks = visibleTasks(); return tasks.find(t => t.id === selectedId) || tasks[0]; }
function sync(value) { state = value.state; canUndo = value.canUndo; render(); }
async function command(value, message) {
  const result = await call('command', value); sync(result); if (message) toast(message); return result;
}
function alignCurrentNode(){if(document.body.dataset.view!=='home')return;const scroll = $('.timeline-scroll'), current = $('.node.current'); if (scroll && current) { const offset = current.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop; scroll.scrollTop = Math.max(0, offset - 7); }}
window.addEventListener('resize',()=>requestAnimationFrame(alignCurrentNode));
function setDock(value) {
  document.body.dataset.collapsed = String(!value.expanded); document.body.dataset.side = value.side;
  document.body.dataset.view = value.view || 'widget';
  $('#shell').inert = !value.expanded; $('#widget').inert = !value.expanded;
  if(state)renderStage();if(value.view==='home')requestAnimationFrame(alignCurrentNode);
}
function render() {
  const task = currentTask(); selectedId = task?.id;
  document.body.dataset.reduced = String(state.settings.reducedMotion);
  document.body.dataset.side = state.settings.side;
  $('#pin').setAttribute('aria-pressed', String(state.settings.pinned));
  $('#pin').title = state.settings.pinned ? '取消保持展开' : '保持展开';
  $('#active-count').textContent = state.tasks.filter(t => !t.archived && t.status !== 'done').length;
  $('#done-count').textContent = state.tasks.filter(t => !t.archived && t.status === 'done').length;
  $$('.view-tabs button').forEach(b => { b.classList.toggle('selected', b.dataset.filter === filter); b.setAttribute('aria-pressed', String(b.dataset.filter === filter)); });
  $('#undo').disabled = !canUndo;

  $('#drop-task-label').textContent = task ? task.title : '先创建一条时间线';
  renderStage();
}
function renderStage(direction = 1) {
  $('#stage').dataset.direction = direction < 0 ? 'back' : 'forward';
  const tasks = visibleTasks(), task = currentTask(), stage = $('#stage');
  const activeIndex = task ? tasks.findIndex(t => t.id === task.id) : 0;
  $('#carousel-nav').hidden=tasks.length<2;
  const taskActions={
    select:id=>{selectedId=id;renderStage();$('#drop-task-label').textContent=currentTask()?.title||'';},
    addStep:openAddStep,complete:async()=>{if(busy)return;busy=true;try{const t=currentTask();const result=await call('command',{type:'edit',taskId:t.id,title:t.title,color:t.color,status:'done',nextStep:''});filter='done';sync(result);}catch(error){toast(error.message,true);}finally{busy=false;}},
    record:()=>openEditor('append'),hold:value=>{if(!modal.open)call('hold',value).catch(()=>{});},
    advance:async()=>{if(busy)return;busy=true;try{const t=currentTask();const result=await call('command',t.workflow?{type:'advance',taskId:t.id}:{type:'append',taskId:t.id,title:t.nextStep,nextStep:''});selectedId=t.id;filter=result.state.tasks.find(x=>x.id===t.id).status==='done'?'done':'active';sync(result);toast('流程已推进，可以撤销');}catch(error){toast(error.message,true);}finally{busy=false;}}
  };stage._actions=taskActions;
  renderWidget($('#widget-content'),tasks.filter(t=>!t.hidden),task?.id,state.settings.reducedMotion,taskActions);
  try { localStorage.setItem('flowline-selection',JSON.stringify({id:task?.id,filter})); } catch {}
  if (!task) {
    stage.innerHTML = `<div class="empty-state ${filter === 'done' ? 'empty-done' : ''}"><h2>${filter === 'done' ? '暂无已完成任务' : '暂无任务'}</h2><button class="primary" data-action="${filter === 'done' ? 'back-active' : 'create'}">${filter === 'done' ? '回到进行中' : '创建第一条时间线'}</button></div>`;
    $('#carousel-nav').innerHTML = ''; return;
  }
  const ordered = Array.from({length:Math.min(3, tasks.length)}, (_, i) => tasks[(activeIndex + i) % tasks.length]);
  stage.innerHTML = `<article class="timeline-card active" data-color="${task.color}" aria-label="当前任务：${e(task.title)}">
    <div class="card-head"><div class="card-meta"><span class="status-tag">${statusNames[task.status]}</span></div>
    <div class="card-title-row"><h2 title="${e(task.title)}">${e(task.title)}</h2><button class="icon-button" data-action="edit" aria-label="编辑当前任务" title="编辑任务">${icon('edit')}</button><button class="icon-button task-visibility" data-action="visibility" aria-label="${task.hidden?'在挂件中显示':'从挂件中隐藏'}" title="${task.hidden?'在挂件中显示':'从挂件中隐藏'}" aria-pressed="${task.hidden}">${icon(task.hidden?'eyeOff':'eye')}</button></div>
    </div>
    ${homeTimeline(task)}
    </article>
    ${ordered.slice(1).map((t, i) => `<button class="timeline-card peek ${i === 1 ? 'second' : ''}" data-color="${t.color}" data-select="${t.id}" title="${e(t.title)}" aria-label="切换到：${e(t.title)}"><span class="peek-title">${e(t.title)}</span><span class="peek-track" aria-hidden="true"></span></button>`).join('')}`;
  $('#carousel-nav').innerHTML = `<div class="dots">${tasks.length <= 9 ? tasks.map((t, i) => `<button class="dot ${i === activeIndex ? 'active' : ''}" data-select="${t.id}" aria-label="第 ${i+1} 条：${e(t.title)}" ${i === activeIndex ? 'aria-current="true"' : ''}></button>`).join('') : `<span class="position-label">${activeIndex + 1} / ${tasks.length}</span>`}</div>`;
  requestAnimationFrame(alignCurrentNode);
}
function move(delta) {
  if(document.body.dataset.view==='widget'&&!modal.open){moveWidget($('#widget-content'),delta);return;}
  const tasks = visibleTasks(); if (tasks.length < 2 || modal.open) return;
  const index = tasks.findIndex(t => t.id === selectedId); selectedId = tasks[(index + delta + tasks.length) % tasks.length].id; renderStage(delta);
  $('#drop-task-label').textContent = currentTask().title;
}
function openModal(title, description, content, actions = '') {
  if(document.body.dataset.view==='widget'){modalReturnWidget=true;switchView('home').catch(error=>toast(error.message,true));}
  if (modal.open) modal.close();
  modal.innerHTML = `<header class="modal-head"><h2 id="modal-title">${e(title)}</h2><button class="icon-button" data-close aria-label="关闭">${icon('close')}</button></header>${description ? `<p class="modal-description">${e(description)}</p>` : ''}${content}${actions}`;
  modal.showModal(); call('hold', true).catch(() => {});
}
modal.addEventListener('close', () => { if (!modal.open) { call('hold', false).catch(() => {}); if(modalReturnWidget){modalReturnWidget=false;switchView('widget').catch(()=>{});} } });
modal.addEventListener('click', event => { if (event.target.closest('[data-close]') && !busy) modal.close(); });
modal.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
function openAddStep(){
  const task=currentTask();if(!task)return;
  openModal('添加节点','', '<form id="add-step-form"><div class="modal-body"><label class="field"><span>节点名称</span><input name="title" maxlength="140" required autofocus></label><p id="add-step-error" class="form-error" hidden></p></div><div class="modal-actions"><button type="button" class="secondary" data-close>取消</button><button type="submit" class="primary">添加</button></div></form>');
  $('#add-step-form').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;try{const title=event.target.elements.title.value.trim();const steps=task.workflow?task.workflow.steps.map(s=>s.title):task.nodes.map(n=>n.title).concat(task.nextStep?[task.nextStep]:[]);const current=task.workflow?.current??Math.max(0,task.nodes.length-1);steps.splice(current+1,0,title);const result=await call('command',{type:'edit',taskId:task.id,title:task.title,color:task.color,status:task.status,steps,currentStep:current});sync(result);modal.close();}catch(error){$('#add-step-error').textContent=error.message;$('#add-step-error').hidden=false;}finally{busy=false;}});
}
function statusOptions(status) { return Object.entries(statusNames).map(([value,label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join(''); }
function workflowSelect(task){return task?.workflow?'<label class="field"><span>当前流程步骤</span><select name="currentStep">'+task.workflow.steps.map((step,i)=>'<option value="'+i+'" '+(i===task.workflow.current?'selected':'')+'>'+e(step.title)+'</option>').join('')+'<option value="'+task.workflow.steps.length+'" '+(task.workflow.current===task.workflow.steps.length?'selected':'')+'>全部完成</option></select></label>':'';}
function openEditor(mode = 'create', initialImage = null) {
  const target = currentTask(); if (mode !== 'create' && !target) mode = 'create';
  const editing = mode === 'edit'; let attachment = initialImage; let importing = false;
  const title = editing ? '编辑任务' : mode === 'create' ? '新建任务' : '记录进度';
  const description = '';
  openModal(title, description, `<form id="editor" class="form-content"><div class="modal-body"><p id="form-error" class="form-error" role="alert" hidden></p>
    ${mode === 'append' ? `<label class="field"><span>任务</span><select name="taskId">${state.tasks.filter(t => !t.archived).map(t => `<option value="${t.id}" ${t.id === target.id ? 'selected' : ''}>${e(t.title)}</option>`).join('')}</select></label>` : `<label class="field"><span>任务名称</span><input name="taskTitle" aria-label="任务名称" maxlength="80" required placeholder="比如，完成我的作品集" value="${editing ? e(target.title) : ''}" autofocus></label>`}
    ${!editing ? `<label class="field"><span>${mode === 'create' ? '第一个节点' : '本次进度'}</span><input name="nodeTitle" aria-label="节点内容" maxlength="140" ${mode === 'append' ? 'required' : ''} placeholder="填写当前进展" ${mode === 'append' ? 'autofocus' : ''}></label><label class="field"><span>备注 <small>· 可选</small></span><textarea name="note" aria-label="补充说明" maxlength="2000" rows="2" placeholder="可填写补充说明"></textarea></label><div id="attachment" class="attachment"></div>` : ''}
    <label class="field"><span>下一步 <small>· 可选</small></span><input name="nextStep" aria-label="下一步" maxlength="240" placeholder="填写下一步" value="${mode !== 'create' ? e(target.nextStep) : ''}"></label>
    ${mode !== 'create' ? `<label class="field"><span>任务状态</span><select name="status">${statusOptions(target.status)}</select></label>` : ''}
    ${mode !== 'append' ? `<label class="field"><span>步骤流程 · 每行一步</span><textarea name="workflowSteps" aria-label="流程步骤" rows="5" maxlength="14100" placeholder="每行填写一个步骤">${e(editing?(target.workflow?.steps.map(x=>x.title)||target.nodes.map(n=>n.title).concat(target.nextStep?[target.nextStep]:[])).join('\n'):'')}</textarea></label><label class="field"><span>现在走到哪一步</span><select name="currentStep" id="workflow-current"></select></label><p class="workflow-help">第一个节点和下一步会纳入流程，不必重复填写；首节点留空时使用所选流程步骤。</p>` : `<div id="workflow-progress">${workflowSelect(target)}</div>`}
    ${mode !== 'append' ? colorPicker(editing ? target.color : 'blue') : ''}
    ${editing ? '<button class="quiet danger" type="button" id="archive-task">归档这条时间线</button>' : ''}
    </div><div class="modal-actions"><button class="secondary" type="button" data-close>取消</button><button class="primary" type="submit">${editing ? '保存调整' : mode === 'create' ? '创建时间线' : '保存'}</button></div></form>`);
  const form = $('#editor');
  if(mode==='create'){
    const next=form.elements.nextStep;next.closest('.field').replaceWith(next);next.type='hidden';next.value='';form.elements.currentStep.closest('.field').hidden=true;$('.workflow-help',form)?.remove();
    const extra=document.createElement('details');extra.className='progress-extra';extra.open=Boolean(initialImage);extra.innerHTML='<summary>备注与截图</summary><div class="progress-extra-body"></div>';extra.lastElementChild.append(form.elements.note.closest('.field'),$('#attachment'));$('.modal-body',form).append(extra);
  }
  if(editing){
    const next=form.elements.nextStep;next.closest('.field').replaceWith(next);next.type='hidden';$('.workflow-help',form)?.remove();
    const extra=document.createElement('details');extra.className='progress-extra';extra.innerHTML='<summary>更多选项</summary><div class="progress-extra-body"></div>';extra.lastElementChild.append(form.elements.status.closest('.field'),form.elements.currentStep.closest('.field'),$('#archive-task'));$('.modal-body',form).append(extra);
  }
  if(mode==='append'){
    const extra=document.createElement('details');extra.className='progress-extra';extra.open=Boolean(initialImage);extra.innerHTML='<summary>补充信息</summary><div class="progress-extra-body"></div>';
    const body=extra.lastElementChild;for(const el of [form.elements.note.closest('.field'),$('#attachment'),form.elements.nextStep.closest('.field'),form.elements.status.closest('.field')])body.append(el);
    $('.modal-body',form).append(extra);
  }
  if(mode!=='append'){
    const field=form.elements.workflowSteps, select=form.elements.currentStep;
    const refresh=()=>{const lines=field.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const old=Number(select.value||(editing?(target.workflow?.current??Math.max(0,target.nodes.length-1)):0)||0);select.innerHTML=lines.map((title,i)=>'<option value="'+i+'">第 '+(i+1)+' 步 · '+e(title)+'</option>').join('')+(lines.length?'<option value="'+lines.length+'">全部完成</option>':'<option value="0">未设置流程</option>');select.value=String(Math.min(old,lines.length));select.disabled=!lines.length;};
    refresh();field.addEventListener('input',refresh);
  }

  const formError = error => { $('#form-error').textContent = error.message || String(error); $('#form-error').hidden = false; };
  mountVoice(form,call,formError);
  function renderAttachment() {
    if (editing) return;
    if(attachment&&$('.progress-extra',form))$('.progress-extra',form).open=true;
    $('#attachment').innerHTML = attachment ? `<div class="attachment-preview"><img src="${e(attachment.preview)}" alt="待保存截图"><div><strong>截图已附上</strong><p>与这次进展一起保存</p></div><button class="quiet" id="remove-image" type="button" aria-label="移除截图">移除</button></div><p class="attachment-caption">可识别任务并建议后续步骤。</p>` : '<div class="attachment-tools"><button class="secondary" id="choose-image" type="button">＋ 附上截图</button><button class="secondary" id="paste-image" type="button">粘贴截图</button><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></div><p class="attachment-caption">PNG / JPG / WebP · ≤12 MB</p>';
    if(attachment){const image=attachment;mountVision($('#attachment'),{image,mode:mode==='append'?'append':'create',call,taskId:()=>form.elements.taskId?.value||null,valid:()=>modal.open&&$('#editor')===form&&attachment?.id===image.id,onError:formError,onApply:proposal=>{
      if(mode==='create'){
        form.elements.taskTitle.value=proposal.taskTitle;form.elements.nodeTitle.value=proposal.currentStep;
        form.elements.workflowSteps.value=proposal.steps.map(s=>s.title).join('\n');form.elements.workflowSteps.dispatchEvent(new Event('input'));form.elements.currentStep.value='0';form.elements.nextStep.value=proposal.steps[1]?.title||'';
        form.elements.note.value='截图依据：'+proposal.evidence+'\n后续步骤为 AI 建议，待确认。';
      }else{form.elements.nodeTitle.value=proposal.currentStep;form.elements.note.value='截图依据：'+proposal.evidence;const select=form.elements.currentStep;if(select&&proposal.currentIndex!==null&&Array.from(select.options).some(o=>o.value===String(proposal.currentIndex)))select.value=String(proposal.currentIndex);}
      form.elements.nodeTitle.focus();form.elements.nodeTitle.scrollIntoView({block:'center',behavior:'smooth'});
    }});}
    $('#remove-image')?.addEventListener('click', () => { attachment = null; renderAttachment(); });
    $('#choose-image')?.addEventListener('click', () => $('#image-file').click());
    $('#image-file')?.addEventListener('change', async event => { const file = event.target.files[0]; if (file) await addFile(file); });
    $('#paste-image')?.addEventListener('click', () => loadAttachment(() => call('clipboardImage')));
  }
  async function loadAttachment(loader) {
    if (importing) return; importing=true;
    const submit=$('button[type="submit"]',form); submit.disabled=true;
    try { const image=await loader(); if(modal.open && $('#editor')===form) {attachment=image;renderAttachment();} }
    catch(error) {if(modal.open && $('#editor')===form) formError(error);}
    finally {importing=false;submit.disabled=false;}
  }
  async function addFile(file) {return loadAttachment(() => importFile(file));}
  renderAttachment();
  form.addEventListener('paste', async event => {
    const item = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'));
    if (!editing && item) { event.preventDefault(); await addFile(item.getAsFile()); }
  });
  form.addEventListener('dragover', event => event.preventDefault());
  form.addEventListener('drop', async event => { event.preventDefault(); if (!editing && event.dataTransfer.files[0]) await addFile(event.dataTransfer.files[0]); });
  form.elements.taskId?.addEventListener('change', () => {
    const chosen = state.tasks.find(t => t.id === form.elements.taskId.value);
    form.elements.nextStep.value = chosen.nextStep; form.elements.status.value = chosen.status;$('#workflow-progress').innerHTML=workflowSelect(chosen);
  });
  $('#archive-task')?.addEventListener('click', async () => {
    if (busy) return; busy = true;
    try { await command({ type:'archive', taskId:target.id }, '已归档，可在设置中找回或撤销'); modal.close(); } catch(error) { formError(error); } finally { busy = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || importing) return; busy = true;
    const submit = $('button[type="submit"]', form); submit.disabled = true; submit.textContent = '正在保存…';
    try {
      const values = Object.fromEntries(new FormData(form));
      let cmd;
      if (editing) cmd = { type:'edit', taskId:target.id, title:values.taskTitle, nextStep:values.nextStep, color:values.color, status:values.status };
      else if (mode === 'create') cmd = { type:'create', title:values.taskTitle, nodeTitle:values.nodeTitle, note:values.note, nextStep:values.nextStep, color:values.color, image:attachment?.id };
      else cmd = { type:'append', taskId:values.taskId, title:values.nodeTitle, note:values.note, nextStep:values.nextStep, status:values.status, image:attachment?.id };
      if(mode!=='append'){cmd.steps=values.workflowSteps.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);cmd.currentStep=values.status==='done'?cmd.steps.length:Number(values.currentStep||0);}
      else if(values.currentStep!==undefined){const chosen=state.tasks.find(t=>t.id===cmd.taskId);cmd.currentStep=values.status==='done'?chosen.workflow.steps.length:Number(values.currentStep);}
      const result = await call('command', cmd);
      if (mode === 'create') { selectedId = result.state.tasks[0].id; filter = 'active'; }
      else { selectedId = cmd.taskId; filter = cmd.status === 'done' ? 'done' : 'active'; }
      sync(result); modal.close(); toast(editing ? '调整已保存' : '已保存');
    } catch(error) { formError(error); }
    finally { busy = false; submit.disabled = false; submit.textContent = editing ? '保存调整' : mode === 'create' ? '创建时间线' : '保存'; }
  });
}
async function importFile(file) {
  if (!file || file.size === 0 || file.size > 12 * 1024 * 1024) throw new Error('请使用 12 MB 以内的 PNG、JPG 或 WebP 图片');
  return call('importImage', new Uint8Array(await file.arrayBuffer()));
}
function openSettings() {
  const settings = state.settings;
  openModal('设置', '', `<div class="modal-body">
    <div class="settings-group"><h3>桌面停靠</h3><div class="setting-row"><label>停靠位置</label><div class="segmented"><button data-side="left" class="${settings.side === 'left' ? 'selected' : ''}">左侧</button><button data-side="right" class="${settings.side === 'right' ? 'selected' : ''}">右侧</button></div></div>
    <div class="setting-row"><label for="display-select">显示器</label><select class="settings-select" id="display-select"><option value="">主显示器</option>${metadata.displays.map(d => `<option value="${d.id}" ${settings.displayId === d.id ? 'selected' : ''}>${e(d.label)}</option>`).join('')}</select></div>
    <div class="setting-row"><label for="pin-setting">保持展开<small>关闭后，鼠标离开约 1 秒自动收起</small></label><input type="checkbox" class="switch" id="pin-setting" ${settings.pinned ? 'checked' : ''}></div>
    <div class="setting-row"><label for="motion-setting">减少动态效果<small>保留切换，减少位移和弹性</small></label><input type="checkbox" class="switch" id="motion-setting" ${settings.reducedMotion ? 'checked' : ''}></div></div>
    <div class="settings-group"><h3>记录与备份</h3><p class="settings-note">任务和截图保存在本机。备份包含全部时间线和已关联的截图，换电脑也可以继续。</p><div class="backup-actions"><button class="secondary" id="export-backup">导出备份</button><button class="secondary" id="import-backup">导入备份</button></div><p class="settings-path">${e(metadata.dataDirectory)}</p></div>
    <div class="settings-group"><div class="setting-row"><h3>截图识别</h3><span id="ai-status" class="small-badge">检查中</span></div><p class="settings-note">GLM-4.6V-Flash · 截图仅在你点击识别后发送。</p><label class="field"><span>智谱 API 密钥</span><input id="ai-key" type="password" autocomplete="off" placeholder="留空保留已保存的密钥"></label><div class="backup-actions"><button class="secondary" id="save-ai-key">保存密钥</button><button class="quiet" id="clear-ai-key">移除密钥</button></div></div>
    <div class="settings-group"><h3>归档的时间线</h3>${state.tasks.filter(t => t.archived).map(t => `<div class="archive-row"><span>${e(t.title)}</span><button class="quiet" data-restore="${t.id}">恢复</button></div>`).join('') || '<p class="settings-note">还没有归档。暂时告一段落的事，可以放在这里。</p>'}</div>
    <div class="settings-group"><h3>顺手一点</h3><div class="shortcut-row"><span>展开 / 收起</span><kbd>Ctrl + Shift + Space</kbd></div><div class="shortcut-row"><span>切换时间线</span><kbd>← → / 横向滑动</kbd></div><div class="shortcut-row"><span>新建 / 记录进展</span><kbd>Ctrl + N / Ctrl + Enter</kbd></div><div class="shortcut-row"><span>撤销上次记录操作</span><kbd>Ctrl + Z</kbd></div></div>
    <div class="settings-footer"><span>Flowline · 流线 1.0.0</span><button class="quiet danger" id="quit-app">退出流线</button></div>
    </div><div class="modal-actions"><button class="primary" data-close>就这样，挺好</button></div>`);
  const aiStatus=$('#ai-status');call('aiStatus').then(value=>{if(aiStatus.isConnected)aiStatus.textContent=value.configured?'已配置':'未配置';}).catch(()=>{aiStatus.textContent='读取失败';});
  $('#save-ai-key').onclick=async()=>{const field=$('#ai-key');try{if(!field.value.trim())return;await call('configureAI',field.value);field.value='';aiStatus.textContent='已配置';toast('密钥已加密保存');}catch(error){toast(error.message,true);}};
  $('#clear-ai-key').onclick=async()=>{try{await call('clearAI');aiStatus.textContent='未配置';$('#ai-key').value='';}catch(error){toast(error.message,true);}};
  const save = async update => { try { await command({type:'settings', settings:update}); } catch(error) { toast(error.message,true); } };
  $$('[data-side]', modal).forEach(button => button.addEventListener('click', async () => { await save({side:button.dataset.side}); $$('[data-side]',modal).forEach(b => b.classList.toggle('selected', b.dataset.side === state.settings.side)); }));
  $('#display-select').addEventListener('change', event => save({displayId:event.target.value ? Number(event.target.value) : null}));
  $('#pin-setting').addEventListener('change', event => save({pinned:event.target.checked}));
  $('#motion-setting').addEventListener('change', event => save({reducedMotion:event.target.checked}));
  $('#export-backup').addEventListener('click', async () => { try { const output = await call('exportBackup'); if (output) toast('工作区备份已导出'); } catch(error) { toast(error.message,true); } });
  $('#import-backup').addEventListener('click', async () => { try { const result = await call('importBackup'); if (result) { sync(result); openSettings(); toast('备份已恢复，可撤销'); } } catch(error) { toast(error.message,true); } });
  $$('[data-restore]', modal).forEach(button => button.addEventListener('click', async () => { try { await command({type:'archive',taskId:button.dataset.restore,archived:false},'时间线已恢复'); openSettings(); } catch(error) { toast(error.message,true); } }));
  $('#quit-app').addEventListener('click', () => call('quit'));
}
async function undo() { if (!canUndo || busy || modal.open) return; try { sync(await call('undo')); toast('已撤销上一次记录操作'); } catch(error) { toast(error.message,true); } }
function clearDrag() { dragDepth = 0; $('#drop-overlay').hidden = true; $$('.drop-zone').forEach(zone => zone.classList.remove('over')); if (!modal.open) call('hold', false).catch(() => {}); }
async function start() {
  if (!bridge) { $('#stage').innerHTML = '<div class="empty-state"><h2>请从桌面程序打开流线</h2><p>双击项目中的启动文件即可使用。</p></div>'; return; }
  metadata = await call('load'); state = metadata.state; canUndo = metadata.canUndo;
  try { const saved=JSON.parse(localStorage.getItem('flowline-selection')); selectedId=saved?.id; filter=saved?.filter==='done'?'done':'active'; } catch {}
  $('#pin').innerHTML = icon('pin'); $('#settings').innerHTML = icon('settings'); $('#collapse').innerHTML = icon('collapse');
  setDock(metadata.dock); bridge.onDock(setDock); render();
  if (metadata.warning) toast(metadata.warning,true);
  const closeCreateMenu=()=>{$('#widget-create-menu').hidden=true;$('#widget-create').setAttribute('aria-expanded','false');if(!modal.open)call('hold',false).catch(()=>{});};
  $('#widget-create').addEventListener('click',()=>{const opening=$('#widget-create-menu').hidden;$('#widget-create-menu').hidden=!opening;$('#widget-create').setAttribute('aria-expanded',String(opening));call('hold',opening).catch(()=>{});});
  $('#widget-create-manual').addEventListener('click',()=>{closeCreateMenu();openEditor('create');});
  $('#widget-create-image').addEventListener('click',()=>{closeCreateMenu();openEditor('create');const area=$('#attachment');if(area.closest('details'))area.closest('details').open=true;area.querySelector('.attachment-caption').textContent='附上目标窗口截图后，可识别任务并规划步骤。';area.scrollIntoView({block:'center'});$('#choose-image').focus({preventScroll:true});});
  document.addEventListener('click',event=>{if(!$('#widget-create-menu').hidden&&!event.target.closest('.widget-create'))closeCreateMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#widget-create-menu').hidden){closeCreateMenu();$('#widget-create').focus();}});
  $('#widget-home').addEventListener('click',()=>{modalReturnWidget=false;switchView('home').catch(error=>toast(error.message,true));});
  $('#new-task').addEventListener('click', () => openEditor());
  bindHomeActions($('#stage'));
  $('#settings').addEventListener('click', openSettings); $('#collapse').addEventListener('click', () => call('collapse'));
  $('#pin').addEventListener('click', async () => { try { await command({type:'settings',settings:{pinned:!state.settings.pinned}}, state.settings.pinned ? '已恢复自动收起' : '已固定展开'); } catch(error) { toast(error.message,true); } });
  $('#undo').addEventListener('click', undo);
  document.addEventListener('click', async event => {
    const select = event.target.closest('[data-select]'); if (select) { selectedId = select.dataset.select; render(); }
    const mover = event.target.closest('[data-move]'); if (mover) move(Number(mover.dataset.move));
    const tab = event.target.closest('[data-filter]'); if (tab) { filter = tab.dataset.filter; selectedId = null; render(); }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'create') openEditor();
    if(action==='visibility'&&!busy){busy=true;try{const t=currentTask();await command({type:'visibility',taskId:t.id,hidden:!t.hidden});}catch(error){toast(error.message,true);}finally{busy=false;}}
    if (action === 'edit') openEditor('edit');
    if (action === 'history') $('.timeline-scroll')?.scrollTo({top:0,behavior:state.settings.reducedMotion ? 'instant' : 'smooth'});
    if (action === 'back-active') { filter = 'active'; render(); }
    if (action === 'demo') { try { await command({type:'demo'}, '已载入 4 条示例，可随时撤销'); } catch(error) { toast(error.message,true); } }
    const image = event.target.closest('[data-image]');
    if (image) { try { const source = await call('getImage',image.dataset.image); openModal('截图','',`<div class="modal-body"><img class="image-view" src="${e(source)}" alt="任务节点截图"></div><div class="modal-actions"><button class="primary" data-close>关闭</button></div>`); } catch(error) { toast(error.message,true); } }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') clearDrag();
    if (modal.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); openEditor(); }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (currentTask()) openEditor('append'); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });
  $('#stage').addEventListener('wheel', event => {
    const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (Math.abs(amount) < 8) return; event.preventDefault();
    if (Date.now() - wheelAt > 420) { move(amount > 0 ? 1 : -1); wheelAt = Date.now(); }
  }, {passive:false});
  let pointerStart;
  $('#stage').addEventListener('pointerdown', event => { pointerStart = {x:event.clientX,y:event.clientY}; });
  $('#stage').addEventListener('pointerup', event => { if (!pointerStart) return; const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)*1.5) move(dx < 0 ? 1 : -1); pointerStart = null; });
  document.addEventListener('dragenter', event => { if (modal.open || !event.dataTransfer.types.includes('Files')) return; event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; call('hold',true).catch(() => {}); });
  document.addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    if (modal.open) return;
    const zone = event.target.closest('.drop-zone'); $$('.drop-zone').forEach(z => z.classList.toggle('over', z === zone));
  });
  document.addEventListener('dragleave', event => { if (modal.open) return; if (--dragDepth <= 0 || !event.relatedTarget) clearDrag(); });
  document.addEventListener('drop', async event => {
    event.preventDefault(); if (modal.open) return;
    const mode = event.target.closest('[data-drop]')?.dataset.drop; const files = [...event.dataTransfer.files]; clearDrag();
    if (!mode) return;
    if (files.length !== 1) { toast('一次放入一张截图，让每个节点更清晰',true); return; }
    try { await call('hold',true); const image = await importFile(files[0]); openEditor(mode,image); }
    catch(error) { toast(error.message,true); call('hold',false).catch(() => {}); }
  });
  document.addEventListener('dragend',clearDrag);
  window.addEventListener('blur', () => { if (!modal.open && !$('#drop-overlay').hidden) clearDrag(); });
}
start().catch(error => { $('#stage').innerHTML = `<div class="empty-state"><h2>暂时无法读取记录</h2><p>${e(error.message)}</p></div>`; });
