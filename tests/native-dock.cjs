const { _electron: electron } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const evidence = path.join(root,'work',`native-${Date.now()}`);
const results=[];
let desktop, page, original;
function moveCursor(point) {
  // Move only; never click or type into other applications. Restore in finally.
  const code = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class FlowlineCursor { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); }'; [FlowlineCursor]::SetCursorPos(${Math.round(point.x)},${Math.round(point.y)})`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,stdio:'pipe',timeout:10000});
}
const check=name=>{results.push({name,status:'passed'});console.log('PASS',name);};
async function waitCollapsed(value) { await page.waitForFunction(value=>document.body.dataset.collapsed === String(value),value,{timeout:8000}); }
async function main() {
  await fs.mkdir(evidence,{recursive:true});
  const env={...process.env,FLOWLINE_TEST:'0',FLOWLINE_DATA_DIR:path.join(evidence,'data')}; delete env.ELECTRON_RUN_AS_NODE;
  desktop=await electron.launch({executablePath:path.join(root,'release-public/Flowline-win32-x64/Flowline.exe'),args:[],env});
  page=await desktop.firstWindow(); await page.waitForSelector('#widget-home');
  const initial=await desktop.evaluate(({screen,BrowserWindow})=>({point:screen.getCursorScreenPoint(),bounds:BrowserWindow.getAllWindows()[0].getBounds(),area:screen.getPrimaryDisplay().workArea})); original=initial.point;
  await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];globalThis.mouseIgnores=[];const original=w.setIgnoreMouseEvents.bind(w);w.setIgnoreMouseEvents=(ignore,options)=>{globalThis.mouseIgnores.push(ignore);return original(ignore,options);};});
  const outside={x:initial.area.x+Math.floor(initial.area.width/2),y:initial.area.y+40};
  moveCursor(outside); await waitCollapsed(true); check('Real pointer exit automatically collapses packaged app');
  assert.equal(await desktop.evaluate(()=>globalThis.mouseIgnores.at(-1)),true); check('Collapsed transparent window releases mouse events');
  moveCursor({x:initial.bounds.x+initial.bounds.width-3,y:initial.bounds.y+initial.bounds.height/2});
  await waitCollapsed(false); assert.equal(await desktop.evaluate(()=>globalThis.mouseIgnores.at(-1)),false); check('Real Windows cursor hovering right edge expands');
  await page.evaluate(()=>window.flowline.command({type:'settings',settings:{side:'left'}}));
  const left=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()); assert.equal(left.x,initial.area.x);
  moveCursor(outside); await waitCollapsed(true); moveCursor({x:left.x+3,y:left.y+left.height/2}); await waitCollapsed(false); check('Real Windows cursor hovering left edge expands');
  await page.keyboard.press('Control+n'); moveCursor(outside); await page.waitForTimeout(2100); assert.equal(await page.locator('body').getAttribute('data-collapsed'),'false'); check('Editing hold prevents accidental collapse');
  await page.keyboard.press('Escape'); await waitCollapsed(true);
  await page.evaluate(()=>window.flowline.command({type:'settings',settings:{pinned:true}})); await waitCollapsed(false); await page.waitForTimeout(2100); assert.equal(await page.locator('body').getAttribute('data-collapsed'),'false'); check('Pinned panel stays open after pointer leaves');
  await page.screenshot({path:path.join(evidence,'native-left.png')});
}
main().catch(error=>{console.error(error);results.push({name:'Run failed',status:'failed',detail:error.stack});process.exitCode=1;})
.finally(async()=>{if(original)moveCursor(original);if(desktop)await desktop.close().catch(()=>{});await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({results},null,2));console.log('Evidence:',evidence);});
