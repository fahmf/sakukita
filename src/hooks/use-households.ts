"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Household, MemberRole, InviteStatus } from "@/lib/supabase/types";
import { useHousehold } from "@/components/providers/household-provider";
import { safeRandomUUID } from "@/lib/utils";

// Supabase generated types from `gen types` are not wired up yet; use loose
// access until that pipeline lands. Each call below preserves runtime typing
// at the boundary (return casts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface HouseholdMembership {
  household_id: string;
  role: MemberRole;
  household: Pick<Household, "id" | "name" | "currency" | "owner_id">;
}

export interface MemberWithProfile {
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile: { display_name: string | null; email: string } | null;
}

export interface InviteRow {
  id: string;
  household_id: string;
  email: string | null;
  token: string;
  role: MemberRole;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
}

export function useMyHouseholds() {
  const { userId } = useHousehold();

  return useQuery<HouseholdMembership[]>({
    queryKey: ["my-households", userId],
    queryFn: async () => {
      const supabase = createClient() as AnyClient;
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, role, household:households(id, name, currency, owner_id)")
        .eq("user_id", userId);
      if (error) throw error;
      return ((data ?? []) as HouseholdMembership[]).filter(
        (h) => h.household != null
      );
    },
  });
}

export function useSwitchHousehold() {
  const { userId } = useHousehold();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdId: string) => {
      const supabase = createClient() as AnyClient;
      const { error } = await supabase
        .from("profiles")
        .update({ active_household_id: householdId, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      return householdId;
    },
    onSuccess: () => {
      queryClient.clear();
      router.refresh();
    },
  });
}

export function useCreateHousehold() {
  const { userId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; currency?: string }) => {
      const supabase = createClient() as AnyClient;
      const { data, error } = await supabase
        .from("households")
        .insert({
          name: input.name,
          currency: input.currency ?? "IDR",
          owner_id: userId,
        })
        .select()
        .single();
      if (error) throw error;

      const household = data as Household;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from("household_members")
        .insert({ household_id: household.id, user_id: userId, role: "admin" });
      if (memberError) throw memberError;

      return household;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-households"] });
    },
  });
}

export function useHouseholdMembers() {
  const { householdId } = useHousehold();

  return useQuery<MemberWithProfile[]>({
    queryKey: ["household-members", householdId],
    queryFn: async () => {
      const supabase = createClient() as AnyClient;
      const { data, error } = await supabase
        .from("household_members")
        .select(
          "user_id, role, joined_at, profile:profiles(display_name, email)"
        )
        .eq("household_id", householdId);
      if (error) throw error;
      return (data ?? []) as MemberWithProfile[];
    },
  });
}

export function useInvites() {
  const { householdId } = useHousehold();

  return useQuery<InviteRow[]>({
    queryKey: ["invites", householdId],
    queryFn: async () => {
      const supabase = createClient() as AnyClient;
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });
}

export function useCreateInvite() {
  const { householdId, userId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      email?: string | null;
      role: MemberRole;
      expiresInDays?: number;
    }) => {
      const supabase = createClient() as AnyClient;
      const expiresAt = new Date(
        Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000
      ).toISOString();
      const token = `${safeRandomUUID()}${safeRandomUUID().replace(/-/g, "")}`;
      const { data, error } = await supabase
        .from("invites")
        .insert({
          household_id: householdId,
          invited_by: userId,
          email: input.email ?? null,
          role: input.role,
          token,
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data as InviteRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites", householdId] });
    },
  });
}

export function useRevokeInvite() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const supabase = createClient() as AnyClient;
      const { error } = await supabase
        .from("invites")
        .update({ status: "revoked" })
        .eq("id", inviteId);
      if (error) throw error;
      return inviteId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites", householdId] });
    },
  });
}

export function useRemoveMember() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIdToRemove: string) => {
      const supabase = createClient() as AnyClient;
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("household_id", householdId)
        .eq("user_id", userIdToRemove);
      if (error) throw error;
      return userIdToRemove;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-members", householdId] });
    },
  });
}

export function useUpdateMemberRole() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; role: MemberRole }) => {
      const supabase = createClient() as AnyClient;
      const { error } = await supabase
        .from("household_members")
        .update({ role: input.role })
        .eq("household_id", householdId)
        .eq("user_id", input.userId);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-members", householdId] });
    },
  });
}
