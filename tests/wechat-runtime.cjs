// Run against an already authorized WeChat IDE. The real user storage is never
// written: wx sync storage APIs are intercepted for the duration of this suite.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,call,data,method,evaluate}=require('../scripts/wechat-cli.cjs');
const Shared=require('../miniprogram/shared');
const report={date:new Date().toISOString(),runtime:'WeChat IDE 3.7.12',checks:[],errors:[],screenshots:[]};
const out=path.join(root,'test-results/miniprogram');fs.mkdirSync(out,{recursive:true});
const clone=x=>JSON.parse(JSON.stringify(x));
const act=(action,arg)=>method('act',{currentTarget:{dataset:{action,arg}}});
const tap=selector=>call('automation_element_action',{action:'tap',selector,wait:.2});
const field=(target,field,value,number=false)=>method('field',{currentTarget:{dataset:{target,field,number}},detail:{value}});
const shot=name=>{call('simulator_screenshot',{path:path.join(out,name+'.png'),optimize:'false'});report.screenshots.push(name+'.png');};
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);fs.writeFileSync(path.join(out,'wechat-runtime-report.json'),JSON.stringify(report,null,2));};
const state=()=>evaluate('function(){return globalThis.__puzzleQA;}');
const setState=s=>{act('go','home');evaluate('function(value){globalThis.__puzzleQA=value;return true;}',s);act('readAgain');};
const assertClean=()=>{assert.equal(data('error'),'');assert.equal(data('busy'),false);};
function awaitReady(){call('automation_element_action',{action:'size',selector:'#board',wait:2});for(let n=0;n<8;n++){if(!data('busy')){assertClean();return;}}throw Error('Puzzle stayed busy');}
function game(count=12,id=1){const s=state();s.current=Shared.createGame(id,count);s.welcomed=true;setState(s);act('go','home');act('resume');awaitReady();return data('current');}
function snapshot(){return JSON.stringify(data('current'));}
function touchDrop(id,slot,count){
 const rect=call('automation_element_action',{action:'offset',selector:'#board',wait:1}),size=call('automation_element_action',{action:'size',selector:'#board',wait:.2}),g=Shared.gridFor(count);
 const x=rect.left+(slot%g.cols+.5)*size.width/g.cols,y=rect.top+(Math.floor(slot/g.cols)+.5)*size.height/g.rows+24;
 method('measure');
 method('trayStart',{currentTarget:{dataset:{id}},touches:[{clientX:50,clientY:600}]});method('trayLong');method('touchMove',{touches:[{clientX:x,clientY:y}]});method('touchEnd',{changedTouches:[{clientX:x,clientY:y}]});
 const c=data('current');if(!c.positions[id]){console.log({rect,size,x,y,ghost:data('ghost'),busy:data('busy')});shot('failed-drop');}assert(c.positions[id],`piece ${id} was not placed`);assert.equal(c.positions[id].slot,slot);assert.equal(c.submitResult,'');
}
let original,isolated=false;
try{
 call('automation_element_action',{action:'size',selector:'.page',wait:2});
 original=evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}");
 const visibleSession=data('current');
 if(visibleSession&&visibleSession.storyID)assert.deepEqual(original.current,visibleSession,'Wait until the original storage bridge matches the loaded page before testing');
 fs.writeFileSync(path.join(root,'work/qa-user-backup-final.json'),JSON.stringify(original,null,2));
 evaluate('function(){globalThis.__puzzleQA={welcomed:false,completed:[],collected:[],current:null,settings:{sound:false,haptic:false},sets:[],versions:[],draft:null,trialBackup:null};return true;}');
 call('automation_wx_api',{action:'mock',method:'getStorageSync','function-declaration':"function(key){return key==='picture-puzzle-wechat-v1'?globalThis.__puzzleQA:undefined;}"});
 call('automation_wx_api',{action:'mock',method:'setStorageSync','function-declaration':"function(key,value){if(key==='picture-puzzle-wechat-v1')globalThis.__puzzleQA=JSON.parse(JSON.stringify(value));}"});
 isolated=true;
 act('readAgain');act('go','welcome');
 if(!process.env.QA_CREATOR){
 check('Welcome, story library, locked scene and preparation',()=>{
  tap('[data-action=first]');assert.equal(data('screen'),'prepare');act('go','list');act('choose',2);assert.equal(data('screen'),'list');act('choose',1);assert.equal(data('screen'),'prepare');
 });
 check('iOS preview sheet: fit, zoom, scroll, close, same session',()=>{
  act('preview');assert.equal(data('previewOpen'),true);assert.equal(data('previewLoading'),false);assert.match(data('previewPath'),/moses.jpg/);shot('wechat-ios-preview-fit');
  method('previewZoom');assert.equal(data('previewLarge'),true);method('previewPanStart',{touches:[{clientX:250,clientY:250}]});method('previewPanMove',{touches:[{clientX:50,clientY:150}]});method('previewPanEnd');shot('wechat-ios-preview-zoom');method('previewZoom');method('closePreview');assert.equal(data('screen'),'prepare');
 });
 for(const count of (process.env.QA_GRID ? [Number(process.env.QA_GRID)] : [12,24,48]))check(count+' pieces: drag, neutral placement, occupied swap, cancel, adjustment, zoom, preview, pause/resume',()=>{
  game(count);touchDrop(0,1,count);touchDrop(1,1,count);let c=data('current');assert(!c.positions[0]);assert.equal(c.positions[1].slot,1);
  method('selectPiece',{currentTarget:{dataset:{id:1}}});act('adjust');act('move','right');act('return');assert(!data('current').positions[1]);act('closeAdjust');
  touchDrop(0,0,count);method('cancelDrag');const before=snapshot();act('preview');assert.equal(data('previewLoading'),false);method('closePreview');assert.equal(snapshot(),before);
  act('zoom');assert.equal(data('current').zoom,true);act('pan');assert.equal(data('current').panMode,true);method('boardStart',{touches:[{clientX:200,clientY:300}]});method('touchMove',{touches:[{clientX:100,clientY:250}]});method('touchEnd',{changedTouches:[{clientX:100,clientY:250}]});assert(data('current').panX>0);act('pan');act('zoom');
  tap('[data-action=pause]');assert.equal(data('modalTitle'),'已暂停');method('modalConfirm');assert.equal(data('screen'),'puzzle');
  const saved=snapshot();act('exit');act('resume');awaitReady();assert.equal(snapshot(),saved);assertClean();shot('wechat-full-'+count);
 });
 check('Incomplete / incorrect submit sheets preserve positions; correct submit, wrong/right answer, reveal, favorites and next',()=>{
  tap('[data-action=submit]');assert.equal(data('modalTitle'),'还没有摆放完整');method('modalConfirm');
  let s=state(),c=s.current,g=Shared.gridFor(c.count);for(let i=0;i<c.count;i++){const slot=i===0?1:i===1?0:i;Shared.dropPiece(c,i,(slot%g.cols+.5)/g.cols,(Math.floor(slot/g.cols)+.5)/g.rows);}setState(s);act('resume');awaitReady();const before=JSON.stringify(data('current').positions);
  tap('[data-action=submit]');assert.equal(data('modalTitle'),'还需要再调整一下');assert.equal(JSON.stringify(data('current').positions),before);method('modalPreview');assert(data('previewOpen'));method('closePreview');
  s=state();c=s.current;Shared.dropPiece(c,0,.5/g.cols,.5/g.rows);setState(s);act('resume');awaitReady();tap('[data-action=submit]');assert.equal(data('modalTitle'),'拼图正确');method('modalConfirm');assert.equal(data('screen'),'guess');
  const story=data('story');act('answer',story.options.find(o=>o!==story.person));act('confirm');assert.equal(data('current').result,'wrong');act('answer',story.person);act('confirm');assert.equal(data('current').result,'correct');act('reveal');assert.equal(data('screen'),'reveal');act('save');assert(data('collected'));shot('wechat-full-reveal');act('go','collection');act('choose',1);assert.equal(data('screen'),'detail');act('preview');method('closePreview');act('save');assert.equal(data('collected'),false);act('save');act('replay');assert.equal(data('screen'),'prepare');
 });
 check('All 24 official full-resolution scenes open in the same iOS preview sheet',()=>{
  const s=state();s.completed=Shared.stories.map(s=>s.id);setState(s);act('go','list');
  for(let id=1;id<=24;id++){act('choose',id);act('preview');assert.equal(data('previewLoading'),false,'scene '+id);assert.equal(data('previewError'),'','scene '+id);assert.match(data('previewPath'),new RegExp(Shared.sceneNames[id-1]+'.jpg'));method('closePreview');}
 });
 }else game(12);
 if(!process.env.QA_CORE){
 check('Create collection, empty-name validation and batch import of landscape / portrait photos',()=>{
  act('go','mysets');act('new');act('saveSet');assert.match(data('error'),/名称/);field('draft','name','自动化验收画册');field('draft','description','隔离存档，不会修改用户画册');
  const fixtures=require('./wechat-fixtures.cjs')();
  for(const f of fixtures)evaluate('function(f){wx.getFileSystemManager().writeFileSync(wx.env.USER_DATA_PATH+f.name,f.base64,\'base64\');return true;}',f);
  evaluate('function(){globalThis.__qaPhotos=[{tempFilePath:wx.env.USER_DATA_PATH+\'/qa-landscape.png\',size:10000},{tempFilePath:wx.env.USER_DATA_PATH+\'/qa-portrait.png\',size:10000}];return true;}');
  call('automation_wx_api',{action:'mock',method:'chooseMedia','function-declaration':'function(){return {tempFiles:globalThis.__qaPhotos,type:\'image\'};}'});
  act('add');assertClean();assert.equal(data('draft').items.length,2);
  const d=data('draft');assert.equal(d.items[0].width,1000);assert.equal(d.items[1].height,1000);
  for(const item of d.items){const info=call('automation_wx_api',{action:'call',method:'getImageInfo','args-file':[{src:item.source}]});assert.equal(info.width,item.width);assert.equal(info.height,item.height);const b=evaluate('function(p){return wx.getFileSystemManager().readFileSync(p,\'base64\');}',item.source);fs.writeFileSync(path.join(out,item.width>item.height?'import-landscape.png':'import-portrait.png'),Buffer.from(b,'base64'));}
 });
 check('Cover / ordering, crop / contain, quiz validation, all trial difficulties and restoration',()=>{
  let d=data('draft'),id=d.items[1].id;act('cover',id);act('up',id);assert.equal(data('draft').items[0].id,id);act('down',id);act('image',id);field('item','fit','contain');field('item','title','竖版全图');field('item','text','测试故事');field('item','reference','本地图片');
  const before=clone(state().current);
  for(const count of [12,24,48]){act('grid',count);act('trial');awaitReady();assert.equal(data('current').count,count);assert(data('trial'));act('exit');assert.equal(data('screen'),'imageedit');assert.deepEqual(state().current,before);}
  field('item','fit','crop');field('item','x',20,true);field('item','y',80,true);field('item','zoom',1.5,true);
  method('quizToggle',{detail:{value:true}});act('doneImage');act('saveSet');assert.match(data('error'),/题目/);act('image',id);field('quiz','question','选择正确选项');for(let i=0;i<3;i++)field('option',i,['甲','乙','丙'][i]);field('quiz','answer',1,true);act('doneImage');act('saveSet');assertClean();assert.equal(data('screen'),'setdetail');shot('wechat-full-setdetail');
 });
 check('Saved personal scene play, immutable crop versions, replace / remove, deleting set retains old session',()=>{
  const set=data('set'),version=set.items[0].version;act('choose',version);tap('[data-action=start]'); // May open replacement confirmation.
  if(data('modalOpen'))method('modalConfirm');awaitReady();assert.equal(data('current').storyID,version);act('exit');act('go','setdetail');act('editSet');const id=data('draft').items[0].id;act('image',id);field('item','zoom',2,true);act('doneImage');act('saveSet');assert.notEqual(data('set').items[0].version,version);assert.equal(state().current.storyID,version);
  act('editSet');act('image',id);act('replace');assertClean();tap('[data-action=removeImage]');method('modalConfirm');assert.equal(data('draft').items.length,1);tap('[data-action=discard]');method('modalConfirm');act('openSet',set.id);tap('[data-action=deleteSet]');method('modalConfirm');assert.equal(data('sets').length,0);act('go','home');act('resume');awaitReady();assert.equal(data('current').storyID,version);
 });
 check('Settings, storage/content panels, save failure recovery, damaged-index protection',()=>{
  act('exit');act('go','settings');method('preference',{currentTarget:{dataset:{key:'sound'}},detail:{value:true}});assert(data('settings').sound);tap('[data-action=storage]');assert.equal(data('modalTitle'),'本地存档');method('modalConfirm');tap('[data-action=content]');method('modalConfirm');
  call('automation_wx_api',{action:'mock',method:'setStorageSync','function-declaration':'function(){throw new Error(\'quota\');}'});method('preference',{currentTarget:{dataset:{key:'sound'}},detail:{value:false}});assert.match(data('error'),/保存/);
  call('automation_wx_api',{action:'mock',method:'setStorageSync','function-declaration':"function(key,value){if(key==='picture-puzzle-wechat-v1')globalThis.__puzzleQA=JSON.parse(JSON.stringify(value));}"});method('save');assertClean();
  const valid=state();setState({broken:true});assert(data('blocked'));method('save');assert(data('blocked'));assert.deepEqual(state(),{broken:true});setState(valid);assert.equal(data('blocked'),false);assertClean();
 });
 }
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{
 // Recreate the user's store while writes remain intercepted, then release
 // the interception. onHide/onUnload can only save the original user state.
 try{if(isolated){call('automation_wx_api',{action:'restore',method:'getStorageSync'});act('readAgain');for(const methodName of ['setStorageSync','chooseMedia'])call('automation_wx_api',{action:'restore',method:methodName});act('go','home');assert.deepEqual(evaluate("function(){return wx.getStorageSync('picture-puzzle-wechat-v1');}"),original);report.userStorageUnchanged=true;}}catch(e){report.errors.push('cleanup: '+e.stack);process.exitCode=1;}
 fs.writeFileSync(path.join(out,'wechat-runtime-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
