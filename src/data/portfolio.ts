export type PageRoute = 'home' | 'works' | 'lab' | 'about' | 'project';

export type ProjectCategory = 'All' | 'WebGL & Shaders' | 'Physics & Canvas' | 'Design Systems';

export type PreviewVisualMode =
  | 'refraction-prism'
  | 'curl-constellation'
  | 'physics-capsules'
  | 'chromatic-waves'
  | 'spatial-grid';

export interface ProjectMetric {
  label: string;
  value: string;
}

export interface ProjectItem {
  slug: string;
  index: string;
  title: string;
  subtitle: string;
  category: Exclude<ProjectCategory, 'All'>;
  year: string;
  role: string;
  client: string;
  accentFrom: string;
  accentTo: string;
  previewMode: PreviewVisualMode;
  summary: string;
  tags: string[];
  metrics: ProjectMetric[];
  liveUrl: string;
  repoUrl: string;
  challenge: string;
  architecture: string;
  motionCraft: string;
  highlights: string[];
}

export interface OpenSourceTechItem {
  id: string;
  name: string;
  category: string;
  version: string;
  role: string;
  description: string;
  accent: string;
}

export interface TimelineEntry {
  period: string;
  role: string;
  company: string;
  location: string;
  summary: string;
  highlights: string[];
}

export const SITE_PROFILE = {
  brand: 'LIN.OPTICS',
  ownerName: '林澈 · Alex Lin',
  title: 'Senior Creative Frontend Engineer & Optical UI Designer',
  taglineZh: '以光学液态玻璃美学、GLSL 着色器与物理动效架构数字体验',
  taglineEn: 'Crafting refractive interfaces, real-time shaders & kinetic web architecture.',
  location: 'Shanghai / Remote · UTC+8',
  availability: 'Available for Q1 2027 Select Commissions',
  email: 'hello@linoptics.studio',
  github: 'https://github.com',
  xHandle: '@linoptics_dev',
  bio: '专注高性能 WebGL 图形渲染、苹果级液态玻璃设计系统与多引擎动效编排。过去 7 年主导多款面向全球设计团队与科技品牌的旗舰交互官网与实时 Canvas 创作工具，追求视觉高级感与 120fps 工程确定性的极致统一。',
};

export const ROUTE_MOODS: Record<
  PageRoute,
  {
    code: string;
    label: string;
    labelZh: string;
    colorA: [number, number, number];
    colorB: [number, number, number];
    colorC: [number, number, number];
    refractionStrength: number;
  }
> = {
  home: {
    code: '01',
    label: 'OVERVIEW',
    labelZh: '光影序章',
    colorA: [0.22, 0.54, 0.96],
    colorB: [0.58, 0.36, 0.96],
    colorC: [0.09, 0.82, 0.86],
    refractionStrength: 1.0,
  },
  works: {
    code: '02',
    label: 'ARCHIVE',
    labelZh: '精选作品',
    colorA: [0.16, 0.72, 0.88],
    colorB: [0.36, 0.42, 0.98],
    colorC: [0.68, 0.56, 0.98],
    refractionStrength: 1.15,
  },
  project: {
    code: '02B',
    label: 'CASE STUDY',
    labelZh: '项目解析',
    colorA: [0.32, 0.65, 0.98],
    colorB: [0.76, 0.48, 0.92],
    colorC: [0.95, 0.76, 0.45],
    refractionStrength: 1.25,
  },
  lab: {
    code: '03',
    label: 'CANVAS LAB',
    labelZh: '交互实验室',
    colorA: [0.06, 0.82, 0.92],
    colorB: [0.48, 0.32, 0.98],
    colorC: [0.96, 0.48, 0.72],
    refractionStrength: 1.45,
  },
  about: {
    code: '04',
    label: 'PROFILE',
    labelZh: '关于与履历',
    colorA: [0.76, 0.58, 0.38],
    colorB: [0.42, 0.46, 0.92],
    colorC: [0.24, 0.74, 0.88],
    refractionStrength: 0.85,
  },
};

