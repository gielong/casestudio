// Full trace of the parser
const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iPrice] Float NOT NULL,
Primary Key ([ItemId])
)`;

const normalizedSql = sql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .trim();

const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
const tableMatch = [...normalizedSql.matchAll(tablePattern)][0];
const tableName = tableMatch[1];
const matchStart = tableMatch.index!;
const bodyStart = matchStart + tableMatch[0].length;

console.log("Full normalized SQL:");
console.log(normalizedSql);
console.log("Length:", normalizedSql.length);
console.log();
console.log("bodyStart:", bodyStart, "char at bodyStart:", normalizedSql[bodyStart]);

// Trace depth
let depth = 0;
let bodyEnd = -1;

for (let i = bodyStart; i < normalizedSql.length; i++) {
  const char = normalizedSql[i];
  const prev = i > 0 ? normalizedSql[i-1] : '';
  
  if (char === '(') {
    depth++;
    if (depth <= 2) {
      console.log(`  pos ${i}: '(' depth=${depth} (${normalizedSql.substring(i, i+20).trim()}...)`);
    }
  } else if (char === ')') {
    if (depth <= 2) {
      console.log(`  pos ${i}: ')' depth=${depth} (${normalizedSql.substring(Math.max(0,i-15), i+1)})`);
    }
    depth--;
    if (depth === 0) {
      bodyEnd = i;
      console.log(`  => bodyEnd = ${i}`);
      break;
    }
  }
}

console.log();
console.log("body:", normalizedSql.substring(bodyStart, bodyEnd));
