/**
 * SQL DDL Parser - Converts SQL CREATE TABLE statements to ER entities
 * Supports: MySQL, PostgreSQL, MSSQL (SQL Server)
 */

export interface ParsedColumn {
  name: string;
  dataType: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue: string;
  isIdentity: boolean;
  isForeignKey: boolean;
  referencedTable: string;
  referencedField: string;
  notes: string;
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
  notes: string;
}

export interface ParsedRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
}

export interface SqlParseResult {
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
  errors: string[];
}

function parseIdentifier(input: string): string {
  return input.replace(/^[`"'\[\]]+|[`"'\[\]]+$/g, '');
}

// Match column definition
const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;
const PK_REGEX = /PRIMARY\s+KEY\s*\(([^)]+)\)/i;
const UNIQUE_REGEX = /\bUNIQUE\b/i;
const IDENTITY_REGEX = /\b(IDENTITY|AUTO_INCREMENT|SERIAL)\b/i;
const FK_INLINE_REGEX = /FOREIGN\s+KEY\s*\(\[?(\w+)\]?\)\s*REFERENCES\s*\[?(\w+)?\]?\s*\(\[?(\w+)\]?\)/gi;
const COLUMN_FK_REGEX = /REFERENCES\s*\[?(\w+)?\]?\s*\(\s*\[?(\w+)\]?\s*\)/i;
const DEFAULT_REGEX = /DEFAULT\s+([^(,\s)]+)/i;

function parseDataType(typeStr: string): { dataType: string; length: number | null; precision: number | null; scale: number | null } {
  const upper = typeStr.toUpperCase().trim();
  
  const precisionMatch = upper.match(/^(DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE)\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/i);
  if (precisionMatch) {
    return {
      dataType: precisionMatch[1].toUpperCase(),
      length: null,
      precision: parseInt(precisionMatch[2], 10),
      scale: precisionMatch[3] ? parseInt(precisionMatch[3], 10) : null,
    };
  }
  
  const lengthMatch = upper.match(/^(\w+)\s*\(\s*(\d+)\s*\)/);
  if (lengthMatch) {
    return {
      dataType: lengthMatch[1].toUpperCase(),
      length: parseInt(lengthMatch[2], 10),
      precision: null,
      scale: null,
    };
  }
  
  return {
    dataType: upper,
    length: null,
    precision: null,
    scale: null,
  };
}

// Split by comma, respecting parentheses inside column definitions
function splitColumnDefs(body: string): string[] {
  const defs: string[] = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    
    // Track depth for nested parentheses (data types)
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        defs.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    defs.push(current.trim());
  }
  
  return defs;
}

function isConstraintDefinition(def: string): boolean {
  const upper = def.toUpperCase().trim();
  return (
    upper.startsWith('PRIMARY KEY') ||
    upper.startsWith('FOREIGN KEY') ||
    upper.startsWith('UNIQUE') ||
    upper.startsWith('INDEX ') ||
    upper.startsWith('KEY ') ||
    upper.startsWith('CONSTRAINT') ||
    upper.startsWith('CHECK ') ||
    upper.startsWith('FULLTEXT') ||
    upper.startsWith('SPATIAL')
  );
}

