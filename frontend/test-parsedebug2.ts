// Manual trace of the parser
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

console.log("Normalized:", normalizedSql);

// Find tables
const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
const tableMatches = [...normalizedSql.matchAll(tablePattern)];
console.log("Tables:", tableMatches.map(m => m[1]));

// For first table
const tableMatch = tableMatches[0];
const tableName = tableMatch[1];
const matchStart = tableMatch.index!;

// bodyStart is immediately after the opening parenthesis
const bodyStart = matchStart + tableMatch[0].length;

console.log("Table:", tableName, "matchStart:", matchStart, "bodyStart:", bodyStart);
console.log("Text from bodyStart:", normalizedSql.substring(bodyStart, bodyStart + 50));

// Find body end
let depth = 0;
let bodyEnd = -1;

for (let i = bodyStart; i < normalizedSql.length; i++) {
  const char = normalizedSql[i];
  if (char === '(') {
    depth++;
  } else if (char === ')') {
    depth--;
    if (depth === 0) {
      bodyEnd = i;
      break;
    }
  }
}

console.log("bodyEnd:", bodyEnd);
console.log("Body:", normalizedSql.substring(bodyStart, bodyEnd));

// Find PK
const PK_REGEX = /PRIMARY\s+KEY\s*\(([^)]+)\)/i;
const fullStatement = normalizedSql.substring(tableMatch.index!, bodyEnd + 1);
console.log("Full statement:", fullStatement);
const pkMatch = fullStatement.match(PK_REGEX);
console.log("PK match:", pkMatch);
