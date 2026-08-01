"use client";

import { Button } from "@/shared/ui/button";
import { Collapsible } from "@/shared/ui/collapsible";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isValidEmail } from "@/shared/utils/validation";
import { vendorsApi, type Vendor } from "./api";
import { VendorTypeSelect } from "./vendor-type-select";

const defaultForm = {
  name: "",
  vendor_type: "karigar",
  company: "",
  contact_person: "",
  mobile: "",
  email: "",
  city: "",
  state: "",
  gstin: "",
  pan_no: "",
  specialisation: "",
  karigar_rate: "",
  bank_name: "",
  account_no: "",
  ifsc: "",
  upi: "",
  payment_terms: "",
  vendor_status: "active",
  notes: "",
};

export function VendorFormModal({
  open,
  onClose,
  vendor,
}: {
  open: boolean;
  onClose: () => void;
  vendor?: Vendor | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!vendor;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      setForm({
        name: vendor.name,
        vendor_type: vendor.vendor_type,
        company: vendor.company ?? "",
        contact_person: vendor.contact_person ?? "",
        mobile: vendor.mobile ?? "",
        email: vendor.email ?? "",
        city: vendor.city ?? "",
        state: vendor.state ?? "",
        gstin: vendor.gstin ?? "",
        pan_no: vendor.pan_no ?? "",
        specialisation: vendor.specialisation ?? "",
        karigar_rate: vendor.karigar_rate ?? "",
        bank_name: vendor.bank_name ?? "",
        account_no: vendor.account_no ?? "",
        ifsc: vendor.ifsc ?? "",
        upi: vendor.upi ?? "",
        payment_terms: vendor.payment_terms ?? "",
        vendor_status: vendor.vendor_status,
        notes: vendor.notes ?? "",
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, vendor]);

  const set = (k: keyof typeof defaultForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Enter the name.");
      return;
    }
    if (form.email.trim() !== "" && !isValidEmail(form.email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (form.karigar_rate !== "" && Number(form.karigar_rate) < 0) {
      toast.error("Rate can't be negative.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        karigar_rate: form.karigar_rate || null,
        company: form.company || null,
        contact_person: form.contact_person || null,
        mobile: form.mobile || null,
        email: form.email || null,
        city: form.city || null,
        state: form.state || null,
        gstin: form.gstin || null,
        pan_no: form.pan_no || null,
        specialisation: form.specialisation || null,
        bank_name: form.bank_name || null,
        account_no: form.account_no || null,
        ifsc: form.ifsc || null,
        upi: form.upi || null,
        payment_terms: form.payment_terms || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        await vendorsApi.save({ id: vendor!.id, ...payload });
        toast.success("Saved.");
      } else {
        await vendorsApi.save(payload);
        toast.success("Added.");
      }
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const isKarigar = form.vendor_type === "karigar";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit supplier / maker" : "Add supplier / maker"}
      maxWidth={720}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            {isEdit ? "Save changes" : "Add"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="v_name" required>Name</Label>
            <Input id="v_name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v_type">Type</Label>
            <VendorTypeSelect id="v_type" value={form.vendor_type} onChange={(t) => set("vendor_type", t)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="v_company">Company</Label>
            <Input id="v_company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v_contact">Contact person</Label>
            <Input id="v_contact" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v_mobile">Mobile</Label>
            <Input id="v_mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="v_email">Email</Label>
            <Input id="v_email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v_city">City</Label>
            <Input id="v_city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v_state">State</Label>
            <Input id="v_state" value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
        </div>

        {isKarigar ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="v_spec">Specialisation</Label>
              <Input id="v_spec" value={form.specialisation} onChange={(e) => set("specialisation", e.target.value)} placeholder="Kundan, polish, engraving…" />
            </div>
            <div>
              <Label htmlFor="v_rate">Rate (per piece / day)</Label>
              <Input id="v_rate" type="number" min={0} value={form.karigar_rate} onChange={(e) => set("karigar_rate", e.target.value)} />
            </div>
          </div>
        ) : null}

        <Collapsible
          label="Payment & tax details"
          hint="Bank, UPI, GSTIN, PAN, payment terms — all optional"
          defaultOpen={isEdit && !!(vendor?.gstin || vendor?.pan_no || vendor?.bank_name || vendor?.account_no || vendor?.ifsc || vendor?.upi || vendor?.payment_terms)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="v_upi">UPI</Label>
                <Input id="v_upi" value={form.upi} onChange={(e) => set("upi", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="v_gstin">GSTIN</Label>
                <Input id="v_gstin" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="v_pan">PAN</Label>
                <Input id="v_pan" value={form.pan_no} onChange={(e) => set("pan_no", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="v_bank">Bank</Label>
                <Input id="v_bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="v_acc">Account no</Label>
                <Input id="v_acc" value={form.account_no} onChange={(e) => set("account_no", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="v_ifsc">IFSC</Label>
                <Input id="v_ifsc" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="v_terms">Payment terms</Label>
              <Input id="v_terms" value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} placeholder="e.g. 30% advance, 15 credit days" />
            </div>
          </div>
        </Collapsible>

        <div className="sm:w-1/2 sm:pr-2">
          <Label htmlFor="v_status">Status</Label>
          <Select id="v_status" value={form.vendor_status} onChange={(e) => set("vendor_status", e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="v_notes">Notes</Label>
          <Textarea id="v_notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </div>
      </div>
    </Dialog>
  );
}
