'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),Store=require('../miniprogram/store');
let definition,sceneResolve,sceneReject;
const Media={scene:()=>new Promise((resolve,reject)=>{sceneResolve=resolve;sceneReject=reject;}),thumb:()=>'/thumb'};
const wx={setNavigationBarTitle(){},nextTick(){},pageScrollTo(){},showToast(){}};
vm.runInNewContext(fs.readFileSync(root+'/miniprogram/pages/index/index.js','utf8'),{require:p=>p==='../../media'?Media:require(path.resolve(root+'/miniprogram/pages/index',p)),Page:p=>definition=p,wx,setTimeout,clearTimeout});
function page(){const store=Store.createStore({getStorageSync(){},setStorageSync(){}});store.start(1,12);return {...definition,store,screen:'puzzle',storyID:1,data:Store.clone(definition.data),renderer:{ctx:{},draw(){},dispose(){}},puzzleKey:'1:12',setData(update){Object.assign(this.data,update);},loadHome(){},loadScene(){},measure(){},feedback(){}};}
(async()=>{
 const p=page(),original=JSON.stringify(p.store.state.current);
 const preview=p.preview();p.closePreview();sceneResolve('/late-preview');await preview;assert(!p.data.previewOpen);assert.equal(p.data.previewPath,'');assert.equal(JSON.stringify(p.store.state.current),original);
 const failed=p.preview();sceneReject(Error('offline'));await failed;assert.equal(p.data.previewError,'offline');assert.equal(p.data.previewLoading,false);p.closePreview();assert.equal(p.data.previewError,'');
 const confirm=p.modal('重新开始','会替换进度','开始');p.modalCancel();assert.equal(await confirm,false);assert.equal(JSON.stringify(p.store.state.current),original);
 let confirmFlow=p.act({currentTarget:{dataset:{action:'submit'}}});await Promise.resolve();assert.equal(p.data.modalTitle,'还没有摆放完整');p.modalConfirm();await confirmFlow;assert.equal(p.screen,'puzzle');assert.equal(p.store.state.current.submitResult,'incomplete');
 const backup=Store.clone(p.store.state.current);p.store.draft();const item=p.store.addImage('source',1000,600);Object.assign(item,{image:'scene',sceneKey:'crop',difficulty:24});p.store.trial(item);p.storyID=p.store.state.current.storyID;p.data.count=24;p.puzzleKey=p.storyID+':24';
 await p.start(true);assert(p.store.state.current.trial,'Restart inside a trial must remain isolated');p.store.endTrial();assert.deepEqual(p.store.state.current,backup);
 const load=p.loadPuzzle();p.go('home');sceneResolve('/scene');await load;assert.equal(p.screen,'home');assert(!p.loadingPuzzle);assert.equal(p.data.busy,false);
 item.quiz={enabled:true,question:'问题',options:['甲','甲','乙'],answer:0};assert.throws(()=>p.store.trial(item),/不重复/);assert.deepEqual(p.store.state.current,backup);
 console.log('Passed page flows: delayed preview cancellation, retry, canceled confirmation, incomplete submission, isolated trial restart, scene-load exit and invalid quizzes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
