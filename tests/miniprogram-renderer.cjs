'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Shared=require('../miniprogram/shared'),root=path.resolve(__dirname,'..');
let view={width:1600,height:1200},painted=0,failExport=false;
const context=new Proxy({drawImage(){painted++;}},{get:(obj,key)=>obj[key]||(()=>{})});
const board={getContext:()=>context},cache={getContext:()=>context};
const Media={
  async node(_,selector){return {node:selector==='#board-renderer'?board:cache};},
  async image(){return {};},
  async invoke(method,args){
    assert.equal(method,'canvasToTempFilePath');
    // Native export uses CSS coordinates, not just the backing pixel dimensions.
    assert.equal(view.width,cache.width,'Export must wait until the view width matches its backing width');
    assert.equal(view.height,cache.height,'Export must include every atlas row in view coordinates');
    assert.equal(args.width,view.width);assert.equal(args.height,view.height);
    assert.equal(painted,cache.height/144*4,'Every piece must be painted before export');
    if(failExport)throw Error('export failed');
    return {tempFilePath:'atlas-'+cache.height};
  }
};
let moduleObject={exports:{}};
vm.runInNewContext(fs.readFileSync(root+'/miniprogram/renderer.js','utf8'),{
  require:p=>p==='./shared'?Shared:Media,module:moduleObject,Promise,wx:{getWindowInfo:()=>({pixelRatio:2})}
});
const Renderer=moduleObject.exports;
const page={data:{},setData(data,callback){
  Object.assign(this.data,data);
  if(callback)queueMicrotask(()=>{view={width:data.atlasWidth,height:data.atlasHeight};callback();});
}};
(async()=>{
  const renderer=new Renderer(page);renderer.draw=()=>{};
  for(const count of [12,24,48]){
    painted=0;await renderer.init('scene',count);
    assert.equal(page.data.atlas,'atlas-'+count/4*144);
    assert.equal(page.data.atlasRows,count/4);
  }
  const before=page.data.atlas;failExport=true;painted=0;
  await assert.rejects(renderer.init('other-scene',12),/export failed/);
  assert.equal(page.data.atlas,before,'A failed export must not replace the visible atlas');
  failExport=false;painted=0;await renderer.init('other-scene',12);
  assert.equal(page.data.atlas,'atlas-432','Failed exports can be retried');
  const pending=renderer.init('cancelled-scene',48);renderer.dispose();await pending;
  assert.equal(page.data.atlas,'atlas-432','Leaving the page cannot publish a stale atlas');
  const exports=[],current={count:12,placed:[],positions:{}};
  Media.invoke=async(method,args)=>new Promise((resolve,reject)=>exports.push({args,resolve,reject}));
  const boardUpdates=[];
  const boardPage={data:{boardWidth:350},store:{state:{current}},setData(data,callback){boardUpdates.push(data);Object.assign(this.data,data);if(callback)queueMicrotask(callback);},fail(e){throw e;}};
  const boardRenderer=new Renderer(boardPage);boardRenderer.canvas=board;boardRenderer.ctx=context;boardRenderer.img={};
  boardRenderer.viewWidth=350;boardRenderer.viewHeight=262.5;
  const older=boardRenderer.draw(),newer=boardRenderer.draw();
  assert.equal(exports[0].args.width,350);assert.equal(exports[0].args.destWidth,700);
  exports[1].resolve({tempFilePath:'new-frame'});await newer;
  exports[0].resolve({tempFilePath:'old-frame'});await older;
  assert.equal(boardPage.data.boardFrames[1].src,'new-frame','Out-of-order exports cannot replace the latest board image');
  assert.equal(boardPage.data.boardFront,undefined,'Export alone must not show an undecoded image');
  boardRenderer.frameReady(1,'old-frame');assert.equal(boardPage.data.boardFront,undefined);
  boardRenderer.frameReady(1,'new-frame');assert.equal(boardPage.data.boardFront,1);
  const next=boardRenderer.draw();exports[2].resolve({tempFilePath:'next-frame'});await next;
  assert.equal(boardPage.data.boardFrames[1].src,'new-frame','The previous image remains loaded while its replacement decodes');
  assert.equal(boardPage.data.boardFront,1,'The old frame remains visible while its replacement decodes');
  boardRenderer.frameReady(0,'next-frame');assert.equal(boardPage.data.boardFront,0);
  boardPage.handoff={};boardPage.data.ghost={id:0,settled:true};
  const landing=boardRenderer.draw();exports[3].resolve({tempFilePath:'landed-frame'});await landing;
  assert(boardPage.data.ghost,'The landing preview survives export and decoding');
  boardRenderer.frameReady(0,'next-frame');assert(boardPage.data.ghost,'An older frame cannot remove the landing preview');
  boardRenderer.frameReady(1,'landed-frame');assert.equal(boardPage.data.ghost,null);assert.equal(boardPage.handoff,null);
  assert.equal(boardUpdates.at(-1).boardFront,1);assert(Object.hasOwn(boardUpdates.at(-1),'ghost'),'Board visibility and preview removal must be one update');
  boardPage.handoff={};boardPage.data.ghost={id:1,settled:true};
  const previousLanding=boardRenderer.draw();exports[4].resolve({tempFilePath:'previous-landing'});await previousLanding;
  boardPage.handoff=null;boardPage.data.ghost={id:2};
  boardRenderer.frameReady(0,'previous-landing');assert.equal(boardPage.data.ghost.id,2,'A previous release cannot clear a new drag preview');
  const closing=boardRenderer.draw();boardRenderer.dispose();exports[5].resolve({tempFilePath:'closed-frame'});await closing;
  assert.equal(boardPage.data.boardFrames[0].src,'previous-landing','Exports finishing after exit cannot change the board');
  boardRenderer.frameReady(1,'closed-frame');assert.equal(boardPage.data.boardFront,0);
  // A rapid zoom -> fit must discard the zoom while its view update is pending.
  const commits=[],sizeExports=[];let viewWidth=350,viewHeight=262.5;
  const sizePage={data:{boardWidth:350,boardHeight:262.5},store:{state:{current}},setData(patch,callback){Object.assign(this.data,patch);if(callback)commits.push(()=>{viewWidth=patch.boardWidth;viewHeight=patch.boardHeight;callback();});},fail(e){throw e;}};
  const sizing=new Renderer(sizePage);sizing.canvas=board;sizing.ctx=context;sizing.img={};sizing.viewWidth=350;sizing.viewHeight=262.5;
  Media.invoke=async(method,args)=>{assert.equal(args.width,viewWidth,'Export must match the committed board view width');assert.equal(args.height,viewHeight);sizeExports.push(args.width);return {tempFilePath:'size-'+args.width};};
  sizePage.data.boardWidth=577.5;const zoom=sizing.draw();assert.equal(sizeExports.length,0,'Zoom waits for view commit');
  sizePage.data.boardWidth=350;const fit=sizing.draw();assert.equal(sizeExports.length,0);
  commits.shift()();await zoom;commits.shift()();await fit;
  assert.deepEqual(sizeExports,[350],'Late zoom must not replace fit');sizing.frameReady(1,'size-350');
  for(let n=0;n<3;n++){
   sizePage.data.boardWidth=577.5;const enlarge=sizing.draw();commits.shift()();await enlarge;
   sizePage.data.boardWidth=350;const shrink=sizing.draw();commits.shift()();await shrink;
   assert.equal(sizing.pendingFrame.src,'size-350','Repeated fit must always produce the full-size frame');
  }
  console.log('Passed rendering: three atlas grids, board view sizing and rapid/repeated zoom-fit, retry, cancellation and asynchronous board frames.');
})().catch(e=>{console.error(e);process.exitCode=1;});
