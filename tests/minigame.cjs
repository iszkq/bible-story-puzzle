'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(p,(e,data)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':p.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(data);});
});
const Shared=require('../minigame-project/shared'),{createStore,clone}=require('../minigame-project/store');
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({executablePath:process.env.PUZZLE_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const checks=[],errors=[];fs.mkdirSync(path.join(root,'test-results/minigame'),{recursive:true});
 try{
 for(const [w,h] of [[320,568],[375,667],[393,852],[430,932]]){
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2}),page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto('http://127.0.0.1:'+port+'/tests/minigame-harness.html');
  await page.waitForFunction(()=>window.app);
  const click=async label=>{const p=await page.evaluate(label=>{let r=app.ui.hits.find(h=>h.label===label&&h.h>=30);if(!r)for(let s=0;s<3000;s+=100){app.ui.scroll=s;app.draw();r=app.ui.hits.find(h=>h.label===label&&h.h>=30);if(r)break;}if(!r)throw Error('Missing control '+label);return {x:r.x+r.w/2,y:r.y+r.h/2};},label);await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>!app.ui.busy);};
  const ready=()=>page.waitForFunction(()=>!app.ui.busy&&app.ui.image);
  await page.screenshot({path:path.join(root,'test-results/minigame',w+'-welcome.png')});await page.evaluate(()=>app.go('home'));await page.waitForTimeout(100);
  await page.screenshot({path:path.join(root,'test-results/minigame',w+'-home.png')});
  await click('故事 1');await ready();await click('48块');await click('开始拼图');
  let geometry=await page.evaluate(()=>({board:app.ui.board,tray:app.ui.tray,hits:app.ui.hits,pages:app.store.state.current.trayPage}));
  assert.equal(geometry.board.viewport.w,w-32);assert.equal(geometry.board.viewport.h,(w-32)*.75);assert(geometry.board.viewport.y+geometry.board.viewport.h<=geometry.tray.y);assert.equal(geometry.tray.h,224);
  for(const r of geometry.hits){assert(r.x>=0&&r.x+r.w<=w+1);assert(r.y>=0&&r.y+r.h<=h);}
  const reachable=new Set();for(let scroll=0;scroll<=432;scroll+=54){for(const id of await page.evaluate(scroll=>{app.ui.scroll=300;app.store.state.current.trayScroll=scroll;app.draw();return app.ui.hits.filter(h=>h.piece!==undefined).map(h=>h.piece);},scroll))reachable.add(id);}assert.equal(reachable.size,48);await page.evaluate(()=>{app.ui.scroll=0;app.store.state.current.trayScroll=0;app.draw();});
  const first=await page.evaluate(()=>app.ui.hits.find(h=>h.piece!==undefined));
  await page.mouse.click(first.x+first.w/2,first.y+first.h/2);
  const b=geometry.board,slotX=b.x+b.w*.0625,slotY=b.y+b.h/12;
  await page.mouse.click(slotX,slotY);assert.equal(await page.evaluate(id=>app.store.state.current.positions[id].slot,first.piece),0);
  await click('查看原图');await click('放大查看');await click('返回');assert.equal(await page.evaluate(id=>app.store.state.current.positions[id].slot,first.piece),0);
  // Real pointer drag and neutral replacement of an occupied cell.
  const second=await page.evaluate(()=>app.ui.hits.find(h=>h.piece!==undefined));
  await page.mouse.move(second.x+second.w/2,second.y+second.h/2);await page.mouse.down();await page.mouse.move(slotX,slotY,{steps:5});await page.mouse.up();
  assert.equal(await page.evaluate(id=>app.store.state.current.positions[id].slot,second.piece),0);assert.equal(await page.evaluate(id=>!!app.store.state.current.positions[id],first.piece),false);
  await click('提交拼图');assert.match(await page.evaluate(()=>app.ui.message),/摆满/);
  await click('知道了');
  await page.screenshot({path:path.join(root,'test-results/minigame',w+'-puzzle.png')});
  await page.reload();await page.waitForFunction(()=>window.app);await click('继续拼图');await ready();assert.equal(await page.evaluate(id=>app.store.state.current.positions[id].slot,second.piece),0);
  // Complete each difficulty through actual tap-to-place input, then quiz/reveal/favorite.
  for(const count of [12,24,48]){
   if(await page.evaluate(()=>app.ui.screen==='play'))await click('关闭');await click('查看全部');await click('故事 1');await ready();if(await page.evaluate(()=>app.ui.screen==='detail'))await click('重新拼这幅画');await click(count+'块');await click('开始拼图');
   const {cols,rows}=Shared.gridFor(count);
   for(let id=0;id<count;id++){
    const pos=await page.evaluate(id=>{app.ui.selected=id;app.draw();const b=app.ui.board,g=mods.shared.gridFor(app.store.state.current.count);return {x:b.x+(id%g.cols+.5)*b.w/g.cols,y:b.y+(Math.floor(id/g.cols)+.5)*b.h/g.rows};},id);
    await page.mouse.click(pos.x,pos.y);
   }
   assert.equal(await page.evaluate(()=>app.store.state.current.phase),'puzzle');await click('提交拼图');assert.equal(await page.evaluate(()=>app.store.state.current.phase),'guess');
   await page.screenshot({path:path.join(root,'test-results/minigame',w+'-quiz.png')});
   // Long screens can contain full quiz; scroll the content to reach lower buttons on short screens.
   await page.evaluate(()=>{app.ui.scroll=170;app.draw();});
   const wrong=await page.evaluate(()=>app.ui.hits.find(h=>['约书亚','亚伦'].includes(h.label))?.label);
   if(wrong){await click(wrong);await click('确认答案');assert.equal(await page.evaluate(()=>app.store.state.current.phase),'guess');}
   await page.evaluate(()=>{app.ui.scroll=150;app.draw();});await click('摩西');await click('确认答案');assert.equal(await page.evaluate(()=>app.store.state.current.phase),'reveal');
   const collected=await page.evaluate(()=>app.store.state.collected.includes(1));await click(collected?'取消收藏':'收藏这幅图');assert.equal(await page.evaluate(()=>app.store.state.collected.includes(1)),!collected);
   if(count!==48){await page.evaluate(()=>{app.go('home');});}
  }
  checks.push(w+'×'+h+': iOS layout, full-width 4:3 board, four-row scrolling tray, all pieces, drag/replace, preview, restore, 12/24/48 submit and quiz');
  if(w===393){
   await page.evaluate(()=>app.go('home'));await click('图片集');await click('创建图片集');
   await click('点击填写');await page.evaluate(()=>testInput('我的照片'));await page.evaluate(()=>testPhoto());await click('添加图片（最多一次9张）');assert.equal(await page.evaluate(()=>app.store.state.draft.items.length),1);
   await click('编辑图片 1');await page.evaluate(()=>{app.ui.scroll=140;app.draw();});await click('保留整图');
   await click('试玩这张图片');await ready();const before=await page.evaluate(()=>app.store.state.trialBackup.current);assert(await page.evaluate(()=>app.store.state.current.trial));
   await click('关闭');assert.deepEqual(await page.evaluate(()=>app.store.state.current),before);assert.equal(await page.evaluate(()=>app.ui.screen),'editimage');
   await click('返回');await click('保存图片集');assert.equal(await page.evaluate(()=>app.store.state.sets[0].name),'我的照片');
   const original=await page.evaluate(()=>app.store.state.sets[0].items[0].version);await click('编辑图片集');await click('编辑图片 1');
   await page.evaluate(()=>{const item=app.store.state.draft.items[0];item.fit='crop';item.x=0;app.draw();});await click('返回');await click('保存图片集');
   const revised=await page.evaluate(()=>app.store.state.sets[0].items[0].version);assert.notEqual(original,revised);assert(await page.evaluate(id=>!!app.store.version(id),original));
   await page.evaluate(()=>{saveFails=true;});await click('编辑图片集');assert.match(await page.evaluate(()=>app.ui.message),/保存/);await page.evaluate(()=>{saveFails=false;});
   checks.push('Personal import, contain/crop, trial restore, saved set, immutable version and quota error');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
 // Isolated store recovery and wrong-layout preservation for game-specific storage key.
 let saved,fail=false;const api={getStorageSync:()=>saved&&clone(saved),setStorageSync:(_,value)=>{if(fail)throw Error('quota');saved=clone(value);}};let store=createStore(api);
 store.start(24,24);const c=store.state.current;for(let id=0;id<24;id++)Shared.dropPiece(c,id,((id+1)%24%6+.5)/6,(Math.floor((id+1)%24/6)+.5)/4);
 const old=clone(c.positions);assert.equal(store.submit(),'incorrect');assert.deepEqual(c.positions,old);assert.equal(store.state.completed.length,0);
 const before=clone(store.state);fail=true;assert.throws(()=>store.start(1,12));assert.deepEqual(store.state,before);fail=false;
 store=createStore(api);assert.deepEqual(store.state.current.positions,old);saved={broken:true};store=createStore(api);assert(store.blocked);assert.throws(()=>store.save());
 checks.push('Game storage: incorrect layout preserved, failed new game rollback, restart and damaged-save guard');
 console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
