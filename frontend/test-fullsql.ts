import { parseSqlDDL } from './src/utils/sqlParser';
import { readFileSync } from 'fs';

const sql = readFileSync('C:/Users/gielong/.openclaw/media/inbound/45270f33-1753-4211-977d-3af0dea6311b.txt', 'utf-8');
const result = parseSqlDDL(sql);
console.log('Tables:', result.tables.length);
console.log('Relationships:', result.relationships.length);
console.log('Errors:', result.errors.slice(0, 5));
if (result.tables.length > 0) {
  const t = result.tables[0];
  console.log('First table:', t.name, 'columns:', t.columns.length);
  if (t.columns.length > 0) {
    console.log('Sample column:', JSON.stringify(t.columns[0]));
  }
}
if (result.tables.length > 1) {
  const t = result.tables[1];
  console.log('Second table:', t.name, 'columns:', t.columns.length);
}
