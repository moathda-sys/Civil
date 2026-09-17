/* ==========================================================
   Supabase client + data layer (استلام التسليح فقط)
   المرجع الأساسي (entries.js) لا يمر من هنا إطلاقًا ويبقى Public.
   ========================================================== */

/* ------------------------------------------------------------
   ضع بيانات مشروعك هنا فقط. هذا هو المكان الوحيد الذي يحتاج تعديل.
   Project Settings → API في لوحة Supabase:
     SUPABASE_URL  = Project URL
     SUPABASE_ANON_KEY = anon / publishable key (وليس service_role!)
------------------------------------------------------------- */
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

let sbClient = null;
function getSb() {
  if (sbClient) return sbClient;
  if (typeof window.supabase === "undefined") return null;
  if (SUPABASE_URL.includes("YOUR-PROJECT-REF") || SUPABASE_ANON_KEY.includes("YOUR-ANON")) {
    return null; // لم يتم ضبط الإعدادات بعد
  }
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sbClient;
}
function supabaseConfigured() {
  return !!getSb();
}

/* ---------------- Local cache (offline-first source of truth) ---------------- */
const LOCAL_KEY = "reinfLocalData_v1";
const QUEUE_KEY = "reinfSyncQueue_v1";

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { templates: {}, inspections: {} };
  } catch (e) {
    return { templates: {}, inspections: {} };
  }
}
function saveLocal(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch (e) { /* storage full/unavailable */ }
}
function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* ignore */ }
}

let LOCAL = loadLocal();
let SYNC_QUEUE = loadQueue();
let syncing = false;

