import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus, AISettings, AIProvider, WeeklyReportData, AIProcessingResult } from "../types";
import { startOfWeek, endOfWeek, addWeeks, format, isWithinInterval, parseISO } from "date-fns";

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

    // If Array starts before Object (or there are no objects), try to parse as Array
    if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                return JSON.parse(arrayMatch[0]);
            } catch (e) {
                 // If array parse fails, fall through to try object or raw
            }
        }
    }

    // 3. Try to find the first valid outer object {...}
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        return JSON.parse(objectMatch[0]);
    }
    
    // 4. Fallback to raw text
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

// --- OpenAI Compatible Adapter (DeepSeek / Qwen) ---
// Support for Multimodal Messages (Vision)
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
    console.error("Missing API Key or Base URL for custom provider");
    return null;
  }

  // Remove trailing slashes from baseUrl to prevent double slashes (e.g. .com//chat)
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
  return handleIntentRequest(userInput, currentPlans, settings, signal);
};


// Unified Handler
const handleIntentRequest = async (
  textInput: string,
  currentPlans: WorkPlan[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<AIProcessingResult> => {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  
  const dateFormat = 'yyyy-MM-dd';
  const localTimeContext = format(now, 'yyyy-MM-dd HH:mm:ss');
  
  // Explicitly format ranges for the AI
  const thisWeekRangeStr = `${format(thisWeekStart, dateFormat)} 至 ${format(thisWeekEnd, dateFormat)}`;
  const nextWeekRangeStr = `${format(nextWeekStart, dateFormat)} 至 ${format(nextWeekEnd, dateFormat)}`;

  // Logic Improvement: Pre-filter plans into strict buckets
  const thisWeekPlans = currentPlans.filter(p => 
    isWithinInterval(parseISO(p.startDate), { start: thisWeekStart, end: thisWeekEnd })
  );
  
  const nextWeekPlans = currentPlans.filter(p => 
    isWithinInterval(parseISO(p.startDate), { start: nextWeekStart, end: nextWeekEnd })
  );

  const dateContext = `
    时间上下文:
    - 当前时间: ${localTimeContext}
    - **本周范围 (This Week)**: ${thisWeekRangeStr} (含)
    - **下周范围 (Next Week)**: ${nextWeekRangeStr} (含)
  `;

  // Context plans (Optimized for tokens)
  const mapPlan = (p: WorkPlan) => ({
    title: p.title,
    date: p.startDate.split('T')[0], // Give AI the date string to be sure
    status: p.status,
    desc: p.description?.substring(0, 50)
  });

  // Strict separation in the payload
  const plansContextJSON = JSON.stringify({
    LIST_A_THIS_WEEK: thisWeekPlans.map(mapPlan),
    LIST_B_NEXT_WEEK: nextWeekPlans.map(mapPlan)
  });

  const systemInstructionText = `
    你是一个专业的工作计划助手 (AI Agent)。
    
    ${dateContext}

    **任务目标**: 
    分析用户输入，提取核心任务信息，并生成 JSON 格式的日程安排。

    **功能规则**:
    1. **创建日程 (CREATE)**: 用户想安排具体事项时。
    2. **分析/周报 (ANALYZE)**: 用户询问安排、生成周报或总结时。

    **周报生成严格规则 (ANALYZE)**:
    用户请求周报时，你是一个数据格式化员，而非决策者。必须严格遵守以下数据来源规则：
    
    1. **本周工作 (Achievements)**:
       - **只能** 从提供的 "LIST_A_THIS_WEEK" 列表中提取数据。
       - 即使 "LIST_A_THIS_WEEK" 中的某个任务日期是本周五（属于未来），它依然属于**本周工作计划**，**绝对不能**放到下周。
    
    2. **下周计划 (Next Week)**:
       - **只能** 从提供的 "LIST_B_NEXT_WEEK" 列表中提取数据。
       - 如果 "LIST_B_NEXT_WEEK" 为空，请输出 "暂无具体安排，建议根据本周进度规划"。
       - **严禁** 将 "LIST_A_THIS_WEEK" 中的任何任务挪到下周计划中，即使它们还没完成。

    **输出格式要求 (Strict JSON)**:
    直接返回 JSON 对象，不要包含 \`\`\`json 标记，**严禁包含任何思考过程或解释性文字**。

    Schema:
    {
      "intent": "CREATE" | "ANALYZE",
      "planData": {
        "title": "简练的任务标题",
        "description": "详细的任务背景 (清洗后的纯文本)",
        "startDate": "YYYY-MM-DDTHH:mm:ss (ISO 8601)",
        "endDate": "YYYY-MM-DDTHH:mm:ss (ISO 8601)",
        "tags": ["标签1", "标签2"]
      },
      "reportData": {
        "achievements": ["完成事项1 (MM-DD)", "进行中事项2 (MM-DD)"],
        "summary": "一段简练的本周工作总结 (50-100字)",
        "nextWeekPlans": ["下周事项1", "下周事项2"],
        "risks": "一段关于风险或需协调事项的描述，如果没有则写'无'"
      }
    }
  `;

  let rawResponseText: string | undefined | null = null;

  if (settings.provider === AIProvider.GOOGLE) {
    try {
      // Construct parts
      const parts: any[] = [{ text: `Strict Plans Data: ${plansContextJSON}\nUser Input: "${textInput}"` }];
      
      const response = await googleAI.models.generateContent({
        model: settings.model,
        contents: { parts },
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
      
      if (e.status === 429 || e.status === 'RESOURCE_EXHAUSTED' || e?.error?.code === 429) {
         console.warn("Google AI Quota Exceeded (429).");
         return null; 
      }
      
      console.error("Google AI Error:", e);
      return null;
    }
  } else {
    // OpenAI Compatible (Qwen-VL / DeepSeek) - Text Only now
    const messages: OpenAICompatibleMessage[] = [
      { role: 'system', content: systemInstructionText + " IMPORTANT: Only return the JSON object. No markdown, no thinking." },
      { role: 'user', content: `Strict Plans Data: ${plansContextJSON}\nUser Input: "${textInput}"` }
    ];

    rawResponseText = await callOpenAICompatible(settings, messages, true, signal);
  }

  // --- Common Processing ---
  if (!rawResponseText) return null;
  
  const data = extractJSON(rawResponseText);
  if (!data) return null;

  if (data.intent === 'ANALYZE' && data.reportData) {
    return { type: 'ANALYSIS', data: data.reportData };
  }

  // Handle CREATE intent (with heavy fallback logic)
  if (data.intent === 'CREATE') {
    const rawPlan = data.planData || {};
    
    // 1. Title Fallback
    const title = rawPlan.title || "AI 识别日程";

    // 2. Date Fallback Logic
    let startISO = parseDate(rawPlan.startDate);
    let endISO = parseDate(rawPlan.endDate);
    
    // If start date is missing or invalid, default to next hour
    if (!startISO) {
        console.warn("AI returned invalid start date, defaulting to next hour.");
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        startISO = nextHour.toISOString();
    }

    // If end date is missing or invalid, default to start + 1 hour
    if (!endISO) {
        const start = new Date(startISO!); // assert non-null because we just set it
        const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
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
        tags: (rawPlan.tags || []).slice(0, 3),
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
    } catch (e: any) {
      if (e.status === 429 || e.status === 'RESOURCE_EXHAUSTED' || e?.error?.code === 429) {
          console.warn("Google AI Quota Exceeded for Suggestions. Skipping.");
          return [];
      }
      console.error("Google AI Suggestion Error:", e);
      return [];
    }
  } else {
     // OpenAI compatible simple text call (no image)
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
            title: item.planData?.title || "建议日程",
            description: item.planData?.description || "",
            startDate: parseDate(item.planData?.startDate) || new Date().toISOString(),
            endDate: parseDate(item.planData?.endDate) || new Date().toISOString(),
            tags: (item.planData?.tags || []).slice(0, 1) // Enforce max 1 tag for suggestions
          }
      }));
    }
  }
  return [];
};