
import { WorkPlan, AISettings, MonthlyAnalysisData, WeeklyReportData } from '../types';

const DB_NAME = 'FlashCalendarDB';
const DB_VERSION = 3; // 升级版本以增加 store
const STORE_NAME = 'plans';
const REPORT_STORE = 'monthly_reports';
const WEEKLY_REPORT_STORE = 'weekly_reports';

export interface BackupData {
  version: number;
  date: string;
  plans: WorkPlan[];
  settings?: AISettings;
}

export const storageService = {
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
      };
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
  },

  async savePlans(plans: WorkPlan[]): Promise<void> {
    return new Promise((resolve, reject) => {
       const request = indexedDB.open(DB_NAME, DB_VERSION);
       request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => {
              plans.forEach(plan => {
                  if (plan && plan.id) {
                      store.put(plan);
                  }
              });
          };
          transaction.oncomplete = () => resolve();
       };
       request.onerror = () => reject(request.error);
    });
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
  }
};
