import * as THREE from 'three'

/* One shared bag of uniform objects: materials reference these directly, so
   one write per frame reaches every shader that uses them. */
const u = <T>(value: T) => ({ value })

export const U = {
  uTime: u(0),
  uRes: u(new THREE.Vector2(1, 1)),
  uScrollVel: u(0),
  uMouse: u(new THREE.Vector2(0.5, 0.5)),
}
