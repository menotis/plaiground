import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAX_EDGES, POS, NEG, edgeDim, edgeMask, edgeWeights, heatRGB, kernelWindow } from './netLayout.js';

// 레이어 컬럼을 z축으로 펼친 3D 뷰.
// 마우스: 드래그 회전 · 휠 줌 · 우클릭 이동.  키보드: W/S 앞뒤 · A/D 좌우 · Q/E 위아래 (화살표 동일, Shift = 3배속)
const SCALE = 2;      // 2D 레이아웃 좌표 배율 — 노드 사이 여백
const GAP = 340;      // 레이어 사이 z 간격
const SPEED = 6;
const IDLE = [0.14, 0.16, 0.22], IDLE_FLAT = [0.2, 0.22, 0.28], GOLD = [232 / 255, 179 / 255, 75 / 255];

const pt = (c, ci, i) => [c.local[i * 2] * SCALE, -c.local[i * 2 + 1] * SCALE, ci * GAP];
const anchor = (c, ci, a) => [c.anchorLocal[a][0] * SCALE, -c.anchorLocal[a][1] * SCALE, ci * GAP];

const KEYS = { w: [0, 0, 1], s: [0, 0, -1], a: [-1, 0, 0], d: [1, 0, 0], q: [0, -1, 0], e: [0, 1, 0],
  arrowup: [0, 0, 1], arrowdown: [0, 0, -1], arrowleft: [-1, 0, 0], arrowright: [1, 0, 0] };

