// Test column with VARCHAR
const def = "[iName] Nvarchar(50) NOT NULL";
const cleaned = def.replace(/\[(\w+)\]/g, '$1');
console.log("Cleaned:", cleaned);

const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;
const colMatch = cleaned.match(COLUMN_REGEX);
console.log("Match:", colMatch);

// The issue: regex expects word then optional (number) for the TYPE
// But we have: Nvarchar(50) - Nvarchar has no number in \w+ pattern before ()

const DEFECTIVE_REGEX = /^(\w+)\s+(\w+)\s*\(([^)]+)\)/i;
const improvedMatch = cleaned.match(DEFECTIVE_REGEX);
console.log("Improved match:", improvedMatch);
