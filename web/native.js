'use strict';
const nativeHost=window.webkit?.messageHandlers?.puzzle;
if(nativeHost)document.documentElement.classList.add('native');
function nativePost(message){nativeHost?.postMessage(message);}
window.applyNativeTheme=function(colors){
 for(const [key,value] of Object.entries(colors))document.documentElement.style.setProperty('--'+key,value);
};
window.applyNativeTextScale=function(scale){document.documentElement.style.setProperty('--reading-scale',String(scale));};
window.receiveNativeImages=async function(inputID,images){
 // Use the same decode, crop and versioning pipeline as browser file imports.
 const files=images.map((item)=>{
  const bytes=Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0));
  return new File([bytes],item.name,{type:item.mime});
 });
 if(!creator.draft)return;
 await importFiles(files,inputID==='replace-image');
};
window.nativeImportError=function(message){creator.notice=message;render();};
if(nativeHost){
 document.addEventListener('click',e=>{
  const input=e.target.closest('input[type="file"]')||e.target.closest('.file-button')?.querySelector('input[type="file"]');
  if(!input||creator.busy)return;
  e.preventDefault();nativePost({type:'pickImages',inputID:input.id,multiple:input.multiple});
 },true);
 const dropWithoutFeedback=dropPiece;
 dropPiece=function(...args){dropWithoutFeedback(...args);nativePost({type:'feedback',event:'place',sound:state.settings.sound,haptic:state.settings.haptic});};
 const returnWithoutFeedback=returnPiece;
 returnPiece=function(...args){returnWithoutFeedback(...args);nativePost({type:'feedback',event:'place',sound:state.settings.sound,haptic:state.settings.haptic});};
 const submitWithoutFeedback=submitPuzzle;
 submitPuzzle=function(){submitWithoutFeedback();if(current()?.submitResult==='correct')nativePost({type:'feedback',event:'complete',sound:state.settings.sound,haptic:state.settings.haptic});};
 document.addEventListener('click',e=>{if(e.target.closest('[data-action="save"]'))nativePost({type:'feedback',event:'place',sound:state.settings.sound,haptic:state.settings.haptic});});
}
window.persistNativeState=function(){cancelDrag();persist();clearTimeout(draftTimer);if(creator.db)writeLibrary().catch(()=>{});};
window.addEventListener('pagehide',window.persistNativeState);
