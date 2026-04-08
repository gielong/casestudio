// Local JSON storage using localStorage + File System Access API
import type { EREntity, ERRelationship } from '../api/client';

const STORAGE_KEY = 'case-tool-data';

export interface ProjectData {
  version: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  erEntities: EREntity[];
  erRelationships: ERRelationship[];
  requirements: unknown[];
  useCaseData: unknown;
  flowChartData: unknown;
  snapshots: unknown[];
  auditLogs: unknown[];
}

export function createEmptyProject(name = 'Untitled Project'): ProjectData {
  return {
    version: '1.0.0',
    name,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    erEntities: [],
    erRelationships: [],
    requirements: [],
    useCaseData: null,
    flowChartData: null,
    snapshots: [],
    auditLogs: [],
  };
}

// Save to localStorage
export function saveToLocal(data: ProjectData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Load from localStorage
export function loadFromLocal(): ProjectData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProjectData;
  } catch {
    return null;
  }
}

// Export to JSON file (File System Access API)
export async function saveToFile(data: ProjectData): Promise<boolean> {
  data.updatedAt = new Date().toISOString();
  const json = JSON.stringify(data, null, 2);

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${data.name}.json`,
        types: [{ description: 'CaseTool Project', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  // Fallback: download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// Import from JSON file
export async function loadFromFile(): Promise<ProjectData | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'CaseTool Project', accept: { 'application/json': ['.json'] } }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as ProjectData;
    } catch {
      return null;
    }
  }

  // Fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string) as ProjectData);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// Auto-save helper
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function autoSave(data: ProjectData, delay = 1000): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveToLocal(data), delay);
}
