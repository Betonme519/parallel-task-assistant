const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const directory=path.join(root,'work',`performance-${Date.now()}`);await fs.mkdir(directory,{recursive:true});
  const env={...process.env,FLOWLINE_TEST:'1',FLOWLINE_DATA_DIR:path.join(directory,'data')};delete env.ELECTRON_RUN_AS_NODE;
  const started=performance.now();
  const app=await electron.launch({executablePath:path.join(root,'release-public/Flowline-win32-x64/Flowline.exe'),args:[],env});
  try {
    const page=await app.firstWindow();await page.waitForSelector('#stage h2');const startupMs=Math.round(performance.now()-started);
    await page.getByRole('button',{name:'先看看示例 →'}).click();await page.waitForSelector('.timeline-card');
    await page.waitForTimeout(2500);await app.evaluate(({app})=>app.getAppMetrics());await page.waitForTimeout(2500);
    const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,cpuPercent:p.cpu.percentCPUUsage,workingSetKB:p.memory.workingSetSize})));
    const result={startupMs,metrics,totalWorkingSetMB:Math.round(metrics.reduce((s,p)=>s+p.workingSetKB,0)/1024),note:'One local instrumented run; working sets include shared pages and are not unique RAM. CPU sampled while expanded, with test driver attached.'};
    await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));console.log('Evidence:',directory);
  } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
