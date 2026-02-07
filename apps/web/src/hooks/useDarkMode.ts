import { useState, useEffect } from 'react'

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored ? stored === 'dark' : true // default dark
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggle = () => setIsDark(prev => !prev)
  return [isDark, toggle]
}
