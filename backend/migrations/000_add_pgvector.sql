-- Studyield Database Schema
-- Add pgvector extension and vector/full-text search columns to kb_chunks

-- Enable pgvector extension (requires PostgreSQL with pgvector installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (OpenAI text-embedding-3-small = 1536 dims)
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding
  ON kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Generated tsvector column for full-text search
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_kb_chunks_fts ON kb_chunks USING gin(content_tsv);
