'use client'
import { ReactNode } from 'react'

interface OnboardingTooltipProps {
  show: boolean
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

export function OnboardingTooltip({ show, title, description, action, position = 'bottom', children }: OnboardingTooltipProps) {
  if (!show) return <>{children}</>

  return (
    <div className="relative">
      {children}
      <div className={`absolute z-50 mt-2 p-3 rounded-xl text-sm font-medium max-w-xs pointer-events-auto`}
        style={{ background: 'rgb(var(--accent))', color: '#fff' }}>
        <p className="font-bold mb-1">{title}</p>
        <p className="text-xs mb-2 opacity-90">{description}</p>
        {action && (
          <button onClick={action.onClick} className="text-xs font-black underline">
            {action.label} →
          </button>
        )}
      </div>
    </div>
  )
}
