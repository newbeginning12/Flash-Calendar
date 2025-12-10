
import { WorkPlan, AISettings } from '../types';

const DB_NAME = 'FlashCalendarDB';
const DB_VERSION = 1;
const STORE_NAME = 'plans';

export interface BackupData {
  version: number;
  date: string;
  plans: WorkPlan[];
  settings?: AISettings;
}

export const storageService = {
  // Initialize the database
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
      };
    });
  },

  // Get all plans from DB
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

  // Save all plans (Overwrite strategy for simplicity and state sync)
  async savePlans(plans: WorkPlan[]): Promise<void> {
    return new Promise((resolve, reject) => {
       const request = indexedDB.open(DB_NAME, DB_VERSION);
       
       request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          
          // Clear existing data first to handle deletions correctly
          const clearRequest = store.clear();
          
          clearRequest.onsuccess = () => {
              // Add all current plans
              plans.forEach(plan => store.put(plan));
          };
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
       };
       
       request.onerror = () => reject(request.error);
    });
  },
  
  // Export data to JSON file
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
  
  // Import data from JSON file
  async importData(file: File): Promise<BackupData | null> {
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  const text = e.target?.result as string;
                  const data = JSON.parse(text);
                  // Basic validation
                  if (data && Array.isArray(data.plans)) {
                      resolve(data as BackupData);
                  } else {
                      console.error("Invalid backup file format");
                      resolve(null);
                  }
              } catch (err) {
                  console.error('Import failed', err);
                  resolve(null);
              }
          };
          reader.readAsText(file);
      });
  }
};
