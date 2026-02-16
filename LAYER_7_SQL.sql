-- ============================================
-- LAYER 7: RBAC UI, Incident Assignment, Audit Log
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Step 1: Add assigned_to field to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON public.incidents(assigned_to);

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.assigned_to IS 'User assigned to handle this incident';

-- Step 2: Create audit_log table for tracking all changes
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Step 3: Create indexes for audit_log performance
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Step 4: RLS policies for audit_log
-- Members can view audit logs in their org
CREATE POLICY "Members can view org audit logs"
  ON public.audit_log FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

-- Authenticated users can insert audit logs (service layer will enforce org_id)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Step 5: Add comments for documentation
COMMENT ON TABLE public.audit_log IS 'Audit trail of all actions in the system';
COMMENT ON COLUMN public.audit_log.action IS 'Action performed: create, update, delete, etc.';
COMMENT ON COLUMN public.audit_log.entity_type IS 'Type of entity: incident, member, invite, etc.';
COMMENT ON COLUMN public.audit_log.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN public.audit_log.details IS 'JSON details about the change (old/new values, etc.)';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify assigned_to column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'incidents' 
AND column_name = 'assigned_to';

-- Verify audit_log table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'audit_log';

-- Verify audit_log RLS policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'audit_log';

-- ============================================
-- LAYER 7 COMPLETE
-- ============================================
-- Features added:
-- 1. RBAC in UI (viewers cannot create/edit/delete)
-- 2. Incident assignment (assigned_to field)
-- 3. Audit log system (tracks all changes)
-- 4. Audit log viewer page at /audit
-- ============================================
