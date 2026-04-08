import { useStore } from '../store/useStore';
import type { TableInfo } from '../api/client';

export default function SchemaViewer() {
  const { tables, selectedTable, setSelectedTable } = useStore();
  const activeTable: TableInfo | undefined = tables.find((t) => t.name === selectedTable);

  return (
    <div>
      <div className="section-title">Tables ({tables.length})</div>

      <ul className="table-list">
        {tables.map((table) => (
          <li
            key={table.name}
            className={`table-item ${selectedTable === table.name ? 'selected' : ''}`}
            onClick={() => setSelectedTable(selectedTable === table.name ? null : table.name)}
          >
            <span className="table-icon">T</span>
            <span>{table.schema !== 'dbo' ? `${table.schema}.` : ''}{table.name}</span>
            <span className="table-meta">{table.columns.length} cols</span>
          </li>
        ))}
      </ul>

      {activeTable && (
        <div className="detail-panel">
          <div className="detail-panel-header">{activeTable.name}</div>
          <div className="column-row" style={{ fontWeight: 600, background: 'var(--bg-input)' }}>
            <span>Name</span>
            <span>Type</span>
            <span>PK</span>
            <span>Null</span>
          </div>
          {activeTable.columns.map((col) => (
            <div key={col.name} className="column-row">
              <span className="col-name">
                {col.name}
                {activeTable.foreignKeys.some((fk) => fk.columnName === col.name) && (
                  <span className="badge badge-fk" style={{ marginLeft: 6 }}>FK</span>
                )}
              </span>
              <span className="col-type">{col.dataType}{col.maxLength ? `(${col.maxLength})` : ''}</span>
              <span>{col.isPrimaryKey ? <span className="badge badge-pk">PK</span> : ''}</span>
              <span>{col.isNullable ? <span className="badge badge-nullable">NULL</span> : ''}</span>
            </div>
          ))}
          {activeTable.foreignKeys.length > 0 && (
            <>
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Foreign Keys
              </div>
              {activeTable.foreignKeys.map((fk) => (
                <div key={fk.constraintName} className="column-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span className="col-name">{fk.columnName}</span>
                  <span className="col-type">→ {fk.referencedTable}.{fk.referencedColumn}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
