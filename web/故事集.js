'use strict';
// Local-only authoring. A version is immutable once saved; current games retain its ID.
const creator={ready:false,error:'',sets:[],versions:[],draft:null,setID:null,itemID:null,busy:false,notice:'',storage:'',db:null,queue:Promise.resolve(),previewSerial:0,trial:null,dragItem:null};
const customScreens=['mysets','setdetail','setedit','imageedit'];
pages.push(['mysets','P10 我的故事集'],['setedit','P11 编辑故事集'],['imageedit','P12 图片编辑']);
Object.assign(spec,{
 mysets:{name:'我的故事集',goal:'用自己的图片建立可反复游玩的故事集。',layout:['独立根入口，官方内容与我的创作分别浏览','创建故事集、继续草稿、打开已保存故事集','本机保存，选图后不进行网络上传'],assets:'用户选取的照片或插画，复用为封面与拼图。',states:'读取中、空集、草稿、已保存、存储失败。'},
 setdetail:{name:'自建故事集详情',goal:'按自定顺序浏览图片，任意选一幅游玩。',layout:['自选封面、名称、简介、图片序列','所有图片可直接玩，采用12/24/48块','编辑不删除旧版本进度或收藏'],assets:'故事集选定封面与各图片实际处理后的预览。',states:'已保存、继续当前局、已完成、编辑、删除确认。'},
 setedit:{name:'创建与编辑故事集',goal:'批量选图、安排顺序与封面，保存本机草稿。',layout:['名称必填，简介选填；一张图对应一关','拖动或上下按钮排序，任意图片可设为封面','保存前校验；导入/保存失败保持可编辑草稿'],assets:'用户选图，JPEG/PNG/WebP；无需为每档难度导入不同图片。',states:'草稿、批量导入中、无图、校验失败、保存成功、放弃确认。'},
 imageedit:{name:'图片与故事编辑',goal:'确认画面范围与碎片密度，试玩后再保存。',layout:['4:3裁切或保留整图；位置和缩放滑块实时预览','故事标题、文字、出处选填；题目默认关闭','12/24/48块网格预览和实际试玩；替换图保留历史版本'],assets:'由同一导入源按比例处理，不拉伸；完整保留使用中性补边。',states:'画面调整、清晰度建议、题目校验、试玩、替换图、删除确认。'}
});
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isCustom=id=>Number(id)>6;
const customSet=()=>creator.sets.find(s=>s.id===creator.setID);
const draftItem=()=>creator.draft?.items.find(i=>i.id===creator.itemID);
const customVersion=id=>creator.versions.find(v=>v.id===Number(id));
const blankQuiz=()=>({enabled:false,question:'',options:['','',''],answer:0});
const uid=()=>crypto.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);
const versionID=()=>Math.max(Date.now(),...creator.versions.map(v=>v.id+1),...(creator.draft?.items||[]).map(v=>(v.version||0)+1));
function snapshotLibrary(){return structuredClone({sets:creator.sets,versions:creator.versions.filter(v=>v.setID!=='trial'),draft:creator.draft});}
function storageError(e){return e?.name==='QuotaExceededError'?'本地空间不足。请释放设备存储空间后重试；当前草稿仍保留在页面中。':'未能保存到本地。请保留此页面，确认本机允许本地存储后重试。';}
function writeLibrary(value=snapshotLibrary()){
 const job=()=>new Promise((resolve,reject)=>{
  if(!creator.db){reject(Error('storage unavailable'));return;}
  const tx=creator.db.transaction('content','readwrite');tx.objectStore('content').put(value,'library');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
 const request=creator.queue.catch(()=>{}).then(job);creator.queue=request;return request;
}
let draftTimer;
function saveDraftSoon(){
 creator.storage='草稿待保存';clearTimeout(draftTimer);
 draftTimer=setTimeout(()=>{writeLibrary().then(()=>{creator.storage='草稿已保存到本机';updateStorageLabel();}).catch(e=>{creator.storage=storageError(e);updateStorageLabel();});},350);
 updateStorageLabel();
}
function updateStorageLabel(){const el=document.getElementById('draft-storage');if(el)el.textContent=creator.storage;}
function refreshCustomStories(){
 for(let i=stories.length-1;i>=0;i--)if(isCustom(stories[i].id))stories.splice(i,1);
 for(const v of creator.versions){const q=v.quiz||blankQuiz();stories.push({id:v.id,custom:true,setID:v.setID,itemID:v.itemID,title:E(v.title||'未命名图片'),person:E(q.options[q.answer]||v.title||'我的图片'),summary:E(v.text||''),ref:E(v.reference||''),question:E(q.question),options:q.options.map(E),clue:'可以再观察一下画面，或直接查看故事。',image:v.image,quizEnabled:q.enabled,rawTitle:v.title});}
}
async function initCreator(){
 try{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('bible-puzzle-personal-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('content');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('blocked'));});
  creator.db=db;db.onversionchange=()=>{db.close();creator.error='本地资料库需要重新打开，请刷新页面。';};
  const saved=await new Promise((resolve,reject)=>{const tx=db.transaction('content','readonly'),req=tx.objectStore('content').get('library');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  if(saved){creator.sets=saved.sets||[];creator.versions=saved.versions||[];creator.draft=saved.draft||null;}
  refreshCustomStories();creator.ready=true;
  if(isCustom(storyID)&&!stories.some(s=>s.id===storyID)){storyID=1;state.current=null;persist();creator.notice='上次图片资料未能找到，可以重新导入图片或继续精选故事。';}
  if(!creator.busy)render();
 }catch(e){creator.error='本地资料库无法打开，请确认本机允许本地存储后刷新重试。精选故事仍可游玩。';creator.ready=true;render();}
}
function personalArt(src,alt='故事集图片'){return `<div class="art"><img src="${E(src)}" alt="${E(alt)}" draggable="false"></div>`;}
function creatorHeader(label,back,action=''){return `<header class="bar">${button('返回',back,'icon-button')}<strong>${label}</strong>${action||'<span class="bar-spacer"></span>'}</header>`;}
function creatorAlert(){return `<p class="form-message ${creator.notice?'error':''}" role="status" id="creator-message">${E(creator.notice)}</p>`;}
function creatorHTML(page){
 if(!creator.ready)return `${creatorHeader('我的故事集','go:home')}<div class="empty" role="status">正在读取本机故事集…</div>`;
 if(creator.error)return `${creatorHeader('我的故事集','go:home')}<div class="empty"><h3>暂时无法读取</h3><p>${E(creator.error)}</p>${button('刷新重试','c:reload')}</div>`;
 if(page==='mysets')return `<div class="bar"><strong>我的故事集</strong>${button('新建','c:new','icon-button')}</div><h2>把自己的图片，<br>拼成故事。</h2><p class="muted small">照片、插画或读经主题，都可以成为一集。</p>${creator.draft?`<div class="draft-banner"><strong>有一份未完成的草稿</strong><p class="small muted">${E(creator.draft.name||'未命名故事集')} · ${creator.draft.items.length}张图片</p>${button('继续编辑','c:continue','secondary')}</div>`:''}${creator.sets.length?creator.sets.map(set=>{const cover=set.items.find(i=>i.id===set.coverID)||set.items[0],v=customVersion(cover?.version);return `<button class="set-row" data-action="c:open:${set.id}">${v?personalArt(v.image):'<span>无封面</span>'}<span class="set-copy"><strong>${E(set.name)}</strong><span class="muted small">${set.items.length}幅 · 我的创作</span><span class="muted small">${E(set.description||'打开，选一幅开始拼图。')}</span></span><span aria-hidden="true">›</span></button>`;}).join(''):`<div class="empty"><h3>第一集，从一张图片开始。</h3><p class="muted">选择几张喜欢的图片，<br>也可以慢慢写下它们的故事。</p>${button('创建故事集','c:new')}</div>`}<p class="explain">图片与故事仅保存在当前设备。删除App或清除网站数据会删除这些内容。</p>`;
 if(page==='setdetail'){
  const set=customSet();if(!set)return `${creatorHeader('故事集','go:mysets')}<p>这份故事集已不存在。</p>`;
  const cover=customVersion((set.items.find(i=>i.id===set.coverID)||set.items[0])?.version);
  return `${creatorHeader('我的故事集','go:mysets',button('编辑','c:edit','icon-button'))}<p class="eyebrow">我的创作 · ${set.items.length}幅</p><h2>${E(set.name)}</h2>${cover?personalArt(cover.image):''}<p class="muted content-text">${E(set.description||'')}</p>${set.items.map((item,index)=>{const v=customVersion(item.version);return `<button class="story-row" data-action="c:play:${item.version}"><div class="art small-art"><img src="${E(v.image)}" alt="图片封面"></div><span class="copy"><strong>${index+1}. ${E(v.title||'未命名图片')}</strong><span class="tag">${state.current?.storyID===v.id?'继续上次拼图':state.completed.includes(v.id)?'已拼完 · 可重玩':'12 / 24 / 48块'}${v.quiz?.enabled?' · 含题目':''}</span></span><span aria-hidden="true">›</span></button>`;}).join('')}${button('删除故事集','c:deleteSet','text-button danger')}<p class="explain">可自由选择任意一幅。拼完后阅读故事；设置了题目的图片会先进入答题。</p>`;
 }
 if(page==='setedit'){
  const d=creator.draft;if(!d)return `${creatorHeader('编辑故事集','go:mysets')}${button('新建故事集','c:new')}`;
  return `${creatorHeader(d.editID?'编辑故事集':'新建故事集','c:backEditor')}<p class="eyebrow">我的创作</p><h2>这一集，讲什么故事？</h2><label class="field">故事集名称 <span class="muted small">必填</span><input id="set-name" data-draft="name" value="${E(d.name)}" maxlength="60" placeholder="例如：耶稣的比喻"></label><label class="field">简介 <span class="muted small">选填</span><textarea data-draft="description" maxlength="500" placeholder="写下这一集的主题或回忆">${E(d.description)}</textarea></label><div class="row block"><h3>图片 · ${d.items.length}幅</h3><label class="file-button ${creator.busy?'disabled':''}">添加图片<input id="add-images" type="file" accept="image/jpeg,image/png,image/webp" multiple ${creator.busy?'disabled':''}></label></div><p class="small muted">一次选择多张；拖动排序，也可使用上下按钮。</p>${creator.busy?'<p class="import-progress" role="status">正在处理图片，请稍候…</p>':''}<div class="editor-items">${d.items.map((item,index)=>`<div class="edit-row" draggable="true" data-reorder="${item.id}"><button class="edit-image" data-action="c:image:${item.id}" aria-label="编辑第${index+1}幅图片"><img src="${E(item.image)}" alt="图片预览"></button><div class="edit-copy"><button class="row-title" data-action="c:image:${item.id}">${E(item.title||'未命名图片')}</button><span class="small muted">${index+1} · ${item.fit==='contain'?'完整保留':'4:3裁切'}${item.quiz.enabled?' · 含题目':''}</span><button class="cover-button" data-action="c:cover:${item.id}" aria-pressed="${d.coverID===item.id}">${d.coverID===item.id?'✓ 当前封面':'设为封面'}</button></div><div class="order-buttons">${button('上移',`c:up:${item.id}`,'icon-button',index===0?'disabled':'')}${button('下移',`c:down:${item.id}`,'icon-button',index===d.items.length-1?'disabled':'')}</div></div>`).join('')||'<div class="empty compact-empty">添加一张图片，就能开始制作。</div>'}</div>${creatorAlert()}${button(creator.busy?'处理中…':'保存故事集','c:saveSet','primary',creator.busy?'disabled':'')}${button('放弃草稿','c:discard','text-button danger')}<p class="small muted" id="draft-storage" role="status">${E(creator.storage||'编辑内容自动保存为本机草稿')}</p>`;
 }
 if(page==='imageedit'){
  const i=draftItem();if(!i)return `${creatorHeader('图片编辑','c:backImage')}<p>请先选择一张图片。</p>`;
  return `${creatorHeader('图片与故事','c:backImage')}<h2>让每一幅都好拼。</h2><canvas id="crop-preview" width="800" height="600" aria-label="实际4比3拼图画面预览"></canvas><p class="small muted" id="image-quality">${qualityLabel(i)}</p><fieldset class="fit-picker"><legend>画面范围</legend><label><input type="radio" name="fit" value="crop" data-image="fit" ${i.fit==='crop'?'checked':''}> 裁切为4:3</label><label><input type="radio" name="fit" value="contain" data-image="fit" ${i.fit==='contain'?'checked':''}> 保留完整图片</label></fieldset><div id="crop-controls" ${i.fit==='contain'?'hidden':''}>${rangeField('水平位置','x',i.x,0,100)}${rangeField('垂直位置','y',i.y,0,100)}${rangeField('画面放大','zoom',i.zoom,1,3,.05)}</div><label class="file-button replace-image">替换图片<input id="replace-image" type="file" accept="image/jpeg,image/png,image/webp" ${creator.busy?'disabled':''}></label><label class="field">图片标题 <span class="muted small">选填</span><input data-image="title" value="${E(i.title)}" maxlength="80" placeholder="例如：麦田里的拾穗者"></label><label class="field">故事文字 <span class="muted small">选填</span><textarea data-image="text" maxlength="5000" placeholder="拼完后展示，也可以只欣赏图片。">${E(i.text)}</textarea></label><label class="field">经文出处 <span class="muted small">选填</span><input data-image="reference" value="${E(i.reference)}" maxlength="150" placeholder="例如：路得记2章"></label><label class="setting"><span>拼完后增加一道题<small>适合猜人物，也可写自己的问题</small></span><input type="checkbox" data-quiz="enabled" ${i.quiz.enabled?'checked':''}></label><div id="quiz-fields" ${!i.quiz.enabled?'hidden':''}><label class="field">题目<input data-quiz="question" value="${E(i.quiz.question)}" maxlength="200" placeholder="画面中的人物是谁？"></label>${i.quiz.options.map((o,index)=>`<label class="field">选项${index+1}<input data-option="${index}" value="${E(o)}" maxlength="80"></label>`).join('')}<label class="field">正确答案<select data-quiz="answer">${[0,1,2].map(n=>`<option value="${n}" ${i.quiz.answer===n?'selected':''}>选项${n+1}</option>`).join('')}</select></label></div><h3 class="block">碎片预览与试玩</h3><div class="difficulty">${[12,24,48].map(n=>`<button class="${i.difficulty===n?'selected':''}" aria-pressed="${i.difficulty===n}" data-action="c:grid:${n}">${n===12?'轻松':n===24?'标准':'困难'} · ${n}块</button>`).join('')}</div><p class="small muted">网格展示切分密度；实际试玩使用凹凸碎片。</p>${creatorAlert()}${button('试玩这幅图','c:trial','secondary',creator.busy?'disabled':'')}${button('完成编辑','c:doneImage','primary',creator.busy?'disabled':'')}${button('移除这幅图','c:removeImage','text-button danger')}<p class="small muted" id="draft-storage" role="status">${E(creator.storage||'草稿自动保存到本机')}</p>`;
 }
 return '';
}
function rangeField(label,key,value,min,max,step=1){return `<label class="range-field">${label}<output id="range-${key}">${value}</output><input type="range" data-image="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;}
function qualityLabel(i){const short=Math.min(i.width,i.height);return `${i.width} × ${i.height}像素 · ${short<600?'清晰度偏低，建议先用12块试玩。':short<1000?'适合手机试玩，48块建议检查局部细节。':'清晰度适合手机拼图，仍建议实际试玩。'}`;}
function imageError(e){return e?.message?.startsWith('图片')?e.message:'这张图片未能读取，请选择JPEG、PNG或WebP图片。';}
async function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法解码，请换一张图片。'));img.src=src;});}
async function readImageFile(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('图片格式暂不支持，请选择JPEG、PNG或WebP；HEIC请先转换。');
 if(file.size>20*1024*1024)throw Error('图片超过20MB，请缩小后再导入。');
 const url=URL.createObjectURL(file);
 try{const img=await loadImage(url),width=img.naturalWidth,height=img.naturalHeight;if(width*height>40000000)throw Error('图片像素超过4000万，请缩小后再导入。');const scale=Math.min(1,2560/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {source:canvas.toDataURL('image/png'),width,height};}finally{URL.revokeObjectURL(url);}
}
function drawScene(ctx,img,item,width,height){
 // Image is never stretched; both fit modes use one uniform scale.
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#e5e5ea';ctx.fillRect(0,0,width,height);
 const sw=img.naturalWidth,sh=img.naturalHeight;
 if(item.fit==='contain'){const scale=Math.min(width/sw,height/sh),w=sw*scale,h=sh*scale;ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);return;}
 const scale=Math.max(width/sw,height/sh)*Number(item.zoom||1),w=sw*scale,h=sh*scale;
 ctx.drawImage(img,-(w-width)*Number(item.x)/100,-(h-height)*Number(item.y)/100,w,h);
}
async function processScene(item){const img=await loadImage(item.source),canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1200;drawScene(canvas.getContext('2d'),img,item,1600,1200);item.image=canvas.toDataURL('image/jpeg',.92);return item.image;}
async function drawCropPreview(){
 const serial=++creator.previewSerial,item=draftItem(),canvas=document.getElementById('crop-preview');if(!canvas||!item)return;
 try{const img=await loadImage(item.source);if(serial!==creator.previewSerial||!canvas.isConnected)return;const ctx=canvas.getContext('2d');drawScene(ctx,img,item,canvas.width,canvas.height);const {cols,rows}=gridFor(item.difficulty||12);ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=1;for(let col=1;col<cols;col++){ctx.beginPath();ctx.moveTo(col*800/cols,0);ctx.lineTo(col*800/cols,600);ctx.stroke();}for(let row=1;row<rows;row++){ctx.beginPath();ctx.moveTo(0,row*600/rows);ctx.lineTo(800,row*600/rows);ctx.stroke();}}catch(e){creator.notice=imageError(e);const m=document.getElementById('creator-message');if(m)m.textContent=creator.notice;}
}
function afterCreatorRender(){if(screen==='imageedit')drawCropPreview();if(creator.busy&&customScreens.includes(screen))document.querySelectorAll('#screen input,#screen textarea,#screen select,#screen button').forEach(el=>el.disabled=true);}
function validateItem(i){if(!i.source)return '请先添加图片。';const q=i.quiz;if(!q.enabled)return '';if(!q.question.trim())return '请填写题目，或关闭“增加一道题”。';if(q.options.some(o=>!o.trim()))return '请填写三个完整选项。';if(new Set(q.options.map(o=>o.trim())).size!==3)return '三个选项不能重复。';if(![0,1,2].includes(Number(q.answer)))return '请选择一个正确答案。';return '';}
function reportCreator(message){creator.notice=message;const m=document.getElementById('creator-message');if(m){m.textContent=message;m.scrollIntoView({block:'nearest'});}else toast(message);}
function creatorGo(page){creator.notice='';go(page);}
async function importFiles(files,replace=false){
 if(!files.length||!creator.draft)return;
 creator.busy=true;creator.notice='';render();const errors=[];
 try{
  for(const file of files){try{
   const source=await readImageFile(file);
   if(replace){const item=draftItem();Object.assign(item,source,{fit:'crop',x:50,y:50,zoom:1,dirtyImage:true});await processScene(item);}
   else{const item={id:uid(),version:null,title:file.name.replace(/\.[^.]+$/,''),text:'',reference:'',quiz:blankQuiz(),fit:'crop',x:50,y:50,zoom:1,difficulty:12,dirtyImage:true,...source};await processScene(item);creator.draft.items.push(item);if(!creator.draft.coverID)creator.draft.coverID=item.id;}
  }catch(e){errors.push(file.name+'：'+imageError(e));}}
  await writeLibrary();creator.storage='草稿已保存到本机';
 }catch(e){errors.push(storageError(e));}
 finally{creator.busy=false;creator.notice=errors.join('\n');render();}
}
function makeVersion(item,setID,id){return {id,setID,itemID:item.id,image:item.image,source:item.source,width:item.width,height:item.height,fit:item.fit,x:item.x,y:item.y,zoom:item.zoom,title:item.title.trim(),text:item.text,reference:item.reference,quiz:structuredClone({...item.quiz,question:item.quiz.question.trim(),options:item.quiz.options.map(o=>o.trim())}),difficulty:item.difficulty,createdAt:new Date().toISOString()};}
async function saveSet(){
 const d=creator.draft;if(!d)return;
 if(!d.name.trim()){reportCreator('请填写故事集名称。');document.getElementById('set-name')?.focus();return;}
 if(!d.items.length){reportCreator('请至少添加一张图片。');return;}
 for(const i of d.items){const error=validateItem(i);if(error){reportCreator((i.title||'图片')+'：'+error);return;}}
 creator.busy=true;clearTimeout(draftTimer);render();
 try{
  const next=snapshotLibrary(),setID=d.editID||uid();
  for(const i of next.draft.items){await processScene(i);if(!i.version||i.dirtyImage){i.version=Math.max(Date.now(),...next.versions.map(v=>v.id+1));next.versions.push(makeVersion(i,setID,i.version));}else{const old=next.versions.find(v=>v.id===i.version);Object.assign(old,{title:i.title.trim(),text:i.text,reference:i.reference,quiz:structuredClone(i.quiz),difficulty:i.difficulty});}}
  const set={id:setID,name:d.name.trim(),description:d.description,coverID:d.coverID||d.items[0].id,items:next.draft.items.map(i=>({id:i.id,version:i.version})),updatedAt:new Date().toISOString()};
  const index=next.sets.findIndex(s=>s.id===setID);if(index>=0)next.sets[index]=set;else next.sets.push(set);next.draft=null;
  await writeLibrary(next);creator.sets=next.sets;creator.versions=next.versions;creator.draft=null;creator.setID=setID;refreshCustomStories();creator.busy=false;creatorGo('setdetail');toast('故事集已保存到本机');
 }catch(e){creator.busy=false;creator.notice=storageError(e);render();}
}
async function editSet(){
 const set=customSet();if(!set)return;
 creator.draft={editID:set.id,name:set.name,description:set.description,coverID:set.coverID,items:set.items.map(entry=>{const v=customVersion(entry.version);return {id:entry.id,version:v.id,source:v.source,image:v.image,width:v.width,height:v.height,fit:v.fit,x:v.x,y:v.y,zoom:v.zoom,title:v.title,text:v.text,reference:v.reference,quiz:structuredClone(v.quiz),difficulty:v.difficulty,dirtyImage:false};})};saveDraftSoon();creatorGo('setedit');
}
function confirmCreator(type){
 sheet='creator-'+type;dialogReturn=document.activeElement;
 const copy={discard:['放弃这份草稿？','已保存的故事集不受影响。','放弃草稿','discardConfirm'],deleteSet:['删除这个故事集？','从我的故事集移除。已收藏的图片、历史记录和进行中的拼图会保留。','删除故事集','deleteSetConfirm'],removeImage:['移除这幅图片？','只从当前草稿移除，保存故事集后生效。','移除图片','removeImageConfirm'],newDraft:['开始新的草稿？','当前草稿会被替换，已保存的故事集不受影响。','开始新草稿','newConfirm'],editDraft:['替换已有草稿？','继续编辑当前故事集会替换另一份未完成草稿。','继续编辑','editConfirm']}[type];
 document.getElementById('overlay').innerHTML=`<div class="modal-shade"><section class="sheet" role="dialog" aria-modal="true" aria-label="${copy[0]}"><h3>${copy[0]}</h3><p>${copy[1]}</p>${button(copy[2],'c:'+copy[3])}${button('取消','closeSheet','text-button')}</section></div>`;document.querySelector('.sheet button').focus();
}
function newDraft(){creator.draft={editID:null,name:'',description:'',coverID:null,items:[]};creator.storage='新草稿';saveDraftSoon();creatorGo('setedit');}
function ownPrepareHTML(s,c){return `${creatorHeader('准备拼图','c:backPlay')}<p class="eyebrow">我的故事</p><h2>${s.title}</h2>${personalArt(s.image)}<p class="muted">${s.quizEnabled?'拼完后，回答创建者设置的问题。':'拼完后欣赏整图，读一读图片的故事。'}</p><h3>拼片数量</h3><div class="difficulty">${[12,24,48].map(n=>`<button class="${count===n?'selected':''}" aria-pressed="${count===n}" data-action="difficulty:${n}">${n===12?'轻松':n===24?'标准':'困难'} · ${n}块</button>`).join('')}</div>${button('查看完整图片','sheet:preview','secondary')}${button(c?'继续拼图':'开始拼图','start')}${c?button('重新开始','restart','text-button'):''}`;}
function ownRevealHTML(s){
 const next=nextOwnStory(s.id),trial=!!creator.trial;
 return `${creatorHeader(trial?'试玩完成':'我的故事',trial?'c:endTrial':'c:backPlay')}<p class="eyebrow">${trial?'这幅图已通过试玩':'画面拼好了'}</p><h2>${s.title}</h2>${personalArt(s.image)}${s.summary?`<p class="reader content-text">${s.summary}</p>`:'<p class="muted">留一点时间，欣赏这幅完整的画。</p>'}${s.ref?`<p class="reference">出处：${s.ref}</p>`:''}${trial?button('返回图片编辑','c:endTrial'):button(state.collected.includes(s.id)?'已收藏 · 取消收藏':'收藏这个故事','save','secondary')}${!trial&&next?button('下一幅','c:nextOwn'):''}${!trial?button('返回故事集','c:backPlay','secondary'):''}`;
}
function ownDetailHTML(s){return `${creatorHeader('故事详情','go:collection',button(state.collected.includes(s.id)?'已收藏':'收藏','save','icon-button'))}<p class="eyebrow">我的创作</p><h2>${s.title}</h2>${personalArt(s.image)}${s.summary?`<p class="reader content-text">${s.summary}</p>`:''}${s.ref?`<p class="reference">出处：${s.ref}</p>`:''}${button('查看大图','sheet:large','secondary')}${button('重新拼这幅图','replay')}`;}
function nextOwnStory(id){const v=customVersion(id),set=creator.sets.find(s=>s.id===v?.setID),index=set?.items.findIndex(i=>i.version===id);return index>=0?set.items[index+1]?.version:null;}
function collectionHTML(){
 const ids=filter==='saved'?state.collected:[...stories.filter(s=>!s.custom).map(s=>s.id),...creator.sets.flatMap(s=>s.items.map(i=>i.version))];
 return `<div class="bar"><strong>我的收藏</strong>${button('设置','go:settings','icon-button')}</div><h2>把故事收进画册。</h2><p class="muted small">收藏 ${state.collected.length}幅 · 已发现 ${state.completed.length}个故事</p><div class="segmented">${['saved','all'].map(f=>`<button class="${filter===f?'active':''}" data-action="filter:${f}" aria-pressed="${filter===f}">${f==='saved'?'收藏':'全部故事'}</button>`).join('')}</div>${ids.length?`<div class="collection">${ids.map(id=>{const s=stories.find(v=>v.id===id),found=state.completed.includes(id);if(!s)return '';return `<button data-action="open:${id}">${found?art('full',false,id):'<div class="art asset-failed">尚未发现</div>'}<strong>${found?(s.custom?s.title:s.person):s.custom?'我的图片':number(id)}</strong><p class="muted">${s.custom?'我的创作':found?s.title:'拼完故事后揭晓'}</p></button>`;}).join('')}</div>`:`<div class="empty"><h3>还没有收藏。</h3><p class="muted">拼完后，把喜欢的图片收进这里。</p>${button('去拼一个故事','go:home')}</div>`}`;
}
async function beginTrial(){
 const i=draftItem(),error=validateItem(i);if(error){reportCreator(error);return;}
 creator.busy=true;clearTimeout(draftTimer);render();
 try{await processScene(i);await writeLibrary();const v=makeVersion(i,'trial',versionID());creator.versions.push(v);refreshCustomStories();creator.trial={current:structuredClone(state.current),storyID,count};sessionStorage.setItem('bibleCreatorTrialBackup',JSON.stringify(creator.trial));storyID=v.id;count=i.difficulty;makeCurrent();creator.busy=false;go('puzzle');}catch(e){creator.busy=false;creator.notice=storageError(e);render();}
}
function endTrial(){const backup=creator.trial;if(!backup)return;state.current=backup.current;storyID=backup.storyID;count=backup.count;creator.versions=creator.versions.filter(v=>v.setID!=='trial');creator.trial=null;sessionStorage.removeItem('bibleCreatorTrialBackup');refreshCustomStories();persist();creatorGo('imageedit');}
document.addEventListener('input',e=>{
 if(creator.busy)return;
 const t=e.target;if(t.dataset.draft&&creator.draft){creator.draft[t.dataset.draft]=t.value;saveDraftSoon();return;}
 const i=draftItem();if(!i)return;
 if(t.dataset.image){const k=t.dataset.image;i[k]=['x','y','zoom'].includes(k)?Number(t.value):t.value;if(['x','y','zoom','fit'].includes(k)){i.dirtyImage=true;const crop=document.getElementById('crop-controls');if(crop)crop.hidden=i.fit==='contain';const out=document.getElementById('range-'+k);if(out)out.value=t.value;drawCropPreview();}}
 else if(t.dataset.quiz){const k=t.dataset.quiz;i.quiz[k]=k==='enabled'?t.checked:k==='answer'?Number(t.value):t.value;document.getElementById('quiz-fields').hidden=!i.quiz.enabled;}
 else if(t.dataset.option!==undefined)i.quiz.options[Number(t.dataset.option)]=t.value;else return;
 saveDraftSoon();
});
document.addEventListener('change',e=>{if(e.target.id==='add-images')importFiles([...e.target.files]);if(e.target.id==='replace-image')importFiles([...e.target.files],true);});
document.addEventListener('dragstart',e=>{const row=e.target.closest('[data-reorder]');if(!row)return;creator.dragItem=row.dataset.reorder;e.dataTransfer.setData('text/plain',creator.dragItem);e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragover',e=>{if(creator.dragItem&&e.target.closest('[data-reorder]'))e.preventDefault();});
document.addEventListener('drop',e=>{const row=e.target.closest('[data-reorder]');if(!row||!creator.dragItem)return;e.preventDefault();const items=creator.draft.items,from=items.findIndex(i=>i.id===creator.dragItem),to=items.findIndex(i=>i.id===row.dataset.reorder);if(from>=0&&to>=0){items.splice(to,0,items.splice(from,1)[0]);saveDraftSoon();render();}creator.dragItem=null;});
document.addEventListener('dragend',()=>creator.dragItem=null);
// Capture creator actions before the shared game handler; built-in game actions remain shared.
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action]');if(!el)return;const [action,arg,...rest]=el.dataset.action.split(':');
 if(creator.busy){e.preventDefault();e.stopImmediatePropagation();return;}
 if(!creator.ready&&(action==='resume'||action==='c'||(action==='inspect'&&arg!=='mysets'))){e.preventDefault();e.stopImmediatePropagation();toast('正在读取本机故事集，请稍候。');return;}
 if(creator.trial&&((action==='exit')||(action==='go'&&['home','collection','mysets'].includes(arg)))){e.stopImmediatePropagation();endTrial();return;}
 if(action==='c'){
  e.preventDefault();e.stopImmediatePropagation();const id=rest.join(':');
  try{
   if(arg==='reload'){location.reload();return;}
   if(arg==='new'){if(creator.draft)confirmCreator('newDraft');else newDraft();return;}
   if(arg==='newConfirm'){newDraft();return;}
   if(arg==='continue'){creatorGo('setedit');return;}
   if(arg==='open'){creator.setID=id;creatorGo('setdetail');return;}
   if(arg==='edit'){if(creator.draft&&creator.draft.editID!==creator.setID)confirmCreator('editDraft');else if(creator.draft)creatorGo('setedit');else await editSet();return;}
   if(arg==='editConfirm'){await editSet();return;}
   if(arg==='backEditor'){creatorGo(creator.draft?.editID?'setdetail':'mysets');return;}
   if(arg==='image'){creator.itemID=id;creatorGo('imageedit');return;}
   if(arg==='backImage'||arg==='doneImage'){const i=draftItem();if(arg==='doneImage'){const err=validateItem(i);if(err){reportCreator(err);return;}}if(i)await processScene(i);await writeLibrary();creatorGo('setedit');return;}
   if(arg==='cover'){creator.draft.coverID=id;saveDraftSoon();renderKeepingPosition();return;}
   if(arg==='up'||arg==='down'){const a=creator.draft.items,index=a.findIndex(i=>i.id===id),to=index+(arg==='up'?-1:1);if(to>=0&&to<a.length){[a[index],a[to]]=[a[to],a[index]];saveDraftSoon();renderKeepingPosition();}return;}
   if(arg==='grid'){draftItem().difficulty=Number(id);saveDraftSoon();renderKeepingPosition();return;}
   if(arg==='saveSet'){await saveSet();return;}
   if(['discard','deleteSet','removeImage'].includes(arg)){confirmCreator(arg);return;}
   if(arg==='discardConfirm'){clearTimeout(draftTimer);const next=snapshotLibrary();next.draft=null;await writeLibrary(next);creator.draft=null;creatorGo('mysets');return;}
   if(arg==='removeImageConfirm'){const d=creator.draft;d.items=d.items.filter(i=>i.id!==creator.itemID);if(d.coverID===creator.itemID)d.coverID=d.items[0]?.id||null;await writeLibrary();creatorGo('setedit');return;}
   if(arg==='deleteSetConfirm'){clearTimeout(draftTimer);const next=snapshotLibrary();next.sets=next.sets.filter(s=>s.id!==creator.setID);if(next.draft?.editID===creator.setID)next.draft=null;await writeLibrary(next);creator.sets=next.sets;creator.draft=next.draft;creatorGo('mysets');return;}
   if(arg==='trial'){await beginTrial();return;}
   if(arg==='endTrial'){endTrial();return;}
   if(arg==='play'){storyID=Number(id);count=current()?.count||customVersion(storyID)?.difficulty||12;creatorGo('prepare');return;}
   if(arg==='backPlay'){creator.setID=story().setID;creatorGo(customSet()?'setdetail':'mysets');return;}
   if(arg==='nextOwn'){const next=nextOwnStory(storyID);if(next){storyID=next;count=customVersion(next).difficulty||12;go('prepare');}return;}
  }catch(error){creator.notice=storageError(error);render();}
  return;
 }
 if(action==='inspect'&&customScreens.includes(arg)){e.stopImmediatePropagation();if(arg==='setedit'||arg==='imageedit'){if(!creator.draft)newDraft();else creatorGo('setedit');}else creatorGo(arg);return;}
 if(isCustom(storyID)&&action==='toGuess'&&current()?.submitResult==='correct'&&!story().quizEnabled){e.stopImmediatePropagation();state.current.phase='reveal';persist();go('reveal');return;}
 if(isCustom(storyID)&&action==='answer'){e.stopImmediatePropagation();chosen=decodeURIComponent([arg,...rest].join(':'));result='';state.current.chosen=chosen;state.current.result='';persist();render();return;}
},true);
function recoverTrial(){try{const backup=JSON.parse(sessionStorage.getItem('bibleCreatorTrialBackup'));if(backup){state.current=backup.current;storyID=backup.storyID;count=backup.count;sessionStorage.removeItem('bibleCreatorTrialBackup');persist();}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&creator.ready&&creator.draft&&!creator.busy){clearTimeout(draftTimer);writeLibrary().catch(e=>{creator.storage=storageError(e);});}});
