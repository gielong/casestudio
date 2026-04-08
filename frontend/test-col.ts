// Debug column parsing
const def = "[ItemId] Uniqueidentifier NOT NULL";
const cleaned = def.replace(/\[(\w+)\]/g, '$1');
console.log("Cleaned:", cleaned);

// Original regex
const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;
const colMatch = cleaned.match(COLUMN_REGEX);
console.log("Match:", colMatch);

// Try simpler approach
const SIMPLE_REGEX = /^(\w+)\s+(\w+(?:\([\d,\s]+\))?)/i;
const simpleMatch = cleaned.match(SIMPLE_REGEX);
console.log("Simple match:", simpleMatch);
