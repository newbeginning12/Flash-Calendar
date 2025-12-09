
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