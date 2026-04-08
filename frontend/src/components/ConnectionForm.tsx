import { type ConnectionRequest } from '../api/client';

export default function ConnectionForm() {
  return (
    <div className="connection-placeholder">
      <div className="section-title">🔌 資料庫連線</div>
      <div className="placeholder-message">
        <p>連線讀取資料庫結構功能需要後端服務。</p>
        <p>目前為純前端模式，請使用 ER 圖編輯器手動建立資料結構。</p>
        <p className="hint">或匯入已有的 JSON 專案檔案。</p>
      </div>
    </div>
  );
}
