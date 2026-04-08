// Test the splitting logic directly
const body = "[ItemId] Uniqueidentifier NOT NULL, [Cmpy_Id] Uniqueidentifier NOT NULL, [iName] Nvarchar(50) NOT NULL, [iPrice] Float NOT NULL, Primary Key ([ItemId])";
const defs: string[] = [];
let current = '';
let parenDepth = 0;

for (const char of body) {
  if (char === '(') {
    parenDepth++;
    current += char;
  } else if (char === ')') {
    parenDepth--;
    current += char;
  } else if (char === ',' && parenDepth === 0) {
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

console.log("Defs:", defs);

// Now test column parsing
const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;

for (const def of defs) {
  const cleaned = def.replace(/\[(\w+)\]/g, '$1');
  console.log("Def:", cleaned);
  const colMatch = cleaned.match(COLUMN_REGEX);
  console.log("Match:", colMatch);
}
