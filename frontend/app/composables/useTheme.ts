export type Theme = 'light' | 'dark'

export function useTheme() {
  const theme = useState<Theme>('qflow-theme', () => 'light')

  const apply = (next: Theme) => {
    if (!import.meta.client) return
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem('qflow-theme', next)
    } catch {
      // Storage unavailable — theme simply won't persist.
    }
  }

  const init = () => {
    if (!import.meta.client) return
    // The app is light-only — always force the white theme.
    theme.value = 'light'
    apply('light')
  }

  const toggle = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
  }

  const setTheme = (next: Theme) => {
    theme.value = next
    apply(next)
  }

  return { theme, init, toggle, setTheme }
}
