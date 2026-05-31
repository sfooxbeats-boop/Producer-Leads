DROP TABLE IF EXISTS leads;

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'threads',
  username TEXT NOT NULL,
  post_text TEXT NOT NULL,
  post_url TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  email TEXT,
  match_tag TEXT,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON leads FOR SELECT USING (true);
CREATE POLICY "Service insert" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service upsert" ON leads FOR UPDATE USING (true);
