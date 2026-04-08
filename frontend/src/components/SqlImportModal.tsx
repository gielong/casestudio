import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { parseSqlDDL } from '../utils/sqlParser';

interface SqlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SqlImportModal({ isOpen, onClose }: SqlImportModalProps) {
  const [sql, setSql] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseSqlDDL> | null>(null);
  const [importResult, setImportResult] = useState<{ entities: number; relationships: number; errors: string[] } | null>(null);
  const importSqlDDL = useStore((s) => s.importSqlDDL);

  if (!isOpen) return null;

  const handlePreview = () => {
    if (!sql.trim()) return;
    const result = parseSqlDDL(sql);
    setPreview(result);
  };

  const handleImport = () => {
    if (!sql.trim()) return;
    const result = importSqlDDL(sql);
    setImportResult(result);
    if (result.entities > 0 && result.errors.length === 0) {
      setTimeout(() => {
        onClose();
        setSql('');
        setPreview(null);
        setImportResult(null);
      }, 1500);
    }
  };

  const handleClose = () => {
    onClose();
    setSql('');
    setPreview(null);
    setImportResult(null);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal sql-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>匯入 SQL DDL</h2>
          <button className="btn-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="help-text">
            貼上 SQL CREATE TABLE 語句，系统會自動解析並建立 ER 實體圖。
          </p>

          <textarea
            className="sql-input"
            value={sql}
            onChange={(e) => {
              setSql(e.target.value);
              setPreview(null);
              setImportResult(null);
            }}
            placeholder={`例如：\nCREATE TABLE Users (\n  Id INT PRIMARY KEY,\n  Name VARCHAR(100) NOT NULL,\n  Email VARCHAR(255) UNIQUE\n);\n\nCREATE TABLE Orders (\n  Id INT PRIMARY KEY,\n  UserId INT NOT NULL,\n  Total DECIMAL(10,2),\n  FOREIGN KEY (UserId) REFERENCES Users(Id)\n);`}
            rows={12}
          />

          <div className="button-row">
            <button className="btn-secondary" onClick={handlePreview} disabled={!sql.trim()}>
              預覽
            </button>
            <button className="btn-primary" onClick={handleImport} disabled={!sql.trim()}>
              匯入
            </button>
          </div>

          {preview && (
            <div className="preview-section">
              <h3>預覽結果</h3>
              <div className="preview-stats">
                <span className="stat">
                  <span className="stat-label">資料表：</span>
                  <span className="stat-value">{preview.tables.length}</span>
                </span>
                <span className="stat">
                  <span className="stat-label">關聯：</span>
                  <span className="stat-value">{preview.relationships.length}</span>
                </span>
              </div>

              {preview.tables.length > 0 && (
                <div className="preview-tables">
                  {preview.tables.map((table) => (
                    <div key={table.name} className="preview-table">
                      <div className="preview-table-name">{table.name}</div>
                      <div className="preview-columns">
                        {table.columns.map((col) => (
                          <div key={col.name} className="preview-column">
                            <span className={`col-name ${col.isPrimaryKey ? 'pk' : ''}`}>
                              {col.isPrimaryKey && '🔑 '}{col.name}
                            </span>
                            <span className="col-type">{col.dataType}
                              {col.length && `(${col.length})`}
                              {col.precision && `(${col.precision}${col.scale !== null ? `,${col.scale}` : ''})`}
                            </span>
                            {!col.isNullable && <span className="col-constraint">NOT NULL</span>}
                            {col.isForeignKey && <span className="col-constraint fk">→ {col.referencedTable}.{col.referencedField}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {preview.relationships.length > 0 && (
                <div className="preview-relations">
                  <h4>關聯</h4>
                  {preview.relationships.map((rel, i) => (
                    <div key={i} className="preview-relation">
                      {rel.sourceTable}.{rel.sourceColumn} → {rel.targetTable}.{rel.targetColumn}
                    </div>
                  ))}
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="preview-errors">
                  <h4>警告</h4>
                  {preview.errors.map((err, i) => (
                    <div key={i} className="error-item">{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importResult && (
            <div className={`import-result ${importResult.entities > 0 ? 'success' : 'error'}`}>
              {importResult.entities > 0 ? (
                <>
                  <span className="result-icon">✓</span>
                  <span>已匯入 {importResult.entities} 個資料表、{importResult.relationships} 個關聯</span>
                </>
              ) : (
                <>
                  <span className="result-icon">✗</span>
                  <span>匯入失敗</span>
                </>
              )}
              {importResult.errors.length > 0 && (
                <div className="result-errors">
                  {importResult.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sql-import-modal {
          width: 700px;
          max-width: 95vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        .modal-body {
          overflow-y: auto;
          flex: 1;
        }
        .help-text {
          color: var(--text-muted);
          font-size: 13px;
          margin-bottom: 12px;
        }
        .sql-input {
          width: 100%;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          padding: 12px;
          resize: vertical;
        }
        .sql-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .button-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          justify-content: flex-end;
        }
        .preview-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .preview-section h3 {
          font-size: 14px;
          margin-bottom: 12px;
          color: var(--text);
        }
        .preview-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }
        .stat {
          font-size: 13px;
        }
        .stat-label {
          color: var(--text-muted);
        }
        .stat-value {
          color: var(--accent);
          font-weight: 600;
        }
        .preview-tables {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .preview-table {
          background: var(--bg-surface);
          border-radius: 6px;
          padding: 10px;
        }
        .preview-table-name {
          font-weight: 600;
          font-size: 13px;
          color: var(--accent);
          margin-bottom: 8px;
        }
        .preview-columns {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .preview-column {
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .col-name {
          color: var(--text);
        }
        .col-name.pk {
          color: var(--warning);
        }
        .col-type {
          color: var(--text-muted);
          font-family: monospace;
        }
        .col-constraint {
          color: var(--error);
          font-size: 10px;
          background: rgba(243, 139, 168, 0.15);
          padding: 1px 4px;
          border-radius: 3px;
        }
        .col-constraint.fk {
          color: var(--accent);
          background: rgba(137, 180, 250, 0.15);
        }
        .preview-relations h4,
        .preview-errors h4 {
          font-size: 13px;
          margin-bottom: 8px;
          color: var(--text-muted);
        }
        .preview-relation {
          font-size: 12px;
          color: var(--text);
          margin-bottom: 4px;
          font-family: monospace;
        }
        .preview-errors {
          margin-top: 12px;
        }
        .error-item {
          color: var(--error);
          font-size: 12px;
          margin-bottom: 4px;
        }
        .import-result {
          margin-top: 16px;
          padding: 12px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .import-result.success {
          background: rgba(166, 227, 161, 0.15);
          color: var(--success);
        }
        .import-result.error {
          background: rgba(243, 139, 168, 0.15);
          color: var(--error);
        }
        .result-icon {
          font-size: 16px;
        }
        .result-errors {
          margin-top: 8px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
