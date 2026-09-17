/* ==========================================================
   مرجع مهندس الموقع — منطق التطبيق: بحث، تصنيف، محفوظات، تنقل
   ملاحظة: هذا الملف لا يغيّر أي نص أصلي من entries.js.
   ========================================================== */

let ENTRIES = [];
let STATE = {
  view: "allCategories",  // category | search | favorites | allCategories
                           // | auth | inspections | inspectionNew | inspectionDetail | templates | templateEdit
  primary: null,
  secondary: null,
  query: "",
  inspectionId: null,
  templateEditId: null,
  wizard: null,
};

const FAV_KEY = "engineerRefFavorites_v1";
const THEME_KEY = "engineerRefTheme_v1";

/* ---------------- Local reference customization ---------------- */
function referenceStore() {
  if (typeof LOCAL === "undefined") return { added:{}, overrides:{}, deleted:{} };
  LOCAL.reference = LOCAL.reference || { added:{}, overrides:{}, deleted:{} };
  LOCAL.reference.added = LOCAL.reference.added || {};
  LOCAL.reference.overrides = LOCAL.reference.overrides || {};
  LOCAL.reference.deleted = LOCAL.reference.deleted || {};
  return LOCAL.reference;
}
function refreshReferenceEntries() {
  const r = referenceStore();
  const base = (typeof ENTRIES_DATA !== "undefined" ? ENTRIES_DATA : []).filter(e => !r.deleted[String(e.id)]).map(e => ({...e, ...(r.overrides[String(e.id)] || {})}));
  ENTRIES = base.concat(Object.values(r.added));
}
function findReferenceEntry(id) { return ENTRIES.find(e => String(e.id) === String(id)); }
function saveReferenceEntry(entry) {
  const r = referenceStore();
  if (String(entry.id).startsWith("custom-")) r.added[String(entry.id)] = entry;
  else r.overrides[String(entry.id)] = { title:entry.title || "", originalText:entry.originalText, secondaryCategory:entry.secondaryCategory || "عام" };
  persistLocal(); refreshReferenceEntries();
}
function deleteReferenceEntry(id) {
  const r = referenceStore(); const key=String(id);
  if (key.startsWith("custom-")) delete r.added[key];
  else { r.deleted[key]=true; delete r.overrides[key]; }
  let favs=getFavorites().filter(x=>String(x)!==key); localStorage.setItem(FAV_KEY,JSON.stringify(favs));
  persistLocal(); refreshReferenceEntries();
}

