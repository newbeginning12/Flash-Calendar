
import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider } from "../types";

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
  jsonMode: boolean = true
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
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${settings.provider}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error(`Network Error (${settings.provider}):`, e);
    return null;
  }
};

// --- Main Service Functions ---

export const processUserIntent = async (
  userInput: string, 
  currentPlans: WorkPlan[], 
  settings: AISettings
): Promise<AIProcessingResult> => {
  const localTimeContext = formatLocalTime(new Date());

  const plansContext = currentPlans.map(p => ({
    title: p.title,
    start: p.startDate,
    end: p.endDate,
    status: p.status
  }));

  const systemInstructionText = `
    你是一个专业的工作计划助手。根据用户输入和当前时间/日程数据，判断意图是 CREATE (创建/修改) 还是 ANALYZE (查询/周报)。
    当前时间: ${localTimeContext}

    请返回严格的 JSON 格式。

    1. 如果是周报请求或分析请求 (ANALYZE)：
       - 根据 'Current Plans' 生成详细内容。
       - 返回格式: { "intent": "ANALYZE", "analysisContent": "Markdown格式的内容..." }
       - Markdown 内容需包含: ### 1. 本周完成工作, ### 2. 本周工作总结, ### 3. 下周工作计划, ### 4. 需协调与帮助

    2. 如果是创建日程 (CREATE)：
       - 基于当前时间(${localTimeContext})推算准确的 ISO 时间。
       - tags 数组: 请务必非常精简，只生成 1-2 个核心词（例如 "会议", "开发", "Bug"）。不要生成超过 2 个标签。
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
      rawResponseText = response.text;
    } catch (e) {
      console.error("Google AI Error:", e);
      return null;
    }
  } else {
    // --- DeepSeek / Qwen / Custom Implementation ---
    const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemInstructionText + " IMPORTANT: Only return the JSON object, no markdown code fences." },
      { role: 'user', content: promptContent }
    ];
    rawResponseText = await callOpenAICompatible(settings, messages, true);
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
      console.error("Invalid dates returned by AI");
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
        tags: (data.planData.tags || []).slice(0, 3), // Strictly limit tags to 3 max to avoid UI clutter
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
  
  const plansSummary = currentPlans
    .slice(0, 10) 
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
