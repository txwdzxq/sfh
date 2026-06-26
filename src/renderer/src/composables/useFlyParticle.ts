import { ref, nextTick, type Ref } from 'vue'

export interface FlyParticle {
  id: number
  x: number
  y: number
  filename: string
}

let particleId = 0

export function useFlyParticle(): {
  flyParticles: Ref<FlyParticle[]>
  startFly: (x: number, y: number, filename: string) => void
} {
  const flyParticles = ref<FlyParticle[]>([])

  function animateParticle(p: FlyParticle): void {
    const el = document.getElementById('fly-' + p.id)
    if (!el) return
    const btn = document.querySelector<HTMLElement>('[data-queue-btn]')
    if (!btn) return
    const targetRect = btn.getBoundingClientRect()
    const dx = targetRect.left + targetRect.width / 2 - p.x
    const dy = targetRect.top + targetRect.height / 2 - p.y
    const midX = dx * 0.5
    const midY = dy * 0.3
    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${midX}px, ${midY}px) scale(0.7)`, opacity: 0.8 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }
      ],
      { duration: 500, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => {
      flyParticles.value = flyParticles.value.filter((fp) => fp.id !== p.id)
    }
  }

  function startFly(x: number, y: number, filename: string): void {
    const particle: FlyParticle = { id: ++particleId, x, y, filename }
    if (flyParticles.value.length >= 2) flyParticles.value.shift()
    flyParticles.value.push(particle)
    nextTick(() => animateParticle(particle))
  }

  return { flyParticles, startFly }
}
