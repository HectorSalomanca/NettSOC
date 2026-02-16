-- ============================================
-- LAYER 8: Collaboration - Comments, Markdown, Notifications
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Step 1: Create incident_comments table for threaded discussions
CREATE TABLE IF NOT EXISTS public.incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES public.incident_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incident_comments_incident_id ON public.incident_comments(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_org_id ON public.incident_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_parent_id ON public.incident_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_created_at ON public.incident_comments(created_at DESC);

-- Step 3: RLS policies for incident_comments
-- Members can view comments in their org
CREATE POLICY "Members can view org comments"
  ON public.incident_comments FOR SELECT
  USING (org_id IN (SELECT public.get_my_org_ids()));

-- Analysts and admins can create comments
CREATE POLICY "Analysts and admins can create comments"
  ON public.incident_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    public.get_my_role_in_org(org_id) IN ('admin', 'analyst')
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.incident_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can delete any comment, users can delete their own
CREATE POLICY "Users can delete own comments"
  ON public.incident_comments FOR DELETE
  USING (
    user_id = auth.uid() OR
    public.get_my_role_in_org(org_id) = 'admin'
  );

-- Step 4: Add comments for documentation
COMMENT ON TABLE public.incident_comments IS 'Threaded comments/discussion on incidents';
COMMENT ON COLUMN public.incident_comments.parent_id IS 'Parent comment ID for threading (null for top-level)';
COMMENT ON COLUMN public.incident_comments.content IS 'Comment content (supports markdown)';

-- ============================================
-- OPTIONAL: Notifications Queue Table
-- Uncomment this section when ready to implement email notifications
-- ============================================

-- CREATE TABLE IF NOT EXISTS public.notifications_queue (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
--   recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   type text NOT NULL,
--   entity_type text NOT NULL,
--   entity_id uuid,
--   message text NOT NULL,
--   status text NOT NULL DEFAULT 'pending',
--   created_at timestamptz NOT NULL DEFAULT now(),
--   sent_at timestamptz
-- );
-- 
-- ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE INDEX IF NOT EXISTS idx_notifications_queue_status ON public.notifications_queue(status);
-- CREATE INDEX IF NOT EXISTS idx_notifications_queue_recipient ON public.notifications_queue(recipient_user_id);
-- CREATE INDEX IF NOT EXISTS idx_notifications_queue_created_at ON public.notifications_queue(created_at DESC);
-- 
-- CREATE POLICY "Users can view own notifications"
--   ON public.notifications_queue FOR SELECT
--   USING (recipient_user_id = auth.uid());

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify incident_comments table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'incident_comments';

-- Verify incident_comments RLS policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'incident_comments';

-- ============================================
-- LAYER 8 COMPLETE
-- ============================================
-- Features added:
-- 1. Comments/discussion system with threading support
-- 2. Markdown support in summaries and comments (client-side)
-- 3. Email notification foundation (service structure ready)
-- 4. Comments are role-protected (viewers read-only)
-- 5. Users can delete their own comments, admins can delete any
-- ============================================
