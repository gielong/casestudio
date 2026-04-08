import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  type OnNodesChange,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore, generateId } from '../store/useStore';
import { saveToLocal, loadFromLocal, saveToFile, loadFromFile, createEmptyProject } from '../store/storage';
import { generateDDL, type DDLTarget } from '../store/ddl-generator';
import EntityNode from './EntityNode';
import FieldEditorModal from './FieldEditorModal';
import { SqlImportModal } from './SqlImportModal';
import type { ERField, ERRelationship, Cardinality } from '../api/client';

const nodeTypes: NodeTypes = { entity: EntityNode };

const CARDINALITY_LABELS: Record<string, string> = {
  ZeroOrOne: '0..1',
  One: '1',
  ZeroOrMany: '0..*',
  Many: '*',
};

function getCardinalityColor(card: string): string {
  switch (card) {
    case 'One': return '#a6e3a1';
    case 'ZeroOrOne': return '#89b4fa';
    case 'Many': return '#f38ba8';
    case 'ZeroOrMany': return '#f9e2af';
    default: return '#cdd6f4';
  }
}

export default function ERDiagramEditor() {
  const {
    erEntities,
    erRelationships,
    erHistoryIndex,
    erHistory,
    addErEntity,
    updateErEntity,
    addErRelationship,
    updateErRelationship,
    removeErRelationship,
    removeErEntity,
    addFieldToEntity,
    setSelectedEntityId,
    setRightPanel,
    setErEntities,
    setErRelationships,
    selectedEntityId,
    undo,
    redo,
    deleteSelectedEntity,
  } = useStore();

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingRel, setEditingRel] = useState<ERRelationship | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [sqlOutput, setSqlOutput] = useState<string>('');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [ddlTarget, setDdlTarget] = useState<DDLTarget>('mysql');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showSqlImportModal, setShowSqlImportModal] = useState(false);

  // Keyboard shortcuts for Undo/Redo/Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input fields
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+Z = Undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
      // Delete = Delete selected entity
      if (e.key === 'Delete' && selectedEntityId) {
        e.preventDefault();
        deleteSelectedEntity();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteSelectedEntity, selectedEntityId]);

  const canUndo = erHistoryIndex > 0;
  const canRedo = erHistoryIndex < erHistory.length - 1;

  const nodes: Node[] = useMemo(
    () =>
      erEntities.map((entity) => ({
        id: entity.id,
        type: 'entity',
        position: { x: entity.x, y: entity.y },
        data: { entity },
        selected: entity.id === selectedEntityId,
      })),
    [erEntities, selectedEntityId]
  );

  const edges: Edge[] = useMemo(
    () =>
      erRelationships.map((rel) => {
        const srcEntity = erEntities.find((e) => e.id === rel.sourceEntityId);
        const tgtEntity = erEntities.find((e) => e.id === rel.targetEntityId);
        const srcLabel = CARDINALITY_LABELS[rel.sourceCardinality] ?? rel.sourceCardinality;
        const tgtLabel = CARDINALITY_LABELS[rel.targetCardinality] ?? rel.targetCardinality;
        const srcColor = getCardinalityColor(rel.sourceCardinality);
        const tgtColor = getCardinalityColor(rel.targetCardinality);
        const isSelected = rel.id === selectedEdgeId;

        return {
          id: rel.id,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          label: rel.name || `${srcLabel} : ${tgtLabel}`,
          style: {
            stroke: isSelected ? '#f38ba8' : '#89b4fa',
            strokeWidth: isSelected ? 3 : 2,
          },
          labelStyle: { fill: '#cdd6f4', fontSize: 11 },
          labelBgStyle: { fill: isSelected ? '#45475a' : '#313147', fillOpacity: 0.9 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          animated: isSelected,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: tgtColor,
            width: 20,
            height: 20,
          },
          markerStart: {
            type: MarkerType.ArrowClosed,
            color: srcColor,
            width: 20,
            height: 20,
          },
        };
      }),
    [erRelationships, erEntities, selectedEdgeId]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && 'position' in change && change.position && change.id) {
          updateErEntity(change.id, {
            x: change.position.x,
            y: change.position.y,
          });
        }
      }
    },
    [updateErEntity]
  );

  // Auto-create FK in target entity when connecting
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const srcEntity = erEntities.find((e) => e.id === params.source);
      const tgtEntity = erEntities.find((e) => e.id === params.target);
      if (!srcEntity || !tgtEntity) return;

      // Find source PK field
      const srcPK = srcEntity.fields.find((f) => f.isPrimaryKey);
      if (!srcPK) return;

      // Check if target already has a FK referencing this source
      const existingFK = tgtEntity.fields.find(
        (f) => f.isForeignKey && f.referencedEntity === params.source
      );

      let fkFieldId: string;
      if (existingFK) {
        fkFieldId = existingFK.id;
      } else {
        // Auto-create FK field in target entity
        fkFieldId = generateId('field');
        const fkField: ERField = {
          id: fkFieldId,
          name: `${srcEntity.name.toLowerCase()}_${srcPK.name}`,
          dataType: srcPK.dataType,
          length: srcPK.length,
          precision: srcPK.precision,
          scale: srcPK.scale,
          isPrimaryKey: false,
          isForeignKey: true,
          isNullable: true,
          isUnique: false,
          hasDefault: false,
          defaultValue: '',
          referencedEntity: params.source,
          referencedField: srcPK.id,
          notes: `FK → ${srcEntity.name}.${srcPK.name}`,
        };
        addFieldToEntity(params.target, fkField);
      }

      // Create relationship
      const rel: ERRelationship = {
        id: generateId('rel'),
        name: '',
        sourceEntityId: params.source,
        targetEntityId: params.target,
        sourceFieldId: srcPK.id,
        targetFieldId: fkFieldId,
        sourceCardinality: 'One',
        targetCardinality: 'Many',
        sourceLabel: '',
        targetLabel: '',
      };
      addErRelationship(rel);
    },
    [erEntities, addErRelationship, addFieldToEntity]
  );

  // Handle edge click for selection
  const onEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
      const rel = erRelationships.find((r) => r.id === edge.id);
      if (rel) setEditingRel({ ...rel });
    },
    [erRelationships]
  );

  // Handle pane click to deselect
  const onPaneClick = useCallback(() => {
    setSelectedEntityId(null);
    setSelectedEdgeId(null);
    setEditingRel(null);
  }, [setSelectedEntityId]);

  // Single click = select entity (no editor open)
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setSelectedEntityId(node.id);
      setSelectedEdgeId(null);
      setEditingRel(null);
    },
    [setSelectedEntityId]
  );

  // Double click = open entity editor
  const onNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setSelectedEntityId(node.id);
      setEditingEntityId(node.id);
    },
    []
  );

  // Close entity editor
  const handleCloseEntityEditor = useCallback(() => {
    setEditingEntityId(null);
    setSelectedEntityId(null);
  }, []);

  // Delete selected relationship
  const handleDeleteRelationship = useCallback(() => {
    if (selectedEdgeId) {
      removeErRelationship(selectedEdgeId);
      setSelectedEdgeId(null);
      setEditingRel(null);
    }
  }, [selectedEdgeId, removeErRelationship]);

  // Save relationship edits
  const handleSaveRelationship = useCallback(() => {
    if (editingRel) {
      updateErRelationship(editingRel.id, {
        name: editingRel.name,
        sourceCardinality: editingRel.sourceCardinality,
        targetCardinality: editingRel.targetCardinality,
        sourceLabel: editingRel.sourceLabel,
        targetLabel: editingRel.targetLabel,
      });
      setEditingRel(null);
      setSelectedEdgeId(null);
    }
  }, [editingRel, updateErRelationship]);

  // Save diagram to localStorage
  const handleSave = useCallback(() => {
    setSaveStatus('儲存中...');
    const data = createEmptyProject('CaseTool Project');
    data.erEntities = erEntities;
    data.erRelationships = erRelationships;
    saveToLocal(data);
    setSaveStatus('✅ 已儲存到本地');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [erEntities, erRelationships]);

  // Export to file
  const handleExportFile = useCallback(async () => {
    const data = createEmptyProject('CaseTool Project');
    data.erEntities = erEntities;
    data.erRelationships = erRelationships;
    await saveToFile(data);
    setSaveStatus('✅ 已匯出檔案');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [erEntities, erRelationships]);

  // Import from file
  const handleImportFile = useCallback(async () => {
    const data = await loadFromFile();
    if (data) {
      // Load entities and relationships into store
      for (const entity of data.erEntities) {
        addErEntity(entity);
      }
      for (const rel of data.erRelationships) {
        addErRelationship(rel);
      }
      setSaveStatus('✅ 已匯入檔案');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [addErEntity, addErRelationship]);

  // Generate DDL SQL locally
  const handleExportSQL = useCallback(() => {
    const result = generateDDL(erEntities, ddlTarget);
    setSqlOutput(result.ddl);
    setShowSqlModal(true);
  }, [erEntities, ddlTarget]);

  // Copy SQL to clipboard
  const handleCopySQL = useCallback(() => {
    navigator.clipboard.writeText(sqlOutput);
    setSaveStatus('✅ 已複製');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [sqlOutput]);

  // Download SQL as file
  const handleDownloadSQL = useCallback(() => {
    const blob = new Blob([sqlOutput], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${ddlTarget}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sqlOutput, ddlTarget]);

  // Add new entity
  const handleAddEntity = useCallback(() => {
    const id = generateId('entity');
    const count = erEntities.length;
    const defaultField: ERField = {
      id: generateId('field'),
      name: 'id',
      dataType: 'INT',
      length: null,
      precision: null,
      scale: null,
      isPrimaryKey: true,
      isForeignKey: false,
      isNullable: false,
      isUnique: false,
      hasDefault: false,
      defaultValue: '',
      referencedEntity: '',
      referencedField: '',
      notes: '',
    };
    addErEntity({
      id,
      name: `Entity_${count + 1}`,
      notes: '',
      x: 100 + (count % 4) * 300,
      y: 100 + Math.floor(count / 4) * 250,
      fields: [defaultField],
    });
  }, [erEntities, addErEntity]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div className="er-toolbar">
          <button className="btn btn-primary btn-sm" onClick={handleAddEntity}>
            + 新增 Entity
          </button>
          <button className="btn btn-sm" onClick={() => setShowSqlImportModal(true)}>
            📥 匯入 SQL
          </button>
          <select
            className="ddl-target-select"
            value={ddlTarget}
            onChange={(e) => setDdlTarget(e.target.value as DDLTarget)}
          >
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
            <option value="sqlserver">MSSQL</option>
          </select>
          <button className="btn btn-sm" onClick={handleExportSQL}>
            📤 匯出 SQL
          </button>
          <button className="btn btn-sm" onClick={handleSave}>
            💾 儲存
          </button>
          <button className="btn btn-sm" onClick={handleExportFile}>
            📁 另存檔案
          </button>
          <button className="btn btn-sm" onClick={handleImportFile}>
            📂 開啟檔案
          </button>
          <button className="btn btn-sm" onClick={() => {
            if (confirm('確定開新專案？目前未儲存的內容將會消失。')) {
              setErEntities([]);
              setErRelationships([]);
            }
          }}>
            📄 新開專案
          </button>
          <button
            className="btn btn-sm"
            onClick={undo}
            disabled={!canUndo}
            title="復原 (Ctrl+Z)"
          >
            ↩️ 復原
          </button>
          <button
            className="btn btn-sm"
            onClick={redo}
            disabled={!canRedo}
            title="重作 (Ctrl+Y)"
          >
            ↪️ 重作
          </button>
          {selectedEntityId && (
            <button
              className="btn btn-danger btn-sm"
              onClick={deleteSelectedEntity}
              title="刪除選取 (Delete)"
            >
              🗑️ 刪除
            </button>
          )}
          {saveStatus && <span className="save-status">{saveStatus}</span>}
          <span className="er-toolbar-info">
            {erEntities.length} entities, {erRelationships.length} relationships
          </span>
        </div>

        {/* ReactFlow */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={['Backspace', 'Delete']}
          connectionLineStyle={{ stroke: '#89b4fa', strokeWidth: 2 }}
          snapToGrid
          snapGrid={[10, 10]}
          edgesFocusable={true}
          elementsSelectable={true}
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

      {/* Entity Editor Modal */}
      {editingEntityId && !editingRel && (
        <FieldEditorModal entityId={editingEntityId} onClose={handleCloseEntityEditor} />
      )}

      {/* Relationship Editor Panel */}
      {editingRel && (
        <div className="right-panel">
          <div className="right-panel-header">
            <span>Relationship 編輯</span>
            <button className="btn btn-xs" onClick={() => { setEditingRel(null); setSelectedEdgeId(null); }}>✕</button>
          </div>
          <div className="rel-editor">
            <div className="form-group">
              <label>名稱</label>
              <input
                value={editingRel.name}
                onChange={(e) => setEditingRel({ ...editingRel, name: e.target.value })}
                placeholder="Relationship 名稱"
              />
            </div>
            <div className="form-group">
              <label>來源基數</label>
              <select
                value={editingRel.sourceCardinality}
                onChange={(e) => setEditingRel({ ...editingRel, sourceCardinality: e.target.value as Cardinality })}
              >
                <option value="One">1 (One)</option>
                <option value="ZeroOrOne">0..1 (Zero or One)</option>
                <option value="Many">* (Many)</option>
                <option value="ZeroOrMany">0..* (Zero or Many)</option>
              </select>
            </div>
            <div className="form-group">
              <label>目標基數</label>
              <select
                value={editingRel.targetCardinality}
                onChange={(e) => setEditingRel({ ...editingRel, targetCardinality: e.target.value as Cardinality })}
              >
                <option value="One">1 (One)</option>
                <option value="ZeroOrOne">0..1 (Zero or One)</option>
                <option value="Many">* (Many)</option>
                <option value="ZeroOrMany">0..* (Zero or Many)</option>
              </select>
            </div>
            <div className="form-group">
              <label>來源標籤</label>
              <input
                value={editingRel.sourceLabel}
                onChange={(e) => setEditingRel({ ...editingRel, sourceLabel: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>目標標籤</label>
              <input
                value={editingRel.targetLabel}
                onChange={(e) => setEditingRel({ ...editingRel, targetLabel: e.target.value })}
              />
            </div>
            <div className="rel-editor-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSaveRelationship}>
                💾 儲存
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteRelationship}>
                🗑️ 刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Export Modal */}
      {showSqlModal && (
        <div className="sql-modal-overlay" onClick={() => setShowSqlModal(false)}>
          <div className="sql-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sql-modal-header">
              <span>📤 匯出 SQL — {ddlTarget.toUpperCase()}</span>
              <button className="btn btn-xs" onClick={() => setShowSqlModal(false)}>✕</button>
            </div>
            <pre className="sql-output">{sqlOutput}</pre>
            <div className="sql-modal-actions">
              <button className="btn btn-primary btn-sm" onClick={handleCopySQL}>
                📋 複製
              </button>
              <button className="btn btn-sm" onClick={handleDownloadSQL}>
                ⬇️ 下載 .sql
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Import Modal */}
      <SqlImportModal
        isOpen={showSqlImportModal}
        onClose={() => setShowSqlImportModal(false)}
      />
    </div>
  );
}

