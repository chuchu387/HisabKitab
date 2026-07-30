"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateUserPermissions } from "@/actions/users";
import { resolvePermissions, defaultPermissions, type FeatureKey, type Permissions } from "@/constants/permissions";
import { ActionMessage } from "@/components/action-message";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

function FeatureToggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-secondary/30">
      <input type="checkbox" checked={enabled} onChange={onChange} className="h-3.5 w-3.5" />
      <span className={cn(enabled ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
    </label>
  );
}

export function PermissionManager({ users, featureLabels: labels, featureKeys: keys, currentUserId }: { users: any[]; featureLabels: Record<string, string>; featureKeys: string[]; currentUserId: string }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [state, formAction, pending] = useActionState(updateUserPermissions, initialState);
  const router = useRouter();

  function selectUser(user: any) {
    setSelectedUser(user);
    const perms = resolvePermissions(user.role, user.permissions || {});
    setPermissions({ ...perms });
  }

  function toggle(key: string) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetToDefaults() {
    if (!selectedUser) return;
    const defaults = resolvePermissions(selectedUser.role, {});
    setPermissions({ ...defaults });
  }

  function handleSubmit(formData: FormData) {
    if (!selectedUser) return;
    formData.set("userId", selectedUser._id);
    for (const key of keys) {
      formData.set(`perm_${key}`, permissions[key] ? "true" : "false");
    }
    formAction(formData);
  }

  const hasChanges = selectedUser && Object.keys(permissions).length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* User list */}
      <Card>
        <CardHeader><CardTitle className="text-xs uppercase tracking-wide">Staff</CardTitle></CardHeader>
        <CardContent className="space-y-1 p-2">
          {users.map((user) => (
            <button
              key={user._id}
              onClick={() => selectUser(user)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/40", selectedUser?._id === user._id && "bg-primary/10 font-medium")}
            >
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", user.active ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground")}>
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{user.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user.role}</p>
              </div>
              <Shield className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
          {!users.length && <p className="p-4 text-center text-xs text-muted-foreground">No staff members</p>}
        </CardContent>
      </Card>

      {/* Permission toggles */}
      <Card>
        {selectedUser ? (
          <>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm">{selectedUser.name}</CardTitle>
                <p className="text-xs text-muted-foreground capitalize">{selectedUser.role} · {selectedUser.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetToDefaults}><RotateCcw className="h-3 w-3" /> Reset</Button>
              </div>
            </CardHeader>
            <CardContent>
              <form action={handleSubmit} className="space-y-3">
                <ActionMessage state={state} />
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {keys.map((key) => (
                    <FeatureToggle key={key} label={labels[key] || key} enabled={permissions[key] ?? false} onChange={() => toggle(key)} />
                  ))}
                </div>
                <Button type="submit" disabled={pending || !hasChanges} size="sm">
                  {pending ? "Saving..." : "Save Permissions"}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <div className="flex items-center justify-center py-16 text-center text-sm text-muted-foreground">
            <div><Shield className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" /><p>Select a staff member to manage permissions</p></div>
          </div>
        )}
      </Card>
    </div>
  );
}
