import { parseSqlDDL } from './src/utils/sqlParser';

// Simple test without go statements
const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iPrice] Float NOT NULL,
Primary Key ([ItemId])
)`;

const result = parseSqlDDL(sql);
console.log(JSON.stringify(result, null, 2));
