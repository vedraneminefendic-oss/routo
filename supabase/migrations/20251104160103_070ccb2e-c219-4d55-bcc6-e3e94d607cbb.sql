-- Create table for regression test results
CREATE TABLE IF NOT EXISTS public.regression_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  scenario_description TEXT NOT NULL,
  expected_price_min NUMERIC NOT NULL,
  expected_price_max NUMERIC NOT NULL,
  actual_price NUMERIC NOT NULL,
  price_deviation_percent NUMERIC NOT NULL,
  passed BOOLEAN NOT NULL,
  test_output JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.regression_test_results ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert test results
CREATE POLICY "Service role can insert test results"
  ON public.regression_test_results
  FOR INSERT
  WITH CHECK (true);

-- Policy: Authenticated users can view test results
CREATE POLICY "Authenticated users can view test results"
  ON public.regression_test_results
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add index for faster queries
CREATE INDEX idx_regression_tests_created_at ON public.regression_test_results(created_at DESC);
CREATE INDEX idx_regression_tests_passed ON public.regression_test_results(passed);