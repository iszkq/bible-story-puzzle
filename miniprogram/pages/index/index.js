'use strict';
const Shared=require('../../shared'),Store=require('../../store'),Media=require('../../media'),Renderer=require('../../renderer');
const ROOTS=['home','collection','mysets'];
Page({
  data:{trayTouch:false,previewZoomWidth:760,previewZoomHeight:570,modalOpen:false,modalTitle:'',modalContent:'',modalConfirm:'',modalCancel:'',previewOpen:false,previewLarge:false,previewPath:'',previewError:'',previewLoading:false,previewMaxHeight:430,previewX:0,previewY:0,previewBack:'返回拼图',cropWidth:1600,cropHeight:1200,screen:'welcome',busy:false,error:'',notice:'',selected:null,adjusting:false,homeScene:'',dragging:false,ghost:null,boardFrames:[{key:'empty-0',src:''},{key:'empty-1',src:''}],boardFront:0,atlas:'',atlasRows:3,atlasWidth:576,atlasHeight:432,filter:'saved',count:12,baseWidth:335,boardWidth:335,boardHeight:251.25,boardWindowHeight:251.25,panX:0,panY:0,trayScroll:0,dark:false,difficulties:[{count:12,label:'轻松',grid:'4列 × 3行'},{count:24,label:'标准',grid:'6列 × 4行'},{count:48,label:'困难',grid:'8列 × 6行'}],safeBottom:0},
  onLoad(){
    this.store=Store.createStore(wx);this.renderer=new Renderer(this);this.storyID=1;this.setID=null;this.itemID=null;
    const info=wx.getWindowInfo(),width=info.windowWidth-(info.windowWidth<=375?32:40);
    const appInfo=wx.getAppBaseInfo();
    this.setData({baseWidth:width,boardWidth:width,boardHeight:width*.75,boardWindowHeight:width*.75,previewMaxHeight:Math.min(430,info.windowHeight*.55),safeBottom:Math.max(0,info.screenHeight-(info.safeArea?info.safeArea.bottom:info.screenHeight)),dark:appInfo.theme==='dark',previewOpen:false,previewLarge:false,previewPath:'',previewError:'',previewLoading:false,cropWidth:1600,cropHeight:1200});
    this.themeHandler=e=>{this.setData({dark:e.theme==='dark'});this.renderer.draw();};
    wx.onThemeChange(this.themeHandler);
    this.screen=this.store.state.welcomed?'home':'welcome';this.render();
  },
  onHide(){this.cancelDrag();this.save();},
  onUnload(){clearTimeout(this.cropTimer);clearTimeout(this.scrollTimer);this.cancelDrag();this.save();this.renderer.dispose();if(this.audio)this.audio.destroy();wx.offThemeChange(this.themeHandler);},
  onResize(e){const width=e.size.windowWidth-(e.size.windowWidth<=375?32:40);this.setData({baseWidth:width});this.render();},
  onPageScroll(){if(this.screen==='puzzle')this.measure();},
  save(){try{this.store.save();this.setData({error:''});return true;}catch(e){this.setData({error:e.message});return false;}},
  fail(e){this.setData({error:e.message||e.errMsg||'操作未完成，请重试。',busy:false});},
  toast(title){wx.showToast({title,icon:'none'});},
  modal(title,content,confirmText='继续',cancelText='取消'){
    this.closeModal(false);
    return new Promise(resolve=>{this.modalResolve=resolve;this.setData({modalOpen:true,modalTitle:title,modalContent:content,modalConfirm:confirmText,modalCancel:cancelText});});
  },
  closeModal(confirm=false){const resolve=this.modalResolve;this.modalResolve=null;this.setData({modalOpen:false});if(resolve)resolve(confirm);},
  modalConfirm(){this.closeModal(true);},
  modalCancel(){this.closeModal(false);},
  async pauseRestart(){this.closeModal(true);if(await this.modal('重新开始这一关？','当前未完成局会重置，已发现故事和收藏会保留。','重新开始'))await this.start(true);},
  async modalPreview(){this.closeModal(false);await this.preview();},
  story(){return this.store.story(this.storyID)||this.store.story(1);},
  draftItem(){return this.store.state.draft&&this.store.state.draft.items.find(i=>i.id===this.itemID);},
  row(s,index){
    const state=this.store.state,done=state.completed.includes(s.id),running=state.current&&state.current.storyID===s.id,locked=!s.custom&&s.id>1&&!state.completed.includes(s.id-1);
    return {...s,found:done,thumb:Media.thumb(s),label:s.custom?s.title:done?s.person+' · '+s.title:'故事'+String(s.id).padStart(2,'0'),status:done?'已发现 · 可重玩':locked?'完成前一幅后开启':running?'继续上次拼图':'12 / 24 / 48块',locked,index};
  },
  render(){
    const state=this.store.state,s=this.story(),c=state.current,official=Shared.stories.map(s=>this.row({...s,custom:false}));
    const next=Shared.stories.find(s=>!state.completed.includes(s.id))||Shared.stories[0],shown=c?(this.store.story(c.storyID)||next):next;
    const rows=this.data.filter==='all'?official.concat(state.sets.flatMap(set=>set.items.map(i=>this.store.story(i.version))).filter(Boolean).map(v=>this.row(v))):state.collected.map(id=>this.store.story(id)).filter(Boolean).map(v=>this.row(v));
    const sets=state.sets.map(set=>{const cover=state.versions.find(v=>v.id===(set.items.find(i=>i.id===set.coverID)||set.items[0]||{}).version);return {...set,cover:cover?cover.image:'',size:set.items.length};});
    const set=sets.find(s=>s.id===this.setID),draft=state.draft,item=this.draftItem();
    const g=Shared.gridFor(c?c.count:this.data.count),zoomScale=Math.max(1.65,g.cols*44/this.data.baseWidth,g.rows*44/(this.data.baseWidth*.75)),boardWidth=this.data.baseWidth*(c&&c.zoom?zoomScale:1),tray=c?c.trayOrder.filter(id=>!c.positions[id]).map(id=>({id,col:id%4,row:Math.floor(id/4)})):[];
    const setItems=set?set.items.map((i,index)=>this.row(this.store.story(i.version),index)):[];
    this.setData({screen:this.screen,root:ROOTS.includes(this.screen),story:s,storyLabel:this.row(s).label,thumb:Media.thumb(s),official,collection:rows,sets,set:set||null,setItems,draft:draft||null,item:item||null,settings:state.settings,current:c||null,shown:this.row({...shown,custom:!!shown.custom}),completed:state.completed.length,officialCompleted:official.filter(s=>state.completed.includes(s.id)).length,collected:state.collected.includes(s.id),session:c||null,placed:c?c.placed.length:0,tray,cellWidth:boardWidth/g.cols,cellHeight:boardWidth*.75/g.rows,boardWidth,boardHeight:boardWidth*.75,boardWindowHeight:this.data.baseWidth*.75,pieceRatio:4*g.rows/(3*g.cols),panX:c?c.panX:0,panY:c?c.panY:0,trayScroll:c?c.trayScroll:0,trial:!!(c&&c.trial),error:this.store.warning||this.data.error,blocked:this.store.blocked,quality:item?(item.width+' × '+item.height+'像素 · '+(Math.min(item.width,item.height)<600?'清晰度较低，建议先用12块':'建议检查48块的细节')):''});
    this.setData({trayPieceHeight:54,trayPieceWidth:54*4*g.rows/(3*g.cols)});
    const ownSet=s.custom?state.sets.find(set=>set.id===s.setID):null,ownIndex=ownSet?ownSet.items.findIndex(i=>i.version===s.id):-1;
    this.setData({hasOwnNext:!!(ownSet&&ownSet.items[ownIndex+1]),savedCount:state.collected.length,recentCollected:state.collected.slice(-2).map(id=>(this.store.story(id)||{}).person||'我的图片').join(' · ')});
    wx.setNavigationBarTitle({title:this.screen==='puzzle'?'拼图 · '+c.count+'块':'拾光拼图册'});
    if(this.screen==='puzzle'){
      if(!this.renderer||!this.renderer.ctx||this.puzzleKey!==c.storyID+':'+c.count)this.setData({busy:true});
      wx.nextTick(()=>{
      const key=c.storyID+':'+c.count;
      if(this.renderer&&this.renderer.ctx&&this.puzzleKey===key){this.renderer.draw();this.measure();}
      else this.loadPuzzle();
      });
    }
    if(this.screen==='imageedit')this.scheduleCrop();
    if(['prepare','guess','reveal','detail'].includes(this.screen))this.loadScene();
    if(this.screen==='home')this.loadHome(shown);
  },
  go(screen){
    this.closePreview();this.closeModal(false);this.cancelDrag(false);if(this.screen==='puzzle'&&screen!=='puzzle'){this.puzzleLoadSerial=(this.puzzleLoadSerial||0)+1;this.loadingPuzzle=false;this.renderer.dispose();this.setData({busy:false});}
    this.screen=screen;this.setData({error:'',selected:null,adjusting:false,notice:''});this.render();wx.pageScrollTo({scrollTop:0,duration:0});
  },
  async loadHome(shown){
    const key=shown.id+':'+(shown.image||'');
    if(this.homeKey===key&&this.data.homeScene)return;
    if(this.homeLoadingKey===key)return;
    this.homeLoadingKey=key;
    const serial=this.homeSerial=(this.homeSerial||0)+1;this.setData({homeScene:''});
    try{const path=await Media.scene(shown);if(serial===this.homeSerial&&this.screen==='home'){this.homeKey=key;this.setData({homeScene:path});}}catch(e){if(serial===this.homeSerial&&this.screen==='home')this.fail(e);}finally{if(serial===this.homeSerial)this.homeLoadingKey=null;}
  },
  async loadScene(){
    const serial=this.sceneSerial=(this.sceneSerial||0)+1,id=this.storyID;
    try{const path=await Media.scene(this.story());if(serial===this.sceneSerial&&id===this.storyID)this.setData({scene:path});}catch(e){this.fail(e);}
  },
  async loadPuzzle(){
    if(this.loadingPuzzle)return;
    const serial=this.puzzleLoadSerial=(this.puzzleLoadSerial||0)+1;
    this.loadingPuzzle=true;this.setData({busy:true});
    try{const c=this.store.state.current;if(!c)return;const path=await Media.scene(this.store.story(c.storyID));if(this.screen!=='puzzle'||serial!==this.puzzleLoadSerial)return;await this.renderer.init(path,c.count);if(serial!==this.puzzleLoadSerial||this.screen!=='puzzle')return;this.puzzleKey=c.storyID+':'+c.count;this.setData({scene:path});this.measure();}
    catch(e){if(serial===this.puzzleLoadSerial)this.fail(e);}finally{if(serial===this.puzzleLoadSerial){this.loadingPuzzle=false;this.setData({busy:false});}}
  },
  measure(){if(this.screen!=='puzzle')return;return new Promise(resolve=>this.createSelectorQuery().select('#board').boundingClientRect().select('#board-window').boundingClientRect().select('#tray').boundingClientRect().exec(r=>{this.boardRect=r[0];this.boardView=r[1];this.trayRect=r[2];resolve(r);}));},
  async feedback(complete=false){
    const settings=this.store.state.settings;
    if(settings.haptic)wx.vibrateShort({type:'light',fail:()=>{}});
    if(settings.sound){if(!this.audio){this.audio=wx.createInnerAudioContext();this.audio.obeyMuteSwitch=true;this.audio.onError(()=>{});}this.audio.stop();this.audio.src='/assets/'+(complete?'complete':'place')+'.wav';this.audio.play();}
  },
  async preview(){
    this.cancelDrag();
    this.previewPan=null;
    const serial=this.previewSerial=(this.previewSerial||0)+1;
    this.setData({previewOpen:true,previewLarge:false,previewPath:'',previewError:'',previewLoading:true,previewX:0,previewY:0,previewBack:this.screen==='prepare'?'返回关卡准备':this.screen==='detail'?'返回详情':this.screen==='reveal'?'返回故事':'返回拼图'});
    try{const path=await Media.scene(this.story());if(serial===this.previewSerial&&this.data.previewOpen)this.setData({previewPath:path});}
    catch(e){if(serial===this.previewSerial)this.setData({previewError:e.message||'图片未能显示，请重试。',previewLoading:false});}
  },
  closePreview(){this.previewPan=null;this.previewSerial=(this.previewSerial||0)+1;this.setData({previewOpen:false,previewPath:'',previewError:'',previewLoading:false,previewX:0,previewY:0});},
  previewZoom(){
    this.previewPan=null;
    const width=Math.max(760,this.data.baseWidth*2);
    this.setData({previewLarge:!this.data.previewLarge,previewZoomWidth:width,previewZoomHeight:width*.75,previewX:0,previewY:0});
  },
  previewPanStart(e){
    const t=this.point(e);this.previewPan=null;
    if(!this.data.previewOpen||!this.data.previewLarge||!t)return;
    this.previewPan={x:t.clientX,y:t.clientY,offsetX:this.data.previewX,offsetY:this.data.previewY};
  },
  previewPanMove(e){
    const pan=this.previewPan,t=this.point(e);if(!pan||!t||!this.data.previewOpen||!this.data.previewLarge)return;
    const maxX=Math.max(0,this.data.previewZoomWidth-this.data.baseWidth);
    const maxY=Math.max(0,this.data.previewZoomHeight-this.data.previewMaxHeight);
    this.setData({previewX:Math.max(0,Math.min(maxX,pan.offsetX+pan.x-t.clientX)),previewY:Math.max(0,Math.min(maxY,pan.offsetY+pan.y-t.clientY))});
  },
  previewPanEnd(){this.previewPan=null;},
  previewReady(e){if(e.currentTarget.dataset.src===this.data.previewPath)this.setData({previewLoading:false,previewError:''});},
  previewFailed(e){if(e.currentTarget.dataset.src===this.data.previewPath)this.setData({previewLoading:false,previewError:'图片未能显示，请重试。'});},
  async start(restart=false){
    const c=this.store.state.current,count=this.data.count;
    if(!restart&&c&&c.storyID===this.storyID&&c.count===count){this.go(c.phase);return;}
    if(c&&!c.trial&&(c.phase==='puzzle'||c.storyID===this.storyID)&&!(await this.modal('开始新的拼图？','当前未完成局将被替换，已发现和收藏会保留。','开始新局')))return;
    this.store.start(this.storyID,count,!!(c&&c.trial));this.go('puzzle');
  },
  async act(e){
    if(this.data.busy)return;
    const action=e.currentTarget.dataset.action,arg=e.currentTarget.dataset.arg,state=this.store.state;
    this.setData({error:''});
    try{
      if(action==='go'){this.go(arg);return;}
      if(action==='first'){state.welcomed=true;this.save();this.storyID=1;this.setData({count:12});this.go('prepare');return;}
      if(action==='resume'){if(state.current){this.storyID=state.current.storyID;this.setData({count:state.current.count});this.go(state.current.phase);}else{this.storyID=(Shared.stories.find(s=>!state.completed.includes(s.id))||Shared.stories[0]).id;this.go('prepare');}return;}
      if(action==='open'){if(!state.completed.includes(arg)){this.toast('完成这个故事后，人物和插画会在这里揭晓。');return;}const story=this.store.story(arg);if(!story)return;this.storyID=arg;this.setID=story.setID||null;this.go('detail');return;}
      if(action==='backSet'){if(state.current&&state.current.trial){this.store.endTrial();this.go('imageedit');}else if(state.sets.some(set=>set.id===this.setID))this.go('setdetail');else this.go('mysets');return;}
      if(action==='choose'){const s=this.store.story(arg);if(!s)return;if(this.row(s).locked){this.toast('完成前一幅后开启');return;}if(s.custom)this.setID=s.setID;this.storyID=s.id;this.setData({scene:'',count:state.current&&state.current.storyID===s.id?state.current.count:12});this.go(state.completed.includes(s.id)?'detail':'prepare');return;}
      if(action==='difficulty'){this.setData({count:Number(arg)});return;}
      if(action==='start'){await this.start();return;}
      if(action==='restart'){if(await this.modal('重新开始这一关？','当前局将重置，已发现与收藏保留。','重新开始'))await this.start(true);return;}
      if(action==='preview'){await this.preview();return;}
      if(action==='retry'){if(this.screen==='puzzle')await this.loadPuzzle();else if(this.screen==='imageedit')this.scheduleCrop();else if(this.screen==='home'){this.homeKey=null;await this.loadHome(this.data.shown);}else await this.loadScene();return;}
      if(action==='pause'){const again=await this.modal('已暂停','进度已保存。已摆放'+state.current.placed.length+'/'+state.current.count+'块。','继续拼图',state.current.trial?'结束试玩':'返回故事库');if(!again){if(state.current.trial){this.store.endTrial();this.go('imageedit');}else this.go('home');}return;}
      if(action==='exit'){if(state.current&&state.current.trial){this.store.endTrial();this.go('imageedit');}else this.go('home');return;}
      if(action==='zoom'){this.cancelDrag(false);state.current.zoom=!state.current.zoom;state.current.panMode=false;state.current.panX=0;state.current.panY=0;this.setData({panX:0,panY:0});this.save();this.render();return;}
      if(action==='pan'){this.cancelDrag();state.current.panMode=!state.current.panMode;this.save();this.render();return;}
      if(action==='adjust'){this.setData({adjusting:true});return;}
      if(action==='closeAdjust'){this.setData({adjusting:false});return;}
      if(action==='return'){if(this.data.selected!==null){Shared.returnPiece(state.current,this.data.selected);this.setData({selected:null});this.save();this.render();}return;}
      if(action==='move'){const id=this.data.selected,p=state.current.positions[id];if(id===null)return;const g=Shared.gridFor(state.current.count),x=p?p.x:.5,y=p?p.y:.5;Shared.dropPiece(state.current,id,x+(arg==='right'?1/g.cols:arg==='left'?-1/g.cols:0),y+(arg==='down'?1/g.rows:arg==='up'?-1/g.rows:0));this.save();this.render();return;}
      if(action==='submit'){
        const result=this.store.submit();
        if(result==='correct'){this.feedback(true);await this.modal('拼图正确',this.story().quizEnabled?(this.story().custom?'画面拼好了。接下来回答一道题。':'画面拼好了。接下来，认一认其中的人物。'):'欣赏图片，读一读它的故事。',this.story().quizEnabled?(this.story().custom?'回答问题':'认一认人物'):'查看故事','');this.go(state.current.phase);}
        else{await this.modal(result==='incomplete'?'还没有摆放完整':'还需要再调整一下',result==='incomplete'?'还有碎片未放入画面，请继续拼图。':'拼图还有不一致的地方，可以对照原图继续调整。\n你的摆放已保留。',result==='incomplete'?'继续拼图':'继续调整','');this.render();}return;
      }
      if(action==='answer'){state.current.chosen=arg;state.current.result='';this.save();this.render();return;}
      if(action==='confirm'){if(!state.current.chosen)return;state.current.result=String(state.current.chosen).trim()===String(this.story().person).trim()?'correct':'wrong';this.save();this.render();return;}
      if(action==='reveal'){if(state.current&&state.current.storyID===this.storyID){state.current.phase='reveal';this.save();}this.go('reveal');return;}
      if(action==='save'){
        if(state.current&&state.current.trial){this.toast('试玩不记录收藏');return;}
        if(!state.completed.includes(this.storyID)){this.toast('完成拼图后可收藏');return;}
        const index=state.collected.indexOf(this.storyID);if(index<0)state.collected.push(this.storyID);else state.collected.splice(index,1);this.save();this.render();return;
      }
      if(action==='next'){
        const s=this.story();
        if(s.custom){const set=state.sets.find(v=>v.id===s.setID),index=set?set.items.findIndex(i=>i.version===s.id):-1,next=index>=0?set.items[index+1]:null;if(next){this.storyID=next.version;this.setData({count:12,scene:''});this.go('prepare');}else this.go('mysets');}
        else{const id=Number(this.storyID)+1;state.current=null;this.save();if(id<=Shared.stories.length){this.storyID=id;this.setData({count:12,scene:''});this.go('prepare');}else this.go('collection');}return;
      }
      if(action==='replay'){this.setData({count:12});this.go('prepare');return;}
      if(action==='filter'){this.setData({filter:arg});this.render();return;}
      if(action==='new'){
        if(state.draft&&!(await this.modal('新建图片集？','原来未完成的草稿将被替换。','新建')))return;
        this.store.draft();this.go('setedit');return;
      }
      if(action==='continueDraft'){this.go('setedit');return;}
      if(action==='openSet'){this.setID=arg;this.go('setdetail');return;}
      if(action==='editSet'){if(state.draft&&!(await this.modal('编辑这份图片集？','未完成的草稿将被替换。','编辑')))return;this.store.draft(this.setID);this.go('setedit');return;}
      if(action==='discard'){if(await this.modal('放弃草稿？','未保存的编辑将被删除，原图片集保留。','放弃草稿')){state.draft=null;this.save();this.go('mysets');}return;}
      if(action==='deleteSet'){if(await this.modal('删除图片集？','图片集入口将移除，旧版本的收藏和正在玩的拼图保留。','删除')){state.sets=state.sets.filter(s=>s.id!==this.setID);this.save();this.go('mysets');}return;}
      if(action==='add'){await this.addImages();return;}
      if(action==='image'){this.itemID=arg;this.go('imageedit');return;}
      if(action==='cover'){state.draft.coverID=arg;this.save();this.render();return;}
      if(action==='up'||action==='down'){const items=state.draft.items,i=items.findIndex(v=>v.id===arg),to=i+(action==='up'?-1:1);if(to>=0&&to<items.length){[items[i],items[to]]=[items[to],items[i]];this.save();this.render();}return;}
      if(action==='replace'){await this.replaceImage();return;}
      if(action==='grid'){this.draftItem().difficulty=Number(arg);this.save();this.render();return;}
      if(action==='doneImage'){await this.processItem();this.go('setedit');return;}
      if(action==='trial'){const item=await this.processItem();this.store.trial(item);this.storyID=this.store.state.current.storyID;this.setData({count:item.difficulty,scene:''});this.go('puzzle');return;}
      if(action==='removeImage'){if(await this.modal('移除这张图片？','只移除草稿中的图片，旧版本保留。','移除')){state.draft.items=state.draft.items.filter(i=>i.id!==this.itemID);if(state.draft.coverID===this.itemID)state.draft.coverID=state.draft.items[0]?state.draft.items[0].id:null;this.save();this.go('setedit');}return;}
      if(action==='saveSet'){
        if(!state.draft||!state.draft.name.trim())throw Error('请填写图片集名称。');
        if(!state.draft.items.length)throw Error('请添加至少一张图片。');
        this.setData({busy:true});
        for(const item of state.draft.items){const key=JSON.stringify([item.source,item.fit,Number(item.x),Number(item.y),Number(item.zoom)]);if(!item.image||item.sceneKey!==key)await Media.processScene(this,item);}
        const set=this.store.commit();this.setID=set.id;this.go('setdetail');return;
      }
      if(action==='content'){await this.modal('内容说明','故事文字是独立概述，展示经文出处。逐字经文须先确定译本与使用条件。插画是艺术化表达，定稿前需核对情节。','我知道了','');return;}
      if(action==='storage'){await this.modal('本地存档','图片、草稿、拼图进度和收藏仅保存到当前设备。没有账号或云端同步；清除小程序数据会失去本地内容。','我知道了','');return;}
      if(action==='leave'){state.current=null;this.save();this.go('home');return;}
      if(action==='clear'){if(await this.modal('清除游玩进度？','已发现、收藏和未完成局将删除；个人图片集与草稿保留。','清除进度')){this.store.resetProgress();this.go('home');}return;}
      if(action==='readAgain'){this.store=Store.createStore(wx);this.setData({error:''});if(!this.store.state.current&&['puzzle','guess'].includes(this.screen))this.go('home');else this.render();return;}
      if(action==='resetStorage'){if(await this.modal('重置无法读取的资料？','将清除本机资料索引；原个人图片文件不删除。请先尝试重新读取。','重置')){this.store.recover();this.go('home');}return;}
    }catch(e){this.fail(e);}finally{if(!this.loadingPuzzle&&(this.screen!=='puzzle'||(this.renderer.ctx&&this.puzzleKey===state.current.storyID+':'+state.current.count)))this.setData({busy:false});}
  },
  async chooseFiles(){try{return await Media.invoke('chooseMedia',{count:9,mediaType:['image'],sourceType:['album'],sizeType:['original']});}catch(e){if((e.errMsg||'').includes('cancel'))return null;throw e;}},
  async importFile(file){
    if(file.size>20*1024*1024)throw Error('图片超过20MB，请缩小后导入。');
    const info=await Media.invoke('getImageInfo',{src:file.tempFilePath});
    if(!['jpeg','jpg','png','webp'].includes(String(info.type).toLowerCase()))throw Error('请选择JPEG、PNG或WebP图片；HEIC请先转换。');
    if(info.width*info.height>40000000)throw Error('图片超过4000万像素。');
    // Decode and normalize EXIF orientation before saving the immutable source.
    const {node:canvas}=await Media.node(this,'#crop-cache'),img=await Media.image(canvas,file.tempFilePath);
    const scale=Math.min(1,2560/Math.max(img.width,img.height)),width=Math.round(img.width*scale),height=Math.round(img.height*scale);
    await new Promise(resolve=>this.setData({cropWidth:width,cropHeight:height},resolve));
    canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const out=await Media.invoke('canvasToTempFilePath',{canvas,fileType:'png',width:canvas.width,height:canvas.height,destWidth:canvas.width,destHeight:canvas.height});
    return {source:await Media.persistent(out.tempFilePath,'png'),width:info.width,height:info.height};
  },
  async addImages(){
    const picked=await this.chooseFiles();if(!picked)return;
    this.setData({busy:true});
    for(const file of picked.tempFiles){const i=await this.importFile(file),item=this.store.addImage(i.source,i.width,i.height);item.title='图片 '+this.store.state.draft.items.length;await Media.processScene(this,item);this.save();}
    this.render();
  },
  async replaceImage(){
    const picked=await this.chooseFiles();if(!picked||!picked.tempFiles.length)return;
    this.setData({busy:true});const info=await this.importFile(picked.tempFiles[0]),item=this.draftItem();
    Object.assign(item,info,{image:'',sceneKey:'',x:50,y:50,zoom:1});this.save();this.render();
  },
  async processItem(){this.setData({busy:true});const item=this.draftItem();await Media.processScene(this,item);this.store.save();return item;},
  field(e){
    const field=e.currentTarget.dataset.field,target=e.currentTarget.dataset.target,number=e.currentTarget.dataset.number,value=number?Number(e.detail.value):e.detail.value;
    if(target==='draft')this.store.state.draft[field]=value;
    else if(target==='quiz')this.draftItem().quiz[field]=value;
    else if(target==='option')this.draftItem().quiz.options[Number(field)]=value;
    else this.draftItem()[field]=value;
    this.save();
    if(target!=='draft'){this.setData({item:this.draftItem()});if(['x','y','zoom','fit'].includes(field))this.scheduleCrop();}
  },
  quizToggle(e){this.draftItem().quiz.enabled=e.detail.value;this.save();this.render();},
  preference(e){this.store.state.settings[e.currentTarget.dataset.key]=e.detail.value;this.save();this.render();},
  scheduleCrop(){
    clearTimeout(this.cropTimer);
    this.cropTimer=setTimeout(async()=>{if(this.cropping){this.scheduleCrop();return;}if(this.screen!=='imageedit')return;this.cropping=true;try{await Media.cropPreview(this,Store.clone(this.draftItem()));}catch(e){this.fail(e);}finally{this.cropping=false;}},100);
  },
  scroll(e){
    const c=this.store.state.current;if(!c||this.screen!=='puzzle')return;
    if(e.currentTarget.dataset.area==='tray'){
      // A piece gesture owns its scroll offset; ignore delayed native echoes.
      if(this.trayBrowse||(this.drag&&!this.drag.board))return;
      c.trayScroll=e.detail.scrollTop;
    }
    else return; // Board panning owns offsets; delayed native events cannot undo fit.
    clearTimeout(this.scrollTimer);this.scrollTimer=setTimeout(()=>{this.save();this.measure();},120);
  },
  point(e){return e.type==='touchend'||e.type==='touchcancel'?(e.changedTouches&&e.changedTouches[0]):(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0]);},
  boardStart(e){
    const c=this.store.state.current;if(this.data.busy||!this.boardRect||!c)return;
    const t=this.point(e),x=t.clientX-this.boardRect.left,y=t.clientY-this.boardRect.top;
    this.cancelDrag(false);
    const id=c.panMode?null:this.renderer.hit(x,y);
    if(c.zoom&&(c.panMode||id===null)){
      this.boardPan={x:t.clientX,y:t.clientY,offsetX:this.data.panX,offsetY:this.data.panY,moved:false};return;
    }
    this.drag={id,startX:t.clientX,startY:t.clientY,active:false,board:true};if(id!==null&&this.data.selected===null){this.setData({selected:id});this.renderer.draw();}
  },
  trayStart(e){if(this.data.busy)return;const t=this.point(e);this.cancelDrag(false);this.ignorePieceTap=false;this.drag={id:Number(e.currentTarget.dataset.id),startX:t.clientX,startY:t.clientY,active:false,board:false};this.setData({selected:this.drag.id,trayTouch:true});},
  trayBrowseStart(e){if(this.data.busy)return;const t=this.point(e);this.cancelDrag();this.trayBrowse={startY:t.clientY,startScroll:this.store.state.current.trayScroll||0};},
  trayBrowseMove(e){
    const browse=this.trayBrowse,t=this.point(e);if(!browse||!t)return;
    const height=this.trayRect?this.trayRect.height:216;
    const max=Math.max(0,Math.ceil(this.data.tray.length/4)*this.data.trayPieceHeight-height);
    const offset=Math.max(0,Math.min(max,browse.startScroll+browse.startY-t.clientY));
    this.store.state.current.trayScroll=offset;this.setData({trayScroll:offset});
  },
  trayBrowseEnd(){if(!this.trayBrowse)return;this.trayBrowse=null;this.save();this.measure();},
  trayLong(){if(this.drag)this.activateDrag();},
  activateDrag(){if(!this.drag||this.drag.id===null)return;this.drag.active=true;this.ignorePieceTap=true;this.setData({dragging:true,selected:this.drag.id});this.renderer.draw();},
  touchMove(e){
    if(this.boardPan){
      const pan=this.boardPan,t=this.point(e),c=this.store.state.current;if(!t||!c||!c.zoom)return;
      const dx=pan.x-t.clientX,dy=pan.y-t.clientY;
      if(!pan.moved&&Math.hypot(dx,dy)<=6)return;
      pan.moved=true;
      c.panX=Math.max(0,Math.min(this.data.boardWidth-this.data.baseWidth,pan.offsetX+dx));
      c.panY=Math.max(0,Math.min(this.data.boardHeight-this.data.boardWindowHeight,pan.offsetY+dy));
      this.setData({panX:c.panX,panY:c.panY});return;
    }
    const d=this.drag,t=this.point(e);if(!d||d.id===null||!t)return;
    const dx=t.clientX-d.startX,dy=t.clientY-d.startY;
    if(!d.active){if(Math.hypot(dx,dy)>6)this.activateDrag();else return;}
    const w=this.data.cellWidth*1.44,h=this.data.cellHeight*1.44;
    this.setData({ghost:{id:d.id,col:d.id%4,row:Math.floor(d.id/4),left:t.clientX-w/2,top:t.clientY-24-h/2,width:w,height:h}});
  },
  touchEnd(e){
    if(this.boardPan){
      const pan=this.boardPan,t=this.point(e),c=this.store.state.current;this.boardPan=null;
      if(!pan.moved&&t&&c&&!c.panMode&&this.data.selected!==null){
        Shared.dropPiece(c,this.data.selected,(t.clientX-this.boardRect.left)/this.boardRect.width,(t.clientY-this.boardRect.top)/this.boardRect.height);this.feedback();this.render();
      }
      this.save();wx.nextTick(()=>this.measure());return;
    }
    const d=this.drag,t=this.point(e),c=this.store.state.current;if(!d||!t||!c)return;
    let changed=false;
    if(d.active){
      const x=t.clientX,y=t.clientY-24;
      const inside=(r,a,b)=>{if(!r)return false;const right=r.right===undefined?r.left+r.width:r.right,bottom=r.bottom===undefined?r.top+r.height:r.bottom;return a>=r.left&&a<=right&&b>=r.top&&b<=bottom;};
      if(inside(this.boardRect,x,y)&&inside(this.boardView,x,y)){Shared.dropPiece(c,d.id,(x-this.boardRect.left)/this.boardRect.width,(y-this.boardRect.top)/this.boardRect.height);changed=true;}
      else if(inside(this.trayRect,t.clientX,t.clientY)){Shared.returnPiece(c,d.id);changed=true;}
    }else if(d.board&&this.data.selected!==null){Shared.dropPiece(c,this.data.selected,(t.clientX-this.boardRect.left)/this.boardRect.width,(t.clientY-this.boardRect.top)/this.boardRect.height);changed=true;}
    if(changed&&d.active&&c.positions[d.id]){
      const {cols,rows}=Shared.gridFor(c.count),cw=this.data.boardWidth/cols,ch=this.data.boardHeight/rows,slot=c.positions[d.id].slot;
      this.drag=null;this.handoff={};
      this.setData({trayTouch:false});
      this.setData({dragging:false,ghost:{id:d.id,col:d.id%4,row:Math.floor(d.id/4),left:this.boardRect.left+(slot%cols)*cw-.22*cw,top:this.boardRect.top+Math.floor(slot/cols)*ch-.22*ch,width:cw*1.44,height:ch*1.44,settled:true}});
    }else this.cancelDrag(false);
    if(changed){this.save();this.feedback();this.render();}else this.renderer.draw();
  },
  cancelDrag(redraw=true){const active=this.drag&&this.drag.active;this.drag=null;this.boardPan=null;this.trayBrowse=null;this.handoff=null;this.setData({dragging:false,trayTouch:false,ghost:null});if(active&&redraw)this.renderer.draw();},
  selectPiece(e){if(this.ignorePieceTap)return;this.setData({selected:Number(e.currentTarget.dataset.id)});this.renderer.draw();},
  boardFrameLoaded(e){this.renderer.frameReady(Number(e.currentTarget.dataset.buffer),e.currentTarget.dataset.src);},
  boardFrameError(e){this.renderer.frameError(Number(e.currentTarget.dataset.buffer),e.currentTarget.dataset.src);},
  noop(){},
  imageError(){this.setData({error:'图片未能显示，请重试或重新选择图片。'});}
});
