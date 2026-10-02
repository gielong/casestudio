import type { EREntity, ERField, ERRelationship } from '../api/client';

export interface DM2ImportResult {
  entities: EREntity[];
  relationships: ERRelationship[];
  warnings: string[];
}

const TYPE_MAP: Record<number, string> = {
  25: 'NVARCHAR',
  30: 'INT',
  100: 'DECIMAL',
  150: 'BIT',
  160: 'DATETIME',
};

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function find(bytes: Uint8Array, needle: number[], from: number, to: number) {
  outer: for (let i = from; i <= to - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function readCString(bytes: Uint8Array, offset: number, length: number) {
  const raw = bytes.slice(offset, offset + Math.max(0, length - 1));
  try { return new TextDecoder('big5').decode(raw); }
  catch { return new TextDecoder().decode(raw); }
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
  while ((pos = find(bytes, marker, pos, bytes.length)) >= 0) {
    result.push(pos);
    pos += marker.length;
  }
  return result;
}

export function parseDM2(buffer: ArrayBuffer): DM2ImportResult {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const warnings: string[] = [];

  // CASE Studio 2 object records observed in DM2:
  // 0x67 = entity/table, 0x68 = field/attribute, 0x6b = relationship.
  const entityStarts = recordStarts(bytes, 0x67);
  const fieldStarts = recordStarts(bytes, 0x68);
  const relStarts = recordStarts(bytes, 0x6b);

  if (!entityStarts.length || !fieldStarts.length) {
    throw new Error('找不到 CASE Studio 2 的 Entity / Field records，檔案可能不是支援的 DM2 格式。');
  }

  const numericEntityMap = new Map<number, EREntity>();
  const entities = entityStarts.map((start, index) => {
    const end = entityStarts[index + 1] ?? (fieldStarts[0] ?? bytes.length);
    const numericId = readU32Property(bytes, view, [0x58, 0x02], start, Math.min(end, start + 64)) ?? index + 1;
    const name = readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 96)) || `Entity_${numericId}`;
    const coord = find(bytes, [0xe9, 0x03], start, Math.min(end, start + 180));
    const x = coord >= 0 && coord + 10 <= end ? u32(view, coord + 2) : 100 + index * 280;
    const y = coord >= 0 && coord + 10 <= end ? u32(view, coord + 6) : 100;

    const entity: EREntity = {
      id: `dm2-entity-${numericId}`,
      name,
      notes: '',
      x,
      y,
      fields: [],
    };
    numericEntityMap.set(numericId, entity);
    return entity;
  });

  fieldStarts.forEach((start, index) => {
    const end = fieldStarts[index + 1] ?? (relStarts[0] ?? bytes.length);
    const parentId = readU32Property(bytes, view, [0xe8, 0x03], start, Math.min(end, start + 180));
    const entity = parentId == null ? undefined : numericEntityMap.get(parentId);
    if (!entity) {
      warnings.push(`略過無法對應 Entity 的 Field record @ ${start}`);
      return;
    }

    const name = readLengthString(bytes, view, [0xf7, 0x03], start, end)
      || readLengthString(bytes, view, [0x59, 0x02], start, Math.min(end, start + 96))
      || `Field_${index + 1}`;
    const typeCode = readU32Property(bytes, view, [0xea, 0x03], start, Math.min(end, start + 220)) ?? -1;
    const lengthOrPrecision = readU32Property(bytes, view, [0xf2, 0x03], start, end);
    const scale = readU32Property(bytes, view, [0xf3, 0x03], start, end);
    const defaultValue = readLengthString(bytes, view, [0xf8, 0x03], start, end);
    const dataType = TYPE_MAP[typeCode] ?? `DM2_TYPE_${typeCode}`;

    const field: ERField = {
      id: `dm2-field-${parentId}-${index + 1}`,
      name,
      dataType,
      length: dataType === 'NVARCHAR' ? lengthOrPrecision : null,
      precision: dataType === 'DECIMAL' ? lengthOrPrecision : null,
      scale: dataType === 'DECIMAL' ? scale : null,
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
      isUnique: false,
      hasDefault: defaultValue.length > 0,
      defaultValue,
      referencedEntity: '',
      referencedField: '',
      notes: '',
    };
    entity.fields.push(field);
  });

  if (relStarts.length) {
    warnings.push(`偵測到 ${relStarts.length} 個 Relationship record；FK/Relationship 對應仍在逆向中，本版先保留 Entity/Field 資料。`);
  }
  warnings.push('PK、FK、Nullable、Identity、Description 與 Relationship 尚未完全解碼；未確認的屬性不會猜測匯入。');

  return { entities, relationships: [], warnings };
}

export async function pickAndParseDM2(): Promise<{ fileName: string; result: DM2ImportResult } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dm2,.~m2';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve({ fileName: file.name, result: parseDM2(await file.arrayBuffer()) });
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}
