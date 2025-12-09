
export enum PlanStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
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
}

export interface CalendarEventPosition {
  top: number;
  height: number;
  left: number;
  width: number;
}

export interface AISettings {
  model: string;
}
