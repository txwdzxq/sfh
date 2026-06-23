/**
 * 节流函数：在指定时间内最多执行一次
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestArgs: Parameters<T> = [] as unknown as Parameters<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    const now = Date.now()
    const remaining = ms - (now - last)
    latestArgs = args as Parameters<T>
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      last = now
      fn(...latestArgs)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...latestArgs)
      }, remaining)
    }
  }) as T
}
