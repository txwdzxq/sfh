<script setup lang="ts">
defineProps<{
  showDialog: boolean
  sessionsActive: boolean
  queueActive: boolean
}>()

const emit = defineEmits<{
  newConnection: []
  sessions: []
  queue: []
  settings: []
  about: []
}>()
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-top">
      <button
        class="sidebar-btn"
        :title="$t('sidebar.newConnection.title')"
        @click="emit('newConnection')"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span class="btn-label">{{ $t('sidebar.newConnection.label') }}</span>
      </button>
      <button
        class="sidebar-btn"
        :class="{ active: sessionsActive }"
        :title="$t('sidebar.sessions.title')"
        @click="emit('sessions')"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span class="btn-label">{{ $t('sidebar.sessions.label') }}</span>
      </button>
    </div>
    <div class="sidebar-bottom">
      <button
        class="sidebar-btn"
        :class="{ active: queueActive }"
        :title="$t('sidebar.transfers.title')"
        @click="emit('queue')"
      >
        <span class="queue-icon">↑↓</span>
        <span class="btn-label">{{ $t('sidebar.transfers.label') }}</span>
      </button>
      <button class="sidebar-btn" :title="$t('sidebar.settings.title')" @click="emit('settings')">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        <span class="btn-label">{{ $t('sidebar.settings.label') }}</span>
      </button>
      <button class="sidebar-btn" :title="$t('sidebar.about.title')" @click="emit('about')">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span class="btn-label">{{ $t('sidebar.about.label') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 56px;
  background: var(--bg-mantle);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  flex-shrink: 0;
}

.sidebar-top,
.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.sidebar-btn {
  width: 44px;
  height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.sidebar-btn:active {
  background: var(--bg-hover);
}

.sidebar-btn.active {
  background: var(--bg-overlay);
  color: var(--accent);
}

.btn-label {
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}

.queue-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
