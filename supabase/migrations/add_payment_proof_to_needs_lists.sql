-- Add payment_proof_url column to needs_lists table
-- This stores URLs of payment proof files (comma-separated), matching the orders pattern
ALTER TABLE needs_lists ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT NULL;
