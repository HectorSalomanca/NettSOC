-- ============================================
-- LAYER 9: Dashboard Enhancements & UX Improvements
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Step 1: Add SLA due_at field to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- Create index for faster lookups of overdue incidents
CREATE INDEX IF NOT EXISTS idx_incidents_due_at ON public.incidents(due_at);

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.due_at IS 'SLA deadline for incident resolution';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify due_at column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'incidents' 
AND column_name = 'due_at';

-- Test query for overdue incidents
SELECT id, title, severity, status, due_at,
  CASE 
    WHEN due_at < now() THEN 'OVERDUE'
    WHEN due_at < now() + interval '24 hours' THEN 'DUE_SOON'
    ELSE 'ON_TRACK'
  END as sla_status
FROM public.incidents
WHERE due_at IS NOT NULL
ORDER BY due_at ASC;

-- ============================================
-- LAYER 9 COMPLETE
-- ============================================
-- Features added:
-- 1. Dashboard tiles are clickable filters (route to /incidents?status=X)
-- 2. Severity bars route to filtered incident list
-- 3. Empty "Critical & Open" replaced with:
--    - Longest Open Incidents (if any open)
--    - Unassigned Incidents (if any unassigned)
--    - Falls back to empty state
-- 4. SLA due_at field with time remaining badges:
--    - Red "Overdue" badge if past due
--    - Yellow "Due in Xh" if < 24 hours
--    - Gray "Due in Xd Xh" otherwise
-- 5. Evidence section shows uploaded_by with display names
-- 6. System events auto-posted to discussion:
--    - "Severity changed Low → High"
--    - "Status changed Open → Investigating"
--    - "Assigned from Unassigned → John"
-- ============================================
