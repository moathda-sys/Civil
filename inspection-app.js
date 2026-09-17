/* ==========================================================
   استلام التسليح — منطق الواجهة (منفصل تمامًا عن مرجع entries.js)
   ========================================================== */

const MAX_ACTIVE_INSPECTIONS = 10;
const STATUS_LABELS = { unchecked: "لم يتم الفحص", pass: "مطابق", issue: "ملاحظة", na: "N/A" };
const STATUS_ICONS = { unchecked: "☐", pass: "✓", issue: "✕", na: "—" };

let INSP_FILTER = "active"; // active | archive (archive tab also includes completed)
let WARN_INCOMPLETE = {};   // { [inspectionId]: true } ephemeral, not persisted

/* ---------------- Navigation ---------------- */
function goInspections() {
  STATE.view = "inspections";
  STATE.inspectionId = null;
  render();
}
function goInspectionNew() {
  const activeCount = Object.values(LOCAL.inspections).filter(i => i.status === "active").length;
  if (activeCount >= MAX_ACTIVE_INSPECTIONS) {
    alert(`وصلت للحد الأقصى (${MAX_ACTIVE_INSPECTIONS}) من القوائم الجارية. أكمل أو أرشف إحداها قبل إنشاء قائمة جديدة.`);
    return;
  }
  STATE.view = "inspectionNew";
  STATE.wizard = { step: 1, elementType: null, elementSubtype: null, templateId: null };
  render();
}
function goInspectionDetail(id) {
  STATE.view = "inspectionDetail";
  STATE.inspectionId = id;
  render();
}
function goTemplates() {
  STATE.view = "templates";
  render();
}
function goTemplateEdit(id) {
  STATE.view = "templateEdit";
  STATE.templateEditId = id; // null = new custom template
  render();
}

