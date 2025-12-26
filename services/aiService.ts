
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
        const tagsStr = p.tags && p.tags.length > 0 ? ` [标签: ${p.tags.join(', ')}]` : '';
        const descStr = p.description ? ` (描述: ${p.description.slice(0, 50)}${p.description.length > 50 ? '...' : ''})` : '';
        return `- [${statusMap[p.status]}] ${p.title}${tagsStr}${descStr} (${p.startDate.slice(0, 10)})`;
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

export const enhanceFuzzyTask = async (
  rawText: string,
  settings: AISettings
): Promise<Partial<WorkPlan> | null> => {
  const systemPrompt = `
    你是一个闪念优化专家。用户 input 了一个碎片化的想法，请将其优化。
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
    
    const systemPrompt = `
      你是一个极专业的高级办公助手。请根据提供的本周原始日程数据生成一份结构化周报。
      数据包含任务标题、状态、标签以及详情描述。

      必须返回 JSON 格式：
      {
        "achievements": ["具体完成项1", "具体完成项2", ...],
        "summary": "专业的工作总结点评...",
        "nextWeekPlans": ["合理的下周计划1", ...],
        "risks": "具体的风险提示或协调建议"
      }
    `;

    let raw: string | null = null;
    if (settings.provider === AIProvider.GOOGLE) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({ 
            model: settings.model, 
            contents: `以下是本周日程数据：\n${context}`, 
            config: { 
                responseMimeType: "application/json", 
                systemInstruction: systemPrompt,
                temperature: 0.2
            } 
        });
        raw = response.text;
    } else { 
        raw = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: `数据：\n${context}` }], true, signal); 
    }
    
    if (!raw) return null;
    return extractJSON(raw) as WeeklyReportData;
};

export const processMonthlyReview = async (allPlans: WorkPlan[], settings: AISettings, signal?: AbortSignal): Promise<AIProcessingResult> => {
  const now = new Date();
  const monthPlans = allPlans.filter(p => new Date(p.startDate) >= new Date(now.getFullYear(), now.getMonth(), 1));
  const plansContext = formatPlansForContext(monthPlans);
  
  const systemPrompt = `
    你是一位最坦诚、犀利且专业的行为诊断顾问。
    请基于用户本月的日程数据（包含标题、描述、标签、状态），给出一份深度“镜像诊断书”。
    
    【输出要求】：
    1. 必须返回严格的 JSON 格式。
    2. grade: 从 S 到 F 的等级。
    3. gradeTitle: 简短、有力的评价（如“多核运转的平衡者”或“碎片化陷阱中的囚徒”）。
    4. healthScore: 0-100 的整数，代表日程管理质量。
    5. chaosLevel: 0-100 的整数，代表混乱程度。
    6. patterns: 必须是对象数组，每个对象包含 id, label, description, type('warning'|'positive'|'info')。
    7. candidAdvice: 必须是对象数组，每个对象包含 truth (深刻的真相揭露) 和 action (具体的改进方案)。
    8. metrics: 包含 taggedRatio (0-1), descriptionRate (0-1), deepWorkRatio (0-1)。

    示例 JSON 结构：
    {
      "grade": "B",
      "gradeTitle": "执行力尚可但缺乏深度工作",
      "healthScore": 75,
      "chaosLevel": 40,
      "patterns": [{ "id": "1", "label": "会议过载", "description": "...", "type": "warning" }],
      "candidAdvice": [{ "truth": "你以为在忙，其实只是在开会。", "action": "缩减会议时长" }],
      "metrics": { "taggedRatio": 0.8, "descriptionRate": 0.5, "deepWorkRatio": 0.2 }
    }
  `;

  let rawResponseText: string | null = null;
  if (settings.provider === AIProvider.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({ 
      model: settings.model, 
      contents: `请诊断用户本月数据：\n${plansContext}`, 
      config: { 
        responseMimeType: "application/json", 
        systemInstruction: systemPrompt, 
        temperature: 0.7 
      } 
    });
    rawResponseText = response.text;
  } else { 
    rawResponseText = await callOpenAICompatible(settings, [{ role: 'system', content: systemPrompt }, { role: 'user', content: plansContext }], true, signal); 
  }
  
  if (!rawResponseText) return null;
  return { type: 'MONTH_REVIEW', data: extractJSON(rawResponseText) as MonthlyAnalysisData };
};

export interface SmartSuggestion { label: string; planData: { title: string; description?: string; startDate: string; endDate: string; tags?: string[]; } }

export const generateSmartSuggestions = async (currentPlans: WorkPlan[], settings: AISettings): Promise<SmartSuggestion[]> => {
  return [{ label: "安排明天会议", planData: { title: "同步会议", startDate: addWeeks(startOfDay(new Date()), 0).toISOString(), endDate: addWeeks(endOfDay(new Date()), 0).toISOString() } }];
};
