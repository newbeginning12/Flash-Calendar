
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider } from "../types";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";

// Initialize Google AI with environment variable (Always used for Google Provider)
const googleAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

export const DEFAULT_MODEL = "gemini-2.5-flash";

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Helper: Standardize local time format (YYYY-MM-DD HH:mm:ss)
const formatLocalTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Helper: Extract JSON from markdown code blocks or raw text
const extractJSON = (text: string) => {
  try {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[0]);
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
  const isoLike = dateStr.replace(' ', 'T');
  const d = new Date(isoLike);
  return !isNaN(d.getTime()) ? d.toISOString() : null;
};

export type AIProcessingResult = 
  | { type: 'CREATE_PLAN'; data: Partial<WorkPlan> }
  | { type: 'ANALYSIS'; content: string }
  | null;

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

// --- OpenAI Compatible Adapter (DeepSeek / Qwen) ---
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
  if (!settings.apiKey || !settings.baseUrl) {
    console.error("Missing API Key or Base URL for custom provider");
    return null;
  }

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        temperature: 0.7,
        stream: false,
        // Some providers support response_format: { type: "json_object" }, but not all. 
        // We rely on system prompt for JSON structure.
        response_format: jsonMode ? { type: "json_object" } : undefined
      }),
      signal: signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${settings.provider}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    if (e.name === 'AbortError') {
        throw e; // Re-throw abort error to be handled by caller
    }
    console.error(`Network Error (${settings.provider}):`, e);
    return null;
  }
};

// --- Main Service Functions ---

export const processUserIntent = async (
  userInput: string, 
  currentPlans: WorkPlan[], 
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  
  // Explicitly calculate Date Ranges for "This Week" and "Next Week" to fix logic errors
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });     // Sunday
  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  
  const dateFormat = 'yyyy-MM-dd';
  const localTimeContext = format(now, 'yyyy-MM-dd HH:mm:ss');

  const dateContext = `
    时间上下文:
    - 当前时间: ${localTimeContext}
    - 本周范围: ${format(thisWeekStart, dateFormat)} 至 ${format(thisWeekEnd, dateFormat)} (含)
    - 下周范围: ${format(nextWeekStart, dateFormat)} 至 ${format(nextWeekEnd, dateFormat)} (含)
  `;

  // OPTIMIZATION: Filter plans to reduce token usage and prevent payload errors (XHR 500).
  // Only send plans from 30 days ago to 60 days in the future.
  const relevantPlans = currentPlans.filter(p => {
    const d = new Date(p.startDate);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    return d >= thirtyDaysAgo && d <= sixtyDaysLater;
  }).slice(0, 80); // Hard limit item count to avoid large payloads

  const plansContext = relevantPlans.map(p => ({
    title: p.title,
    start: p.startDate,
    simpleDate: p.startDate.split('T')[0], // Provide simple date string (YYYY-MM-DD) for easier AI comparison
    end: p.endDate,
    status: p.status === 'DONE' ? '已完成' : (p.status === 'IN_PROGRESS' ? '进行中' : '待办')
  }));

  const systemInstructionText = `
    你是一个专业的工作计划助手。根据用户输入和当前时间/日程数据，判断意图是 CREATE (创建/修改) 还是 ANALYZE (查询/周报)。
    
    ${dateContext}

    请返回严格的 JSON 格式。

    1. 如果是周报请求或分析请求 (ANALYZE)：
       - 必须根据 'Current Plans' 生成内容。
       - **严格的时间分类规则**:
         * "1. 本周完成工作": 仅包含 simpleDate 落在 **本周范围** (${format(thisWeekStart, dateFormat)} ~ ${format(thisWeekEnd, dateFormat)}) 内的任务 (无论状态是否完成，都列在这里)。务必逐个对比日期。
         * "3. 下周工作计划": 仅包含 simpleDate 落在 **下周范围** (${format(nextWeekStart, dateFormat)} ~ ${format(nextWeekEnd, dateFormat)}) 内的任务。务必逐个对比日期。
         * **严禁**将本周的任务放入下周计划，反之亦然。
       - **列表格式要求**:
         * 所有列表项请务必使用 **数字序号** (1., 2., 3.)，**严禁**使用无序列表 (- 或 *)。
         * 格式推荐: "1. 任务标题 (YYYY-MM-DD, 状态)"。状态请务必使用中文 (已完成, 进行中, 待办)。
       - 返回格式: { "intent": "ANALYZE", "analysisContent": "Markdown..." }
       - Markdown 内容**必须**包含以下4个严格标题 (请保持完全一致，不要修改标点):
         ### 1. 本周完成工作
         ### 2. 本周工作总结
         ### 3. 下周工作计划
         ### 4. 需协调与帮助

    2. 如果是创建日程 (CREATE)：
       - 基于当前时间(${localTimeContext})推算准确的 ISO 时间。
       - tags 数组: 请务必非常精简，只生成 1-2 个核心词（例如 "会议", "开发", "Bug"）。
       - 返回格式: { "intent": "CREATE", "planData": { "title": "...", "description": "...", "startDate": "YYYY-MM-DDTHH:mm:ss", "endDate": "...", "tags": [] } }
  `;

  const promptContent = `
    Current Plans: ${JSON.stringify(plansContext)}
    User Input: "${userInput}"
  `;

  let rawResponseText: string | undefined | null = null;

  // Branch Logic based on Provider
  if (settings.provider === AIProvider.GOOGLE) {
    // --- Google Implementation ---
    try {
      // Note: @google/genai SDK generateContent currently relies on the promise resolution.
      // AbortSignal support depends on SDK internals, but we handle logic cancellation in App.tsx as well.
      const response = await googleAI.models.generateContent({
        model: settings.model,
        contents: promptContent,
        config: {
          responseMimeType: "application/json",
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
              analysisContent: { type: Type.STRING, nullable: true }
            },
            required: ["intent"]
          },
          systemInstruction: systemInstructionText
        }
      });
      
      // Manual check if aborted during await
      if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
      }

      rawResponseText = response.text;
    } catch (e: any) {
      if (signal?.aborted || e.name === 'AbortError') {
          throw e;
      }
      console.error("Google AI Error:", e);
      return null;
    }
  } else {
    // --- DeepSeek / Qwen / Custom Implementation ---
    const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemInstructionText + " IMPORTANT: Only return the JSON object, no markdown code fences." },
      { role: 'user', content: promptContent }
    ];
    rawResponseText = await callOpenAICompatible(settings, messages, true, signal);
  }

  // --- Common Processing ---
  if (!rawResponseText) return null;
  
  const data = extractJSON(rawResponseText);
  if (!data) return null;

  if (data.intent === 'ANALYZE' && data.analysisContent) {
    return { type: 'ANALYSIS', content: data.analysisContent };
  }

  if (data.intent === 'CREATE' && data.planData) {
    const startISO = parseDate(data.planData.startDate);
    const endISO = parseDate(data.planData.endDate);

    if (!startISO || !endISO) {
      console.error("Invalid dates returned by AI", data.planData);
      return null;
    }

    return {
      type: 'CREATE_PLAN',
      data: {
        id: crypto.randomUUID(),
        title: data.planData.title,
        description: data.planData.description || "",
        startDate: startISO,
        endDate: endISO,
        status: PlanStatus.TODO,
        tags: (data.planData.tags || []).slice(0, 3), // Strictly limit tags to 3 max
        color: getRandomColor(),
        links: []
      }
    };
  }

  return null;
};

