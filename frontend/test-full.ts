const TABLE_PATTERN = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\)(?:\s*ENGINE|\s*DEFAULT|\s*COMMENT|\s*PRIMARY|$)/gim;

const sql = `CREATE TABLE Users (
    Id INT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(255) UNIQUE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Orders (
    Id INT PRIMARY KEY,
    UserId INT NOT NULL,
    Total DECIMAL(10,2),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);`;

const normalizedSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();

let tableMatch;
const tableRegex = new RegExp(TABLE_PATTERN.source, 'gi');

while ((tableMatch = tableRegex.exec(normalizedSql)) !== null) {
    const tableName = tableMatch[1];
    console.log("Parsing table:", tableName);
    
    const columnsStr = tableMatch[2];
    console.log("Columns str:", columnsStr.substring(0, 100));
    
    // Split by comma, but respect parentheses
    const columnDefs: string[] = [];
    let current = '';
    let depth = 0;
    for (const char of columnsStr) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            columnDefs.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        columnDefs.push(current.trim());
    }
    
    console.log("Column defs count:", columnDefs.length);
    for (const def of columnDefs) {
        console.log("  DEF:", def.substring(0, 60));
    }
    console.log("---");
}
