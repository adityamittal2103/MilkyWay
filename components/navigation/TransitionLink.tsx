'use client'
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { jump } from '@/lib/jump'

type Props = ComponentProps<typeof Link> & { label?: string; cursor?: string }

/** A Next link whose navigation is a jump through space. Modifier-clicks behave normally. */
export function TransitionLink({ href, label, cursor, onClick, children, ...rest }: Props) {
  const h = typeof href === 'string' ? href : href.pathname ?? '/'
  return (
    <Link
      href={href}
      data-cursor={cursor}
      data-cursor-label={cursor === 'enter' ? label : undefined}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (jump(h, label ?? (typeof children === 'string' ? children : ''))) e.preventDefault()
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}