/* ---------------- Arabic-aware normalization for search ---------------- */
function normalizeAr(str) {
  if (!str) return "";
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")   // remove tashkeel/tatweel
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ---------------- Favorites ---------------- */
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch (e) { return []; }
}
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) favs = favs.filter(x => x !== id);
  else favs.push(id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

/* ---------------- Theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.textContent = isDark ? "☀️" : "🌙";
}

/* ---------------- Highlight numbers/units in original text ---------------- */
const UNIT_RE = /([٠-٩0-9]+(?:\.[٠-٩0-9]+)?\s?(?:سم|مم|م\b|كغم|كجم|طن|طن\/م٢|ساعة|ساعات|يوم|أيام|درجة|°C|°|٪|%|مرة القطر|مره القطر)|Ø\s?[٠-٩0-9]+|[٠-٩0-9]+\s?×\s?[٠-٩0-9]+)/g;
function highlightNumbers(text) {
  return escapeHtml(text).replace(UNIT_RE, m => `<mark>${m}</mark>`);
}
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------- Data helpers ---------------- */
function getSecondariesFor(primary) {
  const map = new Map();
  ENTRIES.filter(e => e.primaryCategory === primary).forEach(e => {
    const key = e.secondaryCategory || "عام";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()); // [ [name, count], ... ]
}
function countFor(primary) {
  return ENTRIES.filter(e => e.primaryCategory === primary).length;
}
function filteredEntries() {
  let list = ENTRIES;
  if (STATE.view === "favorites") {
    const favs = getFavorites();
    return ENTRIES.filter(e => favs.includes(e.id));
  }
  if (STATE.primary) list = list.filter(e => e.primaryCategory === STATE.primary);
  if (STATE.secondary) list = list.filter(e => (e.secondaryCategory || "عام") === STATE.secondary);
  if (STATE.query && STATE.query.trim()) {
    const q = normalizeAr(STATE.query);
    const terms = q.split(" ").filter(Boolean);
    list = list.filter(e => {
      const hay = normalizeAr([e.originalText, e.primaryCategory, e.secondaryCategory, e.title].join(" "));
      return terms.every(t => hay.includes(t));
    });
  }
  return list;
}

/* ---------------- Navigation (reference section) ---------------- */
function goHome() {
  goAllCategories();
}
function goCategory(primary, secondary) {
  STATE.view = "category";
  STATE.primary = primary;
  STATE.secondary = secondary || null;
  STATE.query = "";
  render();
}
function goSearch(q) {
  STATE.view = "search";
  STATE.query = q || "";
  render();
}
function goFavorites() {
  STATE.view = "favorites";
  STATE.primary = null; STATE.secondary = null; STATE.query = "";
  render();
}
function goAllCategories() {
  STATE.view = "allCategories";
  STATE.primary = null; STATE.secondary = null; STATE.query = "";
  render();
}

/* ---------------- Rendering ---------------- */
const REFERENCE_VIEWS = new Set(["category", "search", "favorites", "allCategories"]);

function render() {
  try {
    renderInner();
  } catch (err) {
    // لا نُخفي الخطأ: نعرضه بوضوح بدل ترك الصفحة فارغة بصمت
    console.error("render() error:", err);
    const app = document.getElementById("content");
    if (app) {
      app.innerHTML = `<div class="empty"><div class="e-icon">⚠️</div><h3>حدث خطأ أثناء العرض</h3>
        <p>${escapeHtml(err && err.message ? err.message : String(err))}</p>
        <p style="margin-top:10px;"><button class="ghost-btn" onclick="goAllCategories()">العودة للأقسام</button></p></div>`;
    }
  }
}

function renderInner() {
  closeMenuPopover();

  const navInspections = document.getElementById("navInspectionsBtn");
  const navCategories = document.getElementById("navCategoriesBtn");
  if (navInspections) navInspections.classList.toggle("active", ["inspections","inspectionNew","inspectionDetail","templates","templateEdit"].includes(STATE.view));
  if (navCategories) navCategories.classList.toggle("active", STATE.view === "allCategories");

  const app = document.getElementById("content");
  const bc = document.getElementById("breadcrumb");
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClear");
  const searchWrap = document.querySelector(".search-wrap");

  const isReferenceSearchable = REFERENCE_VIEWS.has(STATE.view);
  if (searchWrap) searchWrap.style.display = isReferenceSearchable ? "block" : "none";

  const wantValue = STATE.query || "";
  if (searchInput.value !== wantValue) searchInput.value = wantValue;
  if (clearBtn) clearBtn.style.display = wantValue ? "flex" : "none";
  searchInput.placeholder = STATE.view === "category"
    ? `ابحث داخل ${STATE.primary}...`
    : "ابحث في المرجع...";

  if (STATE.view === "allCategories") {
    bc.innerHTML = "";
    app.innerHTML = renderAllCategories();
  } else if (STATE.view === "favorites") {
    bc.innerHTML = crumbHtml([["الأقسام", goAllCategories], ["المحفوظة", null]]);
    app.innerHTML = renderList(filteredEntries(), { emptyIcon: "☆", emptyTitle: "لا توجد عناصر محفوظة", emptyText: "اضغط على ☆ داخل أي بطاقة لحفظها هنا للوصول السريع." });
  } else if (STATE.view === "search") {
    bc.innerHTML = crumbHtml([["الأقسام", goAllCategories], ["نتائج البحث", null]]);
    app.innerHTML = renderSearchResults();
  } else if (STATE.view === "category") {
    const crumbs = [["الأقسام", goAllCategories], [STATE.primary, () => goCategory(STATE.primary, null)]];
    bc.innerHTML = crumbHtml(crumbs) + (STATE.secondary ? `<span class="sep">›</span><b>${escapeHtml(STATE.secondary)}</b>` : "");
    app.innerHTML = renderCategory();
  } else if (STATE.view === "inspections") {
    bc.innerHTML = crumbHtml([["استلام التسليح", null]]);
    app.innerHTML = renderInspectionsPage();
  } else if (STATE.view === "inspectionNew") {
    bc.innerHTML = crumbHtml([["استلام التسليح", goInspections], ["استلام جديد", null]]);
    app.innerHTML = renderInspectionWizard();
  } else if (STATE.view === "inspectionDetail") {
    bc.innerHTML = crumbHtml([["استلام التسليح", goInspections], ["القائمة", null]]);
    app.innerHTML = renderInspectionDetail();
  } else if (STATE.view === "templates") {
    bc.innerHTML = crumbHtml([["استلام التسليح", goInspections], ["القوالب", null]]);
    app.innerHTML = renderTemplatesPage();
  } else if (STATE.view === "templateEdit") {
    bc.innerHTML = crumbHtml([["استلام التسليح", goInspections], ["القوالب", goTemplates], ["تعديل", null]]);
    app.innerHTML = renderTemplateEditor();
  }

  attachDynamicListeners();
  if (typeof attachInspectionListeners === "function") attachInspectionListeners();
  // لا تعِد المستخدم لأعلى الصفحة عند تغيير حالة بند داخل قائمة الاستلام.
  // بقية التنقلات بين الصفحات تبدأ من الأعلى كالمعتاد.
  if (STATE.view !== "inspectionDetail" && document.activeElement !== searchInput) window.scrollTo(0, 0);
}

function crumbHtml(items) {
  return items.map(([label, fn], i) => {
    const isLast = i === items.length - 1;
    return `${i > 0 ? '<span class="sep">›</span>' : ""}<span class="crumb" data-crumb="${i}">${isLast && !fn ? `<b>${escapeHtml(label)}</b>` : escapeHtml(label)}</span>`;
  }).join("");
}

function renderHome() {
  const activeInspections = typeof LOCAL !== "undefined"
    ? Object.values(LOCAL.inspections || {})
        .filter(i => i.status === "active")
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
    : [];

  const activeCards = activeInspections.map(insp => {
    const items = Array.isArray(insp.items) ? insp.items : [];
    const total = items.length;
    const unchecked = items.filter(i => i.status === "unchecked").length;
    const checked = total - unchecked;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    const typeLabel = typeof elementTypeLabel === "function"
      ? elementTypeLabel(insp.element_type, insp.element_subtype)
      : (insp.element_type || "");

    return `
      <button class="home-insp-card" data-open-insp="${escapeHtml(insp.id)}">
        <div class="home-insp-head">
          <div>
            <div class="home-insp-name">${escapeHtml(insp.name)}</div>
            <div class="home-insp-type">${escapeHtml(typeLabel)}</div>
          </div>
          <div class="home-insp-progress-text">${checked} / ${total}</div>
        </div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="home-insp-foot"><span>تم ${checked} من ${total}</span><b>${pct}%</b></div>
      </button>`;
  }).join("");

  let ongoingSection;
  if (false) {
    ongoingSection = `<div class="home-empty-state">سجّل الدخول لعرض استلاماتك الجارية.</div>`;
  } else if (activeCards) {
    ongoingSection = `<div class="home-inspections">${activeCards}</div>`;
  } else {
    ongoingSection = `
      <div class="home-empty-state">
        <span>لا توجد استلامات جارية</span>
        <button class="home-new-btn" id="newInspBtn">+ استلام جديد</button>
      </div>`;
  }

  return `
    <div class="section-label home-section-title">الاستلامات الجارية</div>
    ${ongoingSection}
  `;
}

function renderAllCategories() {
  const categories = typeof CATEGORY_CONFIG !== "undefined" ? CATEGORY_CONFIG : [];
  const items = categories.map(c => `
    <button class="quick-btn" style="flex-direction:row;justify-content:flex-start;padding:14px;gap:10px;" data-goto="${escapeHtml(c.id)}">
      <span class="qicon">${c.icon}</span>
      <span style="flex:1;text-align:right;">${escapeHtml(c.id)}</span>
      <span style="color:var(--ink-faint);font-weight:500;">${countFor(c.id)}</span>
    </button>
  `).join("");
  return `<div class="quick-grid" style="grid-template-columns:1fr;">${items}</div>`;
}

function renderCategory() {
  const secondaries = getSecondariesFor(STATE.primary);
  const chips = `<div class="chip-row">
      <button class="chip ${!STATE.secondary ? "active" : ""}" data-sec="">الكل <span class="count">${countFor(STATE.primary)}</span></button>
      ${secondaries.map(([name, cnt]) => `<button class="chip ${STATE.secondary === name ? "active" : ""}" data-sec="${escapeHtml(name)}">${escapeHtml(name)} <span class="count">${cnt}</span></button>`).join("")}
    </div>`;

  const activeFilter = STATE.secondary ? `
    <div class="active-filters">
      <div class="filter-pill">${escapeHtml(STATE.secondary)}<button data-clearsec="1">×</button></div>
    </div>` : "";

  const addAction = `<div class="reference-actions"><button class="reference-add-btn" id="addReferenceBtn">＋ إضافة معلومة</button></div>`;
  return chips + activeFilter + addAction + renderList(filteredEntries(), { emptyIcon: "🔍", emptyTitle: "لا نتائج هنا", emptyText: "جرّب تصنيفًا آخر أو امسح الفلتر." });
}

function renderSearchResults() {
  if (!STATE.query.trim()) {
    return `<div class="empty"><div class="e-icon">🔎</div><h3>ابدأ الكتابة للبحث</h3><p>يبحث التطبيق في كل النصوص، العناوين، والتصنيفات.</p></div>`;
  }
  return renderList(filteredEntries(), { emptyIcon: "🔍", emptyTitle: "لا نتائج مطابقة", emptyText: "جرّب كلمات مختلفة أو تحقق من الإملاء." });
}

function renderList(list, emptyOpts) {
  if (!list.length) {
    return `<div class="empty"><div class="e-icon">${emptyOpts.emptyIcon}</div><h3>${emptyOpts.emptyTitle}</h3><p>${emptyOpts.emptyText}</p></div>`;
  }
  const countLabel = `<div class="result-count">${list.length} نتيجة</div>`;
  return countLabel + list.map(cardHtml).join("");
}

function cardHtml(e) {
  const fav = isFavorite(e.id);
  const isLong = e.originalText.length > 150;
  const noteClass = e.noteType ? ` note-${e.noteType}` : "";
  const path = [e.primaryCategory, e.secondaryCategory].filter(Boolean).join(" › ");
  const img = e.hasImage ? `
    <div class="card-img" data-img="${escapeHtml(e.imagePath)}">
      <img src="${escapeHtml(e.imagePath)}" loading="lazy" alt="${escapeHtml(e.imageCaption || "")}">
      <div class="cap">🖼 ${escapeHtml(e.imageCaption || "رسم توضيحي من الملف")}</div>
    </div>` : "";

  return `
    <div class="card${noteClass}" data-card="${e.id}">
      <div class="card-top">
        ${isLong ? `<div class="card-title">${escapeHtml(e.title)}</div>` : `<div class="card-body no-title ${isLong ? "clamped" : ""}">${highlightNumbers(e.originalText)}</div>`}
        <button class="fav-btn ${fav ? "active" : ""}" data-fav="${e.id}">${fav ? "★" : "☆"}</button>
      </div>
      ${isLong ? `<div class="card-body clamped" data-full="0">${highlightNumbers(e.originalText)}</div>` : ""}
      ${isLong ? `<button class="more-btn" data-more="${e.id}">عرض المزيد</button>` : ""}
      ${e.noteType ? `<div class="badge-row"><span class="tag-badge note-${e.noteType}">${e.noteType}</span></div>` : ""}
      ${img}
      <div class="reference-card-actions">
        <button data-edit-ref="${escapeHtml(String(e.id))}">✏️ تعديل</button>
        <button class="danger-text" data-delete-ref="${escapeHtml(String(e.id))}">🗑️ حذف</button>
      </div>
      <div class="card-path">${escapeHtml(path)}</div>
    </div>`;
}

/* ---------------- Dynamic listeners (re-attached after each render) ---------------- */
function attachDynamicListeners() {
  const homeInspectionsBtn = document.getElementById("homeInspectionsBtn");
  if (homeInspectionsBtn) homeInspectionsBtn.onclick = goInspections;
  const homeCategoriesBtn = document.getElementById("homeCategoriesBtn");
  if (homeCategoriesBtn) homeCategoriesBtn.onclick = goAllCategories;
  document.querySelectorAll("[data-goto]").forEach(el => {
    el.onclick = () => goCategory(el.dataset.goto, null);
  });
  const sel = document.getElementById("primarySelect");
  if (sel) sel.onchange = () => { if (sel.value) goCategory(sel.value, null); };

  document.querySelectorAll("[data-sec]").forEach(el => {
    el.onclick = () => goCategory(STATE.primary, el.dataset.sec || null);
  });
  document.querySelectorAll("[data-clearsec]").forEach(el => {
    el.onclick = () => goCategory(STATE.primary, null);
  });
  document.querySelectorAll("[data-fav]").forEach(el => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      const rawId = el.dataset.fav;
      const id = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;
      toggleFavorite(id);
      el.classList.toggle("active");
      el.textContent = el.classList.contains("active") ? "★" : "☆";
      if (STATE.view === "favorites") render();
    };
  });
  document.querySelectorAll("[data-more]").forEach(el => {
    el.onclick = () => {
      const card = el.closest(".card");
      const body = card.querySelector(".card-body");
      body.classList.toggle("clamped");
      el.textContent = body.classList.contains("clamped") ? "عرض المزيد" : "عرض أقل";
    };
  });
  document.querySelectorAll("[data-img]").forEach(el => {
    el.onclick = () => openLightbox(el.dataset.img);
  });
  const addReferenceBtn = document.getElementById("addReferenceBtn");
  if (addReferenceBtn) addReferenceBtn.onclick = () => openReferenceEditor();
  document.querySelectorAll("[data-edit-ref]").forEach(el => { el.onclick = () => openReferenceEditor(el.dataset.editRef); });
  document.querySelectorAll("[data-delete-ref]").forEach(el => {
    el.onclick = () => {
      const entry=findReferenceEntry(el.dataset.deleteRef); if(!entry) return;
      showConfirm({title:"حذف المعلومة؟",text:"سيتم حذفها من مرجعك المحفوظ على هذا الجهاز.",confirmLabel:"حذف",danger:true,onConfirm:()=>{deleteReferenceEntry(entry.id);render();}});
    };
  });

  // breadcrumb clicks
  const bcEl = document.getElementById("breadcrumb");
  const crumbs = bcEl.querySelectorAll(".crumb");
  const bcItemsCount = crumbs.length;
  crumbs.forEach((c, i) => {
    c.onclick = () => {
      const isLast = i === bcItemsCount - 1;
      if (isLast) return; // آخر عنصر في المسار هو الصفحة الحالية، بدون رابط
      if (STATE.view === "category" && i === 1) { goCategory(STATE.primary, null); return; }
      if (i === 0) { goHome(); return; }
      // للمسارات الأخرى (استلام التسليح...) أعد التوجيه حسب الترتيب المعروف
      if (STATE.view === "inspectionNew" || STATE.view === "inspectionDetail" || STATE.view === "templates" || STATE.view === "templateEdit") {
        if (i === 1) goInspections();
        else if (i === 2 && STATE.view === "templateEdit") goTemplates();
      }
    };
  });
}

