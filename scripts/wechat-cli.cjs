const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),cli=process.env.WECHAT_IDE_CLI||'D:/微信开发者工具/微信web开发者工具/wechatide.cmd';
fs.mkdirSync(path.join(root,'work'),{recursive:true});
let n=0;
function call(tool,options={}){
  const args=['-c','codex',tool];
  if(!['automation_generate_script'].includes(tool))args.push('--project',root.replaceAll('\\','/'));
  for(const [k,v] of Object.entries(options)){
    if(v===undefined)continue;
    if(k.endsWith('-file')&&typeof v!=='string'){
      const p=path.join(root,'work',`qa-args-${process.pid}-${++n}.json`);fs.writeFileSync(p,JSON.stringify(v));args.push('--'+k,p);
    }else args.push('--'+k,String(v));
  }
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  const script=path.join(root,'work',`qa-cli-${process.pid}.ps1`);
  fs.writeFileSync(script,"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()\n& "+quote(cli)+' '+args.map(quote).join(' '));
  const r=cp.spawnSync('powershell.exe',['-NoProfile','-Command',fs.readFileSync(script,'utf8')],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,windowsHide:true});
  if(r.error)throw r.error;
  const start=r.stdout.indexOf('{');if(start<0)throw Error(r.stdout+r.stderr);
  const out=JSON.parse(r.stdout.slice(start));
  if(!out.ok||out.result?.success===false)throw Error(tool+': '+JSON.stringify(out));
  let result=out.result?.data??out.result?.result??out.result;
  if(tool==='automation_evaluate'&&result&&Object.hasOwn(result,'result'))result=result.result;
  return result;
}
const data=k=>call('automation_page_action',{action:'getData','data-path':k});
const method=(name,...args)=>call('automation_page_action',{action:'callMethod',method:name,'args-file':args});
const evaluate=(source,...args)=>call('automation_evaluate',{'fn-source':source,'args-file':args});
module.exports={root,call,data,method,evaluate};
