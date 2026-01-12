import { WorkPlan, AISettings, MonthlyAnalysisData, WeeklyReportData } from '../types';

const DB_NAME = 'FlashCalendarDB';
const DB_VERSION = 5;
const STORE_NAME = 'plans';
const REPORT_STORE = 'monthly_reports';
const WEEKLY_REPORT_STORE = 'weekly_reports';
const SYSTEM_STORE = 'system';

const OPFS_FILENAME = 'backup_v1.bin';
const MIRROR_HANDLE_KEY = 'file_mirror_handle';
const SUPABASE_SYNC_ENABLED_KEY = 'supabase_sync_enabled';

// 动态载入 Supabase
declare global {
  interface Window {
    supabase: any;
  }
}

export interface BackupData {
  version: number;
  date: string;
  plans: WorkPlan[];
  settings?: AISettings;
}

export const storageService = {
  // --- 基础初始化 ---
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => resolve();
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(REPORT_STORE)) {
          db.createObjectStore(REPORT_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(WEEKLY_REPORT_STORE)) {
          db.createObjectStore(WEEKLY_REPORT_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SYSTEM_STORE)) {
          db.createObjectStore(SYSTEM_STORE);
        }
      };
    });
  },

  // --- Supabase 同步辅助函数 ---
  getSupabase() {
    // 兼容 Netlify 的构建环境
    const env = (process.env as any) || {};
    const metaEnv = (import.meta as any).env || {};
    
    const supabaseUrl = metaEnv.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || !window.supabase) {
        return null;
    }
    return window.supabase.createClient(supabaseUrl, supabaseKey);
  },

  async isSyncEnabled(): Promise<boolean> {
    if (!this.getSupabase()) return false;
    return localStorage.getItem(SUPABASE_SYNC_ENABLED_KEY) === 'true';
  },

  async setSyncEnabled(enabled: boolean) {
    localStorage.setItem(SUPABASE_SYNC_ENABLED_KEY, enabled.toString());
  },

  async syncWithCloud(): Promise<{ success: boolean; message?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: '云端同步服务未配置。' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '用户未登录' };

    try {
      const localPlans = await this.getAllPlans();
      const { data: cloudPlans, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      const plansArray = (cloudPlans || []) as any[];

      const cloudMap = new Map<string, any>(plansArray.map((p: any) => [p.id, p]));
      const localMap = new Map(localPlans.map((p: any) => [p.id, p]));
      
      const mergedPlans: WorkPlan[] = [];
      const toUpdateInCloud: any[] = [];

      localPlans.forEach(lp => {
        const cp = cloudMap.get(lp.id);
        if (!cp || new Date(lp.updatedAt) > new Date(cp.updated_at)) {
          mergedPlans.push(lp);
          toUpdateInCloud.push({
            id: lp.id,
            user_id: user.id,
            title: lp.title,
            description: lp.description,
            start_date: lp.startDate,
            end_date: lp.endDate,
            status: lp.status,
            tags: lp.tags,
            color: lp.color,
            links: lp.links,
            is_fuzzy: lp.isFuzzy,
            deleted_at: lp.deletedAt,
            updated_at: lp.updatedAt
          });
        } else {
          mergedPlans.push({
            ...lp,
            title: cp.title,
            description: cp.description,
            startDate: cp.start_date,
            endDate: cp.end_date,
            status: cp.status,
            tags: cp.tags,
            color: cp.color,
            links: cp.links,
            isFuzzy: cp.is_fuzzy,
            deletedAt: cp.deleted_at,
            updatedAt: cp.updated_at
          });
        }
      });

      plansArray.forEach((cp: any) => {
        if (!localMap.has(cp.id)) {
          mergedPlans.push({
            id: cp.id,
            title: cp.title,
            description: cp.description,
            startDate: cp.start_date,
            endDate: cp.end_date,
            status: cp.status,
            tags: cp.tags,
            color: cp.color,
            links: cp.links,
            isFuzzy: cp.is_fuzzy,
            deletedAt: cp.deleted_at,
            updatedAt: cp.updated_at
          });
        }
      });

      await this.savePlansToLocalOnly(mergedPlans);
      if (toUpdateInCloud.length > 0) {
        await supabase.from('plans').upsert(toUpdateInCloud);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Sync failed:', err);
      return { success: false, message: err.message };
    }
  },

  async savePlansToLocalOnly(plans: WorkPlan[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
       const request = indexedDB.open(DB_NAME, DB_VERSION);
       request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.clear().onsuccess = () => {
              plans.forEach(plan => { if (plan?.id) store.put(plan); });
          };
          transaction.oncomplete = () => resolve();
       };
       request.onerror = () => reject(request.error);
    });
  },

  async saveToOPFS(data: BackupData): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(JSON.stringify(data));
      await writable.close();
    } catch (e) {}
  },

  async loadFromOPFS(): Promise<BackupData | null> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME);
      const file = await (fileHandle as any).getFile();
      return JSON.parse(await file.text());
    } catch (e) { return null; }
  },

  async getFileMirrorHandle(): Promise<any | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SYSTEM_STORE)) { resolve(null); return; }
        const tx = db.transaction(SYSTEM_STORE, 'readonly');
        const getReq = tx.objectStore(SYSTEM_STORE).get(MIRROR_HANDLE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },

  async requestFileMirror(): Promise<boolean> {
    if (!('showSaveFilePicker' in window)) return false;
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'flash-mirror.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(SYSTEM_STORE, 'readwrite');
          tx.objectStore(SYSTEM_STORE).put(handle, MIRROR_HANDLE_KEY);
          tx.oncomplete = () => resolve(true);
        };
      });
    } catch (e) { return false; }
  },

  async writeToMirror(handle: any, data: BackupData): Promise<void> {
    try {
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return;
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (e) {}
  },

  async savePlans(plans: WorkPlan[], settings?: AISettings): Promise<void> {
    const nowIso = new Date().toISOString();
    const plansWithTimestamp = plans.map(p => ({ ...p, updatedAt: p.updatedAt || nowIso }));
    await this.savePlansToLocalOnly(plansWithTimestamp);

    const backup: BackupData = { version: 1, date: nowIso, plans: plansWithTimestamp, settings };
    this.saveToOPFS(backup);

    const handle = await this.getFileMirrorHandle();
    if (handle) await this.writeToMirror(handle, backup);
    if (await this.isSyncEnabled()) this.syncWithCloud();
  },

  async getAllPlans(): Promise<WorkPlan[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) { resolve([]); return; }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveMonthlyReport(report: MonthlyAnalysisData): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(REPORT_STORE);
        store.put({ ...report, id: report.id || crypto.randomUUID() });
        resolve();
      };
    });
  },

  async getAllMonthlyReports(): Promise<MonthlyAnalysisData[]> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(REPORT_STORE)) { resolve([]); return; }
        const transaction = db.transaction(REPORT_STORE, 'readonly');
        const store = transaction.objectStore(REPORT_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
    });
  },

  async saveWeeklyReport(report: WeeklyReportData): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(WEEKLY_REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(WEEKLY_REPORT_STORE);
        store.put({ ...report, id: report.id || crypto.randomUUID(), timestamp: report.timestamp || new Date().toISOString() });
        resolve();
      };
    });
  },

  async getAllWeeklyReports(): Promise<WeeklyReportData[]> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WEEKLY_REPORT_STORE)) { resolve([]); return; }
        const transaction = db.transaction(WEEKLY_REPORT_STORE, 'readonly');
        const store = transaction.objectStore(WEEKLY_REPORT_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()));
      };
    });
  },
  
  exportData(plans: WorkPlan[], settings: AISettings) {
      const data: BackupData = { version: 1, date: new Date().toISOString(), plans, settings };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flash-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  },
  
  async importData(file: File): Promise<BackupData | null> {
      try { return JSON.parse(await file.text()); } catch (err) { return null; }
  }
};