/* ---------------- Confirm sheet helper ---------------- */
function showConfirm({ title, text, confirmLabel = "تأكيد", danger = true, onConfirm }) {
  const overlay = document.getElementById("confirmOverlay");
  const sheet = document.getElementById("confirmSheet");
  sheet.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    <div class="confirm-actions">
      <button id="confirmCancel">إلغاء</button>
      <button class="${danger ? "danger" : ""}" id="confirmOk">${escapeHtml(confirmLabel)}</button>
    </div>`;
  overlay.classList.add("open");
  document.getElementById("confirmCancel").onclick = () => overlay.classList.remove("open");
  document.getElementById("confirmOk").onclick = () => { overlay.classList.remove("open"); onConfirm(); };
}

/* ==========================================================
   Rendering: Inspections list
   ========================================================== */
function renderInspectionsPage() {
  const all = Object.values(LOCAL.inspections).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  const active = all.filter(i => i.status === "active");
  const archive = all.filter(i => i.status !== "active");
  const list = INSP_FILTER === "active" ? active : archive;

  const cards = list.map(insp => {
    const total = insp.items.length;
    const passCount = insp.items.filter(i => i.status === "pass").length;
    const issueCount = insp.items.filter(i => i.status === "issue").length;
    const uncCount = insp.items.filter(i => i.status === "unchecked").length;
    const checked = total - uncCount;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    return `
      <div class="insp-card" data-open-insp="${insp.id}">
        <div class="it">${escapeHtml(insp.name)}</div>
        <div class="ty">${escapeHtml(elementTypeLabel(insp.element_type, insp.element_subtype))} · <span class="status-pill ${insp.status}">${statusLabel(insp.status)}</span></div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="insp-stats">
          <span>${checked} / ${total}</span>
          <span class="pass">✓ ${passCount}</span>
          <span class="issue">✕ ${issueCount}</span>
          <span class="unc">☐ ${uncCount}</span>
        </div>
      </div>`;
  }).join("");

  const userBar = "";

  return `
    ${userBar}
    <button class="big-btn" id="newInspBtn">+ استلام جديد</button>
    <div class="status-tabs">
      <button class="${INSP_FILTER === "active" ? "active" : ""}" data-filter="active">الجارية (${active.length})</button>
      <button class="${INSP_FILTER === "archive" ? "active" : ""}" data-filter="archive">المكتملة / الأرشيف (${archive.length})</button>
    </div>
    ${INSP_FILTER === "active" ? `<div class="limit-note">الحد الأقصى ${MAX_ACTIVE_INSPECTIONS} قوائم جارية في نفس الوقت</div>` : ""}
    ${list.length ? cards : `<div class="empty"><div class="e-icon">🧱</div><h3>لا توجد قوائم${INSP_FILTER === "active" ? " جارية" : ""}</h3><p>اضغط "+ استلام جديد" للبدء.</p></div>`}
    <div class="section-actions">
      <button class="link-btn" id="manageTemplatesBtn">📋 إدارة القوالب المخصصة</button>
    </div>
  `;
}

function elementTypeLabel(type, subtype) {
  const t = INSPECTION_ELEMENT_TYPES.find(x => x.id === type);
  if (!t) return type || "";
  if (subtype && t.subtypes) {
    const s = t.subtypes.find(x => x.id === subtype);
    return `${t.label} · ${s ? s.label : subtype}`;
  }
  return t.label;
}
function statusLabel(s) {
  return s === "active" ? "جاري" : s === "completed" ? "مكتمل" : "مؤرشف";
}

function attachInspectionsPageListeners() {
  const newBtn = document.getElementById("newInspBtn");
  if (newBtn) newBtn.onclick = goInspectionNew;
  document.querySelectorAll("[data-open-insp]").forEach(el => {
    el.onclick = () => goInspectionDetail(el.dataset.openInsp);
  });
  document.querySelectorAll("[data-filter]").forEach(el => {
    el.onclick = () => { INSP_FILTER = el.dataset.filter; render(); };
  });
  const mgmt = document.getElementById("manageTemplatesBtn");
  if (mgmt) mgmt.onclick = goTemplates;
}

/* ==========================================================
   Rendering: New inspection wizard
   ========================================================== */
function renderInspectionWizard() {
  const w = STATE.wizard;

  if (w.step === 1) {
    const tiles = INSPECTION_ELEMENT_TYPES.map(t => `
      <div class="wizard-tile" data-type="${t.id}">
        <span class="wicon">${t.icon}</span>${escapeHtml(t.label)}
      </div>`).join("");
    return `<div class="wizard-step-label">الخطوة 1 من 2 — اختر نوع العنصر</div><div class="wizard-grid">${tiles}</div>`;
  }

  if (w.step === "subtype") {
    const t = INSPECTION_ELEMENT_TYPES.find(x => x.id === w.elementType);
    const tiles = t.subtypes.map(s => `
      <div class="wizard-tile" data-subtype="${s.id}">${escapeHtml(s.label)}</div>`).join("");
    return `<div class="wizard-step-label">اختر نوع ${escapeHtml(t.label)}</div><div class="wizard-grid">${tiles}</div>`;
  }

  // step 2: template + name
  const candidates = getCandidateTemplates(w.elementType, w.elementSubtype);
  const tplTiles = candidates.map(tpl => `
    <div class="wizard-tile ${w.templateId === tpl.id ? "selected" : ""}" data-tpl="${tpl.id}">
      ${escapeHtml(tpl.name)}<br><span style="font-weight:500;font-size:11.5px;color:var(--ink-faint);">${tpl.items.length} بند${tpl.isDefault ? "" : " · مخصص"}</span>
    </div>`).join("");

  return `
    <div class="wizard-step-label">الخطوة 2 من 2 — القالب والاسم</div>
    <div class="wizard-grid">${tplTiles}</div>
    <div class="form-field" style="margin-top:14px;">
      <label>اسم القائمة</label>
      <input type="text" id="wizardName" placeholder="مثال: أعمدة الدور الأول - فيلا 63">
    </div>
    <button class="big-btn" id="wizardCreateBtn">إنشاء وبدء الاستلام</button>
  `;
}

function getCandidateTemplates(elementType, elementSubtype) {
  const list = [];
  const def = getDefaultTemplate(elementType, elementSubtype);
  if (def) list.push(def);
  Object.values(LOCAL.templates).forEach(t => {
    if (t.elementType === elementType && (t.elementSubtype || null) === (elementSubtype || null)) {
      list.push({ id: t.id, name: t.name, isDefault: false, items: t.items });
    }
  });
  return list;
}

function attachWizardListeners() {
  document.querySelectorAll("[data-type]").forEach(el => {
    el.onclick = () => {
      const t = INSPECTION_ELEMENT_TYPES.find(x => x.id === el.dataset.type);
      STATE.wizard.elementType = t.id;
      if (t.subtypes) { STATE.wizard.step = "subtype"; }
      else {
        STATE.wizard.elementSubtype = null;
        const cands = getCandidateTemplates(t.id, null);
        STATE.wizard.templateId = cands[0] ? cands[0].id : null;
        STATE.wizard.step = 2;
      }
      render();
    };
  });
  document.querySelectorAll("[data-subtype]").forEach(el => {
    el.onclick = () => {
      STATE.wizard.elementSubtype = el.dataset.subtype;
      const cands = getCandidateTemplates(STATE.wizard.elementType, el.dataset.subtype);
      STATE.wizard.templateId = cands[0] ? cands[0].id : null;
      STATE.wizard.step = 2;
      render();
    };
  });
  document.querySelectorAll("[data-tpl]").forEach(el => {
    el.onclick = () => { STATE.wizard.templateId = el.dataset.tpl; render(); };
  });
  const createBtn = document.getElementById("wizardCreateBtn");
  if (createBtn) {
    createBtn.onclick = () => {
      const nameInput = document.getElementById("wizardName");
      const name = (nameInput.value || "").trim();
      if (!name) { nameInput.focus(); return; }
      createInspectionFromWizard(name);
    };
  }
}

function createInspectionFromWizard(name) {
  const w = STATE.wizard;
  const candidates = getCandidateTemplates(w.elementType, w.elementSubtype);
  const tpl = candidates.find(t => t.id === w.templateId) || candidates[0] || { items: [] };

  const id = uid();
  const items = (tpl.items || []).map((it, i) => ({
    id: uid(), text: it.text, position: i, status: "unchecked", note: "",
  }));
  const insp = {
    id, name, element_type: w.elementType, element_subtype: w.elementSubtype || null,
    status: "active", template_id: tpl.isDefault ? null : tpl.id,
    created_at: new Date().toISOString(), items,
  };
  LOCAL.inspections[id] = insp;
  persistLocal();
  goInspectionDetail(id);
}

/* ==========================================================
   Rendering: Inspection detail / checklist
   ========================================================== */
function renderInspectionDetail() {
  const insp = LOCAL.inspections[STATE.inspectionId];
  if (!insp) return `<div class="empty"><div class="e-icon">⚠️</div><h3>لم يتم العثور على القائمة</h3></div>`;

  const total = insp.items.length;
  const uncCount = insp.items.filter(i => i.status === "unchecked").length;
  const checked = total - uncCount;
  const pct = total ? Math.round((checked / total) * 100) : 0;

  const itemsHtml = `<div class="checklist-grid">${insp.items.slice().sort((a, b) => a.position - b.position).map((it, idx) => itemCardHtml(insp, it, idx, insp.items.length)).join("")}</div>`;

  const notes = insp.items.filter(i => i.status === "issue" && i.note && i.note.trim());
  const notesHtml = notes.length ? `
    <div class="notes-section">
      <div class="section-label">الملاحظات</div>
      ${notes.map(n => `<div class="note-item"><b>${escapeHtml(n.text)}</b>${escapeHtml(n.note)}</div>`).join("")}
    </div>` : "";

  const isCompleted = insp.status === "completed";
  const passCount = insp.items.filter(i => i.status === "pass").length;
  const issueCount = insp.items.filter(i => i.status === "issue").length;
  const naCount = insp.items.filter(i => i.status === "na").length;

  const summaryHtml = isCompleted ? `
    <div class="summary-box">
      <div class="summary-row"><span>✓ مطابق</span><span>${passCount}</span></div>
      <div class="summary-row"><span>✕ ملاحظات</span><span>${issueCount}</span></div>
      <div class="summary-row"><span>— N/A</span><span>${naCount}</span></div>
      <div class="summary-row"><span>☐ غير مفحوص</span><span>${uncCount}</span></div>
    </div>` : "";

  return `
    <div class="insp-top">
      <h2 id="inspNameDisplay">${escapeHtml(insp.name)} <button class="item-actions" style="display:inline;background:none;border:none;color:var(--ink-faint);font-size:13px;cursor:pointer;" id="renameInspBtn">✏️</button>
        <span class="status-pill ${insp.status}" style="margin-inline-start:6px;">${statusLabel(insp.status)}</span>
      </h2>
      <div class="progress-label"><span>${checked} / ${total} · ${pct}%</span><span>متبقي ${uncCount}</span></div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
    </div>

    ${WARN_INCOMPLETE[insp.id] ? `<div class="warn-banner">يوجد ${uncCount} بنود لم يتم فحصها</div>` : ""}

    ${itemsHtml}

    ${!isCompleted ? `
      <div class="add-item-row">
        <input type="text" id="newItemInput" placeholder="+ إضافة نقطة جديدة">
        <button id="addItemBtn">إضافة</button>
      </div>` : ""}

    ${notesHtml}
    ${summaryHtml}

    ${!isCompleted ? `<button class="finish-btn" id="finishInspBtn">✅ اعتماد وإنهاء</button>` : ""}
    <button class="ghost-btn" id="saveOngoingBtn">💾 حفظ في الأعمال الجارية</button>
    <details class="more-actions"><summary>••• المزيد</summary>
      <button class="ghost-btn" id="saveAsTplBtn">📋 حفظ كقالب جديد</button>
      <button class="ghost-btn danger-btn" id="deleteInspBtn">🗑 حذف نهائي</button>
    </details>
  `;
}

function itemCardHtml(insp, it, idx, total) {
  const s = it.status || "unchecked";
  return `
    <div class="item-card status-${s}" data-item="${it.id}">
      <div class="item-title-row"><div class="item-text">${escapeHtml(it.text)}</div><button class="item-edit-icon" data-edit-item="${it.id}" title="تعديل">✏️</button></div>
      <div class="status-row">
        ${["pass", "issue", "na"].map(st => `
          <button type="button" data-s="${st}" data-set-status="${it.id}:${st}" class="${s === st ? "active" : ""}">${STATUS_ICONS[st]} ${STATUS_LABELS[st]}</button>
        `).join("")}
      </div>
      ${s === "issue" ? `
        <div class="note-box">
          <textarea data-note="${it.id}" placeholder="ملاحظة قصيرة اختيارية...">${escapeHtml(it.note || "")}</textarea>
        </div>` : ""}
    </div>`;
}

function attachInspectionDetailListeners() {
  const insp = LOCAL.inspections[STATE.inspectionId];
  if (!insp) return;

  document.querySelectorAll("[data-set-status]").forEach(el => {
    el.onclick = () => {
      const [itemId, status] = el.dataset.setStatus.split(":");
      const item = insp.items.find(i => i.id === itemId);
      if (!item) return;
      item.status = (item.status === status ? "unchecked" : status);
      const effectiveStatus = item.status;
      if (effectiveStatus !== "issue") item.note = item.note || "";
      upsertInspectionItemLocal(insp.id, item);
      render();
    };
  });

  document.querySelectorAll("[data-note]").forEach(el => {
    let t;
    el.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const itemId = el.dataset.note;
        const item = insp.items.find(i => i.id === itemId);
        if (!item) return;
        item.note = el.value;
        upsertInspectionItemLocal(insp.id, item);
      }, 400);
    };
  });

  document.querySelectorAll("[data-move]").forEach(el => {
    el.onclick = () => {
      const [itemId, dir] = el.dataset.move.split(":");
      const sorted = insp.items.slice().sort((a, b) => a.position - b.position);
      const i = sorted.findIndex(x => x.id === itemId);
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sorted.length) return;
      const tmp = sorted[i].position; sorted[i].position = sorted[j].position; sorted[j].position = tmp;
      upsertInspectionItemLocal(insp.id, sorted[i]);
      upsertInspectionItemLocal(insp.id, sorted[j]);
      render();
    };
  });

  document.querySelectorAll("[data-edit-item]").forEach(el => {
    el.onclick = () => {
      const itemId = el.dataset.editItem;
      const item = insp.items.find(i => i.id === itemId);
      const card = el.closest(".item-card");
      const textEl = card.querySelector(".item-text");
      textEl.outerHTML = `<input class="item-text-input" id="editItemInput" value="${escapeHtml(item.text)}">`;
      const input = document.getElementById("editItemInput");
      input.focus();
      const commit = () => {
        const v = (input.value || "").trim();
        if (v) { item.text = v; upsertInspectionItemLocal(insp.id, item); }
        render();
      };
      input.onblur = commit;
      input.onkeydown = (ev) => { if (ev.key === "Enter") input.blur(); };
    };
  });

  document.querySelectorAll("[data-del-item]").forEach(el => {
    el.onclick = () => {
      const itemId = el.dataset.delItem;
      const item = insp.items.find(i => i.id === itemId);
      const hasData = item.status !== "unchecked" || (item.note && item.note.trim());
      const doDelete = () => { deleteInspectionItemLocal(insp.id, itemId); render(); };
      if (hasData) {
        showConfirm({ title: "حذف البند", text: `هل تريد حذف "${item.text}"؟ سيتم فقدان الحالة/الملاحظة المسجلة.`, onConfirm: doDelete });
      } else {
        doDelete();
      }
    };
  });

  const addBtn = document.getElementById("addItemBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      const input = document.getElementById("newItemInput");
      const text = (input.value || "").trim();
      if (!text) return;
      const item = { id: uid(), text, position: insp.items.length, status: "unchecked", note: "" };
      upsertInspectionItemLocal(insp.id, item);
      input.value = "";
      render();
    };
  }

  const renameBtn = document.getElementById("renameInspBtn");
  if (renameBtn) {
    renameBtn.onclick = () => {
      const newName = prompt("اسم القائمة:", insp.name);
      if (newName && newName.trim()) {
        insp.name = newName.trim();
        upsertInspectionLocal(insp);
        render();
      }
    };
  }

  const finishBtn = document.getElementById("finishInspBtn");
  if (finishBtn) {
    finishBtn.onclick = () => {
      const uncCount = insp.items.filter(i => i.status === "unchecked").length;
      if (uncCount > 0) { WARN_INCOMPLETE[insp.id] = true; render(); return; }
      insp.status = "completed";
      upsertInspectionLocal(insp);
      delete WARN_INCOMPLETE[insp.id];
      render();
    };
  }

  const saveOngoingBtn = document.getElementById("saveOngoingBtn");
  if (saveOngoingBtn) saveOngoingBtn.onclick = () => { insp.status = "active"; upsertInspectionLocal(insp); goInspections(); };

  const archiveBtn = document.getElementById("archiveInspBtn");
  if (archiveBtn) archiveBtn.onclick = () => { insp.status = "archived"; upsertInspectionLocal(insp); render(); };
  const unarchiveBtn = document.getElementById("unarchiveInspBtn");
  if (unarchiveBtn) unarchiveBtn.onclick = () => { insp.status = "active"; upsertInspectionLocal(insp); render(); };

  const deleteBtn = document.getElementById("deleteInspBtn");
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      showConfirm({
        title: "حذف الاستلام", text: `هل تريد حذف "${insp.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
        onConfirm: () => { deleteInspectionLocal(insp.id); goInspections(); },
      });
    };
  }

  const saveTplBtn = document.getElementById("saveAsTplBtn");
  if (saveTplBtn) {
    saveTplBtn.onclick = () => {
      const name = prompt("اسم القالب الجديد:", insp.name);
      if (!name || !name.trim()) return;
      const tplId = uid();
      const tpl = {
        id: tplId, name: name.trim(), elementType: insp.element_type, elementSubtype: insp.element_subtype,
        items: insp.items.slice().sort((a, b) => a.position - b.position).map((it, i) => ({ id: uid(), text: it.text, position: i })),
      };
      upsertTemplateLocal(tpl);
      tpl.items.forEach(it => upsertTemplateItemLocal(tplId, it));
      setSyncStatus("تم حفظ القالب", 1500);
    };
  }
}

