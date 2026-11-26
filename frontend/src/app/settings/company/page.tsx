"use client";

import {
  getCompanyLogo,
  getCompanyName,
  SETTINGS_QUERY_KEY,
  type CompanySettingsResponse,
  useCompanySettings,
} from "@/features/settings/company-settings";
import { api } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { initials } from "@/shared/utils/format";
import { isValidEmail } from "@/shared/utils/validation";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, ReceiptText, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

const BUSINESS_FIELDS: Array<{ key: string; label: string; type?: string; area?: boolean }> = [
  { key: "company_name", label: "Company name" },
  { key: "company_email", label: "Email", type: "email" },
  { key: "company_phone", label: "Phone" },
  { key: "company_gstin", label: "GSTIN" },
  { key: "company_address", label: "Address", area: true },
];

const INVOICE_FIELDS: Array<{ key: string; label: string; area?: boolean }> = [
  { key: "invoice_terms", label: "Invoice terms", area: true },
  { key: "invoice_footer_note", label: "Invoice footer note", area: true },
];

const EXTRA_KEYS = ["company_logo_path", "default_tax_rate", "invoice_credit_days"];
const EDITABLE_KEYS = [...BUSINESS_FIELDS.map((f) => f.key), ...INVOICE_FIELDS.map((f) => f.key), ...EXTRA_KEYS];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState<string | null>(null);

  const { data, isLoading } = useCompanySettings();

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const set = (key: string, value: string) => setForm((s) => ({ ...s, [key]: value }));

  const uploadLogo = async (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setLogoError("Logo image is too large - please use one under 5 MB.");
      return;
    }
    try {
      set("company_logo_path", await fileToDataUrl(file));
      setLogoError(null);
    } catch {
      setLogoError("Could not read that image.");
    }
  };

  const save = async () => {
    const email = (form.company_email ?? "").trim();
    if (email !== "" && !isValidEmail(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    const taxRate = form.default_tax_rate ?? "";
    if (taxRate !== "" && Number(taxRate) < 0) {
      toast.error("GST rate can't be negative.");
      return;
    }
    const creditDays = (form.invoice_credit_days ?? "").trim();
    if (creditDays !== "" && (!Number.isInteger(Number(creditDays)) || Number(creditDays) < 0)) {
      toast.error("Overdue days must be a whole number, 0 or more.");
      return;
    }

    try {
      const payload = Object.fromEntries(EDITABLE_KEYS.map((key) => [key, form[key] ?? ""]));
      await api.post("settings.php", { action: "save", settings: payload });
      queryClient.setQueryData<CompanySettingsResponse>(SETTINGS_QUERY_KEY, (current) => ({
        settings: { ...(current?.settings ?? {}), ...payload },
      }));
      toast.success("Company details saved.");
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  if (isLoading) return <SkeletonCard lines={8} />;

  const saved = data?.settings ?? {};
  const logo = getCompanyLogo(form);
  const companyName = getCompanyName(form);
  const isUploadedLogo = logo.startsWith("data:");
  const isDirty = EDITABLE_KEYS.some((key) => (form[key] ?? "") !== (saved[key] ?? ""));
  const contactLine = [form.company_phone, form.company_email].filter(Boolean).join(" / ");
  const logoInputValue = isUploadedLogo ? "" : logo;

  const handleLogoInput = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadLogo(event.target.files?.[0]);
    event.target.value = "";
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-card bg-card p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Brand identity</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Used across CRM and printed bills.</p>
          </div>
          {isDirty ? (
            <span className="rounded-pill bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-strong">
              Unsaved
            </span>
          ) : (
            <span className="rounded-pill bg-success-soft px-3 py-1 text-xs font-semibold text-success-strong">
              Saved
            </span>
          )}
        </div>

        <div className="flex min-h-[172px] items-center justify-center rounded-hero border border-border bg-background p-5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${companyName} logo`} className="max-h-32 max-w-full object-contain" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Building2 className="h-10 w-10" strokeWidth={1.75} aria-hidden />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--grad-brand-from),var(--grad-brand-to))] text-sm font-bold text-white shadow-card">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-full w-full bg-white object-contain p-1.5" />
            ) : (
              initials(companyName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{companyName}</p>
            <p className="truncate text-xs text-muted-foreground">{contactLine || "Add phone and email"}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-pill bg-[linear-gradient(135deg,#35609f_0%,#2f5590_100%)] px-4 text-sm font-semibold text-white shadow-hero transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
              <Upload className="h-4 w-4" aria-hidden /> {logo ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={handleLogoInput}
              />
            </label>
            {logo ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => set("company_logo_path", "")}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Button>
            ) : null}
          </div>

          <div>
            <Label htmlFor="company_logo">Logo URL / path</Label>
            <Input
              id="company_logo"
              value={logoInputValue}
              onChange={(e) => set("company_logo_path", e.target.value)}
              placeholder={isUploadedLogo ? "Uploaded file selected" : "Paste an image URL / path"}
            />
          </div>

          {isUploadedLogo ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary-strong">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Logo uploaded
            </p>
          ) : null}
          {logoError ? <p className="text-xs text-attention-strong">{logoError}</p> : null}
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-card bg-card p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Business details</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Printed on invoice headers and shared documents.</p>
            </div>
            <Button onClick={() => void save()} disabled={!isDirty}>
              <Save className="h-4 w-4" aria-hidden /> Save changes
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {BUSINESS_FIELDS.map((f) => (
              <div key={f.key} className={f.area ? "md:col-span-2" : undefined}>
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.area ? (
                  <Textarea
                    id={f.key}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <Input
                    id={f.key}
                    type={f.type ?? "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-soft text-gold-strong">
              <ReceiptText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Invoice defaults</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Applied when creating new bills.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="default_tax_rate">Default GST rate (%)</Label>
              <Input
                id="default_tax_rate"
                type="number"
                min={0}
                max={28}
                step="0.01"
                value={form.default_tax_rate ?? ""}
                onChange={(e) => set("default_tax_rate", e.target.value)}
                placeholder="e.g. 3"
              />
            </div>

            <div>
              <Label htmlFor="invoice_credit_days">Treat a bill as overdue after (days)</Label>
              <Input
                id="invoice_credit_days"
                type="number"
                min={0}
                max={365}
                step="1"
                value={form.invoice_credit_days ?? ""}
                onChange={(e) => set("invoice_credit_days", e.target.value)}
                placeholder="7"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                An unpaid bill older than this shows on the dashboard as overdue. Leave blank for 7 days.
              </p>
            </div>

            {INVOICE_FIELDS.map((f) => (
              <div key={f.key} className="md:col-span-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Textarea id={f.key} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={3} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
