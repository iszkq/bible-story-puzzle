const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const report={checks:[],errors:[]};
const ok=(v,t)=>{if(!v)throw Error(t);report.checks.push(t);};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PUZZLE_BROWSER?{executablePath:process.env.PUZZLE_BROWSER}:{})});
 try{
  for(const [width,height] of [[320,568],[375,667],[393,852],[430,932]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:true});
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto('http://127.0.0.1:8766/index.html');await page.waitForFunction(()=>creator.ready);
   ok(await page.locator('.sidebar').isHidden()&&await page.locator('.status').isHidden(),`${width}: actual app has no prototype chrome`);
   const click=a=>page.locator(`[data-action="${a}"]`).first().click();
   await click('first');await click('difficulty:48');await click('start');
   ok(await page.locator('.board-cell').count()===48,`${width}: difficult mode has 48 neutral cells`);
   const tray=await page.locator('.fragment-tray').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
   ok(tray.height>=210&&tray.scroll>tray.height,`${width}: four visible tray rows plus scroll`);
   await page.evaluate(()=>{dropPiece(0,.2,.2);renderKeepingPosition();});
   const position=await page.evaluate(()=>JSON.stringify(state.current.positions));
   await click('sheet:preview');await click('previewBack');
   ok(await page.evaluate(()=>JSON.stringify(state.current.positions))===position,`${width}: preview preserves placed pieces`);
   for(const target of ['home','list','prepare','puzzle','guess','reveal','collection','detail','settings','mysets']){
    await page.evaluate(t=>go(t),target);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#screen').scrollWidth<=document.querySelector('#screen').clientWidth+1),`${width}: ${target} fits width`);
   }
   await page.evaluate(()=>go('home'));await page.emulateMedia({colorScheme:'dark'});
   fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
   if(width===393)await page.screenshot({path:path.resolve(__dirname,'../test-results/mobile-dark.png')});
   await page.reload();await page.waitForFunction(()=>creator.ready);
   ok(await page.evaluate(()=>JSON.stringify(state.current.positions))===position,`${width}: persisted game survives app reload`);
   await page.close();
  }
  // Exercise native bridge with a test host, including import and equal feedback
  // for wrong and correct cells. This does not replace simulator testing.
  const bridgeContext=await browser.newContext({viewport:{width:393,height:852}});
  const page=await bridgeContext.newPage();
  await page.addInitScript(()=>{window.nativeEvents=[];window.webkit={messageHandlers:{puzzle:{postMessage:m=>window.nativeEvents.push(m)}}};});
  await page.goto('http://127.0.0.1:8766/index.html');await page.waitForFunction(()=>creator.ready);
  await page.evaluate(()=>{storyID=1;count=12;makeCurrent();go('puzzle');dropPiece(0,.4,.2);dropPiece(1,.4,.2);});
  ok(await page.evaluate(()=>nativeEvents.filter(e=>e.type==='feedback').every(e=>e.event==='place')),'native placement feedback is identical for every cell');
  await page.evaluate(()=>{go('mysets');newDraft();});
  const base64=fs.readFileSync(path.resolve(__dirname,'../web/assets/ruth.jpg')).toString('base64');
  await page.locator('.file-button').first().click();
  ok(await page.evaluate(()=>nativeEvents.some(e=>e.type==='pickImages'&&e.inputID==='add-images')),'native add-photo control opens picker instead of browser upload dialog');
  await page.evaluate(async base64=>{await receiveNativeImages('add-images',[{name:'ruth.jpg',mime:'image/jpeg',base64}]);},base64);
  ok(await page.evaluate(()=>creator.draft.items.length)===1,'native photo bridge uses shared creator import pipeline');
  const context=page.context();
  const backup=await page.evaluate(()=>JSON.stringify(state.current));
  await page.evaluate(async()=>{creator.itemID=creator.draft.items[0].id;await beginTrial();});
  ok(await page.evaluate(()=>!!creator.trial),'native editor starts isolated trial');
  await page.close();
  const reopened=await context.newPage();
  await reopened.goto('http://127.0.0.1:8766/index.html');await reopened.waitForFunction(()=>creator.ready);
  ok(await reopened.evaluate(()=>JSON.stringify(state.current))===backup,'closing the view during trial restores previous real game on reopen');
  await reopened.evaluate(()=>applyNativeTextScale(2));
  await reopened.evaluate(()=>go('reveal'));
  ok(await reopened.locator('.reader').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))===34,'reading text honors native accessibility text scale');
  ok(!report.errors.length,'mobile flow has no script errors');
  fs.writeFileSync(path.resolve(__dirname,'../test-results/mobile-qa.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
