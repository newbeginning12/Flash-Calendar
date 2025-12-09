# 闪历 (Flash Calendar) - AI 智能日程应用

一个优雅、智能的日程管理工具，深度集成 Google Gemini AI，支持自然语言交互、智能周报生成和流畅的日历管理体验。设计灵感源自 Apple 生态，追求极致的简洁与高效。

## 📚 项目简介

闪历 (Flash Calendar) 旨在通过 AI 简化日程管理。用户无需繁琐地选择日期和时间，只需告诉 AI “下周五上午10点开会”，即可自动完成日程创建。

### ✨ 核心功能

1.  **AI 自然语言交互**:
    *   **智能解析**: 基于 Google Gemini 模型，支持解析复杂的时间意图（如“下周三下午”、“每天上午”）。
    *   **自动填充**: 自动提取标题、起止时间、标签和备注信息。
    *   **多模型支持**: 内置 Google Gemini，同时兼容 DeepSeek、阿里通义千问等 OpenAI 格式接口。

2.  **可视化周日历**:
    *   **交互式视图**: 类似 Outlook/飞书的周视图，支持直观的时间块展示。
    *   **拖拽操作**: 支持在日历上直接拖拽创建日程、调整时间。
    *   **智能布局**: 自动计算日程冲突，优雅展示重叠任务。

3.  **智能辅助**:
    *   **周报生成**: 一键汇总当前视图内的日程，生成结构化的工作周报（包含完成情况、总结、计划）。
    *   **智能建议**: 底部输入框会根据当前时间与上下文推荐下一步操作。
    *   **Flash Command**: 全局快捷指令中心 (`Cmd/Ctrl + K`)，随时唤起 AI。

## 🛠️ 技术栈与依赖

本项目采用现代前端技术栈构建，注重性能与开发体验。

### 核心技术
*   **React 19**: 采用最新的 React 版本，利用并发特性优化 UI 响应。
*   **TypeScript**: 全量 TypeScript 编写，保证代码类型安全与可维护性。
*   **Tailwind CSS**: 实用优先的 CSS 框架，构建现代化 UI。

### 关键依赖库
*   `@google/genai` (^1.31.0): Google 官方 Gemini SDK。
*   `date-fns` (^4.1.0): 轻量级、功能强大的日期处理库。
*   `lucide-react` (^0.556.0): 精美、统一的图标库。

## 🚀 启动与配置指南

### 环境要求

*   **Node.js**: 推荐 **v18.0.0** 或更高版本 (LTS v20+ 最佳)。
*   **包管理器**: npm, yarn 或 pnpm。
*   **浏览器**: 支持 ES Modules 的现代浏览器 (Chrome 80+, Edge 80+, Firefox 75+, Safari 13+)。

### 方式一：本地开发 (推荐 Vite)

如果您将代码导出到本地环境运行，建议使用 Vite 初始化项目结构。

1.  **初始化项目**:
    ```bash
    # 创建 React + TypeScript 项目
    npm create vite@latest flash-calendar -- --template react-ts
    cd flash-calendar
    ```

2.  **安装依赖**:
    ```bash
    npm install
    
    # 安装项目特定依赖
    npm install @google/genai date-fns lucide-react class-variance-authority clsx tailwind-merge
    ```

3.  **配置环境变量**:
    在项目根目录创建 `.env` 文件，并添加您的 API Key：
    ```env
    VITE_API_KEY=your_google_gemini_api_key
    ```
    *(注意：本地开发需修改代码中 `process.env.API_KEY` 的读取方式为 `import.meta.env.VITE_API_KEY`，或者配置构建工具进行替换)*

4.  **配置 Tailwind CSS**:
    确保 `tailwind.config.js` 已正确初始化并指向您的源文件。

5.  **启动开发服务器**:
    ```bash
    npm run dev
    ```

### 方式二：在线沙盒 / 无构建环境

本项目针对现代 AI 编码环境（如 Google Project IDX, StackBlitz 等）进行了优化，采用原生 ES Module 导入 (`importmap`)。

1.  **直接运行**:
    在支持 `importmap` 的环境中，打开 `index.html` 即可运行。
    
2.  **API Key 配置**:
    *   环境通常会自动注入 `process.env.API_KEY`。
    *   如果未自动注入，请在应用的“设置”面板中选择“自定义提供商”或手动输入 Key。

## ⚙️ 详细配置

应用内提供了设置面板 (`SettingsModal`)，支持个性化定制：

*   **模型提供商**: 
    *   **Google Gemini**: 默认源，支持 Flash 2.5, Pro 1.5 等模型。
    *   **自定义 / OpenAI 兼容**: 可配置 Base URL 和 API Key，连接 DeepSeek、通义千问等模型。
*   **数据存储**: 
    *   日程数据 (`zhihui_plans`) 和设置 (`zhihui_ai_settings`) 均存储在浏览器 **LocalStorage** 中，保障隐私安全。

## 📂 目录结构概览

*   `index.html`: 入口文件，包含 importmap 依赖定义和 Tailwind CDN 配置。
*   `App.tsx`: 应用根组件，负责整体布局和状态管理。
*   `services/`:
    *   `aiService.ts`: 核心 AI 逻辑，包含 Prompt 工程、JSON 提取和多模型适配器。
*   `components/`:
    *   `WeeklyCalendar.tsx`: 核心日历视图组件，处理时间轴渲染和交互。
    *   `PlanModal.tsx`: 日程详情/编辑弹窗。
    *   `SmartInput.tsx`: 底部 AI 输入框组件。
    *   `TaskSidebar.tsx`: 左侧任务列表侧边栏。
*   `types.ts`: TypeScript 类型定义。
