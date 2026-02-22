import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'visibility.db');
const db = new Database(dbPath);

// Initialize schema with hardening
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    domain TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    intent TEXT NOT NULL,
    locale TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    version TEXT NOT NULL,
    expected_brand_presence BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    previous_analysis_id TEXT,
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    results_json TEXT,
    metrics_json TEXT,
    recommendations_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(previous_analysis_id) REFERENCES analysis_runs(id)
  );

  CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_alive BOOLEAN,
    mentions_brand BOOLEAN,
    verified_at DATETIME,
    FOREIGN KEY(analysis_id) REFERENCES analysis_runs(id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_runs(project_id);
  CREATE INDEX IF NOT EXISTS idx_analysis_status ON analysis_runs(status);
  CREATE INDEX IF NOT EXISTS idx_citations_analysis ON citations(analysis_id);
  CREATE INDEX IF NOT EXISTS idx_prompts_intent ON prompts(intent);
`);

export default db;
