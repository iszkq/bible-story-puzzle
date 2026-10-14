'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),Store=require('../miniprogram/store');
let definition,sceneResolve,sceneReject;
const Media={scene:()=>new Promise((resolve,reject)=>{sceneResolve=resolve;sceneReject=reject;}),thumb:()=>'/thumb'};
const wx={setNavigationBarTitle(){},nextTick(){},pageScrollTo(){},showToast(){}};
let appDefinition,relaunch;
vm.runInNewContext(fs.readFileSync(root+'/miniprogram/app.js','utf8'),{App:value=>appDefinition=value,wx:{reLaunch:value=>{relaunch=value.url;}}});
appDefinition.onPageNotFound();assert.equal(relaunch,'/pages/index/index','Invalid experience paths must lead to the registered main page');
vm.runInNewContext(fs.readFileSync(root+'/miniprogram/pages/index/index.js','utf8'),{require:p=>p==='../../media'?Media:require(path.resolve(root+'/miniprogram/pages/index',p)),Page:p=>definition=p,wx,setTimeout,clearTimeout});
function page(){const store=Store.createStore({getStorageSync(){},setStorageSync(){}});store.start(1,12);return {...definition,store,screen:'puzzle',storyID:1,data:Store.clone(definition.data),renderer:{ctx:{},draw(){},dispose(){}},puzzleKey:'1:12',setData(update){Object.assign(this.data,update);},loadHome(){},loadScene(){},measure(){},feedback(){}};}
function trayGestures(){
 const wxml=fs.readFileSync(root+'/miniprogram/pages/index/index.wxml','utf8');
 assert.match(wxml,/<view[^>]*class="piece [^>]*catchtouchmove="touchMove"/,'Piece movement must stop native page scrolling from the first event');
 assert.match(wxml,/^<page-meta page-style="{{dragging \? 'overflow: hidden;' : ''}}"/,'Page scroll lock must be first and limited to active dragging');
 for(const count of [12,24,48]){
  const p=page();p.store.start(1,count);p.data.count=count;p.puzzleKey='1:'+count;p.render();
  p.trayRect={top:450,left:0,width:335,height:216};
  const c=p.store.state.current,before=JSON.stringify(c.positions),id=p.data.tray[0].id;
  const start=()=>p.trayStart({currentTarget:{dataset:{id}},touches:[{clientX:50,clientY:600}]});
  const move=(x,y)=>p.touchMove({touches:[{clientX:x,clientY:y}]});
  for(const [x,y] of [[50,540],[50,660],[120,600],[10,600],[80,570]]){
   start();assert(p.data.trayTouch,'Native tray scrolling locks at touch-down');move(52,602);assert(!p.data.dragging,'Tiny touch jitter remains a tap');
   move(x,y);assert(p.data.dragging,'All directions drag immediately without long press');assert(p.data.ghost);assert.equal(c.trayScroll,0);
   p.cancelDrag();assert.equal(p.data.dragging,false);assert.equal(p.data.trayTouch,false);assert.equal(p.data.ghost,null);assert.equal(JSON.stringify(c.positions),before);
  }
  p.trayBrowseStart({touches:[{clientX:50,clientY:600}]});
  const browse=y=>p.trayBrowseMove({touches:[{clientX:50,clientY:y}]});
  browse(540);assert.equal(c.trayScroll,count===12?0:60);assert.equal(p.data.dragging,false);
  browse(-500);assert.equal(c.trayScroll,Math.max(0,count/4*54-216),'Tray scroll clamps at its bottom');
  browse(1000);assert.equal(c.trayScroll,0,'Tray scroll clamps at its top');p.trayBrowseEnd();
  assert.equal(JSON.stringify(c.positions),before);
  start();move(50,400);p.onHide();assert(!p.data.dragging);assert(!p.data.ghost);
  // Direct upward drag into a cell must drop, not scroll or require long press.
  p.boardRect=p.boardView={left:0,top:100,width:335,height:251.25};
  start();move(50,200);p.touchEnd({changedTouches:[{clientX:50,clientY:200}]});assert(c.positions[id]);assert.equal(c.submitResult,'');assert(!p.data.dragging);
  p.selectPiece({currentTarget:{dataset:{id:(id+1)%count}}});assert.equal(p.data.selected,id,'Drag release must not trigger a second piece tap');
  clearTimeout(p.scrollTimer);
 }
}
function previewGestures(){
 const wxml=fs.readFileSync(root+'/miniprogram/pages/index/index.wxml','utf8');
 assert.match(wxml,/class="preview-window"[^>]*catchtouchmove="previewPanMove"/,'Preview window must own its movement before the shade handles it');
 for(const width of [288,343,353,390,900]){
  const p=page(),original=JSON.stringify(p.store.state.current);
  Object.assign(p.data,{baseWidth:width,previewOpen:true,previewMaxHeight:Math.min(430,width*.8)});
  const start=(x=200,y=200)=>p.previewPanStart({touches:[{clientX:x,clientY:y}]});
  const move=(x,y)=>p.previewPanMove({touches:[{clientX:x,clientY:y}]});
  assert.equal(p.point({type:'touchmove',touches:[{clientX:100}],changedTouches:[{clientX:0}]}).clientX,100,'Movement reads the active touch rather than a stale changed touch');
  assert.equal(p.point({type:'touchend',touches:[{clientX:0}],changedTouches:[{clientX:100}]}).clientX,100,'Release reads the ending finger');
  start();move(0,0);assert.equal(p.data.previewX,0,'Fit mode cannot pan');
  p.previewZoom();assert(p.data.previewLarge);assert(p.data.previewZoomWidth>width);
  start();move(100,200);assert.equal(p.data.previewX,100);assert.equal(p.data.previewY,0,'Horizontal drag keeps vertical position');p.previewPanEnd();
  start();move(250,200);assert.equal(p.data.previewX,50,'Reverse drag uses the last offset instead of jumping');
  move(-2000,-2000);assert.equal(p.data.previewX,p.data.previewZoomWidth-width);assert.equal(p.data.previewY,p.data.previewZoomHeight-p.data.previewMaxHeight);
  p.previewPanEnd();start();move(3000,3000);assert.equal(p.data.previewX,0);assert.equal(p.data.previewY,0);
  start();move(100,100);assert.equal(p.data.previewX,100);assert.equal(p.data.previewY,100,'Diagonal gesture pans both axes');
  p.previewPanEnd();move(0,0);assert.equal(p.data.previewX,100,'Ended/canceled gesture cannot keep moving');
  p.previewZoom();move(0,0);assert(!p.data.previewLarge);assert.equal(p.data.previewX,0);assert.equal(p.data.previewY,0);
  p.previewZoom();start();move(100,100);p.closePreview();move(0,0);assert.equal(p.data.previewX,0);assert.equal(p.data.previewY,0);assert.equal(p.previewPan,null);
  assert.equal(JSON.stringify(p.store.state.current),original,'Viewing enlarged art must preserve all puzzle state');
 }
}
async function boardGestures(){
 const wxml=fs.readFileSync(root+'/miniprogram/pages/index/index.wxml','utf8');
 assert.match(wxml,/id="board"[^>]*catchtouchmove="touchMove"/,'Board panning must have a stable touch handler');
 for(const count of [12,24,48]){
  const p=page();p.store.start(1,count);p.data.count=count;p.puzzleKey='1:'+count;p.renderer.hit=()=>null;p.render();
  const c=p.store.state.current,original=JSON.stringify(c.positions);
  const act=action=>p.act({currentTarget:{dataset:{action}}});
  for(let n=0;n<3;n++){
   await act('zoom');assert(c.zoom);assert.equal(p.data.boardWindowHeight,p.data.baseWidth*.75);
   p.boardRect={left:0,top:100,width:p.data.boardWidth,height:p.data.boardHeight};
   p.boardStart({touches:[{clientX:200,clientY:200}]});p.touchMove({touches:[{clientX:100,clientY:160}]});
   assert.equal(c.panX,100,'Empty enlarged cells pan without entering browse mode');assert.equal(c.panY,40);
   p.touchEnd({changedTouches:[{clientX:100,clientY:160}]});assert.equal(p.boardPan,null);
   await act('pan');assert(c.panMode);p.renderer.hit=()=>0;
   p.boardStart({touches:[{clientX:200,clientY:200}]});p.touchMove({touches:[{clientX:-2000,clientY:-2000}]});
   assert.equal(c.panX,p.data.boardWidth-p.data.baseWidth);assert.equal(c.panY,p.data.boardHeight-p.data.boardWindowHeight);
   await act('zoom');assert(!c.zoom);assert(!c.panMode);assert.equal(p.boardPan,null);assert.equal(c.panX,0);assert.equal(c.panY,0);
   assert.equal(p.data.boardWidth,p.data.baseWidth);assert.equal(p.data.boardHeight,p.data.baseWidth*.75);
   p.scroll({currentTarget:{dataset:{area:'board'}},detail:{scrollLeft:100,scrollTop:50}});assert.equal(c.panX,0,'Stale native scroll cannot undo fit');
   p.touchMove({touches:[{clientX:0,clientY:0}]});assert.equal(c.panX,0);assert.equal(JSON.stringify(c.positions),original);
   p.renderer.hit=()=>null;
  }
 }
}
(async()=>{
 trayGestures();
 previewGestures();
 await boardGestures();
 const p=page(),original=JSON.stringify(p.store.state.current);
 const preview=p.preview();p.closePreview();sceneResolve('/late-preview');await preview;assert(!p.data.previewOpen);assert.equal(p.data.previewPath,'');assert.equal(JSON.stringify(p.store.state.current),original);
 const failed=p.preview();sceneReject(Error('offline'));await failed;assert.equal(p.data.previewError,'offline');assert.equal(p.data.previewLoading,false);p.closePreview();assert.equal(p.data.previewError,'');
 const confirm=p.modal('重新开始','会替换进度','开始');p.modalCancel();assert.equal(await confirm,false);assert.equal(JSON.stringify(p.store.state.current),original);
 let confirmFlow=p.act({currentTarget:{dataset:{action:'submit'}}});await Promise.resolve();assert.equal(p.data.modalTitle,'还没有摆放完整');p.modalConfirm();await confirmFlow;assert.equal(p.screen,'puzzle');assert.equal(p.store.state.current.submitResult,'incomplete');
 const backup=Store.clone(p.store.state.current);p.store.draft();const item=p.store.addImage('source',1000,600);Object.assign(item,{image:'scene',sceneKey:'crop',difficulty:24});p.store.trial(item);p.storyID=p.store.state.current.storyID;p.data.count=24;p.puzzleKey=p.storyID+':24';
 await p.start(true);assert(p.store.state.current.trial,'Restart inside a trial must remain isolated');p.store.endTrial();assert.deepEqual(p.store.state.current,backup);
 const load=p.loadPuzzle();p.go('home');sceneResolve('/scene');await load;assert.equal(p.screen,'home');assert(!p.loadingPuzzle);assert.equal(p.data.busy,false);
 item.quiz={enabled:true,question:'问题',options:['甲','甲','乙'],answer:0};assert.throws(()=>p.store.trial(item),/不重复/);assert.deepEqual(p.store.state.current,backup);
 console.log('Passed page flows: bidirectional/diagonal preview gestures, boundaries, cancellation and progress preservation; 12/24/48 isolated tray gestures; delayed preview cancellation, retry, confirmation, submission, trial restart, scene-load exit and invalid quizzes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
