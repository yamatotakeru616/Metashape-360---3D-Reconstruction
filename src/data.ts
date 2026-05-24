import { SampleScene } from "./types";

// サンプルシーンの定義
export const SAMPLE_SCENES: Record<'living_room' | 'sculpture' | 'japanese_garden', Omit<SampleScene, 'generatePoints' | 'generateMesh'>> = {
  living_room: {
    id: 'living_room',
    name: "北欧モダン・リビング",
    description: "Insta360 X4 で自撮り棒を高めに保持し、部屋の中央を部屋の隅へ向けて歩きながら撮影した、明るいリビング。木目調の家具と観葉植物が特徴点の特定を容易にします。",
    panoramas: [
      "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
    ],
    videoPlaceholder: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&h=400&q=80",
    pointsCount: 3400,
    facesCount: 1800,
    cameraPath: [
      [-2.0, 0.5, -2.0],
      [-1.0, 0.6, -1.8],
      [0.0, 0.7, -1.5],
      [1.0, 0.6, -1.8],
      [1.8, 0.5, -2.0],
      [2.0, 0.6, -0.5],
      [1.5, 0.7, 0.5],
      [0.5, 0.6, 1.2],
      [-0.5, 0.5, 1.5],
      [-1.8, 0.6, 0.8],
    ]
  },
  sculpture: {
    id: 'sculpture',
    name: "ヴィーナス大理石彫刻",
    description: "Insta360 ONE X2 を一脚に固定し、彫刻の周囲を等間隔で3重の円形軌道で回りながらクローズアップ撮影。テクスチャの陰影と微細なキズが極めてシャープな点群を再構築します。",
    panoramas: [
      "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=80"
    ],
    videoPlaceholder: "https://images.unsplash.com/photo-1576016770956-debb63d90029?auto=format&fit=crop&w=600&h=400&q=80",
    pointsCount: 6200,
    facesCount: 4500,
    cameraPath: [
      [2.5, 0.8, 0.0],
      [2.1, 1.0, 1.2],
      [1.2, 1.2, 2.1],
      [0.0, 1.4, 2.5],
      [-1.2, 1.2, 2.1],
      [-2.1, 1.0, 1.2],
      [-2.5, 0.8, 0.0],
      [-2.1, 0.6, -1.2],
      [-1.2, 0.4, -2.1],
      [0.0, 0.3, -2.5],
      [1.2, 0.4, -2.1],
      [2.1, 0.6, -1.2],
    ]
  },
  japanese_garden: {
    id: 'japanese_garden',
    name: "苔むす日本庭園（灯篭と水盤）",
    description: "Insta360 X3を活用。砂紋、朱色の太鼓橋、風に揺れる竹林、そして配置された灯篭を様々な角度から歩行しながら軌道スキャン。自然物の不均一なディテールが立体化の挑戦となります。",
    panoramas: [
      "https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1580137189272-c9379f8864fd?auto=format&fit=crop&w=1200&q=80"
    ],
    videoPlaceholder: "https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=600&h=400&q=80",
    pointsCount: 4800,
    facesCount: 2200,
    cameraPath: [
      [-1.8, 0.4, -1.8],
      [-0.9, 0.5, -1.5],
      [0.0, 0.6, -1.2],
      [0.9, 0.5, -1.5],
      [1.8, 0.4, -1.8],
      [1.5, 0.6, 0.0],
      [0.8, 0.7, 0.8],
      [-0.8, 0.7, 0.8],
      [-1.5, 0.6, 0.0],
    ]
  }
};

