import {escape as e,icon} from './ui.js';
const modulo=(n,length)=>((n%length)+length)%length;
export function workflowRows(task){
  if(task.workflow){const w=task.workflow;return w.steps.map((s,i)=>({title:s.title,status:i<w.current?'complete':i===w.current?'current':'pending',advance:i===w.current}));}
  const rows=task.nodes.map((n,i)=>({title:n.title,status:task.status==='done'||i<task.nodes.length-1?'complete':'current'}));
  if(task.nextStep&&task.status!=='done')rows.push({title:task.nextStep,status:'pending'});
  return rows;
}
class TimelineReel {
  constructor(root){
    this.root=root;this.tasks=[];this.position=0;this.target=0;this.velocity=0;this.callbacks={};this.reduced=false;this.raf=0;this.pointer=null;this.scrolls=new Map();
    root.innerHTML='<div class="widget-title"></div><div class="widget-caption"></div><div class="reel-meta"></div><div class="reel-viewport"><div class="reel-scene"></div><button class="reel-side-target previous" aria-label="上一条时间线"></button><button class="reel-side-target next" aria-label="下一条时间线"></button></div>';
    this.viewport=root.querySelector('.reel-viewport');this.scene=root.querySelector('.reel-scene');this.columns=Array.from({length:5},()=>{const el=document.createElement('article');el.className='reel-column';this.scene.append(el);return el;});
    root.querySelector('.previous').onclick=()=>this.step(-1);root.querySelector('.next').onclick=()=>this.step(1);
    this.viewport.addEventListener('wheel',event=>{this.closeActions();this.wheel(event);},{passive:false});
    this.viewport.addEventListener('pointerdown',event=>this.down(event));
    this.viewport.addEventListener('pointermove',event=>{const moved=this.hoverX!==event.clientX||this.hoverY!==event.clientY;this.hoverX=event.clientX;this.hoverY=event.clientY;this.drag(event);if(this.raf||this.pointer?.drag||!moved)return;const row=event.target.closest('.focused .reel-step.current');const dot=event.target.closest('.reel-step.current > i');const menu=event.target.closest('.step-actions');if(row&&dot){this.closeActions();row.classList.add('actions-open');}else if(!(row&&menu&&row.classList.contains('actions-open')))this.closeActions();});
    this.viewport.addEventListener('pointerleave',()=>this.closeActions());
    this.viewport.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible'))event.target.closest('.focused .reel-step.current')?.classList.add('actions-open');});
    this.viewport.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('.actions-open'))this.closeActions();});
    this.viewport.addEventListener('pointerup',event=>this.up(event));
    this.viewport.addEventListener('pointercancel',event=>this.up(event,true));
    this.viewport.addEventListener('click',event=>{
      if(Date.now()<(this.suppressClick||0)){event.preventDefault();event.stopImmediatePropagation();return;}
      if(event.target.closest('[data-advance]'))this.callbacks.advance?.();
      else if(event.target.closest('[data-complete]'))this.callbacks.complete?.();
      else if(event.target.closest('[data-add-step]'))this.callbacks.addStep?.();
      else if(event.target.closest('[data-record]'))this.callbacks.record?.();
    },true);
  }
  closeActions(){this.root.querySelectorAll('.actions-open').forEach(el=>el.classList.remove('actions-open'));}
  update(tasks,id,reduced,callbacks){
    const signature=JSON.stringify(tasks);
    this.callbacks=callbacks||this.callbacks;this.reduced=reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(signature!==this.signature){
      cancelAnimationFrame(this.raf);this.raf=0;this.snap=null;for(const t of tasks){const old=this.tasks.find(x=>x.id===t.id);if(old&&(old.workflow?.current!==t.workflow?.current||old.nodes.length!==t.nodes.length))this.scrolls.delete(t.id);}this.tasks=tasks;this.signature=signature;
      this.position=Math.max(0,tasks.findIndex(t=>t.id===id));this.target=this.position;this.velocity=0;
      this.columns.forEach(el=>{el.dataset.key='';});this.paint();return;
    }
    const index=tasks.findIndex(t=>t.id===id);
    if(index>=0&&!this.raf&&!this.pointer&&modulo(Math.round(this.position),tasks.length)!==index){this.position=index;this.target=index;this.paint();}
  }
  fill(el,task){
    const rows=workflowRows(task);
    el.innerHTML=`<div class="reel-step-scroll" tabindex="-1" aria-label="全部流程步骤">${rows.map((row,i)=>`<div class="reel-step ${row.status}"><i aria-hidden="true"></i><div class="reel-step-copy"><span class="step-state">${row.status==='complete'?'已完成':row.status==='current'?'当前进行':'待进行'}</span><button class="step-title" data-record title="${e(row.title)}">${e(row.title)}</button>${row.status==='current'?`<div class="step-actions">${i<rows.length-1?`<button data-advance title="下一步" aria-label="下一步">${icon('next')}</button><button data-complete title="完成任务" aria-label="完成任务">${icon('check')}</button>`:''}<button data-add-step title="添加节点" aria-label="添加节点">${icon('plus')}</button></div>`:''}</div></div>`).join('')}</div>`;
    el.dataset.task=task.id;el.dataset.color=task.color;
    const scroll=el.firstElementChild;
    scroll.addEventListener('scroll',()=>{if(!el.inert)this.scrolls.set(task.id,scroll.scrollTop);});
    requestAnimationFrame(()=>{
      if(el.dataset.task!==task.id)return;
      const current=scroll.querySelector('.current');
      scroll.scrollTop=this.scrolls.get(task.id)??Math.max(0,(current?.offsetTop||0)-scroll.clientHeight*.35);
    });
  }
  paint(){
    const n=this.tasks.length;this.viewport.dataset.position=this.position.toFixed(4);
    this.root.querySelectorAll('.reel-side-target').forEach(b=>b.disabled=n<2);
    if(!n){this.columns.forEach(el=>el.hidden=true);this.root.querySelector('.widget-title').textContent='流线';this.root.querySelector('.widget-caption').hidden=false;this.root.querySelector('.widget-caption').textContent='点主页，创建一条流程';this.root.querySelector('.reel-meta').textContent='';return;}
    const nearest=Math.round(this.position);const task=this.tasks[modulo(nearest,n)];
    const rows=workflowRows(task),w=task.workflow;
    this.root.querySelector('.widget-title').textContent=task.title;this.root.querySelector('.widget-title').title=task.title;
    this.root.querySelector('.widget-caption').hidden=true;
    this.root.querySelector('.reel-meta').textContent=w?`${Math.min(w.current+1,w.steps.length)} / ${w.steps.length} 步 · ${w.current} 步已完成`:`${rows.length} 个节点`;
    const base=Math.floor(this.position);
    for(let i=base-2;i<=base+2;i++){
      const el=this.columns[modulo(i,5)],distance=i-this.position,angle=Math.max(-1.42,Math.min(1.42,distance*1.08));
      if(n===1&&i!==nearest){el.hidden=true;continue;}el.hidden=false;
      const t=this.tasks[modulo(i,n)],key=`${i}:${t.id}:${t.updatedAt}:${t.workflow?.current}`;
      if(el.dataset.key!==key){this.fill(el,t);el.dataset.key=key;}
      const x=Math.sin(angle)*112,z=(Math.cos(angle)-1)*110;
      el.style.transform=`translateX(${x}px) translateZ(${z}px) rotateY(${-angle*180/Math.PI}deg)`;
      el.style.opacity=String(Math.max(.08,1-Math.abs(distance)*.73));
      el.style.zIndex=String(10-Math.round(Math.abs(distance)*3));
      el.style.setProperty('--details',String(Math.max(0,1-Math.abs(distance)*2.3)));
      el.inert=Math.abs(distance)>.43;el.setAttribute('aria-hidden',String(el.inert));el.classList.toggle('focused',!el.inert);
    }
  }
  animate(){
    if(this.raf)return;let last=performance.now();
    const tick=now=>{
      if(this.snap){const progress=Math.min(1,(now-this.snap.at)/180);this.position=this.snap.from+(this.target-this.snap.from)*(1-Math.pow(1-progress,3));if(progress===1){this.position=this.target;this.snap=null;this.velocity=0;this.raf=0;this.paint();this.commit();return;}this.paint();this.raf=requestAnimationFrame(tick);return;}
      const dt=Math.min(.032,(now-last)/1000);last=now;
      this.velocity+=(this.target-this.position)*190*dt;this.velocity*=Math.exp(-24*dt);this.position+=this.velocity*dt;
      if(Math.abs(this.target-this.position)<.001&&Math.abs(this.velocity)<.015){this.position=this.target;this.velocity=0;this.raf=0;this.paint();this.commit();return;}
      this.paint();this.raf=requestAnimationFrame(tick);
    };this.raf=requestAnimationFrame(tick);
  }
  commit(){if(this.tasks.length)this.callbacks.select?.(this.tasks[modulo(Math.round(this.position),this.tasks.length)].id);this.callbacks.hold?.(false);}
  step(delta){this.closeActions();if(this.tasks.length<2)return;clearTimeout(this.wheelTimer);this.wheelGesture=null;this.snap=null;this.target=Math.round(this.target)+delta;this.callbacks.hold?.(true);if(this.reduced){this.position=this.target;this.paint();this.commit();}else this.animate();}
  wheel(event){
    if(this.tasks.length<2)return;
    const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.shiftKey;
    const scroll=event.target.closest('.reel-step-scroll');
    if(!horizontal&&scroll&&scroll.scrollHeight>scroll.clientHeight+2)return;
    const amount=(horizontal?(event.deltaX||event.deltaY):event.deltaY)*(event.deltaMode===1?16:1);if(!amount)return;
    event.preventDefault();
    if(Math.abs(amount)<3&&this.lastWheelStrong&&performance.now()-this.lastWheelStrong<650)return;
    if(Math.abs(amount)>=3)this.lastWheelStrong=performance.now();
    this.snap=null;this.callbacks.hold?.(true);
    if(this.reduced){clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>this.step(Math.sign(amount)),100);return;}
    const increment=Math.max(-.3,Math.min(.3,amount/280));this.target=Math.max(this.position-.9,Math.min(this.position+.9,this.target+increment));this.animate();clearTimeout(this.wheelTimer);
    this.wheelTimer=setTimeout(()=>{this.target=Math.round(this.target);this.wheelGesture=null;this.snap={from:this.position,at:performance.now()};this.velocity=0;this.animate();},85);
  }
  down(event){if(event.button!==0||this.tasks.length<2)return;this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,pos:this.position,lastX:event.clientX,lastT:performance.now(),speed:0,drag:false};}
  drag(event){
    const p=this.pointer;if(!p||p.id!==event.pointerId)return;
    const dx=event.clientX-p.x,dy=event.clientY-p.y;
    if(!p.drag){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){this.pointer=null;return;}if(Math.abs(dx)<6)return;p.drag=true;this.closeActions();this.snap=null;cancelAnimationFrame(this.raf);this.raf=0;clearTimeout(this.wheelTimer);this.wheelGesture=null;this.viewport.setPointerCapture(event.pointerId);this.callbacks.hold?.(true);}
    event.preventDefault();const now=performance.now();p.speed=(event.clientX-p.lastX)/Math.max(1,now-p.lastT);p.lastX=event.clientX;p.lastT=now;
    this.position=p.pos-dx/190;this.target=this.position;this.velocity=0;this.paint();
  }
  up(event,cancelled=false){
    const p=this.pointer;if(!p||p.id!==event.pointerId)return;this.pointer=null;
    if(p.drag){this.suppressClick=Date.now()+250;if(this.viewport.hasPointerCapture(event.pointerId))this.viewport.releasePointerCapture(event.pointerId);
      const speed=performance.now()-p.lastT<100?p.speed:0;this.target=Math.round(this.position+(cancelled?0:Math.max(-.65,Math.min(.65,-speed*.14))));
      if(this.reduced){this.position=this.target;this.paint();this.commit();}else this.animate();}
  }
}
export function renderWidget(element,tasks,id,reduced,callbacks){if(!element._reel)element._reel=new TimelineReel(element);element._reel.update(tasks,id,reduced,callbacks);}
export function moveWidget(element,delta){element._reel?.step(delta);}
