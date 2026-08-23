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
  officer_name?: string;
  officer_title?: string;
  officer_email?: string;
  email_confidence?: string;
};

export const searchCompanies = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // إرسال طلب البحث إلى خادم FastAPI
      const response = await fetch(
        `http://localhost:8000/api/search?q=${encodeURIComponent(data.product)}&country=${encodeURIComponent(data.country)}`
      );

      if (!response.ok) {
        throw new Error("فشل الاتصال بمحرك البحث الخلفي");
      }

      const result = await response.json();

      // تحويل البيانات القادمة من السكربت لتناسب جدول الموقع
      const leads: CompanyLead[] = result.data.flatMap((company: any) => {
        if (company.verified_officers && company.verified_officers.length > 0) {
          return company.verified_officers.map((officer: any) => ({
            name: company.company_name,
            activity: `${data.product} Trade / Supply`,
            website: company.domain ? `https://${company.domain}` : company.url,
            city: company.country || data.country,
            phone: "N/A",
            email: company.emails?.join(", ") || "N/A",
            source: "Verified B2B Search",
            officer_name: officer.full_name,
            officer_title: officer.job_title,
            officer_email: officer.direct_email,
            email_confidence: `${officer.confidence_score}%`,
          }));
        } else {
          return [{
            name: company.company_name,
            activity: `${data.product} Trade / Supply`,
            website: company.domain ? `https://${company.domain}` : company.url,
            city: company.country || data.country,
            phone: "N/A",
            email: company.emails?.join(", ") || "N/A",
            source: "Verified B2B Search",
            officer_name: "N/A",
            officer_title: "N/A",
            officer_email: "N/A",
            email_confidence: "N/A",
          }];
        }
      });

      return leads;
    } catch (error) {
      console.error("خطأ أثناء استخراج البيانات الحقيقية:", error);
      return [];
    }
  });
