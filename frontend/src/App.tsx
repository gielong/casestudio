import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import ConnectionForm from './components/ConnectionForm';
import SchemaViewer from './components/SchemaViewer';
import ERDiagramEditor from './components/ERDiagramEditor';
import RequirementsManager from './components/RequirementsManager';
import UseCaseEditor from './components/UseCaseEditor';
import FlowChartEditor from './components/FlowChartEditor';
import CodeGenerator from './components/CodeGenerator';
import { useStore, type Page } from './store/useStore';
import { loadFromLocal, createEmptyProject, saveToLocal, type ProjectData } from './store/storage';
import { connectDrive, disconnectDrive, getGoogleClientId, setGoogleClientId, isDriveConnected, listDriveProjects, readDriveProject, saveDriveProject, type DriveProject } from './store/google-drive';

const MOBILE_QUERY = '(max-width: 768px)';

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'er-diagram', label: 'ER 圖', icon: '📐' },
  { page: 'codegen', label: '匯出 Pio C#', icon: '⌨️' },
  { page: 'connect', label: '連線', icon: '🔌' },
  { page: 'schema', label: '結構', icon: '🗃️' },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveProjects, setDriveProjects] = useState<DriveProject[]>([]);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('case-studio');
  const [clientId, setClientId] = useState(getGoogleClientId);
  const [driveStatus, setDriveStatus] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const skipSave = useRef(true);
  const saveGeneration = useRef(0);
  const projectRef = useRef({ name: 'case-studio', fileId: null as string | null });
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const buildProject = () => {
    const data = createEmptyProject(projectRef.current.name);
    data.erEntities = useStore.getState().erEntities;
    data.erRelationships = useStore.getState().erRelationships;
    data.erSubmodels = useStore.getState().erSubmodels;
    return data;
  };
  const applyProject = (data: ProjectData, fileId: string | null) => {
    skipSave.current = true;
    saveGeneration.current++;
    projectRef.current = { name: data.name, fileId };
    setProjectName(data.name);
    setDriveFileId(fileId);
    setErEntities(data.erEntities);
    setErRelationships(data.erRelationships);
    setErSubmodels(data.erSubmodels);
    useStore.getState().setActiveSubmodelId(null);
    saveToLocal(data);
    setLastSavedSnapshot(JSON.stringify({ entities: data.erEntities, relationships: data.erRelationships, submodels: data.erSubmodels }));
  };
  const refreshProjects = async () => setDriveProjects(await listDriveProjects());
  const handleConnect = async () => {
    setDriveBusy(true); setDriveStatus('');
    try {
      if (clientId.trim() !== getGoogleClientId()) setGoogleClientId(clientId);
      await connectDrive();
      setDriveConnected(true);
      await refreshProjects();
      // 首次連線時將目前本機專案建立為雲端專案，後續自動儲存直接寫入 Drive。
      if (!projectRef.current.fileId) {
        const data = buildProject();
        const id = await saveDriveProject(data);
        projectRef.current.fileId = id;
        setDriveFileId(id);
        await refreshProjects();
      }
      setDriveStatus('Google Drive 已連線，後續修改將自動儲存至雲端。');
    } catch (error) { setDriveStatus(error instanceof Error ? error.message : String(error)); }
    finally { setDriveBusy(false); }
  };
  const handleOpenDrive = async (id: string) => {
    if (!id || id === driveFileId) return;
    setDriveBusy(true);
    try {
      await saveQueue.current;
      const data = await readDriveProject(id);
      applyProject(data, id);
      setDriveStatus('已開啟：' + data.name);
    } catch (error) { setDriveStatus(error instanceof Error ? error.message : String(error)); }
    finally { setDriveBusy(false); }
  };
  const handleUploadCurrent = async () => {
    setDriveBusy(true);
    try {
      await saveQueue.current;
      const data = buildProject();
      const id = await saveDriveProject(data);
      projectRef.current.fileId = id; setDriveFileId(id);
      await refreshProjects();
      setDriveStatus('已建立雲端專案：' + data.name);
    } catch (error) { setDriveStatus(error instanceof Error ? error.message : String(error)); }
    finally { setDriveBusy(false); }
  };

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

  // 初始化完成前禁止自動儲存，避免空白模型覆蓋現有資料。
  useEffect(() => {
    const saved = loadFromLocal();
    if (saved) applyProject(saved, null);
    else saveToLocal(createEmptyProject('case-studio'));
    setInitialized(true);
  }, []);

  // 本機為離線備份；連線且已選擇 Drive 專案時同步寫入雲端。
  useEffect(() => {
    if (!initialized) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const generation = ++saveGeneration.current;
    const timeout = setTimeout(() => {
      if (generation !== saveGeneration.current) return;
      const data = buildProject();
      saveToLocal(data);
      setLastSavedSnapshot(JSON.stringify({ entities: data.erEntities, relationships: data.erRelationships, submodels: data.erSubmodels }));
      if (driveConnected && projectRef.current.fileId && isDriveConnected()) {
        const id = projectRef.current.fileId;
        saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
          if (generation !== saveGeneration.current || projectRef.current.fileId !== id) return;
          try { await saveDriveProject(data, id); setDriveStatus('☁️ 已同步至 Google Drive'); }
          catch (error) { setDriveStatus('雲端儲存失敗：' + (error instanceof Error ? error.message : String(error))); }
        });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [initialized, erEntities, erRelationships, erSubmodels, driveConnected]);

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
      case 'codegen':
        return <CodeGenerator />;
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
          <div className="drive-project-controls">
            {driveConnected ? <>
              <label htmlFor="drive-project-select">Google Drive 專案</label>
              <select id="drive-project-select" value={driveFileId || ''} disabled={driveBusy} onChange={e => void handleOpenDrive(e.target.value)}>
                <option value="">目前本機專案：{projectName}</option>
                {driveProjects.map(p => <option key={p.id} value={p.id}>{p.name.replace(/\\.case\\.json$/, '')}</option>)}
              </select>
              <button className="btn btn-xs" disabled={driveBusy} onClick={() => void handleUploadCurrent()}>☁️ 上傳目前專案</button>
              <button className="btn btn-xs" disabled={driveBusy} onClick={() => void refreshProjects().catch(e => setDriveStatus(String(e)))}>重新整理</button>
              <button className="btn btn-xs" onClick={() => {disconnectDrive();setDriveConnected(false);setDriveProjects([]);projectRef.current.fileId=null;setDriveFileId(null);setDriveStatus('已中斷連線');}}>中斷 Drive</button>
            </> : <>
              <label>目前專案</label><div className="drive-local-name">{projectName}</div>
              <input aria-label="Google OAuth Client ID" placeholder="Google OAuth Client ID" value={clientId} onChange={e => setClientId(e.target.value)} />
              <button className="btn btn-xs" disabled={driveBusy} onClick={() => void handleConnect()}>連結 Google Drive</button>
            </>}
            {driveStatus && <small role="status">{driveStatus}</small>}
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
          <div className="sidebar-version">v2026.10.11.030</div>
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
