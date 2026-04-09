import { useCallback, useMemo, useEffect, memo } from 'react';
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

function StartEndNode({ data }: NodeProps<{ label: string; nodeType: string }>) {
  const isStart = data.nodeType === 'start';
  return (
    <div style={{
      background: isStart ? '#a6e3a1' : '#f38ba8',
      color: 'var(--bg)',
      borderRadius: '50%',
      width: 80,
      height: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    }}>
      {isStart ? <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8 }} /> : null}
      {data.label}
      {!isStart ? <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 8, height: 8 }} /> : null}
    </div>
  );
}

function ProcessNode({ data }: NodeProps<{ label: string }>) {
  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '2px solid var(--accent)',
      borderRadius: 6,
      padding: '10px 20px',
      minWidth: 120,
      textAlign: 'center',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 8, height: 8 }} />
      <div style={{ fontSize: 13, fontWeight: 500 }}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8 }} />
    </div>
  );
}

function DecisionNode({ data }: NodeProps<{ label: string }>) {
  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '2px solid var(--warning)',
      transform: 'rotate(45deg)',
      width: 80,
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0, width: 8, height: 8 }} />
      <div style={{ transform: 'rotate(-45deg)', fontSize: 11, fontWeight: 500, textAlign: 'center', padding: 4, maxWidth: 70, wordBreak: 'break-word' }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartEndNode,
  end: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
};

const NODE_COLORS: Record<string, string> = {
  start: '#a6e3a1',
  end: '#f38ba8',
  process: '#89b4fa',
  decision: '#f9e2af',
};

export default function FlowChartEditor() {
  const {
    flowNodes,
    flowEdges,
    addFlowNode,
    addFlowEdge,
    removeFlowNode,
    removeFlowEdge,
    updateFlowNode,
  } = useStore();

  const initialNodes: Node[] = useMemo(
    () =>
      flowNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        data: { label: n.label, nodeType: n.type },
      })),
    [flowNodes]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      flowEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label,
        style: { stroke: '#89b4fa', strokeWidth: 2 },
        labelStyle: { fill: '#cdd6f4', fontSize: 11 },
        labelBgStyle: { fill: '#313147', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#89b4fa',
          width: 16,
          height: 16,
        },
      })),
    [flowEdges]
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
      const edge = {
        id: generateId('fe'),
        sourceId: params.source,
        targetId: params.target,
        label: '',
      };
      addFlowEdge(edge);
      setEdges((eds) => addEdge({
        ...params,
        id: edge.id,
        style: { stroke: '#89b4fa', strokeWidth: 2 },
        animated: true,
      }, eds));
    },
    [addFlowEdge, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      updateFlowNode(node.id, { x: node.position.x, y: node.position.y });
    },
    [updateFlowNode]
  );

  const addNode = useCallback(
    (type: string) => {
      const id = generateId('fn');
      const label = type === 'start' ? 'Start' : type === 'end' ? 'End' : type === 'decision' ? 'Condition?' : `Step ${flowNodes.length + 1}`;
      addFlowNode({
        id,
        type,
        label,
        x: 200 + (flowNodes.length % 4) * 200,
        y: 100 + Math.floor(flowNodes.length / 4) * 150,
        width: type === 'decision' ? 80 : 140,
        height: type === 'decision' ? 80 : 60,
      });
    },
    [flowNodes, addFlowNode]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length > 0 && !confirm(`確定刪除 ${deleted.length} 個節點？`)) return;
      for (const n of deleted) {
        removeFlowNode(n.id);
      }
    },
    [removeFlowNode]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length > 0 && !confirm(`確定刪除 ${deleted.length} 條連線？`)) return;
      for (const e of deleted) {
        removeFlowEdge(e.id);
      }
    },
    [removeFlowEdge]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="er-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => addNode('start')}>+ Start</button>
        <button className="btn btn-primary btn-sm" onClick={() => addNode('process')}>+ Process</button>
        <button className="btn btn-primary btn-sm" onClick={() => addNode('decision')}>+ Decision</button>
        <button className="btn btn-primary btn-sm" onClick={() => addNode('end')}>+ End</button>
        <span className="er-toolbar-info">
          {flowNodes.length} nodes, {flowEdges.length} edges
        </span>
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
        snapToGrid
        snapGrid={[10, 10]}
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor={(node) => NODE_COLORS[node.type ?? 'process'] ?? 'var(--accent)'}
          maskColor="rgba(30, 30, 46, 0.8)"
          style={{ background: 'var(--bg-surface)' }}
        />
      </ReactFlow>
    </div>
  );
}
