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
console.log("Length:", normalizedSql.length);
console.log();

// Find table
const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
const tableMatch = [...normalizedSql.matchAll(tablePattern)][0];
console.log("tableMatch[0]:", tableMatch[0]);
console.log("tableMatch[1]:", tableMatch[1]);
console.log("matchStart:", tableMatch.index);

// Find body end
const findTableBodyEnd = (sql: string, startPos: number): number => {
  let parenPos = -1;
  for (let i = startPos; i < sql.length; i++) {
    if (sql[i] === '(') {
      parenPos = i;
      break;
    }
  }
  if (parenPos === -1) return -1;
  
  console.log("parenPos:", parenPos, "char:", sql[parenPos]);
  
  let depth = 0;
  for (let i = parenPos; i < sql.length; i++) {
    const char = sql[i];
    if (char === '(') {
      depth++;
      console.log(`  pos ${i}: '(' depth=${depth} (${sql.substring(i, i+30)})`);
    } else if (char === ')') {
      console.log(`  pos ${i}: ')' depth=${depth}`);
      depth--;
      if (depth === 0) {
        console.log(`  => bodyEnd = ${i}`);
        return i;
      }
    }
  }
  return -1;
};

const bodyEnd = findTableBodyEnd(normalizedSql, tableMatch.index! + tableMatch[0].length);
const parenPos = tableMatch.index! + tableMatch[0].length - 1;
const bodyStart = parenPos + 1;
console.log();
console.log("bodyStart:", bodyStart, "bodyEnd:", bodyEnd);
console.log("Body:", normalizedSql.substring(bodyStart, bodyEnd));
