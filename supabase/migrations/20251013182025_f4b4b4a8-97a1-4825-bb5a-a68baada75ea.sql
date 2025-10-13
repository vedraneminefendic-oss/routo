-- Create equipment_rates table
CREATE TABLE public.equipment_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  price_per_day INTEGER,
  price_per_hour INTEGER,
  is_rented BOOLEAN NOT NULL DEFAULT false,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_rates ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own equipment
CREATE POLICY "Users can manage own equipment"
ON public.equipment_rates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_equipment_rates_updated_at
BEFORE UPDATE ON public.equipment_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add detail_level column to quotes table
ALTER TABLE public.quotes
ADD COLUMN detail_level TEXT DEFAULT 'standard';