"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCategories, useCreateCategory, useUpdateCategory, useArchiveCategory } from "@/hooks/use-categories";
import { useHousehold } from "@/components/providers/household-provider";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  User,
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  FolderMinus,
  Briefcase,
  Gift,
  Heart,
  Car,
  ShoppingBag,
  Utensils,
  Receipt,
  CircleDot,
  Loader2,
  Trash2,
  Pencil,
  Scale,
} from "lucide-react";
import type { CategoryKind } from "@/lib/supabase/types";

// Helper icons mapping for default categories
const iconMap: Record<string, any> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  "party-popper": Gift,
  "heart-pulse": Heart,
  receipt: Receipt,
  wallet: Briefcase,
  gift: Gift,
  "circle-dashed": CircleDot,
};

export default function SettingsPage() {
  const { displayName, role, householdName, householdId, userId } = useHousehold();
  const { data: categoriesTree = [], isLoading: loadingCategories } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const archiveCategory = useArchiveCategory();

  const router = useRouter();

  // Profile Edit States
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [newDisplayName, setNewDisplayName] = React.useState(displayName);
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Household Edit States
  const [householdOpen, setHouseholdOpen] = React.useState(false);
  const [newHouseholdName, setNewHouseholdName] = React.useState(householdName);
  const [savingHousehold, setSavingHousehold] = React.useState(false);
  const allowed = useCanEdit();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    setSavingProfile(true);
    try {
      const supabase = createClient() as any;
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: newDisplayName.trim(), updated_at: new Date().toISOString() })
        .eq("id", userId);
      
      if (error) throw error;
      toast.success("Nama pengguna berhasil diubah!");
      setProfileOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah nama pengguna.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    if (!allowed) {
      viewOnlyToast();
      setHouseholdOpen(false);
      return;
    }
    setSavingHousehold(true);
    try {
      const supabase = createClient() as any;
      const { error } = await supabase
        .from("households")
        .update({ name: newHouseholdName.trim(), updated_at: new Date().toISOString() })
        .eq("id", householdId);
      
      if (error) throw error;
      toast.success("Nama keluarga berhasil diubah!");
      setHouseholdOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah nama keluarga.");
    } finally {
      setSavingHousehold(false);
    }
  };

  // Create/Edit Category States
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [parentId, setParentId] = React.useState<string | null>(null);

  // Customization States
  const [editingCategory, setEditingCategory] = React.useState<any | null>(null);
  const [icon, setIcon] = React.useState("");
  const [color, setColor] = React.useState("#E8A5A5");

  // Accordion collapsed parent categories state
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({});

  const toggleParent = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName("");
    setKind("expense");
    setParentId("none");
    setIcon("🍔");
    setColor("#E8A5A5");
    setOpen(true);
  };

  const handleOpenEdit = (category: any) => {
    setEditingCategory(category);
    setName(category.name);
    setKind(category.kind);
    setParentId(category.parent_id || "none");
    setIcon(category.icon || "🍔");
    setColor(category.color || (category.kind === "income" ? "#5FBF9A" : "#E8A5A5"));
    setOpen(true);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const finalParentId = parentId === "none" || !parentId ? null : parentId;
      const finalIcon = icon.trim() || (kind === "income" ? "wallet" : "circle-dashed");
      const finalColor = color || (kind === "income" ? "#5FBF9A" : "#E8A5A5");

      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          name: name.trim(),
          kind,
          parent_id: finalParentId,
          icon: finalIcon,
          color: finalColor,
        });
        toast.success("Kategori berhasil diperbarui!");
      } else {
        await createCategory.mutateAsync({
          name: name.trim(),
          kind,
          parent_id: finalParentId,
          icon: finalIcon,
          color: finalColor,
        });
        toast.success("Kategori baru berhasil dibuat!");
      }

      setName("");
      setIcon("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan kategori. Coba lagi.");
    }
  };

  const handleArchiveCategory = async (id: string) => {
    const confirm = window.confirm(
      "Apakah Anda yakin ingin mengarsipkan kategori ini?\nTransaksi yang menggunakan kategori ini akan tetap aman tetapi kategori ini tidak akan muncul lagi di pilihan baru."
    );
    if (!confirm) return;

    try {
      await archiveCategory.mutateAsync(id);
      toast.success("Kategori berhasil diarsipkan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengarsipkan kategori.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading title="Pengaturan" subtitle="Kelola data profil, keluarga, dan kategori" />

      {/* Profile & Household Cards */}
      <div className="grid gap-3">
        <div className="rounded-2xl border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <User className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">Peran: {role === "admin" ? "Pemilik / Admin" : "Editor"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setNewDisplayName(displayName);
              setProfileOpen(true);
            }}
            className="size-9 rounded-xl hover:bg-muted"
            aria-label="Ubah nama pengguna"
          >
            <Pencil className="size-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{householdName}</p>
              <p className="text-xs text-muted-foreground">Anggota Keluarga Aktif</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setNewHouseholdName(householdName);
                setHouseholdOpen(true);
              }}
              className="size-9 rounded-xl hover:bg-muted"
              aria-label="Ubah nama keluarga"
            >
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
            <Link
              href="/settings/household"
              className="rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              Kelola
            </Link>
          </div>
        </div>

        <Link
          href="/scheduled"
          className="rounded-2xl border bg-card p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Transaksi Terjadwal</p>
              <p className="text-xs text-muted-foreground">
                Catatan dengan tanggal di masa depan
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>

        <Link
          href="/debts"
          className="rounded-2xl border bg-card p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Scale className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Hutang & Piutang</p>
              <p className="text-xs text-muted-foreground">
                Pencatatan utang-piutang keluarga
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>

        <Link
          href="/settings/trash"
          className="rounded-2xl border bg-card p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Trash2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Recycle Bin</p>
              <p className="text-xs text-muted-foreground">
                Transaksi terhapus disimpan 30 hari
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </div>

      {/* Category Manager Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Daftar Kategori</h2>

          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenAdd}
              className="text-xs text-mint-strong hover:text-mint-strong/80 hover:bg-mint-soft rounded-xl gap-1"
            >
              <Plus className="size-3.5" />
              Tambah Kategori
            </Button>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Ubah Kategori" : "Tambah Kategori"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmitCategory} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catName">Nama Kategori</Label>
                  <Input
                    id="catName"
                    placeholder="Contoh: Belanja Bulanan, Service Motor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="catKind">Jenis</Label>
                    <Select value={kind} onValueChange={(val: CategoryKind) => setKind(val)}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Pilih jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Pengeluaran</SelectItem>
                        <SelectItem value="income">Pemasukan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="catParent">Sub dari (Opsional)</Label>
                    <Select value={parentId || "none"} onValueChange={(val) => setParentId(val === "none" ? null : val)}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Utama" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Jadikan Kategori Utama --</SelectItem>
                        {categoriesTree
                          .filter((c) => c.kind === kind && c.id !== editingCategory?.id)
                          .map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Color Selector */}
                <div className="flex flex-col gap-1.5">
                  <Label>Pilih Warna</Label>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {[
                      "#E8A5A5", // Red
                      "#5FBF9A", // Green
                      "#B8E6D3", // Teal
                      "#F4D2A6", // Orange
                      "#C8A5E8", // Purple
                      "#A5D8E8", // Blue
                      "#E8A5C8", // Pink
                      "#E8E5A5", // Yellow
                      "#A8A29E"  // Stone
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`size-7 rounded-full border transition-all active:scale-90 ${
                          color === c ? "ring-2 ring-mint-strong scale-110 border-transparent" : "border-border"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Emoji Selector */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catEmoji">Pilih Ikon Emoji</Label>
                  <div className="flex gap-2">
                    <Input
                      id="catEmoji"
                      maxLength={4}
                      placeholder="Ketik emoji kustom..."
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="h-11 w-20 text-center text-xl rounded-xl"
                    />
                    <div className="flex-1 overflow-x-auto flex gap-1.5 py-1 px-0.5 scrollbar-none items-center">
                      {[
                        "🍔", "🚗", "🏠", "🎮", "🏥", "🛍️", "💰", "📈", "🔌", "📶", "💸", "🛒", "🍿", "✈️", "💵", "🪙"
                      ].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setIcon(em)}
                          className={`size-9 rounded-xl border flex items-center justify-center text-lg transition-all hover:bg-muted active:scale-90 ${
                            icon === em ? "border-mint-strong bg-mint-soft text-mint-strong" : "bg-card border-border"
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={createCategory.isPending || updateCategory.isPending || !name}
                    className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
                  >
                    {createCategory.isPending || updateCategory.isPending
                      ? "Menyimpan..."
                      : editingCategory
                      ? "Simpan Perubahan"
                      : "Tambah Kategori"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Hierarchical Categories Trees */}
        {loadingCategories ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* EXPENSE CATEGORIES */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-expense bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-full">
                Pengeluaran
              </span>
              <div className="rounded-2xl border bg-card overflow-hidden divide-y">
                {categoriesTree
                  .filter((c) => c.kind === "expense")
                  .map((parent) => {
                    const isExpanded = expandedParents[parent.id] !== false; // expanded by default
                    const hasSubs = parent.subcategories.length > 0;

                    return (
                      <div key={parent.id} className="flex flex-col">
                        {/* Parent item */}
                        <div
                          onClick={() => toggleParent(parent.id)}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="grid size-9 place-items-center rounded-xl text-white font-semibold"
                              style={{ backgroundColor: parent.color || "#E8A5A5" }}
                            >
                              {iconMap[parent.icon || ""] ? (
                                React.createElement(iconMap[parent.icon || ""], { className: "size-4" })
                              ) : (
                                <span className="text-base leading-none select-none">{parent.icon || "📁"}</span>
                              )}
                            </span>
                            <span className="font-medium text-sm text-foreground">{parent.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Action Buttons (visible on hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => handleOpenEdit(parent)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => handleArchiveCategory(parent.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            
                            {hasSubs && (
                              <span>
                                {isExpanded ? (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subcategories list */}
                        {hasSubs && isExpanded && (
                          <div className="bg-muted/20 pl-16 pr-4 py-2 divide-y divide-border/40 animate-in fade-in duration-200">
                            {parent.subcategories.map((sub) => (
                              <div key={sub.id} className="py-2 text-xs text-muted-foreground font-medium flex items-center justify-between group/sub">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm select-none leading-none">{sub.icon || "🏷️"}</span>
                                  <span>{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={() => handleOpenEdit(sub)}
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 rounded-md text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
                                    onClick={() => handleArchiveCategory(sub.id)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* INCOME CATEGORIES */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-income bg-mint-soft px-2.5 py-1 rounded-full">
                Pemasukan
              </span>
              <div className="rounded-2xl border bg-card overflow-hidden divide-y">
                {categoriesTree
                  .filter((c) => c.kind === "income")
                  .map((parent) => {
                    const isExpanded = expandedParents[parent.id] !== false; // expanded by default
                    const hasSubs = parent.subcategories.length > 0;

                    return (
                      <div key={parent.id} className="flex flex-col">
                        {/* Parent item */}
                        <div
                          onClick={() => toggleParent(parent.id)}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="grid size-9 place-items-center rounded-xl text-white font-semibold"
                              style={{ backgroundColor: parent.color || "#5FBF9A" }}
                            >
                              {iconMap[parent.icon || ""] ? (
                                React.createElement(iconMap[parent.icon || ""], { className: "size-4" })
                              ) : (
                                <span className="text-base leading-none select-none">{parent.icon || "💼"}</span>
                              )}
                            </span>
                            <span className="font-medium text-sm text-foreground">{parent.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Action Buttons (visible on hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => handleOpenEdit(parent)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => handleArchiveCategory(parent.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            
                            {hasSubs && (
                              <span>
                                {isExpanded ? (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subcategories list */}
                        {hasSubs && isExpanded && (
                          <div className="bg-muted/20 pl-16 pr-4 py-2 divide-y divide-border/40 animate-in fade-in duration-200">
                            {parent.subcategories.map((sub) => (
                              <div key={sub.id} className="py-2 text-xs text-muted-foreground font-medium flex items-center justify-between group/sub">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm select-none leading-none">{sub.icon || "🏷️"}</span>
                                  <span>{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={() => handleOpenEdit(sub)}
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 rounded-md text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
                                    onClick={() => handleArchiveCategory(sub.id)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog for Profile Edit */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ubah Nama Pengguna</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayNameInput">Nama Pengguna</Label>
              <Input
                id="displayNameInput"
                placeholder="Masukkan nama pengguna baru"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={savingProfile || !newDisplayName.trim()}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
              >
                {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Household Edit */}
      <Dialog open={householdOpen} onOpenChange={setHouseholdOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ubah Nama Keluarga</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateHousehold} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="householdNameInput">Nama Keluarga</Label>
              <Input
                id="householdNameInput"
                placeholder="Masukkan nama keluarga baru"
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={savingHousehold || !newHouseholdName.trim()}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
              >
                {savingHousehold ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
