const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../web');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
function server(){return http.createServer((req,res)=>{
 let name;
 try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(error,data)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache'});
  res.end(req.method==='HEAD'?undefined:data);
 });
});}
module.exports={server};
if(require.main===module){const port=Number(process.env.PORT||8766);server().listen(port,'127.0.0.1',()=>console.log(`Bible Story Puzzle: http://127.0.0.1:${port}`));}
