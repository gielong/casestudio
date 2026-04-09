import { create } from 'zustand';
import { parseSqlDDL, generateEntityPositions } from '../utils/sqlParser';
import {
  type TableInfo,
  type Diagram,
  type EREntity,
  type ERRelationship,
  type ERField,
  type NormalizationResult,
  type DDLGenerateResponse,
  type Requirement,
  type UseCaseActor,
  type UseCaseItem,
  type UseCaseRelation,
  type FlowNode,
  type FlowEdge,
  type Snapshot,
  type DiffItem,
  type AuditLogEntry,
  type DesignDocument,
  type UseCaseSystemBoundary,
} from '../api/client';

export type Page = 'connect' | 'schema' | 'er-diagram' | 'requirements' | 'usecase' | 'flowchart' | 'versions' | 'documents' | 'audit';

interface AppState {
  // Schema
  tables: TableInfo[];
  setTables: (tables: TableInfo[]) => void;
  selectedTable: string | null;
  setSelectedTable: (name: string | null) => void;

  // Diagrams
  diagrams: Diagram[];
  setDiagrams: (diagrams: Diagram[]) => void;
  currentDiagramId: string | null;
  setCurrentDiagramId: (id: string | null) => void;

  // ER Diagram
  erDiagramId: string | null;
  setErDiagramId: (id: string | null) => void;
  erEntities: EREntity[];
  setErEntities: (entities: EREntity[]) => void;
  addErEntity: (entity: EREntity) => void;
  updateErEntity: (id: string, updates: Partial<EREntity>) => void;
  removeErEntity: (id: string) => void;
  erRelationships: ERRelationship[];
  setErRelationships: (relationships: ERRelationship[]) => void;
  addErRelationship: (rel: ERRelationship) => void;
  updateErRelationship: (id: string, updates: Partial<ERRelationship>) => void;
  removeErRelationship: (id: string) => void;

  // Field editing
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  addFieldToEntity: (entityId: string, field: ERField) => void;
  updateFieldInEntity: (entityId: string, fieldId: string, updates: Partial<ERField>) => void;
  removeFieldFromEntity: (entityId: string, fieldId: string) => void;
  deleteSelectedEntity: () => void;

  // Undo/Redo for ER Diagram
  erHistory: { entities: EREntity[]; relationships: ERRelationship[] }[];
  erHistoryIndex: number;
  undo: () => void;
  redo: () => void;

  // SQL Import
  importSqlDDL: (sql: string) => { entities: number; relationships: number; errors: string[] };

  // Normalization
  normalizationResults: NormalizationResult[];
  setNormalizationResults: (results: NormalizationResult[]) => void;

  // DDL
  ddlResult: DDLGenerateResponse | null;
  setDdlResult: (result: DDLGenerateResponse | null) => void;

  // Requirements
  requirements: Requirement[];
  setRequirements: (items: Requirement[]) => void;
  selectedRequirementId: string | null;
  setSelectedRequirementId: (id: string | null) => void;

  // Use Case Diagram
  useCaseDiagramId: string | null;
  setUseCaseDiagramId: (id: string | null) => void;
  useCaseActors: UseCaseActor[];
  setUseCaseActors: (actors: UseCaseActor[]) => void;
  addUseCaseActor: (actor: UseCaseActor) => void;
  updateUseCaseActor: (id: string, updates: Partial<UseCaseActor>) => void;
  removeUseCaseActor: (id: string) => void;
  useCaseItems: UseCaseItem[];
  setUseCaseItems: (items: UseCaseItem[]) => void;
  addUseCaseItem: (item: UseCaseItem) => void;
  updateUseCaseItem: (id: string, updates: Partial<UseCaseItem>) => void;
  removeUseCaseItem: (id: string) => void;
  useCaseRelations: UseCaseRelation[];
  setUseCaseRelations: (rels: UseCaseRelation[]) => void;
  addUseCaseRelation: (rel: UseCaseRelation) => void;
  removeUseCaseRelation: (id: string) => void;
  systemBoundary: UseCaseSystemBoundary;
  setSystemBoundary: (boundary: UseCaseSystemBoundary) => void;