function parseColumnDef(def: string, primaryKeys: Set<string>): ParsedColumn | null {
  const cleaned = def.replace(/\[(\w+)\]/g, '$1');
  const colMatch = cleaned.match(COLUMN_REGEX);
  if (!colMatch) return null;
  
  const colName = colMatch[2] || colMatch[3];
  const dataTypeStr = colMatch[4];
  const { dataType, length, precision, scale } = parseDataType(dataTypeStr);
  
  const upperDef = def.toUpperCase();
  const upperCleaned = cleaned.toUpperCase();
  
  const isNullable = !upperDef.includes('NOT NULL');
  const hasPK = upperCleaned.includes('PRIMARY KEY') || primaryKeys.has(colName);
  const hasDefault = upperDef.includes('DEFAULT');
  const isUnique = UNIQUE_REGEX.test(cleaned);
  const isIdentity = IDENTITY_REGEX.test(upperDef);
  
  let defaultValue = '';
  const defaultMatch = def.match(DEFAULT_REGEX);
  if (defaultMatch) {
    defaultValue = defaultMatch[1].replace(/^[\'\"\(\)]+|[\'\"\(\)]+$/g, '');
  }
  
  let notes = '';
  const commentMatch = def.match(/COMMENT\s+['"]([^'"]*)['"]/i);
  if (commentMatch) notes = commentMatch[1];
  
  const fkMatch = cleaned.match(COLUMN_FK_REGEX);
  
  return {
    name: colName,
    dataType,
    length,
    precision,
    scale,
    isNullable,
    isPrimaryKey: hasPK,
    isUnique,
    hasDefault,
    defaultValue,
    isIdentity,
    isForeignKey: !!fkMatch,
    referencedTable: fkMatch ? fkMatch[1] : '',
    referencedField: fkMatch ? fkMatch[2] : '',
    notes,
  };
}

// Find the position of the closing parenthesis for the table body
function findTableBodyEnd(sql: string, afterTableNamePos: number): number {
  // The opening '(' is at afterTableNamePos (we know tableMatch[0] ends with '(')
  // Count parentheses to find matching ')'
  let depth = 0;
  for (let i = afterTableNamePos; i < sql.length; i++) {
    const char = sql[i];
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

export function parseSqlDDL(sql: string): SqlParseResult {
  const tables: ParsedTable[] = [];
  const tableRelationships: Map<string, ParsedRelationship[]> = new Map();
  const errors: string[] = [];
  
  // Normalize SQL
  const normalizedSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split by 'go' statement (MSSQL batch separator)
  const batches = normalizedSql.split(/\bgo\b/i);
  
  for (const batch of batches) {
    const trimmedBatch = batch.trim();
    if (!trimmedBatch) continue;
    
    // Find all CREATE TABLE statements
    const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
    const tableMatches = [...trimmedBatch.matchAll(tablePattern)];
    
    for (const tableMatch of tableMatches) {
      const tableName = parseIdentifier(tableMatch[1]);
      const matchStart = tableMatch.index!;
      
      // Find the body end position (pass position of opening '(')
      const bodyEnd = findTableBodyEnd(trimmedBatch, matchStart + tableMatch[0].length - 1);
      if (bodyEnd === -1) {
        errors.push(`Cannot parse table body for ${tableName}`);
        continue;
      }
      
      // bodyStart is right after the opening '('
      const parenPos = matchStart + tableMatch[0].length - 1;
      const bodyStart = parenPos + 1;
      const body = trimmedBatch.substring(bodyStart, bodyEnd);
      const fullStatement = trimmedBatch.substring(matchStart, bodyEnd + 1);
      
      // Find primary keys at the end
      const pkMatch = fullStatement.match(PK_REGEX);
      const primaryKeys = new Set<string>();
      if (pkMatch) {
        const pkCols = pkMatch[1].split(',').map(s => parseIdentifier(s.trim()));
        pkCols.forEach(pk => primaryKeys.add(pk));
      }
      
      // Extract column definitions
      const columnDefs = splitColumnDefs(body);
      const columns: ParsedColumn[] = [];
      
      for (const def of columnDefs) {
        if (isConstraintDefinition(def)) continue;
        
        const col = parseColumnDef(def, primaryKeys);
        if (col) {
          columns.push(col);
        } else {
          errors.push(`Cannot parse column: ${def.substring(0, 50)}`);
        }
      }
      
      // Find FK relationships
      const fkMatches = [...fullStatement.matchAll(FK_INLINE_REGEX)];
      for (const match of fkMatches) {
        const rel = {
          sourceTable: tableName,
          sourceColumn: match[1],
          targetTable: match[2],
          targetColumn: match[3],
          constraintName: `FK_${tableName}_${match[1]}`,
        };
        tableRelationships.set(tableName, [
          ...(tableRelationships.get(tableName) || []),
          rel,
        ]);
      }
      
      // Also check columns for inline FK
      for (const col of columns) {
        if (col.isForeignKey && col.referencedTable) {
          const rel = {
            sourceTable: tableName,
            sourceColumn: col.name,
            targetTable: col.referencedTable,
            targetColumn: col.referencedField,
            constraintName: `FK_${tableName}_${col.name}`,
          };
          tableRelationships.set(tableName, [
            ...(tableRelationships.get(tableName) || []),
            rel,
          ]);
        }
      }
      
      tables.push({
        name: tableName,
        columns,
        notes: '',
      });
    }
  }
  
  // Flatten relationships
  const relationships: ParsedRelationship[] = [];
  tableRelationships.forEach((rels) => {
    relationships.push(...rels);
  });
  
  return { tables, relationships, errors };
}

export function generateEntityPositions(tables: ParsedTable[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const COLS = 3;
  const TABLE_WIDTH = 250;
  const TABLE_HEIGHT = 200;
  const PADDING = 80;
  
  tables.forEach((table, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    positions.set(table.name, {
      x: col * (TABLE_WIDTH + PADDING) + 50,
      y: row * (TABLE_HEIGHT + PADDING) + 50,
    });
  });
  
  return positions;
}
