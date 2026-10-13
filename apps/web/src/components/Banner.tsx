import type { ReactNode } from 'react'

interface BannerProps {
  readonly tone: 'info' | 'error'
  readonly children: ReactNode
  readonly onDismiss?: () => void
}

export const Banner = ({ tone, children, onDismiss }: BannerProps) => (
  <div className={`banner banner--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span>{children}</span>
    {onDismiss && (
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    )}
  </div>
)
