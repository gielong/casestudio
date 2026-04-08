import { useCallback, useEffect, useState } from 'react';
import ConnectionForm from './components/ConnectionForm';
import SchemaViewer from './components/SchemaViewer';
import ERDiagramEditor from './components/ERDiagramEditor';
import RequirementsManager from './components/RequirementsManager';
import UseCaseEditor from './components/UseCaseEditor';
import FlowChartEditor from './components/FlowChartEditor';
import { useStore, type Page } from './store/useStore';
import { loadFromLocal, createEmptyProject, saveToLocal } from './store/storage';

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
  const { activePage, setActivePage, erEntities, erRelationships, setErEntities, setErRelationships } = useStore();
  // Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Load from localStorage on app start
  useEffect(() => {
    const saved = loadFromLocal();
    if (saved) {
      if (saved.erEntities.length > 0 || saved.erRelationships.length > 0) {
        setErEntities(saved.erEntities);
        setErRelationships(saved.erRelationships);
      }
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
      saveToLocal(data);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [erEntities, erRelationships]);

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
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <nav className={`sidebar ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="sidebar-header">
          <h1>🗂️ CaseTool</h1>
          <span className="subtitle">CASE 開發輔助工具</span>
        </div>
        <div className="nav-items">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${activePage === item.page ? 'active' : ''}`}
              onClick={() => setActivePage(item.page)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="main-canvas">
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? '隱藏側邊欄' : '顯示側邊欄'}
        >
          {sidebarOpen ? '☰' : '☰'}
        </button>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
