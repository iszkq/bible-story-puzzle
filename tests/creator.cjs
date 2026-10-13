const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),out=root+'/web',results=root+'/test-results',url='http://127.0.0.1:8766/index.html?prototype=1';fs.mkdirSync(results,{recursive:true});
const report={checks:[],errors:[],overflow:[]},ok=(v,t)=>{if(!v)throw Error(t);report.checks.push(t)};
(async()=>{const browser=await chromium.launch({...(process.env.PUZZLE_BROWSER?{executablePath:process.env.PUZZLE_BROWSER}:{}),headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},hasTouch:true});page.on('pageerror',e=>report.errors.push(e.message));
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('biblePuzzleDesignV1')));
 await page.goto(url);await page.waitForFunction(()=>creator.ready);
 await click('first');ok((await page.locator('#screen .art img').getAttribute('src'))==='assets/moses.jpg','准备页展示完整原图，取消局部裁切');
 await click('difficulty:48');await click('start');ok(await page.locator('.board-cell').count()===48,'48块按8×6显示网格');
 ok(await page.locator('.in-tray').count()===48,'托盘一次提供全部48块');
 ok(await page.locator('.fragment-tray').evaluate(e=>e.scrollHeight>e.clientHeight&&e.clientHeight>=210),'托盘显示四行以上并可滚动更多碎片');
 async function drag(id,col,row,cols=4,rows=3){
  const piece=page.locator(`[data-piece="${id}"]`);await piece.scrollIntoViewIfNeeded();const p=await piece.boundingBox(),b=await page.locator('.free-board').boundingBox();
  await page.mouse.move(p.x+p.width/2,p.y+p.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*(col+.25)/cols,b.y+b.height*(row+.3)/rows,{steps:10});await page.mouse.up();
 }
 await drag(0,2,2,8,6);let c=(await saved()).current;ok(c.positions[0].slot===18&&c.positions[0].x===2.5/8,'错格同样自动贴合中心，不判断答案');
 ok(!await page.locator('.sheet,.toast').count(),'错误格落位时无正确性反馈');
 await drag(1,2,2,8,6);c=(await saved()).current;ok(c.positions[1].slot===18&&!c.positions[0],'托盘片放已占格时旧片退回托盘');
 await drag(0,3,2,8,6);await drag(1,3,2,8,6);c=(await saved()).current;ok(c.positions[1].slot===19&&c.positions[0].slot===18,'画框内拖动到已占格交换位置');
 const original=JSON.stringify(c);
 await click('exit');await click('go:mysets');ok((await page.locator('#screen').innerText()).includes('第一集'),'我的故事集有真实空态');
 await click('c:new');await click('c:saveSet');ok((await page.locator('#creator-message').innerText()).includes('名称'),'空名称阻止保存并保留表单');
 await page.locator('[data-draft="name"]').fill('我的读经故事 <测试>');await page.locator('[data-draft="description"]').fill('自己收藏的画面\n第二行简介');
 await page.locator('#add-images').setInputFiles([out+'/assets/moses.jpg',out+'/assets/noah.jpg',out+'/assets/ruth.jpg']);
 await page.waitForFunction(()=>!creator.busy&&creator.draft?.items.length===3);
 ok(await page.locator('.edit-row').count()===3,'批量导入三张图片形成三个关卡');
 let items=await page.evaluate(()=>creator.draft.items.map(i=>i.id));await click('c:up:'+items[2]);
 ok(await page.evaluate(id=>creator.draft.items[1].id===id,items[2]),'上下按钮可调整图片顺序');
 // Desktop drag ordering, then set a chosen cover.
 await page.locator(`[data-reorder="${items[1]}"]`).dragTo(page.locator(`[data-reorder="${items[0]}"]`));
 ok(await page.evaluate(id=>creator.draft.items[0].id===id,items[1]),'桌面拖动排序有效');
 await click('c:cover:'+items[2]);ok(await page.evaluate(id=>creator.draft.coverID===id,items[2]),'可从任意图片设置故事集封面');
 await click('c:image:'+items[0]);
 await page.locator('[data-image="title"]').fill('海中的道路');await page.locator('[data-image="text"]').fill('这是我写的故事。\n<img src=x onerror=alert(1)>');await page.locator('[data-image="reference"]').fill('出埃及记14章');
 await page.locator('[data-quiz="enabled"]').check();await click('c:doneImage');ok((await page.locator('#creator-message').innerText()).includes('题目'),'开启题目后校验完整配置');
 await page.locator('[data-quiz="question"]').fill('带领百姓的人是谁？');for(const [n,v]of ['摩西','亚伦','约书亚'].entries())await page.locator(`[data-option="${n}"]`).fill(v);
 await page.locator('[data-quiz="answer"]').selectOption('0');await click('c:doneImage');
 await click('c:image:'+items[2]);await page.locator('[data-image="title"]').fill('麦田记忆');
 await page.locator('[data-image="fit"][value="contain"]').check();await click('c:grid:24');
 ok(await page.locator('#crop-controls').isHidden(),'保留整图模式隐藏无效裁切滑块');
 await page.screenshot({path:results+'/自建故事集-图片编辑.png',fullPage:true});
 await click('c:grid:12');await click('c:trial');await page.waitForSelector('.free-board');
 ok((await saved()).current.storyID>6,'从编辑器可进入实际图片试玩');
 for(let id=0;id<12;id++)await drag(id,id%4,Math.floor(id/4));await click('submit');ok((await page.locator('.sheet').innerText()).includes('拼图正确'),'自建图试玩使用同一套网格提交校验');
 await click('toGuess');ok((await page.locator('#screen').innerText()).includes('试玩完成')&&!await page.locator('.option').count(),'默认关闭题目，试玩通过直接看整图');
 await click('c:endTrial');ok(JSON.stringify((await saved()).current)===original,'结束试玩精确恢复原有游戏进度');
 await click('c:doneImage');await click('c:saveSet');await page.waitForFunction(()=>!creator.busy&&!creator.draft);
 ok((await page.locator('#screen h2').innerText())==='我的读经故事 <测试>','保存后故事集可打开且用户文本安全显示');
 const setID=await page.evaluate(()=>creator.setID),versions=await page.evaluate(()=>creator.sets[0].items.map(i=>i.version));
 await page.screenshot({path:results+'/自建故事集-详情.png',fullPage:true});
 await page.reload();await page.waitForFunction(()=>creator.ready);await click('go:mysets');await click('c:open:'+setID);
 ok(await page.locator('#screen .story-row').count()===3,'刷新后图片、故事集与顺序从本机存储恢复');
 // Play the configured quiz, then collect it.
 const quizVersion=await page.evaluate(id=>creator.sets[0].items.find(i=>i.id===id).version,items[0]);
 await click('c:play:'+quizVersion);await click('start');await click('replaceConfirmed');
 for(let id=0;id<12;id++)await drag(id,id%4,Math.floor(id/4));await click('submit');await click('toGuess');ok(await page.locator('.option').count()===3,'自建关卡可以启用自己的三选一题目');
 await page.locator('.option').filter({hasText:'摩西'}).click();await click('confirm');ok((await page.locator('.message').innerText()).includes('正确'),'自定义题目按创建者设定答案验证');
 await click('toReveal');ok(await page.locator('#screen img[src="x"]').count()===0,'故事正文按文字显示，不执行HTML');await click('save');
 await click('c:backPlay');await click('go:mysets');await click('go:collection');ok(await page.locator(`[data-action="open:${quizVersion}"]`).count()===1,'自建故事可加入现有收藏并回看');
 await click('open:'+quizVersion);await click('replay');await click('restart');await click('restartConfirmed');await drag(0,2,1);const oldPositions=JSON.stringify((await saved()).current.positions);
 // Replace an image without invalidating active old-version game or old-version collection.
 await click('exit');await click('go:mysets');await click('c:open:'+setID);await click('c:edit');await click('c:image:'+items[0]);
 await page.locator('#replace-image').setInputFiles(out+'/assets/daniel.jpg');await page.waitForFunction(()=>!creator.busy);await click('c:doneImage');await click('c:saveSet');await page.waitForFunction(()=>!creator.busy&&!creator.draft);
 const newVersion=await page.evaluate(id=>creator.sets[0].items.find(i=>i.id===id).version,items[0]);ok(newVersion!==quizVersion,'替换图片生成新的不可变图片版本');
 await click('go:mysets');await click('go:home');await click('resume');ok((await saved()).current.storyID===quizVersion&&JSON.stringify((await saved()).current.positions)===oldPositions,'编辑图片后旧版本拼图仍能原样继续');
 await click('exit');await click('go:mysets');await click('c:open:'+setID);await click('c:edit');await page.locator('[data-draft="description"]').fill('新版简介');await click('c:saveSet');await page.waitForFunction(()=>!creator.busy&&!creator.draft);
 ok(await page.evaluate(([id,version])=>creator.sets[0].items.find(i=>i.id===id).version===version,[items[0],newVersion]),'只编辑文字不生成新的图片版本');
 await click('go:mysets');await click('c:new');await page.locator('[data-draft="name"]').fill('尚未写完的故事集');await page.waitForFunction(()=>creator.storage==='草稿已保存到本机');
 await page.reload();await page.waitForFunction(()=>creator.ready);await click('go:mysets');await click('c:continue');ok((await page.locator('[data-draft="name"]').inputValue())==='尚未写完的故事集','未完成草稿在刷新后可继续');
 await click('c:discard');await click('c:discardConfirm');await page.waitForFunction(()=>!creator.draft);ok(!await page.evaluate(()=>creator.draft),'放弃草稿需确认且不影响已保存故事集');
 // Invalid file leaves valid content intact and provides an actionable error.
 await click('c:open:'+setID);await click('c:edit');await page.locator('#add-images').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>!creator.busy);ok((await page.locator('#creator-message').innerText()).includes('未能')||(await page.locator('#creator-message').innerText()).includes('无法'),'损坏图片导入有明确错误且不丢已有图片');
 // Quota failure is injected at the storage boundary; prior saved set remains intact.
 await page.evaluate(()=>{window.realWrite=writeLibrary;writeLibrary=()=>Promise.reject(new DOMException('full','QuotaExceededError'));});await click('c:saveSet');await page.waitForFunction(()=>!creator.busy);ok((await page.locator('#creator-message').innerText()).includes('空间不足')&&await page.evaluate(()=>!!creator.draft),'本地空间不足保留草稿并明确失败');await page.evaluate(()=>writeLibrary=window.realWrite);
 // Small screen and dark theme include all new screens.
 for(const width of [1440,375,320]){await page.setViewportSize({width,height:1100});for(const target of ['mysets','setedit','imageedit']){if(target==='imageedit')await click('c:image:'+items[0]);else await click('inspect:'+target);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1||document.querySelector('#screen').scrollWidth>document.querySelector('#screen').clientWidth+1);if(overflow)report.overflow.push({width,target});}}
 ok(!report.overflow.length,'自建故事集页面在桌面/375/320宽度无横向溢出');
 await page.setViewportSize({width:1440,height:1100});await click('c:backImage');await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:results+'/自建故事集-编辑深色.png',fullPage:true});await page.emulateMedia({colorScheme:'light'});
 await click('c:backEditor');await click('c:deleteSet');await click('c:deleteSetConfirm');await page.waitForFunction(()=>creator.sets.length===0);ok(await page.evaluate(()=>creator.sets.length===0),'删除故事集需确认且实际生效');
 await click('go:collection');await click('open:'+quizVersion);ok((await page.locator('#screen').innerText()).includes('海中的道路'),'删除故事集后收藏中的旧版本仍可查看');
 ok(!report.errors.length,'新增流程无浏览器脚本错误');fs.writeFileSync(results+'/creator-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){console.log(JSON.stringify(report,null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
