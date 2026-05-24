import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { generateSceneMesh, generateScenePoints } from "../data";

interface ThreeViewerProps {
  sceneId: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge';
  viewMode: 'pointcloud' | 'wireframe' | 'textured';
  showCameraPath: boolean;
  cameraPath: [number, number, number][];
  onExportObj: () => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
  sceneId,
  viewMode,
  showCameraPath,
  cameraPath,
  onExportObj
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Three.js インスタンスの参照
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const cameraPathLineRef = useRef<THREE.Line | null>(null);
  const cameraConesRef = useRef<THREE.Group | null>(null);

  // カメラ・インタラクション状態 (Android/Mobile最適化)
  const [rotation, setRotation] = useState({ x: 0.3, y: 0.8 });
  const [zoom, setZoom] = useState(5.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);

  // 指のピンチズーム追従用一時変数
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(5.0);
  const isDraggingRef = useRef(false);
  const previousPointerPositionRef = useRef({ x: 0, y: 0 });

  // 1. レンダラー、シーン、カメラの完全初期化
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || 320;
    const height = containerRef.current.clientHeight || 280;

    // シーン
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1118); // メタリックダークスペース
    sceneRef.current = scene;

    // カメラ
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1, 5);
    cameraRef.current = camera;

    // レンダラー
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // モバイルの負荷軽減
    rendererRef.current = renderer;

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.4); // テクニカルブルーのサイドライト
    dirLight2.position.set(-5, -2, -5);
    scene.add(dirLight2);

    // グリッドヘルパー
    const gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -1.55;
    scene.add(gridHelper);

    // アニメーションループ
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && !isDraggingRef.current) {
        setRotation(prev => ({ ...prev, y: prev.y + 0.003 }));
      }

      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        // ポジショニング
        const targetX = zoom * Math.sin(rotation.y) * Math.cos(rotation.x);
        const targetY = zoom * Math.sin(rotation.x);
        const targetZ = zoom * Math.cos(rotation.y) * Math.cos(rotation.x);

        cameraRef.current.position.set(
          targetX + pan.x,
          targetY + pan.y,
          targetZ
        );
        cameraRef.current.lookAt(pan.x, pan.y, 0);

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // リサイズ監視
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // 2. 自動回転の停止タイマー
  const handleUserInteraction = () => {
    setAutoRotate(false);
  };

  // 3. シーンデータ（点群、メッシュ、コーン軌跡）の同期
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 古いオブジェクトの消去
    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      (pointsRef.current.material as THREE.Material).dispose();
      pointsRef.current = null;
    }
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
      meshRef.current = null;
    }
    if (cameraPathLineRef.current) {
      scene.remove(cameraPathLineRef.current);
      cameraPathLineRef.current.geometry.dispose();
      (cameraPathLineRef.current.material as THREE.Material).dispose();
      cameraPathLineRef.current = null;
    }
    if (cameraConesRef.current) {
      scene.remove(cameraConesRef.current);
      cameraConesRef.current.children.forEach((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      scene.remove(cameraConesRef.current);
      cameraConesRef.current = null;
    }

    // A. 点群 (Point Cloud) モード
    if (viewMode === 'pointcloud') {
      let ptsData = generateScenePoints(sceneId);

      // VRAM 4GB 環境 & WebGL高負荷防止のための厳格制限(MAX_POINT_CLOUD = 3000)
      const MAX_POINT_CLOUD = 3000;
      if (ptsData.length > MAX_POINT_CLOUD) {
        // 等分散インデクスサンプリングで負荷均等化
        const step = Math.ceil(ptsData.length / MAX_POINT_CLOUD);
        ptsData = ptsData.filter((_, idx) => idx % step === 0).slice(0, MAX_POINT_CLOUD);
      }

      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const colors: number[] = [];

      ptsData.forEach(p => {
        positions.push(...p.pos);
        colors.push(...p.color);
      });

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      // カラフルで円形の豪華なシェーダ風ポイント
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95
      });

      const pointsMesh = new THREE.Points(geometry, material);
      scene.add(pointsMesh);
      pointsRef.current = pointsMesh;
    }

    // B. メッシュ (Wireframe & Textured) モード
    else {
      const meshData = generateSceneMesh(sceneId);
      const geometry = new THREE.BufferGeometry();
      
      geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(meshData.colors, 3));

      let material: THREE.Material;

      if (viewMode === 'wireframe') {
        material = new THREE.MeshBasicMaterial({
          wireframe: true,
          color: 0x3b82f6, // サイバー感のあるネオンブルー
          transparent: true,
          opacity: 0.6
        });
      } else {
        // テクスチャード(ポリゴンカラー投影を疑似マーブルマッピング)
        material = new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          flatShading: true
        });
      }

      const solidMesh = new THREE.Mesh(geometry, material);
      scene.add(solidMesh);
      meshRef.current = solidMesh;
    }

    // C. カメラ軌跡 (Camera Path & Positions)
    if (showCameraPath && cameraPath && cameraPath.length > 0) {
      // 軌跡ライン
      const pathPoints = cameraPath.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x10b981, // エメラルドグリーン
        linewidth: 2,
      });
      const pathLine = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(pathLine);
      cameraPathLineRef.current = pathLine;

      // カメラを現す三角錐 (コーン) のグループ
      const group = new THREE.Group();
      
      cameraPath.forEach((pt, idx) => {
        // コーン (三角錐)
        const coneGeom = new THREE.ConeGeometry(0.12, 0.25, 4);
        coneGeom.rotateX(Math.PI / 2); // 前方に向くように回転
        
        // 元のパノラマに似た鮮烈な色彩マテリアル
        const coneMat = new THREE.MeshBasicMaterial({
          color: idx % 2 === 0 ? 0xef4444 : 0x3b82f6, // 交互に赤と青 (Insta360などの2倍レンズを模擬)
          wireframe: false
        });
        const cone = new THREE.Mesh(coneGeom, coneMat);
        cone.position.set(pt[0], pt[1], pt[2]);
        
        // 中心に向きを揃える
        cone.lookAt(0, 0, 0);
        group.add(cone);
      });
      scene.add(group);
      cameraConesRef.current = group;
    }

  }, [sceneId, viewMode, showCameraPath, cameraPath]);

  // 4. Android対応ポインタージェスチャーイベント
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleUserInteraction();
    previousPointerPositionRef.current = { x: e.clientX, y: e.clientY };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - previousPointerPositionRef.current.x;
    const deltaY = e.clientY - previousPointerPositionRef.current.y;

    setRotation(prev => ({
      x: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, prev.x - deltaY * 0.005)),
      y: prev.y - deltaX * 0.005
    }));

    previousPointerPositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Androidタッチ (マルチタッチによるピンチズーム)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      handleUserInteraction();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = touchStartDistRef.current / dist;
      const newZoom = Math.max(1.5, Math.min(15.0, touchStartZoomRef.current * ratio));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  // マウスホイールズーム
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    handleUserInteraction();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    setZoom(prev => Math.max(1.5, Math.min(15.0, prev * factor)));
  };

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between select-none" ref={containerRef}>
      {/* 3WebGLスクリーン */}
      <canvas
        ref={canvasRef}
        id="three-canvas-3d"
        className="w-full flex-grow touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      />

      {/* コントロール案内・オーバレイ */}
      <div className="absolute top-3 left-4 right-4 flex justify-between items-center pointer-events-none">
        <div className="bg-slate-900/90 [backdrop-filter:blur(8px)] px-3 py-1.5 rounded-lg border border-slate-700/60 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-mono tracking-wider font-semibold text-slate-200 uppercase">
            {viewMode === 'pointcloud' ? 'Point Cloud' : viewMode === 'wireframe' ? 'Wireframe Mesh' : 'Textured Mesh'}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExportObj();
          }}
          className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg border border-blue-400/30 flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
        >
          <span>.OBJ 書き出し</span>
        </button>
      </div>

      <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center pointer-events-none">
        <div className="bg-slate-900/80 [backdrop-filter:blur(6px)] px-2.5 py-1 rounded text-[10px] font-medium text-slate-400">
          Android最適化: スワイプ回転 / ピンチズーム
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoRotate(prev => !prev);
          }}
          className={`pointer-events-auto text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
            autoRotate ? 'bg-indigo-600 text-white border border-indigo-400/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {autoRotate ? '自動回転: ON' : '自動回転: OFF'}
        </button>
      </div>
    </div>
  );
};