  // Flow Chart
  flowChartId: string | null;
  setFlowChartId: (id: string | null) => void;
  flowNodes: FlowNode[];
  setFlowNodes: (nodes: FlowNode[]) => void;
  addFlowNode: (node: FlowNode) => void;
  updateFlowNode: (id: string, updates: Partial<FlowNode>) => void;
  removeFlowNode: (id: string) => void;
  flowEdges: FlowEdge[];
  setFlowEdges: (edges: FlowEdge[]) => void;
  addFlowEdge: (edge: FlowEdge) => void;
  removeFlowEdge: (id: string) => void;

  // Versions
  snapshots: Snapshot[];
  setSnapshots: (snapshots: Snapshot[]) => void;
  diffChanges: DiffItem[];
  setDiffChanges: (changes: DiffItem[]) => void;
  selectedSnapshotIds: string[];
  setSelectedSnapshotIds: (ids: string[]) => void;

  // Audit
  auditLogs: AuditLogEntry[];
  setAuditLogs: (logs: AuditLogEntry[]) => void;

  // Documents
  documents: DesignDocument[];
  setDocuments: (docs: DesignDocument[]) => void;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;

  // UI
  activePage: Page;
  setActivePage: (page: Page) => void;
  rightPanel: 'fields' | 'normalize' | 'ddl' | null;
  setRightPanel: (panel: 'fields' | 'normalize' | 'ddl' | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  tables: [],
  setTables: (tables) => set({ tables }),
  selectedTable: null,
  setSelectedTable: (name) => set({ selectedTable: name }),

  diagrams: [],
  setDiagrams: (diagrams) => set({ diagrams }),
  currentDiagramId: null,
  setCurrentDiagramId: (id) => set({ currentDiagramId: id }),

  erDiagramId: null,
  setErDiagramId: (id) => set({ erDiagramId: id }),
  erEntities: [],
  setErEntities: (entities) => set({ erEntities: entities }),
  addErEntity: (entity) =>
    set((s) => {
      // Push history before change
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return { erEntities: [...s.erEntities, entity], erHistory: newHistory, erHistoryIndex: newHistory.length - 1 };
    }),
  updateErEntity: (id, updates) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),
  removeErEntity: (id) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.filter((e) => e.id !== id),
        erRelationships: s.erRelationships.filter(
          (r) => r.sourceEntityId !== id && r.targetEntityId !== id
        ),
        selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),

  erRelationships: [],
  setErRelationships: (rels) => set({ erRelationships: rels }),
  addErRelationship: (rel) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return { erRelationships: [...s.erRelationships, rel], erHistory: newHistory, erHistoryIndex: newHistory.length - 1 };
    }),
  updateErRelationship: (id, updates) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erRelationships: s.erRelationships.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),
  removeErRelationship: (id) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erRelationships: s.erRelationships.filter((r) => r.id !== id),
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),

  // Delete selected entity
  deleteSelectedEntity: () =>
    set((s) => {
      if (!s.selectedEntityId) return s;
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.filter((e) => e.id !== s.selectedEntityId),
        erRelationships: s.erRelationships.filter(
          (r) => r.sourceEntityId !== s.selectedEntityId && r.targetEntityId !== s.selectedEntityId
        ),
        selectedEntityId: null,
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),

  selectedEntityId: null,
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  selectedFieldId: null,
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),

  addFieldToEntity: (entityId, field) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.map((e) =>
          e.id === entityId
            ? { ...e, fields: [...e.fields, field] }
            : e
        ),
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),
  updateFieldInEntity: (entityId, fieldId, updates) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                fields: e.fields.map((f) =>
                  f.id === fieldId ? { ...f, ...updates } : f
                ),
              }
            : e
        ),
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),
  removeFieldFromEntity: (entityId, fieldId) =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      if (newHistory.length > 50) newHistory.shift();
      return {
        erEntities: s.erEntities.map((e) =>
          e.id === entityId
            ? { ...e, fields: e.fields.filter((f) => f.id !== fieldId) }
            : e
        ),
        selectedFieldId:
          s.selectedFieldId === fieldId ? null : s.selectedFieldId,
        erHistory: newHistory,
        erHistoryIndex: newHistory.length - 1,
      };
    }),

  // Undo/Redo for ER Diagram
  erHistory: [],
  erHistoryIndex: -1,
  pushErHistory: () =>
    set((s) => {
      const newHistory = s.erHistory.slice(0, s.erHistoryIndex + 1);
      newHistory.push({ entities: structuredClone(s.erEntities), relationships: structuredClone(s.erRelationships) });
      // Keep max 50 history states
      if (newHistory.length > 50) newHistory.shift();
      return { erHistory: newHistory, erHistoryIndex: newHistory.length - 1 };
    }),
  undo: () =>
    set((s) => {
      if (s.erHistoryIndex <= 0) return s;
      const newIndex = s.erHistoryIndex - 1;
      const state = s.erHistory[newIndex];
      return {
        erentities: structuredClone(state.entities), erRelationships: structuredClone(state.relationships),
        erHistoryIndex: newIndex,
        selectedEntityId: null,
        selectedFieldId: null,
      };
    }),
  redo: () =>
    set((s) => {
      if (s.erHistoryIndex >= s.erHistory.length - 1) return s;
      const newIndex = s.erHistoryIndex + 1;
      const state = s.erHistory[newIndex];
      return {
        erentities: structuredClone(state.entities), erRelationships: structuredClone(state.relationships),
        erHistoryIndex: newIndex,
        selectedEntityId: null,
        selectedFieldId: null,
      };
    }),
  canUndo: () => useStore.getState().erHistoryIndex > 0,
  canRedo: () => useStore.getState().erHistoryIndex < useStore.getState().erHistory.length - 1,

  // SQL Import
  importSqlDDL: (sql: string) => {
    const result = parseSqlDDL(sql);
    const positions = generateEntityPositions(result.tables);

    // Convert tables to entities
    const newEntities: EREntity[] = result.tables.map((table: { name: string; notes: string; columns: { name: string; dataType: string; length: number | null; precision: number | null; scale: number | null; isPrimaryKey: boolean; isForeignKey: boolean; isNullable: boolean; isUnique: boolean; hasDefault: boolean; defaultValue: string; referencedTable: string; referencedField: string; notes: string; }[] }) => {
      const pos = positions.get(table.name) || { x: 100, y: 100 };
      return {
        id: generateId('entity'),
        name: table.name,
        notes: table.notes,
        x: pos.x,
        y: pos.y,
        fields: table.columns.map((col: { name: string; dataType: string; length: number | null; precision: number | null; scale: number | null; isPrimaryKey: boolean; isForeignKey: boolean; isNullable: boolean; isUnique: boolean; hasDefault: boolean; defaultValue: string; referencedTable: string; referencedField: string; notes: string; }) => ({
          id: generateId('field'),
          name: col.name,
          dataType: col.dataType,
          length: col.length,
          precision: col.precision,
          scale: col.scale,
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: col.isForeignKey,
          isNullable: col.isNullable,
          isUnique: col.isUnique,
          hasDefault: col.hasDefault,
          defaultValue: col.defaultValue,
          referencedEntity: col.referencedTable,
          referencedField: col.referencedField,
          notes: col.notes,
        })),
      };
    });

    // Convert relationships
    const entityMap = new Map(newEntities.map((e) => [e.name, e]));
    const newRelationships: ERRelationship[] = result.relationships
      .filter((rel: { sourceTable: string; targetTable: string }) => entityMap.has(rel.sourceTable) && entityMap.has(rel.targetTable))
      .map((rel: { sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string; constraintName: string }) => {
        const sourceEntity = entityMap.get(rel.sourceTable)!;
        const targetEntity = entityMap.get(rel.targetTable)!;
        const sourceField = sourceEntity.fields.find((f) => f.name === rel.sourceColumn);
        const targetField = targetEntity.fields.find((f) => f.name === rel.targetColumn);
        return {
          id: generateId('rel'),
          name: rel.constraintName,
          sourceEntityId: sourceEntity.id,
          targetEntityId: targetEntity.id,
          sourceFieldId: sourceField?.id || '',
          targetFieldId: targetField?.id || '',
          sourceCardinality: 'One' as const,
          targetCardinality: 'Many' as const,
          sourceLabel: '',
          targetLabel: '',
        };
      });

    set((s) => ({
      erEntities: [...s.erEntities, ...newEntities],
      erRelationships: [...s.erRelationships, ...newRelationships],
    }));

    // Store errors so UI can display them
    set({ error: result.errors.length > 0 ? `SQL 解析錯誤 (${result.errors.length} 筆): ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}` : null });

    return { entities: newEntities.length, relationships: newRelationships.length, errors: result.errors };
  },

  normalizationResults: [],
  setNormalizationResults: (results) => set({ normalizationResults: results }),

  ddlResult: null,
  setDdlResult: (result) => set({ ddlResult: result }),

  // Requirements
  requirements: [],
  setRequirements: (items) => set({ requirements: items }),
  selectedRequirementId: null,
  setSelectedRequirementId: (id) => set({ selectedRequirementId: id }),

  // Use Case
  useCaseDiagramId: null,
  setUseCaseDiagramId: (id) => set({ useCaseDiagramId: id }),
  useCaseActors: [],
  setUseCaseActors: (actors) => set({ useCaseActors: actors }),
  addUseCaseActor: (actor) => set((s) => ({ useCaseActors: [...s.useCaseActors, actor] })),
  updateUseCaseActor: (id, updates) =>
    set((s) => ({
      useCaseActors: s.useCaseActors.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  removeUseCaseActor: (id) =>
    set((s) => ({
      useCaseActors: s.useCaseActors.filter((a) => a.id !== id),
      useCaseRelations: s.useCaseRelations.filter((r) => r.sourceId !== id && r.targetId !== id),
    })),
  useCaseItems: [],
  setUseCaseItems: (items) => set({ useCaseItems: items }),
  addUseCaseItem: (item) => set((s) => ({ useCaseItems: [...s.useCaseItems, item] })),
  updateUseCaseItem: (id, updates) =>
    set((s) => ({
      useCaseItems: s.useCaseItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeUseCaseItem: (id) =>
    set((s) => ({
      useCaseItems: s.useCaseItems.filter((i) => i.id !== id),
      useCaseRelations: s.useCaseRelations.filter((r) => r.sourceId !== id && r.targetId !== id),
    })),
  useCaseRelations: [],
  setUseCaseRelations: (rels) => set({ useCaseRelations: rels }),
  addUseCaseRelation: (rel) => set((s) => ({ useCaseRelations: [...s.useCaseRelations, rel] })),
  removeUseCaseRelation: (id) =>
    set((s) => ({ useCaseRelations: s.useCaseRelations.filter((r) => r.id !== id) })),
  systemBoundary: { name: 'System', x: 150, y: 50, width: 600, height: 400 },
  setSystemBoundary: (boundary) => set({ systemBoundary: boundary }),

  // Flow Chart
  flowChartId: null,
  setFlowChartId: (id) => set({ flowChartId: id }),
  flowNodes: [],
  setFlowNodes: (nodes) => set({ flowNodes: nodes }),
  addFlowNode: (node) => set((s) => ({ flowNodes: [...s.flowNodes, node] })),
  updateFlowNode: (id, updates) =>
    set((s) => ({
      flowNodes: s.flowNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeFlowNode: (id) =>
    set((s) => ({
      flowNodes: s.flowNodes.filter((n) => n.id !== id),
      flowEdges: s.flowEdges.filter((e) => e.sourceId !== id && e.targetId !== id),
    })),
  flowEdges: [],
  setFlowEdges: (edges) => set({ flowEdges: edges }),
  addFlowEdge: (edge) => set((s) => ({ flowEdges: [...s.flowEdges, edge] })),
  removeFlowEdge: (id) =>
    set((s) => ({ flowEdges: s.flowEdges.filter((e) => e.id !== id) })),

  // Versions
  snapshots: [],
  setSnapshots: (snapshots) => set({ snapshots }),
  diffChanges: [],
  setDiffChanges: (changes) => set({ diffChanges: changes }),
  selectedSnapshotIds: [],
  setSelectedSnapshotIds: (ids) => set({ selectedSnapshotIds: ids }),

  // Audit
  auditLogs: [],
  setAuditLogs: (logs) => set({ auditLogs: logs }),

  // Documents
  documents: [],
  setDocuments: (docs) => set({ documents: docs }),
  selectedDocumentId: null,
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

  // UI
  activePage: 'er-diagram',
  setActivePage: (page) => set({ activePage: page }),
  rightPanel: null,
  setRightPanel: (panel) => set({ rightPanel: panel }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error: error }),
}));

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

