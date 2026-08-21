import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const attachmentSchema = z.object({
  name: z.string().max(200).default(""),
  mime: z.string().max(120),
  dataUrl: z.string().max(8_000_000),
});

const inputSchema = z.object({
  product: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  role: z.enum(["exporter", "importer", "both"]).default("both"),
  specs: z.string().max(4000).optional().default(""),
  attachments: z.array(attachmentSchema).max(4).optional().default([]),
});

export type CompanyLead = {
  name: string;
  activity: string;
  website: string;
  city: string;
  phone: string;
  email: string;
  source: string;
};

const ROLE_TEXT: Record<string, string> = {
  exporter: "شركات مصدّرة / بائعة (Suppliers & Exporters) تبيع السلعة وتصدّرها",
  importer: "شركات مستوردة / مشترية (Buyers & Importers) تشتري السلعة وتستوردها",
  both: "شركات تجارية تعمل في البيع والشراء (تصدير واستيراد) للسلعة",
};

const SYSTEM_PROMPT = `أنت محلل استخبارات تجارية (B2B) خبير في التنقيب عن الشركات التجارية والموزعين.
مهمتك: استخراج أكبر قائمة ممكنة من الشركات الحقيقية والموثوقة التي تتاجر بسلعة محددة في دولة أو منطقة محددة.
اعتمد على معرفتك بالمصادر التالية:
- مصادر رسمية ومجانية: Trade Map (ITC)، WITS (البنك الدولي)، سجلات الشركات الحكومية (مثل Companies House)، غرف التجارة والصناعة الوطنية، اتحادات المصدرين والمستوردين، الأدلة الحكومية المفتوحة.
- منصات وقواعد مدفوعة: Dun & Bradstreet، Panjiva (S&P Global)، ImportGenius، Volza، Datamyne، Kompass، Europages، Global Sources، IndiaMART، Alibaba، TradeIndia، ExportersIndia.
- سجلات الموانئ والجمارك وبوليصات الشحن، ودلائل الوكلاء والموزعين المحليين.
قواعد صارمة:
- استبعد المصانع ووحدات الإنتاج والمنتجين تماماً. لا تُدرج أي شركة نشاطها الأساسي التصنيع أو الإنتاج.
- أدرج فقط الشركات التجارية: تجار الجملة، الموزعون، الوكلاء التجاريون، بيوت التجارة (Trading Houses)، شركات التصدير والاستيراد، السماسرة والوسطاء التجاريون.
- لا تخترع أسماء شركات وهمية. اذكر فقط شركات تعرفها فعلياً.
- النطاق الإلكتروني يجب أن يكون معقولاً ومطابقاً لاسم الشركة، وإن لم تكن متأكداً اترك الحقل فارغاً.
- أرقام الهواتف بصيغة دولية بدون رموز (مثال: 971501234567) أو فارغة إن لم تُعرف.
- النشاط التجاري بالعربية وبكلمتين إلى أربع كلمات (مثال: "تاجر جملة"، "موزع معتمد"، "وكيل استيراد"، "شركة تصدير"، "بيت تجاري"). ممنوع استخدام كلمة "مصنع" أو "منتج".
- اذكر المصدر/المنصة التي تُدرج فيها الشركة عادة.
- أعد أكبر عدد ممكن من الشركات (20 شركة على الأقل إن أمكن) دون تكرار.
- إذا زوّدك المستخدم بمواصفات فنية أو تحاليل مخبرية أو صور/ملفات للمنتج (مثل نسبة النقاء، الشكل، الدرجة التجارية، الاستخدامات، الرقم الجمركي HS Code)، فاقرأها بدقة واستنتج منها الدرجة التجارية الصحيحة للسلعة، ثم اختر فقط الشركات التي تتاجر فعلياً بهذه الدرجة/المواصفة تحديداً وليس بالسلعة بشكل عام.
- ابدأ داخلياً بتحديد الـ HS Code الأنسب للمواصفة قبل اختيار الشركات، وفضّل الشركات المطابقة له.`;

const PASSES = [
  "ركّز على المصادر الرسمية والمجانية: Trade Map (ITC)، WITS (البنك الدولي)، سجلات الشركات الحكومية، غرف التجارة والصناعة الوطنية، اتحادات المصدرين والمستوردين.",
  "ركّز على قواعد البيانات الجمركية وبوليصات الشحن: Panjiva، ImportGenius، Volza، Datamyne، Dun & Bradstreet، وسجلات الموانئ.",
  "ركّز على أدلة B2B العالمية: Kompass، Europages، Global Sources، IndiaMART، Alibaba، TradeIndia، ExportersIndia، ودلائل الوكلاء والموزعين المحليين.",
];

