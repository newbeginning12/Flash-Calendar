
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider, WeeklyReportData, AIProcessingResult } from "../types";
// fix: remove unused and missing startOfWeek, parseISO imports
import { endOfWeek, addWeeks, format, isWithinInterval } from "date-fns";

// Initialize Google AI with environment variable (Always used for Google Provider)
const googleAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

// fix: Use recommended gemini-3-flash-preview for text-based scheduling tasks
export const DEFAULT_MODEL = "gemini-3-flash-preview";

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Helper: Standardize local time format (YYYY-MM-DD HH:mm:ss)
const formatLocalTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Helper: Determine Plan Status based on time
const determineStatus = (startDateStr: string, endDateStr: string): PlanStatus => {
  const now = new Date();
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (end <= now) {
    return PlanStatus.DONE;
  }
  if (start <= now && end > now) {
    return PlanStatus.IN_PROGRESS;
  }
  return PlanStatus.TODO;
};

// Helper: Extract JSON from markdown code blocks or raw text
const extractJSON = (text: string) => {
  try {
    // 1. Try to find JSON inside ```json ... ``` blocks
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }

    // 2. intelligent detection: Array vs Object
    const firstOpenBrace = text.indexOf('{');
    const firstOpenBracket = text.indexOf('[');

    if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                return JSON.parse(arrayMatch[0]);
            } catch (e) {}
        }
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        return JSON.parse(objectMatch[0]);
    }
    
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Extraction Failed:", text);
    return null;
  }
};

// Helper: Parse dates
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
    startDate: string; // ISO
    endDate: string;   // ISO
    tags?: string[];
  }
}

interface OpenAITextContent {
  type: 'text';
  text: string;
}

interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAITextContent[];
}

const callOpenAICompatible = async (
  settings: AISettings, 
  messages: OpenAICompatibleMessage[],
  jsonMode: boolean = true,
  signal?: AbortSignal
): Promise<string | null> => {
  if (!settings.apiKey || !settings.baseUrl) {
    return null;
  }

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
        temperature: 0.1, // Lower temperature for more stable output
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

export const processUserIntent = async (
  userInput: string, 
  currentPlans: WorkPlan[], 
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  return handleIntentRequest(userInput, currentPlans, settings, signal);
};

const createPlanFromRaw = (rawPlan: any): AIProcessingResult => {
    const title = (rawPlan.title || "新日程").substring(0, 20); // Force title length

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
        tags: (rawPlan.tags || []).slice(0, 2), // Keep tags minimal
        color: getRandomColor(),
        links: []
      }
    };
}

const handleIntentRequest = async (
  textInput: string,
  currentPlans: WorkPlan[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  const localTimeContext = format(now, 'yyyy-MM-dd HH:mm:ss');
  const todayDate = format(now, 'yyyy-MM-dd');

  const systemInstructionText = `
    你是一个专业且干练的日程管理助手。
    
    【核心环境】
    - 当前时间: ${localTimeContext} (今天是 ${todayDate})
    - 语言: 中文

    【任务目标】
    分析用户输入，提取日程信息或生成报告，返回严格的 JSON。

    【解析规则 - 非常重要】
    1. **意图判断**:
       - “周报”、“总结”、“回顾” -> "ANALYZE"。
       - “周会”、“下午开会”、“明天XX” -> "CREATE"。
       - “周会”是一个会议事件，必须设为 "CREATE"。

    2. **标题提取 (title)**:
       - 必须精简！2-15 个字符。
       - 例如：用户说“下午两点开周会”，标题应为“周会”。

    3. **标签提取 (tags)**:
       - **核心要求**: 从用户输入中提取 1-2 个最相关的关键词作为标签。
       - **严禁发散**: 不要生成用户没提到的标签。只保留如“会议”、“开发”、“设计”、“个人”等基础词。
       - 示例：输入“写代码” -> tags: ["开发"]；输入“下午有个会” -> tags: ["会议"]。

    4. **时间解析 (startDate/endDate)**:
       - 基于 ${todayDate} 偏移。
       - 如果未说明时长，默认 1 小时。

    【输出格式】
    直接返回 JSON 对象，严禁任何解释。
    Schema:
    {
      "intent": "CREATE" | "ANALYZE",
      "planData": {
        "title": "精简标题",
        "description": "详细备注",
        "startDate": "YYYY-MM-DDTHH:mm:ss",
        "endDate": "YYYY-MM-DDTHH:mm:ss",
        "tags": ["标签1", "标签2"]
      },
      "reportData": {
        "achievements": [],
        "summary": "",
        "nextWeekPlans": [],
        "risks": ""
      }
    }
  `;

  let rawResponseText: string | undefined | null = null;

  if (settings.provider === AIProvider.GOOGLE) {
    try {
      const response = await googleAI.models.generateContent({
        model: settings.model,
        contents: { parts: [{ text: `用户输入: "${textInput}"` }] },
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
      console.error("AI API Error:", e);
      return null;
    }
  } else {
    const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemInstructionText },
      { role: 'user', content: `用户输入: "${textInput}"` }
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

  const systemPrompt = `你是一个日程建议专家。基于当前时间 ${localTimeContext} 和已有日程 ${plansSummary}，返回3个简短的 JSON 建议。标题不超过6个字。格式: [{"label": "建议文案", "planData": {...}}]`;

  let rawResponseText: string | undefined | null = null;

  if (settings.provider === AIProvider.GOOGLE) {
    try {
      const response = await googleAI.models.generateContent({
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
