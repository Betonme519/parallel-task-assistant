const {execFile}=require('node:child_process');
async function startVoice(win,{testMode=false}={}){
 if(process.platform!=='win32')throw new Error('此语音入口需要 Windows；也可以使用系统输入法语音');
 if(testMode)return {status:'test',method:'Windows+H'};
 if(!win.isFocused())win.focus();
 const handle=win.getNativeWindowHandle().readBigUInt64LE().toString();
 const code=`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class FlowlineVoice{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e);}';if([FlowlineVoice]::GetForegroundWindow().ToInt64() -ne ${handle}){exit 2};[FlowlineVoice]::keybd_event(0x5B,0,0,[UIntPtr]::Zero);[FlowlineVoice]::keybd_event(0x48,0,0,[UIntPtr]::Zero);[FlowlineVoice]::keybd_event(0x48,0,2,[UIntPtr]::Zero);[FlowlineVoice]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)`;
 await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,timeout:12000},error=>error?reject(new Error('请点击文本框后按 Win + H 开启语音输入')):resolve()));
 return {status:'opened',method:'Windows+H'};
}
module.exports={startVoice};
