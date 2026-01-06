-- 004_add_public_ids.sql
-- public_id カラムを追加（entries と summaries）
-- 既存データには ULID形式の値を自動生成

-- Step 1: entries テーブルに public_id 追加
ALTER TABLE entries 
ADD COLUMN public_id VARCHAR(64) NULL UNIQUE AFTER id;

-- Step 2: 既存データに public_id を生成（仮の値）
-- 注意: Node.js側で ulid() を使って生成し直すことを推奨
UPDATE entries 
SET public_id = CONCAT('entry_', LPAD(id, 20, '0'))
WHERE public_id IS NULL;

-- Step 3: public_id を NOT NULL に変更
ALTER TABLE entries 
MODIFY COLUMN public_id VARCHAR(64) NOT NULL;

-- Step 4: summaries テーブルに public_id 追加
ALTER TABLE summaries 
ADD COLUMN public_id VARCHAR(64) NULL UNIQUE AFTER id;

-- Step 5: 既存データに public_id を生成（仮の値）
UPDATE summaries 
SET public_id = CONCAT('summary_', LPAD(id, 20, '0'))
WHERE public_id IS NULL;

-- Step 6: public_id を NOT NULL に変更
ALTER TABLE summaries 
MODIFY COLUMN public_id VARCHAR(64) NOT NULL;

-- インデックス確認（UNIQUE制約により自動作成されるが明示）
-- CREATE UNIQUE INDEX idx_entries_public_id ON entries(public_id);
-- CREATE UNIQUE INDEX idx_summaries_public_id ON summaries(public_id);