// 3D 点群データの生成 (ThreeJS用)
export function generateScenePoints(sceneId: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge') {
  const points: { pos: [number, number, number]; color: [number, number, number] }[] = [];
  
  if (sceneId === 'living_room') {
    // 部屋全体のドーム状の点（壁、天井、床など）
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3.5 + Math.random() * 0.5; // 壁の距離
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      
      // 北欧リビング風の淡いホワイト、ベージュ、ウッディなブラウンの混合
      let r_val = 0.9, g_val = 0.88, b_val = 0.85; // 基本ホワイト
      if (y < -1.4) {
        // 床面：木目の茶色
        r_val = 0.68; g_val = 0.52; b_val = 0.38;
      } else if (Math.random() > 0.8) {
        // 観葉植物のグリーンや北欧ファブリックのライトブルー
        if (Math.random() > 0.5) {
          r_val = 0.25; g_val = 0.45; b_val = 0.3;
        } else {
          r_val = 0.45; g_val = 0.63; b_val = 0.76;
        }
      }
      points.push({ pos: [x, y, z], color: [r_val, g_val, b_val] });
    }
    // 中央のテーブルと観葉植物
    for (let i = 0; i < 1400; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r_cyl = Math.random() * 1.2;
      const h = Math.random() * 1.5 - 1.5; // 床から上向き
      let r = 0.1, g = 0.5, b = 0.2; // 緑
      if (h < -1.1) {
        r = 0.6; g = 0.3; b = 0.1; // 茶色の植木鉢
      } else if (Math.random() > 0.6) {
        r = 0.8; g = 0.6; b = 0.2; // ウッディなテーブル
      }
      const x = Math.cos(theta) * r_cyl;
      const z = Math.sin(theta) * r_cyl;
      points.push({ pos: [x, h, z], color: [r, g, b] });
    }
  } else if (sceneId === 'sculpture') {
    // 彫刻：中心に向かって収束するヴィーナス風シルエット
    for (let i = 0; i < 6200; i++) {
      const y = (Math.random() * 3.6) - 1.8; // 総高 3.6
      let radius = 0.6;
      let r = 0.95, g = 0.92, b = 0.88; // 大理石らしきアイボリーホワイト

      if (y < -1.2) {
        // 台座
        radius = 0.8 + Math.sin(y * 10) * 0.05;
        r = 0.75; g = 0.74; b = 0.75; // グレー
      } else if (y < -0.4) {
        // 下半身・腰
        radius = 0.55 + 0.15 * Math.sin((y + 0.4) * Math.PI);
      } else if (y < 0.4) {
        // 胸部
        radius = 0.4 + 0.12 * Math.cos((y - 0.1) * 3);
      } else if (y < 1.0) {
        // 首
        radius = 0.25 + (1.0 - y) * 0.1;
      } else {
        // 頭部
        radius = 0.35 - Math.pow(y - 1.3, 2) * 0.8;
      }

      radius += (Math.random() - 0.5) * 0.06;
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      if (Math.random() > 0.92) {
        r *= 0.55; g *= 0.53; b *= 0.45;
      }
      points.push({ pos: [x, y, z], color: [r, g, b] });
    }
  } else if (sceneId === 'japanese_garden') {
    // 日本庭園：丘や灯篭
    for (let i = 0; i < 4800; i++) {
      const x = Math.random() * 8 - 4;
      const z = Math.random() * 8 - 4;
      const dist = Math.sqrt(x * x + z * z);
      
      let y = -1.5;
      let r = 0.12, g = 0.38, b = 0.15; // 青々とした苔の緑

      if (dist < 1.6) {
        y = -1.7 + Math.sin(x * 3) * 0.05;
        r = 0.05; g = 0.2; b = 0.35; // 水の深い青
      } else if (x > 1.5 && z > 1.5) {
        y = -1.2 + Math.sin(x * 8) * 0.08;
        r = 0.88; g = 0.84; b = 0.78; // 白砂のベージュ
      } else if (x < -1.5 && z > 1.5) {
        y = -1.0 + Math.exp(-Math.pow(x + 2.5, 2) - Math.pow(z - 2.5, 2)) * 1.5;
      }

      const isLantern = Math.abs(x + 1.2) < 0.4 && Math.abs(z + 1.2) < 0.4;
      if (isLantern) {
        const ly = Math.random() * 2.2 - 1.5;
        y = ly;
        r = 0.55; g = 0.53; b = 0.51;
        if (ly > 0.1 && ly < 0.4 && Math.random() > 0.4) {
          r = 1.0; g = 0.82; b = 0.2;
        }
      }
      points.push({ pos: [x, y, z], color: [r, g, b] });
    }
  } else if (sceneId === 'custom') {
    // カスタム動画: サイバーパンクな高精度SFm特徴点(同心円＆中央のスパイラルコーン)
    for (let i = 0; i < 5000; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      
      if (v < 0.6) {
        const phi = Math.acos(2 * Math.random() - 1);
        const r_sphere = 0.8 * Math.pow(Math.random(), 0.5);
        const x = r_sphere * Math.sin(phi) * Math.cos(theta);
        const y = r_sphere * Math.cos(phi) + 0.2;
        const z = r_sphere * Math.sin(phi) * Math.sin(theta);
        
        const cr = 0.1 + (y + 0.6) * 0.2;
        const cg = 0.8 - (y + 0.6) * 0.3;
        const cb = 0.9 + (y + 0.6) * 0.1;
        points.push({ pos: [x, y, z], color: [cr, cg, cb] });
      } else {
        const r_floor = 1.0 + v * 3.0;
        const x = Math.cos(theta) * r_floor;
        const y = -1.5 + (Math.random() - 0.5) * 0.15;
        const z = Math.sin(theta) * r_floor;
        
        const cr = 0.05;
        const cg = 0.6 - (r_floor / 4.0) * 0.3;
        const cb = 0.5 - (r_floor / 4.0) * 0.2;
        points.push({ pos: [x, y, z], color: [cr, cg, cb] });
      }
    }
  } else if (sceneId === 'hybrid_merge') {
    // 混合マージアセンブリ:
    // パノラマ由来（スカイブルー）とシングルカメラ由来（アンバーゴールド）が
    // 共通特徴点「Tie Points」（ネオングリーン）を介して美しくマージされたデータ
    for (let i = 0; i < 6000; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      
      if (v < 0.35) {
        // パノラマ由来の広域点群 (スカイブルー)
        const radius = 2.0 + Math.random() * 1.5;
        const x = Math.cos(theta) * radius;
        const y = Math.sin(u * 5) * 1.2;
        const z = Math.sin(theta) * radius;
        points.push({ pos: [x, y, z], color: [0.2, 0.6, 0.9] });
      } else if (v < 0.70) {
        // シングルカメラ由来の特定クローズアップ点群 (アンバーゴールド)
        const radius = 0.7 + Math.random() * 0.6;
        const x = Math.cos(theta) * radius;
        const y = (Math.random() * 1.6) - 0.8;
        const z = Math.sin(theta) * radius;
        points.push({ pos: [x, y, z], color: [0.95, 0.6, 0.1] });
      } else {
        // 共通「Tie Points」オーバーラップマージ点群 (高精度ネオングリーン)
        const height = (Math.random() * 1.2) - 0.6;
        const r_tie = 1.3 + Math.sin(height * 4) * 0.2;
        const x = Math.cos(theta) * r_tie + (Math.random() - 0.5) * 0.1;
        const z = Math.sin(theta) * r_tie + (Math.random() - 0.5) * 0.1;
        points.push({ pos: [x, height, z], color: [0.1, 0.9, 0.4] });
      }
    }
  }

  return points;
}

