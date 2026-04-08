import { parseSqlDDL } from './src/utils/sqlParser';

const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [Cmpy_Id] Uniqueidentifier NOT NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iPrice] Float NOT NULL,
Primary Key ([ItemId])
) 
go`;

const result = parseSqlDDL(sql);
console.log(JSON.stringify(result, null, 2));
