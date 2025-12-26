
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
    你是一个极简主义的日程管理专家。
    任务：解析用户输入的自然语言，并将其转化为结构化日程。

    【核心判别逻辑】:
    1. 只有当用户提到明确的时间（如“明天3点”、“下周一早上”、“15:00”）时，才返回 CREATE_PLAN。
    2. 如果用户输入的意图模糊（如“给老王打电话”、“买牛奶”、“找时间开会”），请返回 UNSUPPORTED，并提示用户这些内容应在“挂载仓”中快速记录。

    当前时间上下文: ${localTimeContext}。

    输出必须为 JSON:
    {
      "type": "CREATE_PLAN" | "UNSUPPORTED",
      "data": { // 仅当 type 为 CREATE_PLAN 时
        "title": "标题",
        "startDate": "ISO 格式",
        "endDate": "ISO 格式",
        "isFuzzy": false,
        "description": "内容",
        "tags": [],
        "color": "blue/indigo/purple/rose/orange/emerald"
      },
      "message": "提示信息" // 仅当 type 为 UNSUPPORTED 时
    }
  `;

  let rawResponseText: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: settings.model,
      contents: userInput,
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
  return extractJSON(rawResponseText) as AIProcessingResult;
};

/**
 * 后台增强模糊任务：解析用户的碎片化闪念
 */
export const enhanceFuzzyTask = async (
  rawText: string,
  settings: AISettings
): Promise<Partial<WorkPlan> | null> => {
  const systemPrompt = `
    你是一个闪念优化专家。用户输入了一个碎片化的想法，请将其优化。
    1. 提取简短有力的标题 (title)。
    2. 根据内容分配合适的颜色 (color: blue, indigo, purple, rose, orange, emerald)。
    3. 识别 1-2 个精准标签 (tags)。
    4. 补充极简的背景描述 (description)。

    返回 JSON:
    { "title": "...", "color": "...", "tags": ["..."], "description": "..." }
  `;

  let raw: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: settings.model,
      contents: `原始想法: ${rawText}`,
      config: { responseMimeType: "application/json", systemInstruction: systemPrompt }
    });
    raw = response.text;
  } else {
    raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: `原始想法: ${rawText}` }], true);
  }

  return raw ? extractJSON(raw) : null;
};

export const processWeeklyReport = async (plans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<WeeklyReportData | null> => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const currentWeekPlans = plans.filter(p => { const d = new Date(p.startDate); return d >= weekStart && d <= weekEnd; });
    const context = formatPlansForContext(currentWeekPlans);
    const systemPrompt = `你是高级办公助手。根据数据生成本周总结：1. achievements: 完成列表。2. summary: 评价。3. nextWeekPlans: 推测下周。4. risks: 风险。返回 JSON。`;
    let raw: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ model: settings.model, contents: `数据：\n${context}`, config: { responseMimeType: "application/json", systemInstruction: systemPrompt } });
        raw = response.text;
    } else { raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: context }], true, signal); }
    if (!raw) return null;
    return extractJSON(raw) as WeeklyReportData;
};

export const processMonthlyReview = async (allPlans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<AIProcessingResult> => {
  const now = new Date();
  const monthPlans = allPlans.filter(p => new Date(p.startDate) >= new Date(now.getFullYear(), now.getMonth(), 1));
  const plansContext = formatPlansForContext(monthPlans);
  const systemPrompt = `你是一位最坦诚的诊断顾问。必须返回 JSON 格式。包含 grade, gradeTitle, healthScore, chaosLevel, patterns, candidAdvice, metrics。`;
  let rawResponseText: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({ model: settings.model, contents: `诊断本月：\n${plansContext}`, config: { responseMimeType: "application/json", systemInstruction: systemPrompt, temperature: 0.8 } });
    rawResponseText = response.text;
  } else { rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: plansContext }], true, signal); }
  if (!rawResponseText) return null;
  return { type: 'MONTH_REVIEW', data: extractJSON(rawResponseText) as MonthlyAnalysisData };
};

export interface SmartSuggestion { label: string; planData: { title: string; description?: string; startDate: string; endDate: string; tags?: string[]; } }

export const generateSmartSuggestions = async (currentPlans: WorkPlan[], settings: AISettings): Promise<SmartSuggestion[]> => {
  return [{ label: "安排明天会议", planData: { title: "同步会议", startDate: addWeeks(startOfDay(new Date()), 0).toISOString(), endDate: addWeeks(endOfDay(new Date()), 0).toISOString() } }];
};
