import * as THREE from 'three'

/**
 * Projected labels without React roots inside the canvas.
 * DOM elements (rendered normally, outside the canvas) carry `data-label="<id>"`; the canvas
 * projects the registered 3D anchor for each id every frame and writes the transform directly.
 */
export const LABEL_ANCHORS = new Map<string, THREE.Vector3>()
export const setAnchor = (id: string, v: THREE.Vector3 | [number, number, number]) => {
  const cur = LABEL_ANCHORS.get(id)
  const p = Array.isArray(v) ? v : [v.x, v.y, v.z]
  if (cur) cur.set(p[0], p[1], p[2])
  else LABEL_ANCHORS.set(id, new THREE.Vector3(p[0], p[1], p[2]))
}
