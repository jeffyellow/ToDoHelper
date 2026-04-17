<script setup>
import { ref, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'

const props = defineProps({ open: Boolean, task: Object })
const emit = defineEmits(['close'])

const taskStore = useTaskStore()

const title = ref('')
const startDate = ref('')
const dueDate = ref('')
const priority = ref(1)
const tag = ref('')

watch(() => props.task, (t) => {
  if (t) {
    title.value = t.title
    startDate.value = t.start_date || ''
    dueDate.value = t.due_date || ''
    priority.value = t.priority
    tag.value = t.tag || ''
  } else {
    title.value = ''
    startDate.value = ''
    dueDate.value = ''
    priority.value = 1
    tag.value = ''
  }
}, { immediate: true })

async function save() {
  const payload = {
    title: title.value,
    startDate: startDate.value || undefined,
    dueDate: dueDate.value || undefined,
    priority: Number(priority.value),
    tag: tag.value || undefined,
  }
  try {
    if (props.task) {
      await taskStore.updateTaskById(props.task.id, payload)
    } else {
      await taskStore.addTask(payload)
    }
    emit('close')
  } catch (e) {
    console.error('Save task failed:', e)
    alert('保存失败：' + e.message)
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click="onBackdrop">
    <div class="modal">
      <h3 class="modal-title">{{ task ? '编辑任务' : '新建任务' }}</h3>
      <div class="form">
        <label>
          标题
          <input v-model="title" type="text" placeholder="输入任务标题" />
        </label>
        <label>
          开始日期
          <input v-model="startDate" type="date" />
        </label>
        <label>
          截止日期
          <input v-model="dueDate" type="date" />
        </label>
        <label>
          优先级
          <select v-model="priority">
            <option :value="2">高</option>
            <option :value="1">中</option>
            <option :value="0">低</option>
          </select>
        </label>
        <label>
          标签
          <input v-model="tag" type="text" placeholder="例如：工作" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" @click="emit('close')">取消</button>
        <button class="btn-primary" :disabled="!title.trim()" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: 420px;
  max-width: 90%;
  background: var(--bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
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
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.btn-secondary {
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary:hover {
  background: var(--surface-hover);
}
.btn-primary {
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
