import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

const STAGES = [
  {
    title: "تحليل الطلب والمواصفات",
    detail: "استخلاص الدرجة التجارية وكود HS من النص والمرفقات",
    at: 0,
  },
  {
    title: "الجولة الرسمية",
    detail: "ITC Trade Map، WITS، غرف التجارة والمنظمات التجارية",
    at: 6,
  },
  {
    title: "جولة السجلات وقواعد الجمارك",
    detail: "Panjiva، ImportGenius، Volza، Dun & Bradstreet، سجلات الشركات",
    at: 15,
  },
  {
    title: "جولة الأدلة العالمية",
    detail: "Kompass، Europages، IndiaMART، Alibaba وأدلة الموزعين",
    at: 24,
  },
  {
    title: "الدمج والتصفية",
    detail: "إزالة التكرار واستبعاد المصانع وترتيب النتائج",
    at: 33,
  },
];

export function SearchProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, []);

  const activeIndex = Math.max(
    0,
    STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0),
  );
  const percent = Math.min(96, Math.round((elapsed / 38) * 100));

  return (
    <section className="mt-6 rounded-xl border bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">جارٍ التنقيب عن الشركات...</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {elapsed} ثانية · {percent}%
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-5 space-y-3">
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={stage.title}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                active ? "border-primary/40 bg-primary/5" : "border-transparent"
              }`}
            >
              <span className="mt-0.5">
                {done ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : active ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground/40" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    done || active ? "" : "text-muted-foreground"
                  }`}
                >
                  {stage.title}
                </p>
                <p className="text-xs text-muted-foreground">{stage.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-muted-foreground">
        الجولات تعمل بالتوازي وقد تستغرق من 20 إلى 40 ثانية، يرجى عدم إغلاق الصفحة.
      </p>
    </section>
  );
}
