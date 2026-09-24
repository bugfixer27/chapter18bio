import * as THREE from 'three'
import { HASH } from './glsl'
import { U } from './uniforms'

/* Everything is drawn in linear light into one half-float buffer (the worlds,
   the swarm, the glossy molecules), then graded here. The worlds are bright
   paper and water, so the curve is identity up to 0.8 and only rolls off
   the highlights: paper stays paper, speculars and sunlight bloom. */

const VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export class FullScreen {
  scene = new THREE.Scene()
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  constructor(public mat: THREE.ShaderMaterial) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    q.frustumCulled = false
    this.scene.add(q)
  }
  render(r: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget | null) {
    r.setRenderTarget(out)
    r.render(this.scene, this.cam)
  }
}

export const sm = (frag: string, uniforms: Record<string, { value: any }>, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms,
    vertexShader: VERT,
    fragmentShader: `precision highp float;\nlayout(location=0) out vec4 o;\nin vec2 vUv;\n${frag}`,
    ...extra,
  })

export const rt = (w = 2, h = 2, depth = false, samples = 0) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: depth,
    samples,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })

/* Dual-filter (Kawase) bloom: soft-knee bright pass, halvings down and back up. */
export class Bloom {
  levels: THREE.WebGLRenderTarget[] = []
  up: THREE.WebGLRenderTarget[] = []
  bright: FullScreen
  down: FullScreen
  upP: FullScreen
  constructor(n = 6) {
    for (let i = 0; i < n; i++) {
      this.levels.push(rt())
      this.up.push(rt())
    }
    this.bright = new FullScreen(
      sm(
        /* glsl */ `
        uniform sampler2D uMap; uniform float uThresh;
        void main(){
          vec3 c = texture(uMap, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          float k = uThresh * 0.5;
          float soft = clamp(l - uThresh + k, 0.0, 2.0*k); soft = soft*soft/(4.0*k + 1e-4);
          float w = max(soft, l - uThresh) / max(l, 1e-4);
          o = vec4(min(c * w, vec3(40.0)), 1.0);
        }`,
        { uMap: { value: null }, uThresh: { value: 1.0 } },
      ),
    )
    this.down = new FullScreen(
      sm(
        /* glsl */ `
        uniform sampler2D uMap; uniform vec2 uTexel;
        void main(){
          vec2 h = uTexel * 0.5;
          vec3 s = texture(uMap, vUv).rgb * 4.0;
          s += texture(uMap, vUv - h).rgb; s += texture(uMap, vUv + h).rgb;
          s += texture(uMap, vUv + vec2(h.x, -h.y)).rgb; s += texture(uMap, vUv - vec2(h.x, -h.y)).rgb;
          o = vec4(s / 8.0, 1.0);
        }`,
        { uMap: { value: null }, uTexel: { value: new THREE.Vector2() } },
      ),
    )
    this.upP = new FullScreen(
      sm(
        /* glsl */ `
        uniform sampler2D uMap, uBase; uniform vec2 uTexel;
        void main(){
          vec2 h = uTexel * 0.5;
          vec3 s = texture(uMap, vUv + vec2(-h.x*2.0, 0.0)).rgb;
          s += texture(uMap, vUv + vec2(-h.x, h.y)).rgb * 2.0;
          s += texture(uMap, vUv + vec2(0.0, h.y*2.0)).rgb;
          s += texture(uMap, vUv + vec2(h.x, h.y)).rgb * 2.0;
          s += texture(uMap, vUv + vec2(h.x*2.0, 0.0)).rgb;
          s += texture(uMap, vUv + vec2(h.x, -h.y)).rgb * 2.0;
          s += texture(uMap, vUv + vec2(0.0, -h.y*2.0)).rgb;
          s += texture(uMap, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
          o = vec4(s / 12.0 * 0.72 + texture(uBase, vUv).rgb, 1.0);
        }`,
        { uMap: { value: null }, uBase: { value: null }, uTexel: { value: new THREE.Vector2() } },
      ),
    )
  }
  setSize(w: number, h: number) {
    let W = Math.max(2, w >> 1)
    let H = Math.max(2, h >> 1)
    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i].setSize(W, H)
      this.up[i].setSize(W, H)
      W = Math.max(2, W >> 1)
      H = Math.max(2, H >> 1)
    }
  }
  render(r: THREE.WebGLRenderer, src: THREE.Texture, thresh: number) {
    const b = this.bright.mat.uniforms
    b.uMap.value = src
    b.uThresh.value = thresh
    this.bright.render(r, this.levels[0])
    const d = this.down.mat.uniforms
    for (let i = 1; i < this.levels.length; i++) {
      d.uMap.value = this.levels[i - 1].texture
      d.uTexel.value.set(1 / this.levels[i - 1].width, 1 / this.levels[i - 1].height)
      this.down.render(r, this.levels[i])
    }
    const u = this.upP.mat.uniforms
    let cur = this.levels[this.levels.length - 1]
    for (let i = this.levels.length - 2; i >= 0; i--) {
      u.uMap.value = cur.texture
      u.uBase.value = this.levels[i].texture
      u.uTexel.value.set(1 / cur.width, 1 / cur.height)
      this.upP.render(r, this.up[i])
      cur = this.up[i]
    }
    return cur.texture
  }
}

