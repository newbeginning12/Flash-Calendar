
export enum PlanStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

export interface LinkResource {
  id: string;
  title: string;
  url: string;
}

export interface WorkPlan {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  status: PlanStatus;
  tags: string[];
  color: string; // Tailwind color class helper
  links: LinkResource[];
  isFuzzy?: boolean; // 新增：是否为模糊/未排程计划
  isEnhancing?: boolean; // 新增：是否正在被 AI 后台增强处理
}

export interface CalendarEventPosition {
  top: number;
  height: number;
  left: number;
  width: number;
}

export enum AIProvider {
  GOOGLE = 'google',
  DEEPSEEK = 'deepseek',
  ALI_QWEN = 'ali_qwen',
  CUSTOM = 'custom'
}

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey?: string; // For custom providers
  baseUrl?: string; // For OpenAI compatible providers
}

export interface AppNotification {
  id: string;
  type: 'OVERDUE' | 'SYSTEM';
  title: string;
  message: string;
  timestamp: string; // ISO String
  read: boolean;
  planId?: string;
}

export interface WeeklyReportData {
  achievements: string[];
  summary: string;
  nextWeekPlans: string[];
  risks: string;
}

export interface MonthlyPattern {
  id: string;
  label: string;
  description: string;
  type: 'warning' | 'positive' | 'info';
}

export interface MonthlyAnalysisData {
  id?: string;
  timestamp: string; // 记录生成时间
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  gradeTitle: string;
  healthScore: number; // 0-100
  chaosLevel: number; // 0-100, based on data quality
  patterns: MonthlyPattern[];
  candidAdvice: {
    truth: string;
    action: string;
  }[];
  metrics: {
    taggedRatio: number;
    descriptionRate: number;
    deepWorkRatio: number; // Plans > 90min
  };
}

export type AIProcessingResult = 
  | { type: 'CREATE_PLAN'; data: Partial<WorkPlan> }
  | { type: 'ANALYSIS'; data: WeeklyReportData }
  | { type: 'MONTH_REVIEW'; data: MonthlyAnalysisData }
  | { type: 'UNSUPPORTED'; message: string }
  | null;
