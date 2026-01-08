
import { WorkPlan, AISettings, MonthlyAnalysisData, WeeklyReportData } from '../types';

const DB_NAME = 'FlashCalendarDB';
const DB_VERSION = 4; // 升级版本以增加 system store
const STORE_NAME = 'plans';
const REPORT_STORE = 'monthly_reports';
const WEEKLY_REPORT_STORE = 'weekly_reports';
const SYSTEM_STORE = 'system';

const OPFS_FILENAME = 'backup_v1.bin';
const MIRROR_HANDLE_KEY = 'file_mirror_handle';

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

  // --- OPFS 持久化逻辑 (Origin Private File System) ---
  // OPFS 不受浏览器自动清理机制影响，是真正的永久存储
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

  // --- 本地文件系统镜像 (File System Access API) ---
  // 允许用户关联本地 iCloud/OneDrive 文件夹中的文件
  async requestFileMirror(): Promise<boolean> {
    if (!('showSaveFilePicker' in window)) {
      alert('您的浏览器不支持文件系统访问 API，请使用 Chrome 或 Edge 浏览器以开启镜像功能。');
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

      // 将句柄存入 IndexedDB 供以后使用
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
        alert('安全限制：当前环境（如预览框架或跨域 iframe）禁止访问本地文件系统。请尝试在独立浏览器标签页中直接打开应用网址以使用此功能。');
      } else if (e.name !== 'AbortError') {
        console.error('Handle request failed', e);
      }
      return false;
    }
  },

  async getFileMirrorHandle(): Promise<any | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(SYSTEM_STORE, 'readonly');
        const getReq = tx.objectStore(SYSTEM_STORE).get(MIRROR_HANDLE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },

  async writeToMirror(handle: any, data: BackupData): Promise<boolean> {
    try {
      // 验证权限
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        // 如果没有权限，不静默报错，由用户点击触发恢复
        return false;
      }
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Mirror write failed:', e);
      return false;
    }
  },

  // --- 核心保存逻辑集成 ---
  async savePlans(plans: WorkPlan[], settings?: AISettings): Promise<void> {
    // 1. 保存到 IndexedDB (UI 响应)
    await new Promise<void>((resolve, reject) => {
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

    // 2. 准备备份数据包
    const backup: BackupData = {
      version: 1,
      date: new Date().toISOString(),
      plans,
      settings
    };

    // 3. 异步镜像到 OPFS (多浏览器兼容的永久存储)
    this.saveToOPFS(backup);

    // 4. 异步镜像到本地文件系统 (如果已配置)
    const handle = await this.getFileMirrorHandle();
    if (handle) {
      this.writeToMirror(handle, backup);
    }
  },

  // --- 报表存储 ---
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
