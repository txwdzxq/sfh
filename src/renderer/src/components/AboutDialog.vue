<script setup lang="ts">
// 关于对话框 — 显示应用名称、版本、技术栈

import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  close: []
}>()

const show = ref(true)
const appVersion = ref('')
const electronVersion = ref('')
const chromeVersion = ref('')
const nodeVersion = ref('')
const vueVersion = ref('3.5')
const tsVersion = ref('5.9')

onMounted(async () => {
  appVersion.value = await window.api.getAppVersion()
  const v = await window.api.getVersions()
  electronVersion.value = v.electron
  chromeVersion.value = v.chrome
  nodeVersion.value = v.node
})

function close(): void {
  show.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-overlay" @click.self="close">
      <div class="dialog about-dialog">
        <div class="dialog-header">
          <h2>{{ $t('aboutDialog.title') }}</h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="about-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#89b4fa"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 class="app-name">{{ $t('aboutDialog.appName') }}</h1>
          <p class="app-desc">{{ $t('aboutDialog.appDescription') }}</p>
          <table class="info-table">
            <tbody><tr>
              <td class="label">{{ $t('aboutDialog.label.appVersion') }}</td>
              <td class="value">
                {{ appVersion }}
                <a
                  class="github-link"
                  href="https://github.com/txwdzxq/sfh"
                  target="_blank"
                  title="GitHub"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8"
                    />
                  </svg>
                </a>
              </td>
            </tr>
            <tr>
              <td class="label">{{ $t('aboutDialog.label.electron') }}</td>
              <td class="value">{{ electronVersion }}</td>
            </tr>
            <tr>
              <td class="label">{{ $t('aboutDialog.label.chromium') }}</td>
              <td class="value">{{ chromeVersion }}</td>
            </tr>
            <tr>
              <td class="label">{{ $t('aboutDialog.label.nodejs') }}</td>
              <td class="value">{{ nodeVersion }}</td>
            </tr>
            <tr>
              <td class="label">{{ $t('aboutDialog.label.vue') }}</td>
              <td class="value">{{ vueVersion }}</td>
            </tr>
            <tr>
              <td class="label">{{ $t('aboutDialog.label.typescript') }}</td>
              <td class="value">{{ tsVersion }}</td>
            </tr>
          </tbody></table>
        </div>
        <div class="dialog-footer">
          <button class="btn-primary" @click="close">{{ $t('aboutDialog.ok') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  margin: auto;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  color: #cdd6f4;
}

.about-dialog {
  text-align: center;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #313244;
}

.dialog-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.dialog-body {
  padding: 24px 20px;
}

.about-icon {
  margin-bottom: 12px;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
}

.app-desc {
  font-size: 13px;
  color: #6c7086;
  margin: 0 0 20px;
}

.info-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.info-table tbody tr {
  border-bottom: 1px solid #313244;
}

.info-table tbody tr:last-child {
  border-bottom: none;
}

.info-table td {
  padding: 8px 12px;
  font-size: 13px;
}

.info-table .label {
  color: #a6adc8;
  width: 40%;
}

.info-table .value {
  color: #cdd6f4;
  text-align: right;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.github-link {
  color: #6c7086;
  text-decoration: none;
  margin-left: 6px;
  vertical-align: middle;
  transition: color 0.15s;
}

.github-link:hover {
  color: #89b4fa;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #313244;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background: #89b4fa;
  color: #1e1e2e;
  font-weight: 500;
}

.btn-primary:hover {
  background: #b4d0fb;
}
</style>
