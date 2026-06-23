<script setup lang="ts">
// 标签页右键菜单组件

import { useI18n } from 'vue-i18n'

defineProps<{
  x: number
  y: number
}>()

const emit = defineEmits<{
  reconnect: []
  closeLeft: []
  closeRight: []
  closeAll: []
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
    <div class="context-menu-item" @click="emit('reconnect')">
      {{ t('app.tabContextMenu.reload') }}
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" @click="emit('closeLeft')">
      {{ t('app.tabContextMenu.closeLeft') }}
    </div>
    <div class="context-menu-item" @click="emit('closeRight')">
      {{ t('app.tabContextMenu.closeRight') }}
    </div>
    <div class="context-menu-item" @click="emit('closeAll')">
      {{ t('app.tabContextMenu.closeAll') }}
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item context-menu-close" @click="emit('close')">
      {{ t('app.tabContextMenu.close') }}
    </div>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.context-menu-item:hover {
  background: var(--bg-overlay);
  color: var(--accent);
}

.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.context-menu-close {
  color: var(--text-muted);
  font-size: 12px;
}

.context-menu-close:hover {
  color: var(--danger);
  background: var(--bg-overlay);
}
</style>
