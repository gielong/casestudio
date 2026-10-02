import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import ConnectionForm from './components/ConnectionForm';
import SchemaViewer from './components/SchemaViewer';
import ERDiagramEditor from './components/ERDiagramEditor';
import RequirementsManager from './components/RequirementsManager';
import UseCaseEditor from './components/UseCaseEditor';
import FlowChartEditor from './components/FlowChartEditor';
import { useStore, type Page } from './store/useStore';
import { loadFromLocal, createEmptyProject, saveToLocal } from './store/storage';

const MOBILE_QUERY = '(max-width: 768px)';

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'connect', label: '連線', icon: '🔌' },
  { page: 'schema', label: '結構', icon: '🗃️' },
  { page: 'er-diagram', label: 'ER 圖', icon: '📐' },
  { page: 'requirements', label: '需求', icon: '📋' },
  { page: 'usecase', label: '用例圖', icon: '👤' },
  { page: 'flowchart', label: '流程圖', icon: '🔄' },
  { page: 'versions', label: '版本', icon: '📦' },
  { page: 'documents', label: '文件', icon: '📄' },
  { page: 'audit', label: '日誌', icon: '📝' },
];

function App() {
  const { activePage, setActivePage, erEntities, erRelationships, erSubmodels, setErEntities, setErRelationships, setErSubmodels } = useStore();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_QUERY).matches);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Keep responsive layout state in one place instead of mixing JS pixel values with CSS.
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      setSidebarOpen(!event.matches);
    };

    media.addEventListener('change', handleViewportChange);
    return () => media.removeEventListener('change', handleViewportChange);
  }, []);

  // Load from localStorage on app start
  useEffect(() => {
    const saved = loadFromLocal();
    if (saved) {
      if (saved.erEntities.length > 0 || saved.erRelationships.length > 0) {
        setErEntities(saved.erEntities);
        setErRelationships(saved.erRelationships);
      }
      setErSubmodels(saved.erSubmodels ?? []);
      setLastSavedSnapshot(JSON.stringify({ entities: saved.erEntities, relationships: saved.erRelationships, submodels: saved.erSubmodels ?? [] }));
    } else {
      // Save initial empty project to localStorage
      const empty = createEmptyProject('case-studio');
      saveToLocal(empty);
    }
  }, []);

  // Auto-save to localStorage when data changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      const data = createEmptyProject('case-studio');
      data.erEntities = erEntities;
      data.erRelationships = erRelationships;
      data.erSubmodels = erSubmodels;
      saveToLocal(data);
      setLastSavedSnapshot(JSON.stringify({ entities: erEntities, relationships: erRelationships, submodels: erSubmodels }));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [erEntities, erRelationships, erSubmodels]);

  const currentSnapshot = JSON.stringify({ entities: erEntities, relationships: erRelationships, submodels: erSubmodels });
  const hasUnsavedChanges = lastSavedSnapshot !== '' && currentSnapshot !== lastSavedSnapshot;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (hasUnsavedChanges) {
        setShowExitConfirm(true);
      } else if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [hasUnsavedChanges]);

  const renderContent = useCallback(() => {
    switch (activePage) {
      case 'connect':
        return <ConnectionForm />;
      case 'schema':
        return <SchemaViewer />;
      case 'er-diagram':
        return <ERDiagramEditor />;
      case 'requirements':
        return <RequirementsManager />;
      case 'usecase':
        return <UseCaseEditor />;
      case 'flowchart':
        return <FlowChartEditor />;
      case 'versions':
        return <div className="placeholder">版本控管（待實作）</div>;
      case 'documents':
        return <div className="placeholder">文件產出（待實作）</div>;
      case 'audit':
        return <div className="placeholder">操作日誌（待實作）</div>;
      default:
        return <ERDiagramEditor />;
    }
  }, [activePage]);

  return (
    <ReactFlowProvider>
      <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <nav className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <h1><span className="brand-icon">🗂️</span><span className="brand-text">CaseTool</span></h1>
            <span className="subtitle">CASE 開發輔助工具</span>
          </div>
          <div className="nav-items">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.page}
                className={`nav-item ${activePage === item.page ? 'active' : ''}`}
                onClick={() => {
                  setActivePage(item.page);
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-version">v2026.10.02.016</div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? '隱藏側邊欄' : '顯示側邊欄'}
            aria-label={sidebarOpen ? '隱藏側邊欄' : '顯示側邊欄'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '◀️' : '▶️'}
          </button>
        </nav>
        <main className="main-canvas">
          {renderContent()}
        </main>
        {showExitConfirm && (
          <div className="modal-overlay" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal" style={{ maxWidth: 440 }}>
              <h3>尚有修改</h3>
              <p>目前內容尚未完成自動儲存。要先儲存再退出目前操作嗎？</p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => {
                  const data = createEmptyProject('case-studio');
                  data.erEntities = erEntities; data.erRelationships = erRelationships; data.erSubmodels = erSubmodels;
                  saveToLocal(data); setLastSavedSnapshot(currentSnapshot); setShowExitConfirm(false);
                }}>💾 儲存</button>
                <button className="btn" onClick={() => setShowExitConfirm(false)}>取消（不退出）</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}

export default App;
