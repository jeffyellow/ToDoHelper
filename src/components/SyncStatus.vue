<script setup>
defineProps({ status: String })

const labels = {
  idle: { icon: '🟢', text: '在线' },
  syncing: { icon: '🔄', text: '同步中' },
  error: { icon: '🔴', text: '同步错误' },
  offline: { icon: '⚠️', text: '离线' },
}
</script>

<template>
  <div class="sync-status" :title="labels[status]?.text">
    <span class="icon">{{ labels[status]?.icon }}</span>
  </div>
</template>

<style scoped>
.sync-status {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: default;
}
.icon {
  font-size: 14px;
  line-height: 1;
}
</style>