// 疑似的な 3D メッシュデータを生成 (ThreeJS用)
export function generateSceneMesh(sceneId: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge') {
  const vertices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  
  if (sceneId === 'living_room') {
    // テーブル脚
    createCylinder(0, -1.5, 0, 1.2, 0.4, 0.5, [0.62, 0.42, 0.25], vertices, normals, colors);
    // テーブル天板
    createCylinder(0, -1.1, 0, 1.4, 1.4, 0.1, [0.80, 0.60, 0.41], vertices, normals, colors);
    // 植木鉢鉢
    createCylinder(0, -1.0, 0, 0.4, 0.4, 0.35, [0.72, 0.35, 0.15], vertices, normals, colors);
    // 観葉植物の葉
    createSphere(0, -0.4, 0, 0.5, [0.15, 0.55, 0.26], vertices, normals, colors);
  } else if (sceneId === 'sculpture') {
    // 台座（下）
    createCylinder(0, -1.7, 0, 0.9, 0.9, 0.6, [0.65, 0.65, 0.68], vertices, normals, colors);
    // 台座（上）
    createCylinder(0, -1.1, 0, 0.75, 0.75, 0.6, [0.75, 0.75, 0.78], vertices, normals, colors);
    // 有機物
    createCylinder(0, -0.5, 0, 0.45, 0.55, 0.8, [0.93, 0.90, 0.86], vertices, normals, colors);
    createCylinder(0, 0.2, 0, 0.38, 0.45, 0.7, [0.95, 0.92, 0.88], vertices, normals, colors);
    createCylinder(0, 0.7, 0, 0.16, 0.16, 0.3, [0.95, 0.92, 0.88], vertices, normals, colors);
    createSphere(0, 1.0, 0, 0.32, [0.96, 0.93, 0.89], vertices, normals, colors);
  } else if (sceneId === 'japanese_garden') {
    createCylinder(-1.2, -1.5, -1.2, 0.35, 0.35, 0.6, [0.5, 0.5, 0.5], vertices, normals, colors);
    createCylinder(-1.2, -0.9, -1.2, 0.45, 0.45, 0.6, [0.45, 0.45, 0.45], vertices, normals, colors);
    createCylinder(-1.2, -0.3, -1.2, 0.35, 0.35, 0.6, [1.0, 0.85, 0.3], vertices, normals, colors);
    createCylinder(-1.2, 0.3, -1.2, 0.6, 0.1, 0.3, [0.4, 0.4, 0.4], vertices, normals, colors);
    createPlane(0, -1.6, 0, 3.0, 3.0, [0.08, 0.25, 0.45], vertices, normals, colors);
  } else if (sceneId === 'custom') {
    createCylinder(0, -1.3, 0, 1.2, 1.2, 0.4, [0.15, 0.25, 0.35], vertices, normals, colors);
    createCylinder(0, -0.6, 0, 0.15, 0.15, 1.0, [0.25, 0.55, 0.75], vertices, normals, colors);
    createSphere(0, 0.3, 0, 0.7, [0.1, 0.7, 0.8], vertices, normals, colors);
  } else if (sceneId === 'hybrid_merge') {
    createCylinder(0, -1.5, 0, 2.5, 2.5, 0.2, [0.2, 0.25, 0.3], vertices, normals, colors);
    createSphere(-1.2, 0.0, 0, 0.8, [0.2, 0.6, 0.9], vertices, normals, colors);
    createCylinder(1.2, -0.4, 0, 0.6, 0.6, 1.4, [0.95, 0.6, 0.1], vertices, normals, colors);
    createSphere(0, 0.6, 0, 0.5, [0.1, 0.9, 0.4], vertices, normals, colors);
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors)
  };
}