const TOOLS = [
  {
    type: "function",
    function: {
      name: "submit_companies",
      description: "إرسال قائمة الشركات المستخرجة",
      parameters: {
        type: "object",
        properties: {
          companies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                activity: { type: "string" },
                website: { type: "string" },
                city: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                source: { type: "string" },
              },
              required: ["name", "activity", "website", "city", "phone", "email", "source"],
              additionalProperties: false,
            },
          },
        },
        required: ["companies"],
        additionalProperties: false,
      },
    },
  },
];

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const searchCompanies = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ companies: CompanyLead[]; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { companies: [], error: "مفتاح الذكاء الاصطناعي غير مهيأ." };
    }

    const roleText = ROLE_TEXT[data.role] ?? ROLE_TEXT["both"];
    const specsText = (data.specs ?? "").trim();
    const attachments = data.attachments ?? [];

    const attachmentBlocks = attachments.flatMap((file) => {
      if (file.mime.startsWith("image/")) {
        return [{ type: "image_url", image_url: { url: file.dataUrl } }];
      }
      if (file.mime === "application/pdf") {
        return [
          {
            type: "file",
            file: { filename: file.name || "spec.pdf", file_data: file.dataUrl },
          },
        ];
      }
      return [];
    });

    const runPass = async (focus: string) => {
      const textPrompt = `السلعة: ${data.product}\nالدولة أو المنطقة: ${data.country}\nنوع الشركات المطلوبة: ${roleText}${
        specsText ? `\nالمواصفات والتحاليل المقدمة من المستخدم:\n${specsText}` : ""
      }${
        attachmentBlocks.length > 0
          ? "\nمرفقات: صور/ملفات تحاليل ومواصفات المنتج، حللها واستخرج الدرجة التجارية والمواصفات الدقيقة."
          : ""
      }\n${focus}\nاستخرج الشركات التجارية والموزعين فقط (بدون مصانع) العاملين في هذه السلعة بهذه المواصفة تحديداً داخل هذه المنطقة.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `السلعة: ${data.product}\nالدولة أو المنطقة: ${data.country}\nنوع الشركات المطلوبة: ${roleText}\n${focus}\nاستخرج الشركات التجارية والموزعين فقط (بدون مصانع) العاملين في هذه السلعة داخل هذه المنطقة.`,
            },
          ],
          tools: TOOLS,
          tool_choice: { type: "function", function: { name: "submit_companies" } },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`AI gateway error [${response.status}]: ${body}`);
        return { status: response.status, companies: [] as Array<Partial<CompanyLead>> };
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
        }>;
      };
      const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { status: 200, companies: [] as Array<Partial<CompanyLead>> };
      try {
        const parsed = JSON.parse(args) as { companies?: Array<Partial<CompanyLead>> };
        return { status: 200, companies: parsed.companies ?? [] };
      } catch {
        return { status: 200, companies: [] as Array<Partial<CompanyLead>> };
      }
    };

    const results = await Promise.all(PASSES.map((focus) => runPass(focus)));

    const statuses = results.map((r) => r.status);
    const merged: CompanyLead[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      for (const item of result.companies) {
        const company: CompanyLead = {
          name: clean(item.name),
          activity: clean(item.activity) || "غير محدد",
          website: clean(item.website).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
          city: clean(item.city),
          phone: clean(item.phone).replace(/[^\d]/g, ""),
          email: clean(item.email),
          source: clean(item.source),
        };
        if (!company.name) continue;
        const key = (company.website || company.name).toLowerCase().replace(/\s+/g, "");
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(company);
      }
    }

    if (merged.length === 0) {
      if (statuses.includes(429)) {
        return { companies: [], error: "تم تجاوز حد الطلبات، حاول بعد قليل." };
      }
      if (statuses.includes(402)) {
        return { companies: [], error: "رصيد الذكاء الاصطناعي غير كافٍ، يرجى شحن الرصيد." };
      }
      if (statuses.some((s) => s !== 200)) {
        return { companies: [], error: "تعذر تنفيذ البحث حالياً." };
      }
      return { companies: [], error: "لم يتم العثور على نتائج." };
    }

    return { companies: merged };
  });
