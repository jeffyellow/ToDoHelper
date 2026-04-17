# ToDoHelper Design System

## Product Identity

- **Product Type:** Personal productivity / task management desktop app
- **Target Audience:** Individual users who value focus, clarity, and calm aesthetics
- **Personality:** Clean, trustworthy, unobtrusive, quietly delightful
- **Keywords:** modern, minimal, elegant, calm, focused

## Design Philosophy

The UI should feel like a digital notebook — structured enough to organize tasks, soft enough to reduce stress. Avoid loud colors, heavy borders, or overly playful shapes. Every pixel should serve focus.

## Visual Style

### Overall Aesthetic
- **Soft minimalism** with subtle depth
- Rounded corners everywhere (cards 12px, buttons 8px, inputs 6px)
- Light, breathable spacing
- No sharp edges or harsh shadows
- Glassmorphism is **NOT** used (avoids distraction)
- Subtle elevation via very soft shadows only on elevated surfaces (modals, floating elements)

### Elevation & Shadows
- **Level 0 (base surfaces):** No shadow
- **Level 1 (cards, panels):** `0 1px 3px rgba(0,0,0,0.04)`
- **Level 2 (elevated cards, popovers):** `0 4px 12px rgba(0,0,0,0.06)`
- **Level 3 (modals):** `0 12px 32px rgba(0,0,0,0.1)`

## Color Palette

### Primary Accent
- **Indigo 500** `#6366f1` — Primary actions, active states, focus rings
- **Indigo 50** `#eef2ff` — Subtle backgrounds for selected items
- **Indigo 600** `#4f46e5` — Hover states

### Semantic Colors
- **Success:** Emerald 500 `#10b981` — Completed tasks, success toasts
- **Warning:** Amber 500 `#f59e0b` — Due soon, medium priority
- **Danger:** Rose 500 `#f43f5e` — Overdue, high priority, destructive actions

### Neutral Scale (Light Mode)
- **Background:** `#ffffff`
- **Surface (cards, sidebar):** `#fafafa`
- **Surface Hover:** `#f3f4f6`
- **Border:** `#e5e7eb`
- **Text Primary:** `#111827`
- **Text Secondary:** `#6b7280`
- **Text Tertiary:** `#9ca3af`
- **Disabled:** `#d1d5db`

### Neutral Scale (Dark Mode)
- **Background:** `#0f0f11`
- **Surface (cards, sidebar):** `#18181b`
- **Surface Hover:** `#27272a`
- **Border:** `#3f3f46`
- **Text Primary:** `#fafafa`
- **Text Secondary:** `#a1a1aa`
- **Text Tertiary:** `#71717a`
- **Disabled:** `#52525b`

### Priority Colors
- **High Priority:** Rose 500 `#f43f5e`
- **Medium Priority:** Amber 500 `#f59e0b`
- **Low Priority:** Slate 400 `#94a3b8`

## Typography

### Font Family
- **Primary:** Inter (system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)
- **Monospace:** JetBrains Mono (for dates/raw data in float view)

### Type Scale
| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 12px | 400 | 1.4 | Captions, timestamps |
| `text-sm` | 14px | 400 | 1.5 | Secondary text, labels |
| `text-base` | 16px | 400 | 1.6 | Body text, task titles |
| `text-lg` | 18px | 500 | 1.5 | Section headers |
| `text-xl` | 20px | 600 | 1.4 | Page titles |
| `text-2xl` | 24px | 600 | 1.3 | App name, empty states |

## Spacing System

Based on **4pt grid**:
- `space-1` = 4px
- `space-2` = 8px
- `space-3` = 12px
- `space-4` = 16px
- `space-5` = 20px
- `space-6` = 24px
- `space-8` = 32px
- `space-10` = 40px
- `space-12` = 48px

### Layout Spacing
- **Sidebar width:** 220px
- **Main content padding:** 24px
- **Card padding:** 16px
- **Card gap:** 12px
- **Section gap:** 24px

