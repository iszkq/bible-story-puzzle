'use strict';
const Shared = require('./shared');
function createMedia(wx, redraw) {
  const cache = new Map(), packages = new Set(), covers=new Map();
  const invoke = (method, args) => new Promise((resolve, reject) => wx[method]({...args, success:resolve, fail:reject}));
  const fsCall = (method, args) => new Promise((resolve, reject) => wx.getFileSystemManager()[method]({...args, success:resolve, fail:reject}));
  function image(src) {
    if (cache.has(src)) { const entry=cache.get(src);cache.delete(src);cache.set(src,entry);return entry.promise; }
    const img=wx.createImage(),entry={img:null,promise:null};
    entry.promise=new Promise((resolve,reject)=>{img.onload=()=>{entry.img=img;resolve(img);redraw();};img.onerror=()=>{cache.delete(src);reject(Error('图片读取失败，请返回后重试。'));};});
    cache.set(src,entry);img.src=src;
    while(cache.size>30)cache.delete(cache.keys().next().value);
    return entry.promise;
  }
  function peek(src) { const e=cache.get(src);return e&&e.img; }
  function thumb(story) { return story.custom ? story.image : 'assets/'+Shared.sceneNames[story.id-1]+'.jpg'; }
  async function scene(story) {
    if(story.custom)return story.image;
    const pack='artworks-'+String.fromCharCode(97+Math.floor((story.id-1)/2));
    if(!packages.has(pack)){await invoke('loadSubpackage',{name:pack});packages.add(pack);}
    return pack+'/assets/'+Shared.sceneNames[story.id-1]+'.jpg';
  }
  function cover(story){
    const key=story.id+':'+(story.image||'');if(covers.has(key))return covers.get(key);
    covers.set(key,null);scene(story).then(image).then(img=>{covers.set(key,img);while(covers.size>4)covers.delete(covers.keys().next().value);redraw();}).catch(()=>{});return null;
  }
  async function persistent(path) {
    const ext=(/\.(png|jpe?g|webp)$/i.exec(path)||[])[1]||'jpg';
    const dest=wx.env.USER_DATA_PATH+'/puzzle-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
    await fsCall('copyFile',{srcPath:path,destPath:dest});return dest;
  }
  function drawScene(ctx,img,item,w,h) {
    ctx.fillStyle='#e5e5ea';ctx.fillRect(0,0,w,h);
    const scale=(item.fit==='contain'?Math.min(w/img.width,h/img.height):Math.max(w/img.width,h/img.height)*Number(item.zoom));
    const dw=img.width*scale,dh=img.height*scale;
    ctx.drawImage(img,item.fit==='contain'?(w-dw)/2:-(dw-w)*Number(item.x)/100,item.fit==='contain'?(h-dh)/2:-(dh-h)*Number(item.y)/100,dw,dh);
  }
  async function process(item) {
    const key=JSON.stringify([item.source,item.fit,Number(item.x),Number(item.y),Number(item.zoom)]);
    if(item.image&&item.sceneKey===key)return item.image;
    const img=await image(item.source),canvas=wx.createCanvas();canvas.width=1600;canvas.height=1200;
    drawScene(canvas.getContext('2d'),img,item,1600,1200);
    const path=await new Promise((resolve,reject)=>canvas.toTempFilePath({fileType:'jpg',quality:.92,destWidth:1600,destHeight:1200,success:r=>resolve(r.tempFilePath),fail:reject}));
    item.image=await persistent(path);item.sceneKey=key;return item.image;
  }
  return {invoke,image,peek,thumb,scene,cover,persistent,process,drawScene};
}
module.exports={createMedia};
