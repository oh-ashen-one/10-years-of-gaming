/**
 * post.ts — the interior-ink composite pass.
 *
 * The second half of the two-pass ink system (back-face extrusion handles
 * silhouettes; this handles the interior lines extrusion can't reach):
 *
 *   scene -> MSAA render target (color + depth texture)
 *         -> fullscreen composite: 3×3 Sobel on linear depth AND normals
 *            reconstructed from cross-derivatives of view-space positions
 *         -> ink edges + ink-flavored vignette + ±1/255 output dither
 *
 * Sky pixels (depth at the far plane) are skipped, and edges fade with
 * distance so far scenery doesn't turn to mesh soup. The output dither
 * keeps 8-bit band boundaries clean. Tuned thin and selective so it never
 * doubles up with the outline shells.
 */
import * as THREE from "three";
import { basePalette, col } from "../world/palette";

const compositeVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const compositeFrag = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uRes;
  uniform float uNear;
  uniform float uFar;
  uniform float uTanHalfFov;
  uniform float uAspect;
  uniform vec3 uInk;
  uniform float uEdgeStrength;
  uniform float uVignette;

  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float ndc = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
  }
  vec3 viewPos(vec2 uv) {
    float z = linearDepth(uv);
    vec2 p = uv * 2.0 - 1.0;
    return vec3(p.x * uTanHalfFov * uAspect, p.y * uTanHalfFov, -1.0) * z;
  }

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;
    vec2 px = 1.0 / uRes;

    float dC = linearDepth(vUv);
    bool isSky = dC > uFar * 0.985;

    float edge = 0.0;
    if (!isSky) {
      // 3x3 sobel taps on depth + reconstructed normals
      vec3 P[9];
      float D[9];
      int k = 0;
      float dmax = 0.0; float dmin = 1e9;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * px;
          P[k] = viewPos(uv);
          D[k] = -P[k].z;
          dmax = max(dmax, D[k]); dmin = min(dmin, D[k]);
          k++;
        }
      }
      // depth discontinuity (relative — survives the near/far range)
      float spread = (dmax - dmin) / max(dC, 0.001);
      float depthEdge = smoothstep(0.015, 0.05, spread);

      // normal discontinuity from cross-derivatives of neighbouring taps
      vec3 nC = normalize(cross(P[5] - P[4], P[7] - P[4]));
      vec3 n1 = normalize(cross(P[1] - P[0], P[3] - P[0]));
      vec3 n2 = normalize(cross(P[8] - P[7], P[5] - P[7]));
      float nEdge = 1.0 - max(dot(nC, n1), dot(nC, n2));
      nEdge = smoothstep(0.28, 0.55, nEdge);

      edge = max(depthEdge * 0.9, nEdge * 0.75);
      // fade interior lines with distance
      edge *= smoothstep(uFar * 0.75, uFar * 0.30, dC) * 0.8 + 0.2;
    }

    vec3 outC = mix(color, uInk, clamp(edge * uEdgeStrength, 0.0, 1.0));

    // subtle ink-flavored vignette
    vec2 q = vUv - 0.5;
    outC *= 1.0 - dot(q, q) * uVignette;

    // output dither keeps the big flat bands clean at 8-bit
    float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    outC += (dith - 0.5) * (1.5 / 255.0);

    gl_FragColor = vec4(outC, 1.0);
  }
`;

export interface PostFXOptions {
  ink?: number;
  edgeStrength?: number;
  vignette?: number;
  /** MSAA samples on the scene target (renderer itself stays antialias:false) */
  samples?: number;
}

export class PostFX {
  private rt: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private samples: number;

  constructor(width: number, height: number, camera?: THREE.PerspectiveCamera, opts: PostFXOptions = {}) {
    this.samples = opts.samples ?? 4;
    this.rt = this.makeRT(width, height);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uRes: { value: new THREE.Vector2(width, height) },
        uNear: { value: camera?.near ?? 0.3 },
        uFar: { value: camera?.far ?? 3400 },
        uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad((camera?.fov ?? 70) / 2)) },
        uAspect: { value: width / height },
        uInk: { value: col(opts.ink ?? basePalette.ink.deep).clone() },
        uEdgeStrength: { value: opts.edgeStrength ?? 0.85 },
        uVignette: { value: opts.vignette ?? 0.38 },
      },
      vertexShader: compositeVert,
      fragmentShader: compositeFrag,
      depthWrite: false,
      depthTest: false,
    });

    // fullscreen triangle
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quadScene.add(new THREE.Mesh(geo, this.mat));
  }

  private makeRT(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      samples: this.samples,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });
    const depth = new THREE.DepthTexture(w, h);
    depth.format = THREE.DepthFormat;
    depth.type = THREE.UnsignedIntType;
    rt.depthTexture = depth;
    return rt;
  }

  resize(w: number, h: number, camera: THREE.PerspectiveCamera): void {
    this.rt.dispose();
    this.rt = this.makeRT(w, h);
    this.mat.uniforms.tDiffuse.value = this.rt.texture;
    this.mat.uniforms.tDepth.value = this.rt.depthTexture;
    this.mat.uniforms.uRes.value.set(w, h);
    this.mat.uniforms.uAspect.value = w / h;
    this.mat.uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.mat.uniforms.uNear.value = camera.near;
    this.mat.uniforms.uFar.value = camera.far;
  }

  /** Refresh per-frame camera-dependent uniforms (FOV kick changes tan). */
  syncCamera(camera: THREE.PerspectiveCamera): void {
    this.mat.uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
  }

  dispose(): void {
    this.rt.dispose();
    this.mat.dispose();
  }
}
