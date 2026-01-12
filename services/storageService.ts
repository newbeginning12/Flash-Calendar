
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

// 动态载入 Supabase (假设环境已提供)
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
    // 仅从环境变量读取，不再支持手动输入，符合生产环境逻辑
    const env = (process.env as any) || {};
    
    // 兼容 Netlify/Vercel 的 VITE_ 前缀
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || !window.supabase) {
        return null;
    }
    return window.supabase.createClient(supabaseUrl, supabaseKey);
  },

  async isSyncEnabled(): Promise<boolean> {
    // 如果开发者没配置环境，或者用户没手动开启，都返回 false
    if (!this.getSupabase()) return false;
    return localStorage.getItem(SUPABASE_SYNC_ENABLED_KEY) === 'true';
  },

  async setSyncEnabled(enabled: boolean) {
    localStorage.setItem(SUPABASE_SYNC_ENABLED_KEY, enabled.toString());
  },

  async syncWithCloud(): Promise<{ success: boolean; message?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: '云端同步服务未配置，目前仅运行在本地模式。' };

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
        const cp = cloudMap.get(lp.id) as any;
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

  // --- OPFS 持久化逻辑 ---
  async saveToOPFS(data: BackupData): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      console.warn('OPFS save failed:', e);
    }
  },

  async loadFromOPFS(): Promise<BackupData | null> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(OPFS_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  },

  // --- 本地文件系统镜像 ---
  async requestFileMirror(): Promise<boolean> {
    if (!('showSaveFilePicker' in window)) {
      alert('您的浏览器不支持文件系统访问 API，请使用 Chrome 或 Edge 浏览器。');
      return false;
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'flash-plans-mirror.json',
        types: [{
          description: 'JSON Data File',
          accept: { 'application/json': ['.json'] },
        }],
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
    } catch (e: any) {
      if (e.name === 'SecurityError') {
        alert('安全限制：请在独立浏览器标签页中打开应用。');
      }
      return false;
    }
  },

  async getFileMirrorHandle(): Promise<any | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SYSTEM_STORE)) {
            resolve(null);
            return;
        }
        const tx = db.transaction(SYSTEM_STORE, 'readonly');
        const getReq = tx.objectStore(SYSTEM_STORE).get(MIRROR_HANDLE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },

  async verifyMirrorPermission(handle: any): Promise<boolean> {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') {
      return true;
    }
    return false;
  },

  async writeToMirror(handle: any, data: BackupData): Promise<boolean> {
    try {
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        return false;
      }
      const writable = await handle.createWritable();
      const content = JSON.stringify(data, null, 2);
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Mirror write failed:', e);
      return false;
    }
  },

  // --- 核心保存逻辑 ---
  async savePlans(plans: WorkPlan[], settings?: AISettings): Promise<void> {
    const nowIso = new Date().toISOString();
    const plansWithTimestamp = plans.map(p => ({
        ...p,
        updatedAt: p.updatedAt || nowIso
    }));

    await this.savePlansToLocalOnly(plansWithTimestamp);

    const backup: BackupData = {
      version: 1,
      date: nowIso,
      plans: plansWithTimestamp,
      settings
    };

    this.saveToOPFS(backup);

    const handle = await this.getFileMirrorHandle();
    if (handle) {
      await this.writeToMirror(handle, backup);
    }

    if (await this.isSyncEnabled()) {
        this.syncWithCloud();
    }
  },

  async saveMonthlyReport(report: MonthlyAnalysisData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(REPORT_STORE);
        if (!report.id) report.id = crypto.randomUUID();
        store.put(report);
        transaction.oncomplete = () => resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getAllMonthlyReports(): Promise<MonthlyAnalysisData[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(REPORT_STORE)) {
            resolve([]);
            return;
        }
        const transaction = db.transaction(REPORT_STORE, 'readonly');
        const store = transaction.objectStore(REPORT_STORE);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const results = getAllRequest.result || [];
          resolve(results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        };
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveWeeklyReport(report: WeeklyReportData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(WEEKLY_REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(WEEKLY_REPORT_STORE);
        if (!report.id) report.id = crypto.randomUUID();
        if (!report.timestamp) report.timestamp = new Date().toISOString();
        store.put(report);
        transaction.oncomplete = () => resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getAllWeeklyReports(): Promise<WeeklyReportData[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WEEKLY_REPORT_STORE)) {
            resolve([]);
            return;
        }
        const transaction = db.transaction(WEEKLY_REPORT_STORE, 'readonly');
        const store = transaction.objectStore(WEEKLY_REPORT_STORE);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const results = getAllRequest.result || [];
          resolve(results.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()));
        };
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  exportData(plans: WorkPlan[], settings: AISettings) {
      const data: BackupData = {
          version: 1,
          date: new Date().toISOString(),
          plans,
          settings
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flash-calendar-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  },
  
  async importData(file: File): Promise<BackupData | null> {
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  const text = e.target?.result as string;
                  const data = JSON.parse(text);
                  if (data && Array.isArray(data.plans)) {
                      resolve(data as BackupData);
                  } else {
                      resolve(null);
                  }
              } catch (err) {
                  resolve(null);
              }
          };
          reader.readAsText(file);
      });
  },

  async getAllPlans(): Promise<WorkPlan[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            resolve([]);
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
};
