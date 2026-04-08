# case-studio

> 🗂️ 資料庫前期建置工具 — ER 圖、需求管理、用例圖、流程圖

## 功能

- 📐 **ER 圖編輯器** — 拖放式 Entity 設計、Relationship 連線、自動 FK
- 📋 **需求管理** — 需求文件 CRUD、標籤、優先級
- 👤 **用例圖** — 參與者、系統邊界、關係
- 🔄 **流程圖** — 開始/結束/判斷節點
- 📤 **SQL 匯出** — MySQL / PostgreSQL / MSSQL
- 💾 **本地儲存** — localStorage + JSON 檔案匯入匯出
- 🔍 **正規化分析** — 1NF / 2NF / 3NF 檢查

## 技術

React 18 + TypeScript + Vite + React Flow + Zustand

## 快速開始

```bash
cd frontend
pnpm install
pnpm dev
```

開啟 http://localhost:5173

## 建置

```bash
pnpm build
# 輸出到 dist/
```

## 文件

- [技術手冊](docs/technical-manual.md)

## 授權

MIT
