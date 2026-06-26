<script setup lang="ts">
import type { SshConnectionConfig, SshConnection } from '../../../main/ssh/types'
import type { FlyParticle } from '../composables/useFlyParticle'
import ConnectionDialog from './ConnectionDialog.vue'
import SettingsDialog from './SettingsDialog.vue'
import AboutDialog from './AboutDialog.vue'
import CloseConfirmDialog from './CloseConfirmDialog.vue'

defineProps<{
  showDialog: boolean
  editSession: SshConnection | null
  showSettings: boolean
  showAbout: boolean
  pendingClose: boolean
  showSize: boolean
  windowSize: { w: number; h: number }
  flyParticles: FlyParticle[]
}>()

defineEmits<{
  connect: [config: SshConnectionConfig, name: string]
  update: [id: string, config: SshConnectionConfig, name: string]
  closeDialog: []
  closeSettings: []
  closeAbout: []
  zoomDrag: [factor: number]
  zoomApply: [factor: number]
  confirmClose: []
  cancelClose: []
}>()
</script>

<template>
  <ConnectionDialog
    v-if="showDialog"
    :edit-session="editSession"
    @connect="(config, name) => $emit('connect', config, name)"
    @update="(id, config, name) => $emit('update', id, config, name)"
    @close="$emit('closeDialog')"
  />
  <SettingsDialog
    v-if="showSettings"
    @close="$emit('closeSettings')"
    @zoom-drag="$emit('zoomDrag', $event)"
    @zoom-apply="$emit('zoomApply', $event)"
  />
  <AboutDialog v-if="showAbout" @close="$emit('closeAbout')" />
  <CloseConfirmDialog
    v-if="pendingClose"
    @confirm="$emit('confirmClose')"
    @cancel="$emit('cancelClose')"
  />
  <transition name="fade">
    <div v-if="showSize" class="resize-overlay">{{ windowSize.w }} &times; {{ windowSize.h }}</div>
  </transition>
  <Teleport to="body">
    <span
      v-for="p in flyParticles"
      :id="'fly-' + p.id"
      :key="p.id"
      class="fly-particle"
      :style="{ left: p.x + 'px', top: p.y + 'px' }"
      >{{ p.filename }}</span
    >
  </Teleport>
</template>

<style scoped>
.resize-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(30, 30, 46, 0.85);
  border: 1px solid var(--bg-hover);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-primary);
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
}
.fly-particle {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  color: var(--accent);
  white-space: nowrap;
  will-change: transform, opacity;
}
</style>
