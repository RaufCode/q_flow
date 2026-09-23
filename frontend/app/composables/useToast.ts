export type ToastTone = 'success' | 'error' | 'info'

export function useToast() {
  const message = useState('toast-message', () => '')
  const visible = useState('toast-visible', () => false)
  const tone = useState<ToastTone>('toast-tone', () => 'info')

  let timer: ReturnType<typeof setTimeout> | null = null

  const showToast = (msg: string, t: ToastTone = 'info') => {
    message.value = msg
    tone.value = t
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, 3000)
  }

  return { message, visible, tone, showToast }
}