/* ==========================================================
   المصادقة — خاصة بميزة "استلام التسليح" فقط.
   الموقع الأساسي (المرجع) لا يحتاج تسجيل دخول.
   ========================================================== */

let CURRENT_USER = null;
let AUTH_READY = false;
let AUTH_MODE = "login"; // login | signup | forgot | reset
let AUTH_ERROR = "";
let AUTH_MSG = "";
let AUTH_BUSY = false;

function getCurrentUser() { return CURRENT_USER; }
function authRedirectUrl() { return window.location.origin + window.location.pathname; }

async function initAuth() {
  const sb = getSb();
  if (!sb) { AUTH_READY = true; return; }

  // رابط استعادة كلمة المرور يعيد المستخدم للموقع مع جلسة Recovery.
  const hash = window.location.hash || "";
  const query = window.location.search || "";
  if (hash.includes("type=recovery") || query.includes("type=recovery")) AUTH_MODE = "reset";

  try {
    const { data } = await sb.auth.getSession();
    CURRENT_USER = data?.session?.user || null;
  } catch (e) { CURRENT_USER = null; }
  AUTH_READY = true;

  sb.auth.onAuthStateChange((event, session) => {
    CURRENT_USER = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      AUTH_MODE = "reset";
      AUTH_ERROR = ""; AUTH_MSG = "";
      STATE.view = "auth";
      render();
      return;
    }
    if (CURRENT_USER) {
      pullAllUserData().then(() => { if (STATE.view.startsWith("insp") || STATE.view === "templates") render(); });
    }
    if (STATE.view.startsWith("insp") || STATE.view === "templates" || STATE.view === "auth" || STATE.view === "home") render();
  });

  if (AUTH_MODE === "reset") { STATE.view = "auth"; render(); return; }
  if (CURRENT_USER) await pullAllUserData();
  if (STATE.view === "home") render();
}

