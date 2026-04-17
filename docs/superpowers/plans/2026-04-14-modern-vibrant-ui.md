# Modern Vibrant UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the neutral gray UI with a playful warm theme featuring bubbly corners, soft shadows, and vibrant warm colors for both light and dark modes.

**Architecture:** Purely visual/token-level changes. Replace the entire CSS variable palette in `theme.css`, then update components to use larger border-radius values, softer diffuse shadows, and filled warm-orange buttons. No layout changes or logic changes.

**Tech Stack:** Vue 3, scoped CSS, CSS custom properties

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/styles/theme.css` | Global CSS variables for colors and base typography | Modify — replace entire light/dark palette |
| `src/components/PriorityBadge.vue` | Priority indicator badge | Modify — add pill shape background, update colors |
| `src/components/TaskItem.vue` | Main task list item card | Modify — increase border-radius, soften shadow, increase hover lift, update button radius |
| `src/components/FloatTaskList.vue` | Floating window task items | Modify — increase border-radius, add subtle shadow |
| `src/components/FloatControls.vue` | Floating window control bar | Modify — increase button radius |
| `src/components/TaskEditor.vue` | Modal task editor | Modify — increase radii, soften shadows, update focus ring color |
| `src/components/Sidebar.vue` | Left sidebar navigation | Modify — increase nav-item radius |
| `src/components/TopBar.vue` | Top search bar | Modify — increase input radius, update focus ring |
| `src/views/FloatView.vue` | Floating window root view | Modify — update fallback bg-rgb to match new light theme |
| `src/components/TagChip.vue` | Tag pill component | Modify — increase border-radius to full pill |

---

## Task 1: Replace global theme tokens

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Replace the entire file content with the new playful warm palette**

```css
:root {
  /* Primary */
  --color-primary: #fb923c;
  --color-primary-hover: #f97316;
  --color-primary-subtle: #fff7ed;

  /* Semantic */
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f43f5e;

  /* Light mode neutrals */
  --bg: #fff7ed;
  --bg-rgb: 255, 247, 237;
  --surface: #ffffff;
  --surface-hover: #ffedd5;
  --border: #fed7aa;
  --text-primary: #431407;
  --text-secondary: #78350f;
  --text-tertiary: #9a3412;
  --disabled: #fdba74;
}

[data-theme="dark"] {
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
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg);
  transition: background 150ms ease-out, color 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Utility spacing */
.space-y-2 > * + * { margin-top: 8px; }
.space-y-3 > * + * { margin-top: 12px; }
.space-y-4 > * + * { margin-top: 16px; }
```

- [ ] **Step 2: Build to verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css
git commit -m "style(theme): replace palette with playful warm theme"
```

---

## Task 2: Update PriorityBadge to pill style

**Files:**
- Modify: `src/components/PriorityBadge.vue`

- [ ] **Step 1: Replace file content**

```vue
<script setup>
const props = defineProps({ priority: Number })
const labels = { 2: '高', 1: '中', 0: '低' }
const classes = {
  2: 'high',
  1: 'medium',
  0: 'low',
}
</script>

<template>
  <span class="priority-badge" :class="classes[priority]">
    {{ labels[priority] }}
  </span>
</template>

<style scoped>
.priority-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.priority-badge.high {
  background: rgba(244, 63, 94, 0.12);
  color: #f43f5e;
}
.priority-badge.medium {
  background: rgba(251, 191, 36, 0.15);
  color: #d97706;
}
.priority-badge.low {
  background: rgba(52, 211, 153, 0.12);
  color: #059669;
}
[data-theme="dark"] .priority-badge.high {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
}
[data-theme="dark"] .priority-badge.medium {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
[data-theme="dark"] .priority-badge.low {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PriorityBadge.vue
git commit -m "style(PriorityBadge): convert to pill badge with warm colors"
```

---

## Task 3: Update TagChip to full pill

**Files:**
- Modify: `src/components/TagChip.vue`

- [ ] **Step 1: Increase border-radius to 999px**

Replace the `.tag-chip` rule:

```css
.tag-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TagChip.vue
git commit -m "style(TagChip): make tag a full pill"
```

---

## Task 4: Update TaskItem card styling

