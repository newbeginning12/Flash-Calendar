
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider, WeeklyReportData, AIProcessingResult, MonthlyAnalysisData } from "../types";
import { endOfWeek, addWeeks, format, isWithinInterval, startOfWeek, differenceInMinutes, startOfDay, endOfDay } from "date-fns";

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

export const DEFAULT_MODEL = "gemini-3-flash-preview";

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const extractJSON = (text: string) => {
  try {
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1]);
    const firstOpenBrace = text.indexOf('{');
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const callOpenAICompatible = async (
  settings: AISettings, 
  messages: any[],
  jsonMode: boolean = true,
  signal?: AbortSignal
): Promise<string | null> => {
  if (!settings.apiKey || !settings.baseUrl) return null;
  const cleanBaseUrl = settings.baseUrl.replace(/\/+$/, '');
  try {
    const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        temperature: 0.1,
        stream: false,
        response_format: jsonMode ? { type: "json_object" } : undefined
      }),
      signal: signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return null;
  }
};

const formatPlansForContext = (plans: WorkPlan[]) => {
    return plans.map(p => {
        const statusMap = { [PlanStatus.DONE]: '已完成', [PlanStatus.IN_PROGRESS]: '进行中', [PlanStatus.TODO]: '待办' };
        return `- [${statusMap[p.status]}] ${p.title} (${p.startDate.slice(0, 10)})`;
    }).join('\n');
};

export const processUserIntent = async (
  userInput: string, 
  currentPlans: WorkPlan[], 
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  const localTimeContext = format(now, 'yyyy-MM-dd HH:mm:ss');
  
  const systemInstructionText = `
    你是一个专业的日程助手。
    你的职责仅限于：【识别并创建工作日程】。
    
    规则：
    1. 如果用户输入的是明确的日程安排意图（例如：明天下午三点开会、周五提交报告），请识别并返回 JSON。
    2. 如果用户询问天气、闲聊、要求写代码、或者要求你做周报/月报，请返回特定的 UNSUPPORTED 格式。
    3. 当前本地时间是：${localTimeContext}。周一是每周的开始。

    有效日程响应格式 (JSON):
    {
      "type": "CREATE_PLAN",
      "data": {
        "title": "简短标题",
        "startDate": "ISO 8601 格式",
        "endDate": "ISO 8601 格式",
        "description": "详细说明",
        "tags": ["标签1", "标签2"],
        "color": "blue/indigo/purple/rose/orange/emerald"
      }
    }

    无效输入响应格式 (JSON):
    {
      "type": "UNSUPPORTED",
      "message": "抱歉，我目前只能帮您安排日程。您可以尝试输入：'明天上午十点和老板开会'"
    }
  `;

  let rawResponseText: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: settings.model,
      contents: { parts: [{ text: userInput }] },
      config: {
        responseMimeType: "application/json",
        systemInstruction: systemInstructionText,
        temperature: 0.1
      }
    });
    rawResponseText = response.text;
  } else {
    rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemInstructionText }, { role: 'user', content: userInput }], true, signal);
  }

  if (!rawResponseText) return null;
  const data = extractJSON(rawResponseText);
  if (!data) return null;

  return data as AIProcessingResult;
};

// 显式的周报生成服务
export const processWeeklyReport = async (
  plans: WorkPlan[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<WeeklyReportData | null> => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const currentWeekPlans = plans.filter(p => {
        const d = new Date(p.startDate);
        return d >= weekStart && d <= weekEnd;
    });

    const context = formatPlansForContext(currentWeekPlans);
    const systemPrompt = `
      你是高级办公助手。根据以下日程数据生成本周总结：
      1. achievements: 本周完成的重点工作列表。
      2. summary: 简短的本周总体评价。
      3. nextWeekPlans: 根据当前未完成或常规节奏推测下周计划。
      4. risks: 识别可能的延期或风险。
      必须返回 JSON 格式。
    `;

    let raw: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: settings.model,
            contents: { parts: [{ text: `数据：\n${context}` }] },
            config: { responseMimeType: "application/json", systemInstruction: systemPrompt }
        });
        raw = response.text;
    } else {
        raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: context }], true, signal);
    }

    if (!raw) return null;
    return extractJSON(raw) as WeeklyReportData;
};

export const processMonthlyReview = async (
  allPlans: WorkPlan[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  const monthPlans = allPlans.filter(p => new Date(p.startDate) >= new Date(now.getFullYear(), now.getMonth(), 1));
  const plansContext = formatPlansForContext(monthPlans);
  const taggedCount = monthPlans.filter(p => p.tags.length > 0).length;
  const taggedRatio = monthPlans.length > 0 ? taggedCount / monthPlans.length : 0;

  const systemPrompt = `
    你是一位最坦诚的诊断顾问。必须返回 JSON 格式：
    {
      "grade": "S/A/B/C/D/E/F",
      "gradeTitle": "一段扎心的标题",
      "healthScore": 0-100,
      "chaosLevel": 0-100,
      "patterns": [{ "id": "uuid", "label": "模式名称", "description": "模式解释", "type": "warning/positive/info" }],
      "candidAdvice": [{ "truth": "真相", "action": "行动" }],
      "metrics": { "taggedRatio": 0-1, "descriptionRate": 0-1, "deepWorkRatio": 0-1 }
    }
  `;

  let rawResponseText: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: settings.model,
      contents: { parts: [{ text: `诊断本月：\n${plansContext}` }] },
      config: { responseMimeType: "application/json", systemInstruction: systemPrompt, temperature: 0.8 }
    });
    rawResponseText = response.text;
  } else {
    rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: plansContext }], true, signal);
  }

  if (!rawResponseText) return null;
  return { type: 'MONTH_REVIEW', data: extractJSON(rawResponseText) as MonthlyAnalysisData };
};

export const generateSmartSuggestions = async (currentPlans: WorkPlan[], settings: AISettings): Promise<SmartSuggestion[]> => {
  return [
      { label: "安排明天会议", planData: { title: "同步会议", startDate: addWeeks(startOfDay(new Date()), 0).toISOString(), endDate: addWeeks(endOfDay(new Date()), 0).toISOString() } }
  ];
};

export interface SmartSuggestion {
  label: string;
  planData: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    tags?: string[];
  }
}
