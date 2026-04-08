import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import TableNode from './TableNode';

const nodeTypes: NodeTypes = { table: TableNode };

export default function DiagramEditor() {
  const { tables } = useStore();

  const nodes: Node[] = useMemo(
    () =>
      tables.map((table, i) => ({
        id: table.name,
        type: 'table',
        position: { x: 100 + (i % 4) * 280, y: 100 + Math.floor(i / 4) * 300 },
        data: { table },
      })),
    [tables]
  );

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        result.push({
          id: `${table.name}-${fk.columnName}-${fk.referencedTable}`,
          source: table.name,
          target: fk.referencedTable,
          sourceHandle: `col-${fk.columnName}`,
          targetHandle: `col-${fk.referencedColumn}`,
          animated: true,
          style: { stroke: '#f9e2af' },
        });
      }
    }
    return result;
  }, [tables]);

  const onNodesChange = useCallback(() => {}, []);

  if (tables.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">◇</div>
        <div>Connect to a database to view schema</div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      maxZoom={2}
    >
      <Background gap={20} size={1} color="var(--border)" />
      <Controls />
      <MiniMap
        nodeColor="var(--accent)"
        maskColor="rgba(30, 30, 46, 0.8)"
        style={{ background: 'var(--bg-surface)' }}
      />
    </ReactFlow>
  );
}
