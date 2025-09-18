# Ramer-Douglas-Peucker 轨迹抽稀可视化工具

这是一个基于 Ramer-Douglas-Peucker 算法的轨迹抽稀可视化工具，用于处理 GPS 轨迹数据并展示抽稀前后的轨迹变化。

## 功能特性

- 📁 **文件上传**: 支持拖拽上传 GPS 轨迹数据文件
- 🗺️ **地图可视化**: 在 Mapbox 地图上同时显示原始轨迹（蓝色）和抽稀轨迹（红色）
- ⚙️ **实时调整**: 支持实时调整抽稀容差参数，即时预览效果
- 📊 **统计信息**: 显示抽稀前后的数据点数量对比和压缩比
- 🎛️ **交互控制**: 可以独立控制原始轨迹和抽稀轨迹的显示/隐藏
- 📱 **响应式设计**: 支持桌面和移动端访问

## 技术栈

- **Next.js 15** (App Router) - React 框架
- **TypeScript** - 类型安全开发
- **Tailwind CSS** - 响应式样式设计
- **Mapbox GL JS** - 高性能地图渲染
- **simplify-js** - Ramer-Douglas-Peucker 算法实现

## 安装和运行

1. 克隆项目
\`\`\`bash
git clone <repository-url>
cd simplify
\`\`\`

2. 安装依赖
\`\`\`bash
npm install
\`\`\`

3. 配置环境变量
复制 \`.env.local.example\` 为 \`.env.local\` 并设置你的 Mapbox Access Token：
\`\`\`
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
\`\`\`

4. 启动开发服务器
\`\`\`bash
npm run dev
\`\`\`

5. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 数据格式

输入的 GPS 数据格式为：
\`\`\`
A,220725,033129,2235.1489,N,11357.0225,E,8.54,-0.66,0.42,-0.67;
\`\`\`

字段说明：
- A: 数据有效标识
- 220725: 日期（日月年格式，DDMMYY）
- 033129: 时间（时分秒格式，HHMMSS）
- 2235.1489,N: 纬度（度分格式，DDMM.MMMM + 方向）
- 11357.0225,E: 经度（度分格式，DDMM.MMMM + 方向）
- 8.54: 速度
- -0.66,0.42,-0.67: 三轴加速度数据

## 使用说明

1. **上传文件**: 拖拽或点击选择包含 GPS 轨迹数据的文件
2. **调整参数**: 使用左侧控制面板的滑块调整抽稀容差参数
3. **查看效果**: 地图上会实时显示抽稀前后的轨迹对比
4. **控制显示**: 可以独立控制原始轨迹和抽稀轨迹的显示
5. **查看统计**: 在控制面板中查看详细的统计信息

## 容差参数说明

- **0.00001°**: 最精细，保留最多细节
- **0.0001°**: 默认值，平衡精度和压缩效果
- **0.01°**: 最粗略，最大压缩比

容差值越小，保留的轨迹点越多；容差值越大，轨迹抽稀程度越高。

## 开发命令

\`\`\`bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint
\`\`\`

## 部署

本项目可以轻松部署到 Vercel、Netlify 等平台。确保在部署环境中正确设置 \`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN\` 环境变量。

## 性能优化

- 使用 React 18 的 Concurrent Features
- 实现了轨迹数据的分片处理
- 地图瓦片缓存优化
- 实时参数调整时的防抖处理

## 许可证

MIT License