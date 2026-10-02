import type { EREntity, ERRelationship } from '../api/client';

export type ValidationSeverity = 'error' | 'warning' | 'info';
export interface ModelValidationIssue {
  severity: ValidationSeverity;
  entityId?: string;
  entityName?: string;
  fieldId?: string;
  message: string;
}

const LENGTH_TYPES = new Set(['VARCHAR','NVARCHAR','CHAR','NCHAR','VARBINARY']);
const PRECISION_TYPES = new Set(['DECIMAL','NUMERIC']);

export function validateERModel(entities: EREntity[], relationships: ERRelationship[]): ModelValidationIssue[] {
  const issues: ModelValidationIssue[] = [];
  const add = (severity: ValidationSeverity, message: string, entity?: EREntity, fieldId?: string) =>
    issues.push({ severity, message, entityId: entity?.id, entityName: entity?.name, fieldId });

  const names = new Map<string, EREntity[]>();
  for (const e of entities) {
    const physical = (e.tableName || e.name).trim().toLowerCase();
    names.set(physical, [...(names.get(physical) ?? []), e]);
    if (!e.fields.length) add('warning', 'Entity 沒有任何欄位。', e);
    if (!e.fields.some(f => f.isPrimaryKey)) add('warning', 'Entity 沒有 Primary Key。', e);

    const fieldNames = new Map<string, number>();
    for (const f of e.fields) {
      const fn = (f.columnName || f.name).trim().toLowerCase();
      fieldNames.set(fn, (fieldNames.get(fn) ?? 0) + 1);
      const t = f.dataType.toUpperCase();
      if (LENGTH_TYPES.has(t) && (!f.length || f.length <= 0)) add('warning', `${f.columnName || f.name}：${t} 未設定有效 Length。`, e, f.id);
      if (PRECISION_TYPES.has(t) && (f.precision == null || f.precision <= 0)) add('warning', `${f.columnName || f.name}：${t} 未設定有效 Precision。`, e, f.id);
      if (f.isForeignKey) {
        const re = entities.find(x => x.id === f.referencedEntity);
        const rf = re?.fields.find(x => x.id === f.referencedField);
        if (!re || !rf) add('error', `${f.columnName || f.name}：Foreign Key 指向不存在的欄位。`, e, f.id);
        else if (f.dataType.toUpperCase() !== rf.dataType.toUpperCase() || f.length !== rf.length || f.precision !== rf.precision || f.scale !== rf.scale)
          add('warning', `${f.columnName || f.name}：FK 型別與 ${re.name}.${rf.columnName || rf.name} 不一致。`, e, f.id);
      }
    }
    for (const [name,count] of fieldNames) if (name && count > 1) add('error', `Column Name「${name}」重複 ${count} 次。`, e);

    for (const idx of e.indexes ?? []) {
      if (!idx.name.trim()) add('error', 'Index 名稱不可空白。', e);
      if (!idx.fieldIds.length) add('warning', `Index「${idx.name}」沒有欄位。`, e);
      if (idx.fieldIds.some(id => !e.fields.some(f => f.id === id))) add('error', `Index「${idx.name}」包含不存在的欄位。`, e);
    }
    for (const ak of e.alternateKeys ?? []) {
      if (!ak.name.trim()) add('error', 'Alternate Key 名稱不可空白。', e);
      if (!ak.fieldIds.length) add('warning', `Alternate Key「${ak.name}」沒有欄位。`, e);
      if (ak.fieldIds.some(id => !e.fields.some(f => f.id === id))) add('error', `Alternate Key「${ak.name}」包含不存在的欄位。`, e);
    }
  }
  for (const [name,list] of names) if (name && list.length > 1) list.forEach(e => add('error', `Table Name「${name}」重複。`, e));

  for (const r of relationships) {
    const src = entities.find(e => e.id === r.sourceEntityId);
    const tgt = entities.find(e => e.id === r.targetEntityId);
    if (!src || !tgt) { add('error', `Relationship「${r.name || r.id}」指向不存在的 Entity。`); continue; }
    if (r.type !== 'informative') {
      if (!src.fields.some(f => f.id === r.sourceFieldId)) add('error', `Relationship「${r.name || r.id}」來源欄位不存在。`, src);
      if (!tgt.fields.some(f => f.id === r.targetFieldId)) add('error', `Relationship「${r.name || r.id}」目標欄位不存在。`, tgt);
    }
  }
  return issues;
}
