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

  // 同步用户基本信息到云端 profiles 表
  async syncUserProfile(): Promise<void> {
    const supabase = this.getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('Profile sync failed:', err);
    }
  },

  async syncWithCloud(): Promise<{ success: boolean; message?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: '云端同步服务未配置。' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '用户未登录' };

    try {
      // 同时触发用户档案同步
      await this.syncUserProfile();

      // 1. 同步计划 (Plans)
      await this._syncTable(supabase, user.id, STORE_NAME, 'plans', (lp) => ({
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
          updated_at: lp.updatedAt || new Date().toISOString()
      }), (cp) => ({
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
      }));

      // 2. 同步周报 (Weekly Reports)
      await this._syncTable(supabase, user.id, WEEKLY_REPORT_STORE, 'weekly_reports', (lr) => ({
          id: lr.id,
          user_id: user.id,
          timestamp: lr.timestamp,
          achievements: lr.achievements,
          summary: lr.summary,
          next_week_plans: lr.nextWeekPlans,
          risks: lr.risks,
          updated_at: lr.timestamp || new Date().toISOString()
      }), (cr) => ({
          id: cr.id,
          timestamp: cr.timestamp,
          achievements: cr.achievements,
          summary: cr.summary,
          nextWeekPlans: cr.next_week_plans,
          risks: cr.risks
      }));

      // 3. 同步月度诊断 (Monthly Reports)
      await this._syncTable(supabase, user.id, REPORT_STORE, 'monthly_reports', (lm) => ({
          id: lm.id,
          user_id: user.id,
          timestamp: lm.timestamp,
          grade: lm.grade,
          grade_title: lm.gradeTitle,
          health_score: lm.healthScore,
          chaos_level: lm.chaosLevel,
          patterns: lm.patterns,
          candid_advice: lm.candidAdvice,
          metrics: lm.metrics,
          updated_at: lm.timestamp || new Date().toISOString()
      }), (cm) => ({
          id: cm.id,
          timestamp: cm.timestamp,
          grade: cm.grade,
          gradeTitle: cm.grade_title,
          healthScore: cm.health_score,
          chaosLevel: cm.chaos_level,
          patterns: cm.patterns,
          candidAdvice: cm.candid_advice,
          metrics: cm.metrics
      }));

      return { success: true };
    } catch (err: any) {
      console.error('Sync failed:', err);
      return { success: false, message: err.message };
    }
  },

  // 通用的表同步逻辑
  async _syncTable(
    supabase: any, 
    userId: string, 
    localStoreName: string, 
    cloudTableName: string,
    toCloudMapper: (localItem: any) => any,
    toLocalMapper: (cloudItem: any) => any
  ) {
    const localData = await this._getLocalAll(localStoreName);
    const { data: cloudData, error } = await supabase
        .from(cloudTableName)
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;
    
    // 强制转换为 Map 以提高查询效率
    const cloudMap = new Map<string, any>((cloudData || []).map((p: any) => [p.id, p]));
    const localMap = new Map(localData.map((p: any) => [p.id, p]));
    
    const mergedList: any[] = [];
    const toUpdateInCloud: any[] = [];

    // 处理本地数据
    localData.forEach(localItem => {
        const cloudItem = cloudMap.get(localItem.id);
        const localUpdateAt = localItem.updatedAt || localItem.timestamp || new Date(0).toISOString();
        const cloudUpdateAt = cloudItem?.updated_at || cloudItem?.timestamp || new Date(0).toISOString();

        if (!cloudItem || new Date(localUpdateAt) > new Date(cloudUpdateAt)) {
            // 本地更新
            mergedList.push(localItem);
            toUpdateInCloud.push(toCloudMapper(localItem));
        } else {
            // 云端更新
            mergedList.push(toLocalMapper(cloudItem));
        }
    });

    // 处理本地不存在但云端存在的数据
    (cloudData || []).forEach((cloudItem: any) => {
        if (!localMap.has(cloudItem.id)) {
            mergedList.push(toLocalMapper(cloudItem));
        }
    });

    // 写入本地
    await this._saveLocalList(localStoreName, mergedList);
    // 写入云端
    if (toUpdateInCloud.length > 0) {
        await supabase.from(cloudTableName).upsert(toUpdateInCloud);
    }
  },

  async _getLocalAll(storeName: string): Promise<any[]> {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) return resolve([]);
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
        };
    });
  },

  async _saveLocalList(storeName: string, list: any[]): Promise<void> {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear().onsuccess = () => {
                list.forEach(item => { if (item.id) store.put(item); });
            };
            tx.oncomplete = () => resolve();
        };
    });
  },

  async savePlansToLocalOnly(plans: WorkPlan[]): Promise<void> {
      await this._saveLocalList(STORE_NAME, plans);
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
    return this._getLocalAll(STORE_NAME);
  },

  async saveMonthlyReport(report: MonthlyAnalysisData): Promise<void> {
    const reportWithId = { ...report, id: report.id || crypto.randomUUID() };
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(REPORT_STORE);
        store.put(reportWithId);
        transaction.oncomplete = async () => {
            if (await this.isSyncEnabled()) this.syncWithCloud();
            resolve();
        };
      };
    });
  },

  async getAllMonthlyReports(): Promise<MonthlyAnalysisData[]> {
    const reports = await this._getLocalAll(REPORT_STORE);
    return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async saveWeeklyReport(report: WeeklyReportData): Promise<void> {
    const reportWithId = { ...report, id: report.id || crypto.randomUUID(), timestamp: report.timestamp || new Date().toISOString() };
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(WEEKLY_REPORT_STORE, 'readwrite');
        const store = transaction.objectStore(WEEKLY_REPORT_STORE);
        store.put(reportWithId);
        transaction.oncomplete = async () => {
            if (await this.isSyncEnabled()) this.syncWithCloud();
            resolve();
        };
      };
    });
  },

  async getAllWeeklyReports(): Promise<WeeklyReportData[]> {
    const reports = await this._getLocalAll(WEEKLY_REPORT_STORE);
    return reports.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());
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