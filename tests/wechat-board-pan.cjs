'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,call,evaluate}=require('../scripts/wechat-cli.cjs');
const report={date:new Date().toISOString(),checks:[],errors:[]};
const el=(action,selector,options={})=>call('automation_element_action',{action,selector,...options});
const tap=selector=>el('tap',selector,{wait:.2});
const saved=()=>evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}");
const touch=(action,x,y)=>el(action,'#board',{
 'touches-file':action==='touchend'?[]:[{identifier:0,clientX:x,clientY:y,pageX:x,pageY:y}],
 'changed-touches-file':[{identifier:0,clientX:x,clientY:y,pageX:x,pageY:y}]
});
const zoom=()=>tap('[data-action=zoom]'),pan=()=>tap('[data-action=pan]');
let original,origin;
try{
 original=saved();assert(original.current,'This test browses an existing game');
 assert.equal(original.current.panX,0);assert.equal(original.current.panY,0,'Restore arbitrary nonzero offsets manually before this visual check');
 origin=el('outerWxml','.page').includes('has-tabs')?'home':'puzzle';
 if(origin==='home')tap('[data-action=resume]');
 const viewport=el('size','#board-window',{wait:2});
 for(let n=0;n<3;n++){
  if(el('text','[data-action=zoom]')==='适合画框')zoom();
  let board=el('size','#board',{wait:.5});assert(Math.abs(board.width-viewport.width+2)<3);assert(Math.abs(board.height-board.width*.75)<1);
  zoom();board=el('size','#board',{wait:1});assert(board.width>viewport.width);
  if(el('text','[data-action=pan]')==='浏览棋盘')pan();
  const rect=el('offset','#board-window'),before=el('offset','#board'),x=rect.left+200,y=rect.top+160;
  touch('touchstart',x,y);touch('touchmove',x-80,y-40);touch('touchend',x-80,y-40);
  const moved=el('offset','#board',{wait:.3});assert(Math.abs(moved.left-before.left+80)<2);assert(Math.abs(moved.top-before.top+40)<2);
  zoom();board=el('size','#board',{wait:1});const fit=el('offset','#board');
  assert(Math.abs(board.width-viewport.width+2)<3);assert(Math.abs(fit.left-rect.left-1)<2);assert(Math.abs(fit.top-rect.top-1)<2);
  const source=el('attribute','.board-frame-visible',{name:'data-src'});
  const image=evaluate('function(src){return new Promise((resolve,reject)=>wx.getImageInfo({src,success:resolve,fail:reject}));}',source);
  assert(Math.abs(image.width/image.height-4/3)<.01,'Fit must show a complete 4:3 rendered frame');
  assert.deepEqual(saved().current.positions,original.current.positions);
  report.checks.push('Cycle '+(n+1)+': actual two-axis board movement, fit size/origin and full 4:3 frame');
 }
 call('simulator_screenshot',{path:path.join(root,'test-results/miniprogram/wechat-board-fit.png'),optimize:'false'});
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{
 try{
  if(original){
   const currentZoom=el('text','[data-action=zoom]')==='适合画框';
   if(currentZoom)zoom(); // All restored offsets are zero.
   if(original.current.zoom){zoom();if(original.current.panMode)pan();}
   if(origin==='home')tap('[data-action=exit]');
   assert.deepEqual(saved(),original);report.checks.push('User game restored exactly');
  }
 }catch(e){report.errors.push('cleanup: '+e.stack);process.exitCode=1;}
 fs.writeFileSync(path.join(root,'test-results/miniprogram/wechat-board-pan-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
