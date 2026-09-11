import {escape as e,icon} from './ui.js';
export function mountVision(host,{image,mode,taskId,call,valid,onApply,onError}){
 const panel=document.createElement('div');panel.className='vision-panel';panel.innerHTML='<label class="field"><span>关注的任务 <small>· 可选</small></span><input class="vision-hint" maxlength="800" placeholder="画面有多件事时，说明你想跟进哪一件"></label><button type="button" class="secondary vision-run">识别并规划</button><p class="attachment-caption">仅在点击后将此图发给智谱；建议裁剪到目标窗口。</p><div class="vision-result" role="status"></div>';host.append(panel);
 const button=panel.querySelector('.vision-run'),result=panel.querySelector('.vision-result');
 button.onclick=async()=>{button.disabled=true;button.textContent='正在识别…';result.textContent='';try{
  const requestedTask=taskId();const value=await call('analyze',{imageId:image.id,mode,taskId:requestedTask,hint:panel.querySelector('.vision-hint').value});if(!valid()||!panel.isConnected||taskId()!==requestedTask)return;
  if(value.status!=='ready'){result.textContent=value.message;return;}
  const p=value.proposal;if(p.needsClarification){result.innerHTML='<p class="vision-question">'+e(p.question)+'</p>';return;}
  result.innerHTML='<div class="vision-facts"><small>截图识别</small><strong>'+e(p.taskTitle)+'</strong><p>'+e(p.currentStep)+'</p><details><summary>查看依据</summary><p>'+e(p.evidence)+'</p></details></div>'+(mode==='create'?'<div class="vision-suggestions"><small>建议后续步骤 · 可修改</small><ol>'+p.steps.slice(1).map(s=>'<li>'+e(s.title)+'</li>').join('')+'</ol></div>':'<p class="attachment-caption">更新当前记录，保留原有流程。</p>')+'<button type="button" class="primary vision-apply">填入表单</button>';
  result.querySelector('.vision-apply').onclick=()=>{if(valid()&&taskId()===requestedTask){onApply(p);result.innerHTML='<p>已填入表单，请检查后保存。</p>';}};
 }catch(error){if(valid()&&panel.isConnected)onError(error);}finally{if(panel.isConnected){button.disabled=false;button.textContent='重新识别';}}};
}
export function mountVoice(form,call,onError){
 const bar=document.createElement('div');bar.className='voice-tools';bar.innerHTML=`<button type="button" class="voice-start" aria-label="语音输入" title="语音输入 · Windows 听写">${icon('mic')}</button><span class="voice-status" role="status"></span>`;
 form.querySelector('.modal-actions').prepend(bar);let target=form.querySelector('input:not([type=radio]):not([type=file]),textarea');
 form.addEventListener('focusin',event=>{if(event.target.matches('textarea,input:not([type=radio]):not([type=file]):not([type=checkbox])'))target=event.target;});
 const button=bar.querySelector('button');button.onmousedown=event=>event.preventDefault();button.onclick=async()=>{if(!target)return;target.focus();button.disabled=true;try{await call('startVoice');if(form.isConnected)bar.querySelector('.voice-status').textContent='请在系统听写面板中说话';}catch(error){onError(error);}finally{button.disabled=false;}};
}
