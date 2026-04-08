# CaseTool 技術手冊

> CASE 開發輔助工具 — 資料庫前期建置、紀錄與維護

---

## 目錄

1. [專案概述](#專案概述)
2. [技術架構](#技術架構)
3. [目錄結構](#目錄結構)
4. [核心模組說明](#核心模組說明)
5. [狀態管理](#狀態管理)
6. [本地儲存](#本地儲存)
7. [元件說明](#元件說明)
8. [開發指南](#開發指南)
9. [部署方式](#部署方式)
10. [開發歷程](#開發歷程)

---

## 專案概述

CaseTool 是一個類似 CASE Studio 的 Web-based 資料庫設計工具，用於：

- **資料庫設計** — ER 圖繪製、正規化分析、DDL 生成
- **需求分析** — 需求文件管理、用例圖、流程圖
- **文件產出** — SQL 腳本匯出、JSON 專案檔存取
- **版本控管** — 設計版本比較與變更追蹤

### 設計原則

- **純前端** — 無後端依賴，可離線使用
- **本地儲存** — localStorage + JSON 檔案匯入匯出
- **零部署** — 純靜態檔案，任何 Web Server 都能跑

---

## 技術架構

| 層級 | 技術 | 版本 |
|------|------|------|
| 前端框架 | React | 18+ |
| 語言 | TypeScript | 5.x |
| 建置工具 | Vite | 6.x |
| 畫布 | React Flow | 11.x |
| 狀態管理 | Zustand | 5.x |
| 樣式 | 純 CSS（Catppuccin Mocha 主題）| — |

### 為什麼選這些技術

- **React + TypeScript** — 型別安全、生態成熟
- **Vite** — 極速 HMR、輕量建置
- **React Flow** — 專業級節點圖編輯器，支援拖放、連線、縮放
- **Zustand** — 比 Redux 輕量，無需 Provider，支援選擇性訂閱

---

## 目錄結構

```
case-tool/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts          # 型別定義（TypeScript interfaces）
│   │   ├── components/
│   │   │   ├── App.tsx            # 主應用（導航 + 頁面路由）
│   │   │   ├── ConnectionForm.tsx  # 資料庫連線表單（提示模式）
│   │   │   ├── ERDiagramEditor.tsx # ER 圖編輯器（主頁面）
│   │   │   ├── EntityNode.tsx      # ER 實體節點元件
│   │   │   ├── FieldEditorModal.tsx # 欄位編輯器（Modal 彈窗）
│   │   │   ├── RequirementsManager.tsx # 需求管理
│   │   │   ├── UseCaseEditor.tsx   # 用例圖編輯器
│   │   │   └── FlowChartEditor.tsx # 流程圖編輯器
│   │   ├── store/
│   │   │   ├── useStore.ts         # Zustand 狀態管理
│   │   │   ├── storage.ts          # 本地儲存層（localStorage + JSON）
│   │   │   ├── ddl-generator.ts    # DDL 生成器
│   │   │   └── normalization.ts    # 正規化引擎
│   │   ├── index.css               # 全域樣式
│   │   └── main.tsx                # 入口檔案
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/
│   └── technical-manual.md         # 本文件
└── README.md
```

---

## 核心模組說明

### 1. ER 圖編輯器 (`ERDiagramEditor.tsx`)

**功能：**
- 新增/刪除 Entity（透過 Modal 編輯視窗）
- 拖放 Entity 位置
- 從 Entity A 拉線到 Entity B 自動建立 Relationship
- 自動建立 FK（將來源 PK 複製到目標 Entity）
- 點擊連線編輯/刪除 Relationship
- 匯出 SQL（MySQL/PostgreSQL/MSSQL）
- 儲存到 localStorage
- 匯出/匯入 JSON 專案檔

**編輯模式：**
- Entity 編輯 → Modal 彈窗（點擊 Entity 觸發）
- Relationship 編輯 → 右側面板（點擊連線觸發）

**使用 React Flow：**
```typescript
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';

// 自訂節點類型
const nodeTypes: NodeTypes = { entity: EntityNode };

// 節點（Entity）
const nodes: Node[] = erEntities.map(entity => ({
  id: entity.id,
  type: 'entity',
  position: { x: entity.x, y: entity.y },
  data: { entity },
}));

// 邊（Relationship）
const edges: Edge[] = erRelationships.map(rel => ({
  id: rel.id,
  source: rel.sourceEntityId,
  target: rel.targetEntityId,
  label: rel.name,
  // ... style, markers
}));
```

**核心事件處理：**
- `onNodesChange` — 拖放時更新 Entity 位置
- `onConnect` — 建立連線時自動建立 FK + Relationship
- `onEdgeClick` — 點擊連線選中編輯

### 2. Entity 節點 (`EntityNode.tsx`)

**排版：**
```
┌───────────────────────────────────┐
│          Entity Name              │  ← header（accent 色）
├───────────────────────────────────┤
│ 🔑 id              INT  PK,NN     │  ← 名稱靠左，類型靠右
│ ·  name         VARCHAR(255)      │
│ 🔗 fk_id           INT  FK,NN     │
└───────────────────────────────────┘
```

**備註顯示：** 若 Entity 有備註，在節點底部顯示灰色備註文字。

**顏色編碼：**
- PK → 紅色 `#f38ba8`
- FK → 藍色 `#89b4fa`
- NOT NULL → 綠色 `#a6e3a1`
- 預設 → 灰色 `#cdd6f4`

### 3. 欄位編輯器 (`FieldEditorModal.tsx`)

**以 Modal 彈窗形式呈現**，點擊 Entity 節點觸發。

**功能：**
- Entity 名稱與備註編輯
- 新增/刪除欄位
- 欄位名稱、資料類型編輯（行內直接編輯）
- 欄位長度/精度**行內直接顯示與編輯**（無需展開）
- PK/FK/NULL/UQ 旗標切換
- 複合 PK 支援（可勾選多個欄位為 PK）
- 欄位備註
- 預設值設定
- FK 關聯選擇（關聯 Entity + 關聯欄位）
- 刪除 Entity（含確認對話框）

**資料結構：**
```typescript
interface ERField {
  id: string;
  name: string;
  dataType: string;
  length: number | null;      // VARCHAR 等的長度
  precision: number | null;   // DECIMAL 的精度
  scale: number | null;       // DECIMAL 的小數位
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue: string;
  referencedEntity: string;
  referencedField: string;
  notes: string;              // 欄位備註
}

interface EREntity {
  id: string;
  name: string;
  notes: string;              // Entity 備註
  x: number;
  y: number;
  fields: ERField[];
}
```

### 4. DDL 生成器 (`ddl-generator.ts`)

**支援目標：**
- MySQL — 使用反引號 `` ` ``
- PostgreSQL — 使用雙引號 `"`
- MSSQL — 使用方括號 `[]`

**類型映射範例：**
```typescript
// MySQL
NVARCHAR → VARCHAR
DATETIME2 → DATETIME
BIT → TINYINT(1)

// PostgreSQL
NVARCHAR → VARCHAR
DATETIME → TIMESTAMP
BIT → BOOLEAN
INT → INTEGER
```

**輸出格式：**
```sql
CREATE TABLE `users` (
  `id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  CONSTRAINT `PK_users` PRIMARY KEY (`id`)
);

ALTER TABLE `orders`
  ADD CONSTRAINT `FK_orders_user_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
```

### 5. 正規化引擎 (`normalization.ts`)

**檢查項目：**
- **1NF** — 檢查多值欄位、重複群組
- **2NF** — 檢查部分依賴（僅對複合 PK）
- **3NF** — 檢查傳遞依賴

**啟發式檢測：**
- 欄位名包含 `list`、`items`、`tags` → 疑似多值
- 數字後綴欄位群（`phone1`、`phone2`）→ 疑似重複群組
- 同前綴欄位群 + ID 欄位 → 疑似傳遞依賴

---

## 狀態管理

### Zustand Store (`useStore.ts`)

```typescript
interface AppState {
  // ER Diagram
  erEntities: EREntity[];
  erRelationships: ERRelationship[];
  // ... CRUD actions

  // Requirements
  requirements: Requirement[];
  // ... CRUD actions

  // Use Case
  useCaseActors: UseCaseActor[];
  useCaseItems: UseCaseItem[];
  useCaseRelations: UseCaseRelation[];

  // Flow Chart
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];

  // UI State
  activePage: Page;
  selectedEntityId: string | null;
  rightPanel: 'fields' | 'normalize' | 'ddl' | null;
}
```

**使用方式：**
```typescript
// 在元件中使用
const { erEntities, addErEntity } = useStore();

// 選擇性訂閱（效能優化）
const selectedEntity = useStore(s =>
  s.erEntities.find(e => e.id === s.selectedEntityId)
);
```

---

## 本地儲存

### Storage Layer (`storage.ts`)

**儲存策略：**
1. **自動儲存** — 每次操作後寫入 localStorage
2. **手動儲存** — 「💾 儲存」按鈕
3. **匯出檔案** — 「📁 另存檔案」→ JSON 檔案（File System Access API）
4. **匯入檔案** — 「📂 開啟檔案」→ 從 JSON 載入

**JSON 格式：**
```json
{
  "version": "1.0.0",
  "name": "My Project",
  "erEntities": [...],
  "erRelationships": [...],
  "requirements": [...],
  "updatedAt": "2026-03-25T..."
}
```

**File System Access API：**
- Chrome/Edge 支援原生檔案對話框
- 其他瀏覽器 fallback 為 `<input type="file">` / `<a download>`

---

## 元件說明

### 頁面導航 (`App.tsx`)

9 個頁面，透過 `activePage` 狀態切換：

| 頁面 | 元件 | 功能 |
|------|------|------|
| 🔌 連線 | ConnectionForm | 資料庫連線（提示模式，需後端） |
| 📐 ER 圖 | ERDiagramEditor | ER 圖設計（核心功能） |
| 📋 需求 | RequirementsManager | 需求文件管理 |
| 👤 用例圖 | UseCaseEditor | 用例圖繪製 |
| 🔄 流程圖 | FlowChartEditor | 流程圖繪製 |

### CSS 主題

採用 **Catppuccin Mocha** 深色主題：

```css
:root {
  --bg: #1e1e2e;           /* 背景 */
  --bg-surface: #272739;   /* 卡片/面板 */
  --text: #cdd6f4;         /* 主要文字 */
  --accent: #89b4fa;       /* 主色（藍） */
  --success: #a6e3a1;      /* 成功（綠） */
  --warning: #f9e2af;      /* 警告（黃） */
  --error: #f38ba8;        /* 錯誤（紅） */
}
```

---

## 開發指南

### 環境需求

- Node.js 18+
- pnpm 或 npm

### 啟動開發

```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:5173
```

### 建置

```bash
pnpm build
# → dist/
```

### 新增頁面

1. 在 `src/components/` 建立元件
2. 在 `src/store/useStore.ts` 加入 state
3. 在 `src/App.tsx` 加入導航項目
4. 在 `src/index.css` 加入樣式

### 新增資料類型

1. 在 `src/api/client.ts` 定義 interface
2. 在 `src/store/useStore.ts` 加入 state + actions
3. 在 `src/store/storage.ts` 更新 `ProjectData`

---

## 部署方式

### 靜態部署

```bash
pnpm build
# 將 dist/ 上傳到任何 Web Server
```

### 本地預覽

```bash
pnpm build
pnpm preview
# → http://localhost:4173
```

### Docker（選用）

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY frontend/ .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

---

## 開發歷程

### Phase 1 — 專案骨架
- 建立 React + TypeScript + Vite 專案
- 建立基本 ER 圖編輯器
- 使用 React Flow 實現拖放

### Phase 2 — ER 圖功能
- Entity 節點元件
- Relationship 連線
- 欄位編輯器（PK/FK/類型）
- 正規化引擎
- DDL 生成器

### Phase 3 — 需求分析
- 需求文件管理（CRUD）
- 用例圖編輯器
- 流程圖編輯器

### Phase 4 — 優化
- 移除 .NET 後端，改為純前端
- 本地儲存（localStorage + JSON）
- 匯出 SQL（本地生成）
- 匯出/匯入專案檔

### Phase 5 — UI 改進
- Entity 編輯改為 Modal 彈窗（取代右側面板）
- 新增 Entity 和 Field 備註屬性
- 欄位長度/精度行內直接編輯（無需展開）
- 複合 PK 支援
- Relationship 線選中編輯/刪除

### 關鍵決策

| 決策 | 原因 |
|------|------|
| 純前端 | 部署簡單、離線可用、無需 .NET runtime |
| Zustand > Redux | 更輕量、無需 Provider、API 簡潔 |
| React Flow > D3 | 專業節點圖、開箱即用、TypeScript 支援好 |
| localStorage + JSON | 無後端依賴、使用者可自行備份檔案 |
| CSS > Tailwind | 減少依賴、主題一致性好控 |

---

## 已知限制

1. **資料庫連線** — 需要後端才能讀取遠端資料庫結構（目前為提示模式）
2. **多使用者協作** — 目前為單機版，無即時同步
3. **正規化分析** — 基於啟發式，非完整演算法
4. **PDF 匯出** — 尚未整合

---

## 參考資源

- [React Flow 文件](https://reactflow.dev/)
- [Zustand 文件](https://zustand-demo.pmnd.rs/)
- [Vite 文件](https://vitejs.dev/)
- [Catppuccin 主題](https://catppuccin.com/)

---

*最後更新：2026-03-25 v1.1*
