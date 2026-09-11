const fs=require('node:fs/promises'),path=require('node:path');
class Credentials{
 constructor(directory,safeStorage){this.file=path.join(directory,'ai-credentials.json');this.crypto=safeStorage;}
 async get(){if(process.env.FLOWLINE_GLM_API_KEY)return process.env.FLOWLINE_GLM_API_KEY;try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));return this.crypto.decryptString(Buffer.from(data.encrypted,'base64'));}catch(error){if(error.code==='ENOENT')return '';throw new Error('无法读取已保存的密钥，请重新配置');}}
 async status(){try{return {configured:Boolean(await this.get()),model:'glm-4.6v-flash'};}catch{return {configured:false,model:'glm-4.6v-flash'};}}
 async save(key){if(typeof key!=='string'||key.length>512||!key.trim())throw new Error('请输入有效密钥');if(!this.crypto.isEncryptionAvailable())throw new Error('系统加密不可用，暂时不能保存密钥');await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(this.file,JSON.stringify({encrypted:this.crypto.encryptString(key.trim()).toString('base64')}));return this.status();}
 async clear(){await fs.rm(this.file,{force:true});return this.status();}
}
module.exports={Credentials};
