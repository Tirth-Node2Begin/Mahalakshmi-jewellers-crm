"use client";

import { api } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input, Label } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { isValidEmail } from "@/shared/utils/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const FIELDS: Array<{ key: string; label: string; area?: boolean }> = [
  { key: "company_name", label: "Company name" },
  { key: "company_email", label: "Email" },
  { key: "company_phone", label: "Phone" },
  { key: "company_gstin", label: "GSTIN" },
  { key: "company_address", label: "Address", area: true },
  { key: "invoice_terms", label: "Invoice terms", area: true },
  { key: "invoice_footer_note", label: "Invoice footer note", area: true },
];

/** Saved alongside FIELDS but rendered with custom widgets below (logo upload, numeric rate). */
const EXTRA_KEYS = ["company_logo_path", "default_tax_rate"];

/** Max upload size before base64 (~5 MB). Bigger images bloat the DB and slow the printed invoice. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Read a picked file into a base64 data URI (preserves PNG/WebP transparency). */
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

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: Record<string, string> }>("settings.php"),
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const set = (key: string, value: string) => setForm((s) => ({ ...s, [key]: value }));

  const uploadLogo = async (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setLogoError("Logo image is too large — please use one under 5 MB.");
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
    try {
      const keys = [...FIELDS.map((f) => f.key), ...EXTRA_KEYS];
      const payload = Object.fromEntries(keys.map((key) => [key, form[key] ?? ""]));
      await api.post("settings.php", { action: "save", settings: payload });
      toast.success("Company details saved.");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  if (isLoading) return <SkeletonCard lines={8} />;

  const logo = form.company_logo_path ?? "";

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Company profile"
        action={
          <Button size="sm" onClick={() => void save()}>
            Save
          </Button>
        }
      />
      <p className="mb-6 text-sm text-muted-foreground">These appear on the printed invoice header and footer.</p>
      <div className="space-y-5">
        <div>
          <Label htmlFor="company_logo">Company logo</Label>
          <div className="flex items-start gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input border border-border bg-background">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Company logo" className="h-full w-full object-contain" />
              ) : (
                <span className="px-1 text-center text-[10px] text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary">
                  <Upload className="h-4 w-4" aria-hidden /> {logo ? "Replace" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => void uploadLogo(e.target.files?.[0])}
                  />
                </label>
                {logo ? (
                  <button
                    type="button"
                    onClick={() => set("company_logo_path", "")}
                    className="text-xs text-muted-foreground hover:text-attention-strong"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {logo.startsWith("data:") ? (
                <p className="text-xs font-medium text-primary-strong">✓ Logo uploaded</p>
              ) : (
                <Input
                  id="company_logo"
                  value={logo}
                  onChange={(e) => set("company_logo_path", e.target.value)}
                  placeholder="…or paste an image URL / path"
                />
              )}
              {logoError ? <p className="text-xs text-attention-strong">{logoError}</p> : null}
              <p className="text-[11px] text-muted-foreground">
                PNG or WebP keeps a transparent background. Shown on the printed invoice header.
              </p>
            </div>
          </div>
        </div>

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
          <p className="mt-1 text-[11px] text-muted-foreground">New bill lines default to this GST rate.</p>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            {f.area ? (
              <Textarea id={f.key} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={2} />
            ) : (
              <Input id={f.key} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
