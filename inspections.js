/* ==========================================================
   استلام التسليح — Reinforcement Inspection default data
   قوالب أساسية فقط (بنود نصية بدون قيم رقمية ثابتة).
   لا علاقة لهذا الملف بـ entries.js (مرجع معرفي منفصل).
   ========================================================== */

/* أنواع العناصر المتاحة عند إنشاء استلام جديد */
const INSPECTION_ELEMENT_TYPES = [
  { id: "columns", label: "أعمدة", icon: "🏢" },
  {
    id: "slab", label: "سقف", icon: "🏠",
    subtypes: [
      { id: "solid", label: "Solid Slab" },
      { id: "flat", label: "Flat Slab" },
      { id: "ribbed", label: "Hollow Block / Ribbed Slab" },
    ],
  },
  {
    id: "beam", label: "جسر / ميدة", icon: "🌉",
    subtypes: [
      { id: "beam", label: "Beam" },
      { id: "groundbeam", label: "Ground Beam / ميدة" },
      { id: "tiebeam", label: "Tie Beam" },
    ],
  },
  { id: "stairs", label: "درج", icon: "🪜" },
  { id: "footing", label: "قاعدة", icon: "🏛️" },
  { id: "wall", label: "جدار خرساني مسلح", icon: "🧊" },
  { id: "raft", label: "لبشة", icon: "🔲" },
];

/* مفتاح القالب الافتراضي = elementType[:elementSubtype] */
function defaultTemplateKey(elementType, elementSubtype) {
  return elementSubtype ? `${elementType}:${elementSubtype}` : elementType;
}

const DEFAULT_TEMPLATE_ITEMS = {
  columns: [
    "عدد الأسياخ",
    "أقطار الأسياخ",
    "توزيع الأسياخ",
    "الأشاير",
    "مواقع التراكب",
    "أطوال التراكب",
    "أطوال التثبيت",
    "قطر الكانات",
    "مسافات الكانات",
    "مناطق تكثيف الكانات",
    "أول وآخر كانة",
    "شكل وإغلاق الكانات",
    "الغطاء الخرساني",
    "البسكوت / Spacers",
    "نظافة وحالة الحديد",
  ],
  "slab:solid": [
    "الحديد السفلي",
    "قطر الحديد السفلي",
    "مسافات الحديد السفلي",
    "الاتجاهان",
    "الحديد العلوي",
    "الحديد الإضافي فوق المساند",
    "أطوال الامتداد والتثبيت",
    "التراكبات",
    "مواقع التراكبات",
    "الكراسي",
    "الغطاء الخرساني",
    "البسكوت",
    "حديد الحواف",
    "التسليح حول الفتحات",
    "ثبات الشبكة وعدم هبوطها",
  ],
  "slab:flat": [
    "الشبكة السفلية",
    "الشبكة العلوية",
    "الأقطار",
    "المسافات",
    "الاتجاهات",
    "Column Strips",
    "Middle Strips",
    "الحديد الإضافي فوق الأعمدة",
    "Punching Reinforcement إن وجد",
    "التراكبات",
    "مواقع التراكبات",
    "التثبيت",
    "الكراسي",
    "الغطاء الخرساني",
    "البسكوت",
    "التسليح حول الفتحات",
    "تسليح الحواف",
  ],
  "slab:ribbed": [
    "اتجاه الأعصاب",
    "حديد الأعصاب السفلي",
    "حديد الأعصاب العلوي",
    "الأقطار",
    "العدد والمسافات",
    "الحديد الإضافي",
    "Distribution / Temperature Reinforcement حسب النظام",
    "التثبيت عند المساند",
    "التراكبات",
    "الكراسي عند الحاجة",
    "الغطاء الخرساني",
    "البسكوت",
    "التسليح حول الفتحات",
    "تسليح الجسور المخفية/المحيطة إن وجدت",
  ],
  "beam:beam": [
    "عدد الحديد السفلي",
    "أقطار الحديد السفلي",
    "الحديد العلوي",
    "أقطار الحديد العلوي",
    "الحديد الإضافي",
    "استمرارية الأسياخ",
    "التثبيت داخل المساند",
    "التراكبات",
    "مواقع التراكبات",
    "قطر الكانات",
    "مسافات الكانات",
    "مناطق تكثيف الكانات",
    "أول كانة",
    "شكل وإغلاق الكانات",
    "الغطاء الخرساني",
    "البسكوت / Spacers",
  ],
  stairs: [
    "الحديد الرئيسي",
    "اتجاه الحديد الرئيسي",
    "حديد التوزيع",
    "الأقطار",
    "المسافات",
    "الحديد العلوي عند المساند",
    "تسليح البسطات",
    "اتصال القلبة بالبسطات",
    "أطوال التثبيت",
    "التراكبات",
    "الحديد الإضافي",
    "الغطاء الخرساني",
    "البسكوت",
  ],
  footing: [
    "الشبكة السفلية",
    "الاتجاهان",
    "عدد الأسياخ",
    "الأقطار",
    "المسافات",
    "أطوال الأسياخ",
    "الأشاير",
    "موقع الأشاير",
    "تثبيت الأشاير",
    "الحديد العلوي إن وجد",
    "التراكبات إن وجدت",
    "الكراسي إن وجدت",
    "الغطاء الخرساني",
    "البسكوت",
    "تسليح Pedestal / الرقبة إن وجد",
  ],
  wall: [
    "الشبكتان / الوجهين",
    "الحديد الرأسي",
    "الحديد الأفقي",
    "الأقطار",
    "المسافات",
    "التراكبات",
    "مواقع التراكبات",
    "الروابط بين الشبكتين",
    "التسليح الإضافي عند الأطراف",
    "التسليح حول الفتحات",
    "الأشاير",
    "التثبيت",
    "الغطاء الخرساني",
    "البسكوت / Spacers",
  ],
  raft: [
    "الشبكة السفلية بالاتجاهين",
    "الشبكة العلوية بالاتجاهين",
    "الأقطار",
    "المسافات",
    "التراكبات",
    "مواقع التراكبات",
    "الكراسي",
    "تثبيت الشبكة العليا",
    "الحديد الإضافي أسفل الأعمدة والجدران",
    "الحديد الإضافي أعلى الأعمدة والجدران",
    "الأشاير",
    "التسليح حول الفتحات",
    "تسليح الحواف",
    "الغطاء الخرساني",
    "البسكوت",
    "استمرارية وتثبيت الحديد",
  ],
};

