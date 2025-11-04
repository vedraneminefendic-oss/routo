-- ============================================
-- FAS 6: GOLDEN TESTS - Regression Testing
-- ============================================

-- Create golden_tests table if not exists
CREATE TABLE IF NOT EXISTS golden_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  scenario_description TEXT NOT NULL,
  input_data JSONB NOT NULL,
  expected_price_min INTEGER NOT NULL,
  expected_price_max INTEGER NOT NULL,
  expected_hours_min INTEGER,
  expected_hours_max INTEGER,
  run_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE golden_tests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view golden tests
CREATE POLICY "Anyone can view golden tests" ON golden_tests
  FOR SELECT USING (true);

-- Policy: Service role can manage golden tests
CREATE POLICY "Service role can manage golden tests" ON golden_tests
  FOR ALL USING (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_golden_tests_job_type ON golden_tests(job_type);
CREATE INDEX IF NOT EXISTS idx_golden_tests_last_run ON golden_tests(last_run_at);