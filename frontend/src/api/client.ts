// --- Schema ---
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
  maxLength: number | null;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexInfo {
  name: string;
  isUnique: boolean;
  columns: string[];
}

export interface TableInfo {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface ConnectionRequest {
  provider: string;
  server: string;
  port?: number;
  database: string;
  username: string;
  password: string;
}

export interface Diagram {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// --- ER Diagram Types ---
export interface ERField {
  id: string;
  name: string;
  dataType: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue: string;
  referencedEntity: string;
  referencedField: string;
  notes: string;
}

export interface EREntity {
  id: string;
  name: string;
  notes: string;
  x: number;
  y: number;
  fields: ERField[];
}

export type Cardinality = 'ZeroOrOne' | 'One' | 'ZeroOrMany' | 'Many';

export interface ERRelationship {
  id: string;
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceFieldId: string;
  targetFieldId: string;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  sourceLabel: string;
  targetLabel: string;
}

export interface ERDiagramData {
  entities: EREntity[];
  relationships: ERRelationship[];
}

export interface ERDiagramSaveResponse {
  id: string;
  name: string;
  data: ERDiagramData;
}

// --- Normalization Types ---
export interface FunctionalDependency {
  id: string;
  determinants: string[];
  dependents: string[];
  isInferred: boolean;
}

export interface NormalizationCheck {
  normalForm: string;
  passes: boolean;
  reason: string;
}

export interface NormalizationSuggestion {
  normalForm: string;
  description: string;
  action: string;
  columnsToSplit: string[];
}

export interface NormalizationResult {
  entityId: string;
  entityName: string;
  checks: NormalizationCheck[];
  functionalDependencies: FunctionalDependency[];
  suggestions: NormalizationSuggestion[];
}

// --- DDL Types ---
export interface DDLGenerateResponse {
  target: string;
  ddl: string;
  warnings: string[];
}

// --- Requirement Types ---
export interface Requirement {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementCreateRequest {
  title: string;
  description: string;
  tags: string[];
  priority: string;
  status: string;
}

// --- Use Case Types ---
export interface UseCaseActor {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

export interface UseCaseItem {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
}

export interface UseCaseRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

export interface UseCaseSystemBoundary {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseCaseData {
  actors: UseCaseActor[];
  useCases: UseCaseItem[];
  relations: UseCaseRelation[];
  systemBoundary: UseCaseSystemBoundary;
}

export interface UseCaseDiagramResponse {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  data: UseCaseData;
}

// --- Flow Chart Types ---
export interface FlowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

export interface FlowChartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowChartResponse {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  data: FlowChartData;
}

// --- Version Types ---
export interface Snapshot {
  id: string;
  entityType: string;
  entityId: string;
  dataJson: string;
  changeLog: string;
  createdBy: string;
  createdAt: string;
}

export interface DiffItem {
  path: string;
  type: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface VersionDiffResponse {
  oldSnapshotId: string;
  newSnapshotId: string;
  changes: DiffItem[];
}

// --- Audit Types ---
export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changesJson: string;
  performedBy: string;
  performedAt: string;
}

// --- Impact Analysis ---
export interface ReferenceItem {
  entityType: string;
  entityId: string;
  entityName: string;
  referenceType: string;
  detail: string;
}

export interface ConflictItem {
  entityType: string;
  entityId: string;
  entityName: string;
  description: string;
}

export interface ImpactAnalysisResponse {
  entityId: string;
  entityType: string;
  references: ReferenceItem[];
  conflicts: ConflictItem[];
  totalReferences: number;
  totalConflicts: number;
}

// --- Document Types ---
export interface DesignDocument {
  id: string;
  title: string;
  content: string;
  format: string;
  createdAt: string;
  updatedAt: string;
}

// Types only - no API calls



