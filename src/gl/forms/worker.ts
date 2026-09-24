/* Builds every form off the main thread and streams them back one by one
   (buffers transferred, not copied). The page opens as soon as the first
   chapter's forms have arrived; the rest land while you read. */
import { GENS } from './index'
import { NETWORK } from './charts'

self.onmessage = () => {
  for (const g of GENS) {
    const fbs = g.make()
    const meta: Record<string, unknown> = {}
    if (g.names.includes('network')) meta.network = NETWORK.modules
    const out = fbs.map((fb) => ({ pos: fb.pos, col: fb.col, nrm: fb.nrm }))
    const transfer = out.flatMap((o) => [o.pos.buffer, o.col.buffer, o.nrm.buffer])
    ;(self as unknown as Worker).postMessage({ names: g.names, anims: g.anims, out, meta }, transfer)
  }
  ;(self as unknown as Worker).postMessage({ done: true })
}
