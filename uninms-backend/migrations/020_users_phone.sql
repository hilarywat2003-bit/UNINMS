-- Migration 020: add phone number field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
