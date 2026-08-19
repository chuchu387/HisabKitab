"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOrganization, updateOrganization } from "@/actions/organizations";

const initialState = { ok: false, message: "" };

export function OrganizationForm({ organization }: { organization?: any }) {
  const action = organization ? updateOrganization.bind(null, organization._id.toString()) : createOrganization;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [mode, setMode] = useState(organization?.attendanceMode ?? "selfie");
  const [vendor, setVendor] = useState(organization?.device?.deviceVendor ?? "zkt");
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 sm:p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={organization?.name} />
      <Field name="code" label="Code" defaultValue={organization?.code} />
      <Field name="email" label={organization ? "Email" : "Admin Login Email"} type="email" defaultValue={organization?.email} />
      <Field name="phone" label="Phone" defaultValue={organization?.phone} />
      <Field name="generalBudget" label="Owner/Other Funds" type="number" min="0" step="0.01" defaultValue={organization?.generalBudget ?? 0} />
      {!organization && (
        <>
          <Field name="adminName" label="Admin Name" defaultValue="" />
          <Field name="adminPassword" label="Admin Password" type="password" />
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="attendanceMode">Attendance Method</Label>
        <Select id="attendanceMode" name="attendanceMode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="selfie">Selfie check-in (mobile)</option>
          <option value="device">Fingerprint device</option>
        </Select>
        <p className="text-[11px] text-muted-foreground">Selfie: staff check in from their phone. Device: punches come from a biometric device.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={organization?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
      {mode === "device" && (
        <div className="grid gap-3 md:col-span-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
          <p className="text-xs font-medium text-muted-foreground sm:col-span-2">Fingerprint device configuration</p>
          <div className="space-y-2">
            <Label htmlFor="deviceVendor">Device Vendor</Label>
            <Select id="deviceVendor" name="deviceVendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="zkt">ZKTeco (iClock protocol)</option>
              <option value="hikvision">Hikvision (ISAPI)</option>
            </Select>
          </div>
          <Field name="deviceSn" label="Device Serial (SN)" defaultValue={organization?.device?.deviceSn} placeholder="e.g. device SN shown on device" />
          {vendor === "hikvision" ? (
            <>
              <Field name="deviceUsername" label="Device Username" defaultValue={organization?.device?.deviceUsername} placeholder="e.g. admin" />
              <Field name="devicePassword" label="Device Password" type="password" defaultValue={organization?.device?.devicePassword} placeholder="Device admin password" />
              <Field name="deviceUrl" label="Device URL (for polling)" defaultValue={organization?.device?.deviceUrl} placeholder="e.g. http://192.168.1.100" />
            </>
          ) : (
            <>
              <Field name="pushSecret" label="Push Secret (optional)" defaultValue={organization?.device?.pushSecret} placeholder="Shared secret for webhook pushes" />
              <Field name="deviceUrl" label="Device URL (for polling)" defaultValue={organization?.device?.deviceUrl} placeholder="e.g. http://192.168.1.100" />
            </>
          )}
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="pollEnabled" defaultChecked={organization?.device?.pollEnabled} className="h-4 w-4" />
            Enable scheduled polling
          </label>
        </div>
      )}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={organization?.address} />
      </div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Organization"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
