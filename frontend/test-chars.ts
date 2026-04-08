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

console.log("Full SQL with positions:");
for (let i = 0; i < normalizedSql.length; i++) {
  const c = normalizedSql[i];
  const display = c === ' ' ? '_' : c;
  console.log(`${i.toString().padStart(3)}: '${display}'`);
}
