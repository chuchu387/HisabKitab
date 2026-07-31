"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateUserPermissions, updateUserRole } from "@/actions/users";
import { resolvePermissions } from "@/constants/permissions";
import { ActionMessage } from "@/components/action-message";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

const roleLabels: Record<string, string> = { owner: "Co-owner", admin: "Admin", staff: "Staff" };

function FeatureToggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-secondary/30">
      <input type="checkbox" checked={enabled} onChange={onChange} className="h-3.5 w-3.5" />
      <span className={cn(enabled ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
    </label>
  );
}

export function PermissionManager({ users, featureLabels: labels, featureKeys: keys, currentUserId, currentRole }: { users: any[]; featureLabels: Record<string, string>; featureKeys: string[]; currentUserId: string; currentRole: string }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [state, formAction, pending] = useActionState(updateUserPermissions, initialState);
  const [role, setRole] = useState("");
  const [isSavingRole, startRoleSave] = useTransition();
  const router = useRouter();

  function selectUser(user: any) {
    setSelectedUser(user);
    setRole(user.role);
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

  function saveRole() {
    if (!selectedUser || role === selectedUser.role) return;
    startRoleSave(async () => {
      const result = await updateUserRole(selectedUser._id, role);
      if (result.ok) {
        toast.success(result.message);
        selectUser({ ...selectedUser, role });
        router.refresh();
      } else {
        toast.error(result.message);
        setRole(selectedUser.role);
      }
    });
  }

  const isOwner = currentRole === "owner";
  const roleOptions = isOwner ? ["staff", "admin", "owner"] : ["staff", "admin"];
  const canChangeRole = selectedUser && selectedUser._id !== currentUserId;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-xs uppercase tracking-wide">Members</CardTitle></CardHeader>
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
                <p className="truncate text-xs font-medium">{user.name}{user._id === currentUserId && <span className="text-muted-foreground"> (you)</span>}</p>
                <p className="truncate text-[10px] text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
              </div>
              {user.role === "owner" ? <Crown className="h-3.5 w-3.5 text-accent" /> : <Shield className="h-3 w-3 text-muted-foreground" />}
            </button>
          ))}
          {!users.length && <p className="p-4 text-center text-xs text-muted-foreground">No members</p>}
        </CardContent>
      </Card>

      <Card>
        {selectedUser ? (
          <>
            <CardHeader className="flex flex-col gap-3 border-b xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="text-sm">{selectedUser.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canChangeRole && (
                  <>
                    <select value={role} onChange={(event) => setRole(event.target.value)} className="native-control h-8 w-32">
                      {roleOptions.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}
                    </select>
                    <Button variant={role !== selectedUser.role ? "default" : "outline"} size="sm" className="h-8 text-xs" disabled={isSavingRole || role === selectedUser.role} onClick={saveRole}>
                      {isSavingRole ? "Saving..." : "Update Role"}
                    </Button>
                  </>
                )}
                {selectedUser.role !== "owner" && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetToDefaults}><RotateCcw className="h-3 w-3" /> Reset</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {selectedUser.role === "owner" ? (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 font-medium text-foreground"><Crown className="h-4 w-4 text-accent" /> Co-owner</p>
                  <p className="mt-1 text-xs">Co-owners have full access to every feature, like the primary owner. You can demote them to admin or staff using the role dropdown.</p>
                </div>
              ) : (
                <form action={handleSubmit} className="space-y-3">
                  <ActionMessage state={state} />
                  <p className="text-xs text-muted-foreground">Feature access for <span className="font-medium capitalize">{roleLabels[selectedUser.role]}</span> role — overrides apply on top of the default role permissions.</p>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {keys.map((key) => (
                      <FeatureToggle key={key} label={labels[key] || key} enabled={permissions[key] ?? false} onChange={() => toggle(key)} />
                    ))}
                  </div>
                  <Button type="submit" disabled={pending} size="sm">
                    {pending ? "Saving..." : "Save Permissions"}
                  </Button>
                </form>
              )}
            </CardContent>
          </>
        ) : (
          <div className="flex items-center justify-center py-16 text-center text-sm text-muted-foreground">
            <div><Shield className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" /><p>Select a member to manage their role and permissions</p></div>
          </div>
        )}
      </Card>
    </div>
  );
}
