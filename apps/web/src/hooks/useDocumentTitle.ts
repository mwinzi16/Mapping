import { useEffect } from 'react'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const baseTitle = 'Catastrophe Mapping'
    document.title = title ? `${title} | ${baseTitle}` : baseTitle
    return () => { document.title = baseTitle }
  }, [title])
}
