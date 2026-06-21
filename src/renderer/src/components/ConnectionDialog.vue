<script setup lang="ts">
// 连接/编辑对话框 — SSH 连接信息表单，支持新建和编辑两种模式

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SshConnectionConfig, SshConnection } from '../../../main/ssh/types'

const props = withDefaults(
  defineProps<{
    editSession?: SshConnection | null // 编辑模式下传入已有 session 进行预填充
  }>(),
  { editSession: null }
)

const emit = defineEmits<{
  connect: [config: SshConnectionConfig, name: string] // 新建模式
  update: [id: string, config: SshConnectionConfig, name: string] // 编辑模式
  close: []
}>()

// 表单绑定数据
const host = ref('')
const port = ref(22)
const username = ref('')
const password = ref('')
const privateKeyContent = ref('')
const useKey = ref(false)
const execCommand = ref('')
const name = ref('')
const show = ref(true)

const { t } = useI18n()

const portError = computed(() => {
  const p = port.value
  if (isNaN(p) || p < 1 || p > 65535 || !Number.isInteger(p)) return t('connectionDialog.portError')
  return ''
})

const authError = computed(() => {
  if (useKey.value) {
    if (!privateKeyContent.value.trim()) return t('connectionDialog.authError.key')
    return ''
  }
  if (!password.value) return t('connectionDialog.authError.password')
  return ''
})

const canSubmit = computed(() => {
  return host.value.trim() && username.value.trim() && !portError.value && !authError.value
})

// 编辑模式下预填充表单
onMounted(() => {
  if (props.editSession) {
    const s = props.editSession
    host.value = s.config.host
    port.value = s.config.port
    username.value = s.config.username
    name.value = s.name
    if (s.config.password) {
      password.value = s.config.password
    }
    if (s.config.privateKey) {
      useKey.value = true
      privateKeyContent.value = s.config.privateKey
    }
    execCommand.value = s.config.execCommand || ''
  }
})

function submit(): void {
  if (!canSubmit.value) return
  const config: SshConnectionConfig = {
    host: host.value.trim(),
    port: port.value,
    username: username.value.trim(),
    password: useKey.value ? undefined : password.value || undefined,
    privateKey: useKey.value ? privateKeyContent.value || undefined : undefined,
    execCommand: execCommand.value.trim() || undefined
  }
  const displayName = name.value || `${username.value}@${host.value}:${port.value}`
  console.log(`[dialog] submit: ${displayName}`)
  if (props.editSession) {
    emit('update', props.editSession.id, config, displayName)
  } else {
    emit('connect', config, displayName)
  }
}

function close(): void {
  show.value = false
  emit('close')
}

/** 从文件选择器读取私钥内容 */
async function selectKeyFile(): Promise<void> {
  try {
    const result = await window.api.openPrivateKey()
    if (result) {
      privateKeyContent.value = result.content
    }
  } catch (e) {
    console.error('[dialog] selectKeyFile failed:', e)
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-overlay" @click.self="close">
      <div class="dialog">
        <div class="dialog-header">
          <h2>
            {{ editSession ? $t('connectionDialog.titleEdit') : $t('connectionDialog.titleNew') }}
          </h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>{{ $t('connectionDialog.label.name') }}</label>
            <input
              v-model="name"
              :placeholder="
                $t('connectionDialog.placeholder.displayName', {
                  user: username || 'user',
                  host: host || 'host',
                  port
                })
              "
            />
          </div>
          <div class="form-row">
            <div class="form-group flex-grow">
              <label>{{ $t('connectionDialog.label.host') }}</label>
              <input v-model="host" :placeholder="$t('connectionDialog.placeholder.host')" />
            </div>
            <div class="form-group port-group">
              <label>{{ $t('connectionDialog.label.port') }}</label>
              <input v-model.number="port" type="number" min="1" max="65535" />
              <span v-if="portError" class="field-error">{{ portError }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('connectionDialog.label.username') }}</label>
            <input v-model="username" :placeholder="$t('connectionDialog.placeholder.username')" />
          </div>
          <div class="form-group auth-group">
            <label class="checkbox-label">
              <input v-model="useKey" type="checkbox" />
              {{ $t('connectionDialog.usePrivateKey') }}
            </label>
          </div>
          <!-- 密码认证 -->
          <div v-if="!useKey" class="form-group">
            <label>{{ $t('connectionDialog.label.password') }}</label>
            <input
              v-model="password"
              type="password"
              :placeholder="$t('connectionDialog.placeholder.password')"
            />
            <span v-if="authError" class="field-error">{{ authError }}</span>
          </div>
          <!-- 密钥认证 -->
          <div v-else>
            <div class="form-group">
              <div class="key-header">
                <label>{{ $t('connectionDialog.label.privateKey') }}</label>
                <button class="btn-secondary key-browse" @click="selectKeyFile">
                  {{ $t('connectionDialog.browseFile') }}
                </button>
                <span class="key-hint">{{ $t('connectionDialog.pasteKeyHint') }}</span>
              </div>
              <textarea
                v-model="privateKeyContent"
                class="key-textarea"
                :placeholder="$t('connectionDialog.placeholder.privateKey')"
                rows="3"
              ></textarea>
              <span v-if="authError" class="field-error">{{ authError }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('connectionDialog.label.execCommand') }}</label>
            <input
              v-model="execCommand"
              type="text"
              :placeholder="$t('connectionDialog.placeholder.execCommand')"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="close">{{ $t('connectionDialog.cancel') }}</button>
          <button class="btn-primary" :disabled="!canSubmit" @click="submit">
            {{ editSession ? $t('connectionDialog.save') : $t('connectionDialog.connect') }}
          </button>
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

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-grow {
  flex: 1;
}

.port-group {
  width: 100px;
}

input[type='text'],
input[type='password'],
input[type='number'] {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-mantle);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  box-sizing: border-box;
}

.field-error {
  display: block;
  font-size: 11px;
  color: var(--danger);
  margin-top: 2px;
}

input[type='text']:focus,
input[type='password']:focus,
input[type='number']:focus {
  outline: none;
  border-color: var(--accent);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.key-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.key-header .key-browse {
  flex-shrink: 0;
}

.key-header label {
  margin-bottom: 0;
}

.key-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.key-textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-mantle);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.5;
}

.key-textarea:focus {
  outline: none;
  border-color: var(--accent);
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

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}
</style>
