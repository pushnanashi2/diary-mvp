/**
 * 文字起こし編集関連のSQLクエリ
 * Phase 4.1: 文字起こし手動編集機能
 */

/**
 * 編集履歴を保存
 */
export async function saveTranscriptEdit(pool, entryId, editedText, editedBy, editNote = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 現在のバージョンを取得
    const [entries] = await connection.query(
      'SELECT current_transcript_version FROM entries WHERE id=?',
      [entryId]
    );
    const currentVersion = entries[0]?.current_transcript_version || 0;
    const newVersion = currentVersion + 1;
    
    // 編集履歴を保存
    const [result] = await connection.query(
      `INSERT INTO transcript_edits (entry_id, edited_text, edited_by, version, edit_note)
       VALUES (?, ?, ?, ?, ?)`,
      [entryId, editedText, editedBy, newVersion, editNote]
    );
    
    // entries テーブルの transcript_text と current_transcript_version を更新
    await connection.query(
      'UPDATE entries SET transcript_text=?, current_transcript_version=? WHERE id=?',
      [editedText, newVersion, entryId]
    );
    
    await connection.commit();
    return { editId: result.insertId, version: newVersion };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 編集履歴を取得
 */
export async function getTranscriptHistory(pool, entryId) {
  const [rows] = await pool.query(
    `SELECT te.id, te.version, te.edited_text, te.edited_at, te.edit_note,
            u.email as edited_by_email
     FROM transcript_edits te
     JOIN users u ON te.edited_by = u.id
     WHERE te.entry_id = ?
     ORDER BY te.version DESC`,
    [entryId]
  );
  return rows;
}

/**
 * 特定バージョンの文字起こしを取得
 */
export async function getTranscriptVersion(pool, entryId, version) {
  if (version === 0) {
    // オリジナルバージョン（Whisper生成）を取得
    const [rows] = await pool.query(
      'SELECT transcript_text FROM entries WHERE id=?',
      [entryId]
    );
    return rows[0]?.transcript_text || null;
  }
  
  const [rows] = await pool.query(
    `SELECT edited_text, edited_at, edit_note
     FROM transcript_edits
     WHERE entry_id=? AND version=?`,
    [entryId, version]
  );
  return rows[0] || null;
}

/**
 * 最新の編集版に戻す
 */
export async function revertToVersion(pool, entryId, targetVersion) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    let transcriptText;
    if (targetVersion === 0) {
      // オリジナルに戻す場合は何もしない（既にentries.transcript_textに保存済み）
      const [rows] = await connection.query(
        'SELECT transcript_text FROM entries WHERE id=?',
        [entryId]
      );
      transcriptText = rows[0]?.transcript_text;
    } else {
      const [rows] = await connection.query(
        'SELECT edited_text FROM transcript_edits WHERE entry_id=? AND version=?',
        [entryId, targetVersion]
      );
      transcriptText = rows[0]?.edited_text;
    }
    
    if (!transcriptText) {
      throw new Error('TRANSCRIPT_VERSION_NOT_FOUND');
    }
    
    await connection.query(
      'UPDATE entries SET transcript_text=?, current_transcript_version=? WHERE id=?',
      [transcriptText, targetVersion, entryId]
    );
    
    await connection.commit();
    return { version: targetVersion };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
