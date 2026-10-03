// Local JSON storage using localStorage + File System Access API
import type { EREntity, ERRelationship, ERSubmodel } from '../api/client';

const STORAGE_KEY = 'case-tool-data';
export const CURRENT_SCHEMA_VERSION = 1;

export interface ProjectData {
  schemaVersion: number;
  version: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  erEntities: EREntity[];
  erRelationships: ERRelationship[];
  erSubmodels: ERSubmodel[];
  requirements: unknown[];
  useCaseData: unknown;
  flowChartData: unknown;
  snapshots: unknown[];
  auditLogs: unknown[];
}

export function createEmptyProject(name = 'Untitled Project'): ProjectData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: '1.0.0',
    name,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    erEntities: [],
    erRelationships: [],
    erSubmodels: [],
    requirements: [],
    useCaseData: null,
    flowChartData: null,
    snapshots: [],
    auditLogs: [],
  };
}

export function migrateProject(input: Partial<ProjectData> & Record<string, unknown>): ProjectData {
  const base = createEmptyProject(typeof input.name === 'string' ? input.name : 'Imported Project');
  const entities = Array.isArray(input.erEntities) ? input.erEntities : [];
  return {
    ...base,
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    erEntities: entities.map((entity: any) => ({
      ...entity,
      notes: entity.notes ?? '',
      comments: entity.comments ?? '',
      purpose: entity.purpose ?? '',
      businessRules: entity.businessRules ?? '',
      indexes: entity.indexes ?? [],
      alternateKeys: entity.alternateKeys ?? [],
      checkConstraints: entity.checkConstraints ?? [],
    })),
    erRelationships: Array.isArray(input.erRelationships) ? input.erRelationships : [],
    erSubmodels: Array.isArray(input.erSubmodels) ? input.erSubmodels : [],
  } as ProjectData;
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
    return migrateProject(JSON.parse(raw));
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
      return migrateProject(JSON.parse(text));
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
          resolve(migrateProject(JSON.parse(reader.result as string)));
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
