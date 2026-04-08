const COLUMN_REGEX = /^(\[(\w+)\]|(\w+))\s+(\w+(?:\([\d,\s]+\))?)/i;

const tests = [
  "ItemId Uniqueidentifier NOT NULL",
  "iName Nvarchar(50) NOT NULL",
  "iPrice Float NOT NULL",
  "Primary Key (ItemId)"
];

for (const test of tests) {
  const match = test.match(COLUMN_REGEX);
  console.log(`"${test}" => ${match ? 'matched: ' + JSON.stringify({name: match[2]||match[3], type: match[4]}) : 'NO MATCH'}`);
}
