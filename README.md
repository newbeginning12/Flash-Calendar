# 闪历 (Flash Calendar) - AI 智能日程应用

一个优雅、智能的日程管理工具，深度集成 Google Gemini AI，支持自然语言交互、智能周报生成和流畅的日历管理体验。

## 📚 项目简介

闪历 (Flash Calendar) 旨在通过 AI 简化日程管理。用户无需繁琐地选择日期和时间，只需告诉 AI "下周五上午10点开会"，即可自动完成日程创建。项目采用 React + TypeScript 构建，界面设计致敬 Apple 生态，简洁而高效。

## ✨ 核心功能

1.  **AI 自然语言交互**:
    *   基于 `services/aiService.ts` 封装的 Google Gemini 接口。
    *   支持解析复杂的时间意图（如"下周三"、"每天上午"等逻辑需模型支持）。
    *   自动提取标题、时间、标签和备注。

2.  **可视化周日历**:
    *   `components/WeeklyCalendar.tsx` 实现了类似 Outlook/飞书的周视图。
    *   支持拖拽创建、智能吸附、冲突布局计算。

3.  **智能辅助**:
    *   **周报生成**: 自动汇总当前视图内的日程，生成结构化周报。
    *   **智能建议**: 底部输入框会根据当前时间推荐操作。
    *   **Flash Command**: 全局快捷指令中心 (`Cmd/Ctrl + K`)。

## 🛠️ 环境依赖与技术栈

### 核心依赖
*   **React 19**: 用于构建用户界面。
*   **TypeScript**: 提供类型安全支持。
*   **@google/genai**: Google 官方 Gemini SDK (v1.31.0+)。
*   **date-fns**: 轻量级日期处理库。
*   **lucide-react**: 现代化图标库。
*   **Tailwind CSS**: 实用优先的 CSS 框架 (CDN 引入)。

### 运行环境
*   浏览器环境需支持 ES Modules (ESM)。
*   依赖 `metadata.json` 定义的基本元数据。

## 🚀 启动与配置步骤

由于本项目结构采用了现代浏览器原生的 ES Module 导入方式 (`index.html` 中的 `importmap`)，启动非常简单。

### 1. 获取 API Key
本项目依赖 Google Gemini 模型。
*   请前往 [Google AI Studio](https://aistudio.google.com/) 获取 API Key。
*   **注意**: 默认情况下，应用会读取环境变量 `process.env.API_KEY`。在本地开发或部署时，请确保构建工具或运行时注入了此变量。

### 2. 本地开发 (Vite 推荐)

如果您希望在本地完整的 Node.js 环境中运行：

1.  **初始化项目**:
    ```bash
    npm create vite@latest flash-calendar -- --template react-ts
    cd flash-calendar
    npm install
    ```

2.  **安装特定依赖**:
    ```bash
    npm install @google/genai date-fns lucide-react
    ```
    *(注：当前代码使用了 CDN 的 importmap，迁移到本地需修改 import 路径或安装 npm 包)*

3.  **配置 Tailwind**:
    按照 Tailwind CSS 官方文档初始化 `tailwind.config.js`。

4.  **启动**:
    ```bash
    npm run dev
    ```

### 3. 在线环境 / 无构建工具运行

当前代码结构 (`index.html` + `importmap`) 支持在支持 ESM 的服务器上直接运行：

1.  将所有文件放入 Web 服务器目录 (如 `http-server` 或 Nginx)。
2.  确保 `process.env.API_KEY` 在运行时可用。

## ⚙️ 个性化配置

应用内提供了详细的设置面板 (`SettingsModal.tsx`)：
*   **模型切换**: 支持切换 Gemini 2.5 Flash (默认), Pro 等版本。
*   **自定义源**: 支持 DeepSeek 或其他 OpenAI 兼容接口 (需输入 Base URL 和 Key，仅保存在本地)。

## 📂 文件概览

*   `index.html`: 入口文件，定义 importmap 和 Tailwind 配置。
*   `App.tsx`: 应用主组件，布局管理。
*   `services/aiService.ts`: AI 调用与 Prompt 工程核心。
*   `components/`: UI 组件库 (日历、弹窗、侧边栏等)。
