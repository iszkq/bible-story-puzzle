// Exercises element touch events in the real WeChat preview. No test games or
// storage mocks: viewing the existing scene must leave the saved game intact.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,call,data,evaluate}=require('../scripts/wechat-cli.cjs');
const report={date:new Date().toISOString(),checks:[],errors:[]};
const out=path.join(root,'test-results/miniprogram');fs.mkdirSync(out,{recursive:true});
const el=(action,selector,options={})=>call('automation_element_action',{action,selector,...options});
const tap=selector=>el('tap',selector,{wait:.2});
const shot=name=>call('simulator_screenshot',{path:path.join(out,name+'.png'),optimize:'false'});
const saved=()=>evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}");
const touch=(action,x,y)=>el(action,'.preview-window',{
 'touches-file':action==='touchend'?[]:[{identifier:0,clientX:x,clientY:y,pageX:x,pageY:y}],
 'changed-touches-file':[{identifier:0,clientX:x,clientY:y,pageX:x,pageY:y}]
});
let original,origin;
try{
 original=saved();
 const html=el('outerWxml','.page');origin=html.includes('has-tabs')?'home':'puzzle';
 if(origin==='home')tap('[data-action=resume]');
 try{el('size','.preview-window');}catch(e){tap('[data-action=preview]');}
 el('size','.preview-window',{wait:2});
 if(el('text','.preview-tools .link')==='放大图片')tap('.preview-tools .link');
 const viewport=el('size','.preview-window'),image=el('size','.preview-art');
 const width=viewport.width,maxX=image.width-width,maxY=image.height-viewport.height;
 assert(maxX>0);assert(maxY>0);
 const rect=el('offset','.preview-window'),x=rect.left+width*.75,y=rect.top+100;
 shot('wechat-preview-pan-before');
 touch('touchstart',x,y);touch('touchmove',x-100,y);
 touch('touchend',x-100,y);
 const imageLeft=el('offset','.preview-art',{wait:.3}).left;
 assert(Math.abs(imageLeft-(rect.left-100))<2,'The visible image must move horizontally, not only update page data');
 report.checks.push('Horizontal element gesture moves the visible enlarged image');
 for(let n=0;n<Math.ceil(Math.max(maxX/180,maxY/80))+1;n++){
  touch('touchstart',x,y);touch('touchmove',x-180,y-80);touch('touchend',x-180,y-80);
 }
 const corner=el('offset','.preview-art',{wait:.3});
 assert(Math.abs(corner.left-(rect.left-maxX))<2);assert(Math.abs(corner.top-(rect.top-maxY))<2);
 shot('wechat-preview-pan-bottom-right');report.checks.push('Diagonal pan reaches the bottom-right corner and clamps at both edges');
 const reverseX=rect.left+60,reverseY=rect.top+40;
 for(let n=0;n<Math.ceil(Math.max(maxX/180,maxY/80))+1;n++){
  touch('touchstart',reverseX,reverseY);touch('touchmove',reverseX+180,reverseY+80);touch('touchend',reverseX+180,reverseY+80);
 }
 const home=el('offset','.preview-art',{wait:.3});assert(Math.abs(home.left-rect.left)<2);assert(Math.abs(home.top-rect.top)<2);
 tap('.preview-tools .link');assert.equal(el('text','.preview-tools .link'),'放大图片');
 tap('.preview-shade .primary');
 assert.deepEqual(saved(),original);report.checks.push('Fit and return preserve the full saved puzzle');
 console.log('PASS '+report.checks.join('; '));
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{
 try{
  try{el('size','.preview-window');tap('.preview-shade .primary');}catch(e){}
  if(origin==='home'&&!el('outerWxml','.page').includes('has-tabs'))tap('[data-action=exit]');
  if(original)assert.deepEqual(saved(),original);
 }catch(e){report.errors.push('cleanup: '+e.stack);process.exitCode=1;}
 fs.writeFileSync(path.join(out,'wechat-preview-pan-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
