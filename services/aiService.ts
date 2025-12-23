
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider, WeeklyReportData, AIProcessingResult } from "../types";
import { endOfWeek, addWeeks, format, isWithinInterval, startOfWeek } from "date-fns";

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

export const DEFAULT_MODEL = "gemini-3-flash-preview";

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const formatLocalTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const determineStatus = (startDateStr: string, endDateStr: string): PlanStatus => {
  const now = new Date();
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (end <= now) return PlanStatus.DONE;
  if (start <= now && end > now) return PlanStatus.IN_PROGRESS;
  return PlanStatus.TODO;
};

const extractJSON = (text: string) => {
  try {
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1]);
    const firstOpenBrace = text.indexOf('{');
    const firstOpenBracket = text.indexOf('[');
    if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) return JSON.parse(arrayMatch[0]);
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const parseDate = (dateStr: string | undefined): string | null => {
  if (!dateStr) return null;
  try {
      const isoLike = dateStr.replace(' ', 'T');
      const d = new Date(isoLike);
      return !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
      return null;
  }
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

interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const callOpenAICompatible = async (
  settings: AISettings, 
  messages: OpenAICompatibleMessage[],
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
        return `- 【${statusMap[p.status]}】${p.title} (${p.startDate.slice(0, 10)}) ${p.description || ''}`;
    }).join('\n');
};

const createPlanFromRaw = (rawPlan: any): AIProcessingResult => {
    const title = (rawPlan.title || "新日程").substring(0, 20);
    let startISO = parseDate(rawPlan.startDate);
    let endISO = parseDate(rawPlan.endDate);
    if (!startISO) {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        startISO = nextHour.toISOString();
    }
    if (!endISO) {
        const start = new Date(startISO!); 
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        endISO = end.toISOString();
    }
    return {
      type: 'CREATE_PLAN',
      data: {
        id: crypto.randomUUID(),
        title: title,
        description: rawPlan.description || "",
        startDate: startISO!,
        endDate: endISO!,
        status: determineStatus(startISO!, endISO!),
        tags: (rawPlan.tags || []).slice(0, 2),
        color: getRandomColor(),
        links: []
      }
    };
}

export const processUserIntent = async (
  userInput: string, 
  currentPlans: WorkPlan[], 
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  const localTimeContext = format(now, 'yyyy-MM-dd HH:mm:ss');
  const todayDate = format(now, 'yyyy-MM-dd');
  
  // 仅筛选本周和下周的日程作为上下文，避免 Token 过多
  const relevantPlans = currentPlans.filter(p => {
      const pDate = new Date(p.startDate);
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = addWeeks(start, 2);
      return pDate >= start && pDate <= end;
  });

  const planContext = formatPlansForContext(relevantPlans);

  const systemInstructionText = `
    你是一个专业且干练的日程管理与办公助手。
    当前时间: ${localTimeContext} (今天是 ${todayDate})。
    
    你必须根据用户输入切换到对应的处理模式：

    ### 模式 A：创建日程 (Intent: CREATE)
    当用户想要“开会”、“预约”、“明天做某事”时进入此模式。
    1. 标题提取 (title): 2-15字，精简有力。
    2. 时间解析 (startDate/endDate): 基于 ${todayDate} 偏移。默认时长1小时。
    3. 标签提取 (tags): 从输入中提取1-2个核心关键词。

    ### 模式 B：生成周报 (Intent: ANALYZE)
    当用户提到“周报”、“总结”、“回顾”时进入此模式。
    你必须基于提供的【现有日程上下文】来总结。钉钉周报格式要求如下：
    1. achievements (本周完成工作): 列出状态为“已完成”或“进行中”的重点事项。
    2. summary (本周工作总结): 对本周产出进行一段话的概括。
    3. nextWeekPlans (下周工作计划): 列出状态为“待办”或未来日期的事项。
    4. risks (需协调与帮助): 识别可能的风险或阻塞点，若无则写“无”。

    【现有日程上下文】:
    ${planContext || "（暂无现有日程，请基于通用逻辑生成空框架）"}

    直接返回 JSON 对象，严禁任何解释。
  `;

  let rawResponseText: string | undefined | null = null;

  if (settings.provider === AIProvider.GOOGLE) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: settings.model,
        contents: { parts: [{ text: `用户输入: "${userInput}"` }] },
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ["CREATE", "ANALYZE"] },
              planData: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING, nullable: true },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }
                },
                nullable: true
              },
              reportData: {
                type: Type.OBJECT,
                properties: {
                    achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    summary: { type: Type.STRING },
                    nextWeekPlans: { type: Type.ARRAY, items: { type: Type.STRING } },
                    risks: { type: Type.STRING }
                },
                nullable: true
              }
            },
            required: ["intent"]
          },
          systemInstruction: systemInstructionText
        }
      });
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      rawResponseText = response.text;
    } catch (e: any) {
      if (signal?.aborted || e.name === 'AbortError') throw e;
      return null;
    }
  } else {
    const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemInstructionText },
      { role: 'user', content: `用户输入: "${userInput}"` }
    ];
    rawResponseText = await callOpenAICompatible(settings, messages, true, signal);
  }

  if (!rawResponseText) return null;
  const data = extractJSON(rawResponseText);
  if (!data) return null;

  if (data.intent === 'ANALYZE' && data.reportData) {
    return { type: 'ANALYSIS', data: data.reportData };
  }
  if (data.intent === 'CREATE') {
    return createPlanFromRaw(data.planData || {});
  }
  return null;
};

export const generateSmartSuggestions = async (
  currentPlans: WorkPlan[], 
  settings: AISettings
): Promise<SmartSuggestion[]> => {
  const localTimeContext = formatLocalTime(new Date());
  const plansSummary = currentPlans.slice(0, 10).map(p => `${p.startDate.slice(11, 16)} ${p.title}`).join(', ');
  const systemPrompt = `你是一个日程建议专家。基于当前时间 ${localTimeContext} 和已有日程 ${plansSummary}，返回3个简短的 JSON 建议。格式: [{"label": "建议文案", "planData": {...}}]`;

  let rawResponseText: string | undefined | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: settings.model,
        contents: "建议",
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                planData: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                  },
                  required: ["title", "startDate", "endDate"]
                }
              }
            }
          },
          systemInstruction: systemPrompt
        }
      });
      rawResponseText = response.text;
    } catch (e) { return []; }
  } else {
     const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: "建议" }
    ];
    rawResponseText = await callOpenAICompatible(settings, messages, true);
  }

  if (rawResponseText) {
    const data = extractJSON(rawResponseText);
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
          label: item.label,
          planData: {
            title: item.planData?.title || "建议日程",
            startDate: parseDate(item.planData?.startDate) || new Date().toISOString(),
            endDate: parseDate(item.planData?.endDate) || new Date().toISOString(),
            tags: []
          }
      }));
    }
  }
  return [];
};
