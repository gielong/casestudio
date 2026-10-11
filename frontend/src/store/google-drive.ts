import { migrateProject, type ProjectData } from './storage';

// Google Drive 僅要求應用程式建立或使用者授權開啟的檔案。
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/tokeninfo';
const CLIENT_KEY = 'case-tool-google-client-id';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken: (options?: { prompt?: string }) => void }
interface GoogleIdentity {
  accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: TokenResponse) => void }) => TokenClient } }
}
declare global { interface Window { google?: GoogleIdentity } }

export interface DriveProject { id: string; name: string; modifiedTime?: string; description?: string }
let accessToken = '';
let expiresAt = 0;

export function getGoogleClientId(): string { return localStorage.getItem(CLIENT_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''; }
export function setGoogleClientId(id: string): void { localStorage.setItem(CLIENT_KEY, id.trim()); disconnectDrive(); }
export function isDriveConnected(): boolean { return Boolean(accessToken) && Date.now() < expiresAt - 60000; }
export function disconnectDrive(): void { accessToken = ''; expiresAt = 0; }

function loadIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    const script = existing || document.createElement('script');
    const done = () => window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google Identity Services 無法載入'));
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => reject(new Error('Google 登入服務載入失敗')), { once: true });
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.googleIdentity = 'true';
      document.head.appendChild(script);
    }
  });
}

export async function connectDrive(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('請先設定 Google OAuth Client ID');
  await loadIdentity();
  return new Promise<void>((resolve, reject) => {
    window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPE,
      callback: response => {
        if (response.error || !response.access_token) { reject(new Error(response.error || 'Google 授權未完成')); return; }
        accessToken = response.access_token;
        expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
        resolve();
      },
    }).requestAccessToken({ prompt: 'consent' });
  });
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!isDriveConnected()) throw new Error('Google Drive 授權已過期，請重新連線');
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + accessToken);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) disconnectDrive();
    const body = await response.text();
    throw new Error('Google Drive ' + response.status + ': ' + body.slice(0, 250));
  }
  return response;
}

export async function listDriveProjects(): Promise<DriveProject[]> {
  const projects: DriveProject[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: "trashed = false and mimeType = 'application/json'",
      fields: 'nextPageToken,files(id,name,description,modifiedTime)',
      page_size: '1000', orderBy: 'modifiedTime desc',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await (await driveFetch(API + '?' + params)).json() as { files?: DriveProject[]; nextPageToken?: string };
    projects.push(...(data.files || []).filter(f => f.name.endsWith('.case.json')));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return projects;
}

export async function readDriveProject(id: string): Promise<ProjectData> {
  const response = await driveFetch(API + '/' + encodeURIComponent(id) + '?alt=media');
  const json: unknown = await response.json();
  if (!json || typeof json !== 'object' || !Array.isArray((json as ProjectData).erEntities)) throw new Error('Drive 檔案不是有效的 CASE Studio 專案');
  return migrateProject(json as ProjectData & Record<string, unknown>);
}

export async function saveDriveProject(data: ProjectData, id?: string): Promise<string> {
  const content = JSON.stringify({ ...data, updatedAt: new Date().toISOString() });
  if (id) {
    await driveFetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(id) + '?uploadType=media', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content,
    });
    return id;
  }
  const metadata = { name: data.name + '.case.json', mimeType: 'application/json', description: 'CASE Studio Project' };
  const boundary = 'case_studio_' + crypto.randomUUID();
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
    '\r\n--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + content + '\r\n--' + boundary + '--';
  const response = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body,
  });
  const result = await response.json() as { id: string };
  return result.id;
}
