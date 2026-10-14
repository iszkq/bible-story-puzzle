'use strict';
const Shared=require('./shared');
const loaded={};
function invoke(method,args){return new Promise((resolve,reject)=>wx[method]({...args,success:resolve,fail:reject}));}
const fsCall=(method,args)=>new Promise((resolve,reject)=>wx.getFileSystemManager()[method]({...args,success:resolve,fail:reject}));
async function persistent(path,suffix='jpg'){
  const target=wx.env.USER_DATA_PATH+'/puzzle-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+suffix;
  await fsCall('copyFile',{srcPath:path,destPath:target});return target;
}
async function scene(story){
  if(story.custom)return story.image;
  const packageName='artworks-'+String.fromCharCode(97+Math.floor((story.id-1)/2));
  if(!loaded[packageName]){await invoke('loadSubpackage',{name:packageName});loaded[packageName]=true;}
  return '/'+packageName+'/assets/'+Shared.sceneNames[story.id-1]+'.jpg';
}
function thumb(story){return story.custom?story.image:'/assets/'+Shared.sceneNames[story.id-1]+'.jpg';}
const node=(page,selector)=>new Promise((resolve,reject)=>wx.createSelectorQuery().in(page).select(selector).fields({node:true,size:true}).exec(results=>{if(!results[0]||!results[0].node)reject(Error('画布未准备好，请重试。'));else resolve(results[0]);}));
const image=(canvas,src)=>new Promise((resolve,reject)=>{const img=canvas.createImage();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法读取，请重新选择或重试。'));img.src=src;});
function drawScene(ctx,img,item,width,height){
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#e5e5ea';ctx.fillRect(0,0,width,height);
  const sw=img.width,sh=img.height;
  if(item.fit==='contain'){const s=Math.min(width/sw,height/sh),w=sw*s,h=sh*s;ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);return;}
  const s=Math.max(width/sw,height/sh)*Number(item.zoom),w=sw*s,h=sh*s;
  ctx.drawImage(img,-(w-width)*Number(item.x)/100,-(h-height)*Number(item.y)/100,w,h);
}
async function processScene(page,item){
  const key=JSON.stringify([item.source,item.fit,Number(item.x),Number(item.y),Number(item.zoom)]);
  if(item.image&&item.sceneKey===key)return item.image;
  const {node:canvas}=await node(page,'#crop-cache');
  canvas.width=1600;canvas.height=1200;const img=await image(canvas,item.source);
  drawScene(canvas.getContext('2d'),img,item,1600,1200);
  const result=await invoke('canvasToTempFilePath',{canvas,fileType:'jpg',quality:.92,width:1600,height:1200,destWidth:1600,destHeight:1200});
  const path=await persistent(result.tempFilePath);
  item.image=path;item.sceneKey=key;
  return path;
}
async function cropPreview(page,item){
  const {node:canvas,width}=await node(page,'#crop-preview');
  const dpr=wx.getWindowInfo().pixelRatio||1;canvas.width=width*dpr;canvas.height=width*.75*dpr;
  const img=await image(canvas,item.source),ctx=canvas.getContext('2d');
  drawScene(ctx,img,item,canvas.width,canvas.height);
  const {cols,rows}=Shared.gridFor(item.difficulty);
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=dpr;
  for(let i=1;i<cols;i++){ctx.beginPath();ctx.moveTo(i*canvas.width/cols,0);ctx.lineTo(i*canvas.width/cols,canvas.height);ctx.stroke();}
  for(let i=1;i<rows;i++){ctx.beginPath();ctx.moveTo(0,i*canvas.height/rows);ctx.lineTo(canvas.width,i*canvas.height/rows);ctx.stroke();}
}
module.exports={invoke,persistent,scene,thumb,node,image,drawScene,processScene,cropPreview};
