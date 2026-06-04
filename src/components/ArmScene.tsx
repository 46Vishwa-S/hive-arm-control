import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface ArmState {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  camera: number;
  temperature: number;
}

interface Props {
  state: ArmState;
}

export function ArmScene({ state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(70, 55, 80);
    camera.lookAt(0, 20, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xfff0c8, 1.3);
    key.position.set(100, 200, 100);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6cd8ff, 0.5);
    rim.position.set(-100, 100, -100);
    scene.add(rim);
    const honey = new THREE.PointLight(0xffb84d, 1.2, 200);
    honey.position.set(0, 30, 0);
    scene.add(honey);

    // Grid
    const grid = new THREE.GridHelper(160, 40, 0xffb84d, 0x2a2d3a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);

    // Joint hierarchy
    const jBase = new THREE.Group();
    const jShoulder = new THREE.Group();
    const jElbow = new THREE.Group();
    const jWrist = new THREE.Group();
    const jCamera = new THREE.Group();
    scene.add(jBase);
    jBase.add(jShoulder);
    jShoulder.add(jElbow);
    jElbow.add(jWrist);
    jWrist.add(jCamera);

    const mats: THREE.MeshStandardMaterial[] = [];
    const makeMat = (color = 0x3a3d40) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.85,
        roughness: 0.22,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });
      mats.push(m);
      return m;
    };
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xffb84d, metalness: 0.6, roughness: 0.3,
      emissive: new THREE.Color(0xffb84d), emissiveIntensity: 0.35,
    });

    // P1 Ground base — disc
    const base = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 4, 32), makeMat(0x2a2d35));
    base.position.y = 2;
    scene.add(base);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(13, 0.4, 16, 64), accentMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 4.2;
    scene.add(baseRing);

    // P2 Base swivel
    jBase.position.set(0, 4, 0);
    const swivel = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 24), makeMat());
    swivel.position.y = 3;
    jBase.add(swivel);
    const swivelTop = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 10), makeMat());
    swivelTop.position.y = 8;
    jBase.add(swivelTop);

    // P3 Shoulder/main arm
    jShoulder.position.set(0, 10, 0);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 6), makeMat());
    arm1.position.y = 11;
    jShoulder.add(arm1);
    const shoulderPivot = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 8, 24), accentMat);
    shoulderPivot.rotation.z = Math.PI / 2;
    jShoulder.add(shoulderPivot);

    // P4 Elbow/forearm
    jElbow.position.set(0, 22, 0);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 5), makeMat());
    arm2.position.y = 9;
    jElbow.add(arm2);
    const elbowPivot = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 6.5, 24), accentMat);
    elbowPivot.rotation.z = Math.PI / 2;
    jElbow.add(elbowPivot);

    // Wrist
    jWrist.position.set(0, 18, 0);
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), makeMat());
    jWrist.add(wrist);

    // P5 Camera assembly
    jCamera.position.set(0, 3, 0);
    const camHousing = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 4), makeMat(0x1a1d22));
    jCamera.add(camHousing);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 24), new THREE.MeshStandardMaterial({
      color: 0x000000, metalness: 1, roughness: 0.1, emissive: 0x6cd8ff, emissiveIntensity: 0.6,
    }));
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 3.5;
    jCamera.add(lens);

    // Target quats
    const tBase = new THREE.Quaternion();
    const tShoulder = new THREE.Quaternion();
    const tElbow = new THREE.Quaternion();
    const tWrist = new THREE.Quaternion();
    const tCamera = new THREE.Quaternion();
    const RAD = Math.PI / 180;

    let frameId = 0;
    let orbit = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const s = stateRef.current;
      tBase.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.base * RAD);
      tShoulder.setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.shoulder * RAD);
      tElbow.setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.elbow * RAD);
      tWrist.setFromAxisAngle(new THREE.Vector3(1, 0, 0), s.wrist * RAD);
      tCamera.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.camera * RAD);

      jBase.quaternion.slerp(tBase, 0.12);
      jShoulder.quaternion.slerp(tShoulder, 0.12);
      jElbow.quaternion.slerp(tElbow, 0.12);
      jWrist.quaternion.slerp(tWrist, 0.12);
      jCamera.quaternion.slerp(tCamera, 0.12);

      const factor = Math.min(Math.max((s.temperature - 25) / 75, 0), 1);
      const glow = new THREE.Color(0x000000).lerp(new THREE.Color(0xff3300), factor);
      mats.forEach((m) => {
        m.emissive.copy(glow);
        m.emissiveIntensity = factor * 1.4;
      });

      orbit += 0.0015;
      camera.position.x = Math.cos(orbit) * 95;
      camera.position.z = Math.sin(orbit) * 95;
      camera.position.y = 55;
      camera.lookAt(0, 22, 0);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
