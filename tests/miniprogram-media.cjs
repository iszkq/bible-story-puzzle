'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),Shared=require('../miniprogram/shared');
const calls=[],failures=new Set(),timers=new Map();let timerID=0;
const setTimeout=(fn,ms)=>{const id=++timerID;timers.set(id,{fn,ms});return id;},clearTimeout=id=>timers.delete(id);
function expire(ms){for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}}
const wx={};
function load(p){assert.equal(p,'./shared');return Shared;}
load.async=async p=>{
  calls.push(p);
  if(failures.delete(p))throw Error('download failed');
  return require(path.join(root,'miniprogram',p));
};
const moduleObject={exports:{}};
// Ordinary mini-programs do not expose the game's wx.loadSubpackage API.
vm.runInNewContext(fs.readFileSync(root+'/miniprogram/media.js','utf8'),{require:load,module:moduleObject,wx,Promise,setTimeout,clearTimeout});
const Media=moduleObject.exports;
(async()=>{
  assert.equal(await Media.scene({custom:true,image:'local-photo'}),'local-photo');
  assert.equal(calls.length,0);
  failures.add('./artworks-a/resources.js');
  await assert.rejects(Media.scene(Shared.stories[0]),/download failed/);
  const first=await Promise.all([Media.scene(Shared.stories[0]),Media.scene(Shared.stories[1])]);
  assert.deepEqual(first,['/artworks-a/assets/moses.jpg','/artworks-a/assets/noah.jpg']);
  assert.equal(calls.filter(p=>p==='./artworks-a/resources.js').length,2,'Concurrent requests share the retry download');
  for(const story of Shared.stories){
    const image=await Media.scene(story);
    assert(fs.existsSync(root+'/miniprogram'+image));
  }
  assert.equal(calls.length,13,'One successful load per package plus the failed attempt');
  const canvas={};
  const page={createSelectorQuery(){return {select(selector){assert.equal(selector,'#board');return this;},fields(){return this;},exec(cb){cb([{node:canvas,width:350,height:262.5}]);}};}};
  assert.equal((await Media.node(page,'#board')).node,canvas,'Canvas queries use the current page even without global wx.createSelectorQuery');
  const missing={createSelectorQuery(){return {select(){return this;},fields(){return this;},exec(cb){cb([]);}};}};
  await assert.rejects(Media.node(missing,'#board'),/画布未准备好/);
  const silent={createSelectorQuery(){return {select(){return this;},fields(){return this;},exec(){}};}};
  const query=Media.node(silent,'#board');expire(8000);await assert.rejects(query,/画布准备超时/);
  assert.equal((await Media.node(page,'#board')).node,canvas,'A timed out canvas query can be retried');
  let img;const imageCanvas={createImage(){img={};return img;}};
  const failedImage=Media.image(imageCanvas,'bad');img.onerror();await assert.rejects(failedImage,/图片无法读取/);
  const stalledImage=Media.image(imageCanvas,'stalled');expire(15000);await assert.rejects(stalledImage,/图片读取超时/);
  assert.equal(img.onload,null);
  const goodImage=Media.image(imageCanvas,'good');img.onload();assert.equal(await goodImage,img);
  wx.canvasToTempFilePath=()=>{};
  const stalledExport=Media.invoke('canvasToTempFilePath',{});expire(15000);await assert.rejects(stalledExport,/图片处理超时/);
  wx.canvasToTempFilePath=opts=>opts.success({tempFilePath:'local-atlas'});
  assert.equal((await Media.invoke('canvasToTempFilePath',{})).tempFilePath,'local-atlas');
  assert.equal(timers.size,0,'Completed or failed operations release all loading timers');
  const asyncLoader=load.async;load.async=()=>new Promise(()=>{});
  // Use a fresh module so the package has not already been cached.
  const stalledModule={exports:{}};
  vm.runInNewContext(fs.readFileSync(root+'/miniprogram/media.js','utf8'),{require:load,module:stalledModule,wx,Promise,setTimeout,clearTimeout});
  const download=stalledModule.exports.scene(Shared.stories[0]);expire(30000);await assert.rejects(download,/图片加载超时/);
  load.async=asyncLoader;assert.equal(await stalledModule.exports.scene(Shared.stories[0]),'/artworks-a/assets/moses.jpg');
  await assert.rejects(Media.invoke('chooseMedia',{}),/请更新微信/);
  delete load.async;
  await assert.rejects(Media.scene(Shared.stories[0]),/图片分包加载/);
  console.log('Passed mini-program media: all 24 scenes, page-bound canvas queries, loading/export timeouts, retries, local photos and unavailable APIs.');
})().catch(e=>{console.error(e);process.exitCode=1;});
