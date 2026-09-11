const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), directory=path.join(root,'work',`ui-races-${Date.now()}`), results=[];
let app;
(async()=>{
  await fs.mkdir(directory,{recursive:true});const env={...process.env,FLOWLINE_TEST:'1',FLOWLINE_DATA_DIR:path.join(directory,'data')};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:path.join(root,'release-public/Flowline-win32-x64/Flowline.exe'),args:[],env});const page=await app.firstWindow();await page.waitForSelector('#stage h2');const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const image=(await page.screenshot()).toString('base64');
  await app.evaluate(({clipboard,ClipboardItem},image)=>{clipboard.read=async()=>{await new Promise(r=>setTimeout(r,600));return [new ClipboardItem({'image/png':new Blob([Buffer.from(image,'base64')],{type:'image/png'})})];};},image);
  await page.locator('#new-task').click();await page.locator('#paste-image').click();await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('#new-task').click();await page.waitForTimeout(900);
  assert.equal(await page.locator('.attachment-preview').count(),0);assert.equal(await page.locator('#editor').count(),1);results.push({name:'Late image after cancellation does not attach to a new form',status:'passed'});
  await app.evaluate(({clipboard})=>{clipboard.read=async()=>{await new Promise(r=>setTimeout(r,600));throw new Error('Delayed clipboard fixture failure');};});
  await page.locator('#paste-image').click();await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('#new-task').click();await page.waitForTimeout(900);
  assert.equal(await page.locator('#form-error').isVisible(),false);assert.equal(errors.length,0);results.push({name:'Late failed import does not corrupt another form or throw',status:'passed'});
})().catch(error=>{console.error(error);results.push({name:'Run failed',status:'failed',detail:error.stack});process.exitCode=1;}).finally(async()=>{if(app)await app.close();await fs.writeFile(path.join(directory,'results.json'),JSON.stringify({results},null,2));console.log(results);console.log('Evidence:',directory);});
