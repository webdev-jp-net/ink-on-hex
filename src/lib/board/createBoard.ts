// three.js の描画。タイル（六角柱）を InstancedMesh でまとめて描き、傾いた盤面の奥行きぼかしとすりガラスを後処理でかける
import * as THREE from 'three'

import { rgbToken } from '@/utils/colorToken'
import {
  SWEEP_FACE,
  SWEEP_MAX,
  SWEEP_RIM,
  SWEEP_TAIL_OFFSET,
  SWEEP_TAIL_WEIGHT,
  SWEEP_TAIL_WIDTH,
  SWEEP_WIDTH,
} from './sweep'
export const PERSPECTIVE = 2.2
const GLASS_FROST = 0.55
export const GLASS_ALPHA = 0.6
const FROST_PX = 10
const BLUR_RANGE = 0.05
export interface Fall {
  phase: number
  axisX: number
  axisY: number
  angle: number
  angularVelocity: number
  isFree: boolean
  position: [number, number, number]
  velocity: [number, number, number]
  age: number
  alpha: number
  speed: number
  gravityDirection: [number, number, number]
  color: number[] | null
  // 次の場面にも要るタイルとして、元の場所へ戻している途中。
  // position・angle は戻し始めたときの姿勢で、progress（0〜1）の分だけ元の場所へ近づける。
  // 戻し直したときは fromProgress から続け、見え方（alpha・color・radiusScale・stroke・glint）は
  // 戻し始めた・戻し直したときの値から盤面のタイルの見え方へ移す。
  // zoom は切り替え中に戻し始めたときの寄り引きの進み、startedAt は切り替えていないときに戻し始めた時刻。
  // drawn は今描いている見え方（戻し直す・また落とすときに、そこから続ける）
  returning?: {
    position: [number, number, number]
    angle: number
    fromProgress: number
    alpha: number
    color: number[]
    radiusScale: number
    stroke: number
    glint: number
    zoom: number
    startedAt: number | null
    progress: number
    drawn: { alpha: number; color: number[]; radiusScale: number; stroke: number; glint: number }
  } | null
  // 戻している途中からまた落としたタイルの、盤面のタイルの見え方の残り。weight（from から0へ減る）の分だけ残す
  settle?: {
    from: number
    weight: number
    radiusScale: number
    stroke: number
    glint: number
  } | null
}

// 1枚のタイル。画面座標・半径・色・不透明度・枠線・落下・光・浮き
export interface Tile {
  x: number
  y: number
  radius: number
  red: number
  green: number
  blue: number
  alpha: number
  stroke: number
  fall: Fall | null
  glint: number
  lift: number
}

export interface Camera {
  scale: number
  tileRatio: number
  offsetX: number
  offsetY: number
  tilt?: number
  yaw?: number
}

export interface Board {
  resize(): void
  render(
    tileList: Tile[],
    camera: Camera,
    clipTop: number,
    clipBottom: number,
    thickness: number,
    blur: number,
    sweep: number | null
  ): void
  boundList(camera: Camera): [number, number, number, number]
  toScreen(planeX: number, planeY: number): [number, number]
  viewDirection(planeX: number, planeY: number, camera: Camera): [number, number, number]
  dispose(): void
  readonly depth: number
  readonly width: number
  readonly height: number
}

// シェーダー。接頭辞は GLSL の慣習で、i は頂点ごとの属性、v は頂点から画素へ渡す値、u は外から渡す値
const VERTEX = `
  attribute vec3 iColor;
  attribute float iAlpha;
  attribute float iStroke;
  attribute float iFall;
  attribute float iGlint;
  varying vec2 vLocal;
  varying vec2 vPlane;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStroke;
  varying float vTop;
  varying float vShade;
  varying float vNormalZ;
  varying float vFall;
  varying float vGlint;
  varying float vRadius;
  varying float vThickness;
  void main() {
    vLocal = position.xy;
    vColor = iColor;
    vAlpha = iAlpha;
    vStroke = iStroke;
    vTop = normal.z;
    vec3 viewNormal = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
    vShade = mix(0.86, 1.0, 0.5 + 0.5 * viewNormal.z);
    vNormalZ = viewNormal.z;
    vFall = iFall;
    vGlint = iGlint;
    vPlane = (instanceMatrix * vec4(position, 1.0)).xy;
    vRadius = length(instanceMatrix[0].xyz);
    vThickness = length(instanceMatrix[2].xyz);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`

