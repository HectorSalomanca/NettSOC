-- ============================================
-- LAYER 6: Organization Member Management SQL
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Step 1: Create org_invites table
CREATE TABLE IF NOT EXISTS public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'analyst',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Step 2: RLS Policies for org_invites
DROP POLICY IF EXISTS "Admins can view org invites" ON public.org_invites;
CREATE POLICY "Admins can view org invites"
  ON public.org_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_invites.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can create invites" ON public.org_invites;
CREATE POLICY "Admins can create invites"
  ON public.org_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_invites.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update invites" ON public.org_invites;
CREATE POLICY "Admins can update invites"
  ON public.org_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_invites.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role = 'admin'
    )
  );

-- Step 3: Add UPDATE and DELETE policies for org_members (if not exists)
DROP POLICY IF EXISTS "Admins can update members" ON public.org_members;
CREATE POLICY "Admins can update members"
  ON public.org_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members AS om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete members" ON public.org_members;
CREATE POLICY "Admins can delete members"
  ON public.org_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members AS om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
    )
  );

-- Step 4: RPC Functions
DROP FUNCTION IF EXISTS public.update_member_role(uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_member_id uuid,
  p_new_role text,
  p_org_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_org uuid;
  v_target_role text;
  v_admin_count int;
BEGIN
  -- Check caller is admin in this org
  SELECT role INTO v_caller_role
  FROM public.org_members
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an admin';
  END IF;

  -- Get target member info
  SELECT org_id, role INTO v_target_org, v_target_role
  FROM public.org_members
  WHERE id = p_member_id;

  IF v_target_org IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target_org != p_org_id THEN
    RAISE EXCEPTION 'Member does not belong to this organization';
  END IF;

  -- If demoting an admin, ensure at least one admin remains
  IF v_target_role = 'admin' AND p_new_role != 'admin' THEN
    SELECT count(*) INTO v_admin_count
    FROM public.org_members
    WHERE org_id = p_org_id AND role = 'admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin';
    END IF;
  END IF;

  -- Perform the update
  UPDATE public.org_members
  SET role = p_new_role
  WHERE id = p_member_id;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.remove_org_member(uuid, uuid);
CREATE OR REPLACE FUNCTION public.remove_org_member(
  p_member_id uuid,
  p_org_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_org uuid;
  v_target_role text;
  v_admin_count int;
BEGIN
  -- Check caller is admin
  SELECT role INTO v_caller_role
  FROM public.org_members
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an admin';
  END IF;

  -- Get target member info
  SELECT org_id, role INTO v_target_org, v_target_role
  FROM public.org_members
  WHERE id = p_member_id;

  IF v_target_org IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target_org != p_org_id THEN
    RAISE EXCEPTION 'Member does not belong to this organization';
  END IF;

  -- Prevent removing last admin
  IF v_target_role = 'admin' THEN
    SELECT count(*) INTO v_admin_count
    FROM public.org_members
    WHERE org_id = p_org_id AND role = 'admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;

  DELETE FROM public.org_members WHERE id = p_member_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.join_org_by_invite(text);
CREATE OR REPLACE FUNCTION public.join_org_by_invite(
  p_code text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_already_member boolean;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find valid invite
  SELECT * INTO v_invite
  FROM public.org_invites
  WHERE code = p_code
    AND is_active = true
    AND uses < max_uses
    AND (expires_at IS NULL OR expires_at > now());

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or fully used invite code';
  END IF;

  -- Check if already a member
  SELECT EXISTS(
    SELECT 1 FROM public.org_members
    WHERE org_id = v_invite.org_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RAISE EXCEPTION 'You are already a member of this organization';
  END IF;

  -- Insert member
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_invite.org_id, v_user_id, v_invite.role);

  -- Increment uses
  UPDATE public.org_invites
  SET uses = uses + 1
  WHERE id = v_invite.id;

  RETURN v_invite.org_id;
END;
$$;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_org_by_invite(text) TO authenticated;

-- Verification queries (optional - run these to check)
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%member%' OR routine_name LIKE '%invite%';
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('org_members', 'org_invites');
