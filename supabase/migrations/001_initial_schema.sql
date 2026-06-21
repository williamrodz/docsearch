-- DocSearch Initial Schema
-- Historical document analysis platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (no passwords, just identification)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Image groups/collections
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Individual images
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,

  -- Extracted data
  raw_text TEXT,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  alternatives JSONB, -- Array of {text: string, confidence: number} for uncertain passages
  event_date DATE,
  event_date_raw TEXT, -- Original text of date
  event_date_confidence FLOAT CHECK (event_date_confidence >= 0 AND event_date_confidence <= 1),

  UNIQUE(group_id, filename)
);

-- People mentioned in images
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL, -- Lowercase, accents removed for matching
  role TEXT CHECK (role IN ('baptized', 'parent', 'godparent', 'priest', 'witness', 'spouse', 'deceased', 'other')),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  alternatives JSONB, -- [{name: string, confidence: number}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical people (for grouping similar names across a group)
CREATE TABLE canonical_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  variant_names TEXT[] DEFAULT '{}', -- All spelling variations
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link people to canonical records
CREATE TABLE people_canonical_link (
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  canonical_id UUID NOT NULL REFERENCES canonical_people(id) ON DELETE CASCADE,
  match_score FLOAT CHECK (match_score >= 0 AND match_score <= 1),
  PRIMARY KEY (person_id, canonical_id)
);

-- Inspection records
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- User's last viewed position per group
CREATE TABLE user_group_position (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  last_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- Indexes for performance
CREATE INDEX idx_images_group ON images(group_id);
CREATE INDEX idx_images_processing ON images(processing_status);
CREATE INDEX idx_images_sort ON images(group_id, sort_order);
CREATE INDEX idx_people_image ON people(image_id);
CREATE INDEX idx_people_normalized ON people(name_normalized);
CREATE INDEX idx_inspections_image ON inspections(image_id);
CREATE INDEX idx_inspections_user ON inspections(user_id);
CREATE INDEX idx_canonical_group ON canonical_people(group_id);
CREATE INDEX idx_user_position ON user_group_position(user_id, group_id);

-- Full-text search index for raw_text
CREATE INDEX idx_images_text_search ON images USING gin(to_tsvector('spanish', COALESCE(raw_text, '')));

-- Function to update user_group_position automatically
CREATE OR REPLACE FUNCTION update_user_position()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_group_position (user_id, group_id, last_image_id, updated_at)
  SELECT
    NEW.user_id,
    i.group_id,
    NEW.image_id,
    NOW()
  FROM images i
  WHERE i.id = NEW.image_id
  ON CONFLICT (user_id, group_id)
  DO UPDATE SET
    last_image_id = EXCLUDED.last_image_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update position on inspection
CREATE TRIGGER trigger_update_user_position
AFTER INSERT ON inspections
FOR EACH ROW
EXECUTE FUNCTION update_user_position();

-- RLS Policies (permissive for now since no auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_canonical_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_position ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on images" ON images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on people" ON people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on canonical_people" ON canonical_people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on people_canonical_link" ON people_canonical_link FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inspections" ON inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_group_position" ON user_group_position FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for images (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('document-images', 'document-images', true);
