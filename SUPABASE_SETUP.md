# Supabase Lead Capture Database Setup
This file contains the configuration for our Supabase backend database, designed for capturing patient checklists and coordinates in marketing campaigns.

## Supabase Table creation script:
Run this query in your Supabase SQL Editor:

```sql
-- Create leads storage table
create table leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  mobile_number text not null,
  email text,
  mrn numeric, -- Medical Record Number
  selected_items_count integer default 0,
  selected_items text[], -- Saves the product identifiers selected
  stage text, -- Current stage ID the lead was interested in
  language text, -- Language selection ("en" or "ar")
  city text default 'Riyadh' -- Approximate City
);

-- Turn off Row Level Security (RLS) for public presentation/submission
-- If you need RLS enabled, ensure you write a policy allows public inserts.
alter table leads disable row level security;
```

## Setup Environment Variables
Create a file named `.env` in the root of your project:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```