const FRAGMENT = `
  uniform vec3 uLine;
  uniform float uPass;
  uniform sampler2D uBehind;
  uniform vec3 uBackground;
  uniform vec2 uBehindResolution;
  uniform float uSweep;
  uniform vec2 uSize;
  varying vec2 vLocal;
  varying vec2 vPlane;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStroke;
  varying float vTop;
  varying float vShade;
  varying float vNormalZ;
  varying float vFall;
  varying float vGlint;
  varying float vRadius;
  varying float vThickness;
  // ヘックスの中心からの距離（辺で1）
  float hexDistance(vec2 local) {
    vec2 folded = abs(local);
    return max(folded.x + folded.y * 0.57735027, folded.y * 1.15470054);
  }
  void main() {
    vec3 color;
    float alpha;
    if (vTop < -0.5 && vThickness < 0.5) discard;
    if (uPass < 0.5 && vFall < 0.5) discard;
    if (uPass > 0.5 && uPass < 1.5 && vFall > 0.5) discard;
    color = vColor * vShade;
    float fresnel = pow(1.0 - clamp(abs(vNormalZ), 0.0, 1.0), 2.0);
    vec3 light = vec3(1.0);
    if (vFall < 0.5) {
      vec4 behind = texture2D(uBehind, gl_FragCoord.xy / uBehindResolution);
      light = mix(behind.rgb + uBackground * (1.0 - behind.a), vec3(1.0), mix(GLASS_FROST, 1.0, vFall * 2.0));
    }
    color = min(light * vColor + fresnel * 0.25, vec3(1.0));
    if (vGlint > 0.001 && vFall < 0.5) {
      float offset = (vPlane.x + vPlane.y + (uSize.x + uSize.y) * 0.5) / (uSize.x + uSize.y) - uSweep;
      float band = exp(-offset * offset / (2.0 * SWEEP_MAIN * SWEEP_MAIN))
        + SWEEP_TAIL_WEIGHT * exp(-(offset + SWEEP_TAIL_OFFSET) * (offset + SWEEP_TAIL_OFFSET) / (2.0 * SWEEP_TAIL * SWEEP_TAIL));
      if (vTop > 0.5) {
        float edgePx = (1.0 - hexDistance(vLocal)) * vRadius * 0.8660254;
        float face = clamp(dot(normalize(vLocal + vec2(1e-5)), vec2(-0.70710678)), 0.0, 1.0);
        color = mix(color, vec3(1.0), clamp(vGlint * band * (SWEEP_FACE + fresnel * 0.6 + exp(-edgePx / 1.2) * face * SWEEP_RIM), 0.0, SWEEP_MAX));
      } else color = mix(color, vec3(1.0), clamp(vGlint * band * 0.5, 0.0, SWEEP_MAX));
    }
    if (vTop < 0.5) alpha = vAlpha * (1.0 - min(vStroke, 1.0));
    else {
      float edgePx = (1.0 - hexDistance(vLocal)) * vRadius * 0.8660254;
      float ring = clamp(2.0 - edgePx + 0.5, 0.0, 1.0);
      float stroke = min(vStroke, 1.0);
      color = mix(color, uLine, stroke);
      alpha = mix(1.0, ring, stroke) * vAlpha;
    }
    if (vFall > 0.5) alpha *= GLASS_ALPHA;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
  }`
  .replace('GLASS_FROST', GLASS_FROST.toFixed(3))
  .replace('GLASS_ALPHA', GLASS_ALPHA.toFixed(3))
  .replace(/SWEEP_MAIN/g, SWEEP_WIDTH.toFixed(3))
  .replace(/SWEEP_TAIL_OFFSET/g, SWEEP_TAIL_OFFSET.toFixed(3))
  .replace(/SWEEP_TAIL_WEIGHT/g, SWEEP_TAIL_WEIGHT.toFixed(3))
  .replace(/SWEEP_TAIL/g, SWEEP_TAIL_WIDTH.toFixed(3))
  .replace(/SWEEP_FACE/g, SWEEP_FACE.toFixed(3))
  .replace(/SWEEP_RIM/g, SWEEP_RIM.toFixed(3))
  .replace(/SWEEP_MAX/g, SWEEP_MAX.toFixed(3))

