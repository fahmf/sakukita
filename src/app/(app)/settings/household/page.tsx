"use client";

import * as React from "react";
import Link from "next/link";
import {
  useHouseholdMembers,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-households";
import { useHousehold, canEdit } from "@/components/providers/household-provider";
import { PageHeading, EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  Copy,
  X,
  Loader2,
  UserPlus,
  Mail,
} from "lucide-react";
import { formatRelative } from "@/lib/format";
import { useActivityLogs, type ActivityLog } from "@/hooks/use-activity-logs";
import type { MemberRole } from "@/lib/supabase/types";

export default function HouseholdSettingsPage() {
  const { householdName, role, userId } = useHousehold();
  const { data: members = [], isLoading: loadingMembers } = useHouseholdMembers();
  const { data: invites = [], isLoading: loadingInvites } = useInvites();
  const { data: logs = [], isLoading: loadingLogs } = useActivityLogs();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();

  const isAdmin = role === "admin";
  const allowed = canEdit(role);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<MemberRole>("editor");
  const [generatedLink, setGeneratedLink] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invite = await createInvite.mutateAsync({
        email: inviteEmail.trim() || null,
        role: inviteRole,
        expiresInDays: 7,
      });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setGeneratedLink(`${origin}/invite/${invite.token}`);
      toast.success("Undangan dibuat. Bagikan link berikut.");
      setInviteEmail("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal membuat undangan";
      toast.error(message);
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link disalin");
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setGeneratedLink(null);
    setInviteEmail("");
    setInviteRole("editor");
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    try {
      await removeMember.mutateAsync(confirmRemove);
      toast.success("Anggota dihapus");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus anggota";
      toast.error(message);
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleRoleChange = async (
    memberUserId: string,
    newRole: MemberRole
  ) => {
    try {
      await updateRole.mutateAsync({ userId: memberUserId, role: newRole });
      toast.success("Peran diperbarui");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui peran";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke pengaturan"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading title={householdName} subtitle="Anggota & undangan" />
      </div>

      {/* Members section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Anggota ({members.length})
          </h2>
          {allowed && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-xl text-xs text-mint-strong hover:bg-mint-soft hover:text-mint-strong/80"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="size-3.5" />
              Undang
            </Button>
          )}
        </div>

        {loadingMembers ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada anggota"
            description="Undang anggota agar bisa berbagi catatan keuangan."
          />
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden divide-y">
            {members.map((m) => {
              const isSelf = m.user_id === userId;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {m.profile?.display_name || m.profile?.email || "Anggota"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (kamu)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.profile?.email ?? "—"} · bergabung {formatRelative(m.joined_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && !isSelf ? (
                      <Select
                        value={m.role}
                        onValueChange={(val) =>
                          handleRoleChange(m.user_id, val as MemberRole)
                        }
                      >
                        <SelectTrigger className="h-9 w-28 rounded-xl text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs capitalize text-muted-foreground rounded-full bg-muted px-2.5 py-1">
                        {m.role}
                      </span>
                    )}
                    {isAdmin && !isSelf && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-full text-expense hover:bg-red-50 hover:text-expense dark:hover:bg-red-950/20"
                        onClick={() => setConfirmRemove(m.user_id)}
                        aria-label="Hapus anggota"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Invites section */}
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Undangan
          </h2>
          {loadingInvites ? (
            <div className="h-20 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Belum ada undangan aktif.
            </p>
          ) : (
            <div className="rounded-2xl border bg-card overflow-hidden divide-y">
              {invites.map((inv) => {
                const origin =
                  typeof window !== "undefined" ? window.location.origin : "";
                const link = `${origin}/invite/${inv.token}`;
                const isActive = inv.status === "pending";
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate flex items-center gap-2">
                        {inv.email ? (
                          <>
                            <Mail className="size-3.5 text-muted-foreground" />
                            {inv.email}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Link terbuka</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {inv.status} · {inv.role} · kedaluwarsa{" "}
                        {formatRelative(inv.expires_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-full"
                            onClick={() => copyLink(link)}
                            aria-label="Salin link undangan"
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-full text-expense hover:bg-red-50 hover:text-expense dark:hover:bg-red-950/20"
                            onClick={() => revokeInvite.mutate(inv.id)}
                            disabled={revokeInvite.isPending}
                            aria-label="Cabut undangan"
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}


      {/* Activity Logs Section */}
      <section className="space-y-3 pt-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Aktivitas Terbaru Keluarga
        </h2>
        {loadingLogs ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center bg-card rounded-2xl border border-dashed border-border/80">
            Belum ada aktivitas tercatat.
          </p>
        ) : (
          <div className="relative border-l border-muted pl-4 ml-2 space-y-4 py-2">
            {logs.map((log) => {
              const dateStr = formatRelative(log.created_at);
              const message = formatActivityLog(log);
              
              // Decide icon or dot color based on action
              let dotBg = "bg-muted";
              if (log.action === "create") dotBg = "bg-mint-strong";
              if (log.action === "update") dotBg = "bg-blue-500";
              if (log.action === "delete") dotBg = "bg-expense";
              if (log.action === "archive") dotBg = "bg-amber-500";

              return (
                <div key={log.id} className="relative group">
                  <span className={`absolute -left-[21px] top-1.5 grid size-2.5 rounded-full ring-4 ring-background ${dotBg}`} />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-normal pr-1 break-words">
                      {message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dateStr}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => (o ? setInviteOpen(o) : closeInviteDialog())}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Undang anggota</DialogTitle>
            <DialogDescription>
              Bagikan link ke orang yang ingin kamu ajak. Link berlaku 7 hari.
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs break-all">
                {generatedLink}
              </div>
              <Button
                onClick={() => copyLink(generatedLink)}
                className="h-11 w-full rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90"
              >
                <Copy className="size-4 mr-2" /> Salin link
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={closeInviteDialog}
              >
                Selesai
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invEmail">Email (opsional)</Label>
                <Input
                  id="invEmail"
                  type="email"
                  placeholder="anggota@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invRole">Peran</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as MemberRole)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor (bisa edit data)</SelectItem>
                    <SelectItem value="viewer">Viewer (hanya lihat)</SelectItem>
                    {isAdmin && (
                      <SelectItem value="admin">Admin (penuh)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
                  disabled={createInvite.isPending}
                >
                  {createInvite.isPending ? "Membuat..." : "Buat link undangan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove member confirm */}
      <Dialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Hapus anggota?</DialogTitle>
            <DialogDescription>
              Anggota tidak bisa mengakses household ini lagi setelah dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmRemove(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
              onClick={handleRemoveMember}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatActivityLog(log: ActivityLog) {
  const actor = log.profiles?.display_name || log.profiles?.email || "Anggota Keluarga";
  const meta = log.metadata || {};
  
  if (log.entity_type === 'transactions') {
    const typeLabel = meta.type === 'income' ? 'pemasukan' : meta.type === 'transfer' ? 'transfer' : 'pengeluaran';
    const amountStr = meta.amount ? `sebesar Rp ${Number(meta.amount).toLocaleString('id-ID')}` : '';
    const noteStr = meta.note ? ` ("${meta.note}")` : '';
    
    if (log.action === 'create') {
      return `${actor} mencatat ${typeLabel} baru ${amountStr}${noteStr}`;
    }
    if (log.action === 'update') {
      return `${actor} memperbarui transaksi ${typeLabel} ${amountStr}${noteStr}`;
    }
    if (log.action === 'delete') {
      return `${actor} menghapus transaksi ${typeLabel} ${amountStr}${noteStr}`;
    }
  }
  
  if (log.entity_type === 'wallets') {
    const nameStr = meta.name ? `"${meta.name}"` : 'Dompet';
    if (log.action === 'create') return `${actor} membuat dompet ${nameStr}`;
    if (log.action === 'update') return `${actor} mengubah dompet ${nameStr}`;
    if (log.action === 'archive') return `${actor} mengarsipkan dompet ${nameStr}`;
    if (log.action === 'delete') return `${actor} menghapus dompet ${nameStr}`;
  }
  
  if (log.entity_type === 'budgets') {
    if (log.action === 'create') return `${actor} menetapkan anggaran baru`;
    if (log.action === 'update') return `${actor} memperbarui nominal anggaran`;
    if (log.action === 'delete') return `${actor} menghapus anggaran`;
  }
  
  return `${actor} melakukan aksi ${log.action} pada ${log.entity_type}`;
}