async function doSignUp(email, password) {
  const sb = getSb();
  if (!sb) { AUTH_ERROR = "لم يتم ضبط إعدادات Supabase بعد."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  // لا ندخل المستخدم تلقائيًا بعد التسجيل؛ يجب تأكيد البريد أولًا.
  try { await sb.auth.signOut(); } catch (_) {}
  CURRENT_USER = null;
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  AUTH_MSG = "تم إنشاء الحساب. أرسلنا رابط تأكيد إلى بريدك الإلكتروني. فعّل الحساب ثم سجّل الدخول.";
  AUTH_MODE = "login";
  render();
}

async function doLogin(email, password) {
  const sb = getSb();
  if (!sb) { AUTH_ERROR = "لم يتم ضبط إعدادات Supabase بعد."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  if (!data?.user?.email_confirmed_at) {
    try { await sb.auth.signOut(); } catch (_) {}
    CURRENT_USER = null;
    AUTH_ERROR = "يجب تأكيد البريد الإلكتروني أولًا. افتح رسالة التفعيل ثم حاول مرة أخرى.";
    render(); return;
  }
  CURRENT_USER = data.user;
  await pullAllUserData();
  goInspections();
}

async function doForgotPassword(email) {
  const sb = getSb();
  if (!sb) { AUTH_ERROR = "لم يتم ضبط إعدادات Supabase بعد."; render(); return; }
  if (!email) { AUTH_ERROR = "أدخل بريدك الإلكتروني أولًا."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  // رسالة عامة حتى لا نكشف إن كان البريد مسجلًا أم لا.
  AUTH_MSG = "إذا كان البريد مسجلًا لدينا، ستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.";
  render();
}

async function doResetPassword(password, confirmPassword) {
  const sb = getSb();
  if (!password || password.length < 8) { AUTH_ERROR = "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف."; render(); return; }
  if (password !== confirmPassword) { AUTH_ERROR = "كلمتا المرور غير متطابقتين."; render(); return; }
  AUTH_BUSY = true; AUTH_ERROR = ""; AUTH_MSG = ""; render();
  const { error } = await sb.auth.updateUser({ password });
  AUTH_BUSY = false;
  if (error) { AUTH_ERROR = translateAuthError(error.message); render(); return; }
  try { await sb.auth.signOut(); } catch (_) {}
  CURRENT_USER = null;
  history.replaceState({}, document.title, authRedirectUrl());
  AUTH_MODE = "login";
  AUTH_MSG = "تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.";
  render();
}

async function doLogout() {
  const sb = getSb();
  if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
  CURRENT_USER = null;
  LOCAL = { templates: {}, inspections: {} };
  persistLocal();
  try { localStorage.removeItem(QUEUE_KEY); } catch (_) {}
  SYNC_QUEUE = [];
  goHome();
}

function translateAuthError(msg) {
  if (!msg) return "حدث خطأ غير متوقع.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "يجب تأكيد البريد الإلكتروني أولًا.";
  if (m.includes("already registered") || m.includes("already exists")) return "هذا البريد الإلكتروني مسجل مسبقًا.";
  if (m.includes("password") && (m.includes("6") || m.includes("weak"))) return "اختر كلمة مرور أقوى (8 أحرف على الأقل).";
  if (m.includes("rate limit")) return "تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (m.includes("email")) return "تحقق من صيغة البريد الإلكتروني.";
  return msg;
}

function renderAuthScreen() {
  const mode = AUTH_MODE;
  const title = mode === "signup" ? "إنشاء حساب" : mode === "forgot" ? "نسيت كلمة المرور" : mode === "reset" ? "كلمة مرور جديدة" : "تسجيل الدخول";
  const info = mode === "signup" ? "سيصلك رابط لتأكيد بريدك قبل أول تسجيل دخول."
    : mode === "forgot" ? "أدخل بريدك وسنرسل لك رابط إعادة تعيين كلمة المرور."
    : mode === "reset" ? "اكتب كلمة المرور الجديدة لحسابك."
    : "مطلوب فقط لاستخدام استلام التسليح وحفظ بياناتك ومزامنتها بين الأجهزة.";

  let fields = "";
  if (mode !== "reset") fields += `<div class="form-field"><label>البريد الإلكتروني</label><input type="email" id="authEmail" autocomplete="email" placeholder="name@example.com"></div>`;
  if (mode === "login" || mode === "signup") fields += `<div class="form-field"><label>كلمة المرور</label><input type="password" id="authPassword" autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="8 أحرف على الأقل"></div>`;
  if (mode === "reset") fields += `<div class="form-field"><label>كلمة المرور الجديدة</label><input type="password" id="authPassword" autocomplete="new-password" placeholder="8 أحرف على الأقل"></div><div class="form-field"><label>تأكيد كلمة المرور</label><input type="password" id="authPassword2" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور"></div>`;

  const buttonText = AUTH_BUSY ? "جارٍ التنفيذ..." : mode === "signup" ? "إنشاء الحساب" : mode === "forgot" ? "إرسال رابط الاستعادة" : mode === "reset" ? "حفظ كلمة المرور الجديدة" : "تسجيل الدخول";
  const footer = mode === "login"
    ? `<button type="button" class="auth-text-btn" id="authForgot">نسيت كلمة المرور؟</button><div class="auth-switch">ليس لديك حساب؟ <b id="authSwitch">إنشاء حساب جديد</b></div>`
    : mode === "signup" ? `<div class="auth-switch">لديك حساب بالفعل؟ <b id="authSwitch">تسجيل الدخول</b></div>`
    : mode === "forgot" ? `<div class="auth-switch"><b id="authBackLogin">العودة لتسجيل الدخول</b></div>` : "";

  return `<div class="auth-card"><h2>${title}</h2><p class="sub">${info}</p>${AUTH_ERROR ? `<div class="auth-error">${escapeHtml(AUTH_ERROR)}</div>` : ""}${AUTH_MSG ? `<div class="auth-msg">${escapeHtml(AUTH_MSG)}</div>` : ""}${fields}<button type="button" class="btn-primary" id="authSubmit" ${AUTH_BUSY ? "disabled" : ""}>${buttonText}</button>${footer}</div>`;
}

function attachAuthListeners() {
  const submit = document.getElementById("authSubmit");
  if (submit) submit.onclick = () => {
    const email = (document.getElementById("authEmail")?.value || "").trim();
    const password = document.getElementById("authPassword")?.value || "";
    if (AUTH_MODE === "login") {
      if (!email || !password) { AUTH_ERROR = "الرجاء إدخال البريد الإلكتروني وكلمة المرور."; render(); return; }
      doLogin(email, password);
    } else if (AUTH_MODE === "signup") {
      if (!email || !password) { AUTH_ERROR = "الرجاء إدخال البريد الإلكتروني وكلمة المرور."; render(); return; }
      if (password.length < 8) { AUTH_ERROR = "كلمة المرور يجب ألا تقل عن 8 أحرف."; render(); return; }
      doSignUp(email, password);
    } else if (AUTH_MODE === "forgot") doForgotPassword(email);
    else if (AUTH_MODE === "reset") doResetPassword(password, document.getElementById("authPassword2")?.value || "");
  };
  const switchBtn = document.getElementById("authSwitch");
  if (switchBtn) switchBtn.onclick = () => { AUTH_MODE = AUTH_MODE === "login" ? "signup" : "login"; AUTH_ERROR = ""; AUTH_MSG = ""; render(); };
  const forgot = document.getElementById("authForgot");
  if (forgot) forgot.onclick = () => { AUTH_MODE = "forgot"; AUTH_ERROR = ""; AUTH_MSG = ""; render(); };
  const back = document.getElementById("authBackLogin");
  if (back) back.onclick = () => { AUTH_MODE = "login"; AUTH_ERROR = ""; AUTH_MSG = ""; render(); };
}
