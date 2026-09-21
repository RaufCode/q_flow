export function useToast() {
  const message = useState('toast-message', () => '')
  const visible = useState('toast-visible', () => false)

  let timer: ReturnType<typeof setTimeout> | null = null

  const showToast = (msg: string) => {
    message.value = msg
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, 3000)
  }

  return { message, visible, showToast }
}