let timer: ReturnType<typeof setTimeout> | null = null

const style = document.createElement('style')
style.textContent = `
.global-toast {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
}
.global-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}`
document.head.appendChild(style)

export function showToast(msg: string, duration = 1000): void {
  if (timer) clearTimeout(timer)
  const old = document.querySelector('.global-toast')
  if (old) old.remove()

  const el = document.createElement('div')
  el.className = 'global-toast'
  el.textContent = msg
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))

  timer = setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 300)
    timer = null
  }, duration)
}
