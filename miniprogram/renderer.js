'use strict';
const Shared=require('./shared'),Media=require('./media');
function paintPiece(ctx,img,id,count,x,y,cw,ch){
  const {cols,rows}=Shared.gridFor(count),col=id%cols,row=Math.floor(id/cols);
  ctx.save();ctx.translate(x,y);ctx.scale(cw/100,ch/100);
  Shared.drawPath(ctx,id,count);ctx.clip();ctx.drawImage(img,-col*100,-row*100,cols*100,rows*100);ctx.restore();
  ctx.save();ctx.translate(x,y);ctx.scale(cw/100,ch/100);Shared.drawPath(ctx,id,count);ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.6;ctx.stroke();ctx.restore();
}
class Renderer{
  constructor(page){this.page=page;this.serial=0;this.atlasKey='';}
  async init(src,count){
    const serial=++this.serial,{node:canvas}=await Media.node(this.page,'#board');
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.img=await Media.image(canvas,src);
    if(serial!==this.serial)return;
    const key=src+':'+count;
    if(key!==this.atlasKey){
      const {node:cache}=await Media.node(this.page,'#piece-cache'),cols=4,rows=Math.ceil(count/cols),size=144;
      cache.width=cols*size;cache.height=rows*size;const ctx=cache.getContext('2d'),img=await Media.image(cache,src);
      ctx.clearRect(0,0,cache.width,cache.height);
      for(let id=0;id<count;id++)paintPiece(ctx,img,id,count,(id%4)*size+22,Math.floor(id/4)*size+22,100,100);
      const result=await Media.invoke('canvasToTempFilePath',{canvas:cache,fileType:'png',width:cache.width,height:cache.height,destWidth:cache.width,destHeight:cache.height});
      if(serial!==this.serial)return;
      this.atlasKey=key;this.page.setData({atlas:result.tempFilePath,atlasRows:rows});
    }
    if(serial===this.serial)this.draw();
  }
  draw(){
    if(!this.ctx||!this.img)return;
    const page=this.page,c=page.store.state.current;if(!c)return;
    const dpr=wx.getWindowInfo().pixelRatio||1,w=page.data.boardWidth,h=w*.75;
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    const ctx=this.ctx;ctx.scale(dpr,dpr);
    ctx.fillStyle=page.data.dark?'#1c1c1e':'#fff';ctx.fillRect(0,0,w,h);
    const {cols,rows}=Shared.gridFor(c.count),cw=w/cols,ch=h/rows;
    ctx.strokeStyle=page.data.dark?'#38383a':'#c6c6c8';ctx.lineWidth=1;
    for(let i=0;i<=cols;i++){ctx.beginPath();ctx.moveTo(i*cw,0);ctx.lineTo(i*cw,h);ctx.stroke();}
    for(let i=0;i<=rows;i++){ctx.beginPath();ctx.moveTo(0,i*ch);ctx.lineTo(w,i*ch);ctx.stroke();}
    for(const id of c.placed){if(page.drag&&page.drag.active&&page.drag.id===id)continue;const p=c.positions[id],x=(p.slot%cols)*cw,y=Math.floor(p.slot/cols)*ch;paintPiece(ctx,this.img,id,c.count,x,y,cw,ch);if(page.data.selected===id){ctx.strokeStyle=page.data.dark?'#0a84ff':'#007aff';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,cw-2,ch-2);}}
  }
  hit(x,y){
    const c=this.page.store.state.current,{cols,rows}=Shared.gridFor(c.count),cw=this.page.data.boardWidth/cols,ch=this.page.data.boardWidth*.75/rows;
    const hit=wx.createOffscreenCanvas({type:'2d',width:144,height:144}).getContext('2d');
    for(const id of [...c.placed].reverse()){const p=c.positions[id];Shared.drawPath(hit,id,c.count);if(hit.isPointInPath((x-(p.slot%cols)*cw)/cw*100,(y-Math.floor(p.slot/cols)*ch)/ch*100))return id;}
    return null;
  }
  dispose(){this.serial++;this.ctx=null;this.img=null;}
}
module.exports=Renderer;