function setSyncStatus(text, autoHideMs) {
  const el = document.getElementById("syncToast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._t);
  if (autoHideMs) {
    el._t = setTimeout(() => el.classList.remove("show"), autoHideMs);
  }
}

/* op: { table: 'inspections'|'inspection_items'|'templates'|'template_items', action: 'upsert'|'delete', payload } */
function queueOp(op) {
  SYNC_QUEUE.push({ ...op, ts: Date.now() });
  saveQueue(SYNC_QUEUE);
  flushQueue();
}

async function flushQueue() {
  if (syncing) return;
  const sb = getSb();
  const user = getCurrentUser && getCurrentUser();
  if (!sb || !user) return;
  if (!navigator.onLine) { setSyncStatus("غير متصل - سيتم الحفظ عند عودة الاتصال"); return; }
  if (!SYNC_QUEUE.length) return;

  syncing = true;
  setSyncStatus("جاري المزامنة...");
  while (SYNC_QUEUE.length) {
    const op = SYNC_QUEUE[0];
    try {
      if (op.action === "upsert") {
        const { error } = await sb.from(op.table).upsert(op.payload);
        if (error) throw error;
      } else if (op.action === "delete") {
        const { error } = await sb.from(op.table).delete().eq("id", op.payload.id);
        if (error) throw error;
      }
      SYNC_QUEUE.shift();
      saveQueue(SYNC_QUEUE);
    } catch (e) {
      // اترك العملية في الطابور وحاول لاحقًا (قد تكون مشكلة شبكة مؤقتة)
      syncing = false;
      setSyncStatus("تعذّرت المزامنة - سيُعاد المحاولة");
      return;
    }
  }
  syncing = false;
  setSyncStatus("تم الحفظ", 1500);
}

window.addEventListener("online", flushQueue);

/* ---------------- Public data API used by inspection-app.js ---------------- */

function localSnapshot() { return LOCAL; }

function persistLocal() { saveLocal(LOCAL); }

/** يحمّل كل بيانات المستخدم من Supabase (يُستدعى بعد تسجيل الدخول). */
async function pullAllUserData() {
  const sb = getSb();
  const user = getCurrentUser && getCurrentUser();
  if (!sb || !user) return false;
  if (!navigator.onLine) { setSyncStatus("غير متصل - سيتم عرض آخر نسخة محفوظة"); return false; }
  try {
    const [tplRes, tplItemsRes, inspRes, inspItemsRes] = await Promise.all([
      sb.from("templates").select("*").eq("user_id", user.id),
      sb.from("template_items").select("*"),
      sb.from("inspections").select("*").eq("user_id", user.id),
      sb.from("inspection_items").select("*"),
    ]);
    if (tplRes.error || tplItemsRes.error || inspRes.error || inspItemsRes.error) {
      throw tplRes.error || tplItemsRes.error || inspRes.error || inspItemsRes.error;
    }
    const templates = {};
    (tplRes.data || []).forEach(t => { templates[t.id] = { ...t, items: [] }; });
    (tplItemsRes.data || []).forEach(it => { if (templates[it.template_id]) templates[it.template_id].items.push(it); });
    Object.values(templates).forEach(t => t.items.sort((a, b) => a.position - b.position));

    const inspections = {};
    (inspRes.data || []).forEach(i => { inspections[i.id] = { ...i, items: [] }; });
    (inspItemsRes.data || []).forEach(it => { if (inspections[it.inspection_id]) inspections[it.inspection_id].items.push(it); });
    Object.values(inspections).forEach(i => i.items.sort((a, b) => a.position - b.position));

    LOCAL = { templates, inspections };
    persistLocal();
    setSyncStatus("تم التحديث", 1200);
    return true;
  } catch (e) {
    setSyncStatus("تعذّر تحميل البيانات من الخادم");
    return false;
  }
}

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/* ---- Inspections ---- */
function upsertInspectionLocal(insp) {
  insp.updated_at = new Date().toISOString();
  LOCAL.inspections[insp.id] = { ...(LOCAL.inspections[insp.id] || {}), ...insp, items: LOCAL.inspections[insp.id]?.items || insp.items || [] };
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) {
    const { items, ...row } = LOCAL.inspections[insp.id];
    queueOp({ table: "inspections", action: "upsert", payload: { ...row, user_id: user.id } });
  }
}
function deleteInspectionLocal(id) {
  delete LOCAL.inspections[id];
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "inspections", action: "delete", payload: { id } });
}
function upsertInspectionItemLocal(inspectionId, item) {
  item.updated_at = new Date().toISOString();
  const insp = LOCAL.inspections[inspectionId];
  if (!insp) return;
  const idx = insp.items.findIndex(i => i.id === item.id);
  if (idx >= 0) insp.items[idx] = { ...insp.items[idx], ...item };
  else insp.items.push(item);
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "inspection_items", action: "upsert", payload: { ...item, inspection_id: inspectionId } });
}
function deleteInspectionItemLocal(inspectionId, itemId) {
  const insp = LOCAL.inspections[inspectionId];
  if (insp) insp.items = insp.items.filter(i => i.id !== itemId);
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "inspection_items", action: "delete", payload: { id: itemId } });
}

/* ---- Templates (custom only; defaults live in inspections.js) ---- */
function upsertTemplateLocal(tpl) {
  tpl.updated_at = new Date().toISOString();
  LOCAL.templates[tpl.id] = { ...(LOCAL.templates[tpl.id] || {}), ...tpl, items: LOCAL.templates[tpl.id]?.items || tpl.items || [] };
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) {
    const { items, ...row } = LOCAL.templates[tpl.id];
    queueOp({ table: "templates", action: "upsert", payload: { ...row, user_id: user.id } });
  }
}
function deleteTemplateLocal(id) {
  delete LOCAL.templates[id];
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "templates", action: "delete", payload: { id } });
}
function upsertTemplateItemLocal(templateId, item) {
  const tpl = LOCAL.templates[templateId];
  if (!tpl) return;
  const idx = tpl.items.findIndex(i => i.id === item.id);
  if (idx >= 0) tpl.items[idx] = { ...tpl.items[idx], ...item };
  else tpl.items.push(item);
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "template_items", action: "upsert", payload: { ...item, template_id: templateId } });
}
function deleteTemplateItemLocal(templateId, itemId) {
  const tpl = LOCAL.templates[templateId];
  if (tpl) tpl.items = tpl.items.filter(i => i.id !== itemId);
  persistLocal();
  const user = getCurrentUser && getCurrentUser();
  if (user) queueOp({ table: "template_items", action: "delete", payload: { id: itemId } });
}