export function finalPass() {
  return new FullScreen(
    sm(
      /* glsl */ `
      ${HASH}
      uniform sampler2D uMap, uBloom;
      uniform float uBloomAmt, uTime, uVignette, uGrain, uScrollVel, uCA, uSpotAmt, uFlash, uShafts;
      uniform vec2 uSun;
      uniform vec2 uRes;
      uniform vec3 uSpot;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      vec3 shoulder(vec3 x){
        // identity below 0.8, then a soft roll-off to 1
        vec3 k = max(x - 0.8, 0.0);
        return min(x, 0.8) + 0.2 * (1.0 - exp(-k / 0.2));
      }
      void main(){
        vec2 uv = vUv;
        vec2 c = uv - 0.5;
        float ca = (uCA + abs(uScrollVel) * 0.003) * dot(c, c);
        vec3 col;
        col.r = texture(uMap, uv - c * ca).r;
        col.g = texture(uMap, uv).g;
        col.b = texture(uMap, uv + c * ca).b;
        // spotlight: outside the subject the frame softens and dims
        float out_ = 0.0;
        if (uSpotAmt > 0.002) {
          vec2 asp = vec2(uRes.x / uRes.y, 1.0);
          float d = length((uv - uSpot.xy) * asp);
          out_ = smoothstep(uSpot.z, uSpot.z * 1.7 + 0.05, d) * uSpotAmt;
          if (out_ > 0.01) {
            vec3 b = col;
            float rpx = 5.0 * out_;
            for (int i = 0; i < 8; i++) {
              float a = float(i) * 0.785398 + 0.3;
              b += texture(uMap, uv + vec2(cos(a), sin(a)) * rpx / uRes).rgb;
            }
            col = mix(col, b / 9.0, out_);
          }
        }
        col += texture(uBloom, uv).rgb * uBloomAmt;
        // light shafts: march toward the sun, gathering what is bright; whatever
        // stands between (the shark, the helix) casts its shadow into the water
        if (uShafts > 0.001) {
          vec2 to = uSun - uv;
          vec2 dir = normalize(to) * min(length(to), 0.55) / 28.0;
          vec2 p = uv + dir * hash12(uv * uRes + uTime);
          vec3 acc = vec3(0.0);
          float w = 1.0;
          for (int i = 0; i < 28; i++) {
            vec3 s = texture(uMap, p).rgb;
            acc += max(s - 0.7, 0.0) * w * smoothstep(0.7, 0.95, p.y);
            w *= 0.955;
            p += dir;
          }
          col += acc / 28.0 * uShafts * vec3(0.75, 1.0, 1.05);
        }
        col = mix(col, col * 0.72 + 0.1, out_ * 0.55);
        col += uFlash;
        col = shoulder(col);
        float v = smoothstep(1.05, 0.3, length(c * vec2(1.0, 0.85)));
        col *= mix(1.0, v, uVignette);
        vec3 srgb = toSRGB(clamp(col, 0.0, 1.0));
        float g = hash12(uv * uRes + fract(uTime * 7.3) * 311.0) - 0.5;
        srgb += g * uGrain;
        o = vec4(srgb, 1.0);
      }`,
      {
        uMap: { value: null },
        uBloom: { value: null },
        uBloomAmt: { value: 0.6 },
        uTime: U.uTime,
        uRes: U.uRes,
        uVignette: { value: 0.3 },
        uGrain: { value: 0.025 },
        uScrollVel: U.uScrollVel,
        uCA: { value: 0.02 },
        uSpotAmt: { value: 0 },
        uSpot: { value: new THREE.Vector3(0.5, 0.5, 0.3) },
        uFlash: { value: 0 },
        uShafts: { value: 0 },
        uSun: { value: new THREE.Vector2(0.5, 1.4) },
      },
    ),
  )
}