/* Ground Beam / Tie Beam تستخدم نفس قالب الجسور الأساسي */
DEFAULT_TEMPLATE_ITEMS["beam:groundbeam"] = DEFAULT_TEMPLATE_ITEMS["beam:beam"];
DEFAULT_TEMPLATE_ITEMS["beam:tiebeam"] = DEFAULT_TEMPLATE_ITEMS["beam:beam"];

const DEFAULT_TEMPLATE_NAMES = {
  columns: "تسليح الأعمدة",
  "slab:solid": "تسليح سقف Solid Slab",
  "slab:flat": "تسليح سقف Flat Slab",
  "slab:ribbed": "تسليح سقف Hollow Block / Ribbed",
  "beam:beam": "تسليح الجسور",
  "beam:groundbeam": "تسليح الميدة (Ground Beam)",
  "beam:tiebeam": "تسليح Tie Beam",
  stairs: "تسليح الدرج",
  footing: "تسليح القواعد",
  wall: "تسليح الجدران الخرسانية",
  raft: "تسليح اللبشة",
};

/* يبني كائن قالب افتراضي جاهز للاستخدام (لا يُحفظ في Supabase، يعيش في الكود فقط) */
function getDefaultTemplate(elementType, elementSubtype) {
  const key = defaultTemplateKey(elementType, elementSubtype);
  const items = DEFAULT_TEMPLATE_ITEMS[key];
  if (!items) return null;
  return {
    id: "default:" + key,
    isDefault: true,
    name: DEFAULT_TEMPLATE_NAMES[key] || key,
    elementType,
    elementSubtype: elementSubtype || null,
    items: items.map((text, i) => ({ text, position: i })),
  };
}

/* كل القوالب الافتراضية كقائمة مسطّحة (تُستخدم في صفحة "القوالب") */
function getAllDefaultTemplates() {
  const out = [];
  INSPECTION_ELEMENT_TYPES.forEach(t => {
    if (t.subtypes) {
      t.subtypes.forEach(st => {
        const tpl = getDefaultTemplate(t.id, st.id);
        if (tpl) out.push(tpl);
      });
    } else {
      const tpl = getDefaultTemplate(t.id);
      if (tpl) out.push(tpl);
    }
  });
  return out;
}
