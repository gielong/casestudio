import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { TableInfo } from '../api/client';

interface TableNodeData {
  table: TableInfo;
}

function TableNode({ data }: NodeProps<TableNodeData>) {
  const { table } = data;

  return (
    <div className="table-node">
      <div className="table-node-header">{table.name}</div>
      <div className="table-node-columns">
        {table.columns.map((col) => (
          <div key={col.name} className="table-node-col">
            <Handle
              type="source"
              position={Position.Left}
              id={`col-${col.name}`}
              style={{ opacity: 0, width: 6, height: 6 }}
            />
            <Handle
              type="target"
              position={Position.Right}
              id={`col-${col.name}`}
              style={{ opacity: 0, width: 6, height: 6 }}
            />
            <span style={{ color: col.isPrimaryKey ? 'var(--accent)' : undefined }}>
              {col.isPrimaryKey ? 'PK ' : ''}
              {table.foreignKeys.some((fk) => fk.columnName === col.name) ? 'FK ' : ''}
            </span>
            <span className="col-name">{col.name}</span>
            <span className="col-type">{col.dataType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
