import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  product: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  role: z.enum(["exporter", "importer", "both"]).default("both"),
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
مهمتك: استخراج قائمة شركات حقيقية وموثوقة تتاجر بسلعة محددة في دولة محددة.
اعتمد على معرفتك بالمنصات التجارية العالمية ودلائل الأعمال: Europages, Alibaba, Kompass, TradeIndia, ExportersIndia, Panjiva, ImportGenius,
غرف التجارة والصناعة الوطنية، اتحادات المصدرين والمستوردين، سجلات الموانئ والجمارك، ودلائل الوكلاء والموزعين.
قواعد صارمة:
- استبعد المصانع ووحدات الإنتاج والمنتجين تماماً. لا تُدرج أي شركة نشاطها الأساسي التصنيع أو الإنتاج.
- أدرج فقط الشركات التجارية: تجار الجملة، الموزعون، الوكلاء التجاريون، بيوت التجارة (Trading Houses)، شركات التصدير والاستيراد، السماسرة والوسطاء التجاريون.
- لا تخترع أسماء شركات وهمية. اذكر فقط شركات تعرفها فعلياً.
- النطاق الإلكتروني يجب أن يكون معقولاً ومطابقاً لاسم الشركة، وإن لم تكن متأكداً اترك الحقل فارغاً.
- أرقام الهواتف بصيغة دولية بدون رموز (مثال: 971501234567) أو فارغة إن لم تُعرف.
- النشاط التجاري بالعربية وبكلمتين إلى أربع كلمات (مثال: "تاجر جملة"، "موزع معتمد"، "وكيل استيراد"، "شركة تصدير"، "بيت تجاري"). ممنوع استخدام كلمة "مصنع" أو "منتج".
- اذكر المصدر/المنصة التي تُدرج فيها الشركة عادة.
- أعد 8 إلى 14 شركة إن أمكن.`;

export const searchCompanies = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ companies: CompanyLead[]; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { companies: [], error: "مفتاح الذكاء الاصطناعي غير مهيأ." };
    }

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
            content: `السلعة: ${data.product}\nالدولة أو المنطقة: ${data.country}\nنوع الشركات المطلوبة: ${ROLE_TEXT[data.role] ?? ROLE_TEXT["both"]}\nاستخرج الشركات التجارية والموزعين فقط (بدون مصانع) العاملين في هذه السلعة داخل هذه المنطقة.`,
          },
        ],
        tools: [
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
        ],
        tool_choice: { type: "function", function: { name: "submit_companies" } },
      }),
    });

    if (response.status === 429) {
      return { companies: [], error: "تم تجاوز حد الطلبات، حاول بعد قليل." };
    }
    if (response.status === 402) {
      return { companies: [], error: "رصيد الذكاء الاصطناعي غير كافٍ، يرجى شحن الرصيد." };
    }
    if (!response.ok) {
      const body = await response.text();
      console.error(`AI gateway error [${response.status}]: ${body}`);
      return { companies: [], error: "تعذر تنفيذ البحث حالياً." };
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };

    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { companies: [], error: "لم يتم العثور على نتائج." };

    let parsed: { companies?: Array<Partial<CompanyLead>> };
    try {
      parsed = JSON.parse(args);
    } catch {
      return { companies: [], error: "تعذر قراءة النتائج." };
    }

    const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    const companies: CompanyLead[] = (parsed.companies ?? [])
      .map((item) => ({
        name: clean(item.name),
        activity: clean(item.activity) || "غير محدد",
        website: clean(item.website).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
        city: clean(item.city),
        phone: clean(item.phone).replace(/[^\d]/g, ""),
        email: clean(item.email),
        source: clean(item.source),
      }))
      .filter((item) => item.name.length > 0);

    return { companies };
  });
