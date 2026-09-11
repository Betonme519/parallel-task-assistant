import {escape as e,icon} from './ui.js';
import {workflowRows} from './reel.js';
export function homeTimeline(task){
 const rows=workflowRows(task);
 return '<div class="timeline-scroll home-flow" tabindex="0" aria-label="完整任务流程">'+rows.map((row,index)=>{
  const current=row.status==='current',node=current?task.nodes.at(-1):task.nodes.findLast(n=>n.title===row.title);
  const detail=node&&(node.note||node.image)?'<details class="home-node-detail"><summary>备注与截图</summary>'+(node.note?'<p class="node-note">'+e(node.note)+'</p>':'')+(node.image?'<button class="node-image" data-image="'+e(node.image)+'" aria-label="查看截图：'+e(row.title)+'">'+icon('image')+' 查看截图</button>':'')+'</details>':'';
  return '<div class="node home-node '+row.status+'">'+(current?'<button class="node-dot home-node-trigger" type="button" aria-label="节点操作" title="节点操作"></button><div class="home-node-actions">'+(index<rows.length-1?'<button type="button" data-home-action="advance" aria-label="下一步" title="下一步">'+icon('next')+'</button><button type="button" data-home-action="complete" aria-label="完成任务" title="完成任务">'+icon('check')+'</button>':'')+'<button type="button" data-home-action="addStep" aria-label="添加节点" title="添加节点">'+icon('plus')+'</button></div>':'<span class="node-dot"></span>')+'<div class="home-step-box"><p class="node-title">'+e(row.title)+'</p>'+detail+'</div></div>';
 }).join('')+'</div>';
}
export function bindHomeActions(stage){
 const close=()=>stage.querySelectorAll('.home-actions-open').forEach(el=>el.classList.remove('home-actions-open'));
 let x,y;
 stage.addEventListener('pointermove',event=>{const moved=x!==event.clientX||y!==event.clientY;x=event.clientX;y=event.clientY;if(!moved)return;const row=event.target.closest('.home-node.current');if(row&&event.target.closest('.home-node-trigger')){close();row.classList.add('home-actions-open');}else if(!(row&&event.target.closest('.home-node-actions')&&row.classList.contains('home-actions-open')))close();});
 stage.addEventListener('pointerleave',()=>{close();x=y=undefined;});stage.addEventListener('wheel',close,{passive:true});
 stage.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible'))event.target.closest('.home-node.current')?.classList.add('home-actions-open');});
 stage.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('.home-actions-open'))close();});
 stage.addEventListener('click',event=>{const action=event.target.closest('[data-home-action]')?.dataset.homeAction;if(action){close();stage._actions?.[action]?.();}});
}