export const PROJECTS: ProjectItem[] = [
  {
    slug: 'aether-os-liquid-glass',
    index: '01',
    title: 'Aether OS Optical System',
    subtitle: '下一代空间计算液态玻璃设计语言与实时折射引擎',
    category: 'Design Systems',
    year: '2026',
    role: 'Lead Design Engineer',
    client: 'Aether Spatial Labs',
    accentFrom: '#7dd3fc',
    accentTo: '#c084fc',
    previewMode: 'refraction-prism',
    summary:
      '构建一套兼具实时 SVG 色散折射、动态光标菲涅尔高光与弹性布局物理的跨平台 Liquid Glass 组件体系，服务 40+ 核心空间应用界面。',
    tags: ['React 19', 'SVG Displacement', 'Framer Motion', 'Design Tokens'],
    metrics: [
      { label: 'Frame Stability', value: '120 fps' },
      { label: 'Glass Components', value: '48+' },
      { label: 'Shader Overhead', value: '< 1.2ms' },
    ],
    liveUrl: '#lab',
    repoUrl: 'https://github.com',
    challenge:
      '传统网页毛玻璃（Glassmorphism）仅使用单层 blur 与半透明描边，缺乏真实透镜边缘的折射畸变、彩色色散与环境光响应，且 SVG 滤镜极易导致内部文字模糊。',
    architecture:
      '采用「双层光学隔离架构」：底层玻璃边缘渲染 SVG feTurbulence + feDisplacementMap 折射贴图与 CSS mask-composite 棱镜高光边框，顶层内容节点独立合成并保持亚像素级锐利排版。',
    motionCraft:
      '通过 Framer Motion layoutId 驱动胶囊态指示器的流体形变，配合指针距离场实现动态高光追踪与微倾角透视阻尼。',
    highlights: [
      '封装零文本模糊的 Double-Layer Specular Rim 光学组件原语',
      '支持实时调整折射率、表面曲率与边缘高光色温的 Token 引擎',
      '内置 prefers-reduced-motion 自动降级与低端 GPU 帧率自适应',
    ],
  },
  {
    slug: 'solaris-curl-symphony',
    index: '02',
    title: 'Solaris Curl Symphony',
    subtitle: '基于 Three.js GPGPU 旋度噪声场的十万级粒子音画旗舰站',
    category: 'WebGL & Shaders',
    year: '2026',
    role: 'Creative Technologist',
    client: 'Solaris Audio Research',
    accentFrom: '#38bdf8',
    accentTo: '#f472b6',
    previewMode: 'curl-constellation',
    summary:
      '为声学实验室打造的交互式产品发布网站，结合 Three.js 自定义 GLSL 粒子变形与 Lenis 惯性滚动，将声波频谱实时映射为液态星云拓扑。',
    tags: ['Three.js', 'Custom GLSL', 'Curl Noise', 'GSAP ScrollTrigger'],
    metrics: [
      { label: 'Active Particles', value: '65,536' },
      { label: 'Site Engagement', value: '+214%' },
      { label: 'Awwwards Score', value: '8.42 / 10' },
    ],
    liveUrl: '#lab',
    repoUrl: 'https://github.com',
    challenge:
      '在浏览器端同时承载高密度粒子形态切换、平滑滚动视差以及跨页面无缝镜头穿梭，并确保笔记本集成显卡与移动端流畅运行。',
    architecture:
      '在着色器顶点阶段融合 Simplex 3D Curl Noise 与多目标 SDF 形态插值（球体 / 莫比乌斯环 / 螺旋脉冲），避免每帧 CPU-GPU 缓冲回传瓶颈。',
    motionCraft:
      '将 Lenis 滚动速度 uScrollVelocity 直接注入片元着色器色散偏移量，滚动越快，玻璃透镜产生的光学色差拖尾越具张力。',
    highlights: [
      '全 GPU 顶点变形插值管线，零 CPU 数组遍历开销',
      'GSAP ScrollTrigger 编排五段式分镜相机曲线衔接',
      '指针磁力场实时排斥粒子并伴随衰减波纹残影',
    ],
  },
  {
    slug: 'kinetix-physics-playground',
    index: '03',
    title: 'Kinetix Glass Sandbox',
    subtitle: 'Matter.js 刚体物理与高光液态胶囊的 Canvas 交互实验平台',
    category: 'Physics & Canvas',
    year: '2025',
    role: 'Frontend Architect',
    client: 'Kinetix Interactive',
    accentFrom: '#a5f3fc',
    accentTo: '#fde68a',
    previewMode: 'physics-capsules',
    summary:
      '将开源 Matter.js 2D 物理引擎与自研 HiDPI Canvas 光学渲染管线深度结合，打造可拖拽、零重力切换、冲击波碰撞的玻璃质感交互沙盒。',
    tags: ['Matter.js', 'HTML5 Canvas 2D', 'HiDPI Optics', 'Spring Physics'],
    metrics: [
      { label: 'Collision Precision', value: 'Sub-step 2x' },
      { label: 'Canvas DPR', value: 'Adaptive 2x' },
      { label: 'Interactive Nodes', value: '120+ Bodies' },
    ],
    liveUrl: '#lab',
    repoUrl: 'https://github.com',
    challenge:
      'Matter.js 默认调试绘制非常粗糙，难以直接融入高端液态玻璃品牌网页中，且高分屏下的阴影与透明渐变容易出现性能掉帧。',
    architecture:
      '剥离默认渲染器，构建自定义 Canvas2D 光学材质渲染循环：离屏缓存静态环境贴图，每帧根据刚体角速度动态计算镜面高光角度与内部焦散折射弧线。',
    motionCraft:
      '点击任意区域触发径向冲击波脉冲，配合鼠标约束实现弹性拖拽抛掷，支持一键切换地球重力与零重力漂浮态。',
    highlights: [
      '物理演算与光学绘制完全解耦的 Canvas 渲染器',
      '支持矩形胶囊、多边形棱镜与球形液滴混合碰撞',
      '直接集成于本网站 Canvas Lab 第三号引擎可供试玩',
    ],
  },
  {
    slug: 'lumina-editorial-transitions',
    index: '04',
    title: 'Lumina Editorial Engine',
    subtitle: '多维页面衔接过渡、共享元素形变与液态遮罩转场框架',
    category: 'Design Systems',
    year: '2025',
    role: 'Principal UI Engineer',
    client: 'Lumina Cultural Press',
    accentFrom: '#93c5fd',
    accentTo: '#c4b5fd',
    previewMode: 'chromatic-waves',
    summary:
      '为数字艺术期刊研发的丝滑多路由转场引擎，结合 Clip-Path 液态波纹帘幕、WebGL 颜色情绪过渡与惯性排版动力学。',
    tags: ['GSAP Flip', 'Clip-Path Morph', 'Lenis Scroll', 'React Architecture'],
    metrics: [
      { label: 'Transition Time', value: '550 ms' },
      { label: 'Bounce Rate', value: '-38%' },
      { label: 'Lighthouse Perf', value: '99 / 100' },
    ],
    liveUrl: '#works',
    repoUrl: 'https://github.com',
    challenge:
      'SPA 应用中不同页面之间往往只做生硬淡入淡出，丢失空间连续感；而过度沉重的转场遮罩又会阻断用户连续浏览节奏。',
    architecture:
      '建立「三轨并行转场协议」：DOM 遮罩帘幕（60fps GPU Clip-path）、全局 WebGL 色温渐变插值、以及路由锚点自动复位协同在统一状态机内调度。',
    motionCraft:
      '借鉴电影剪辑的 Match Cut 理念，卡片进入详情页时伴随标题遮罩揭幕与连续视角缩放，阅读完底部的「下一篇」直接平滑接续。',
    highlights: [
      '非阻塞式 550ms 黄金窗口液态帘幕过渡',
      '键盘命令面板 ⌘K 与路由状态双向实时同步',
      '支持滚动速度驱动的动态倾斜跑马灯排版组件',
    ],
  },
  {
    slug: 'prism-spatial-grid',
    index: '05',
    title: 'Prism Spatial Telemetry',
    subtitle: '空间网格折射、光学坐标系统与实时数据可视化画布',
    category: 'WebGL & Shaders',
    year: '2024',
    role: 'Senior Visualization Engineer',
    client: 'Prism Cloud Studio',
    accentFrom: '#67e8f9',
    accentTo: '#818cf8',
    previewMode: 'spatial-grid',
    summary:
      '结合几何网格拓扑变形与液态玻璃浮层 HUD 的数据交互桌面，展示实时流体场向量与多维空间节点联动。',
    tags: ['WebGL2', 'Shader Distortion', 'Vector Fields', 'TypeScript'],
    metrics: [
      { label: 'Grid Vertices', value: '18,400' },
      { label: 'Input Latency', value: '4.2 ms' },
      { label: 'Bundle Gzipped', value: '42 KB' },
    ],
    liveUrl: '#lab',
    repoUrl: 'https://github.com',
    challenge:
      '在复杂实时网格渲染上方叠加透明控制台与指标浮窗时，如何维持信息可读性同时展现通透深邃的空间层次感。',
    architecture:
      '制定严格的「光学对比度阶梯规范」：背景网格控制亮度峰值不超过 45%，浮层面板通过暗色基底加 26px 饱和模糊确保文字对比度 > 7:1。',
    motionCraft:
      '鼠标扫过空间网格时产生平滑高斯凹陷透镜效果，局部网格线触发细微荧光色散反馈。',
    highlights: [
      '高斯透镜局部形变与色散发光着色器',
      '高可读性液态玻璃 HUD 层级与 WCAG AA 对比度保障',
      '零外部冗余依赖的纯 TypeScript 数学向量库封装',
    ],
  },
];

