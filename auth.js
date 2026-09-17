/* ==========================================================
   المصادقة — خاصة بميزة "استلام التسليح" فقط.
   الموقع الأساسي (المرجع) لا يحتاج تسجيل دخول إطلاقًا.
   ========================================================== */

let CURRENT_USER = null;
let AUTH_READY = false;
let AUTH_MODE = "login"; // login | signup
let AUTH_ERROR = "";
let AUTH_MSG = "";
let AUTH_BUSY = false;

function getCurrentUser() { return CURRENT_USER; }

async function initAuth() {
  const sb = getSb();
  if (!sb) { AUTH_READY = true; return; }
  try {
    const { data } = await sb.auth.getSession();
    CURRENT_USER = data?.session?.user || null;
  } catch (e) {
    CURRENT_USER = null;
  }
  AUTH_READY = true;
  sb.auth.onAuthStateChange((_event, session) => {
    CURRENT_USER = session?.user || null;
    if (CURRENT_USER) {
      pullAllUserData().then(() => { if (STATE.view.startsWith("insp") || STATE.view === "templates") render(); });
    }
    if (STATE.view.startsWith("insp") || STATE.view === "templates" || STATE.view === "auth") render();
  });
  if (CURRENT_USER) await pullAllUserData();
}

async function doSignUp(email, password) {
  const sb = getSb();
  if (!sb) { AUTH_ERROR = "لم يتم ضبط إعدادات Supabase بعد."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { data, error } = await sb.auth.signUp({ email, password });
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  if (data.session) {
    CURRENT_USER = data.session.user;
    await pullAllUserData();
    goInspections();
  } else {
    AUTH_MSG = "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيل الحساب ثم سجّل الدخول.";
    AUTH_MODE = "login";
    render();
  }
}

async function doLogin(email, password) {
  const sb = getSb();
  if (!sb) { AUTH_ERROR = "لم يتم ضبط إعدادات Supabase بعد."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  CURRENT_USER = data.user;
  await pullAllUserData();
  goInspections();
}

async function doLogout() {
  const sb = getSb();
  if (sb) { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } }
  CURRENT_USER = null;
  LOCAL = { templates: {}, inspections: {} };
  persistLocal();
  goHome();
}

function translateAuthError(msg) {
  if (!msg) return "حدث خطأ غير متوقع.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("already registered") || m.includes("already exists")) return "هذا البريد الإلكتروني مسجل مسبقًا.";
  if (m.includes("password") && m.includes("6")) return "كلمة المرور يجب ألا تقل عن 6 أحرف.";
  if (m.includes("email")) return "تحقق من صيغة البريد الإلكتروني.";
  return msg;
}

/* ---------------- UI ---------------- */
function renderAuthScreen() {
  const isLogin = AUTH_MODE === "login";
  return `
    <div class="auth-card">
      <h2>${isLogin ? "تسجيل الدخول" : "إنشاء حساب"}</h2>
      <p class="sub">مطلوب فقط لاستخدام "استلام التسليح" وحفظ بياناتك ومزامنتها بين الأجهزة.</p>
      ${AUTH_ERROR ? `<div class="auth-error">${escapeHtml(AUTH_ERROR)}</div>` : ""}
      ${AUTH_MSG ? `<div class="auth-msg">${escapeHtml(AUTH_MSG)}</div>` : ""}
      <div class="form-field">
        <label>البريد الإلكتروني</label>
        <input type="email" id="authEmail" autocomplete="email" placeholder="name@example.com">
      </div>
      <div class="form-field">
        <label>كلمة المرور</label>
        <input type="password" id="authPassword" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="••••••••">
      </div>
      <button class="btn-primary" id="authSubmit" ${AUTH_BUSY ? "disabled" : ""}>${AUTH_BUSY ? "جارٍ التنفيذ..." : (isLogin ? "تسجيل الدخول" : "إنشاء الحساب")}</button>
      <div class="auth-switch">
        ${isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
        <b id="authSwitch">${isLogin ? "إنشاء حساب جديد" : "تسجيل الدخول"}</b>
      </div>
    </div>
  `;
}

function attachAuthListeners() {
  const submit = document.getElementById("authSubmit");
  const switchBtn = document.getElementById("authSwitch");
  if (submit) {
    submit.onclick = () => {
      const email = (document.getElementById("authEmail").value || "").trim();
      const password = document.getElementById("authPassword").value || "";
      if (!email || !password) { AUTH_ERROR = "الرجاء إدخال البريد الإلكتروني وكلمة المرور."; render(); return; }
      if (AUTH_MODE === "login") doLogin(email, password);
      else doSignUp(email, password);
    };
  }
  if (switchBtn) {
    switchBtn.onclick = () => {
      AUTH_MODE = AUTH_MODE === "login" ? "signup" : "login";
      AUTH_ERROR = ""; AUTH_MSG = "";
      render();
    };
  }
}