/* ==========================================================
   Rendering: Templates management
   ========================================================== */
function renderTemplatesPage() {
  const defaults = getAllDefaultTemplates();
  const custom = Object.values(LOCAL.templates);

  const defHtml = defaults.map(t => `
    <div class="tpl-card">
      <div class="name">${escapeHtml(t.name)}</div>
      <div class="meta">${t.items.length} بند · افتراضي</div>
    </div>`).join("");

  const customHtml = custom.map(t => `
    <div class="tpl-card">
      <div class="name">${escapeHtml(t.name)}</div>
      <div class="meta">${t.items.length} بند · مخصص${t.elementType ? " · " + elementTypeLabel(t.elementType, t.elementSubtype) : ""}</div>
      <div class="tpl-row-actions">
        <button data-edit-tpl="${t.id}">✏️ تعديل</button>
        <button data-del-tpl="${t.id}">🗑 حذف</button>
      </div>
    </div>`).join("");

  return `
    <button class="big-btn" id="newTplBtn">+ قائمة جديدة مخصصة</button>
    <div class="section-label">قوالبي المخصصة</div>
    ${custom.length ? customHtml : `<div class="empty"><div class="e-icon">📋</div><h3>لا توجد قوالب مخصصة</h3><p>أنشئ قالبك الخاص أو احفظ أي استلام كقالب.</p></div>`}
    <div class="section-label">القوالب الافتراضية</div>
    ${defHtml}
  `;
}

