
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
    return { message: "AI 授权失效或未配置，请在设置中输入有效的 API Key。", needConfig: true };
  }
  if (errStr.includes("429") || errStr.includes("quota")) {
    return { message: "AI 请求频率过快，请稍后再试。", needConfig: false };
  }
  return { message: "AI 助手暂时无法响应，请检查配置或网络。", needConfig: false };
};

const getAIInstance = (settings: AISettings) => {
    const apiKey = settings.apiKey || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Missing API Key");
    }
    return new GoogleGenAI({ apiKey });
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
  
  const systemInstructionText = `你是一个极简主义日程专家。你的任务是分析用户输入。
1. 如果提到具体时间或明确的日程意图，返回 CREATE_PLAN 类型并提取字段。
2. 如果只是模糊的想法或搜索，返回 UNSUPPORTED 类型并引导至挂载仓。
当前参考时间: ${localTimeContext}`;

  try {
    let rawResponseText: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
      const response = await ai.models.generateContent({
        model: settings.model,
        contents: [{ parts: [{ text: userInput }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "CREATE_PLAN, UNSUPPORTED, or ERROR" },
              data: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  startDate: { type: Type.STRING, description: "ISO String" },
                  endDate: { type: Type.STRING, description: "ISO String" },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  color: { type: Type.STRING }
                },
                description: "仅在 CREATE_PLAN 时包含"
              },
              message: { type: Type.STRING, description: "说明信息，特别是在 UNSUPPORTED 时" }
            },
            required: ["type"]
          },
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
    if (error.name === 'AbortError' || signal?.aborted) return null;
    const { message, needConfig } = handleAIError(error);
    return { type: 'ERROR', message, needConfig };
  }
};

export const enhanceFuzzyTask = async (
  rawText: string,
  settings: AISettings
): Promise<Partial<WorkPlan> | null> => {
  const systemPrompt = `将用户随手记录的想法优化为结构化日程建议。返回 JSON。`;
  try {
    let raw: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
      const response = await ai.models.generateContent({
        model: settings.model,
        contents: [{ parts: [{ text: `原始想法: ${rawText}` }] }],
        config: { 
          responseMimeType: "application/json", 
          systemInstruction: systemPrompt,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              color: { type: Type.STRING }
            },
            required: ["title"]
          }
        }
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
    const systemPrompt = `你是一个职场专家。请基于日程数据生成一份 JSON 格式的工作周报。内容包含：本周成就、工作总结、下周计划和潜在风险。`;

    try {
      let raw: string | null = null;
      if (settings.provider === AIProvider.GOOGLE) {
          const ai = getAIInstance(settings);
          const response = await ai.models.generateContent({ 
              model: settings.model, 
              contents: [{ parts: [{ text: `数据：\n${context}` }] }], 
              config: { 
                responseMimeType: "application/json", 
                systemInstruction: systemPrompt,
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    summary: { type: Type.STRING },
                    nextWeekPlans: { type: Type.ARRAY, items: { type: Type.STRING } },
                    risks: { type: Type.STRING }
                  },
                  required: ["achievements", "summary", "nextWeekPlans", "risks"]
                }
              } 
          });
          raw = response.text;
      } else { 
          raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: context }], true, signal); 
      }
      return raw ? { type: 'ANALYSIS', data: extractJSON(raw) } : null;
    } catch (error: any) {
      if (error.name === 'AbortError' || signal?.aborted) return null;
      const { message, needConfig } = handleAIError(error);
      return { type: 'ERROR', message, needConfig };
    }
};

export const processMonthlyReview = async (allPlans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<AIProcessingResult> => {
  const now = new Date();
  const monthPlans = allPlans.filter(p => new Date(p.startDate).getMonth() === now.getMonth());
  const plansContext = formatPlansForContext(monthPlans);
  const systemPrompt = `你是一个行为心理学家和效率专家。请基于用户整月的日程数据进行行为诊断，返回 JSON 格式结果。`;

  try {
    let rawResponseText: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
      const ai = getAIInstance(settings);
      const response = await ai.models.generateContent({ 
        model: settings.model, 
        contents: [{ parts: [{ text: `数据：\n${plansContext}` }] }], 
        config: { 
          responseMimeType: "application/json", 
          systemInstruction: systemPrompt,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grade: { type: Type.STRING, description: "S/A/B/C/D/E/F" },
              gradeTitle: { type: Type.STRING },
              healthScore: { type: Type.NUMBER },
              chaosLevel: { type: Type.NUMBER },
              patterns: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING }
                  }
                } 
              },
              candidAdvice: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    truth: { type: Type.STRING },
                    action: { type: Type.STRING }
                  }
                }
              },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  taggedRatio: { type: Type.NUMBER },
                  descriptionRate: { type: Type.NUMBER },
                  deepWorkRatio: { type: Type.NUMBER }
                }
              }
            },
            required: ["grade", "gradeTitle", "healthScore", "chaosLevel", "patterns", "candidAdvice", "metrics"]
          }
        } 
      });
      rawResponseText = response.text;
    } else { 
      rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: plansContext }], true, signal); 
    }
    return rawResponseText ? { type: 'MONTH_REVIEW', data: extractJSON(rawResponseText) } : null;
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) return null;
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
