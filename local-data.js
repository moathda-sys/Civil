/* Local-only data layer: no account, no server, no external database. */
const LOCAL_KEY = "reinfLocalData_v2";
const LEGACY_LOCAL_KEY = "reinfLocalData_v1";
function emptyLocal(){ return { templates:{}, inspections:{} }; }
function loadLocal(){
  try {
    const current=localStorage.getItem(LOCAL_KEY);
    const legacy=localStorage.getItem(LEGACY_LOCAL_KEY);
    const parsed=JSON.parse(current || legacy || "null");
    return parsed && typeof parsed === "object" ? {templates:parsed.templates||{}, inspections:parsed.inspections||{}} : emptyLocal();
  } catch(e){ return emptyLocal(); }
}
function saveLocal(data){ try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch(e){ setSyncStatus("تعذر الحفظ على الجهاز"); } }
let LOCAL=loadLocal();
function localSnapshot(){ return LOCAL; }
function persistLocal(){ saveLocal(LOCAL); }
function setSyncStatus(text, autoHideMs){
  const el=document.getElementById("syncToast"); if(!el) return;
  el.textContent=text; el.classList.add("show"); clearTimeout(el._t);
  if(autoHideMs) el._t=setTimeout(()=>el.classList.remove("show"),autoHideMs);
}
function uid(){ if(window.crypto&&window.crypto.randomUUID) return window.crypto.randomUUID(); return "id-"+Date.now()+"-"+Math.random().toString(16).slice(2); }
function upsertInspectionLocal(insp){ insp.updated_at=new Date().toISOString(); LOCAL.inspections[insp.id]={...(LOCAL.inspections[insp.id]||{}),...insp,items:LOCAL.inspections[insp.id]?.items||insp.items||[]}; persistLocal(); }
function deleteInspectionLocal(id){ delete LOCAL.inspections[id]; persistLocal(); }
function upsertInspectionItemLocal(inspectionId,item){ item.updated_at=new Date().toISOString(); const insp=LOCAL.inspections[inspectionId]; if(!insp)return; const idx=insp.items.findIndex(i=>i.id===item.id); if(idx>=0) insp.items[idx]={...insp.items[idx],...item}; else insp.items.push(item); persistLocal(); }
function deleteInspectionItemLocal(inspectionId,itemId){ const insp=LOCAL.inspections[inspectionId]; if(insp) insp.items=insp.items.filter(i=>i.id!==itemId); persistLocal(); }
function upsertTemplateLocal(tpl){ tpl.updated_at=new Date().toISOString(); LOCAL.templates[tpl.id]={...(LOCAL.templates[tpl.id]||{}),...tpl,items:LOCAL.templates[tpl.id]?.items||tpl.items||[]}; persistLocal(); }
function deleteTemplateLocal(id){ delete LOCAL.templates[id]; persistLocal(); }
function upsertTemplateItemLocal(templateId,item){ const tpl=LOCAL.templates[templateId]; if(!tpl)return; const idx=tpl.items.findIndex(i=>i.id===item.id); if(idx>=0) tpl.items[idx]={...tpl.items[idx],...item}; else tpl.items.push(item); persistLocal(); }
function deleteTemplateItemLocal(templateId,itemId){ const tpl=LOCAL.templates[templateId]; if(tpl) tpl.items=tpl.items.filter(i=>i.id!==itemId); persistLocal(); }
