// Dispatch real WXML element touch events, rather than calling page handlers.
// All test progress is isolated behind wx storage mocks and restored in finally.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,call,data,method,evaluate}=require('../scripts/wechat-cli.cjs');
const Shared=require('../miniprogram/shared');
const out=path.join(root,'test-results/miniprogram');
const report={date:new Date().toISOString(),checks:[],errors:[],userStorageUnchanged:false};
const act=(action,arg)=>method('act',{currentTarget:{dataset:{action,arg}}});
const element=(action,selector,options={})=>call('automation_element_action',{action,selector,...options});
const touch=(action,selector,x,y)=>element(action,selector,{
 [action==='touchend'?'changed-touches-file':'touches-file']:[{identifier:0,clientX:x,clientY:y,pageX:x,pageY:y}]
});
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
let original,isolated=false;
try{
 fs.mkdirSync(out,{recursive:true});
 element('size','.page',{wait:2});
 assert.equal(data('screen'),'home','Open the main home page before testing');
 original=evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}");
 fs.writeFileSync(path.join(root,'work/qa-touch-user-backup.json'),JSON.stringify(original,null,2));
 evaluate('function(value){globalThis.__touchQA=value;return true;}',original);
 call('automation_wx_api',{action:'mock',method:'setStorageSync','function-declaration':
  "function(key,value){if(key==='picture-puzzle-wechat-v1')globalThis.__touchQA=JSON.parse(JSON.stringify(value));}"});
 isolated=true;
 call('automation_wx_api',{action:'mock',method:'getStorageSync','function-declaration':
  "function(key){return key==='picture-puzzle-wechat-v1'?globalThis.__touchQA:undefined;}"});
 for(const count of [12,24,48])check(count+' pieces: direct vertical drag without long press, tray bounds, cancellation and scroll lock',()=>{
  act('go','home');
  const state=JSON.parse(JSON.stringify(original));state.welcomed=true;
  state.current=Shared.createGame(1,count);state.settings={sound:false,haptic:false};
  state.trialBackup=null; // Never restore a test's old trial into the real game.
  evaluate('function(value){globalThis.__touchQA=value;return true;}',state);
  act('readAgain');act('resume');element('size','#board',{wait:2});
  assert.equal(data('busy'),false);assert.equal(data('error'),'');method('measure');
  const selector='.piece',id=data('tray')[0].id;
  const rect=element('offset',selector),size=element('size',selector);
  const x=rect.left+size.width/2,y=rect.top+size.height/2;
  const boardTop=element('offset','#board').top,before=JSON.stringify(data('current').positions);
  const browse='.tray-summary';
  touch('touchstart',browse,x,y);touch('touchmove',browse,x,y-60);
  assert.equal(data('dragging'),false);assert.equal(data('current').trayScroll,count===12?0:60);
  assert.equal(element('offset','#board').top,boardTop,'Browsing the tray must not shift the page');
  touch('touchmove',browse,x,y-1000);
  assert.equal(data('current').trayScroll,Math.max(0,count/4*54-216));
  touch('touchmove',browse,x,y+1000);assert.equal(data('current').trayScroll,0);
  touch('touchend',browse,x,y+1000);
  assert.equal(JSON.stringify(data('current').positions),before);
  touch('touchstart',selector,x,y);touch('touchmove',selector,x,y-15);
  assert.equal(data('dragging'),true);
  assert.match(element('attribute','page-meta',{name:'page-style'}),/overflow:\s*hidden/);
  touch('touchmove',selector,x,y-150);assert(data('ghost'));assert.equal(data('current').trayScroll,0);
  assert.equal(element('offset','#board').top,boardTop,'Dragging must not shift the page');
  element('trigger',selector,{type:'touchcancel'});
  assert.equal(data('dragging'),false);assert.equal(data('ghost'),null);
  assert.equal(element('attribute','page-meta',{name:'page-style'}),'');
  assert.equal(JSON.stringify(data('current').positions),before);
  const r=element('offset','#board'),s=element('size','#board'),g=Shared.gridFor(count);
  touch('touchstart',selector,x,y);
  const endX=r.left+s.width/(2*g.cols),endY=r.top+s.height/(2*g.rows)+24;
  touch('touchmove',selector,endX,endY);touch('touchend',selector,endX,endY);
  assert.equal(data('current').positions[id].slot,0);assert.equal(data('dragging'),false);
  assert.equal(element('offset','#board').top,boardTop);
  call('simulator_screenshot',{path:path.join(out,'wechat-touch-'+count+'.png'),optimize:'false'});
 });
 check('Zoom browse and story page scroll are still available',()=>{
  act('zoom');act('pan');method('boardStart',{touches:[{clientX:200,clientY:300}]});method('touchMove',{touches:[{clientX:120,clientY:260}]});method('touchEnd',{changedTouches:[{clientX:120,clientY:260}]});
  assert(data('current').panMode);assert(data('current').panY>0);
  act('go','list');call('automation_viewport_action',{action:'pageScrollTo','scroll-top':150});
  assert.equal(data('dragging'),false);assert.equal(element('attribute','page-meta',{name:'page-style'}),'');
  assert(element('offset','.page').top<0,'Reading/list pages must still scroll');
 });
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{
 try{if(isolated){
  try{method('cancelDrag');}catch(e){report.errors.push('cancel: '+e.message);}
  call('automation_wx_api',{action:'restore',method:'getStorageSync'});
  act('readAgain'); // Reload the real store before allowing any real writes.
  call('automation_wx_api',{action:'restore',method:'setStorageSync'});
  act('go','home');
  assert.deepEqual(evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}"),original);
  report.userStorageUnchanged=true;
 }}catch(e){report.errors.push('cleanup: '+e.stack);process.exitCode=1;}
 fs.writeFileSync(path.join(out,'wechat-touch-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