function openReferenceEditor(id) {
  const existing = id != null ? findReferenceEntry(id) : null;
  const primary = existing?.primaryCategory || STATE.primary;
  if (!primary) return;
  const currentSecondary = existing?.secondaryCategory || STATE.secondary || "عام";
  const secondaryNames = Array.from(new Set(getSecondariesFor(primary).map(([name]) => name).concat([currentSecondary])));
  const overlay=document.getElementById("confirmOverlay"), sheet=document.getElementById("confirmSheet");
  sheet.innerHTML=`
    <h3>${existing ? "تعديل المعلومة" : "إضافة معلومة"}</h3>
    <div class="ref-editor-field"><label>القسم الفرعي</label><select id="refSecondary">${secondaryNames.map(x=>`<option ${x===currentSecondary?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select></div>
    <div class="ref-editor-field"><label>المعلومة</label><textarea id="refText" rows="5" placeholder="اكتب المعلومة هنا...">${escapeHtml(existing?.originalText || "")}</textarea></div>
    <div class="confirm-actions"><button id="refCancel">إلغاء</button><button class="ref-save" id="refSave">حفظ</button></div>`;
  overlay.classList.add("open");
  document.getElementById("refCancel").onclick=()=>overlay.classList.remove("open");
  document.getElementById("refSave").onclick=()=>{
    const text=document.getElementById("refText").value.trim(); if(!text){document.getElementById("refText").focus();return;}
    const secondary=document.getElementById("refSecondary").value || "عام";
    const entry=existing ? {...existing,originalText:text,secondaryCategory:secondary,title:text.length>150?(existing.title||text.slice(0,70)):""} : {
      id:"custom-"+uid(), primaryCategory:primary, secondaryCategory:secondary, title:"", originalText:text,
      noteType:"", hasImage:false, imagePath:"", imageCaption:""
    };
    saveReferenceEntry(entry); overlay.classList.remove("open"); render(); setSyncStatus("تم الحفظ على الجهاز",1200);
  };
}

function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  document.getElementById("lightboxImg").src = src;
  lb.classList.add("open");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}

/* ---------------- Top nav: menu popover ---------------- */
function openMenuPopover() {
  const pop = document.getElementById("navMenuPopover");
  if (!pop) return;
  pop.classList.remove("hidden");
  if (!document.getElementById("menuBackdrop")) {
    const bd = document.createElement("div");
    bd.id = "menuBackdrop";
    bd.className = "menu-backdrop";
    bd.onclick = closeMenuPopover;
    document.body.appendChild(bd);
  }
}
function closeMenuPopover() {
  const pop = document.getElementById("navMenuPopover");
  if (pop) pop.classList.add("hidden");
  const bd = document.getElementById("menuBackdrop");
  if (bd) bd.remove();
}
function toggleMenuPopover() {
  const pop = document.getElementById("navMenuPopover");
  if (!pop) return;
  if (pop.classList.contains("hidden")) openMenuPopover();
  else closeMenuPopover();
}

/* ---------------- Init ---------------- */
async function init() {
  initTheme();
  if (typeof ENTRIES_DATA === "undefined" || !ENTRIES_DATA.length) {
    document.getElementById("content").innerHTML = `<div class="empty"><div class="e-icon">⚠️</div><h3>تعذّر تحميل البيانات</h3><p>ملف entries.js غير موجود أو فارغ أو لم يُحمَّل بسبب مشكلة Cache. جرّب تحديث الصفحة (Pull to refresh) أو امسح ذاكرة التخزين المؤقت لـ Safari.</p></div>`;
    return;
  }
  refreshReferenceEntries();

  document.getElementById("themeToggle").onclick = toggleTheme;
  updateThemeIcon();
  document.getElementById("lightboxClose").onclick = closeLightbox;
  document.getElementById("lightbox").onclick = (e) => { if (e.target.id === "lightbox") closeLightbox(); };

    const navInspectionsBtn = document.getElementById("navInspectionsBtn");
  if (navInspectionsBtn) navInspectionsBtn.onclick = goInspections;
  const navCategoriesBtn = document.getElementById("navCategoriesBtn");
  if (navCategoriesBtn) navCategoriesBtn.onclick = goAllCategories;

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClear");
  searchInput.addEventListener("input", () => {
    const val = searchInput.value;
    STATE.query = val;
    if (STATE.view === "category") {
      render(); // live filter within the current category
    } else if (val.trim()) {
      STATE.view = "search";
      render();
    } else {
      goAllCategories();
    }
  });
  clearBtn.onclick = () => {
    STATE.query = "";
    if (STATE.view === "search") goAllCategories();
    else render();
    searchInput.focus();
  };

  render();

  // تسجيل Service Worker لجعل التطبيق قابلاً للتثبيت والعمل دون اتصال.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

document.addEventListener("DOMContentLoaded", init);
