<script setup>
defineProps({ priority: Number })
const labels = { 2: '高', 1: '中', 0: '低' }
const classes = {
  2: 'high',
  1: 'medium',
  0: 'low',
}
function getClass(p) {
  return classes[p] ?? 'low'
}
function getLabel(p) {
  return labels[p] ?? '-'
}
</script>

<template>
  <span class="priority-badge" :class="getClass(priority)">
    {{ getLabel(priority) }}
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