export const OPEN_SOURCE_STACK: OpenSourceTechItem[] = [
  {
    id: 'three',
    name: 'Three.js + Custom GLSL',
    category: 'WebGL 3D & Shaders',
    version: 'r187',
    role: '全局光学液态背景、3D 折射棱镜雕塑、GPGPU 旋度噪声粒子场',
    description:
      '驱动网页底层实时流体焦散、薄膜干涉虹彩（Iridescence）与可拖拽 3D 玻璃晶体。',
    accent: 'from-sky-400/25 to-indigo-500/20',
  },
  {
    id: 'matter',
    name: 'Matter.js + Canvas 2D',
    category: 'Rigid-Body Physics',
    version: 'v0.20',
    role: '2D 弹性碰撞物理演算 + 自研高光折射玻璃球渲染管线',
    description:
      '支持重力切换、鼠标约束抛掷与点击径向冲击波，呈现晶莹剔透的物理交互沙盒。',
    accent: 'from-cyan-300/25 to-amber-300/20',
  },
  {
    id: 'gsap',
    name: 'GSAP + ScrollTrigger',
    category: 'Choreography Engine',
    version: 'v3.15',
    role: '首屏分镜动画、视差景深编排与动态速度感应排版',
    description:
      '精准调度复杂时间轴、Clip-Path 文字揭幕与滚动锚点同步，确保帧级动画节奏。',
    accent: 'from-emerald-400/25 to-sky-400/20',
  },
  {
    id: 'lenis',
    name: 'Lenis Smooth Scroll',
    category: 'Inertial Scrolling',
    version: 'v1.3',
    role: '丝滑阻尼滚动与 WebGL 着色器滚动速度均匀量联动',
    description:
      '将页面物理惯性速度实时反馈给背景流场与跑马灯倾斜角，打破滚动与渲染的割裂感。',
    accent: 'from-violet-400/25 to-fuchsia-400/20',
  },
  {
    id: 'motion',
    name: 'Framer Motion',
    category: 'Layout & Route Morph',
    version: 'v14',
    role: '导航水滴态 layoutId 融合、页面液态帘幕过渡与卡片弹簧交互',
    description:
      '为路由转场、过滤器胶囊切换以及 ⌘K 命令面板提供自然的弹簧物理学响应。',
    accent: 'from-pink-400/25 to-violet-500/20',
  },
  {
    id: 'svg-optics',
    name: 'SVG Optics + CSS Masks',
    category: 'Liquid Glass Material',
    version: 'Native',
    role: 'feTurbulence 位移折射、边缘棱镜渐变描边与指针高光追踪',
    description:
      '原生浏览器管线与现代 CSS mask-composite 结合，在零文字模糊的前提下实现液态光学质感。',
    accent: 'from-amber-300/25 to-sky-300/20',
  },
];

