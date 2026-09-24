/* The chart overlay: crisp axes, ticks and labels drawn in SVG over the
   swarm's charts, placed by projecting each chart's layout into the screen
   every frame, so they stay locked to the particles as the camera moves. */
import * as THREE from 'three'
import type { Engine } from '../gl/engine'
import { CHARTS } from './charts'

export function buildOverlay(engine: Engine) {
  const svg = document.querySelector<SVGSVGElement>('[data-overlay]')
  if (!svg) return () => {}
  const v = new THREE.Vector3()
  const proj = (x: number, y: number, z = 0): [number, number] => {
    const [sx, sy] = engine.project(v.set(x, y, z))
    return [sx, sy]
  }
  const charts = CHARTS.map((c) => c.build(svg))
  return () => {
    for (const c of charts) c.update(proj)
  }
}
