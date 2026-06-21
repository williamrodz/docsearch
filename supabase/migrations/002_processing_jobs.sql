-- Processing Jobs table for background/overnight processing
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  retry_failed BOOLEAN DEFAULT FALSE,
  total_images INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  batch_size INT DEFAULT 20,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_group ON processing_jobs(group_id);

-- Disable RLS for processing_jobs (internal table, not user-facing)
ALTER TABLE processing_jobs DISABLE ROW LEVEL SECURITY;

-- Add timestamp to images to detect stale processing
ALTER TABLE images ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
