<script setup>
const props = defineProps({ tag: String })
</script>

<template>
  <span class="tag-chip">{{ props.tag }}</span>
</template>

<style scoped>
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
</style>