function attachTemplatesPageListeners() {
  const newBtn = document.getElementById("newTplBtn");
  if (newBtn) newBtn.onclick = () => goTemplateEdit(null);
  document.querySelectorAll("[data-edit-tpl]").forEach(el => {
    el.onclick = () => goTemplateEdit(el.dataset.editTpl);
  });
  document.querySelectorAll("[data-del-tpl]").forEach(el => {
    el.onclick = () => {
      const t = LOCAL.templates[el.dataset.delTpl];
      showConfirm({
        title: "حذف القالب", text: `هل تريد حذف قالب "${t.name}"؟`,
        onConfirm: () => { deleteTemplateLocal(t.id); render(); },
      });
    };
  });
}

function renderTemplateEditor() {
  const isNew = !STATE.templateEditId;
  const tpl = isNew ? { id: uid(), name: "", items: [] } : LOCAL.templates[STATE.templateEditId];
  if (!isNew && !tpl) return `<div class="empty"><h3>القالب غير موجود</h3></div>`;
  if (isNew) STATE._draftTpl = STATE._draftTpl || tpl;
  const editTpl = isNew ? STATE._draftTpl : tpl;

  const itemsHtml = editTpl.items.slice().sort((a, b) => a.position - b.position).map((it, idx, arr) => `
    <div class="item-card" data-tpl-item="${it.id}">
      <div class="item-text">${escapeHtml(it.text)}</div>
    </div>`).join("");

  return `
    <div class="form-field">
      <label>اسم القالب</label>
      <input type="text" id="tplNameInput" value="${escapeHtml(editTpl.name)}" placeholder="مثال: تسليح أعمدة خاصة">
    </div>
    <div class="section-label">البنود (${editTpl.items.length})</div>
    ${itemsHtml}
    <div class="add-item-row">
      <input type="text" id="tplNewItemInput" placeholder="+ إضافة نقطة">
      <button id="tplAddItemBtn">إضافة</button>
    </div>
    <button class="big-btn" id="tplSaveBtn">${isNew ? "إنشاء القالب" : "حفظ التعديلات"}</button>
  `;
}

