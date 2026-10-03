import type { EREntity, ERRelationship, ERSubmodel } from '../api/client';

export type AIContextScope = 'all' | 'submodel' | 'selected';

export interface AIContextOptions {
  scope: AIContextScope;
  selectedEntityId?: string | null;
  activeSubmodel?: ERSubmodel | null;
}

function typeOf(f: EREntity['fields'][number]) {
  if (['VARCHAR','NVARCHAR','CHAR','NCHAR','VARBINARY'].includes(f.dataType.toUpperCase()) && f.length) return `${f.dataType}(${f.length})`;
  if (['DECIMAL','NUMERIC'].includes(f.dataType.toUpperCase()) && f.precision) return `${f.dataType}(${f.precision},${f.scale ?? 0})`;
  return f.dataType;
}

export function selectAIContextEntities(entities: EREntity[], options: AIContextOptions) {
  if (options.scope === 'selected') return entities.filter(e => e.id === options.selectedEntityId);
  if (options.scope === 'submodel' && options.activeSubmodel) {
    const ids = new Set(options.activeSubmodel.entityIds);
    return entities.filter(e => ids.has(e.id));
  }
  return entities;
}

export function generateAIContextMarkdown(entities: EREntity[], relationships: ERRelationship[], options: AIContextOptions): string {
  const selected = selectAIContextEntities(entities, options);
  const ids = new Set(selected.map(e => e.id));
  const rels = relationships.filter(r => ids.has(r.sourceEntityId) && ids.has(r.targetEntityId));
  const lines = ['# CASE Studio Database Context', '', `Scope: ${options.scope === 'submodel' ? options.activeSubmodel?.name ?? 'Submodel' : options.scope === 'selected' ? 'Selected Entity' : 'All Model'}`, `Entities: ${selected.length}`, ''];
  for (const e of selected) {
    lines.push(`## ${e.name}`, `Physical Table: ${e.tableName || e.name}`);
    if (e.purpose) lines.push(`Purpose: ${e.purpose}`);
    if (e.comments) lines.push(`Comments: ${e.comments}`);
    if (e.notes) lines.push(`Notes: ${e.notes}`);
    lines.push('', '### Fields');
    for (const f of e.fields) {
      const flags = [f.isPrimaryKey && 'PK', f.isForeignKey && 'FK', !f.isNullable && 'NOT NULL', f.isUnique && 'UNIQUE'].filter(Boolean).join(', ');
      let ref = '';
      if (f.isForeignKey) {
        const re = entities.find(x => x.id === f.referencedEntity);
        const rf = re?.fields.find(x => x.id === f.referencedField);
        if (re && rf) ref = ` -> ${re.tableName || re.name}.${rf.columnName || rf.name}`;
      }
      lines.push(`- ${f.name} [${f.columnName || f.name}] : ${typeOf(f)}${flags ? ` (${flags})` : ''}${ref}${f.notes ? ` — ${f.notes}` : ''}`);
    }
    if (e.indexes?.length) lines.push('', '### Indexes', ...e.indexes.map(x => `- ${x.name}${x.isUnique ? ' UNIQUE' : ''}: ${x.fieldIds.map(id => e.fields.find(f => f.id === id)?.columnName || e.fields.find(f => f.id === id)?.name || id).join(', ')}`));
    if (e.alternateKeys?.length) lines.push('', '### Alternate Keys', ...e.alternateKeys.map(x => `- ${x.name}: ${x.fieldIds.map(id => e.fields.find(f => f.id === id)?.columnName || e.fields.find(f => f.id === id)?.name || id).join(', ')}`));
    if (e.checkConstraints?.length) lines.push('', '### Constraints', ...e.checkConstraints.map(x => `- ${x.name}: CHECK (${x.expression})`));
    if (e.businessRules?.trim()) lines.push('', '### Business Rules', e.businessRules.trim());
    lines.push('');
  }
  if (rels.length) {
    lines.push('## Relationships');
    for (const r of rels) {
      const s = entities.find(e => e.id === r.sourceEntityId), t = entities.find(e => e.id === r.targetEntityId);
      if (s && t) lines.push(`- ${s.name} ${r.sourceCardinality} -> ${r.targetCardinality} ${t.name}${r.name ? ` (${r.name})` : ''}${r.type === 'informative' ? ' [informative]' : ''}`);
    }
  }
  return lines.join('\n');
}

export function generateAIContextJSON(entities: EREntity[], relationships: ERRelationship[], options: AIContextOptions): string {
  const selected = selectAIContextEntities(entities, options);
  const ids = new Set(selected.map(e => e.id));
  return JSON.stringify({
    format: 'CASEStudio-AI-Context',
    version: 1,
    scope: options.scope,
    submodel: options.scope === 'submodel' ? options.activeSubmodel?.name : undefined,
    entities: selected,
    relationships: relationships.filter(r => ids.has(r.sourceEntityId) && ids.has(r.targetEntityId)),
  }, null, 2);
}
