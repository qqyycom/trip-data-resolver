# Repository Guidelines

## 项目结构与模块组织
本仓库基于 Next.js 15 与 TypeScript。所有页面路由位于 `src/app`，`page.tsx` 承担主界面渲染，`device` 目录用于设备视图。可复用界面组件放在 `src/components`，其中 `ui` 子目录封装 shadcn/ui 组件。轨迹解析、抽稀与地图匹配算法集中在 `src/lib`（如 `simplification.ts`、`mapMatching.ts`、`gpsParser.ts`），类型声明统一存放于 `src/types/index.ts`。根目录的 `next.config.js`、`tailwind.config.js` 与 `postcss.config.js` 管理构建与样式流程，示例输入位于 `sample-data.txt`。

## 构建、测试与开发命令
使用 `npm run dev` 启动本地开发环境（默认端口 3000），编辑 `src` 即自动热更新。`npm run build` 执行生产构建并进行类型检查，`npm run start` 以生产模式启动。`npm run lint` 使用 `eslint-config-next` 校验代码风格；在提交前运行以保持 CI 一致性。

## 代码风格与命名约定
项目采用 TypeScript + React 函数组件，统一使用 ES 模块与顶层 `"use client"` 声明。保持 2 空格缩进，组件与 Hook 使用 PascalCase，工具函数使用 camelCase。Tailwind CSS 工具类优先写在 `className`，多条件时借助 `clsx` 或 `class-variance-authority`。新增公共 UI 时放入 `src/components/ui` 并与现有模式保持一致。

## 测试准则
当前尚未配置自动化测试框架；当引入 Vitest 或 Jest 时，请将单元测试放在与源文件同级的 `__tests__` 或 `*.test.ts` 中，并使用描述性测试名称（示例：`simplification.rdp preserves endpoints`）。添加新算法或数据转换逻辑前，请编写覆盖核心边界和异常路径的测试，并记录预期输入输出。

## 提交与合并请求流程
Git 历史采用 Conventional Commits 变体，例如 `feat(map): xxx`、`docs(README): xxx`。撰写提交信息时保持动词祈使句，范围标识使用业务或模块名称。提交前确保通过 `npm run lint`，必要时附上关键截图或调试数据。发起合并请求时须包含变更摘要、测试说明以及相关 Issue 链接，若涉及配置或环境变量调整，请在描述中清晰列出对应文件及回滚方案。

## 安全与配置提示
地图匹配依赖 `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`。请将 Token 写入 `.env.local` 并确保 `.env*` 文件在 `.gitignore` 中保持忽略状态；在分享调试信息时不要泄露真实凭据。导入大规模 GPS 数据前，可使用 `src/lib/utils.ts` 中的辅助函数检查数据质量，避免在浏览器端产生阻塞。