**Files:**
- Modify: `src/components/TaskItem.vue`

- [ ] **Step 1: Update the `.task-item`, `.task-item:hover`, `.checkmark`, and `.ghost-btn` styles**

Replace these CSS blocks in the `<style scoped>` section:

```css
.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.task-item:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

And replace `.checkmark`:

```css
.checkmark {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--text-tertiary);
  border-radius: 8px;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}
```

And replace `.ghost-btn`:

```css
.ghost-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 10px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TaskItem.vue
git commit -m "style(TaskItem): bubbly corners and diffuse shadow"
```

---

## Task 5: Update FloatTaskList card styling

**Files:**
- Modify: `src/components/FloatTaskList.vue`

- [ ] **Step 1: Update `.float-item` styles**

Replace:

```css
.float-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
```

And replace `.checkmark`:

```css
.checkmark {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--text-tertiary);
  border-radius: 6px;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FloatTaskList.vue
git commit -m "style(FloatTaskList): rounder cards and softer shadows"
```

---

## Task 6: Update FloatControls button radius

**Files:**
- Modify: `src/components/FloatControls.vue`

- [ ] **Step 1: Update `.icon-btn` border-radius**

Replace:

```css
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FloatControls.vue
git commit -m "style(FloatControls): rounder icon buttons"
```

---

## Task 7: Update TaskEditor modal styling

**Files:**
- Modify: `src/components/TaskEditor.vue`

- [ ] **Step 1: Update `.modal`, `.form input`, `.form select`, `.btn-secondary`, `.btn-primary`, and focus styles**

Replace `.modal`:

```css
.modal {
  width: 420px;
  max-width: 90%;
  background: var(--bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
```

Replace `.form input, .form select` block:

```css
.form input,
.form select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
}
.form input:focus,
.form select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
```

Replace `.btn-secondary`:

```css
.btn-secondary {
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
```

Replace `.btn-primary`:

```css
.btn-primary {
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TaskEditor.vue
git commit -m "style(TaskEditor): bubbly modal, rounder inputs and buttons"
```

---

## Task 8: Update Sidebar nav-item radius

**Files:**
- Modify: `src/components/Sidebar.vue`

- [ ] **Step 1: Update `.nav-item` border-radius**

Replace:

```css
.nav-item {
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.vue
git commit -m "style(Sidebar): rounder nav items"
```

---

## Task 9: Update TopBar search input

**Files:**
- Modify: `src/components/TopBar.vue`

- [ ] **Step 1: Update search input and focus ring**

Replace `.search input` block:

```css
.search input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  width: 260px;
  font-size: 14px;
}
.search input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
```

Replace `.icon-btn`:

```css
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopBar.vue
git commit -m "style(TopBar): rounder search input and icon buttons"
```

---

## Task 10: Update FloatView fallback bg-rgb

**Files:**
- Modify: `src/views/FloatView.vue`

- [ ] **Step 1: Update the rgba fallback to match new light theme bg-rgb**

In the `.float-view` rule, change:

```css
.float-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: rgba(var(--bg-rgb, 255, 247, 237), var(--float-bg-opacity, 0.85));
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/FloatView.vue
git commit -m "style(FloatView): update fallback bg-rgb for new theme"
```

---

## Task 11: Final build verification

**Files:**
- Test: build output

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Optional — run test suite**

Run: `npm run test:run`
Expected: All existing tests pass (no logic changes, so tests should be unaffected)

- [ ] **Step 3: Commit any remaining changes**

If there are any dist changes:
```bash
git add dist/
git commit -m "chore: rebuild dist with new theme"
```

---

## Self-Review Checklist

**Spec coverage:**
- Light theme cream background — Task 1
- Dark theme cocoa background — Task 1
- Cards ≥16px radius, large cards 20px — Tasks 4, 5, 7
- Priority badges as pills — Task 2
- Filled warm-orange primary buttons — Tasks 7 (and indirectly via theme tokens)
- Float transparency unaffected — Task 10 ensures fallback matches

**Placeholder scan:** No TBDs, TODOs, or vague steps. Every code change is shown in full.

**Type consistency:** All CSS selectors and component prop names match existing codebase. No new JS logic introduced.