export const TIMELINE: TimelineEntry[] = [
  {
    period: '2024 — PRESENT',
    role: 'Principal Creative Frontend Engineer',
    company: 'LIN.OPTICS Studio',
    location: 'Shanghai / Global Remote',
    summary:
      '主导全球前沿科技产品、AI 创作工具与独立设计品牌的交互架构与光学视觉系统，交付高转化且具备艺术辨识度的 Web 体验。',
    highlights: [
      '研发跨项目复用的 Liquid Glass UI 与 GLSL Shader 基础设施套件',
      '为 12+ 科技旗舰发布站提供 WebGL 交互设计与动效总监支持',
    ],
  },
  {
    period: '2021 — 2024',
    role: 'Senior Design Technologist',
    company: 'Aether Spatial Labs',
    location: 'Shanghai',
    summary:
      '负责下一代空间操作系统 Web 端原型平台与实时 Canvas 协同画布核心渲染链路研发，推动设计师与工程团队工作流融合。',
    highlights: [
      '重构 Canvas 2D / WebGL 混合渲染管线，大型画布缩放平移稳定 120fps',
      '主导构建包含 48 个光学质感组件的内部 Design System',
    ],
  },
  {
    period: '2019 — 2021',
    role: 'Frontend & Motion Engineer',
    company: 'Prism Digital Atelier',
    location: 'Hangzhou',
    summary:
      '深耕品牌叙事网站与创意编码实验，将 GSAP 滚动分镜、物理碰撞交互与现代排版美学引入商业数字产品。',
    highlights: [
      '连续 3 个独立项目入选国际创意前端精选展示',
      '建立团队高性能动画与无障碍降级工程规范',
    ],
  },
];