// -------------------------------------------------------------
// ローポリ3D形状ビルダー関数群 (データ量を厳密に制限しパフォーマンスを維持)
// -------------------------------------------------------------

function createSphere(cx: number, cy: number, cz: number, r: number, color: [number, number, number], verts: number[], norms: number[], cols: number[]) {
  const rings = 12;
  const sectors = 12;
  const tempVerts: [number, number, number][] = [];
  
  for (let rG = 0; rG <= rings; rG++) {
    const theta = (rG * Math.PI) / rings;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    for (let sG = 0; sG <= sectors; sG++) {
      const phi = (sG * 2 * Math.PI) / sectors;
      const x = cx + r * Math.sin(phi) * sinTheta;
      const y = cy + r * cosTheta;
      const z = cz + r * Math.cos(phi) * sinTheta;
      tempVerts.push([x, y, z]);
    }
  }

  for (let rG = 0; rG < rings; rG++) {
    for (let sG = 0; sG < sectors; sG++) {
      const first = rG * (sectors + 1) + sG;
      const second = first + sectors + 1;
      
      const v1 = tempVerts[first];
      const v2 = tempVerts[second];
      const v3 = tempVerts[first + 1];
      const v4 = tempVerts[second + 1];
      
      // 三角形1
      addTriangle(v1, v2, v3, color, cx, cy, cz, verts, norms, cols);
      // 三角形2
      addTriangle(v3, v2, v4, color, cx, cy, cz, verts, norms, cols);
    }
  }
}

