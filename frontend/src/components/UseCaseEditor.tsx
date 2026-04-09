import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  Handle,
  Position,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore, generateId } from '../store/useStore';
import { memo } from 'react';

function ActorNodeComponent({ data }: NodeProps<{ actor: { id: string; name: string; type: string } }>) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '2px solid var(--accent)',
      borderRadius: 8,
      padding: '12px 16px',
      minWidth: 100,
      textAlign: 'center',
      cursor: 'pointer',
    }}>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} />
      <div style={{ fontSize: 24, marginBottom: 4 }}>&#x1F464;</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{data.actor.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.actor.type}</div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} />
    </div>
  );
}

function UseCaseNodeComponent({ data }: NodeProps<{ useCase: { id: string; name: string } }>) {
  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '2px solid var(--success)',
      borderRadius: '50%',
      width: 120,
      height: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      cursor: 'pointer',
    }}>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} />
      <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'center' }}>{data.useCase.name}</div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  actor: ActorNodeComponent,
  usecase: UseCaseNodeComponent,
};

const RELATION_COLORS: Record<string, string> = {
  Association: '#89b4fa',
  Include: '#a6e3a1',
  Extend: '#f9e2af',
  Generalization: '#f38ba8',
};

export default function UseCaseEditor() {
  const {
    useCaseActors,
    useCaseItems,
    useCaseRelations,
    addUseCaseActor,
    addUseCaseItem,
    addUseCaseRelation,
    removeUseCaseActor,
    removeUseCaseItem,
    removeUseCaseRelation,
    updateUseCaseActor,
    updateUseCaseItem,
    systemBoundary,
  } = useStore();

  const initialNodes: Node[] = useMemo(() => {
    const actorNodes: Node[] = useCaseActors.map((a) => ({
      id: a.id,
      type: 'actor',
      position: { x: a.x, y: a.y },
      data: { actor: a },
    }));
    const ucNodes: Node[] = useCaseItems.map((uc) => ({
      id: uc.id,
      type: 'usecase',
      position: { x: uc.x, y: uc.y },
      data: { useCase: uc },
    }));
    return [...actorNodes, ...ucNodes];
  }, [useCaseActors, useCaseItems]);

  const initialEdges: Edge[] = useMemo(
    () =>
      useCaseRelations.map((rel) => ({
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        label: rel.type,
        style: { stroke: RELATION_COLORS[rel.type] ?? '#89b4fa', strokeWidth: 2 },
        labelStyle: { fill: '#cdd6f4', fontSize: 11 },
        labelBgStyle: { fill: '#313147', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        animated: rel.type === 'Include' || rel.type === 'Extend',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: RELATION_COLORS[rel.type] ?? '#89b4fa',
          width: 16,
          height: 16,
        },
      })),
    [useCaseRelations]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const rel = {
        id: generateId('uc-rel'),
        sourceId: params.source,
        targetId: params.target,
        type: 'Association',
      };
      addUseCaseRelation(rel);
      setEdges((eds) => addEdge({
        ...params,
        id: rel.id,
        label: 'Association',
        style: { stroke: RELATION_COLORS.Association, strokeWidth: 2 },
        animated: true,
      }, eds));
    },
    [addUseCaseRelation, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      const actor = useCaseActors.find((a) => a.id === node.id);
      if (actor) {
        updateUseCaseActor(node.id, { x: node.position.x, y: node.position.y });
        return;
      }
      const uc = useCaseItems.find((u) => u.id === node.id);
      if (uc) {
        updateUseCaseItem(node.id, { x: node.position.x, y: node.position.y });
      }
    },
    [useCaseActors, useCaseItems, updateUseCaseActor, updateUseCaseItem]
  );

  const handleAddActor = useCallback(() => {
    const id = generateId('actor');
    addUseCaseActor({
      id,
      name: `Actor_${useCaseActors.length + 1}`,
      type: 'Primary',
      x: 30,
      y: 100 + useCaseActors.length * 120,
    });
  }, [useCaseActors, addUseCaseActor]);

  const handleAddUseCase = useCallback(() => {
    const id = generateId('uc');
    addUseCaseItem({
      id,
      name: `UseCase_${useCaseItems.length + 1}`,
      description: '',
      x: systemBoundary.x + 50 + (useCaseItems.length % 3) * 180,
      y: systemBoundary.y + 50 + Math.floor(useCaseItems.length / 3) * 120,
    });
  }, [useCaseItems, addUseCaseItem, systemBoundary]);

  const handleDeleteSelected = useCallback(
    (nodeId: string) => {
      if (useCaseActors.find((a) => a.id === nodeId)) {
        removeUseCaseActor(nodeId);
      } else if (useCaseItems.find((u) => u.id === nodeId)) {
        removeUseCaseItem(nodeId);
      }
    },
    [useCaseActors, useCaseItems, removeUseCaseActor, removeUseCaseItem]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      removeUseCaseRelation(edgeId);
    },
    [removeUseCaseRelation]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length > 0 && !confirm(`確定刪除 ${deleted.length} 個節點？`)) return;
      for (const n of deleted) {
        handleDeleteSelected(n.id);
      }
    },
    [handleDeleteSelected]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length > 0 && !confirm(`確定刪除 ${deleted.length} 條連線？`)) return;
      for (const e of deleted) {
        handleDeleteEdge(e.id);
      }
    },
    [handleDeleteEdge]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="er-toolbar">
        <button className="btn btn-primary btn-sm" onClick={handleAddActor}>+ Actor</button>
        <button className="btn btn-primary btn-sm" onClick={handleAddUseCase}>+ Use Case</button>
        <span className="er-toolbar-info">
          {useCaseActors.length} actors, {useCaseItems.length} use cases, {useCaseRelations.length} relations
        </span>
      </div>

      <div style={{
        position: 'absolute',
        left: systemBoundary.x,
        top: systemBoundary.y + 40,
        width: systemBoundary.width,
        height: systemBoundary.height,
        border: '2px dashed var(--border)',
        borderRadius: 8,
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: -24,
          left: 12,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-muted)',
          background: 'var(--bg)',
          padding: '0 8px',
        }}>
          {systemBoundary.name}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ zIndex: 1 }}
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor="var(--accent)"
          maskColor="rgba(30, 30, 46, 0.8)"
          style={{ background: 'var(--bg-surface)' }}
        />
      </ReactFlow>
    </div>
  );
}
