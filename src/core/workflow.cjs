const {randomUUID}=require('node:crypto');
function validateWorkflow(value) {
  if(value==null)return null;
  if(!Array.isArray(value.steps)||!value.steps.length||value.steps.length>100)throw new Error('流程需要 1–100 个步骤');
  const ids=new Set();
  const steps=value.steps.map(step=>{
    if(typeof step.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(step.id)||ids.has(step.id))throw new Error('流程步骤标识无效');
    ids.add(step.id);
    if(typeof step.title!=='string'||!step.title.trim()||step.title.length>140)throw new Error('步骤名称需要 1–140 个字符');
    return {id:step.id,title:step.title.trim()};
  });
  if(!Number.isInteger(value.current)||value.current<0||value.current>steps.length)throw new Error('当前流程步骤无效');
  return {steps,current:value.current};
}
function setWorkflow(task, titles, current) {
  if(!Array.isArray(titles)||titles.length>100)throw new Error('最多支持 100 个流程步骤');
  if(!titles.length){task.workflow=null;return;}
  const old=task.workflow?.steps||[], used=new Set();
  const steps=titles.map(title=>{const match=old.find(s=>s.title===title&&!used.has(s.id));const id=match?.id||randomUUID();used.add(id);return{id,title};});
  task.workflow=validateWorkflow({steps,current:current??0});
  syncWorkflowStatus(task);
}
function syncWorkflowStatus(task) {
  if(!task.workflow)return;
  const {steps,current}=task.workflow;
  if(current===steps.length){task.status='done';task.nextStep='';}
  else {if(task.status==='done')task.status='active';task.nextStep=steps[current+1]?.title||'';}
}
module.exports={validateWorkflow,setWorkflow,syncWorkflowStatus};
