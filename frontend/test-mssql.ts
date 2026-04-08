import { parseSqlDDL } from './src/utils/sqlParser';

const sql = `Create table [sItem]
(
 [ItemId] Uniqueidentifier NOT NULL,
 [Cmpy_Id] Uniqueidentifier NOT NULL,
 [OrgId] Uniqueidentifier NOT NULL,
 [ParentId] Uniqueidentifier NOT NULL,
 [iNumber] Varchar(100) NOT NULL,
 [iModel] Nvarchar(100) NULL,
 [iPNCode] Varchar(50) NULL,
 [iBarcode] Varchar(50) NULL,
 [iName] Nvarchar(50) NOT NULL,
 [iName2] Nvarchar(100) NULL,
 [iBrandID] Uniqueidentifier NULL,
 [iBrand] Nvarchar(100) NULL,
 [iSort] Integer NOT NULL,
 [iUnit] Nvarchar(10) NULL,
 [iPriceBase] Float NOT NULL,
 [iPrice] Float NOT NULL,
 [iPrice2] Float NOT NULL,
 [iPrice3] Float NULL,
 [iPrice4] Float NULL,
 [iPrice5] Float NULL,
 [iPrice6] Float NULL,
 [iSPQ] Integer NOT NULL,
 [iSNControl] Integer Default 0 NOT NULL,
 [iType] Integer NOT NULL,
 [iDel] Bit Default 0 NOT NULL,
 [iNoImport] Bit Default 0 NOT NULL,
 [iMemo] Nvarchar(2000) NULL,
 [sysMemo] Nvarchar(200) NULL,
 [updater] Uniqueidentifier NOT NULL,
 [updated] Datetime NOT NULL,
Primary Key ([ItemId])
) 
go

Create table [Users]
(
 [Id] Uniqueidentifier NOT NULL,
 [UserName] Varchar(255) NOT NULL, UNIQUE ([UserName]),
 [NormalizedUserName] Varchar(255) NULL,
 [PasswordHash] Nvarchar(2000) NOT NULL,
 [NickName] Nvarchar(100) NULL,
 [SignUpTime] Datetime NOT NULL,
 [Email] Varchar(255) NULL,
 [NormalizedEmail] Varchar(255) NULL,
 [EmailConfirmed] Bit Default 0 NOT NULL,
 [EmailVerifed] Datetime NULL,
 [PhoneNumber] Varchar(255) NULL,
 [PhoneNumberConfirmed] Bit Default 0 NOT NULL,
 [PhoneNumberVerifed] Datetime NULL,
 [AccessFailedCount] Integer Default 0 NOT NULL,
 [LockoutEnabled] Bit Default 0 NOT NULL,
 [LockoutEnd] Datetime NULL,
 [SecurityStamp] Nvarchar(2000) NULL,
 [ConcurrencyStamp] Uniqueidentifier NULL,
 [TwoFactorEnabled] Bit Default 1 NOT NULL,
 [UserSort] Integer NULL,
Primary Key ([Id])
) 
go`;

const result = parseSqlDDL(sql);
console.log(JSON.stringify(result, null, 2));
