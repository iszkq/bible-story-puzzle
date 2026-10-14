'use strict';
const Shared=require('./shared');
const KEY='picture-puzzle-wechat-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const blankQuiz=()=>({enabled:false,question:'',options:['','',''],answer:0});
const initial=()=>({completed:[],collected:[],current:null,settings:{sound:true,haptic:true},sets:[],versions:[],draft:null,trialBackup:null});
function createStore(api){
  let state=initial(),warning='';
  try{
    const saved=api.getStorageSync(KEY);
    if(saved){
      if(!Array.isArray(saved.sets)||!Array.isArray(saved.versions)||!Array.isArray(saved.completed)||!Array.isArray(saved.collected)||!saved.settings)throw Error('invalid save');
      state=Object.assign(initial(),saved);
      if(state.trialBackup){state.current=state.trialBackup.current;state.trialBackup=null;state.versions=state.versions.filter(v=>!String(v.id).startsWith('trial-'));api.setStorageSync(KEY,state);}
    }
  }catch(e){warning='本地资料未能读取。请先重试读取，确认后再重置；本次不会覆盖原资料。';}
  let blocked=!!warning;
  function save(){
    if(blocked)throw Error(warning);
    try{api.setStorageSync(KEY,clone(state));warning='';}
    catch(e){warning='未能保存到本机，可能空间不足。当前内容仍在页面中，请释放空间后重试。';throw Error(warning);}
  }
  function version(id){return state.versions.find(v=>v.id===id);}
  function story(id){
    const official=Shared.stories.find(s=>s.id===id);
    if(official)return {...official,custom:false,quizEnabled:true};
    const v=version(id);if(!v)return null;
    const q=v.quiz||blankQuiz();
    return {...v,custom:true,person:q.enabled?q.options[q.answer]:v.title,summary:v.text,ref:v.reference,question:q.question,options:q.options,quizEnabled:q.enabled,clue:'可以再观察画面，也可以直接查看故事。'};
  }
  function start(id,count,trial=false){
    if(!story(id))throw Error('找不到这幅图片。');
    const before=clone(state);
    if(trial&&!state.trialBackup)state.trialBackup={current:clone(state.current)};
    state.current=Shared.createGame(id,count);if(trial)state.current.trial=true;try{save();}catch(e){state=before;throw e;}return state.current;
  }
  function endTrial(){if(state.trialBackup){state.current=state.trialBackup.current;state.trialBackup=null;state.versions=state.versions.filter(v=>!String(v.id).startsWith('trial-'));save();}}
  function submit(){
    const before=clone(state);
    const c=state.current;if(!c||c.phase!=='puzzle')return null;
    c.submitAttempts++;c.submitResult=Shared.checkPuzzle(c);
    if(c.submitResult==='correct'){
      const s=story(c.storyID);c.phase=s.quizEnabled?'guess':'reveal';
      if(!c.trial&&!state.completed.includes(c.storyID))state.completed.push(c.storyID);
    }
    try{save();}catch(e){state=before;throw e;}return c.submitResult;
  }
  function draft(setID){
    const set=state.sets.find(s=>s.id===setID);
    state.draft=set?{editID:set.id,name:set.name,description:set.description,coverID:set.coverID,items:set.items.map(item=>({...clone(version(item.version)),id:item.id,version:item.version}))}:{name:'',description:'',coverID:null,items:[]};
    save();return state.draft;
  }
  function addImage(source,width,height){
    if(width*height>40000000)throw Error('图片超过4000万像素，请缩小后重试。');
    const item={id:uid(),source,width,height,title:'',text:'',reference:'',quiz:blankQuiz(),fit:'crop',x:50,y:50,zoom:1,difficulty:12,image:'',sceneKey:''};
    state.draft.items.push(item);if(!state.draft.coverID)state.draft.coverID=item.id;save();return item;
  }
  function validateItem(item){
    if(!item.image)throw Error('请先完成每张图片的编辑。');
    const q=item.quiz;if(q.enabled&&(!q.question.trim()||q.options.some(o=>!o.trim())||new Set(q.options.map(o=>o.trim())).size!==3||![0,1,2].includes(Number(q.answer))))throw Error('题目需要完整问题、三个不重复选项及正确答案。');
  }
  function validateDraft(){
    const d=state.draft;if(!d||!d.name.trim())throw Error('请填写图片集名称。');
    if(!d.items.length)throw Error('请添加至少一张图片。');
    for(const item of d.items)validateItem(item);
  }
  function commit(){
    validateDraft();const before=clone(state),d=state.draft,setID=d.editID||uid();
    const items=d.items.map(item=>{
      const old=version(item.version),same=old&&old.sceneKey===item.sceneKey;
      const id=same?old.id:'image-'+uid();
      const v={...clone(item),id,setID,itemID:item.id,title:item.title.trim()||'未命名图片',quiz:{...item.quiz,question:item.quiz.question.trim(),options:item.quiz.options.map(o=>o.trim()),answer:Number(item.quiz.answer)}};
      delete v.version;
      if(same)Object.assign(old,v);else state.versions.push(v);
      return {id:item.id,version:id};
    });
    const set={id:setID,name:d.name.trim(),description:d.description,coverID:d.coverID,items};
    const index=state.sets.findIndex(s=>s.id===setID);if(index<0)state.sets.push(set);else state.sets[index]=set;
    state.draft=null;
    try{save();}catch(e){state=before;throw e;}
    return set;
  }
  function trial(item){
    validateItem(item);
    // Draft preview has its own version. It never changes the saved library or old game.
    const id='trial-'+uid();
    const before=clone(state);
    state.versions=state.versions.filter(v=>!String(v.id).startsWith('trial-'));
    state.versions.push({...clone(item),id,title:item.title||'试玩图片'});
    try{return start(id,item.difficulty,true);}catch(e){state=before;throw e;}
  }
  function resetProgress(){state.completed=[];state.collected=[];state.current=null;state.trialBackup=null;save();}
  function recover(){blocked=false;state=initial();warning='';save();}
  return {get state(){return state;},get warning(){return warning;},get blocked(){return blocked;},save,story,version,start,submit,draft,addImage,commit,trial,endTrial,resetProgress,recover,blankQuiz,uid};
}
module.exports={createStore,KEY,clone,blankQuiz,uid};
