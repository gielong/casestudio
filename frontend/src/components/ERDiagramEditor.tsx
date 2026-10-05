import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  MarkerType,
  useReactFlow,
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
import { pickAndParseDM2 } from '../store/dm2-parser';
import { validateERModel } from '../store/model-validator';
import { generateAIContextMarkdown, generateAIContextJSON, type AIContextScope, type AIContextDepth } from '../store/ai-context-generator';
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
    erSubmodels,
    activeSubmodelId,
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
    setErSubmodels,
    setActiveSubmodelId,
    addErSubmodel,
    updateErSubmodel,
    removeErSubmodel,
    toggleEntityInSubmodel,
    setSubmodelEntityPosition,
  } = useStore();

  const { project, fitView, setCenter } = useReactFlow();

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingRel, setEditingRel] = useState<ERRelationship | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [sqlOutput, setSqlOutput] = useState<string>('');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [ddlTarget, setDdlTarget] = useState<DDLTarget>('sqlserver');
  const [exportEntityIds, setExportEntityIds] = useState<string[]>([]);
  const [exportModelId, setExportModelId] = useState<string>('main');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showSqlImportModal, setShowSqlImportModal] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showSubmodelManager, setShowSubmodelManager] = useState(false);
  const [dm2Report, setDm2Report] = useState<string | null>(null);
  const [pendingDm2, setPendingDm2] = useState<Awaited<ReturnType<typeof pickAndParseDM2>>>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [aiContextOpen, setAIContextOpen] = useState(false);
  const [aiContextScope, setAIContextScope] = useState<AIContextScope>('all');
  const [aiContextFormat, setAIContextFormat] = useState<'markdown'|'compact'|'json'>('markdown');
  const [aiContextDepth, setAIContextDepth] = useState<AIContextDepth>(1);
  const validationIssues = useMemo(() => validateERModel(erEntities, erRelationships), [erEntities, erRelationships]);

  const activeSubmodel = useMemo(
    () => erSubmodels.find((m) => m.id === activeSubmodelId) ?? null,
    [erSubmodels, activeSubmodelId]
  );
  const aiContext = useMemo(() => {
    const options = { scope: aiContextScope, selectedEntityId, activeSubmodel, depth: aiContextDepth, compact: aiContextFormat === 'compact' };
    return aiContextFormat === 'json' ? generateAIContextJSON(erEntities, erRelationships, options) : generateAIContextMarkdown(erEntities, erRelationships, options);
  }, [aiContextScope, aiContextFormat, aiContextDepth, erEntities, erRelationships, selectedEntityId, activeSubmodel]);
  const visibleEntityIds = useMemo(
    () => activeSubmodel ? new Set(activeSubmodel.entityIds) : null,
    [activeSubmodel]
  );
  const visibleEntities = useMemo(
    () => visibleEntityIds ? erEntities.filter((e) => visibleEntityIds.has(e.id)) : erEntities,
    [erEntities, visibleEntityIds]
  );
  const visibleRelationships = useMemo(
    () => visibleEntityIds
      ? erRelationships.filter((r) => visibleEntityIds.has(r.sourceEntityId) && visibleEntityIds.has(r.targetEntityId))
      : erRelationships,
    [erRelationships, visibleEntityIds]
  );

  // Box selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);

  // Calculate selection box
  const selectionBox = isSelecting ? {
    x: Math.min(selectionStart.x, selectionEnd.x),
    y: Math.min(selectionStart.y, selectionEnd.y),
    width: Math.abs(selectionEnd.x - selectionStart.x),
    height: Math.abs(selectionEnd.y - selectionStart.y),
  } : null;

  // Check if a node is within selection box
  const isNodeInSelectionBox = useCallback((node: Node) => {
    if (!selectionBox) return false;
    const nodeWidth = 220; // approximate entity width
    const nodeHeight = 40 + node.data.entity.fields.length * 30; // header + fields
    return (
      node.position.x < selectionBox.x + selectionBox.width &&
      node.position.x + nodeWidth > selectionBox.x &&
      node.position.y < selectionBox.y + selectionBox.height &&
      node.position.y + nodeHeight > selectionBox.y
    );
  }, [selectionBox]);

  // Handle mouse down on pane (start box selection)
  const onPaneMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    // Don't start selection if clicking on a node
    if (target.closest('.react-flow__node')) return;

    const flowPos = project({ x: e.clientX, y: e.clientY });
    setIsSelecting(true);
    setSelectionStart({ x: flowPos.x, y: flowPos.y });
    setSelectionEnd({ x: flowPos.x, y: flowPos.y });
    setMultiSelectedIds([]);
  }, [project]);

  // Handle mouse move (update selection box)
  const onPaneMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    const flowPos = project({ x: e.clientX, y: e.clientY });
    setSelectionEnd({ x: flowPos.x, y: flowPos.y });
  }, [isSelecting, project]);

  // Handle mouse up (complete selection)
  const onPaneMouseUp = useCallback(() => {
    if (!isSelecting || !selectionBox) {
      setIsSelecting(false);
      return;
    }

    // Find all nodes within selection box
    const selectedIds = nodes
      .filter(node => isNodeInSelectionBox(node))
      .map(node => node.id);

    if (selectedIds.length > 0) {
      setMultiSelectedIds(selectedIds);
      // Also set the first one as the primary selected entity
      setSelectedEntityId(selectedIds[0]);
    }

    setIsSelecting(false);
  }, [isSelecting, selectionBox, isNodeInSelectionBox, setSelectedEntityId]);

  // Keyboard shortcuts for Undo/Redo/Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input fields or inside modals
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('.modal')) {
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
      visibleEntities.map((entity) => ({
        id: entity.id,
        type: 'entity',
        position: activeSubmodel?.layout[entity.id] ?? { x: entity.x, y: entity.y },
        data: { entity },
        selected: entity.id === selectedEntityId,
      })),
    [visibleEntities, activeSubmodel, selectedEntityId]
  );

  const handleEntityListClick = useCallback((entityId: string) => {
    const entity = visibleEntities.find(e => e.id === entityId);
    if (!entity) return;
    const pos = activeSubmodel?.layout[entity.id] ?? { x: entity.x, y: entity.y };
    setSelectedEntityId(entity.id);
    setMultiSelectedIds([entity.id]);
    // Entity nodes are ~390px wide; center on the node rather than its top-left corner.
    setCenter(pos.x + 195, pos.y + 80, { zoom: 1.15, duration: 350 });
  }, [visibleEntities, activeSubmodel, setSelectedEntityId, setCenter]);

  const edges: Edge[] = useMemo(
    () =>
      visibleRelationships.map((rel) => {
        const srcEntity = erEntities.find((e) => e.id === rel.sourceEntityId);
        const tgtEntity = erEntities.find((e) => e.id === rel.targetEntityId);
        const srcLabel = CARDINALITY_LABELS[rel.sourceCardinality] ?? rel.sourceCardinality;
        const tgtLabel = CARDINALITY_LABELS[rel.targetCardinality] ?? rel.targetCardinality;
        const srcColor = getCardinalityColor(rel.sourceCardinality);
        const tgtColor = getCardinalityColor(rel.targetCardinality);
        const isSelected = rel.id === selectedEdgeId;
        const isInformative = rel.type === 'informative';

        return {
          id: rel.id,
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          label: rel.name || (isInformative ? 'Informative' : `${srcLabel} : ${tgtLabel}`),
          style: {
            stroke: isSelected ? '#f38ba8' : (isInformative ? '#a6adc8' : '#89b4fa'),
            strokeWidth: isSelected ? 5 : 4,
            strokeDasharray: isInformative ? '10 7' : undefined,
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
    [visibleRelationships, erEntities, selectedEdgeId]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && 'position' in change && change.position && change.id) {
          // If this node is part of multi-selection, move all selected nodes by the same delta
          if (multiSelectedIds.includes(change.id) && change.dragging === false) {
            // This is the final position after drag
            const delta = change.position;
            // Find the original position of this node from erEntities
            const nodeEntity = erEntities.find(e => e.id === change.id);
            if (nodeEntity) {
              const newX = change.position.x;
              const newY = change.position.y;
              if (activeSubmodelId) setSubmodelEntityPosition(activeSubmodelId, change.id, newX, newY);
              else updateErEntity(change.id, { x: newX, y: newY });
            }
          } else {
            if (activeSubmodelId) {
              setSubmodelEntityPosition(activeSubmodelId, change.id, change.position.x, change.position.y);
            } else {
              updateErEntity(change.id, {
                x: change.position.x,
                y: change.position.y,
              });
            }
          }
        }
      }
    },
    [updateErEntity, setSubmodelEntityPosition, activeSubmodelId, multiSelectedIds, erEntities]
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
        type: 'foreignKey',
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
    data.erSubmodels = erSubmodels;
    saveToLocal(data);
    setSaveStatus('✅ 已儲存到本地');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [erEntities, erRelationships, erSubmodels]);

  // Export to file
  const handleExportFile = useCallback(async () => {
    const data = createEmptyProject('CaseTool Project');
    data.erEntities = erEntities;
    data.erRelationships = erRelationships;
    data.erSubmodels = erSubmodels;
    await saveToFile(data);
    setSaveStatus('✅ 已匯出檔案');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [erEntities, erRelationships, erSubmodels]);

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
      setErSubmodels(data.erSubmodels ?? []);
      setSaveStatus('✅ 已匯入檔案');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [addErEntity, addErRelationship, setErSubmodels]);

  // Import legacy CASE Studio 2 DM2 / ~m2 locally in the browser
  const handleImportDM2 = useCallback(async () => {
    try {
      const picked = await pickAndParseDM2();
      if (!picked) return;
      const { fileName, result } = picked;
      const fieldCount = result.entities.reduce((sum, entity) => sum + entity.fields.length, 0);
      const report = [
        `檔案解析報告：${fileName}`,
        '',
        `Entity：${result.entities.length}`,
        `Field：${fieldCount}`,
        `Relationship：${result.relationships.length}`,
        `Submodel：${result.submodels.length}`,
        '',
        result.warnings.length ? '警告 / 尚未完全解析：' : '警告：無',
        ...result.warnings.map((warning) => `- ${warning}`),
      ].join('\n');
      setPendingDm2(picked);
      setDm2Report(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPendingDm2(null);
      setDm2Report(`檔案匯入失敗\n\n${message}`);
    }
  }, []);

  const handleConfirmDM2Import = useCallback(() => {
    if (!pendingDm2) return;
    const { result } = pendingDm2;
    const fieldCount = result.entities.reduce((sum, entity) => sum + entity.fields.length, 0);
    result.entities.forEach(addErEntity);
    result.relationships.forEach(addErRelationship);
    setErSubmodels(result.submodels);
    setSaveStatus(`✅ 已匯入：${result.entities.length} Entity / ${fieldCount} Field / ${result.relationships.length} Relationship`);
    setPendingDm2(null);
    setDm2Report(null);
    // Imported models can contain entities far outside the current viewport (for example
    // cUseLimit in WEBERP(2)); refit after Zustand/React Flow has rendered the new nodes.
    setTimeout(() => fitView({ padding: 0.08, duration: 300 }), 80);
    setTimeout(() => setSaveStatus(''), 5000);
  }, [pendingDm2, addErEntity, addErRelationship, setErSubmodels, fitView]);

  const handleCopyDM2Report = useCallback(async () => {
    if (!dm2Report) return;
    await navigator.clipboard.writeText(dm2Report);
    setSaveStatus('✅ 解析報告已複製');
    setTimeout(() => setSaveStatus(''), 2500);
  }, [dm2Report]);

  // Generate DDL SQL locally
  const getExportEntities = useCallback((modelId: string) => {
    if (modelId === 'main') return erEntities;
    const model = erSubmodels.find(sm => sm.id === modelId);
    if (!model) return [];
    const ids = new Set(model.entityIds);
    return erEntities.filter(entity => ids.has(entity.id));
  }, [erEntities, erSubmodels]);

  const handleExportSQL = useCallback(() => {
    const modelId = activeSubmodelId || 'main';
    const candidates = getExportEntities(modelId).sort((a,b) => a.name.localeCompare(b.name));
    const ids = candidates.map(entity => entity.id);
    setExportModelId(modelId);
    setExportEntityIds(ids);
    setSqlOutput(generateDDL(candidates, ddlTarget).ddl);
    setShowSqlModal(true);
  }, [activeSubmodelId, getExportEntities, ddlTarget]);

  const updateExportSelection = useCallback((ids: string[], target = ddlTarget) => {
    setExportEntityIds(ids);
    const selected = getExportEntities(exportModelId).filter(entity => ids.includes(entity.id));
    setSqlOutput(selected.length ? generateDDL(selected, target).ddl : '-- 請至少選擇一個 Entity --');
  }, [getExportEntities, exportModelId, ddlTarget]);

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
    if (activeSubmodelId) toggleEntityInSubmodel(activeSubmodelId, id);
  }, [erEntities, addErEntity, activeSubmodelId, toggleEntityInSubmodel]);

  const handleCreateSubmodel = useCallback(() => {
    const name = window.prompt('Submodel 名稱，例如：雲端資料庫');
    if (!name?.trim()) return;
    const id = generateId('submodel');
    addErSubmodel({
      id,
      name: name.trim(),
      description: '',
      backgroundColor: '#1e1e2e',
      entityIds: [],
      layout: {},
    });
    setShowSubmodelManager(true);
  }, [addErSubmodel]);

  const handleRenameSubmodel = useCallback(() => {
    if (!activeSubmodel) return;
    const name = window.prompt('Submodel 名稱', activeSubmodel.name);
    if (name?.trim()) updateErSubmodel(activeSubmodel.id, { name: name.trim() });
  }, [activeSubmodel, updateErSubmodel]);

  const handleDeleteSubmodel = useCallback(() => {
    if (!activeSubmodel) return;
    if (window.confirm(`刪除 Submodel「${activeSubmodel.name}」？Entity 本身不會被刪除。`)) {
      removeErSubmodel(activeSubmodel.id);
      setShowSubmodelManager(false);
    }
  }, [activeSubmodel, removeErSubmodel]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', minHeight: 0 }}>
      <aside className="er-entity-sidebar">
        <div className="er-entity-sidebar-title">Entities</div>
        <div className="er-entity-sidebar-list">
          {visibleEntities.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(entity => (
            <button key={entity.id} type="button" className={entity.id===selectedEntityId?'active':''} onClick={()=>handleEntityListClick(entity.id)} title={entity.name}>
              {entity.name}
            </button>
          ))}
        </div>
      </aside>
      <div style={{ flex: 1, position: 'relative', background: activeSubmodel?.backgroundColor ?? 'var(--bg-base)' }}>
        {/* Toolbar */}
        <div className="er-toolbar">
          <div className="submodel-menu">
            <button className="submodel-menu-trigger" type="button">
              <span>{activeSubmodel ? activeSubmodel.name : '🌐 全部模型'}</span>
              <span className="submodel-menu-caret">▼</span>
            </button>
            <div className="submodel-menu-dropdown">
              <button type="button" className={!activeSubmodelId ? 'active' : ''} onClick={() => setActiveSubmodelId(null)}>
                🌐 全部模型
              </button>
              <div className="submodel-menu-divider" />
              {erSubmodels.map((m) => (
                <button key={m.id} type="button" className={activeSubmodelId === m.id ? 'active' : ''} onClick={() => setActiveSubmodelId(m.id)}>
                  📁 {m.name}
                </button>
              ))}
              {erSubmodels.length > 0 && <div className="submodel-menu-divider" />}
              <button type="button" onClick={handleCreateSubmodel}>＋ 新增 Submodel</button>
              <button type="button" disabled={!activeSubmodel} onClick={() => activeSubmodel && setShowSubmodelManager(true)}>
                ⚙ 管理 Submodel
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAddEntity}>
            + 新增 Entity
          </button>
          <div className="submodel-menu-wrap">
            <button className="btn btn-sm" onClick={() => setShowImportMenu(v => !v)} title="匯入專案、模型或 SQL DDL">
              📥 匯入 ▾
            </button>
            {showImportMenu && <div className="submodel-menu">
              <button type="button" onClick={() => { setShowImportMenu(false); handleImportFile(); }}>📁 專案檔案</button>
              <button type="button" onClick={() => { setShowImportMenu(false); setShowSqlImportModal(true); }}>🧾 SQL DDL</button>
              <button type="button" onClick={() => { setShowImportMenu(false); handleImportDM2(); }}>📦 其他模型檔案</button>
            </div>}
          </div>
          <button className="btn btn-sm" onClick={handleExportSQL}>
            📤 匯出 SQL
          </button>
          <button className="btn btn-sm" onClick={() => setAIContextOpen(true)} title="輸出適合 LLM / Coding Agent 理解的資料庫結構">🤖 AI Context</button>
          <button className="btn btn-sm" onClick={() => setValidationOpen(true)} title="檢查 PK、FK、型別、重複名稱、Index 與 Alternate Key">
            🩺 模型檢查 {validationIssues.length ? `(${validationIssues.length})` : '✓'}
          </button>
          <button className="btn btn-sm" onClick={handleSave}>
            💾 儲存
          </button>
          <button className="btn btn-sm" onClick={handleExportFile}>
            📁 另存檔案
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
            {visibleEntities.length} entities, {visibleRelationships.length} relationships
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
          onMouseDown={onPaneMouseDown}
          onMouseMove={onPaneMouseMove}
          onMouseUp={onPaneMouseUp}
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
          selectionOnDrag
          selectNodesOnDrag={false}
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls />
          <MiniMap
            nodeColor="var(--accent)"
            maskColor="rgba(30, 30, 46, 0.8)"
            style={{ background: 'var(--bg-surface)' }}
          />
          {/* Selection Box Overlay */}
          {selectionBox && (
            <div
              className="selection-box"
              style={{
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y),
              }}
            />
          )}
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
            <span>{editingRel.type === 'informative' ? 'Informative Relationship 編輯' : 'Relationship 編輯'}</span>
            <button className="btn btn-xs" onClick={() => { setEditingRel(null); setSelectedEdgeId(null); }}>✕</button>
          </div>
          <div className="rel-editor">
            {editingRel.type === 'informative' && <div className="submodel-hint">ℹ️ Informative Relationship：僅表示兩個 Entity 有關聯，不建立 FK，也不產生 Foreign Key SQL。</div>}
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

      {showSubmodelManager && activeSubmodel && (
        <div className="modal-overlay" onClick={() => setShowSubmodelManager(false)}>
          <div className="modal submodel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Submodel：{activeSubmodel.name}</span>
              <button className="btn btn-xs" onClick={() => setShowSubmodelManager(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="submodel-actions">
                <button className="btn btn-sm" onClick={handleRenameSubmodel}>✏️ 重新命名</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSubmodel}>🗑️ 刪除 Submodel</button>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>🎨 背景顏色</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={activeSubmodel.backgroundColor ?? '#1e1e2e'}
                    onChange={(e) => updateErSubmodel(activeSubmodel.id, { backgroundColor: e.target.value })}
                    style={{ width: 54, height: 34, padding: 2 }}
                  />
                  <code>{activeSubmodel.backgroundColor ?? '#1e1e2e'}</code>
                </div>
              </div>
              <p className="submodel-hint">勾選要顯示在此 Submodel 的 Entity。同一個 Entity 可以同時屬於多個 Submodel。</p>
              <div className="submodel-entity-list">
                {erEntities.map((entity) => (
                  <label key={entity.id} className="submodel-entity-item">
                    <input
                      type="checkbox"
                      checked={activeSubmodel.entityIds.includes(entity.id)}
                      onChange={() => toggleEntityInSubmodel(activeSubmodel.id, entity.id)}
                    />
                    <span>{entity.name}</span>
                  </label>
                ))}
                {erEntities.length === 0 && <div className="req-empty">目前沒有 Entity</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {dm2Report && (
        <div className="modal-overlay" onClick={() => { setDm2Report(null); setPendingDm2(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 92vw)' }}>
            <div className="modal-header">
              <span>📥 檔案解析報告</span>
              <button className="btn btn-xs" onClick={() => { setDm2Report(null); setPendingDm2(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <textarea
                readOnly
                value={dm2Report}
                onFocus={(e) => e.currentTarget.select()}
                style={{ width: '100%', minHeight: 300, resize: 'vertical', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-sm" onClick={handleCopyDM2Report}>📋 複製報告</button>
                <button className="btn btn-sm" onClick={() => { setDm2Report(null); setPendingDm2(null); }}>取消</button>
                {pendingDm2 && <button className="btn btn-primary btn-sm" onClick={handleConfirmDM2Import}>✅ 確定匯入</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {aiContextOpen && (
        <div className="modal-overlay" onClick={() => setAIContextOpen(false)}>
          <div className="modal ai-context-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span>🤖 AI Database Context</span><button className="btn btn-xs" onClick={() => setAIContextOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="ai-context-options">
                <label>範圍<select value={aiContextScope} onChange={e=>setAIContextScope(e.target.value as AIContextScope)}><option value="all">全部模型</option>{activeSubmodel&&<option value="submodel">目前 Submodel：{activeSubmodel.name}</option>}<option value="selected" disabled={!selectedEntityId}>目前選取 Entity</option></select></label>
                <label>格式<select value={aiContextFormat} onChange={e=>setAIContextFormat(e.target.value as 'markdown'|'compact'|'json')}><option value="markdown">Markdown（推薦給 LLM）</option><option value="compact">Compact（省 Token）</option><option value="json">JSON（Agent / 程式）</option></select></label>
                <label>Relationship Depth<select value={String(aiContextDepth)} disabled={aiContextScope!=='selected'} onChange={e=>setAIContextDepth(e.target.value==='all'?'all':Number(e.target.value) as AIContextDepth)}><option value="0">0 - 僅此 Entity</option><option value="1">1 - 直接關聯</option><option value="2">2 - 二層關聯</option><option value="all">All</option></select></label>
              </div>
              <textarea readOnly value={aiContext} className="ai-context-output" />
              <div className="sql-modal-actions">
                <button className="btn btn-primary btn-sm" onClick={async()=>{await navigator.clipboard.writeText(aiContext);setSaveStatus('✅ AI Context 已複製')}}>📋 Copy for AI</button>
                <button className="btn btn-sm" onClick={()=>{const ext=aiContextFormat==='json'?'json':'md';const blob=new Blob([aiContext],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`AI_CONTEXT.${ext}`;a.click();URL.revokeObjectURL(url)}}>⬇️ 匯出檔案</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {validationOpen && (
        <div className="modal-overlay" onClick={() => setValidationOpen(false)}>
          <div className="modal validation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span>🩺 Model Validation</span><button className="btn btn-xs" onClick={() => setValidationOpen(false)}>✕</button></div>
            <div className="modal-body">
              {validationIssues.length === 0 ? <div className="validation-ok">✅ 未發現模型問題</div> :
                <div className="validation-list">{validationIssues.map((issue,i)=><button key={i} className={`validation-item ${issue.severity}`} onClick={()=>{if(issue.entityId){setSelectedEntityId(issue.entityId);setEditingEntityId(issue.entityId);setValidationOpen(false)}}}><span>{issue.severity==='error'?'⛔':issue.severity==='warning'?'⚠️':'ℹ️'}</span><span><strong>{issue.entityName ? issue.entityName+' — ' : ''}</strong>{issue.message}</span></button>)}</div>}
            </div>
          </div>
        </div>
      )}

      {/* SQL Export Modal */}
      {showSqlModal && (
        <div className="sql-modal-overlay" onClick={() => setShowSqlModal(false)}>
          <div className="sql-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sql-modal-header">
              <span>📤 匯出 SQL</span>
              <button className="btn btn-xs" onClick={() => setShowSqlModal(false)}>✕</button>
            </div>
            <div className="sql-export-options">
              <label>模型
                <select className="ddl-target-select" value={exportModelId} onChange={(e) => {
                  const modelId = e.target.value;
                  const candidates = getExportEntities(modelId).sort((a,b) => a.name.localeCompare(b.name));
                  const ids = candidates.map(entity => entity.id);
                  setExportModelId(modelId);
                  setExportEntityIds(ids);
                  setSqlOutput(candidates.length ? generateDDL(candidates, ddlTarget).ddl : '-- 此模型沒有 Entity --');
                }}>
                  <option value="main">Main Model</option>
                  {erSubmodels.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(sm => <option key={sm.id} value={sm.id}>{sm.name}</option>)}
                </select>
              </label>
              <label>資料庫類型
                <select className="ddl-target-select" value={ddlTarget} onChange={(e) => {
                  const target = e.target.value as DDLTarget;
                  setDdlTarget(target);
                  const selected = getExportEntities(exportModelId).filter(entity => exportEntityIds.includes(entity.id));
                  setSqlOutput(selected.length ? generateDDL(selected, target).ddl : '-- 請至少選擇一個 Entity --');
                }}>
                  <option value="sqlserver">MSSQL / SQL Server</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                </select>
              </label>
            </div>
            <div className="export-entity-picker">
              <div className="export-entity-picker-header">
                <strong>選擇 Entity（{exportEntityIds.length}/{getExportEntities(exportModelId).length}）</strong>
                <span>
                  <button className="btn btn-xs" onClick={() => updateExportSelection(getExportEntities(exportModelId).map(e => e.id))}>全選</button>
                  <button className="btn btn-xs" onClick={() => updateExportSelection([])}>清除</button>
                </span>
              </div>
              <div className="export-entity-list">
                {getExportEntities(exportModelId).slice().sort((a,b)=>a.name.localeCompare(b.name)).map(entity => <label key={entity.id} className="export-entity-item">
                  <input type="checkbox" checked={exportEntityIds.includes(entity.id)} onChange={() => {
                    const ids = exportEntityIds.includes(entity.id) ? exportEntityIds.filter(id => id !== entity.id) : [...exportEntityIds, entity.id];
                    updateExportSelection(ids);
                  }} />
                  <span>{entity.tableName || entity.name}</span>
                </label>)}
              </div>
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

