// Debug the MSSQL parsing
const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [Cmpy_Id] Uniqueidentifier NOT NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iPrice] Float NOT NULL,
Primary Key ([ItemId])
) 
go`;

const CREATE_TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi;

// Find all CREATE TABLE statements - case insensitive
const tableMatches = [...sql.matchAll(new RegExp(CREATE_TABLE_REGEX.source, 'gi'))];
console.log("Found tables:", tableMatches.map(m => m[1]));

// Now test with square brackets
const BRACKET_TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[(\w+)\]/gi;
const bracketMatches = [...sql.matchAll(BRACKET_TABLE_REGEX)];
console.log("Found tables (bracket):", bracketMatches.map(m => m[1]));

// The problem: our regex uses `?(\w+)` which doesn't match [ItemId]
// because the pattern [^"']? expects characters that are NOT brackets
