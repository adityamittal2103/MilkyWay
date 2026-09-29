'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { LABEL_ANCHORS } from '@/lib/labels'

/**
 * Writes screen positions for every [data-label] element in the DOM overlay.
 * Default priority on purpose: a positive useFrame priority makes R3F stop rendering on its own.
 */
export function LabelProjector() {
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const els = document.querySelectorAll<HTMLElement>('[data-label]')
    for (const el of els) {
      const a = LABEL_ANCHORS.get(el.dataset.label!)
      if (!a) continue
      v.copy(a).project(camera)
      const behind = v.z > 1
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.visibility = behind ? 'hidden' : 'visible'
    }
  })
  return null
}
