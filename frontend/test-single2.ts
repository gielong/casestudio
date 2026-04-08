import { parseSqlDDL } from './src/utils/sqlParser';

const sql = `[ItemId] Uniqueidentifier NOT NULL, [iName] Nvarchar(50) NOT NULL, [iPrice] Float NOT NULL, Primary Key ([ItemId])`;

const result = parseSqlDDL(sql);
console.log(JSON.stringify(result, null, 2));
