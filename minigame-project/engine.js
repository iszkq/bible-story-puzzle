'use strict';
const Shared=require('./shared'),{createStore}=require('./store'),{createMedia}=require('./media');
function createApp(wx) {
  const canvas=wx.createCanvas(),ctx=canvas.getContext('2d'),store=createStore(wx);
  let info,width,height,dpr,top,bottom,colors;
  const ui={screen:store.state.current||store.state.sets.length?'home':'welcome',tab:'stories',scroll:0,id:1,count:12,setID:null,itemID:null,selected:null,preview:false,previewZoom:1,previewX:0,previewY:0,adjusting:false,busy:false,message:store.warning,image:null,hits:[],board:null,tray:null,contentBottom:0,clip:null,touch:null};
  const media=createMedia(wx,draw);let loadSerial=0,inputCallback=null;
  const audio={};
  function resize(){
    info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();width=info.windowWidth;height=info.windowHeight;dpr=Math.min(info.pixelRatio||1,3);
    const safe=info.safeArea||{top:0,bottom:height};let menu;
    try{menu=wx.getMenuButtonBoundingClientRect&&wx.getMenuButtonBoundingClientRect();}catch(e){}
    top=Math.max(safe.top||0,menu&&menu.bottom?menu.bottom+8:28);bottom=Math.max(16,height-(safe.bottom||height));
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    theme((wx.getSystemInfoSync().theme)||'light');
  }
  function theme(value){colors=value==='dark'?{bg:'#000000',surface:'#1c1c1e',text:'#ffffff',muted:'#aeaeb2',accent:'#0a84ff',border:'#38383a',selected:'#18304c'}:{bg:'#f2f2f7',surface:'#ffffff',text:'#111111',muted:'#6e6e73',accent:'#007aff',border:'#c6c6c8',selected:'#dcecff'};}
  function text(value,x,y,size=15,color=colors.text,align='left',bold=false){
    ctx.fillStyle=color;ctx.font=(bold?'600 ':'')+size+'px system-ui, sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);
  }
  function wrap(value,x,y,w,size=17,color=colors.text){
    ctx.font=size+'px sans-serif';let line='';
    for(const char of String(value||'')){if(char==='\n'||ctx.measureText(line+char).width>w){text(line,x,y,size,color);y+=size*1.55;line=char==='\n'?'':char;}else line+=char;}
    if(line){text(line,x,y,size,color);y+=size*1.55;}return y;
  }
  function short(value,w,size=15){ctx.font=size+'px sans-serif';let s=String(value);while(s.length&&ctx.measureText(s).width>w)s=s.slice(0,-1);return s===String(value)?s:s.slice(0,-1)+'…';}
  function box(x,y,w,h,fill=colors.surface,stroke=null,r=12){
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function hit(x,y,w,h,label,fn,extra={}){
    let a=y,b=y+h;if(ui.clip){a=Math.max(a,ui.clip.y);b=Math.min(b,ui.clip.y+ui.clip.h);}if(b>a)ui.hits.push({x,y:a,w,h:b-a,label,fn,...extra});
  }
  function button(label,x,y,w,fn,primary=false,selected=false){const h=primary?52:44;box(x,y,w,h,primary?colors.accent:selected?colors.selected:colors.surface,primary||selected?colors.accent:'#8e8e93');text(short(label,w-16,primary?17:15),x+w/2,y+h/2,primary?17:15,primary?'#fff':selected?colors.accent:colors.text,'center',primary);hit(x,y,w,h,label,fn);}
  function action(label,x,y,w,fn,color=colors.accent,align='center'){text(label,align==='left'?x:align==='right'?x+w:x+w/2,y+22,14,color,align);hit(x,y,w,44,label,fn);}
  function line(x,y,w,color=colors.border){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();}
  function picture(src,x,y,w,h,r=16){box(x,y,w,h);const img=media.peek(src);if(img){ctx.save();box(x,y,w,h,colors.surface,null,r);ctx.clip();ctx.drawImage(img,x,y,w,h);ctx.restore();}else media.image(src).catch(()=>{});}
  function mainPicture(x,y,w,h){if(ui.image){ctx.save();box(x,y,w,h,colors.surface,null,16);ctx.clip();ctx.drawImage(ui.image,x,y,w,h);ctx.restore();}else box(x,y,w,h);}
  function row(label,y,fn,value=''){button(short(label,width-170),16,y,width-32,fn);if(value)text(short(value,120),width-28,y+22,13,colors.muted,'right');return y+52;}
  function notice(message){ui.message=String(message||'');draw();}
  async function run(fn){if(ui.busy)return;ui.busy=true;ui.message='';draw();try{await fn();}catch(e){ui.message=e.message||e.errMsg||'操作失败，请重试。';}finally{ui.busy=false;draw();}}
  function save(){store.save();}
  function safeSave(){try{save();return true;}catch(e){notice(e.message);return false;}}
  function feedback(complete=false){
    if(store.state.settings.haptic&&wx.vibrateShort)wx.vibrateShort({type:'light',fail(){}});
    if(store.state.settings.sound&&wx.createInnerAudioContext){try{const key=complete?'complete':'place';if(!audio[key]){audio[key]=wx.createInnerAudioContext();audio[key].src='assets/'+key+'.wav';audio[key].obeyMuteSwitch=true;}audio[key].seek(0);audio[key].play();}catch(e){}}
  }
  async function confirm(content){const r=await media.invoke('showModal',{title:'请确认',content,confirmText:'继续',cancelText:'取消'});return r.confirm;}
  function go(screen){ui.screen=screen;ui.scroll=0;ui.message='';ui.selected=null;ui.preview=false;ui.adjusting=false;draw();}
  function header(title,back){if(back){action('返回',16,top,44,back,colors.text,'left');text(short(title,width-144,16),width/2,top+22,16,colors.text,'center',true);}else{picture('assets/icon.png',16,top+8,28,28,7);text(title,52,top+22,16,colors.text,'left',true);action('设置',width-60,top,44,()=>go('settings'),colors.text,'right');}}
  function footer(label,fn){ctx.fillStyle=colors.bg;ctx.fillRect(0,height-bottom-64,width,bottom+64);button(label,16,height-bottom-56,width-32,fn,true);}
  function listStart(){ui.clip={y:top+52,h:height-bottom-64-(top+52)-8};ctx.save();ctx.beginPath();ctx.rect(0,ui.clip.y,width,ui.clip.h);ctx.clip();return ui.clip.y+8-ui.scroll;}
  function listEnd(y){ui.contentBottom=Math.max(0,y+ui.scroll-(top+64));ctx.restore();ui.clip=null;}
  function storyLabel(story){return story.custom||store.state.completed.includes(story.id)?story.title:'故事 '+String(story.id).padStart(2,'0');}
  function thumbnail(story,x,y,w,h){const cover=w>180?media.cover(story):null;if(cover){ctx.save();box(x,y,w,h,colors.surface,null,16);ctx.clip();ctx.drawImage(cover,x,y,w,h);ctx.restore();}else picture(media.thumb(story),x,y,w,h,w>180?16:10);}
  async function loadStory(id){
    ui.id=id;ui.image=null;const serial=++loadSerial,story=store.story(id);if(!story)throw Error('找不到这幅图片。');
    const src=await media.scene(story),img=await media.image(src);if(serial===loadSerial)ui.image=img;
  }
  function prepare(id){run(async()=>{go('prepare');ui.count=store.story(id).difficulty||12;await loadStory(id);});}
  function detail(id){run(async()=>{await loadStory(id);go('detail');});}
  function preview(){ui.preview=true;ui.previewZoom=1;ui.previewX=ui.previewY=0;draw();}
  function drawWelcome(){
    let y=top+24-ui.scroll;ui.clip={y:top,h:height-top-bottom-64};ctx.save();ctx.beginPath();ctx.rect(0,top,width,ui.clip.h);ctx.clip();
    text('拾光拼图册',16,y,13,colors.muted);y+=28;picture('assets/welcome.jpg',16,y,width-32,(width-32)*.75);y+=(width-32)*.75+32;
    y=wrap('拼出画面，\n发现故事。',16,y,width-32,24)+8;y=wrap('把碎片放回画框，认一认画面中的人物，把喜欢的故事收进画册。',16,y,width-32,17,colors.muted)+12;
    action('浏览故事',16,y,width-32,()=>go('home'));y+=56;listEnd(y);footer('开始第一个故事',()=>prepare(1));
  }
  function drawHome(){
    header(ui.tab==='stories'?'拾光拼图册':ui.tab==='sets'?'我的故事集':'我的收藏');let y=listStart();
    if(ui.tab==='stories'){
      text('今天，拼一个故事。',16,y+20,24,colors.text,'left',true);y+=56;
      const c=store.state.current,s=c?store.story(c.storyID):Shared.stories.find(s=>!store.state.completed.includes(s.id))||Shared.stories[0],h=(width-32)*.75;
      thumbnail(s,16,y,width-32,h);hit(16,y,width-32,h,'故事 '+s.id,()=>prepare(s.id));y+=h+28;
      text(storyLabel(s),16,y,15,colors.text,'left',true);text(c?c.placed.length+'/'+c.count+'块':'12块起',width-16,y,13,colors.muted,'right');y+=26;
      text(c?'进度已保存，随时继续。':'从画面中的线索，认识一个人物。',16,y,13,colors.muted);y+=26;
      button(c?'继续拼图':'开始下一个故事',16,y,width-32,()=>c?run(async()=>{await loadStory(c.storyID);go('play');}):prepare(s.id),true);y+=88;
      text('故事篇章',16,y+22,19,colors.text,'left',true);action('查看全部',width-96,y,80,()=>go('list'),'#007aff','right');y+=50;line(16,y,width-32);
      text('第一辑 · 发现与旅程',16,y+26,15);text('已完成'+store.state.completed.filter(id=>Number.isInteger(id)).length+'/24个故事',16,y+52,13,colors.muted);text('›',width-24,y+40,18,colors.muted);hit(16,y,width-32,72,'故事篇章',()=>go('list'));y+=88;
    }else if(ui.tab==='sets'){
      y=wrap('把自己的图片，\n拼成故事。',16,y+20,width-32,24)+12;y=wrap('照片、插画或读经主题，都可以成为一集。',16,y,width-32,13,colors.muted)+16;
      button('创建图片集',16,y,width-32,()=>run(async()=>{if(store.state.draft&&!(await confirm('打开新的草稿将替换未保存的草稿。')))return;store.draft();go('editset');}),true);y+=60;
      if(store.state.draft){button('继续编辑草稿',16,y,width-32,()=>go('editset'));y+=60;}
      if(!store.state.sets.length)y=wrap('导入自己的图片，配上文字，也可以设置一道题目。内容保存在本机。',16,y+16,width-32,17,colors.muted)+20;
      for(const set of store.state.sets){const item=set.items.find(i=>i.id===set.coverID)||set.items[0],s=store.story(item.version);thumbnail(s,16,y,96,72);text(short(set.name,width-144),128,y+25,17);text(set.items.length+'幅图片',128,y+54,13,colors.muted);hit(16,y,width-32,80,set.name,()=>{ui.setID=set.id;go('set');});y+=88;}
    }else{
      const stories=store.state.collected.map(id=>store.story(id)).filter(Boolean);
      text('把故事收进画册。',16,y+20,24,colors.text,'left',true);y+=56;text('收藏 '+stories.length+'幅 · 已发现 '+store.state.completed.length+'个故事',16,y,13,colors.muted);y+=32;
      if(!stories.length)y=wrap('还没有收藏。\n拼完后，把喜欢的图片收进这里。',16,y+20,width-32,17,colors.muted);
      const w=(width-44)/2,h=w*.75,cell=h+76;
      stories.forEach((s,i)=>{const x=16+(i%2)*(w+12),py=y+Math.floor(i/2)*cell;thumbnail(s,x,py,w,h);text(short(s.person,w,15),x,py+h+22,15,colors.text,'left',true);text(short(s.title,w,13),x,py+h+46,13,colors.muted);hit(x,py,w,cell-8,s.title,()=>detail(s.id));});y+=Math.ceil(stories.length/2)*cell;
    }
    listEnd(y);ctx.fillStyle=colors.surface;ctx.fillRect(0,height-bottom-52,width,bottom+52);line(0,height-bottom-52,width);['stories','sets','collection'].forEach((tab,i)=>{const w=width/3;action(['故事','图片集','收藏'][i],i*w,height-bottom-48,w,()=>{ui.tab=tab;go('home');},ui.tab===tab?colors.accent:colors.muted);});
  }
  function drawList(){header('故事篇章',()=>go('home'));let y=listStart();text('发现与旅程',16,y+20,24,colors.text,'left',true);y+=60;y=wrap('24个画面，24个故事。拼完一幅，发现一个故事。',16,y,width-32,15,colors.muted)+12;
    for(const story of Shared.stories){const complete=store.state.completed.includes(story.id),locked=story.id>1&&!store.state.completed.includes(story.id-1);thumbnail(story,16,y+12,84,63);text(storyLabel(story),114,y+32,16,colors.text,'left',true);text(complete?'已发现 · 查看故事':locked?'完成前一个故事后开启':'可拼 · 12/24/48块',114,y+59,13,colors.muted);text(locked?'锁定':'›',width-24,y+44,locked?11:18,colors.muted,'right');hit(16,y,width-32,96,'故事 '+story.id,()=>complete?detail(story.id):locked?notice('先完成上一个故事，再开启这一幅。'):prepare(story.id));y+=96;line(16,y,width-32);}listEnd(y);}
  function drawDetail(){const s=store.story(ui.id);header('故事详情',()=>go('home'));let y=listStart(),h=(width-32)*.75;mainPicture(16,y,width-32,h);hit(16,y,width-32,h,'查看完整图片',preview);y+=h+36;text(s.person,16,y,24,colors.text,'left',true);y+=36;y=wrap(s.title,16,y,width-32,19)+16;y=wrap(s.summary,16,y,width-32,17)+12;line(16,y,width-32);y+=24;y=wrap('出处：'+s.ref,16,y,width-32,14,colors.muted)+16;button('查看大图',16,y,width-32,preview);y+=56;button(store.state.collected.includes(s.id)?'取消收藏':'收藏这幅图',16,y,width-32,()=>run(async()=>{const a=store.state.collected,i=a.indexOf(s.id);if(i<0)a.push(s.id);else a.splice(i,1);save();}));y+=60;listEnd(y);footer('重新拼这幅画',()=>prepare(s.id));}
  function drawPrepare(){
    const s=store.story(ui.id);header(storyLabel(s),()=>go('list'));let y=listStart();text(storyLabel(s),16,y+20,24,colors.text,'left',true);y+=52;
    const h=(width-32)*.75;mainPicture(16,y,width-32,h);hit(16,y,width-32,h,'查看完整图片',preview);y+=h+30;
    y=wrap('拼完画面后，猜一猜其中的人物。',16,y,width-32,17,colors.muted)+16;text('拼片数量',16,y,19,colors.text,'left',true);y+=24;
    [12,24,48].forEach((n,i)=>{const w=(width-48)/3,x=16+i*(w+8),g=Shared.gridFor(n);box(x,y,w,66,ui.count===n?colors.selected:colors.surface,ui.count===n?colors.accent:'#8e8e93');text(['轻松','标准','困难'][i]+' · '+n+'块',x+w/2,y+22,14,colors.text,'center');text(g.cols+'列 × '+g.rows+'行',x+w/2,y+47,11,colors.muted,'center');hit(x,y,w,66,n+'块',()=>{ui.count=n;draw();});});y+=90;
    y=wrap('随时暂停，自动保存。对照原图自由摆放，提交后才判断。',16,y,width-32,13,colors.muted)+12;button('查看完整图片',16,y,width-32,preview);y+=60;listEnd(y);
    footer('开始拼图',()=>run(async()=>{if(store.state.current&&!(await confirm('开始新拼图会替换当前进行中的进度。')))return;store.start(ui.id,ui.count);go('play');}));
  }
  function paintPiece(img,id,count,x,y,cw,ch){
    const {cols,rows}=Shared.gridFor(count);ctx.save();ctx.translate(x,y);ctx.scale(cw/100,ch/100);Shared.drawPath(ctx,id,count);ctx.clip();ctx.drawImage(img,-(id%cols)*100,-Math.floor(id/cols)*100,cols*100,rows*100);ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.scale(cw/100,ch/100);Shared.drawPath(ctx,id,count);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.7;ctx.stroke();ctx.restore();
  }
  function backPlay(){run(async()=>{if(store.state.current&&store.state.current.trial){store.endTrial();go('editimage');}else{save();go('home');}});}
  function drawPlay(){
    const c=store.state.current;if(!c){go('home');return;}if(c.phase!=='puzzle'){drawResult(c);return;}
    action('关闭',16,top,44,backPlay,colors.text,'left');text((c.trial?'试玩':storyLabel(store.story(c.storyID)))+' · '+c.count+'块',width/2,top+22,16,colors.text,'center',true);action('暂停',width-60,top,44,()=>{ui.message='进度已保存在本机，随时可以继续。';safeSave();draw();},colors.text,'right');
    let y=listStart();text('已摆放 '+c.placed.length+'/'+c.count,16,y+12,15);text('摆放时不判对错',width-16,y+12,13,colors.muted,'right');y+=32;box(16,y,width-32,3,colors.border,null,0);if(c.placed.length)box(16,y,(width-32)*c.placed.length/c.count,3,colors.accent,null,0);y+=8;
    action('查看原图',16,y,72,preview,colors.accent,'left');action(c.zoom?'适合画框':'放大棋盘',width-88,y,72,()=>{c.zoom=!c.zoom;c.panX=c.panY=0;safeSave();draw();},colors.accent,'right');
    if(c.zoom)action(c.panMode?'继续摆放':'浏览棋盘',width/2-40,y,80,()=>{c.panMode=!c.panMode;safeSave();draw();});else if(ui.selected!==null)action('调整拼片',width/2-40,y,80,()=>{ui.adjusting=true;draw();});y+=44;
    const cellH=54,bw=width-32,bh=bw*.75,viewport={x:16,y,w:bw,h:bh},grid=Shared.gridFor(c.count),scale=c.zoom?Math.max(2,grid.cols*44/bw,grid.rows*44/bh):1;
    c.panX=Math.max(-(bw*(scale-1)),Math.min(0,c.panX||0));c.panY=Math.max(-(bh*(scale-1)),Math.min(0,c.panY||0));
    const b={x:viewport.x+c.panX,y:y+c.panY,w:bw*scale,h:bh*scale};ui.board={...b,viewport};
    const g=Shared.gridFor(c.count),cw=b.w/g.cols,ch=b.h/g.rows;
    box(viewport.x,y,bw,bh);ctx.save();ctx.beginPath();ctx.rect(viewport.x,y,bw,bh);ctx.clip();
    ctx.strokeStyle=colors.border;ctx.lineWidth=1;
    for(let col=0;col<=g.cols;col++){ctx.beginPath();ctx.moveTo(b.x+col*cw,b.y);ctx.lineTo(b.x+col*cw,b.y+b.h);ctx.stroke();}
    for(let row=0;row<=g.rows;row++){ctx.beginPath();ctx.moveTo(b.x,b.y+row*ch);ctx.lineTo(b.x+b.w,b.y+row*ch);ctx.stroke();}
    if(ui.image)for(const id of c.placed){if(ui.touch&&ui.touch.active&&ui.touch.piece===id)continue;const p=c.positions[id],px=b.x+(p.slot%g.cols)*cw,py=b.y+Math.floor(p.slot/g.cols)*ch;paintPiece(ui.image,id,c.count,px,py,cw,ch);if(ui.selected===id){ctx.strokeStyle=colors.accent;ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,cw-2,ch-2);}}
    ctx.restore();
    const ids=c.trayOrder.filter(id=>!c.positions[id]);y+=bh+8;text('碎片托盘 · 剩余 '+ids.length,16,y+16,13,colors.text,'left',true);text('拖回这里可取下',width-16,y+16,11,colors.muted,'right');y+=32;
    const ty=y,tw=(width-40)/4;ui.tray={x:16,y:ty,w:width-32,h:cellH*4+8,maxScroll:Math.max(0,Math.ceil(ids.length/4)*cellH-cellH*4)};c.trayScroll=Math.max(0,Math.min(ui.tray.maxScroll,c.trayScroll||0));
    box(16,ty,width-32,ui.tray.h,colors.bg,colors.border,8);ctx.save();ctx.beginPath();ctx.rect(20,Math.max(ty+4,ui.clip.y),width-40,Math.max(0,Math.min(ty+ui.tray.h-4,ui.clip.y+ui.clip.h)-Math.max(ty+4,ui.clip.y)));ctx.clip();const listClip=ui.clip;ui.clip={y:Math.max(ty+4,listClip.y),h:Math.max(0,Math.min(ty+ui.tray.h-4,listClip.y+listClip.h)-Math.max(ty+4,listClip.y))};
    ids.forEach((id,i)=>{
      const x=20+(i%4)*tw,py=ty+4+Math.floor(i/4)*cellH-c.trayScroll;
      if(py+cellH<ui.clip.y||py>ui.clip.y+ui.clip.h)return;
      if(ui.selected===id)box(x+2,py+2,tw-4,cellH-4,colors.selected,colors.accent,8);
      const ph=38,pw=ph*(g.rows/g.cols)/.75;if(ui.image&&!(ui.touch&&ui.touch.active&&ui.touch.piece===id))paintPiece(ui.image,id,c.count,x+(tw-pw)/2,py+(cellH-ph)/2,pw,ph);
      hit(x,py,tw,cellH,'拼片',()=>{ui.selected=id;draw();},{piece:id});
    });
    ctx.restore();ui.clip=listClip;y+=ui.tray.h+18;text('全部碎片 · 上下滚动查看更多',16,y,12,colors.muted);y+=28;listEnd(y);
    footer('提交拼图',()=>run(async()=>{const result=store.submit();if(result==='correct'){ui.selected=null;ui.scroll=0;feedback(true);}else notice(result==='incomplete'?'先把碎片摆满，再提交。':'还有位置需要调整。');}));
    if(ui.touch&&ui.touch.active&&ui.touch.piece!==null&&ui.image){const pw=cw,ph=ch;paintPiece(ui.image,ui.touch.piece,c.count,ui.touch.x-pw/2,ui.touch.y-ph/2,pw,ph);}
    if(ui.adjusting){ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,width,height);ui.hits=[];box(0,height-bottom-180,width,bottom+180,colors.surface,null,24);text('调整已选拼片',20,height-bottom-154,17,colors.text,'left',true);const w=(width-32)/5;['取下','←','↑','↓','→'].forEach((label,i)=>button(label,16+i*w,height-bottom-128,w-4,()=>adjust(i)));action('完成调整',16,height-bottom-64,width-32,()=>{ui.adjusting=false;draw();});}
  }
  function adjust(direction){
    const c=store.state.current,id=ui.selected;if(id===null){notice('先选中一块拼片。');return;}
    if(direction===0){Shared.returnPiece(c,id);safeSave();draw();return;}
    const g=Shared.gridFor(c.count),p=c.positions[id],slot=p?p.slot:Math.floor(c.count/2);
    const col=slot%g.cols,row=Math.floor(slot/g.cols),dx=[0,-1,0,0,1][direction],dy=[0,0,-1,1,0][direction];
    Shared.dropPiece(c,id,(Math.max(0,Math.min(g.cols-1,col+dx))+.5)/g.cols,(Math.max(0,Math.min(g.rows-1,row+dy))+.5)/g.rows);safeSave();feedback();draw();
  }
  function reveal(){store.state.current.phase='reveal';save();draw();}
  function drawResult(c){
    const s=store.story(c.storyID);header(c.phase==='guess'?'发现人物':'故事揭晓',backPlay);let y=listStart(),h=(width-32)*.75;
    if(c.phase==='reveal'){text('你发现了',16,y+12,13,colors.muted);y+=40;text(s.person,16,y,24,colors.text,'left',true);y+=36;y=wrap(s.title,16,y,width-32,17,colors.muted)+12;}
    mainPicture(16,y,width-32,h);hit(16,y,width-32,h,'查看完整图片',preview);y+=h+28;
    if(c.phase==='guess'){
      y=wrap(s.question,16,y,width-32,19)+16;
      s.options.forEach((option,i)=>{ctx.font='17px sans-serif';const lines=Math.max(1,Math.ceil(ctx.measureText(option).width/(width-84))),h=Math.max(52,lines*27+24),py=y;box(16,py,width-32,h,c.chosen===i?colors.selected:colors.surface,c.chosen===i?colors.accent:'#8e8e93');wrap(option,32,py+26,width-84,17);if(c.chosen===i)text('✓',width-36,py+h/2,17,colors.accent,'center');hit(16,py,width-32,h,option,()=>{c.chosen=i;c.result='';safeSave();draw();});y+=h+10;});
      if(c.result)y=wrap('再观察一下：'+s.clue,16,y+12,width-32,15,colors.muted)+8;
      button('直接查看故事',16,y,width-32,()=>run(async()=>reveal()));y+=60;
      listEnd(y);footer('确认答案',()=>run(async()=>{if(c.chosen===null)throw Error('请选择一个答案。');if(s.options[c.chosen]===s.person)reveal();else{c.result='incorrect';save();}}));
    }else{
      y=wrap(s.summary,16,y,width-32,17)+16;line(16,y,width-32);y+=24;y=wrap('出处：'+s.ref,16,y,width-32,15,colors.muted)+16;
      if(!c.trial){button(store.state.collected.includes(s.id)?'取消收藏':'收藏这幅图',16,y,width-32,()=>run(async()=>{const a=store.state.collected,i=a.indexOf(s.id);if(i<0)a.push(s.id);else a.splice(i,1);save();}));y+=60;}
      button('重新拼这幅',16,y,width-32,()=>run(async()=>{store.start(s.id,c.count,!!c.trial);ui.selected=null;}));y+=60;
      listEnd(y);footer(c.trial?'结束试玩':'下一幅',()=>run(async()=>{if(c.trial){store.endTrial();go('editimage');}else{const set=store.state.sets.find(v=>v.id===s.setID),items=set?set.items.map(v=>v.version):Shared.stories.map(v=>v.id),index=items.indexOf(s.id);if(index<0||index===items.length-1){go('home');return;}go('prepare');await loadStory(items[index+1]);}}));
    }
  }
  function input(label,value,fn,multiple=false){
    inputCallback=fn;wx.showKeyboard({defaultValue:String(value||''),maxLength:multiple?2000:200,multiple,confirmType:'done',success(){},fail:e=>notice(e.errMsg||'键盘无法打开。')});
  }
  function field(label,value,y,fn,multiple=false){text(label,16,y+10,13,colors.muted);y+=24;button(short(value||'点击填写',width-56),16,y,width-32,()=>input(label,value,fn,multiple));return y+60;}
  function drawSet(){
    const set=store.state.sets.find(s=>s.id===ui.setID);if(!set){go('home');return;}header(short(set.name,width-112,22),()=>go('home'));let y=listStart();
    y=wrap(set.description,16,y+12,width-32,15,colors.muted)+12;
    for(const item of set.items){const s=store.story(item.version);thumbnail(s,16,y,96,72);text(short(s.title,width-144),128,y+24,17);text((s.difficulty||12)+'块',128,y+52,13,colors.muted);hit(16,y,width-32,80,s.title,()=>prepare(s.id));y+=88;}
    button('删除图片集',16,y,width-32,()=>run(async()=>{if(await confirm('删除这个图片集？历史进度和收藏引用的图片版本仍保留。')){store.state.sets=store.state.sets.filter(s=>s.id!==set.id);save();go('home');}}));y+=60;
    listEnd(y);footer('编辑图片集',()=>run(async()=>{if(store.state.draft&&!(await confirm('替换当前未保存的草稿？')))return;store.draft(set.id);go('editset');}));
  }
  function currentItem(){return store.state.draft&&store.state.draft.items.find(i=>i.id===ui.itemID);}
  async function importImages(replace=false){
    const result=await media.invoke('chooseImage',{count:replace?1:9,sizeType:['original'],sourceType:['album','camera']});
    for(const path of result.tempFilePaths){const img=await media.image(path);if(img.width*img.height>40000000)throw Error('图片超过4000万像素，请缩小后重试。');
      const source=await media.persistent(path);let item;
      if(replace){item=currentItem();Object.assign(item,{source,width:img.width,height:img.height,image:'',sceneKey:'',x:50,y:50,zoom:1});}
      else item=store.addImage(source,img.width,img.height);
      await media.process(item);save();
    }
  }
  function drawEditSet(){
    const d=store.state.draft;if(!d){go('home');return;}header('编辑图片集',()=>{safeSave();go('home');});let y=listStart();
    y=field('名称',d.name,y,v=>{d.name=v;safeSave();draw();});y=field('简介',d.description,y,v=>{d.description=v;safeSave();draw();},true);
    button('添加图片（最多一次9张）',16,y,width-32,()=>run(()=>importImages()));y+=60;
    d.items.forEach((item,index)=>{
      thumbnail({...item,custom:true},16,y,96,72);text(short(item.title||'图片 '+(index+1),width-150),128,y+22,17);text(d.coverID===item.id?'封面':'点击编辑',128,y+52,13,colors.muted);
      hit(16,y,width-32,72,'编辑图片 '+(index+1),()=>{ui.itemID=item.id;go('editimage');});y+=80;
      const w=(width-56)/4;['上移','下移','封面','移除'].forEach((label,i)=>button(label,16+i*(w+8),y,w,()=>run(async()=>{
        if(i===0&&index>0)[d.items[index-1],d.items[index]]=[d.items[index],d.items[index-1]];
        if(i===1&&index<d.items.length-1)[d.items[index+1],d.items[index]]=[d.items[index],d.items[index+1]];
        if(i===2)d.coverID=item.id;
        if(i===3&&await confirm('移除这张草稿图片？')){d.items.splice(index,1);if(d.coverID===item.id)d.coverID=d.items[0]&&d.items[0].id;}
        save();
      })));y+=64;
    });
    listEnd(y);footer('保存图片集',()=>run(async()=>{for(const item of d.items)await media.process(item);const set=store.commit();ui.setID=set.id;go('set');}));
  }
  function cropStep(item,key,delta){item[key]=Math.max(key==='zoom'?1:0,Math.min(key==='zoom'?3:100,Math.round((Number(item[key])+delta)*10)/10));safeSave();draw();}
  function drawEditImage(){
    const item=currentItem();if(!item){go('editset');return;}header('编辑图片',()=>{safeSave();go('editset');});let y=listStart(),h=(width-32)*.75;
    const img=media.peek(item.source);if(img){ctx.save();ctx.beginPath();ctx.rect(16,y,width-32,h);ctx.clip();ctx.translate(16,y);media.drawScene(ctx,img,item,width-32,h);ctx.restore();}else media.image(item.source).catch(e=>notice(e.message));y+=h+16;
    const half=(width-40)/2;button('裁切填满',16,y,half,()=>{item.fit='crop';safeSave();draw();},false,item.fit==='crop');button('保留整图',24+half,y,half,()=>{item.fit='contain';safeSave();draw();},false,item.fit==='contain');y+=56;
    if(item.fit==='crop')for(const [key,label,step] of [['x','横向位置',10],['y','纵向位置',10],['zoom','缩放',.2]]){text(label+' '+item[key],16,y+22,15);button('−',width-120,y,44,()=>cropStep(item,key,-step));button('+',width-68,y,44,()=>cropStep(item,key,step));y+=52;}
    y=row('替换原图',y,()=>run(()=>importImages(true)));
    y=field('标题',item.title,y,v=>{item.title=v;safeSave();draw();});y=field('故事文字',item.text,y,v=>{item.text=v;safeSave();draw();},true);y=field('出处',item.reference,y,v=>{item.reference=v;safeSave();draw();});
    [12,24,48].forEach((n,i)=>{const w=(width-48)/3;button(n+'块',16+i*(w+8),y,w,()=>{item.difficulty=n;safeSave();draw();},false,item.difficulty===n);});y+=60;
    y=row('启用题目',y,()=>{item.quiz.enabled=!item.quiz.enabled;safeSave();draw();},item.quiz.enabled?'已开启':'已关闭');
    if(item.quiz.enabled){y=field('问题',item.quiz.question,y,v=>{item.quiz.question=v;safeSave();draw();});for(let i=0;i<3;i++){y=field('选项 '+(i+1),item.quiz.options[i],y,v=>{item.quiz.options[i]=v;safeSave();draw();});button(item.quiz.answer===i?'✓ 正确答案':'设为正确答案',16,y,width-32,()=>{item.quiz.answer=i;safeSave();draw();},false,item.quiz.answer===i);y+=56;}}
    button('保存编辑',16,y,width-32,()=>run(async()=>{await media.process(item);save();go('editset');}));y+=60;listEnd(y);
    footer('试玩这张图片',()=>run(async()=>{const q=item.quiz;if(q.enabled&&(!q.question.trim()||q.options.some(o=>!o.trim())||new Set(q.options.map(o=>o.trim())).size!==3))throw Error('请完善题目和三个不同选项。');await media.process(item);save();const c=store.trial({...item,quiz:{...q,options:q.options.map(o=>o.trim()),question:q.question.trim()}});await loadStory(c.storyID);go('play');}));
  }
  function drawSettings(){
    header('设置',()=>go('home'));let y=listStart();
    for(const [key,label] of [['sound','音效'],['haptic','触感']])y=row(label,y,()=>{store.state.settings[key]=!store.state.settings[key];safeSave();draw();},store.state.settings[key]?'开启':'关闭');
    y=wrap('图片、草稿、进度和收藏保存在本机。删除微信数据或卸载可能清除这些内容。导入照片不会上传。',16,y+20,width-32,17,colors.muted)+24;
    y=row('重置游玩进度',y,()=>run(async()=>{if(await confirm('清除进度和收藏？已保存图片集保留。'))store.resetProgress();}));
    if(store.blocked)y=row('重置损坏存档',y,()=>run(async()=>{if(await confirm('将清除当前本地元数据。此操作不可恢复，确认重置？'))store.recover();}));
    listEnd(y);footer('返回画册',()=>go('home'));
  }
  function drawPreview(){
    ctx.fillStyle=colors.bg;ctx.fillRect(0,0,width,height);ui.hits=[];ui.clip=null;header('完整原图',()=>{ui.preview=false;draw();});
    const area={x:16,y:top+60,w:width-32,h:height-bottom-(top+60)-64};ui.previewArea=area;
    ctx.save();ctx.beginPath();ctx.rect(area.x,area.y,area.w,area.h);ctx.clip();
    if(ui.image){const s=Math.min(area.w/ui.image.width,area.h/ui.image.height)*ui.previewZoom,w=ui.image.width*s,h=ui.image.height*s;ctx.drawImage(ui.image,area.x+(area.w-w)/2+ui.previewX,area.y+(area.h-h)/2+ui.previewY,w,h);}ctx.restore();
    footer(ui.previewZoom===1?'放大查看':'恢复整图',()=>{ui.previewZoom=ui.previewZoom===1?2:1;ui.previewX=ui.previewY=0;draw();});
  }
  function draw(){
    if(!colors)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=colors.bg;ctx.fillRect(0,0,width,height);ui.hits=[];ui.board=null;ui.tray=null;ui.contentBottom=0;ui.clip=null;
    if(ui.preview)drawPreview();else if(ui.screen==='welcome')drawWelcome();else if(ui.screen==='home')drawHome();else if(ui.screen==='list')drawList();else if(ui.screen==='detail')drawDetail();else if(ui.screen==='prepare')drawPrepare();else if(ui.screen==='play')drawPlay();else if(ui.screen==='set')drawSet();else if(ui.screen==='editset')drawEditSet();else if(ui.screen==='editimage')drawEditImage();else drawSettings();
    if(ui.busy){const by=height-bottom-156;box(12,by,width-24,60,colors.surface,colors.border);text('正在准备…',width/2,by+30,15,colors.text,'center');}
    else if(ui.message){ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,width,height);ui.hits=[];const by=(height-188)/2;box(12,by,width-24,188,colors.surface,colors.border);wrap(ui.message,28,by+28,width-56,15,colors.text);button('知道了',28,by+128,width-56,()=>{ui.message='';draw();},true);}
  }
  const inside=(p,r)=>r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
  function point(e,end=false){const t=(end?e.changedTouches:e.touches)||[];return t[0]?{x:t[0].clientX===undefined?t[0].pageX:t[0].clientX,y:t[0].clientY===undefined?t[0].pageY:t[0].clientY}:null;}
  function touchStart(e){
    if(ui.busy||e.touches&&e.touches.length!==1)return;const p=point(e);if(!p)return;
    const target=[...ui.hits].reverse().find(r=>inside(p,r)),c=store.state.current;
    const t={...p,startX:p.x,startY:p.y,moved:false,active:false,piece:null,target,scroll:ui.scroll};
    if(ui.preview&&inside(p,ui.previewArea)){t.preview=true;t.panX=ui.previewX;t.panY=ui.previewY;}
    else if(!ui.message&&!ui.adjusting&&!ui.preview&&ui.screen==='play'&&c&&c.phase==='puzzle'&&ui.board&&inside(p,ui.board.viewport)&&p.y>top+52&&p.y<height-bottom-64){
      t.board=true;t.panX=c.panX;t.panY=c.panY;
      if(!c.panMode){const b=ui.board,g=Shared.gridFor(c.count),slot=Math.floor((p.y-b.y)/b.h*g.rows)*g.cols+Math.floor((p.x-b.x)/b.w*g.cols);const id=c.placed.find(id=>c.positions[id].slot===slot);if(id!==undefined)t.piece=id;}
    }else if(target&&target.piece!==undefined)t.piece=target.piece;
    if(ui.tray&&inside(p,ui.tray))t.trayScroll=c.trayScroll;
    ui.touch=t;
  }
  function touchMove(e){
    const p=point(e),t=ui.touch;if(!p||!t)return;t.x=p.x;t.y=p.y;const dx=p.x-t.startX,dy=p.y-t.startY;if(Math.hypot(dx,dy)>7)t.moved=true;if(!t.moved)return;
    if(t.preview){ui.previewX=t.panX+dx;ui.previewY=t.panY+dy;}
    else if(t.board&&store.state.current.panMode){store.state.current.panX=t.panX+dx;store.state.current.panY=t.panY+dy;}
    else if(t.trayScroll!==undefined&&inside(p,ui.tray)&&Math.abs(dy)>Math.abs(dx)*1.2){store.state.current.trayScroll=Math.max(0,Math.min(ui.tray.maxScroll,t.trayScroll-dy));t.trayScrolled=true;t.active=false;}
    else if(t.piece!==null){t.active=true;ui.selected=t.piece;}
    else if(!ui.adjusting){const available=height-bottom-64-(top+52)-8;ui.scroll=Math.max(0,Math.min(Math.max(0,ui.contentBottom-available+24),t.scroll-dy));}
    draw();
  }
  function touchEnd(e){
    const p=point(e,true),t=ui.touch;if(!p||!t)return;ui.touch=null;
    if(ui.message||ui.adjusting||t.preview||ui.preview){if(!t.moved&&t.target)t.target.fn();draw();return;}
    if(t.trayScrolled&&!t.active){safeSave();draw();return;}
    const c=store.state.current;
    if(ui.screen==='play'&&c&&c.phase==='puzzle'&&(t.board||t.piece!==null)){
      if(c.panMode&&t.board){safeSave();draw();return;}
      const id=t.active?t.piece:ui.selected;
      if(inside(p,ui.board.viewport)&&id!==null&&(t.active||t.board)){
        Shared.dropPiece(c,id,(p.x-ui.board.x)/ui.board.w,(p.y-ui.board.y)/ui.board.h);ui.selected=null;ui.message='';safeSave();feedback();
      }else if(t.active&&inside(p,ui.tray)){Shared.returnPiece(c,t.piece);ui.selected=t.piece;safeSave();}
      else if(!t.moved&&t.piece!==null)ui.selected=t.piece;
      draw();return;
    }
    if(!t.moved&&t.target&&inside(p,t.target))t.target.fn();draw();
  }
  resize();wx.onTouchStart(touchStart);wx.onTouchMove(touchMove);wx.onTouchEnd(touchEnd);wx.onTouchCancel(()=>{ui.touch=null;draw();});
  if(wx.onKeyboardConfirm)wx.onKeyboardConfirm(e=>{const fn=inputCallback;inputCallback=null;if(wx.hideKeyboard)wx.hideKeyboard({});if(fn)fn(e.value);});
  if(wx.onKeyboardComplete)wx.onKeyboardComplete(e=>{const fn=inputCallback;inputCallback=null;if(fn)fn(e.value);});
  if(wx.onHide)wx.onHide(()=>{ui.touch=null;safeSave();Object.values(audio).forEach(a=>a.pause());});
  if(wx.onShow)wx.onShow(()=>{resize();draw();});if(wx.onWindowResize)wx.onWindowResize(()=>{resize();draw();});if(wx.onThemeChange)wx.onThemeChange(e=>{theme(e.theme);draw();});
  draw();
  return {ui,store,media,canvas,draw,prepare,run,loadStory,go,touchStart,touchMove,touchEnd};
}
module.exports={createApp};
