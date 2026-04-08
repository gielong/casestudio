// Test extractColumnDefinitions with the actual body
const body = "[ItemId] Uniqueidentifier NOT NULL, [iName] Nvarchar(50) NOT NULL, [iPrice] Float NOT NULL, Primary Key ([ItemId])";

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
console.log("Number of defs:", defs.length);

// Test each def
const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;
const isConstraintDef = (def) => {
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
};

for (const def of defs) {
  const isConstraint = isConstraintDef(def);
  const cleaned = def.replace(/\[(\w+)\]/g, '$1');
  const match = cleaned.match(COLUMN_REGEX);
  console.log(`Def: "${def}"`);
  console.log(`  isConstraint: ${isConstraint}, cleaned: "${cleaned}", match: ${match ? 'yes' : 'no'}`);
}
