import type { EREntity, ERField, ERRelationship, ERSubmodel } from '../api/client';

export interface DM2ImportResult {
  entities: EREntity[];
  relationships: ERRelationship[];
  submodels: ERSubmodel[];
  warnings: string[];
}

const TYPE_MAP: Record<number, string> = {
  20: 'VARCHAR',
  25: 'NVARCHAR',
  30: 'INT',
  100: 'DECIMAL',
  150: 'BIT',
  160: 'DATETIME',
  185: 'UNIQUEIDENTIFIER',
};

function u32(view: DataView, offset: number) { return view.getUint32(offset, true); }

function find(bytes: Uint8Array, needle: number[], from: number, to: number) {
  outer: for (let i = from; i <= to - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function readCString(bytes: Uint8Array, offset: number, length: number) {
  const raw = bytes.slice(offset, offset + Math.max(0, length - 1));
  try { return new TextDecoder('big5').decode(raw); } catch { return new TextDecoder().decode(raw); }
}

function readLengthString(bytes: Uint8Array, view: DataView, marker: number[], from: number, to: number) {
  const p = find(bytes, marker, from, to);
  if (p < 0 || p + marker.length + 4 > to) return '';
  const len = u32(view, p + marker.length);
  if (!len || p + marker.length + 4 + len > to) return '';
  return readCString(bytes, p + marker.length + 4, len);
}

function readStringListProperty(bytes: Uint8Array, view: DataView, marker: number[], from: number, to: number) {
  const p = find(bytes, marker, from, to);
  if (p < 0 || p + marker.length >= to) return '';
  const count = bytes[p + marker.length];
  let offset = p + marker.length + 1;
  const lines: string[] = [];
  for (let i = 0; i < count && offset + 4 <= to; i++) {
    const len = u32(view, offset);
    offset += 4;
    if (!len || offset + len > to) break;
    lines.push(readCString(bytes, offset, len));
    offset += len;
  }
  return lines.join('\n').trim();
}

function readU32Property(bytes: Uint8Array, view: DataView, marker: number[], from: number, to: number) {
  const p = find(bytes, marker, from, to);
  return p >= 0 && p + marker.length + 4 <= to ? u32(view, p + marker.length) : null;
}

function recordStarts(bytes: Uint8Array, kind: number) {
  const result: number[] = [];
  const marker = [0xf5, 0x01, kind, 0x00];
  let pos = 0;
  while ((pos = find(bytes, marker, pos, bytes.length)) >= 0) { result.push(pos); pos += marker.length; }
  return result;
}

function recordEnd(start: number, allStarts: number[], fileEnd: number) {
  return allStarts.find((x) => x > start) ?? fileEnd;
}

function colorAt(bytes: Uint8Array, from: number, to: number) {
  const p = find(bytes, [0xe9, 0x03], from, to);
  if (p < 0 || p + 6 > to) return '#1e1e2e';
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(bytes[p + 2])}${hex(bytes[p + 3])}${hex(bytes[p + 4])}`;
}

export function parseDM2(buffer: ArrayBuffer): DM2ImportResult {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const warnings: string[] = [];
  const entityStarts = recordStarts(bytes, 0x67);
  const fieldStarts = recordStarts(bytes, 0x68);
  const relStarts = recordStarts(bytes, 0x6b);
  const submodelStarts = recordStarts(bytes, 0x71);
  const membershipStarts = recordStarts(bytes, 0x73);
  const allStarts = [...entityStarts, ...fieldStarts, ...relStarts, ...submodelStarts, ...membershipStarts].sort((a,b)=>a-b);

  if (!entityStarts.length || !fieldStarts.length) throw new Error('找不到 CASE Studio 2 的 Entity / Field records。');

  const numericEntityMap = new Map<number, EREntity>();
  const numericFieldMap = new Map<number, { entity: EREntity; field: ERField; relationId: number | null; referencedFieldNumericId: number | null }>();
  const entities = entityStarts.map((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
    const numericId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 96)) ?? index + 1;
    const name = readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 160)) || `Entity_${numericId}`;
    // Entity 備註在 CASE Studio 2 的 0x67 record 中是 EC03 + line-count + length-prefixed strings。
    // FD03 是 Field Description，不能用來讀 Entity 備註。
    const notes = readStringListProperty(bytes, view, [0xec, 0x03], start, end);
    const entity: EREntity = { id: `dm2-entity-${numericId}`, name, notes, x: 100 + (index % 4) * 300, y: 100 + Math.floor(index / 4) * 250, fields: [] };
    numericEntityMap.set(numericId, entity);
    return entity;
  });

  fieldStarts.forEach((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
    const numericFieldId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 32)) ?? index + 1;
    const parentId = readU32Property(bytes, view, [0xe8, 0x03], start, Math.min(end, start + 220));
    const entity = parentId == null ? undefined : numericEntityMap.get(parentId);
    if (!entity) { warnings.push(`略過無法對應 Entity 的 Field record @ ${start}`); return; }
    const name = readLengthString(bytes, view, [0xf7, 0x03], start, end) || readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 160)) || `Field_${index + 1}`;
    const typeCode = readU32Property(bytes, view, [0xea, 0x03], start, Math.min(end, start + 260)) ?? -1;
    const lp = readU32Property(bytes, view, [0xf2, 0x03], start, end);
    const scale = readU32Property(bytes, view, [0xf3, 0x03], start, end);
    const defaultValue = readLengthString(bytes, view, [0xf8, 0x03], start, end);
    const dataType = TYPE_MAP[typeCode] ?? `DM2_TYPE_${typeCode}`;
    const field: ERField = {
      id: `dm2-field-${parentId}-${index + 1}`, name, dataType,
      length: dataType === 'NVARCHAR' ? lp : null, precision: dataType === 'DECIMAL' ? lp : null,
      scale: dataType === 'DECIMAL' ? scale : null, isPrimaryKey: false, isForeignKey: false,
      isNullable: true, isUnique: false, hasDefault: !!defaultValue, defaultValue,
      referencedEntity: '', referencedField: '', notes: readLengthString(bytes, view, [0xfd, 0x03], start, end),
    };
    entity.fields.push(field);
    numericFieldMap.set(numericFieldId, {
      entity,
      field,
      relationId: readU32Property(bytes, view, [0xed, 0x03], start, Math.min(end, start + 180)),
      referencedFieldNumericId: readU32Property(bytes, view, [0xee, 0x03], start, Math.min(end, start + 180)),
    });
  });

  const relationships: ERRelationship[] = [];
  relStarts.forEach((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
    const numericRelId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 48)) ?? index + 1;
    const name = readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 180)) || `Relationship_${numericRelId}`;
    const sourceEntityNumericId = readU32Property(bytes, view, [0xe8, 0x03], start, Math.min(end, start + 120));
    const targetEntityNumericId = readU32Property(bytes, view, [0xe9, 0x03], start, Math.min(end, start + 120));
    if (sourceEntityNumericId == null || targetEntityNumericId == null) return;
    const sourceEntity = numericEntityMap.get(sourceEntityNumericId);
    const targetEntity = numericEntityMap.get(targetEntityNumericId);
    if (!sourceEntity || !targetEntity) return;

    // ED03 on a target field identifies the relationship. EE03 is not globally a field id
    // in all CASE Studio 2 files (vPOS proves this), so prefer same-name source fields.
    const targetEntry = [...numericFieldMap.values()].find(x => x.entity.id === targetEntity.id && x.relationId === numericRelId);
    let sourceEntry = targetEntry
      ? [...numericFieldMap.values()].find(x => x.entity.id === sourceEntity.id && x.field.name.toLowerCase() === targetEntry.field.name.toLowerCase())
      : undefined;

    // Some legacy files do use a directly resolvable field reference; keep it as fallback.
    if (!sourceEntry && targetEntry?.referencedFieldNumericId != null) {
      const direct = numericFieldMap.get(targetEntry.referencedFieldNumericId);
      if (direct?.entity.id === sourceEntity.id) sourceEntry = direct;
    }

    const relationshipType: 'foreignKey' | 'informative' = targetEntry && sourceEntry ? 'foreignKey' : 'informative';

    if (targetEntry && sourceEntry) {
      sourceEntry.field.isPrimaryKey = true;
      targetEntry.field.isForeignKey = true;
      targetEntry.field.referencedEntity = sourceEntity.id;
      targetEntry.field.referencedField = sourceEntry.field.id;
    }

    // Always preserve the entity-level relationship line. Some DM2 relationships (views,
    // conceptual links, older records) have no ED03 field binding at all.
    relationships.push({
      id: `dm2-rel-${numericRelId}-${index + 1}`,
      type: relationshipType,
      name,
      sourceEntityId: sourceEntity.id,
      targetEntityId: targetEntity.id,
      sourceFieldId: sourceEntry?.field.id ?? '',
      targetFieldId: targetEntry?.field.id ?? '',
      sourceCardinality: 'One',
      targetCardinality: 'Many',
      sourceLabel: '',
      targetLabel: '',
    });
  });

  const numericSubmodelMap = new Map<number, ERSubmodel>();
  submodelStarts.forEach((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
    const numericId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 96)) ?? index + 1;
    const name = readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 180)) || `Submodel_${numericId}`;
    const sm: ERSubmodel = { id: `dm2-submodel-${numericId}`, name, description: '', backgroundColor: colorAt(bytes, start, end), entityIds: [], layout: {} };
    numericSubmodelMap.set(numericId, sm);
  });

  // 0x73 contains Submodel/Entity membership and per-submodel layout. Known test files
  // encode the first numeric references close to the record header. Keep this guarded:
  // only accept references that resolve to known objects.
  membershipStarts.forEach((start) => {
    const end = recordEnd(start, allStarts, bytes.length);
    // Confirmed CASE Studio 2 0x73 layout record:
    // E803 = submodel id, E903 = entity id, EA03 = X + Y (two adjacent uint32 values).
    const smId = readU32Property(bytes, view, [0xe8, 0x03], start, Math.min(end, start + 128));
    const entityId = readU32Property(bytes, view, [0xe9, 0x03], start, Math.min(end, start + 128));
    // EB03 identifies the kind of diagram object stored in a 0x73 record.
    // vPOS confirms EB03=0 is an Entity placement; EB03=3 records reuse E903
    // for other diagram objects and often carry (0,0), which previously overwrote
    // the real Entity coordinates.
    const objectKindPos = find(bytes, [0xeb, 0x03], start, Math.min(end, start + 160));
    const objectKind = objectKindPos >= 0 && objectKindPos + 2 < end ? bytes[objectKindPos + 2] : 0;
    if (objectKind !== 0) return;
    if (smId == null || entityId == null) return;
    const sm = numericSubmodelMap.get(smId);
    const entity = numericEntityMap.get(entityId);
    if (!sm || !entity) return;
    if (!sm.entityIds.includes(entity.id)) sm.entityIds.push(entity.id);

    const coord = find(bytes, [0xea, 0x03], start, Math.min(end, start + 160));
    let x = entity.x;
    let y = entity.y;
    if (coord >= 0 && coord + 10 <= end) {
      const rawX = u32(view, coord + 2);
      const rawY = u32(view, coord + 6);
      if (rawX < 100000 && rawY < 100000) {
        x = rawX;
        y = rawY;
      }
    }
    // CASE Studio 2 uses a denser canvas than the web editor. Expand imported
    // coordinates to 200% so large entities do not overlap after rendering.
    sm.layout[entity.id] = { x: x * 2, y: y * 2 };
  });

  let submodels = [...numericSubmodelMap.values()];

  // The UI represents CASE Studio's "Main model" as 全部模型 rather than a separate
  // submodel. Preserve its imported layout by copying those coordinates to the
  // entities' global x/y before removing the duplicate Main model entry.
  const mainModel = submodels.find(sm => sm.name.trim().toLowerCase() === 'main model');
  if (mainModel) {
    for (const entity of entities) {
      const pos = mainModel.layout[entity.id];
      if (pos) {
        entity.x = pos.x;
        entity.y = pos.y;
      }
    }
  }
  submodels = submodels.filter(sm => sm.name.trim().toLowerCase() !== 'main model');

  if (relStarts.length && relationships.length !== relStarts.length) warnings.push(`偵測到 ${relStarts.length} 個 Relationship，成功匯入 ${relationships.length} 個。`);
  const mainLayoutCount = mainModel ? Object.keys(mainModel.layout).length : 0;
  const submodelLayoutCount = submodels.reduce((sum, sm) => sum + Object.keys(sm.layout).length, 0);
  warnings.push(`Layout：Main Model ${mainLayoutCount} 個、Submodel ${submodelLayoutCount} 個位置；匯入座標已放大 200%。`);
  warnings.push('Nullable、Identity 與部分舊版 DM2 屬性仍在補強；已支援 Description/備註與可解析的 Relationship/FK。');
  return { entities, relationships, submodels, warnings };
}

export async function pickAndParseDM2(): Promise<{ fileName: string; result: DM2ImportResult } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.dm2,.~m2';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return resolve(null);
      try { resolve({ fileName: file.name, result: parseDM2(await file.arrayBuffer()) }); } catch (error) { reject(error); }
    };
    input.click();
  });
}
