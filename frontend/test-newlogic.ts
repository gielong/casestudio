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

const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
const tableMatch = [...normalizedSql.matchAll(tablePattern)][0];
const matchStart = tableMatch.index!;
const parenPos = matchStart + tableMatch[0].length - 1;

console.log("tableMatch[0]:", tableMatch[0]);
console.log("matchStart:", matchStart, "parenPos:", parenPos);
console.log("Char at parenPos:", normalizedSql[parenPos]);

// Find matching closing paren
let depth = 0;
let bodyEnd = -1;
let i = parenPos;

while (i < normalizedSql.length) {
  const char = normalizedSql[i];
  
  if (char === '(') {
    const prevChar = i > 0 ? normalizedSql[i - 1] : ' ';
    if (/[a-zA-Z0-9]/.test(prevChar)) {
      console.log(`pos ${i}: skipping data type paren (prev: ${prevChar})`);
      let nested = 1;
      i++;
      while (i < normalizedSql.length && nested > 0) {
        if (normalizedSql[i] === '(') nested++;
        else if (normalizedSql[i] === ')') nested--;
        i++;
      }
      continue;
    }
    console.log(`pos ${i}: '(' depth=${depth + 1}`);
    depth++;
  } else if (char === ')') {
    console.log(`pos ${i}: ')' depth=${depth}`);
    if (depth === 0) {
      bodyEnd = i;
      console.log(`  => bodyEnd = ${i}`);
      break;
    }
    depth--;
  }
  i++;
}

console.log("bodyEnd:", bodyEnd);
if (bodyEnd !== -1) {
  console.log("Body:", normalizedSql.substring(parenPos + 1, bodyEnd));
}
