/* Shared GLSL. Everything is procedural — no textures are ever loaded. */

export const HASH = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash32(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
`

export const NOISE = /* glsl */ `
float gnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float n = 0.0;
  for(int dz=0; dz<2; dz++)
  for(int dy=0; dy<2; dy++)
  for(int dx=0; dx<2; dx++){
    vec3 o = vec3(float(dx),float(dy),float(dz));
    vec3 g = normalize(hash33(i+o)*2.0-1.0);
    float w = mix(1.0-u.x,u.x,o.x)*mix(1.0-u.y,u.y,o.y)*mix(1.0-u.z,u.z,o.z);
    n += w * dot(g, f-o);
  }
  return n*1.35;
}
float fbm(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break; s += a*gnoise(p); n += a; p = p*2.03 + 17.1; a *= 0.5; }
  return s/n;
}
float billow(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break; s += a*abs(gnoise(p)); n += a; p = p*2.03 + 17.1; a *= 0.5; }
  return s/n;
}
float worley(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float d = 1.0;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 o = vec3(float(x),float(y),float(z));
    vec3 r = o + hash33(i+o) - f;
    d = min(d, dot(r,r));
  }
  return sqrt(d);
}
`

/* Curl of a vector potential built from three decorrelated noise fields:
   divergence-free, so particles swirl without bunching up. */
export const CURL = /* glsl */ `
vec3 curlNoise(vec3 p){
  const float e = 0.25;
  vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
  vec3 q = p + 31.4, r = p - 57.1;
  float x = (gnoise(r+dy)-gnoise(r-dy)) - (gnoise(q+dz)-gnoise(q-dz));
  float y = (gnoise(p+dz)-gnoise(p-dz)) - (gnoise(r+dx)-gnoise(r-dx));
  float z = (gnoise(q+dx)-gnoise(q-dx)) - (gnoise(p+dy)-gnoise(p-dy));
  return vec3(x,y,z)/(2.0*e);
}
`

export const TONE = /* glsl */ `
vec3 aces(vec3 x){
  const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
}
`


/* The world wipe as a function of the pixel: 0 = the old world, 1 = the new.
   The background shader and every 3-D object that belongs to one world use
   the same field, so a wipe cuts through the sea floor exactly as it cuts
   through the water behind it. Needs uW0, uW1, uWT, uWDir, uWRad, uRes. */
export const WIPE = /* glsl */ `
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
float wipeField(vec2 p){
  float lin = dot(p, normalize(uWDir)) * 0.5 + 0.5;
  float rad = length(p) * 0.75;
  float field = mix(lin, rad, uWRad);
  float rough = uW1 == 3 ? 0.28 : (uW1 == 0 ? 0.22 : 0.12);
  return field + (fbm2(p * 4.0 + 3.1) - 0.5) * rough + (fbm2(p * 22.0) - 0.5) * rough * 0.25;
}
float wipeFront(){ return uWT * 1.5 - 0.25; }
float wipeMix(vec2 p){
  if (uWT <= 0.0 || uW0 == uW1) return 0.0;
  float f = wipeFront();
  return smoothstep(f + 0.02, f - 0.02, wipeField(p));
}
/* how much of world id is showing at this pixel */
float worldHere(int id, vec2 fragCoord){
  vec2 p = (fragCoord / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float m = wipeMix(p);
  float w = 0.0;
  if (uW0 == id) w += 1.0 - m;
  if (uW1 == id && uW1 != uW0) w += m;
  if (uW1 == id && (uWT <= 0.0 || uW0 == uW1)) w = 1.0;
  return clamp(w, 0.0, 1.0);
}
`

/* Sunlight focused by waves: a warped cell pattern, sharp bright filaments. */
export const CAUSTIC = /* glsl */ `
float caustic(vec2 p, float t){
  float c = 0.0;
  vec2 q = p;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 w = q + vec2(sin(q.y * 1.3 + t * 0.8 + fi), cos(q.x * 1.1 - t * 0.6 - fi)) * 0.55;
    vec2 g = fract(w) - 0.5;
    float d = min(abs(g.x), abs(g.y));
    c += pow(1.0 - clamp(d * 2.6, 0.0, 1.0), 6.0) / (1.0 + fi * 0.6);
    q = q * 1.63 + vec2(3.1, 1.7);
  }
  return c;
}
`