## Component Specifications

### Buttons
- **Primary:** Indigo 500 bg, white text, 8px radius, px-16 py-8, hover: Indigo 600, active: scale(0.98)
- **Secondary:** Transparent bg, gray-900 text, 1px border gray-200, hover: Surface Hover bg
- **Ghost:** Transparent, text only, hover: Surface Hover
- **Destructive:** Rose 500 bg, white text
- **Icon Button:** 32×32px touch target, 8px radius, hover: Surface Hover

### Inputs
- **Height:** 40px
- **Border:** 1px solid Border color
- **Radius:** 6px
- **Focus:** 2px Indigo 500 ring, border transitions to Indigo 500
- **Placeholder:** Text Tertiary

### Cards (TaskItem)
- **Background:** Surface color
- **Radius:** 12px
- **Padding:** 16px
- **Shadow:** Level 1
- **Hover:** Slightly elevated background or Level 2 shadow
- **Transition:** 150ms ease-out for background and shadow

### Checkboxes
- Custom rounded checkbox (6px radius)
- Unchecked: 1.5px border, Text Tertiary color
- Checked: Emerald 500 bg, white checkmark
- Transition: 150ms ease-out

### Tags / Chips
- **Height:** 24px
- **Padding:** px-8
- **Radius:** 12px (pill shape)
- **Background:** Indigo 50 (light) / Indigo 900/30 (dark)
- **Text:** Indigo 600 (light) / Indigo 400 (dark)

### Sidebar
- **Background:** Surface color
- **Border-right:** 1px Border color
- **Nav Item Height:** 36px
- **Nav Item Radius:** 8px
- **Active Item:** Indigo 50 bg (light) / Indigo 900/30 bg (dark)
- **Active Indicator:** Optional 3px left Indigo 500 bar

### TaskEditor Modal
- **Width:** 420px
- **Radius:** 16px
- **Shadow:** Level 3
- **Backdrop:** 40% black scrim

### Float View
- **Background:** Semi-transparent Surface with 95% opacity
- **Border:** 1px Border color
- **Radius:** 16px (window shape controlled by Tauri, content area should feel cohesive)
- **Controls:** Compact horizontal layout at bottom

## Animation Guidelines

### Durations
- **Micro-interactions:** 150ms
- **State changes (hover, focus):** 150ms
- **Modal enter/exit:** 200ms
- **View transitions (main ↔ float):** 250ms
- **List item stagger:** 30ms per item

### Easing
- **Default:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- **Enter:** `cubic-bezier(0, 0, 0.2, 1)`
- **Exit:** `cubic-bezier(0.4, 0, 1, 1)`

### Preferred Properties
- Only animate `transform` and `opacity`
- Never animate `width`, `height`, `top`, `left`
- Use `transform: scale()` for press feedback (0.97–0.98)
- Use `transform: translateY()` for slide entrances

### Reduced Motion
- All animations must respect `prefers-reduced-motion`
- When reduced motion is on, use instant transitions or simple opacity fades only

## Icons

- **Icon Set:** Lucide (consistent stroke width, clean, modern)
- **Stroke Width:** 1.5px
- **Sizes:**
  - `icon-sm`: 16px (inline, tags)
  - `icon-md`: 20px (buttons, list items)
  - `icon-lg`: 24px (top bar, empty states)
- **Never use emoji as icons**

## Light/Dark Mode Behavior

- Theme toggle in top bar
- System preference auto-detect on first launch
- Theme preference persisted in `app_settings`
- Both palettes designed together, not inverted
- All interactive states (hover, focus, disabled) defined for both modes
- Test contrast for every text/background pair

## Float View Specific Rules

- Transparent background slider adjusts **app window opacity** via Tauri API (not CSS on text)
- Text must remain readable even at reduced opacity (never go below 70% window opacity)
- Compact list: task title + due date only
- Due date uses monospace font for scannability
- Bottom control bar: always visible, 44px tall, solid Surface background at 98% opacity
