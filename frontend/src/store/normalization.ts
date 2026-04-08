// Frontend Normalization Engine
import type { EREntity, ERField } from '../api/client';

export interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
}

export interface NormalizationCheck {
  nf: string;
  satisfied: boolean;
  violations: string[];
  suggestions: string[];
}

export interface NormalizationResult {
  entityId: string;
  entityName: string;
  currentNF: string;
  checks: NormalizationCheck[];
}

function getAllFieldNames(fields: ERField[]): string[] {
  return fields.map(f => f.name);
}

function getPKNames(fields: ERField[]): string[] {
  return fields.filter(f => f.isPrimaryKey).map(f => f.name);
}

function isSubset(a: string[], b: string[]): boolean {
  return a.every(x => b.includes(x));
}

// Simple FD detection based on naming conventions
function detectFDs(entity: EREntity): FunctionalDependency[] {
  const fds: FunctionalDependency[] = [];
  const pkFields = getPKNames(entity.fields);
  const nonPKFields = entity.fields.filter(f => !f.isPrimaryKey);

  // Every non-PK field depends on PK (trivial FD)
  if (pkFields.length > 0 && nonPKFields.length > 0) {
    fds.push({
      determinant: pkFields,
      dependent: nonPKFields.map(f => f.name),
    });
  }

  // Detect potential transitive FDs by naming patterns
  // e.g., if there's "customer_name" and "customer_id", customer_name might depend on customer_id
  for (const field of nonPKFields) {
    const prefix = field.name.split('_')[0];
    if (prefix && prefix !== field.name) {
      const relatedFields = nonPKFields.filter(f =>
        f.id !== field.id && f.name.startsWith(prefix + '_')
      );
      if (relatedFields.length > 1) {
        // Potential partial dependency
        fds.push({
          determinant: [field.name],
          dependent: relatedFields.map(f => f.name),
        });
      }
    }
  }

  return fds;
}

function check1NF(entity: EREntity): NormalizationCheck {
  const violations: string[] = [];
  const suggestions: string[] = [];

  // Check for composite/multi-valued fields (heuristic: name contains comma, list, etc.)
  for (const field of entity.fields) {
    if (field.name.match(/(list|items|tags|csv|array)/i)) {
      violations.push(`欄位 "${field.name}" 可能包含多值（違反 1NF）`);
      suggestions.push(`將 "${field.name}" 拆分為獨立的關聯表`);
    }
  }

  // Check for duplicate field groups
  const nameGroups: Record<string, string[]> = {};
  for (const field of entity.fields) {
    const baseName = field.name.replace(/\d+$/, '');
    if (!nameGroups[baseName]) nameGroups[baseName] = [];
    nameGroups[baseName].push(field.name);
  }
  for (const [base, names] of Object.entries(nameGroups)) {
    if (names.length > 2 && base.length > 2) {
      violations.push(`欄位群 "${names.join(', ')}" 疑似重複群組（違反 1NF）`);
      suggestions.push(`將 "${base}*" 欄位拆分為獨立子表`);
    }
  }

  return {
    nf: '1NF',
    satisfied: violations.length === 0,
    violations,
    suggestions,
  };
}

function check2NF(entity: EREntity): NormalizationCheck {
  const violations: string[] = [];
  const suggestions: string[] = [];
  const pkFields = getPKNames(entity.fields);

  // 2NF only applies to composite PKs
  if (pkFields.length <= 1) {
    return { nf: '2NF', satisfied: true, violations: [], suggestions: [] };
  }

  // Check for partial dependencies (non-PK field depends on only part of composite PK)
  const nonPKFields = entity.fields.filter(f => !f.isPrimaryKey);
  for (const field of nonPKFields) {
    // Heuristic: if field name starts with same prefix as one PK field
    for (const pk of pkFields) {
      const pkPrefix = pk.replace(/_?id$/i, '');
      if (field.name.toLowerCase().startsWith(pkPrefix.toLowerCase() + '_') && pkPrefix.length > 2) {
        violations.push(`欄位 "${field.name}" 可能只依賴部分主鍵 "${pk}"（違反 2NF）`);
        suggestions.push(`將 "${field.name}" 移到以 "${pk}" 為主鍵的獨立表`);
      }
    }
  }

  return {
    nf: '2NF',
    satisfied: violations.length === 0,
    violations,
    suggestions,
  };
}

function check3NF(entity: EREntity): NormalizationCheck {
  const violations: string[] = [];
  const suggestions: string[] = [];
  const nonPKFields = entity.fields.filter(f => !f.isPrimaryKey);

  // Check for transitive dependencies
  // Heuristic: if multiple non-PK fields share a prefix, they might transitively depend on each other
  const prefixGroups: Record<string, ERField[]> = {};
  for (const field of nonPKFields) {
    const prefix = field.name.split('_')[0];
    if (prefix && prefix.length > 2) {
      if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
      prefixGroups[prefix].push(field);
    }
  }

  for (const [prefix, fields] of Object.entries(prefixGroups)) {
    if (fields.length >= 2) {
      // Check if there's an ID field for this prefix
      const idField = entity.fields.find(f =>
        f.name.toLowerCase() === `${prefix.toLowerCase()}_id` && !f.isPrimaryKey
      );
      if (idField) {
        violations.push(`欄位群 "${fields.map(f => f.name).join(', ')}" 可能透過 "${idField.name}" 傳遞依賴（違反 3NF）`);
        suggestions.push(`建立獨立的 "${prefix}" 表，將相關欄位移過去`);
      }
    }
  }

  return {
    nf: '3NF',
    satisfied: violations.length === 0,
    violations,
    suggestions,
  };
}

export function analyzeNormalization(entity: EREntity): NormalizationResult {
  const checks: NormalizationCheck[] = [];
  checks.push(check1NF(entity));
  checks.push(check2NF(entity));
  checks.push(check3NF(entity));

  let currentNF = '1NF';
  if (checks[0].satisfied) currentNF = '1NF';
  if (checks[0].satisfied && checks[1].satisfied) currentNF = '2NF';
  if (checks[0].satisfied && checks[1].satisfied && checks[2].satisfied) currentNF = '3NF';

  return {
    entityId: entity.id,
    entityName: entity.name,
    currentNF,
    checks,
  };
}

export function analyzeAll(entities: EREntity[]): NormalizationResult[] {
  return entities.map(e => analyzeNormalization(e));
}
