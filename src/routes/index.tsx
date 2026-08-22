import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Globe,
  MapPin,
  MessageCircle,
  Mail,
  Building2,
  Loader2,
  Filter,
  Database,
  Paperclip,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { searchCompanies, type CompanyLead } from "@/lib/company-search.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "التنقيب عن الشركات التجارية | استخبارات B2B" },
      {
        name: "description",
        content:
          "ابحث عن الشركات المصدرة والمستوردة لأي سلعة في أي دولة، مع روابط الموقع والتواصل عبر واتساب والبريد.",
      },
      { property: "og:title", content: "التنقيب عن الشركات التجارية | استخبارات B2B" },
      {
        property: "og:description",
        content: "استخراج بيانات الشركات حسب السلعة والدولة مع إمكانية إرسال طلب عرض سعر فوراً.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLES = ["يوريا", "حديد تسليح", "قمح", "أسمنت", "زيت نخيل", "ألمنيوم"];

const ROLES = [
  { value: "exporter" as const, label: "مصدّر / بائع" },
  { value: "importer" as const, label: "مستورد / مشترٍ" },
  { value: "both" as const, label: "الاثنان معاً" },
];

function quoteMailto(company: CompanyLead, product: string) {
  const subject = `طلب عرض سعر - ${product || "سلعة"}`;
  const body = `السادة ${company.name} المحترمين،

تحية طيبة وبعد،

نرغب في الحصول على عرض سعر لمادة (${product || "..."}) وفق التفاصيل التالية:
- الكمية المطلوبة: 
- شروط التسليم (Incoterms): 
- ميناء الوصول: 
- طريقة الدفع: 

نرجو تزويدنا بالعرض متضمناً المواصفات الفنية ومدة التجهيز.

مع خالص التقدير،`;
  return `mailto:${company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function whatsappLink(company: CompanyLead, product: string) {
  const text = `مرحباً ${company.name}، نود الاستفسار عن توريد مادة ${product || ""} وطلب عرض سعر.`;
  return `https://wa.me/${company.phone}?text=${encodeURIComponent(text)}`;
}

type Attachment = { name: string; mime: string; dataUrl: string };

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Index() {
  const [product, setProduct] = useState("");
  const [country, setCountry] = useState("");
  const [specs, setSpecs] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState("");
  const [role, setRole] = useState<"exporter" | "importer" | "both">("both");
  const [activityFilter, setActivityFilter] = useState<string>("الكل");
  const [nameFilter, setNameFilter] = useState("");
  const [searched, setSearched] = useState<{ product: string; country: string }>({
    product: "",
    country: "",
  });

  const runSearch = useServerFn(searchCompanies);
  const mutation = useMutation({
    mutationFn: (vars: {
      product: string;
      country: string;
      role: "exporter" | "importer" | "both";
      specs: string;
      attachments: Attachment[];
    }) => runSearch({ data: vars }),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileError("");
    const allowed = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );
    const tooBig = allowed.filter((f) => f.size > 4 * 1024 * 1024);
    if (tooBig.length > 0) setFileError("بعض الملفات تجاوزت 4 ميغابايت ولم تُضف.");
    const usable = allowed.filter((f) => f.size <= 4 * 1024 * 1024);
    const loaded = await Promise.all(
      usable.map(async (f) => ({ name: f.name, mime: f.type, dataUrl: await readAsDataUrl(f) })),
    );
    setAttachments((prev) => [...prev, ...loaded].slice(0, 4));
  };

  const companies = mutation.data?.companies ?? [];

  const activities = useMemo(() => {
    const set = new Set(companies.map((c) => c.activity).filter(Boolean));
    return ["الكل", ...Array.from(set)];
  }, [companies]);

  const filtered = useMemo(
    () =>
      companies.filter(
        (c) =>
          (activityFilter === "الكل" || c.activity === activityFilter) &&
          (nameFilter.trim() === "" || c.name.includes(nameFilter.trim())),
      ),
    [companies, activityFilter, nameFilter],
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!product.trim()) return;
    setActivityFilter("الكل");
    setNameFilter("");
    const region = country.trim() || "جميع الدول";
    setSearched({ product: product.trim(), country: region });
    mutation.mutate({
      product: product.trim(),
      country: region,
      role,
      specs: specs.trim(),
      attachments,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
          <div className="rounded-md bg-primary-foreground/10 p-2">
            <Database className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold sm:text-xl">منصة التنقيب عن الشركات التجارية</h1>
            <p className="text-xs text-primary-foreground/75 sm:text-sm">
              استخبارات B2B — استخراج الموردين والمصدرين حسب السلعة والدولة
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-xl border bg-card p-5 shadow-panel">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="product">اسم السلعة</Label>
              <Input
                id="product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="مثال: يوريا، حديد، قمح"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">الدولة أو المنطقة</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="مثال: مصر، الخليج العربي، تركيا (اختياري)"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> جارٍ التنقيب...
                </>
              ) : (
                <>
                  <Search /> بحث
                </>
              )}
            </Button>

            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="specs">المواصفات والتحاليل الفنية (اختياري)</Label>
              <Textarea
                id="specs"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                rows={4}
                placeholder={
                  "الصق مواصفات المنتج أو نتائج التحليل المخبري لزيادة دقة النتائج.\nمثال: كبريت (Sulfur) نقاء ≥ 99.5%، رطوبة ≤ 0.2%، حموضة ≤ 0.01%، شكل حبيبي Granular."
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="specs-files"
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    void onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("specs-files")?.click()}
                >
                  <Paperclip /> إرفاق صور أو ملفات التحليل
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  حتى 4 ملفات (صور أو PDF)، بحجم أقصاه 4 ميغابايت للملف.
                </span>
              </div>
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                    >
                      {file.mime.startsWith("image/") && (
                        <img
                          src={file.dataUrl}
                          alt={`مرفق ${file.name}`}
                          className="size-5 rounded object-cover"
                        />
                      )}
                      <span className="max-w-40 truncate">{file.name || "ملف"}</span>
                      <button
                        type="button"
                        aria-label="إزالة المرفق"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </form>


          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">نوع الشركة:</span>
            {ROLES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRole(item.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  role === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">سلع شائعة:</span>
            {EXAMPLES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setProduct(item)}
                className="rounded-full border bg-secondary px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {(mutation.data?.error || mutation.isError) && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {mutation.data?.error ?? "حدث خطأ أثناء تنفيذ البحث. حاول مرة أخرى."}
          </p>
        )}

        {companies.length > 0 && (
          <section className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="size-4 text-primary" />
                تنقية حسب النشاط
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {activities.map((activity) => (
                  <button
                    key={activity}
                    type="button"
                    onClick={() => setActivityFilter(activity)}
                    className={
                      activity === activityFilter
                        ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                        : "rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    }
                  >
                    {activity}
                  </button>
                ))}
              </div>
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="تصفية باسم الشركة"
                className="w-full sm:w-56"
              />
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-bold">
                  نتائج التنقيب: {searched.product} — {searched.country}
                </h2>
                <Badge variant="secondary">{filtered.length} شركة</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم الشركة</TableHead>
                      <TableHead className="text-right">النشاط التجاري</TableHead>
                      <TableHead className="text-right">الموقع الإلكتروني</TableHead>
                      <TableHead className="text-right">التواصل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((company, index) => (
                      <TableRow key={`${company.name}-${index}`}>
                        <TableCell className="align-top">
                          <div className="flex items-start gap-2">
                            <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div>
                              <p className="font-semibold">{company.name}</p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3" />
                                {company.city || searched.country}
                              </p>
                              {company.source && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  المصدر: {company.source}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline">{company.activity}</Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          {company.website ? (
                            <a
                              href={`https://${company.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <Globe className="size-3.5" />
                              {company.website}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">غير متوفر</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              asChild={Boolean(company.phone)}
                              variant="whatsapp"
                              size="sm"
                              disabled={!company.phone}
                            >
                              {company.phone ? (
                                <a
                                  href={whatsappLink(company, searched.product)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle /> واتساب
                                </a>
                              ) : (
                                <span>
                                  <MessageCircle /> واتساب
                                </span>
                              )}
                            </Button>
                            <Button
                              asChild={Boolean(company.email)}
                              variant="quote"
                              size="sm"
                              disabled={!company.email}
                            >
                              {company.email ? (
                                <a href={quoteMailto(company, searched.product)}>
                                  <Mail /> عرض سعر
                                </a>
                              ) : (
                                <span>
                                  <Mail /> عرض سعر
                                </span>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              النتائج مستخرجة آلياً من المنصات التجارية العالمية ودلائل غرف التجارة؛ يُنصح بالتحقق من
              البيانات قبل التعاقد.
            </p>
          </section>
        )}

        {mutation.isPending && <SearchProgress />}


        {!mutation.isPending && companies.length === 0 && !mutation.data?.error && (
          <section className="mt-10 rounded-xl border border-dashed bg-surface p-10 text-center">
            <Search className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">ابدأ بإدخال اسم السلعة والدولة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              سيقوم النظام بالتنقيب في المنصات التجارية (Europages، Kompass، Alibaba) وغرف التجارة
              والسجلات الصناعية لاستخراج الشركات المطابقة.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
