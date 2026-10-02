import type { EREntity, ERField, ERRelationship, ERSubmodel } from '../api/client';

export interface DM2ImportResult {
  entities: EREntity[];
  relationships: ERRelationship[];
  submodels: ERSubmodel[];
  warnings: string[];
}

const TYPE_MAP: Record<number, string> = {
  25: 'NVARCHAR',
  30: 'INT',
  100: 'DECIMAL',
  150: 'BIT',
  160: 'DATETIME',
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
  const entities = entityStarts.map((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
    const numericId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 96)) ?? index + 1;
    const name = readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 160)) || `Entity_${numericId}`;
    const entity: EREntity = { id: `dm2-entity-${numericId}`, name, notes: '', x: 100 + (index % 4) * 300, y: 100 + Math.floor(index / 4) * 250, fields: [] };
    numericEntityMap.set(numericId, entity);
    return entity;
  });

  fieldStarts.forEach((start, index) => {
    const end = recordEnd(start, allStarts, bytes.length);
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
      referencedEntity: '', referencedField: '', notes: '',
    };
    entity.fields.push(field);
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
    const values: number[] = [];
    for (let p = start + 4; p + 6 <= Math.min(end, start + 96); p++) {
      if (bytes[p] === 0x58 && bytes[p + 1] === 0x02) values.push(u32(view, p + 2));
      if (bytes[p] === 0xe8 && bytes[p + 1] === 0x03) values.push(u32(view, p + 2));
    }
    const smId = values.find(v => numericSubmodelMap.has(v));
    const entityId = values.find(v => numericEntityMap.has(v) && v !== smId);
    if (smId == null || entityId == null) return;
    const sm = numericSubmodelMap.get(smId)!;
    const entity = numericEntityMap.get(entityId)!;
    if (!sm.entityIds.includes(entity.id)) sm.entityIds.push(entity.id);

    // CASE Studio membership records carry the view-local X/Y as adjacent 32-bit values.
    // Until every legacy variant is known, fall back to the main model position if not plausible.
    const nums: number[] = [];
    for (let p = start + 4; p + 4 <= Math.min(end, start + 128); p += 4) nums.push(u32(view, p));
    const plausible = nums.filter(v => v < 100000);
    const x = plausible.length >= 2 ? plausible[plausible.length - 2] : entity.x;
    const y = plausible.length >= 1 ? plausible[plausible.length - 1] : entity.y;
    sm.layout[entity.id] = { x, y };
  });

  let submodels = [...numericSubmodelMap.values()];
  // CASE Studio's "Main model" represents the global model, which our UI already exposes as 全部模型.
  submodels = submodels.filter(sm => sm.name.toLowerCase() !== 'main model');

  if (relStarts.length) warnings.push(`偵測到 ${relStarts.length} 個 Relationship record；FK/Relationship 對應仍在逆向中。`);
  warnings.push('PK、FK、Nullable、Identity、Description 與 Relationship 尚未完全解碼；未確認的屬性不會猜測匯入。');
  return { entities, relationships: [], submodels, warnings };
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