export const generateSmartSuggestions = async (
  currentPlans: WorkPlan[], 
  settings: AISettings
): Promise<SmartSuggestion[]> => {
  const localTimeContext = formatLocalTime(new Date());
  
  // Also limit history for suggestions
  const plansSummary = currentPlans
    .slice(0, 15) 
    .map(p => `${p.startDate.slice(0, 16)}: ${p.title}`)
    .join('; ');

  const systemPrompt = `
    你是一个日程规划专家。
    当前时间: ${localTimeContext}
    已有日程: ${plansSummary}
    
    生成 3 个基于当前时间或空档的智能日程建议。
    返回一个 JSON 数组 (Array)，每个元素包含:
    1. "label": 简短文本（如“下午3点组会”）。
    2. "planData": { "title": "...", "startDate": "YYYY-MM-DDTHH:mm:ss", "endDate": "...", "tags": [], "description": "" }
    
    tags 请仅生成 1 个最相关的短标签（如"会议"）。
    确保时间格式准确。默认时长1小时。
  `;

  let rawResponseText: string | undefined | null = null;

  if (settings.provider === AIProvider.GOOGLE) {
    try {
      const response = await googleAI.models.generateContent({
        model: settings.model,
        contents: "生成建议",
        config: {
          responseMimeType: "application/json",
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
                    description: { type: Type.STRING, nullable: true },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }
                  },
                  required: ["title", "startDate", "endDate"]
                }
              },
              required: ["label", "planData"]
            }
          },
          systemInstruction: systemPrompt
        }
      });
      rawResponseText = response.text;
    } catch (e) {
      console.error("Google AI Suggestion Error:", e);
      return [];
    }
  } else {
     const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemPrompt + " IMPORTANT: Return only the JSON array." },
      { role: 'user', content: "生成建议" }
    ];
    // Suggestions usually don't need abort signal as they run in background
    rawResponseText = await callOpenAICompatible(settings, messages, true);
  }

  if (rawResponseText) {
    const data = extractJSON(rawResponseText);
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
          label: item.label,
          planData: {
            title: item.planData.title,
            description: item.planData.description,
            startDate: parseDate(item.planData.startDate) || new Date().toISOString(),
            endDate: parseDate(item.planData.endDate) || new Date().toISOString(),
            tags: (item.planData.tags || []).slice(0, 1) // Enforce max 1 tag for suggestions
          }
      }));
    }
  }
  return [];
};
