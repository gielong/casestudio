import { parseSqlDDL } from './src/utils/sqlParser';

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

const result = parseSqlDDL(sql);
console.log(JSON.stringify(result, null, 2));
