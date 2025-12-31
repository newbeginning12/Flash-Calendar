
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider, WeeklyReportData, AIProcessingResult, MonthlyAnalysisData } from "../types";
import { endOfWeek, addWeeks, format, isWithinInterval, startOfWeek, differenceInMinutes, startOfDay, endOfDay } from "date-fns";

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];
export const DEFAULT_MODEL = "gemini-3-flash-preview";

export interface SmartSuggestion {
  label: string;
  planData: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    tags?: string[];
  };
}

const extractJSON = (text: string) => {
  try {
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1]);
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const handleAIError = (error: any): { message: string; needConfig: boolean } => {
  const errStr = String(error).toLowerCase();
  
  if (errStr.includes("api_key") || errStr.includes("401") || errStr.includes("unauthorized") || errStr.includes("not found")) {
    return { message: "AI 授权失效或未配置，请在设置中选择 API Key。", needConfig: true };
  }
  if (errStr.includes("429") || errStr.includes("quota")) {
    return { message: "AI 请求频率过快，请稍后再试。", needConfig: false };
  }
  return { message: "AI 助手暂时无法响应，请检查配置或网络。", needConfig: false };
};

const getAIInstance = (settings: AISettings) => {
    // 强制使用最新的初始化规范：new GoogleGenAI({ apiKey: process.env.API_KEY })
    // 如果 settings 中有 Key 且不是 Google 模式，则 fallback 到兼容层
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const callOpenAICompatible = async (
  settings: AISettings, 
  messages: any[],
  jsonMode: boolean = true,
  signal?: AbortSignal
): Promise<string | null> => {
  if (!settings.apiKey || !settings.baseUrl) {
    throw new Error("Missing AI configuration (API Key or Base URL)");
  }
  const cleanBaseUrl = settings.baseUrl.replace(/\/+$/, '');
  
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

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
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
  
  const systemInstructionText = `你是一个极简主义日程专家。只有在提到具体时间时才 CREATE_PLAN，否则返回 UNSUPPORTED。当前时间: ${localTimeContext}`;

  try {
    let rawResponseText: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
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
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    const { message, needConfig } = handleAIError(error);
    return { type: 'ERROR', message, needConfig };
  }
};

export const enhanceFuzzyTask = async (
  rawText: string,
  settings: AISettings
): Promise<Partial<WorkPlan> | null> => {
  const systemPrompt = `优化用户碎碎念为 JSON 格式（title, tags, color, description）。`;
  try {
    let raw: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
      const response = await ai.models.generateContent({
        model: settings.model,
        contents: `原始想法: ${rawText}`,
        config: { responseMimeType: "application/json", systemInstruction: systemPrompt }
      });
      raw = response.text;
    } else {
      raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: `想法: ${rawText}` }], true);
    }
    return raw ? extractJSON(raw) : null;
  } catch (e) {
    return null; 
  }
};

export const processWeeklyReport = async (plans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<AIProcessingResult> => {
    const now = new Date();
    const currentWeekPlans = plans.filter(p => { 
        const d = new Date(p.startDate); 
        return d >= startOfWeek(now, { weekStartsOn: 1 }) && d <= endOfWeek(now, { weekStartsOn: 1 }); 
    });
    const context = formatPlansForContext(currentWeekPlans);
    const systemPrompt = `生成 JSON 周报（achievements, summary, nextWeekPlans, risks）。`;

    try {
      let raw: string | null = null;
      if (settings.provider === AIProvider.GOOGLE) {
          const ai = getAIInstance(settings);
          const response = await ai.models.generateContent({ 
              model: settings.model, 
              contents: `数据：\n${context}`, 
              config: { responseMimeType: "application/json", systemInstruction: systemPrompt } 
          });
          raw = response.text;
      } else { 
          raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: context }], true, signal); 
      }
      return raw ? { type: 'ANALYSIS', data: extractJSON(raw) } : null;
    } catch (error) {
      const { message, needConfig } = handleAIError(error);
      return { type: 'ERROR', message, needConfig };
    }
};

export const processMonthlyReview = async (allPlans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<AIProcessingResult> => {
  const now = new Date();
  const monthPlans = allPlans.filter(p => new Date(p.startDate).getMonth() === now.getMonth());
  const plansContext = formatPlansForContext(monthPlans);
  const systemPrompt = `提供深度月度行为诊断（JSON 格式：grade, gradeTitle, healthScore, chaosLevel, patterns, candidAdvice, metrics）。`;

  try {
    let rawResponseText: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
      const response = await ai.models.generateContent({ 
        model: settings.model, 
        contents: `数据：\n${plansContext}`, 
        config: { responseMimeType: "application/json", systemInstruction: systemPrompt } 
      });
      rawResponseText = response.text;
    } else { 
      rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: plansContext }], true, signal); 
    }
    return rawResponseText ? { type: 'MONTH_REVIEW', data: extractJSON(rawResponseText) } : null;
  } catch (error) {
    const { message, needConfig } = handleAIError(error);
    return { type: 'ERROR', message, needConfig };
  }
};

export const generateSmartSuggestions = async (
  currentPlans: WorkPlan[],
  settings: AISettings
): Promise<SmartSuggestion[]> => {
  return [
    {
      label: "安排下周一早会",
      planData: {
        title: "周一开场会",
        startDate: format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), "yyyy-MM-dd'T'09:00:00"),
        endDate: format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), "yyyy-MM-dd'T'10:00:00"),
        tags: ["会议"]
      }
    }
  ];
};