function attachTemplateEditorListeners() {
  const isNew = !STATE.templateEditId;
  const editTpl = isNew ? STATE._draftTpl : LOCAL.templates[STATE.templateEditId];
  if (!editTpl) return;

  const nameInput = document.getElementById("tplNameInput");
  if (nameInput) nameInput.oninput = () => { editTpl.name = nameInput.value; };

  const addBtn = document.getElementById("tplAddItemBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      const input = document.getElementById("tplNewItemInput");
      const text = (input.value || "").trim();
      if (!text) return;
      editTpl.items.push({ id: uid(), text, position: editTpl.items.length });
      input.value = "";
      render();
    };
  }

  document.querySelectorAll("[data-tpl-move]").forEach(el => {
    el.onclick = () => {
      const [itemId, dir] = el.dataset.tplMove.split(":");
      const sorted = editTpl.items.slice().sort((a, b) => a.position - b.position);
      const i = sorted.findIndex(x => x.id === itemId);
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sorted.length) return;
      const tmp = sorted[i].position; sorted[i].position = sorted[j].position; sorted[j].position = tmp;
      render();
    };
  });

  document.querySelectorAll("[data-tpl-edit-item]").forEach(el => {
    el.onclick = () => {
      const item = editTpl.items.find(i => i.id === el.dataset.tplEditItem);
      const card = el.closest(".item-card");
      const textEl = card.querySelector(".item-text");
      textEl.outerHTML = `<input class="item-text-input" id="tplEditItemInput" value="${escapeHtml(item.text)}">`;
      const input = document.getElementById("tplEditItemInput");
      input.focus();
      const commit = () => { const v = (input.value || "").trim(); if (v) item.text = v; render(); };
      input.onblur = commit;
      input.onkeydown = (ev) => { if (ev.key === "Enter") input.blur(); };
    };
  });

  document.querySelectorAll("[data-tpl-del-item]").forEach(el => {
    el.onclick = () => {
      editTpl.items = editTpl.items.filter(i => i.id !== el.dataset.tplDelItem);
      render();
    };
  });

  const saveBtn = document.getElementById("tplSaveBtn");
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!editTpl.name || !editTpl.name.trim()) { document.getElementById("tplNameInput").focus(); return; }
      editTpl.items.forEach((it, i) => { it.position = i; });
      upsertTemplateLocal(editTpl);
      editTpl.items.forEach(it => upsertTemplateItemLocal(editTpl.id, it));
      STATE._draftTpl = null;
      goTemplates();
    };
  }
}

/* ---------------- Attach-all dispatcher, called after every render() ---------------- */
function attachInspectionListeners() {
  attachInspectionsPageListeners();
  attachWizardListeners();
  attachInspectionDetailListeners();
  attachTemplatesPageListeners();
  attachTemplateEditorListeners();
}
