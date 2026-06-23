<script setup lang="ts">
// 设置对话框 — 通用 / 显示 / 终端 / 传输 四个标签页

import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import type { Theme } from '../../../shared/types'

const emit = defineEmits<{
  close: []
  zoomDrag: [factor: number]
  zoomApply: [factor: number]
}>()

type Tab = 'general' | 'display' | 'terminal' | 'transfer'
const activeTab = ref<Tab>('general')
const show = ref(true)
const {
  locale: appLocale,
  reopenTabs,
  autoFtp,
  useSystemTitleBar,
  theme,
  fontSize: storeFontSize,
  zoom: storeZoom,
  setReopenTabs,
  setAutoFtp,
  setUseSystemTitleBar,
  setLocale,
  setFontSize,
  setZoom,
  setTheme,
  defaultDownloadPath,
  setDefaultDownloadPath,
  askDownloadLocation,
  setAskDownloadLocation,
  showQueueOnDownload,
  setShowQueueOnDownload,
  downloadMode,
  setDownloadMode,
  opacity: storeOpacity,
  setOpacity,
  flush
} = useSettingsStore()
const { locale: $locale, t: $t } = useI18n()

// 使用本地 ref 确保滑块与显示值实时响应
const fontSize = ref(storeFontSize.value)
const zoom = ref(Math.round(storeZoom.value * 100))
const opacity = ref(Math.round(storeOpacity.value))
const sliderDragging = ref(false)
const systemDownloadsPath = ref('')
const editingDefaultPath = ref(false)

const isDefaultDownloadPath = computed(
  () => !defaultDownloadPath.value || defaultDownloadPath.value === systemDownloadsPath.value
)

const downloadModeHint = computed(() =>
  downloadMode.value === 'stream'
    ? $t('settingsDialog.transfer.downloadModeStreamHint')
    : $t('settingsDialog.transfer.downloadModeChunkHint')
)

onMounted(async () => {
  try {
    systemDownloadsPath.value = await window.api.getDefaultDownloadsPath()
  } catch {
    systemDownloadsPath.value = ''
  }
})

// 监听 store 变化，同步本地 ref（解决会话存在时设置不同步的问题）
watch(
  () => storeFontSize.value,
  (val) => {
    fontSize.value = val
  }
)
watch(
  () => storeZoom.value,
  (val) => {
    zoom.value = Math.round(val * 100)
  }
)
watch(
  () => storeOpacity.value,
  (val) => {
    opacity.value = Math.round(val)
  }
)

async function close(): Promise<void> {
  await flush()
  show.value = false
  emit('close')
}

function onLocaleChange(val: string): void {
  $locale.value = val
  setLocale(val)
}

function onFontSizeInput(val: number): void {
  const v = Math.max(8, Math.min(32, Math.round(val)))
  fontSize.value = v
  setFontSize(v)
}

function onFontSizeChange(delta: number): void {
  onFontSizeInput(fontSize.value + delta)
}

function onZoomChange(delta: number): void {
  const v = Math.max(100, Math.min(300, zoom.value + delta * 100))
  zoom.value = Math.round(v)
  const factor = Math.round(v) / 100
  setZoom(factor)
  try {
    window.api.setZoomFactor(factor)
  } catch (e) {
    console.error('[settings] setZoomFactor failed:', e)
  }
}

function onZoomDrag(): void {
  emit('zoomDrag', zoom.value / 100)
}

function onZoomRelease(): void {
  sliderDragging.value = false
  const factor = zoom.value / 100
  setZoom(factor)
  emit('zoomApply', factor)
}

function onOpacityChange(delta: number): void {
  const v = Math.max(0, Math.min(100, opacity.value + delta))
  opacity.value = v
  const factor = Math.round(v) / 100
  setOpacity(Math.round(v))
  try {
    window.api.setWindowOpacity(factor)
  } catch (e) {
    console.error('[settings] setWindowOpacity failed:', e)
  }
}

function onOpacityDrag(): void {
  const factor = opacity.value / 100
  try {
    window.api.setWindowOpacity(factor)
  } catch (e) {
    console.error('[settings] setWindowOpacity failed:', e)
  }
}

function onOpacityRelease(): void {
  const val = opacity.value
  setOpacity(val)
}

function resetToDefault(): void {
  setDefaultDownloadPath('')
  editingDefaultPath.value = false
}