export default function Network3D({ layout, frame, nodeVals, selected, onSelect, density, sweepT }) {
  const mountRef = useRef(null);
  const st = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const sweepRef = useRef(sweepT);
  sweepRef.current = sweepT;

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !layout) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x050505);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const depth = (layout.cols.length - 1) * GAP;
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 40000);
    camera.position.set(-1400, 700, -1100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, depth / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const points = layout.cols.map((c, ci) => {
      const pos = new Float32Array(c.count * 3), col = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) pos.set(pt(c, ci, i), i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // depthTest 끄고 renderOrder를 올려 선이 아무리 겹쳐도 노드는 항상 위에 보인다
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size: (c.count <= 40 ? 18 : Math.max(3, c.cell * 0.7)) * SCALE, vertexColors: true, depthTest: false }));
      p.renderOrder = 2;
      p.userData.col = ci;
      scene.add(p);
      return p;
    });

    // 레이어 = 텐서 슬랩(반투명 판). 옆·뒤에서 보면 층이 z축으로 쌓인 게 보인다
    layout.cols.forEach((c, ci) => {
      const geo = new THREE.PlaneGeometry((c.extent[0] + 36) * SCALE, (c.extent[1] + 36) * SCALE);
      const slab = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false }));
      slab.position.z = ci * GAP;
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }));
      rim.position.z = ci * GAP;
      scene.add(slab, rim);
      if (c.anchorLocal && !c.ks) c.anchorLocal.forEach((_, a) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3, (c.anchorSpan - 6) * SCALE, 3), new THREE.MeshBasicMaterial({ color: 0x8d897f }));
        bar.position.set(...anchor(c, ci, a));
        scene.add(bar);
      });
    });

    // 커널 창(금색 사각형) + 창 → 첫 conv 필터 노드 선. 창은 이미지 위를 한 칸씩 이동한다
    const input = layout.cols[0];
    const convCol = input.ks ? layout.cols.find((c) => c.layer && c.colIn === 0) : null;
    let sweep = null;
    if (convCol) {
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)),
        new THREE.LineBasicMaterial({ color: 0xe8b34b, depthTest: false }));
      loop.renderOrder = 3;
      const n = convCol.count;
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
      eg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
      const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
      edges.renderOrder = 1;
      const dst = Array.from({ length: n }, (_, o) => pt(convCol, layout.cols.indexOf(convCol), o));
      const ep = eg.getAttribute('position');
      dst.forEach((d, o) => ep.setXYZ(o * 2 + 1, ...d));
      // 평상시: 이미지 오른쪽 변 전체 → 필터 노드 쐐기. 커널이 이미지 전체에 한 번에 적용된다는 뜻
      const gx = (input.extent[0] / 2 + 4) * SCALE, top = (input.extent[1] / 2) * SCALE;
      const wg = new THREE.BufferGeometry();
      const wp = new Float32Array(n * 9);
      dst.forEach((d, o) => wp.set([gx, top, 0, gx, -top, 0, ...d], o * 9));
      wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
      wg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 9), 3));
      const wedges = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      scene.add(loop, edges, wedges);
      sweep = { loop, edges, wedges, prevPix: [] };
    }

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    // 키보드 비행 — 카메라와 궤도 중심을 같이 밀어서 "그 자리에서 둘러보기"가 유지된다
    const pressed = new Set();
    const isTyping = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName);
    const onKeyDown = (e) => { const k = e.key.toLowerCase(); if (KEYS[k] && !isTyping(e)) { pressed.add(k); e.preventDefault(); } if (e.key === 'Shift') pressed.add('shift'); };
    const onKeyUp = (e) => { pressed.delete(e.key.toLowerCase()); if (e.key === 'Shift') pressed.delete('shift'); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
    const fly = () => {
      move.set(0, 0, 0);
      for (const k of pressed) if (KEYS[k]) move.add(new THREE.Vector3(...KEYS[k]));
      if (move.lengthSq() === 0) return;
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      const v = SPEED * (pressed.has('shift') ? 3 : 1);
      const delta = fwd.multiplyScalar(move.z * v).add(right.multiplyScalar(move.x * v)).add(camera.up.clone().multiplyScalar(move.y * v));
      camera.position.add(delta);
      controls.target.add(delta);
    };

    const stepSweep = () => {
      if (!sweep) return;
      const t = sweepRef.current;
      const on = t != null;
      sweep.loop.visible = on; sweep.edges.visible = on; sweep.wedges.visible = !on;
      if (!on) {
        if (sweep.prevPix.length) {
          const ip = points[0].geometry.getAttribute('color');
          for (const p of sweep.prevPix) ip.setXYZ(p, ...IDLE);
          ip.needsUpdate = true;
          sweep.prevPix = [];
        }
        return;
      }
      const win = kernelWindow(input, t);
      const cx = win.center[0] * SCALE, cy = -win.center[1] * SCALE, hs = (win.size * SCALE) / 2;
      const lp = sweep.loop.geometry.getAttribute('position');
      [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].forEach(([dx, dy], i) => lp.setXYZ(i, cx + dx, cy + dy, 0));
      lp.needsUpdate = true;
      const ip = points[0].geometry.getAttribute('color');
      for (const p of sweep.prevPix) ip.setXYZ(p, ...IDLE);
      for (const p of win.pix) ip.setXYZ(p, ...GOLD);
      ip.needsUpdate = true;
      sweep.prevPix = win.pix;
      const ep = sweep.edges.geometry.getAttribute('position');
      for (let o = 0; o < ep.count / 2; o++) ep.setXYZ(o * 2, cx, cy, 0);
      ep.needsUpdate = true;
    };

    let raf;
    const loop = () => { fly(); stepSweep(); controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();

    const ray = new THREE.Raycaster();
    ray.params.Points.threshold = 10;
    let down = null;
    const onDown = (e) => { down = [e.clientX, e.clientY]; el.focus?.(); };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;  // 드래그(회전)는 선택 아님
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(points)[0];
      const c = hit && layout.cols[hit.object.userData.col];
      onSelectRef.current(c && (c.layer || c.flatten) ? { col: hit.object.userData.col, i: hit.index } : null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    st.current = { renderer, scene, camera, controls, points, sweep, convCol, edges: null, marker: null };
    const marker = new THREE.Mesh(new THREE.RingGeometry(20, 25, 32), new THREE.MeshBasicMaterial({ color: 0xf2f0eb, side: THREE.DoubleSide, depthTest: false }));
    marker.renderOrder = 3;
    marker.visible = false;
    scene.add(marker);
    st.current.marker = marker;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      st.current = null;
    };
  }, [layout]);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.points.forEach((p, ci) => {
      const c = layout.cols[ci], vals = nodeVals?.[ci], attr = p.geometry.getAttribute('color');
      for (let i = 0; i < c.count; i++) attr.setXYZ(i, ...(vals ? heatRGB(vals[i]) : c.flatten ? IDLE_FLAT : IDLE));
      attr.needsUpdate = true;
    });
    if (s.sweep) s.sweep.prevPix = [];
  }, [layout, nodeVals]);

  // 엣지 — 프레임마다 재구성 (선 1.6만 개 ≈ 1ms). 커널 창에서 나가는 선은 sweep이 위치를, 여기서 색을 맡는다
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    if (s.edges) { s.scene.remove(s.edges); s.edges.geometry.dispose(); s.edges.material.dispose(); s.edges = null; }
    if (!frame) return;
    const drawAll = layout.totalEdges <= MAX_EDGES;
    const pos = [], col = [];
    layout.cols.forEach((c, ci) => {
      if (!c.layer) return;
      const src = layout.cols[c.colIn];
      const { w, maxAbs } = edgeWeights(frame, c.layer);
      if (s.sweep && c === s.convCol) {
        const ec = s.sweep.edges.geometry.getAttribute('color'), wc = s.sweep.wedges.geometry.getAttribute('color');
        for (let o = 0; o < c.count; o++) {
          const v = w[o * c.layer.inN], k = 0.3 + 0.7 * (Math.abs(v) / maxAbs), rgb = (v < 0 ? NEG : POS).map((x) => x * k);
          ec.setXYZ(o * 2, ...rgb); ec.setXYZ(o * 2 + 1, ...rgb);
          for (let j = 0; j < 3; j++) wc.setXYZ(o * 3 + j, ...rgb);
        }
        ec.needsUpdate = true; wc.needsUpdate = true;
        return;
      }
      const dim = edgeDim(c.layer.inN), mask = edgeMask(w, c.layer, density);
      for (let o = 0; o < c.count; o++) {
        const selHere = selected && selected.col === ci && selected.i === o;
        const selSrc = selected && selected.col === c.colIn;
        if (!drawAll && !selHere && !selSrc) continue;
        const dp = pt(c, ci, o);
        for (let i = 0; i < c.layer.inN; i++) {
          if (!drawAll && !selHere && selected.i !== i) continue;
          const e = o * c.layer.inN + i;
          if (mask && !mask[e] && !selHere) continue;
          const v = w[e], a = Math.abs(v) / maxAbs;
          if (a < 0.04 && !selHere) continue;
          pos.push(...(src.anchorLocal ? anchor(src, c.colIn, i) : pt(src, c.colIn, i)), ...dp);
          const k = (selHere ? 1 : dim) * (0.25 + 0.75 * a), rgb = (v < 0 ? NEG : POS).map((x) => x * k);
          col.push(...rgb, ...rgb);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // 일반 반투명 합성 — 가산 합성은 선이 겹칠수록 흰색으로 포화돼 노드를 덮어버린다
    s.edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }));
    s.edges.renderOrder = 1;
    s.scene.add(s.edges);
  }, [layout, frame, selected, density]);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.marker.visible = !!selected;
    if (selected) s.marker.position.set(...pt(layout.cols[selected.col], selected.col, selected.i));
  }, [layout, selected]);

  return <div ref={mountRef} tabIndex={0} aria-label="3D 네트워크 — WASD/화살표로 이동" className="w-full h-full outline-none [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full" />;
}
