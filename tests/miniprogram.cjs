'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),Shared=require('../miniprogram/shared'),{createStore,clone,KEY}=require('../miniprogram/store');
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
let persisted,fail=false;
const api={getStorageSync:()=>persisted&&clone(persisted),setStorageSync:(_,s)=>{if(fail)throw Error('quota');persisted=clone(s);}};
let store=createStore(api);
store.state.completed=[];store.state.collected=[];store.state.current=null;store.save();
check('24 scenes have matching full images, thumbnails, unique IDs and valid quizzes',()=>{
 assert.equal(Shared.stories.length,24);assert.equal(new Set(Shared.stories.map(s=>s.id)).size,24);
 for(const s of Shared.stories){assert(s.options.includes(s.person));assert.equal(new Set(s.options).size,3);assert(s.summary&&s.ref);const n=Shared.sceneNames[s.id-1],p='artworks-'+String.fromCharCode(97+Math.floor((s.id-1)/2));assert(fs.existsSync(root+'/miniprogram/'+p+'/assets/'+n+'.jpg'));assert(fs.existsSync(root+'/miniprogram/assets/'+n+'.jpg'));}
 assert.deepEqual(fs.readFileSync(root+'/web/shared.js'),fs.readFileSync(root+'/miniprogram/shared.js'));
});
check('All difficulties preserve incorrect layouts, swap occupants and require submit',()=>{
 for(const count of Shared.difficulties){store.start(24,count);const c=store.state.current,{cols,rows}=Shared.gridFor(count);
 for(let i=0;i<count;i++){const slot=i===0?1:i===1?0:i;Shared.dropPiece(c,i,(slot%cols+.5)/cols,(Math.floor(slot/cols)+.5)/rows);}
 const before=clone(c.positions),completedBefore=store.state.completed.length;assert.equal(store.submit(),'incorrect');assert.deepEqual(c.positions,before);assert.equal(store.state.completed.length,completedBefore);
 Shared.dropPiece(c,0,.5/cols,.5/rows);assert.equal(c.positions[1].slot,1);assert.equal(store.submit(),'correct');assert.equal(c.phase,'guess');
 }
});
check('Restart restores exact positions and tray order',()=>{store.start(7,48);Shared.dropPiece(store.state.current,13,.2,.6);store.state.current.trayScroll=111;store.save();const saved=clone(store.state.current);store=createStore(api);assert.deepEqual(store.state.current,saved);});
let first,set;
check('Personal image versions and deleted-set history remain playable',()=>{
 store.draft();store.state.draft.name='我的画册';const i=store.addImage('source-a',1200,900);i.image='image-a';i.sceneKey='scene-a';i.title='第一张';set=store.commit();first=set.items[0].version;store.start(first,12);
 store.draft(set.id);const item=store.state.draft.items[0];item.source='source-b';item.image='image-b';item.sceneKey='scene-b';const second=store.commit();assert.notEqual(second.items[0].version,first);assert.equal(store.story(first).image,'image-a');assert.equal(store.state.current.storyID,first);
 store.state.sets=[];store.save();assert.equal(store.story(first).image,'image-a');
});
check('Trial survives cold launch without altering progress or favorites',()=>{
 store.state.collected.push(first);store.save();const before=clone(store.state.current),completed=clone(store.state.completed);store.trial({...store.state.versions[0],difficulty:12});
 const c=store.state.current;for(let id=0;id<12;id++)Shared.dropPiece(c,id,(id%4+.5)/4,(Math.floor(id/4)+.5)/3);store.submit();assert.deepEqual(store.state.completed,completed);
 store=createStore(api);assert.deepEqual(store.state.current,before);assert(store.state.collected.includes(first));assert(!store.state.versions.some(v=>String(v.id).startsWith('trial-')));
});
check('Quota failure rolls back library commit and new game, retaining draft',()=>{
 store.draft();store.state.draft.name='保存失败测试';const item=store.addImage('source',1000,800);item.image='image';item.sceneKey='new';const before=clone(store.state);fail=true;
 assert.throws(()=>store.commit());assert.deepEqual(store.state,before);assert.throws(()=>store.start(2,24));assert.deepEqual(store.state,before);fail=false;
});
check('Invalid saves cannot overwrite storage until explicit reset',()=>{persisted={broken:true};const s=createStore(api);assert(s.blocked);assert.throws(()=>s.save());assert.deepEqual(persisted,{broken:true});s.recover();assert(!s.blocked);});
check('Page can place selected pieces into occupied cells without correctness feedback',()=>{
 let definition;const wx={setNavigationBarTitle(){},nextTick(){},pageScrollTo(){},getWindowInfo(){return {pixelRatio:1};}};
 vm.runInNewContext(fs.readFileSync(root+'/miniprogram/pages/index/index.js','utf8'),{require:p=>require(path.resolve(root+'/miniprogram/pages/index',p)),Page:p=>definition=p,wx,setTimeout,clearTimeout});
 const p={...definition,data:clone(definition.data),store:createStore(api),storyID:1,screen:'puzzle',setData(update){Object.assign(this.data,update);},renderer:{draw(){},hit(){return 1;}},feedback(){},measure(){}};
 p.store.start(1,12);const c=p.store.state.current;Shared.dropPiece(c,1,.4,.1);p.data.selected=0;p.boardRect={left:0,top:0,width:400,height:300};p.boardStart({touches:[{clientX:150,clientY:50}]});p.touchEnd({changedTouches:[{clientX:150,clientY:50}]});assert.equal(c.positions[0].slot,1);assert(!c.positions[1]);assert.equal(c.submitResult,'');
});
check('Release keeps a snapped preview at the exact board coordinates until rendering catches up',()=>{
 let definition;
 vm.runInNewContext(fs.readFileSync(root+'/miniprogram/pages/index/index.js','utf8'),{require:p=>require(path.resolve(root+'/miniprogram/pages/index',p)),Page:p=>definition=p,wx:{setNavigationBarTitle(){},nextTick(){}},setTimeout,clearTimeout});
 for(const count of [12,24,48]){
  let draws=0;const updates=[];
  const p={...definition,data:clone(definition.data),store:createStore(api),storyID:1,screen:'puzzle',setData(update){updates.push(update);Object.assign(this.data,update);},renderer:{draw(){draws++;}},feedback(){},measure(){}};
  p.store.start(1,count);const c=p.store.state.current,{cols,rows}=Shared.gridFor(count),cw=335/cols,ch=251.25/rows;
  p.boardRect={left:16.5,top:203.25,right:351.5,bottom:454.5,width:335,height:251.25};p.boardView=p.boardRect;
  const start={clientX:100,clientY:550},end={clientX:16.5+cw*1.5,clientY:203.25+ch*1.5+24};
  p.trayStart({currentTarget:{dataset:{id:0}},touches:[start]});p.trayLong();p.touchMove({touches:[end]});
  updates.length=0;p.touchEnd({changedTouches:[end]});
  assert.equal(c.positions[0].slot,cols+1);assert.equal(p.drag,null);assert(p.handoff);
  assert(p.data.ghost&&p.data.ghost.settled,'Released piece must remain visible while the board image is pending');
  assert(Math.abs(p.data.ghost.left+p.data.ghost.width*22/144-(16.5+cw))<1e-9);
  assert(Math.abs(p.data.ghost.top+p.data.ghost.height*22/144-(203.25+ch))<1e-9);
  assert(!updates.some(update=>Object.hasOwn(update,'ghost')&&update.ghost===null),'No empty preview between release and the board handoff');
  const placed=JSON.stringify(c.positions);p.cancelDrag();assert.equal(p.data.ghost,null);assert.equal(p.handoff,null);assert.equal(JSON.stringify(c.positions),placed);
  p.drag={id:0,active:true,board:true};p.data.ghost={id:0};const before=draws;p.cancelDrag();assert.equal(draws,before+1,'Cancelling a lifted board piece restores its original image');
 }
});
console.log(JSON.stringify({checks,errors:[]},null,2));