function createCylinder(cx: number, cy: number, cz: number, rTop: number, rBot: number, height: number, color: [number, number, number], verts: number[], norms: number[], cols: number[]) {
  const segments = 12;
  const hHalf = height / 2;
  
  for (let s = 0; s < segments; s++) {
    const theta1 = (s * 2 * Math.PI) / segments;
    const theta2 = ((s + 1) * 2 * Math.PI) / segments;
    
    const x1T = cx + rTop * Math.cos(theta1);
    const z1T = cz + rTop * Math.sin(theta1);
    const x2T = cx + rTop * Math.cos(theta2);
    const z2T = cz + rTop * Math.sin(theta2);
    
    const x1B = cx + rBot * Math.cos(theta1);
    const z1B = cz + rBot * Math.sin(theta1);
    const x2B = cx + rBot * Math.cos(theta2);
    const z2B = cz + rBot * Math.sin(theta2);
    
    // 側面
    addTriangle([x1B, cy - hHalf, z1B], [x1T, cy + hHalf, z1T], [x2T, cy + hHalf, z2T], color, cx, cy, cz, verts, norms, cols);
    addTriangle([x1B, cy - hHalf, z1B], [x2T, cy + hHalf, z2T], [x2B, cy - hHalf, z2B], color, cx, cy, cz, verts, norms, cols);
    
    // 天井・底面
    addTriangle([cx, cy + hHalf, cz], [x1T, cy + hHalf, z1T], [x2T, cy + hHalf, z2T], color, cx, cy + hHalf, cz, verts, norms, cols);
    addTriangle([cx, cy - hHalf, cz], [x2B, cy - hHalf, z2B], [x1B, cy - hHalf, z1B], color, cx, cy - hHalf, cz, verts, norms, cols);
  }
}

function createPlane(cx: number, cy: number, cz: number, w: number, d: number, color: [number, number, number], verts: number[], norms: number[], cols: number[]) {
  const wH = w / 2;
  const dH = d / 2;
  
  const v1 = [cx - wH, cy, cz - dH];
  const v2 = [cx + wH, cy, cz - dH];
  const v3 = [cx - wH, cy, cz + dH];
  const v4 = [cx + wH, cy, cz + dH];
  
  addTriangle(v1, v3, v2, color, cx, cy + 1, cz, verts, norms, cols);
  addTriangle(v2, v3, v4, color, cx, cy + 1, cz, verts, norms, cols);
}

function addTriangle(v1: number[], v2: number[], v3: number[], col: [number, number, number], cx: number, cy: number, cz: number, verts: number[], norms: number[], cols: number[]) {
  // 頂点
  verts.push(...v1, ...v2, ...v3);
  
  // 法線（面平均法線を簡易的に）
  const ux = v2[0] - v1[0], uy = v2[1] - v1[1], uz = v2[2] - v1[2];
  const wx = v3[0] - v1[0], wy = v3[1] - v1[1], wz = v3[2] - v1[2];
  let nx = uy * wz - uz * wy;
  let ny = uz * wx - ux * wz;
  let nz = ux * wy - uy * wx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= len; ny /= len; nz /= len;
  
  norms.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  
  // カラー
  cols.push(...col, ...col, ...col);
}
