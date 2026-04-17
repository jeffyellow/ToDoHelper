# ToDoHelper 活力暖色视觉重塑设计文档

## 概述
将 ToDoHelper 的 UI 从常规中性灰白风格升级为**活泼暖色风（Playful Warm）**，让界面更现代、更轻盈、更具亲和力。本次改造**仅涉及视觉风格（颜色、圆角、阴影、间距、字体）**，不改动任何布局结构或交互逻辑。

## 设计方向

### 核心感受
- 温暖、愉悦、有能量感
- 像现代生活方式类 App 一样让人愿意点开使用
- 通过大圆角和柔和弥散阴影营造"泡泡感"层级

### 设计关键词
奶油底色 · 糖果点缀 · 圆润极致 · 柔和弥散 · 饱满按钮

## 视觉规范

### 圆角系统
| 元素 | 圆角值 |
|------|--------|
| 大卡片（任务项、编辑器） | 20px |
| 小卡片/容器 | 16px |
| 按钮 | 14px |
| 输入框 | 12px |
| 优先级标签/徽章 | 999px（胶囊形） |

### 阴影系统
| 状态 | 值 |
|------|-----|
| 默认卡片 | `0 8px 24px rgba(0, 0, 0, 0.06)` |
| Hover 卡片 | `0 12px 32px rgba(0, 0, 0, 0.1)` + `translateY(-2px)` |
| 悬浮窗 | 保持原有 `backdrop-filter: blur(8px)`，背景色跟随新 token |

### 按钮风格
- **主按钮**：饱满填充，背景 `#fb923c`，白色文字，hover 加深至 `#f97316`
- **次要/幽灵按钮**：透明背景，hover 时背景变为 `--surface-hover`

### 优先级标识
彩色圆角胶囊小标签：
- 高优先级：`#f43f5e`（玫红）
- 中优先级：`#fbbf24`（暖黄）
- 低优先级：`#34d399`（薄荷绿）

## 配色方案

### Light Theme
```css
--bg: #fff7ed;
--bg-rgb: 255, 247, 237;
--surface: #ffffff;
--surface-hover: #ffedd5;
--border: #fed7aa;
--text-primary: #431407;
--text-secondary: #78350f;
--text-tertiary: #9a3412;
--disabled: #fdba74;

--color-primary: #fb923c;
--color-primary-hover: #f97316;
--color-primary-subtle: #fff7ed;

--color-success: #34d399;
--color-warning: #fbbf24;
--color-danger: #f43f5e;
```

### Dark Theme
```css
--bg: #1a120b;
--bg-rgb: 26, 18, 11;
--surface: #2d1f16;
--surface-hover: #3f2c22;
--border: #5c3d2e;
--text-primary: #fffbeb;
--text-secondary: #a8a29e;
--text-tertiary: #78716c;
--disabled: #57534e;

--color-primary: #fb923c;
--color-primary-hover: #f97316;
--color-primary-subtle: #2d1f16;

--color-success: #34d399;
--color-warning: #fbbf24;
--color-danger: #fb7185;
```

## 改造范围

### 涉及文件
1. `src/styles/theme.css` — 全套 color token 替换
2. `src/components/TaskItem.vue` — 圆角、阴影、标签样式
3. `src/components/FloatTaskList.vue` — 同步新风格
4. `src/components/FloatControls.vue` — 按钮/滑块样式
5. `src/components/TaskEditor.vue` — 编辑器容器和输入框样式
6. `src/components/Sidebar.vue` — 背景色和 hover 效果
7. `src/components/TopBar.vue` — 搜索框圆角和颜色
8. `src/components/PriorityBadge.vue` — 胶囊标签新配色
9. `src/views/FloatView.vue` — 悬浮窗背景色跟随 `--bg-rgb`

### 不包含
- 新增动效或复杂动画（保留已有过渡）
- 图标库更换
- 布局结构变动
- 新增功能

## 验收标准
- [ ] Light 主题下背景为奶油橘色，卡片纯白，阴影柔和
- [ ] Dark 主题下背景为深可可色，卡片巧克力色
- [ ] 所有卡片圆角 ≥ 16px，大卡片 20px
- [ ] 优先级标签为圆角胶囊形
- [ ] 主按钮为饱满暖橙填充
- [ ] 悬浮窗透明度功能不受主题更新影响
