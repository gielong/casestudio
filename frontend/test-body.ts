// Full trace of parsing
const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [Cmpy_Id] Uniqueidentifier NOT NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iPrice] Float NOT NULL,
Primary Key ([ItemId])
) 
go`;

const normalizedSql = sql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .trim();

console.log("Normalized:", normalizedSql.substring(0, 200));

const batches = normalizedSql.split(/\bgo\b/i);
console.log("Batches:", batches.length);

for (const batch of batches) {
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[?(\w+)\]?\s*\(/gi;
  const tableMatches = [...batch.matchAll(tablePattern)];
  console.log("Tables found:", tableMatches.map(m => m[1]));
  
  for (const tableMatch of tableMatches) {
    const tableName = tableMatch[1];
    const startPos = tableMatch.index! + tableMatch[0].length;
    console.log("Table:", tableName, "startPos:", startPos);
    console.log("Looking at:", batch.substring(startPos, startPos + 50));
    
    // Find closing paren
    let depth = 0;
    let bodyStart = -1;
    let bodyEnd = -1;
    
    for (let i = startPos; i < batch.length; i++) {
      const char = batch[i];
      if (char === '(') {
        if (depth === 0) bodyStart = i + 1;
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    
    console.log("bodyStart:", bodyStart, "bodyEnd:", bodyEnd);
    if (bodyStart !== -1 && bodyEnd !== -1) {
      const body = batch.substring(bodyStart, bodyEnd);
      console.log("Body:", body.substring(0, 100));
    }
  }
}
