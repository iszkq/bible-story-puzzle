const {server}=require('./serve.cjs'),{spawn}=require('child_process'),path=require('path');
const host=server();
async function run(file){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'../tests',file)],{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${file} failed (${code})`)));});}
host.listen(8766,'127.0.0.1',async()=>{
 try{await run('creator.cjs');await run('grid-crop.cjs');await run('mobile.cjs');}
 catch(e){console.error(e);process.exitCode=1;}
 finally{host.close();}
});