async function browseDownloadPath(): Promise<void> {
  const dir = await window.api.openFolderDialog()
  if (dir) {
    setDefaultDownloadPath(dir)
    editingDefaultPath.value = false
  }
}
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
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'transfer' }"
            @click="activeTab = 'transfer'"
          >
            {{ $t('settingsDialog.tab.transfer') }}
          </button>
        </div>
        <div class="dialog-body">
          <!-- 通用 -->
          <div v-if="activeTab === 'general'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.general.language') }}</label>
              <select
                class="setting-select"
                :value="appLocale"
                @change="onLocaleChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="zh-CN">{{ $t('settingsDialog.general.languageZh') }}</option>
                <option value="en">{{ $t('settingsDialog.general.languageEn') }}</option>
              </select>
            </div>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="reopenTabs"
                @change="setReopenTabs(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.reopenTabs') }}</span>
            </label>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="autoFtp"
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
                :checked="useSystemTitleBar"
                @change="setUseSystemTitleBar(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.useSystemTitleBar') }}</span>
            </label>
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.display.theme') }}</label>
              <select
                class="setting-select"
                :value="theme"
                @change="setTheme(($event.target as HTMLSelectElement).value as Theme)"
              >
                <option value="mocha">{{ $t('settingsDialog.display.themeMocha') }}</option>
                <option value="macchiato">{{ $t('settingsDialog.display.themeMacchiato') }}</option>
                <option value="frappe">{{ $t('settingsDialog.display.themeFrappe') }}</option>
                <option value="latte">{{ $t('settingsDialog.display.themeLatte') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.display.zoom') }}</label>
              <input
                v-model.number="zoom"
                type="range"
                class="setting-slider"
                min="100"
                max="300"
                step="10"
                @mousedown="sliderDragging = true"
                @input="onZoomDrag()"
                @change="onZoomRelease()"
              />
              <span class="setting-value">{{ zoom }}%</span>
              <button class="step-btn" @click="onZoomChange(-0.1)">−</button>
              <button class="step-btn" @click="onZoomChange(0.1)">+</button>
            </div>
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.display.opacity') }}</label>
              <input
                v-model.number="opacity"
                type="range"
                class="setting-slider"
                min="0"
                max="100"
                step="1"
                @input="onOpacityDrag()"
                @change="onOpacityRelease()"
              />
              <span class="setting-value">{{ opacity }}%</span>
              <button class="step-btn" @click="onOpacityChange(-1)">−</button>
              <button class="step-btn" @click="onOpacityChange(1)">+</button>
            </div>
          </div>
          <!-- 终端 -->
          <div v-if="activeTab === 'terminal'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.terminal.fontSize') }}</label>
              <input
                v-model.number="fontSize"
                type="range"
                class="setting-slider"
                min="8"
                max="32"
                step="1"
                @input="onFontSizeInput(fontSize)"
              />
              <span class="setting-value">{{ fontSize }}px</span>
              <button class="step-btn" @click="onFontSizeChange(-1)">−</button>
              <button class="step-btn" @click="onFontSizeChange(1)">+</button>
            </div>
          </div>
          <!-- 传输 -->
          <div v-if="activeTab === 'transfer'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">{{
                $t('settingsDialog.transfer.defaultDownloadPath')
              }}</label>
              <div class="path-input-group">
                <template v-if="isDefaultDownloadPath && !editingDefaultPath">
                  <span class="path-display" @click="editingDefaultPath = true">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {{ $t('settingsDialog.transfer.defaultPathLabel') }}
                  </span>
                </template>
                <input
                  v-else
                  class="setting-input"
                  :value="defaultDownloadPath"
                  :placeholder="systemDownloadsPath"
                  @input="setDefaultDownloadPath(($event.target as HTMLInputElement).value)"
                  @blur="editingDefaultPath = false"
                />
                <button class="browse-btn" @click="browseDownloadPath">⋯</button>
              </div>
            </div>
            <button v-if="!isDefaultDownloadPath" class="reset-btn" @click="resetToDefault">
              {{ $t('settingsDialog.transfer.resetDefault') }}
            </button>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="askDownloadLocation"
                @change="setAskDownloadLocation(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.transfer.askDownloadLocation') }}</span>
            </label>
            <label class="checkbox-row">
              <input
                type="checkbox"
                :checked="showQueueOnDownload"
                @change="setShowQueueOnDownload(($event.target as HTMLInputElement).checked)"
              />
              <span>{{ $t('settingsDialog.transfer.showQueueOnDownload') }}</span>
            </label>
            <div class="setting-row">
              <label class="setting-label">{{ $t('settingsDialog.transfer.downloadMode') }}</label>
              <select
                class="setting-select"
                :value="downloadMode"
                @change="
                  setDownloadMode(($event.target as HTMLSelectElement).value as 'chunk' | 'stream')
                "
              >
                <option value="chunk">
                  {{ $t('settingsDialog.transfer.downloadModeChunk') }}
                </option>
                <option value="stream">
                  {{ $t('settingsDialog.transfer.downloadModeStream') }}
                </option>
              </select>
              <span class="setting-hint">{{ downloadModeHint }}</span>
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
  margin: auto;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  color: var(--text-primary);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.dialog-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
}

.tab-btn {
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
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
  color: var(--text-muted);
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
  accent-color: var(--accent);
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
  color: var(--text-primary);
  min-width: 60px;
}

.setting-select {
  background: var(--bg-mantle);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.setting-select:focus {
  border-color: var(--accent);
}

.setting-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.setting-slider {
  flex: 1;
  max-width: 160px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-overlay);
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
  background: var(--accent);
  cursor: pointer;
  border: none;
}

.setting-value {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
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
  background: var(--accent);
  color: var(--bg-surface);
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.step-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--bg-hover);
  border-radius: 4px;
  background: var(--bg-mantle);
  color: var(--text-primary);
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
  background: var(--bg-overlay);
}

.path-input-group {
  display: flex;
  flex: 1;
  gap: 4px;
}

.setting-input {
  flex: 1;
  background: var(--bg-mantle);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 4px 8px;
  outline: none;
  min-width: 0;
}

.setting-input:focus {
  border-color: var(--accent);
}

.browse-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-mantle);
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.browse-btn:hover {
  background: var(--bg-overlay);
  color: var(--accent);
}

.path-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  color: var(--text-secondary);
  font-size: 13px;
  min-width: 0;
  cursor: pointer;
  border-radius: 4px;
}

.path-display:hover {
  background: var(--bg-overlay);
}

.path-display svg {
  flex-shrink: 0;
}

.reset-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}

.reset-btn:hover {
  background: var(--bg-overlay);
  color: var(--danger);
}
</style>
