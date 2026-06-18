<script setup lang="ts">
// 设置对话框 — 通用 / 显示 / 终端 三个标签页

import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'

const emit = defineEmits<{
  close: []
}>()

type Tab = 'general' | 'display' | 'terminal'
const activeTab = ref<Tab>('general')
const show = ref(true)
const { state, setReopenTabs, setAutoFtp, setUseSystemTitleBar, setLocale, setFontSize, setZoom, flush } = useSettingsStore()
const { locale } = useI18n()

// 使用本地 ref 确保滑块与显示值实时响应
const fontSize = ref(state.settings.fontSize)
const zoom = ref(Math.round(state.settings.zoom * 100))

// 监听 store 变化，同步本地 ref（解决会话存在时设置不同步的问题）
watch(() => state.settings.fontSize, (val) => { fontSize.value = val })
watch(() => state.settings.zoom, (val) => { zoom.value = Math.round(val * 100) })

async function close(): Promise<void> {
  await flush()
  show.value = false
  emit('close')
}

function onLocaleChange(val: string): void {
  locale.value = val
  setLocale(val)
}

function onFontSizeInput(val: number): void {
  fontSize.value = val
  setFontSize(val)
}

function onFontSizeChange(delta: number): void {
  const v = Math.max(8, Math.min(32, fontSize.value + delta))
  onFontSizeInput(v)
  setFontSize(v)
}

function onZoomChange(delta: number): void {
  const v = Math.max(100, Math.min(300, zoom.value + delta * 100))
  zoom.value = v
  setZoom(v / 100)
}

onMounted(() => {
  // settings 从磁盘加载后，locale 通过 App.vue 初始化，无需额外操作
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-overlay" @click.self="close">
      <div class="dialog">
        <div class="dialog-header">
          <h2>{{ $t('settingsDialog.title') }}</h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'general' }"
            @click="activeTab = 'general'"
          >
            {{ $t('settingsDialog.tab.general') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'display' }"
            @click="activeTab = 'display'"
          >
            {{ $t('settingsDialog.tab.display') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'terminal' }"
            @click="activeTab = 'terminal'"
          >
            {{ $t('settingsDialog.tab.terminal') }}
          </button>
        </div>
        <div class="dialog-body">
          <!-- 通用 -->
          <div v-if="activeTab === 'general'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.general.language') }}</label>
              <select
                class="setting-select"
                :value="state.settings.locale"
                @change="onLocaleChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="zh-CN">{{ $t('settingsDialog.general.languageZh') }}</option>
                <option value="en">{{ $t('settingsDialog.general.languageEn') }}</option>
              </select>
            </div>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="state.settings.reopenTabs"
                @change="setReopenTabs(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.reopenTabs') }}</span>
            </label>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="state.settings.autoFtp"
                @change="setAutoFtp(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.autoFtp') }}</span>
            </label>
          </div>
          <!-- 显示 -->
          <div v-if="activeTab === 'display'" class="tab-content">
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="state.settings.useSystemTitleBar"
                @change="setUseSystemTitleBar(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.useSystemTitleBar') }}</span>
            </label>
            <div class="setting-row">
              <label class="setting-label">缩放</label>
              <input
                type="range"
                class="setting-slider"
                min="100"
                max="300"
                step="10"
                v-model.number="zoom"
                @change="setZoom(zoom / 100)"
              />
              <span class="setting-value">{{ zoom }}%</span>
              <button class="step-btn" @click="onZoomChange(-0.1)">−</button>
              <button class="step-btn" @click="onZoomChange(0.1)">+</button>
            </div>
          </div>
            <!-- 终端 -->
          <div v-if="activeTab === 'terminal'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">字体大小</label>
              <input
                type="range"
                class="setting-slider"
                min="8"
                max="32"
                step="1"
                v-model.number="fontSize"
                @input="setFontSize(fontSize)"
              />
              <span class="setting-value">{{ fontSize }}px</span>
              <button class="step-btn" @click="onFontSizeChange(-1)">−</button>
              <button class="step-btn" @click="onFontSizeChange(1)">+</button>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="close">{{ $t('settingsDialog.cancel') }}</button>
          <button class="btn-primary" @click="close">{{ $t('settingsDialog.ok') }}</button>
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
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  color: #cdd6f4;
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

.tabs {
  display: flex;
  border-bottom: 1px solid #313244;
  padding: 0 20px;
}

.tab-btn {
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6c7086;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: #cdd6f4;
}

.tab-btn.active {
  color: #89b4fa;
  border-bottom-color: #89b4fa;
}

.dialog-body {
  padding: 20px;
  min-height: 160px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.placeholder {
  color: #6c7086;
  font-size: 13px;
  text-align: center;
  padding: 40px 0;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 0;
}

.checkbox-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #89b4fa;
  cursor: pointer;
  flex-shrink: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.setting-label {
  font-size: 13px;
  color: #cdd6f4;
  min-width: 60px;
}

.setting-select {
  background: #181825;
  border: 1px solid #313244;
  border-radius: 4px;
  color: #cdd6f4;
  font-size: 13px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.setting-select:focus {
  border-color: #89b4fa;
}

.setting-slider {
  flex: 1;
  max-width: 160px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #313244;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.setting-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #89b4fa;
  cursor: pointer;
  border: none;
}

.setting-value {
  font-size: 12px;
  color: #a6adc8;
  min-width: 40px;
  text-align: right;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #313244;
}

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  min-width: 72px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.btn-primary {
  background: #89b4fa;
  color: #1e1e2e;
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:hover {
  background: #b4d0fb;
}

.btn-secondary {
  background: #313244;
  color: #cdd6f4;
}

.btn-secondary:hover {
  background: #45475a;
}

.step-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #45475a;
  border-radius: 4px;
  background: #181825;
  color: #cdd6f4;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  padding: 0;
}

.step-btn:hover {
  background: #313244;
}
</style>
