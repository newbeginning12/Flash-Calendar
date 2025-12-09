import { GoogleGenAI, Type } from "@google/genai";
import { WorkPlan, PlanStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

export const DEFAULT_MODEL = "gemini-2.5-flash";

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Helper: Standardize local time format (YYYY-MM-DD HH:mm:ss) to avoid locale ambiguity
const formatLocalTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Helper: Extract JSON from markdown code blocks or raw text
const extractJSON = (text: string) => {
  try {
    // Attempt to find JSON object or array
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

// Helper: Parse dates that might be space-separated instead of T-separated
const parseDate = (dateStr: string | undefined): string | null => {
  if (!dateStr) return null;
  // Fix "2024-05-20 14:00:00" to "2024-05-20T14:00:00"
  const isoLike = dateStr.replace(' ', 'T');
  const d = new Date(isoLike);
  return !isNaN(d.getTime()) ? d.toISOString() : null;
};

export type AIProcessingResult = 
  | { type: 'CREATE_PLAN'; data: Partial<WorkPlan> }
  | { type: 'ANALYSIS'; content: string }
  | null;

export interface SmartSuggestion {
  label: string; // Display text on chip
  planData: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    tags?: string[];
  }
}

export const processUserIntent = async (userInput: string, currentPlans: WorkPlan[], modelName: string = DEFAULT_MODEL): Promise<AIProcessingResult> => {
  const localTimeContext = formatLocalTime(new Date());

  // Simplified context
  const plansContext = currentPlans.map(p => ({
    title: p.title,
    start: p.startDate,
    end: p.endDate,
    status: p.status
  }));
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `
        Current Time: ${localTimeContext}
        Current Plans: ${JSON.stringify(plansContext)}
        User Input: "${userInput}"
      `,
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
        systemInstruction: `
          你是一个专业的工作计划助手。根据用户输入和当前时间/日程数据，判断意图是 CREATE (创建/修改) 还是 ANALYZE (查询/周报)。

          1. 如果是周报请求或分析请求 (ANALYZE)：
             - 你必须根据 'Current Plans' 中的数据，生成详细的内容。
             - 请在 'analysisContent' 字段中严格按以下 Markdown 标题结构输出，并确保每个标题下都有具体内容（如果无内容，请写“暂无”）：
             
             ### 1. 本周完成工作
             (列出状态为 DONE 的任务或过去的任务)
             ### 2. 本周工作总结
             (根据完成情况进行简短总结)
             ### 3. 下周工作计划
             (列出未来的任务)
             ### 4. 需协调与帮助
             (基于任务情况提出建议，如无则写暂无)

          2. 如果是创建日程 (CREATE)：
             - 在 'planData' 字段中填充数据。
             - 基于当前时间(${localTimeContext})推算准确的 ISO 时间。
             - 例如：如果现在是2023-10-10 10:00，用户说“下午3点开会”，则 startDate 为 2023-10-10T15:00:00。
        `
      }
    });

    if (!response.text) return null;
    
    const data = extractJSON(response.text);
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
          tags: data.planData.tags || [],
          color: getRandomColor(),
        }
      };
    }

    return null;

  } catch (error) {
    console.error("AI Processing Error:", error);
    return null;
  }
};

export const generateSmartSuggestions = async (currentPlans: WorkPlan[], modelName: string = DEFAULT_MODEL): Promise<SmartSuggestion[]> => {
  const localTimeContext = formatLocalTime(new Date());
  
  const plansSummary = currentPlans
    .slice(0, 10) 
    .map(p => `${p.startDate.slice(0, 16)}: ${p.title}`)
    .join('; ');

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `
        当前时间: ${localTimeContext}
        已有日程: ${plansSummary}
        
        生成 3 个基于当前时间或空档的智能日程建议。
        
        要求：
        1. "label": 简短的操作文本（如“下午3点组会”）。
        2. "planData": 预先计算好的完整日程数据。startDate/endDate 必须是基于当前时间的准确 YYYY-MM-DDTHH:mm:ss 格式。
        3. 默认时长 1 小时。
      `,
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
        }
      }
    });

    if (response.text) {
      const data = extractJSON(response.text);
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
           label: item.label,
           planData: {
             title: item.planData.title,
             description: item.planData.description,
             startDate: parseDate(item.planData.startDate) || new Date().toISOString(),
             endDate: parseDate(item.planData.endDate) || new Date().toISOString(),
             tags: item.planData.tags || []
           }
        }));
      }
    }
    return [];
  } catch (e) {
    console.error("Suggestion Error", e);
    return [];
  }
};
