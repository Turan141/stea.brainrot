import * as THREE from "three";
import { CONFIG } from "../config.ts";

/**
 * Builds the THREE.Scene with sky, fog and lighting rig. Pure presentation —
 * gameplay objects are added by World/systems.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly sun: THREE.DirectionalLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x9fc4f0, 120, 360);
    this.addSky();

    const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x55617a, 0.9);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d9, 1.5);
    this.sun.position.set(40, 70, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
    const d = 80;
    const cam = this.sun.shadow.camera;
    cam.left = -d;
    cam.right = d;
    cam.top = d;
    cam.bottom = -d;
    cam.near = 1;
    cam.far = 250;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  /** Rich gradient sky dome with a warm horizon band and a soft sun bloom. */
  private addSky() {
    const sunDir = new THREE.Vector3(40, 70, 30).normalize();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          zenith: { value: new THREE.Color(0x2456b8) },
          middle: { value: new THREE.Color(0x6fa6ee) },
          horizon: { value: new THREE.Color(0xeaf3ff) },
          sunColor: { value: new THREE.Color(0xfff3d0) },
          sunDir: { value: sunDir },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 zenith; uniform vec3 middle; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir;
          varying vec3 vP;
          void main(){
            vec3 dir = normalize(vP);
            float h = clamp(dir.y, 0.0, 1.0);
            // two-stage vertical gradient: horizon -> middle -> zenith
            vec3 col = mix(horizon, middle, smoothstep(0.0, 0.35, h));
            col = mix(col, zenith, smoothstep(0.3, 1.0, h));
            // soft sun bloom
            float s = max(dot(dir, normalize(sunDir)), 0.0);
            col += sunColor * (pow(s, 8.0) * 0.5 + pow(s, 200.0) * 0.8);
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    this.scene.add(sky);
  }

  /** Keep the shadow frustum centered on a focus point (the player). */
  focusShadow(x: number, z: number) {
    this.sun.position.set(x + 40, 70, z + 30);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }
}