const QUAD_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`

// 円盤状に48点を取って平均する（黄金角で並べる）
const DISC_SAMPLE = `
  vec4 discAverage(sampler2D source, vec2 center, float radius, vec2 resolution) {
    vec4 sum = vec4(0.0);
    for (int i = 0; i < 48; i++) {
      float order = float(i) + 0.5;
      float sampleRadius = sqrt(order / 48.0) * radius;
      float angle = order * 2.39996;
      sum += texture2D(source, center + vec2(cos(angle), sin(angle)) * sampleRadius / resolution);
    }
    return sum / 48.0;
  }`

// 盤面の平面からの距離に応じてぼかす
const DEPTH_BLUR = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uBlur;
  uniform float uTangent;
  uniform float uAspect;
  uniform vec3 uNormal;
  uniform float uNormalDotPoint;
  uniform float uDistance;
  varying vec2 vUv;
  ${DISC_SAMPLE}
  void main() {
    vec2 normalizedPoint = vUv * 2.0 - 1.0;
    vec3 ray = vec3(normalizedPoint.x * uTangent * uAspect, normalizedPoint.y * uTangent, -1.0);
    float hitDistance = uNormalDotPoint / dot(uNormal, ray);
    float radius = uBlur * clamp(abs(hitDistance - uDistance) / uDistance / BLUR_RANGE, 0.0, 1.0);
    if (radius < 0.3) {
      gl_FragColor = texture2D(uTexture, vUv);
      return;
    }
    gl_FragColor = discAverage(uTexture, vUv, radius, uResolution);
  }`.replace('BLUR_RANGE', BLUR_RANGE.toFixed(4))

