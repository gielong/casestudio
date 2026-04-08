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

console.log("=== Testing TABLE_PATTERN ===");
let match;
while ((match = TABLE_PATTERN.exec(sql)) !== null) {
    console.log("MATCH:", match[1]);
    console.log("BODY:", match[2].substring(0, 100));
    console.log("---");
}

console.log("\n=== Testing normalized ===");
const normalizedSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
console.log("Normalized SQL:", normalizedSql);