const FROST_BLUR = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uRadius;
  varying vec2 vUv;
  ${DISC_SAMPLE}
  void main() {
    gl_FragColor = discAverage(uTexture, vUv, uRadius, uResolution);
  }`

const linearTarget = () =>
  new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })

export function createBoard(canvas: HTMLCanvasElement): Board {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false
  const scene = new THREE.Scene()
  const perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 1, 10000)
  const tiltGroup = new THREE.Group()
  const flipGroup = new THREE.Group()
  flipGroup.scale.y = -1
  scene.add(tiltGroup)
  tiltGroup.add(flipGroup)
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false, Math.PI / 6)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, 0, 0.5)
  const toVector3 = (list: number[]) =>
    new THREE.Vector3(list[0] / 255, list[1] / 255, list[2] / 255)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLine: { value: toVector3(rgbToken('--border-basic')) },
      uPass: { value: 2 },
      uBehind: { value: null },
      uBackground: { value: toVector3(rgbToken('--bg-basic')) },
      uBehindResolution: { value: new THREE.Vector2(1, 1) },
      uSweep: { value: -9 },
      uSize: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
  })
  let mesh: THREE.InstancedMesh | null = null
  let capacity = 0
  let width = 0
  let height = 0
  const attributeList = {} as Record<
    'color' | 'alpha' | 'stroke' | 'fall' | 'glint',
    THREE.InstancedBufferAttribute
  >
  const renderTarget = linearTarget()
  const postScene = new THREE.Scene()
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: renderTarget.texture },
      uResolution: { value: new THREE.Vector2() },
      uBlur: { value: 0 },
      uTangent: { value: 1 },
      uAspect: { value: 1 },
      uNormal: { value: new THREE.Vector3() },
      uNormalDotPoint: { value: 0 },
      uDistance: { value: 1 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: DEPTH_BLUR,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial)
  quad.frustumCulled = false
  postScene.add(quad)
  const behindTarget = linearTarget()
  const frostTarget = linearTarget()
  const frostMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: behindTarget.texture },
      uResolution: { value: new THREE.Vector2() },
      uRadius: { value: 1 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: FROST_BLUR,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  })
  const planeNormal = new THREE.Vector3()
  const planePoint = new THREE.Vector3()
  const fallMatrix = new THREE.Matrix4()
  const scaleMatrix = new THREE.Matrix4()
  const fallAxis = new THREE.Vector3()

  function ensure(count: number) {
    if (count <= capacity) return
    capacity = Math.max(1024, count * 2)
    if (mesh) {
      flipGroup.remove(mesh)
      mesh.dispose()
    }
    attributeList.color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    attributeList.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
    attributeList.stroke = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
    attributeList.fall = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
    attributeList.glint = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
    for (const one of Object.values(attributeList)) one.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('iColor', attributeList.color)
    geometry.setAttribute('iAlpha', attributeList.alpha)
    geometry.setAttribute('iStroke', attributeList.stroke)
    geometry.setAttribute('iFall', attributeList.fall)
    geometry.setAttribute('iGlint', attributeList.glint)
    mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    flipGroup.add(mesh)
  }

  function resize() {
    width = innerWidth
    height = innerHeight
    const pixelRatio = Math.min(devicePixelRatio || 1, 2)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    for (const target of [renderTarget, behindTarget, frostTarget])
      target.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio))
    const distance = height * PERSPECTIVE
    perspectiveCamera.fov = (2 * Math.atan(height / 2 / distance) * 180) / Math.PI
    perspectiveCamera.aspect = width / height
    perspectiveCamera.near = distance * 0.05
    perspectiveCamera.far = distance * 80
    perspectiveCamera.position.set(0, 0, distance)
    perspectiveCamera.updateProjectionMatrix()
  }

  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane()
  const hit = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const origin = new THREE.Vector3()
  const normalizedPoint = new THREE.Vector2()
  function aim(camera: Camera) {
    tiltGroup.rotation.set(-(camera.tilt || 0), camera.yaw || 0, 0)
    scene.updateMatrixWorld(true)
  }

  // 傾いた盤面で画面に映る範囲（盤面上の座標）
  function boundList(camera: Camera): [number, number, number, number] {
    if (!camera.tilt && !camera.yaw) return [0, width, 0, height]
    aim(camera)
    normal.set(0, 0, 1).transformDirection(flipGroup.matrixWorld)
    origin.setFromMatrixPosition(flipGroup.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(normal, origin)
    const reach = 4 * Math.max(width, height)
    const xList: number[] = []
    const yList: number[] = []
    for (const [cornerX, cornerY] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ]) {
      normalizedPoint.set(cornerX, cornerY)
      ray.setFromCamera(normalizedPoint, perspectiveCamera)
      let hitPoint = ray.ray.intersectPlane(plane, hit)
      if (!hitPoint || hitPoint.distanceTo(perspectiveCamera.position) > reach * 3)
        hitPoint = ray.ray.at(reach * 3, hit)
      const local = flipGroup.worldToLocal(hitPoint.clone())
      xList.push(Math.max(-reach, Math.min(reach, local.x)) + width / 2)
      yList.push(Math.max(-reach, Math.min(reach, local.y)) + height / 2)
    }
    const margin = Math.max(width, height) * 0.15
    return [
      Math.min(...xList) - margin,
      Math.max(...xList) + margin,
      Math.min(...yList) - margin,
      Math.max(...yList) + margin,
    ]
  }

  const scratch = new THREE.Vector3()
  function viewDirection(planeX: number, planeY: number, camera: Camera): [number, number, number] {
    aim(camera)
    const cameraLocal = flipGroup.worldToLocal(perspectiveCamera.position.clone())
    const direction = new THREE.Vector3(
      planeX - width / 2 - cameraLocal.x,
      planeY - height / 2 - cameraLocal.y,
      -cameraLocal.z
    ).normalize()
    return [direction.x, direction.y, direction.z]
  }
  function toScreen(planeX: number, planeY: number): [number, number] {
    flipGroup.localToWorld(scratch.set(planeX - width / 2, planeY - height / 2, 0))
    scratch.project(perspectiveCamera)
    return [((scratch.x + 1) / 2) * width, ((1 - scratch.y) / 2) * height]
  }

  function render(
    tileList: Tile[],
    camera: Camera,
    clipTop: number,
    clipBottom: number,
    thickness: number,
    blur: number,
    sweep: number | null
  ) {
    const count = tileList.length
    const clipTopPx = Math.max(0, Math.min(height, clipTop || 0))
    const clipBottomPx = Math.max(clipTopPx, Math.min(height, clipBottom))
    renderer.setScissorTest(false)
    renderer.clear()
    if (!count) return
    ensure(count)
    const target = mesh!
    const matrixList = target.instanceMatrix.array as Float32Array
    const z = Math.max(thickness, 1e-3)
    for (let i = 0; i < count; i++) {
      const tile = tileList[i]
      const offset = i * 16
      if (tile.fall) {
        const fall = tile.fall
        fallMatrix.makeRotationAxis(fallAxis.set(fall.axisX, fall.axisY, 0), -fall.angle)
        fallMatrix.multiply(scaleMatrix.makeScale(tile.radius, tile.radius, z))
        fallMatrix.setPosition(
          tile.x - width / 2 + fall.position[0] * tile.radius,
          tile.y - height / 2 + fall.position[1] * tile.radius,
          fall.position[2] * tile.radius
        )
        fallMatrix.toArray(matrixList, offset)
      } else {
        matrixList.fill(0, offset, offset + 16)
        matrixList[offset] = tile.radius
        matrixList[offset + 5] = tile.radius
        matrixList[offset + 10] = z
        matrixList[offset + 12] = tile.x - width / 2
        matrixList[offset + 13] = tile.y - height / 2
        matrixList[offset + 14] = tile.lift
        matrixList[offset + 15] = 1
      }
      attributeList.color.array[i * 3] = tile.red
      attributeList.color.array[i * 3 + 1] = tile.green
      attributeList.color.array[i * 3 + 2] = tile.blue
      attributeList.alpha.array[i] = tile.alpha
      attributeList.stroke.array[i] = tile.stroke
      // 元の場所へ戻している途中のタイルは、落ちる姿勢のまま盤面のタイルとして描く
      // 落ちているタイルは1。戻している途中は、進みに合わせて落ちているときの見え方（すりガラスを通さない光）から
      // 盤面のタイルの見え方へ移すため、0.5未満の値で渡す（0.5を境に描く回を分けているため）
      const fallWeight = !tile.fall
        ? 0
        : tile.fall.returning
          ? 0.499 * (1 - tile.fall.returning.progress)
          : tile.fall.settle
            ? 0.499 * (1 - tile.fall.settle.weight)
            : 1
      attributeList.fall.array[i] = fallWeight
      attributeList.glint.array[i] = fallWeight > 0.5 ? 0 : tile.glint
    }
    target.count = count
    target.instanceMatrix.needsUpdate = true
    for (const one of Object.values(attributeList)) one.needsUpdate = true
    aim(camera)
    const uniformList = material.uniforms
    uniformList.uPass.value = 2
    uniformList.uBehindResolution.value.set(renderTarget.width, renderTarget.height)
    uniformList.uSweep.value = sweep == null ? -9 : sweep
    uniformList.uSize.value.set(width, height)
    const scissor = () => {
      renderer.setScissorTest(true)
      renderer.setScissor(0, height - clipBottomPx, width, clipBottomPx - clipTopPx)
    }
    // すりガラス：落ちていくタイルを先に描いてぼかし、盤面のタイルの奥に透かす
    const draw = (output: THREE.WebGLRenderTarget | null) => {
      uniformList.uPass.value = 0
      renderer.setRenderTarget(behindTarget)
      renderer.setScissorTest(false)
      renderer.clear()
      renderer.render(scene, perspectiveCamera)
      quad.material = frostMaterial
      frostMaterial.uniforms.uRadius.value = FROST_PX * renderer.getPixelRatio()
      frostMaterial.uniforms.uResolution.value.set(behindTarget.width, behindTarget.height)
      renderer.setRenderTarget(frostTarget)
      renderer.clear()
      renderer.render(postScene, postCamera)
      quad.material = blurMaterial
      renderer.setRenderTarget(output)
      if (output) renderer.clear()
      else scissor()
      uniformList.uPass.value = 0
      renderer.render(scene, perspectiveCamera)
      uniformList.uPass.value = 1
      uniformList.uBehind.value = frostTarget.texture
      renderer.render(scene, perspectiveCamera)
      uniformList.uPass.value = 2
    }
    if (blur > 0.05) {
      perspectiveCamera.updateMatrixWorld()
      planeNormal
        .set(0, 0, 1)
        .transformDirection(flipGroup.matrixWorld)
        .transformDirection(perspectiveCamera.matrixWorldInverse)
      planePoint
        .setFromMatrixPosition(flipGroup.matrixWorld)
        .applyMatrix4(perspectiveCamera.matrixWorldInverse)
      const blurUniformList = blurMaterial.uniforms
      blurUniformList.uNormal.value.copy(planeNormal)
      blurUniformList.uNormalDotPoint.value = planeNormal.dot(planePoint)
      blurUniformList.uDistance.value = perspectiveCamera.position.z
      blurUniformList.uTangent.value = Math.tan((perspectiveCamera.fov * Math.PI) / 360)
      blurUniformList.uAspect.value = perspectiveCamera.aspect
      blurUniformList.uBlur.value = blur * renderer.getPixelRatio()
      blurUniformList.uResolution.value.set(renderTarget.width, renderTarget.height)
      renderer.setRenderTarget(renderTarget)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()
      draw(renderTarget)
      renderer.setRenderTarget(null)
      scissor()
      renderer.render(postScene, postCamera)
      return
    }
    scissor()
    draw(null)
  }

  resize()
  return {
    resize,
    render,
    boundList,
    toScreen,
    viewDirection,
    dispose() {
      for (const target of [renderTarget, behindTarget, frostTarget]) target.dispose()
      mesh?.dispose()
      geometry.dispose()
      quad.geometry.dispose()
      for (const one of [material, blurMaterial, frostMaterial]) one.dispose()
      renderer.dispose()
    },
    get depth() {
      return perspectiveCamera.position.z * 60
    },
    get width() {
      return width
    },
    get height() {
      return height
    },
  }
}
