import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Layers, 
  Cpu, 
  HelpCircle, 
  FileCode, 
  RefreshCw, 
  Send, 
  Info, 
  CheckCircle, 
  Play, 
  Pause, 
  Sliders, 
  Eye, 
  Download, 
  ChevronRight,
  Video,
  Image as ImageIcon,
  Sparkles,
  Smartphone,
  Activity,
  Award,
  FolderOpen,
  Globe,
  Trash2,
  Plus,
  Clock,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Project, ChatMessage, InputAsset, AlignmentLog, MatchingPairState } from "./types";
import { SAMPLE_SCENES } from "./data";
import { buildAlignmentPairs, estimateAlignmentSeconds, getFrameCountForAsset, getTotalFrameCount } from "./alignment";
import { ThreeViewer } from "./components/ThreeViewer";
import { ColmapExporter } from "./components/ColmapExporter";
import { RealityScanWorkflow } from "./components/RealityScanWorkflow";

export default function App() {
  // -----------------------------------------
  // 1. 各種状態管理
  // -----------------------------------------
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedSceneKey, setSelectedSceneKey] = useState<'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge'>('hybrid_merge');
  
  // 3050 Ti VRAM保護、マルチアセット
  const [is3050TiProfile, setIs3050TiProfile] = useState<boolean>(true);

  // デモ用のアセット初期定義
  const INITIAL_ASSETS: Record<'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge', InputAsset[]> = {
    living_room: [
      { id: 'ast_lv_1', name: 'パノラマ歩行動画 (Insta360 X4)', type: 'video_360', file: null, url: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&h=400&q=80', duration: 10, frameCount: 20, resolution: 'fhd', extractedImages: [] },
      { id: 'ast_lv_2', name: 'ソファ周辺の補間写真 (通常スマホ)', type: 'image_single', file: null, url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&h=400&q=80', duration: 0, frameCount: 1, resolution: 'original', extractedImages: [] }
    ],
    sculpture: [
      { id: 'ast_sc_1', name: '彫刻3周円形動画 (Insta360 ONE X2)', type: 'video_360', file: null, url: 'https://images.unsplash.com/photo-1576016770956-debb63d90029?auto=format&fit=crop&w=600&h=400&q=80', duration: 15, frameCount: 30, resolution: 'original', extractedImages: [] }
    ],
    japanese_garden: [
      { id: 'ast_jg_1', name: '灯篭スキャンパノラマ動画 (X3)', type: 'video_360', file: null, url: 'https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=600&h=400&q=80', duration: 8, frameCount: 16, resolution: 'fhd', extractedImages: [] }
    ],
    custom: [],
    hybrid_merge: [
      { id: 'ast_hb_1', name: 'パノラマ魚眼(360°全天球)動画 (Insta360 X3)', type: 'video_360', file: null, url: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&h=400&q=80', duration: 12, frameCount: 24, resolution: 'fhd', extractedImages: [] },
      { id: 'ast_hb_2', name: '死角補正シングルディテール動画 (通常一眼)', type: 'video_single', file: null, url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&h=400&q=80', duration: 6, frameCount: 12, resolution: 'hd', extractedImages: [] },
      { id: 'ast_hb_3', name: '太古橋の根元高解像度特定アライメント写真', type: 'image_single', file: null, url: 'https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=600&h=400&q=80', duration: 0, frameCount: 1, resolution: 'original', extractedImages: [] }
    ]
  };

  const [assets, setAssets] = useState<InputAsset[]>(INITIAL_ASSETS.hybrid_merge);

  // カスタム読み込み動画用の状態
  const [customScene, setCustomScene] = useState<any>(null);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 補助的な決定。 hybrid_merge や custom シーンをロード
  const getSceneObject = () => {
    if (selectedSceneKey === 'custom' && customScene) {
      return customScene;
    }
    if (selectedSceneKey === 'custom') {
      return {
        id: 'custom' as const,
        name: "カスタムインポート(MP4)",
        description: "ローカルの動画を読み込んで特徴点アライメントとCOLMAP形式アサインを行います。",
        panoramas: [],
        videoPlaceholder: "",
        pointsCount: 4500,
        facesCount: 2800,
        cameraPath: []
      };
    }
    if (selectedSceneKey === 'hybrid_merge') {
      return {
        id: 'hybrid_merge' as const,
        name: "混合マージ・アライメント (全天球 + 単眼スマホ)",
        description: "360°全天球動画の『広域定位情報』と、シングル通常動画・写真の『高解像度ディテール撮影』を同一3D空間にマージ接続（Tie Pointsアライメント）します。RTX 3050Ti 4GB を保護しながら実動作可能です。",
        panoramas: [
          "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80"
        ],
        videoPlaceholder: "https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=600&h=400&q=80",
        pointsCount: 6000,
        facesCount: 3100,
        cameraPath: [
          // パノラマ軌道（青／円状）
          [-2.2, 0.4, -2.2], [-1.2, 0.5, -2.1], [0.0, 0.6, -1.9], [1.2, 0.5, -2.1], [2.2, 0.4, -2.2],
          // シングルディテール軌道（オレンジ／接写往復）
          [1.0, -0.2, 0.4], [0.5, -0.3, 0.6], [0.0, -0.1, 0.8], [-0.5, -0.3, 0.6], [-1.0, -0.2, 0.4]
        ]
      };
    }
    return SAMPLE_SCENES[selectedSceneKey];
  };

  const currentScene = getSceneObject();

  // プロジェクト情報
  const [project, setProject] = useState<Project>({
    id: "proj_hybrid_01",
    name: "混合マージ・アライメント（等長正方＋単眼）",
    type: "hybrid_merge",
    status: "idle",
    extractedFrames: 0,
    matchedPoints: 0,
    progress: 0,
    createdAt: new Date().toLocaleDateString('ja-JP'),
    settings: {
      fps: 2,
      pointLimit: 20000,
      denseQuality: 'medium',
      is3050TiProfile: true
    }
  });

  // パラメータ
  const [fps, setFps] = useState<number>(2);
  const [pointLimit, setPointLimit] = useState<number>(20000);
  const [denseQuality, setDenseQuality] = useState<'low' | 'medium' | 'high'>('medium');

  // AIサポートチャット
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m_init",
      role: "assistant",
      text: "こんにちは！全天球パノラマ＆単眼一般カメラ『混合マルチアセット・アライメント』AIアシスタントです。NVIDIA RTX 3050 Ti (4GB VRAM) 環境でのクラッシュを防ぐアライメント設定、360動画とスマホ写真の結合、COLMAPエクスポートからRealityScan連携まで、親身にサポートします！\n\n「3050 Ti の 4GB制限でCOLMAPが落ちる時の対策は？」「パノラマ動画と一般の接写写真をマージするためのTie Pointsの配置のコツは？」など、なんでも日本語でお気軽にご質問ください！",
       timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 特徴点アライメントのリアルタイム進捗ログとカレントマッチペア状態
  const [alignmentLogs, setAlignmentLogs] = useState<AlignmentLog[]>([]);
  const [currentPair, setCurrentPair] = useState<MatchingPairState | null>(null);
  const alignmentEndRef = useRef<HTMLDivElement>(null);

  // 3D再構築（MVS / COLMAP）の動的詳細ステート
  const [reconstructInfo, setReconstructInfo] = useState<{
    phase: string;
    detail: string;
    subProgress: number;
    pointsTriangulated: number;
    iteration: number;
  } | null>(null);

  // 負荷対策ガイドのトグルとアクティブタブ
  const [showTroubleshootGuide, setShowTroubleshootGuide] = useState<boolean>(false);
  const [troubleshootTab, setTroubleshootTab] = useState<'asa' | 'param' | 'vmem' | 'downsample'>('asa');

  // 進捗ETA時間予測
  const [totalEtaSeconds, setTotalEtaSeconds] = useState<number>(30);
  const [remainingEtaSeconds, setRemainingEtaSeconds] = useState<number>(30);

  // ステップシミュレータ動作状態
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractionTimer, setExtractionTimer] = useState<number>(0);

  // 3Dビューポート設定
  const [viewMode, setViewMode] = useState<'pointcloud' | 'wireframe' | 'textured'>('pointcloud');
  const [showCameraPath, setShowCameraPath] = useState<boolean>(true);

  // 3050 Ti VRAM リアルタイム予測シミュレーター
  const calculateVramPrediction = () => {
    let baseOs = 1.35; // WindowsOS・バックグラウンドプロセス基本メモリ (GB)
    let assetLoad = 0;
    
    assets.forEach(ast => {
      let resolutionMultiplier = 1.0;
      if (ast.resolution === 'fhd') resolutionMultiplier = 0.65;
      if (ast.resolution === 'hd') resolutionMultiplier = 0.35;
      
      // 3050 Ti 防衛プロファイルをONにするとダウンサンプリング乗数がさらに最適化
      if (is3050TiProfile) {
        resolutionMultiplier *= 0.68;
      }
      
      if (ast.type === 'video_360') {
        assetLoad += (ast.duration * fps) * 0.05 * resolutionMultiplier;
      } else if (ast.type === 'video_single') {
        assetLoad += (ast.duration * fps) * 0.025 * resolutionMultiplier;
      } else {
        assetLoad += 0.04 * resolutionMultiplier;
      }
    });
    
    // 特徴点マッチング制限による負荷
    let siftCap = is3050TiProfile ? Math.min(pointLimit, 20000) : pointLimit;
    let matchLoad = (siftCap / 30000) * 0.95;
    
    // MVSデンス品質による結合負荷
    let denseCap = is3050TiProfile ? 'medium' as const : denseQuality;
    let denseLoad = denseCap === 'high' ? 1.0 : (denseCap === 'medium' ? 0.45 : 0.15);
    
    return parseFloat((baseOs + assetLoad + matchLoad + denseLoad).toFixed(2));
  };

  // 9段階の詳細な進行タグ状況を判定する関数
  const getAlignmentDetailedSteps = () => {
    let step1Status: 'pending' | 'active' | 'completed' = 'pending'; // ① FRAME_EXTRACT (フレーム切り出し)
    let step2Status: 'pending' | 'active' | 'completed' = 'pending'; // ② SIFT_FEATURES (不変特徴抽出)
    let step3Status: 'pending' | 'active' | 'completed' = 'pending'; // ③ PAIR_MATCH (コヴィジビリティマッチング)
    let step4Status: 'pending' | 'active' | 'completed' = 'pending'; // ④ RANSAC_FILTER (幾何整合ノイズフィルタ)
    let step5Status: 'pending' | 'active' | 'completed' = 'pending'; // ⑤ Spherical Align (360°単体アライメント)
    let step6Status: 'pending' | 'active' | 'completed' = 'pending'; // ⑥ Pinhole Align (通常カメラ単体アライメント)
    let step7Status: 'pending' | 'active' | 'completed' = 'pending'; // ⑦ Chunk Fusion (相互スケール結合統合)
    let step8Status: 'pending' | 'active' | 'completed' = 'pending'; // ⑧ MVS_DENSE (デンスピクセル深度推定)
    let step9Status: 'pending' | 'active' | 'completed' = 'pending'; // ⑨ Downsample (WebGL表示最適サンプリング)

    const status = project.status;

    if (status === 'extracting') {
      step1Status = 'active';
    } else if (status === 'aligning') {
      step1Status = 'completed';
      step2Status = 'active';
      if (currentPair) {
        if (currentPair.status === 'matching') {
          step3Status = 'active';
        } else if (currentPair.status === 'filtering') {
          step3Status = 'completed';
          step4Status = 'active';
        } else if (currentPair.status === 'solved') {
          step3Status = 'completed';
          step4Status = 'completed';
        }
      }
    } else if (status === 'reconstructing') {
      step1Status = 'completed';
      step2Status = 'completed';
      step3Status = 'completed';
      step4Status = 'completed';

      if (reconstructInfo) {
        const phase = reconstructInfo.phase;
        if (phase.includes('Step A')) {
          step5Status = 'active';
        } else if (phase.includes('Step B')) {
          step5Status = 'completed';
          step6Status = 'active';
        } else if (phase.includes('Step C')) {
          step5Status = 'completed';
          step6Status = 'completed';
          step7Status = 'active';
        } else if (phase.includes('Step D') || phase.includes('MVS') || phase.includes('深度') || phase.includes('ピクセル深度')) {
          step5Status = 'completed';
          step6Status = 'completed';
          step7Status = 'completed';
          step8Status = 'active';
        } else if (phase.includes('Step E') || phase.includes('サンプリング')) {
          step5Status = 'completed';
          step6Status = 'completed';
          step7Status = 'completed';
          step8Status = 'completed';
          step9Status = 'active';
        }
      } else {
        step5Status = 'completed';
        step6Status = 'completed';
        step7Status = 'completed';
        step8Status = 'active';
      }
    } else if (status === 'completed') {
      step1Status = 'completed';
      step2Status = 'completed';
      step3Status = 'completed';
      step4Status = 'completed';
      step5Status = 'completed';
      step6Status = 'completed';
      step7Status = 'completed';
      step8Status = 'completed';
      step9Status = 'completed';
    }

    return [
      { id: 1, label: 'FRM_EXTRACT', desc: 'フレーム展開', status: step1Status },
      { id: 2, label: 'SIFT_FEATURES', desc: '不変特徴量抽出', status: step2Status },
      { id: 3, label: 'PAIR_MATCH', desc: 'コヴィジビリティ照合', status: step3Status },
      { id: 4, label: 'RANSAC_FILTER', desc: 'ノイズ外れ値排除', status: step4Status },
      { id: 5, label: 'Spherical Align', desc: '360°部優先整列', status: step5Status },
      { id: 6, label: 'Pinhole Align', desc: 'スマホ単眼自己整列', status: step6Status },
      { id: 7, label: 'Chunk Fusion', desc: 'チャンク相互統合マージ', status: step7Status },
      { id: 8, label: 'MVS_DENSE', desc: 'OpenCL深度推定', status: step8Status },
      { id: 9, label: 'WebGL Sample', desc: 'WebGL負荷間引き', status: step9Status },
    ];
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'match' = 'info') => {
    setAlignmentLogs(prev => [
      ...prev,
      {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
        message: msg,
        type
      }
    ]);
  };

  const triggerVibrate = (pattern: number | number[] = 30) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // -----------------------------------------
  // 2. 自動スクロール (チャット / アライメントログ)
  // -----------------------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  useEffect(() => {
    alignmentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [alignmentLogs]);

  // -----------------------------------------
  // 3. 3D再構築 SFm-MVS パイプライン
  // -----------------------------------------
  
  // 動画のセットアップ処理 (単一ファイル、Custom時のみ)
  const setupUploadedVideo = (file: File) => {
    setIsUploading(true);
    triggerVibrate([40, 40]);
    const objectUrl = URL.createObjectURL(file);
    
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const dur = tempVideo.duration || 10;
      const MathFps = fps || 2;
      const framesCount = Math.max(8, Math.min(40, Math.floor(dur * MathFps)));
      const cameraPath: [number, number, number][] = [];
      for (let i = 0; i < framesCount; i++) {
        const angle = (i / framesCount) * Math.PI * 2 * 1.6;
        const radius = 2.2 + Math.sin(i * 0.15) * 0.4;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(i * 0.08) * 0.3 + 0.3;
        const z = Math.sin(angle) * radius;
        cameraPath.push([x, y, z]);
      }

      const newAsset: InputAsset = {
        id: 'ast_custom_' + Date.now(),
        name: file.name,
        type: 'video_360',
        file: file,
        url: objectUrl,
        duration: dur,
        frameCount: framesCount,
        resolution: 'fhd',
        extractedImages: []
      };

      setAssets([newAsset]);
      setCustomScene({
        id: 'custom' as const,
        name: file.name.replace(/\.[^/.]+$/, ""),
        description: `アップロード画像「${file.name}」。長さ: ${dur.toFixed(1)}秒。特徴点ベースでカメラの360度アライメントパスを自動推定します。`,
        panoramas: [],
        videoPlaceholder: "",
        pointsCount: 4500,
        facesCount: 2800,
        cameraPath: cameraPath,
        videoUrl: objectUrl,
        extractedFrameUrls: [],
        videoFileName: file.name,
        videoDuration: dur
      });

      setSelectedSceneKey('custom');
      
      setProject({
        id: "proj_custom_360",
        name: file.name.replace(/\.[^/.]+$/, "") + " アライメント",
        type: 'custom',
        status: "idle",
        extractedFrames: 0,
        matchedPoints: 0,
        progress: 0,
        createdAt: new Date().toLocaleDateString('ja-JP'),
        settings: {
          fps: MathFps,
          pointLimit: pointLimit,
          denseQuality: denseQuality,
          is3050TiProfile
        }
      });
      
      setExtractedImages([]);
      setIsUploading(false);
      setActiveStep(0);
    };
    
    tempVideo.onerror = () => {
      setIsUploading(false);
      alert("動画ファイルの読み込みに失敗しました。MP4(H.264)形式を推奨します。");
    };
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setupUploadedVideo(file);
  };
    // 複数アセット対応の汎用アライメントシミュレーター
  const startReconstruction = async () => {
    if (isProcessing) return;
    if (assets.length === 0) {
      triggerVibrate([40, 40, 80]);
      addLog(`[SYSTEM] アライメント対象の動画または画像が登録されていません。先にアセットを追加してください。`, "warning");
      setProject(prev => ({ ...prev, status: "error", progress: 0 }));
      return;
    }

    triggerVibrate([80, 40, 80]);
    setIsProcessing(true);
    setProject(prev => ({ ...prev, status: 'extracting', progress: 0 }));
    setActiveStep(1); // アライメントマッチ画面(Step 1)へ
    setExtractedImages([]);
    setAlignmentLogs([]); // ログのクリア
    setCurrentPair(null);

    const totalAssets = assets.length;
    let currentAssetIndex = 0;
    let accumulatedFrames = 0;

    // --- 全体の推定残り時間 (ETA) の算出 ---
    const totalFrames = getTotalFrameCount(assets, fps, is3050TiProfile);
    const totalEstSec = estimateAlignmentSeconds(assets, fps, is3050TiProfile);

    setTotalEtaSeconds(totalEstSec);
    setRemainingEtaSeconds(totalEstSec);

    // カウントダウン用のタイマー起動
    const countdownInterval = setInterval(() => {
      setRemainingEtaSeconds(prev => {
        if (prev <= 1) return 1; // 完了処理が完了するまでは1秒で止めておく
        return prev - 1;
      });
    }, 1000);

    addLog(`[SYSTEM] 統合混合アライメント変換パイプラインを開始しました。`, "info");
    addLog(`[SYSTEM] 稼働中制限プロファイル: ${is3050TiProfile ? "NVIDIA RTX 3050 Ti (4GB VRAM) 保護防衛ON" : "制限なし(高速優先プロファイル)"}`, is3050TiProfile ? "success" : "warning");
    addLog(`[SYSTEM] 登録されたマルチアセット: ${totalAssets} 件を検出。予測総処理時間: 約 ${totalEstSec} 秒`, "info");

    // 疑似フレーム切り出し＆キーフレーム描画処理の進捗管理
    const simulateAssetExtraction = () => {
      if (currentAssetIndex >= totalAssets) {
        // [フェーズ 2] SIFT特徴点 ＆ 混合マージコヴィジビリティマッチング
        addLog(`[EXTRACT] 全てのアセットからキーフレームの展開が完了しました（合計: ${accumulatedFrames} フレーム）`, "success");
        setProject(prev => ({ ...prev, status: 'aligning' }));
        addLog(`[SIFT] 混合カメラ仕様に対応した、正距円筒（360°）広域ジオメトリ ⇆ 平面ローカル局所特徴点（SIFT/DoG）の抽出を開始します。`, "info");
        
        let alignProg = 45;
        let pairIndex = 0;
        
        // パノラマ動画、通常動画、高画質写真などの組合わせを再現性のある値でシミュレート
        const simulatedPairs = buildAlignmentPairs(assets, pointLimit);

        let currentPairStep = 0; 
        let pairMatchedFeatures = 0;
        
        const runPairMatchingSimulation = () => {
          if (pairIndex >= simulatedPairs.length) {
            // ペアマッチング完了 -> デンス深度配列および多点マージ・MVS結合フェーズへ
            setCurrentPair(null);
            addLog(`[SIFT] すべてのペア相関および共視 Tie Points (結合代表点) の抽出が完了しました。`, "success");
            addLog(`[SIFT] 特徴点アライメント歪み補正: RANSAC検定完了 (有効率 94.6%)。極端な不整合記述子(Descriptor)を極小化しました。`, "success");
            
            // [フェーズ 3] デンス深度配列および多点マージ・MVS結合
            setProject(prev => ({ ...prev, status: 'reconstructing' }));
            addLog(`[ASA] 高負荷クラッシュを根本防止する「アライメント・分離・アライメント（ASA）」ワークフローを起動します。`, "success");
            addLog(`[ASA] 球面パノラマ (SPHERICAL) と通常カメラ (PINHOLE) の混合によるMVS不具合を解決するため、別チャンク分離処理を行います。`, "info");
            
            setReconstructInfo({
              phase: "Step A: 360°チャンクアライメント",
              detail: "360°パノラマ動画のフレームのみを抽出し、SPHERICALモデルとして個別の基本コーンを自己アライメント中...",
              subProgress: 10,
              pointsTriangulated: 0,
              iteration: 0
            });
            
            let reconProg = 80;
            const reconInterval = setInterval(() => {
              reconProg += 3; // 3ずつ増やすことでより細かく進行する
              const currentPro = Math.min(99, reconProg);
              setProject(prev => ({
                ...prev,
                progress: currentPro
              }));

              if (reconProg === 83) {
                addLog(`[Step A] 360°パノラマ単体のアライメントに成功。Spherical(球)幾何で高精度基本スパース点群を作成。`, "success");
                addLog(`[Step B] 通常単一カメラ・深度写真チャンクの分離処理を開始。Pinhole(ピンホール)カメラモデルで初期特徴記述子を評価中...`, "info");
                setReconstructInfo({
                  phase: "Step B: 単一カメラチャンクアライメント",
                  detail: "超高解像度ディテール写真群のみをPINHOLEモデルで個別マッチング＆自己姿勢推定中...",
                  subProgress: 30,
                  pointsTriangulated: 540,
                  iteration: 15
                });
              } else if (reconProg === 86) {
                addLog(`[Step B] 高解像度ディテール写真群の独立アライメントに成功。Pinhole幾何でスパース点群及び内部焦点距離(f_est = 984.25 px)を推定。`, "success");
                addLog(`[Step C] チャンク統合（Scale Tweakフュージョン）を開始。360°をベース平面座標系とし、通常写真群のスケール・回転を結合補正します。`, "info");
                setReconstructInfo({
                  phase: "Step C: 2チャンク相互結合統合",
                  detail: "360°の広域スケールに連動補正（applyScaleTweak: true）し、重なり合う共通特徴点(Tie Points)からスケール不整合を自動解消中...",
                  subProgress: 50,
                  pointsTriangulated: 1450,
                  iteration: 40
                });
              } else if (reconProg === 89) {
                addLog(`[Step C] 360°広域平面 ⇆ スマホ詳細写真の結合フュージョン完了！同一世界3D空間に補正スケール整合。`, "success");
                addLog(`[Step D] VRAM 4GB防衛型 MVS 密度再構築処理を準備します（設定: ${is3050TiProfile ? "max_image_size=1200px" : "max_image_size=2000px"}）`, "warning");
                setReconstructInfo({
                  phase: "Step D: 3050 Ti VRAM保護 MVS準備",
                  detail: is3050TiProfile 
                    ? "低VRAMクランプ: max_image_size=1200px, cache_size=7GB でメモリの溢れを未然に防衛制限中..."
                    : "高解像度密度優先: max_image_size=2000px (高密度点群抽出を実行)...",
                  subProgress: 65,
                  pointsTriangulated: 2100,
                  iteration: 60
                });
              } else if (reconProg === 92) {
                addLog(`[Step D] CUDA競合クラッシュ回避のため、Metashape/COLMAP OpenCL バックエンドを適用してMVSピクセル深度推定を開始。`, "success");
                addLog(`[MVS] patch_match_stereo: 複数カメラ視点の半遮蔽ステレオピクセルを Levenberg-Marquardt で反復評価中...`, "info");
                setReconstructInfo({
                  phase: "MVSピクセル深度処理 (OpenCL駆動)",
                  detail: "CUDAパッチマッチステレオのエラーを回避するため、OpenCL優先でCPU-GPUオフロード協調計算中...",
                  subProgress: 80,
                  pointsTriangulated: 3100,
                  iteration: 95
                });
              } else if (reconProg === 95) {
                if (is3050TiProfile) {
                  addLog(`[MVS] 3050Ti VRAM保護機能：デンス深度点群グリッドのVRAMオーバーを検知、スケールを1/2に自動防衛クランプ。`, "warning");
                } else {
                  addLog(`[MVS] 深度マップ(Depth Fusion)の高精度メジャーポイント結合を実行中...`, "info");
                }
                setReconstructInfo({
                  phase: "Multi-View Stereo 統合マージ",
                  detail: "複数方向の深度マップ(Depth Matrix)を相互デベロップメント投影して稠密3D座標系へ転換中...",
                  subProgress: 90,
                  pointsTriangulated: 3850,
                  iteration: 110
                });
              } else if (reconProg === 98) {
                addLog(`[MVS] 各カメラ配置ポーズとTie Points軌道コーンの3D多点デンス・フュージョンを結合中...`, "info");
                addLog(`[SYSTEM] WebGL描画フリーズ防止: MAX_POINT_CLOUD=3000にダウンサンプリングして3Dビューワに展開します。`, "success");
                setReconstructInfo({
                  phase: "Step E: WebGL 空間ダウンサンプリング",
                  detail: "低スペック環境/Androidモバイルでも軽快。3000点までの空間分割等分散サンプリングを適用完了。",
                  subProgress: 98,
                  pointsTriangulated: currentScene.pointsCount - 150,
                  iteration: 120
                });
              }

              if (reconProg >= 100) {
                clearInterval(reconInterval);
                clearInterval(countdownInterval); // カウントダウン停止
                setRemainingEtaSeconds(0);
                setReconstructInfo(null); // 再構築情報リセット

                // [フェーズ 4] 完了
                addLog(`[MVS] 各カメラポーズ姿勢・Tie Points軌道コーンの3Dフュージョンに成功しました！`, "success");
                addLog(`[SYSTEM] ASA(アライメント分離・統合)マルチチャンクパイプライン完了！3Dプレビューを描画します。`, "success");
                
                setProject(prev => ({
                  ...prev,
                  status: 'completed',
                  progress: 100,
                  matchedPoints: currentScene.pointsCount
                }));
                setIsProcessing(false);
                addLog(`[SYSTEM] 混合アライメント ⇄ MVS 3D再構築がすべて正常に完了しました！高密度点群がロードされました。`, "success");
                addLog(`[SYSTEM] 「COLMAP形式」のカメラ歪み・姿勢パラメータ群が生成されています。画面上部の案内ボタン、または「3. COLMAPエクスポート」タブから進んで成果物を確認・DLしてください。`, "success");
                triggerVibrate([80, 50, 80, 50, 150]);
              }
            }, 750); // 進捗ステップを750msにすることで合計約6秒かけて動的な再構築を楽しめるようにする
            return;
          }

          const activePair = simulatedPairs[pairIndex];
          
          // ペアのフェーズシミュレート(抽出 -> 検定 -> 解決)
          const pairInterval = setInterval(() => {
            currentPairStep++;
            if (currentPairStep === 1) {
              addLog(`[SIFT] 記述ペア接続検知: 「${activePair.a}」 ⇆ 「${activePair.b}」`, "info");
              setCurrentPair({
                assetAName: activePair.a,
                assetBName: activePair.b,
                matchedFeatures: 0,
                status: 'matching'
              });
            } else if (currentPairStep === 2) {
              pairMatchedFeatures = Math.floor(activePair.finalPts * 0.4);
              setCurrentPair({
                assetAName: activePair.a,
                assetBName: activePair.b,
                matchedFeatures: pairMatchedFeatures,
                status: 'matching'
              });
              addLog(`  -> 共通のキーフレーム候補を空間比較中... 特徴点 ${pairMatchedFeatures} 点が暫定一致。`, "info");
            } else if (currentPairStep === 3) {
              pairMatchedFeatures = Math.floor(activePair.finalPts * 0.85);
              setCurrentPair({
                assetAName: activePair.a,
                assetBName: activePair.b,
                matchedFeatures: pairMatchedFeatures,
                status: 'filtering'
              });
              addLog(`  -> [RANSAC] エピポーラ幾何拘束によりノイズ外れ値を厳密排除中...`, "warning");
            } else {
              // 完成
              clearInterval(pairInterval);
              addLog(`[SIFT] 接続成功: 「${activePair.a}」 ⇆ 「${activePair.b}」 特徴点相関 Tie Points = ${activePair.finalPts} 組確定。`, "match");
              setCurrentPair({
                assetAName: activePair.a,
                assetBName: activePair.b,
                matchedFeatures: activePair.finalPts,
                status: 'solved'
              });
              
              triggerVibrate(30);

              alignProg += Math.ceil(35 / simulatedPairs.length);
              setProject(prev => ({
                ...prev,
                progress: Math.min(80, alignProg),
                matchedPoints: Math.min(currentScene.pointsCount, prev.matchedPoints + activePair.finalPts)
              }));

              pairIndex++;
              currentPairStep = 0;
              setTimeout(runPairMatchingSimulation, 250); // 次のペアへ
            }
          }, 400); // 1ステップあたり400msに調整
        };

        runPairMatchingSimulation();
        return;
      }

      // 各アセットのフレーム切り出しを順次シミュレート
      const currentAsset = assets[currentAssetIndex];
      const framesCount = getFrameCountForAsset(currentAsset, fps, is3050TiProfile);
      
      let currentFrame = 0;
      addLog(`[EXTRACT] アセット【${currentAsset.name}】のフレーム抽出処理を開始しました。目標キーフレーム数 = ${framesCount} 枚。`, "info");
      
      const extractInterval = setInterval(() => {
        currentFrame++;
        accumulatedFrames++;
        
        // canvasから適当なプレースホルダー画像を抽出したように振る舞う
        const mockImg = currentAsset.url;
        setExtractedImages(prev => [...prev, mockImg]);
        triggerVibrate(15);

        // 前半 10% - 45% をフレーム抽出のプログレスとする
        const prog = 10 + Math.floor((accumulatedFrames / Math.max(1, totalFrames)) * 35);
        setProject(prev => ({
          ...prev,
          progress: Math.min(45, prog),
          extractedFrames: accumulatedFrames
        }));

        if (currentFrame % 5 === 0 || currentFrame === framesCount) {
          addLog(`  -> [EXTRACT] ${currentAsset.name}: フレーム ${currentFrame}/${framesCount} 枚まで完了。`, "info");
        }

        if (currentFrame >= framesCount) {
          clearInterval(extractInterval);
          addLog(`[EXTRACT] ${currentAsset.name}: すべての対象フレーム (${framesCount}枚) をキャッシュ展開しました。`, "success");
          currentAssetIndex++;
          setTimeout(simulateAssetExtraction, 250); // 次のアセットへ
        }
      }, 200); // 各フレーム切り出しを200msにしてスムーズにする
    };

    simulateAssetExtraction();
  };

  // プロジェクトリセット
  const resetProject = () => {
    triggerVibrate(50);
    setProject({
      id: selectedSceneKey === "custom" ? "proj_custom_360" : "proj_hybrid_01",
      name: currentScene.name + " アライメント",
      type: selectedSceneKey,
      status: "idle",
      extractedFrames: 0,
      matchedPoints: 0,
      progress: 0,
      createdAt: new Date().toLocaleDateString('ja-JP'),
      settings: {
        fps,
        pointLimit,
        denseQuality,
        is3050TiProfile
      }
    });
    setExtractionTimer(0);
    setActiveStep(0);
  };

  // サンプルシーンの決定・切替
  const handleSceneSelect = (key: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge') => {
    triggerVibrate(30);
    setSelectedSceneKey(key);
    
    // アセットのプリセット読み込み
    setAssets(INITIAL_ASSETS[key] || []);

    let sceneName = "カスタムインポート(MP4)";
    if (key === 'hybrid_merge') {
      sceneName = "混合マージ・アライメント (全天球 + 単眼スマホ)";
    } else if (key !== 'custom') {
      sceneName = SAMPLE_SCENES[key].name;
    } else if (customScene) {
      sceneName = customScene.name;
    }

    // 3050Ti保護プロファイルの場合、基準値の自動調整
    if (is3050TiProfile) {
      setFps(2);
      setPointLimit(20000);
      setDenseQuality('medium');
    }

    setProject(prev => ({
      ...prev,
      name: sceneName + " 構築",
      type: key,
      status: "idle",
      progress: 0,
      extractedFrames: 0,
      matchedPoints: 0,
      settings: {
        fps: is3050TiProfile ? 2 : fps,
        pointLimit: is3050TiProfile ? 20000 : pointLimit,
        denseQuality: is3050TiProfile ? 'medium' : denseQuality,
        is3050TiProfile
      }
    }));
    setExtractionTimer(0);
    setActiveStep(0);
  };

  // 新しいアセットのインポート処理 (一般ファイル追加)
  const handleAddAsset = (type: 'video_360' | 'video_single' | 'image_single', file: File) => {
    const objectUrl = URL.createObjectURL(file);
    let duration = 0;
    
    if (type !== 'image_single') {
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const dur = tempVideo.duration || 5;
        const newAsset: InputAsset = {
          id: 'ast_user_' + Date.now(),
          name: file.name,
          type: type,
          file: file,
          url: objectUrl,
          duration: dur,
          frameCount: Math.max(2, Math.floor(dur * fps)),
          resolution: is3050TiProfile ? 'fhd' : 'original',
          extractedImages: []
        };
        setAssets(prev => [...prev, newAsset]);
        triggerVibrate([40, 30]);
      };
    } else {
      const newAsset: InputAsset = {
        id: 'ast_user_' + Date.now(),
        name: file.name,
        type: 'image_single',
        file: file,
        url: objectUrl,
        duration: 0,
        frameCount: 1,
        resolution: 'original',
        extractedImages: []
      };
      setAssets(prev => [...prev, newAsset]);
      triggerVibrate([40, 30]);
    }
  };

  // アセット解像度切替
  const handleUpdateAssetResolution = (id: string, res: 'original' | 'fhd' | 'hd') => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, resolution: res } : a));
    triggerVibrate(15);
  };

  // VRAM異常負荷回避：ワンクリック自動セーフパラメータ最適化
  const applyVramOptimization = () => {
    triggerVibrate([80, 40, 80]);
    setIs3050TiProfile(true);
    setPointLimit(20000);
    setFps(2);
    setDenseQuality('medium');
    // 全てのアセットを最も安全なHD画質に一括変更
    setAssets(prev => prev.map(a => ({ ...a, resolution: 'hd' })));
    
    // システムログに登録
    setAlignmentLogs(prev => [
      ...prev,
      {
        id: 'log_opt_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
        message: `[SYSTEM] 警告検知プロトコル：1クリック防衛最適化を適用しました。解像度を[HD(1K)]にクランプ、FPSを 2 に設定しVRAM消費を安全圏内に抑えました。`,
        type: 'success'
      }
    ]);
  };

  // アセット削除
  const handleRemoveAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    triggerVibrate([50, 30]);
  };

  // -----------------------------------------
  // 4. AIチャット送信 (API 連携、フォールバック搭載)
  // -----------------------------------------
  const handleSendMessage = async (textToSend?: string) => {
    const rawMess = textToSend || chatInput;
    if (!rawMess.trim() || isChatLoading) return;

    triggerVibrate(30);
    setChatInput("");

    const userMessage: ChatMessage = {
      id: "us_" + Date.now(),
      role: "user",
      text: rawMess,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/gemini/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: rawMess,
          chatHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error("APIレスポンス異常");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: "as_" + Date.now(),
        role: "assistant",
        text: data.text,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errResponseMsg = "全天球撮影プロからのアドバイスを提案します：\n\n- **パノラマアライメント成功度向上**: Insta365などの最高比率(5.7K以上/30fps)かつ「AEロック(露出固定)」で撮影してください。露出が各秒でパチパチ変更されると、COLMAPの特徴点マッチング強度（Descriptor）が完全に一致せずアライメント不可になります。\n- **RealityScanとCOLMAPの関係**: RealityScanアプリは、写真のExifメタ情報から内部焦点距離を逆算します。パノラマを6分割した立方体画像を出力する場合、全方位歪みを排したピンホールパラメータとして、画角FOVを正確に90度に揃えることが極めて決定的なポイントとなります。";
      
      const assistantMessage: ChatMessage = {
        id: "as_err_" + Date.now(),
        role: "assistant",
        text: errResponseMsg,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Webビュー上で擬似.OBJ書き出しを行われた際のエフェクト
  const handleExportObjNotify = () => {
    triggerVibrate([100, 50, 150]);
    // 直接OBJのダウンロード処理
    const geometryData = `# Metashape 360 - Interactive OBJ exporter\n# Vertices: ${currentScene.pointsCount}\n# Faces: ${currentScene.facesCount}\n`;
    const blob = new Blob([geometryData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSceneKey}_textured_model_preview.obj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -----------------------------------------
  // 5. シンプルな箇条書きパーサー
  // -----------------------------------------
  const renderMessageContent = (text: string) => {
    return text.split("\n\n").map((para, i) => {
      if (para.startsWith("- ") || para.startsWith("* ") || para.match(/^\d+\./)) {
        return (
          <ul key={i} className="list-disc list-inside space-y-1 text-slate-300">
            {para.split("\n").map((line, lIdx) => {
              const cleanLine = line.replace(/^[-*\d.]+\s*/, "");
              const isBold = cleanLine.match(/\*\*(.*?)\*\*/);
              if (isBold) {
                const parts = cleanLine.split("**");
                return (
                  <li key={lIdx} className="text-sm">
                    {parts[0]}<strong className="text-blue-400 font-semibold">{parts[1]}</strong>{parts[2]}
                  </li>
                );
              }
              return <li key={lIdx} className="text-sm">{cleanLine}</li>;
            })}
          </ul>
        );
      }
      
      const matchedBold = para.match(/\*\*(.*?)\*\*/);
      if (matchedBold) {
        const parts = para.split("**");
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-200">
            {parts.map((pSub, sIdx) => sIdx % 2 === 1 ? <strong key={sIdx} className="text-blue-400 font-semibold">{pSub}</strong> : pSub)}
          </p>
        );
      }

      return <p key={i} className="text-sm leading-relaxed text-slate-200">{para}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased relative">
      
      {/* -----------------------------------------
       * A. ヘッダー
       * ----------------------------------------- */}
      <header className="border-b border-slate-900 bg-slate-950/80 [backdrop-filter:blur(12px)] sticky top-0 z-30 px-4 py-3 sm:py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/30 border border-blue-400/20">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-mono uppercase">
              Metashape 360° Alignment
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
              360° Panorama to COLMAP & RealityScan Workflow Builder
            </p>
          </div>
        </div>

        {/* 状態表示＆リセット */}
        <div className="flex items-center gap-2">
          {project.status !== 'idle' && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-mono font-medium uppercase">
                {project.status === 'extracting' ? 'Extracting Frames' :
                 project.status === 'aligning' ? 'SIFT Aligning' :
                 project.status === 'reconstructing' ? 'MVS Reconstructing' : 'Completed'}
              </span>
            </div>
          )}
          <button
            onClick={resetProject}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors active:scale-95"
            title="リセット"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* -----------------------------------------
       * B. メインエリア
       * ----------------------------------------- */}
      <main className="flex-grow flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-900 overflow-hidden">
        
        {/* === A) 左側列：映像インプット ＆ 各種設定コントロール === */}
        <section className="w-full lg:w-[42%] xl:w-[38%] flex flex-col bg-slate-950 p-4 sm:p-5 gap-5 overflow-y-auto max-h-[calc(100vh-65px)]">
          
          {/* シーンセレクター */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              1. ターゲットシーン・プリセット選択
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {([
                { k: 'hybrid_merge', name: '混合マージ', tag: 'HYBRID', img: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=200&q=80' },
                { k: 'living_room', name: 'モダンリビング', tag: 'INDOOR', img: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=200&q=80' },
                { k: 'sculpture', name: '彫刻ヴィーナス', tag: 'OBJECT', img: 'https://images.unsplash.com/photo-1576016770956-debb63d90029?auto=format&fit=crop&w=200&q=80' },
                { k: 'japanese_garden', name: '日本庭園', tag: 'GARDEN', img: 'https://images.unsplash.com/photo-1504618223053-559bdef9dd5a?auto=format&fit=crop&w=200&q=80' },
                { k: 'custom', name: '新規読込', tag: 'CUSTOM', img: '' }
              ] as const).map(({ k, name, tag, img }) => {
                const isSelected = selectedSceneKey === k;
                return (
                  <button
                    key={k}
                    onClick={() => handleSceneSelect(k)}
                    className={`relative text-left p-1.5 rounded-xl border flex flex-col justify-between h-16 overflow-hidden group transition-all duration-200 ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-950/25 shadow-md shadow-indigo-950/20' 
                        : 'border-slate-850 bg-slate-905/40 hover:bg-slate-900/80'
                    }`}
                  >
                    {img && (
                      <div 
                        className="absolute inset-0 opacity-10 group-hover:scale-105 duration-200 transition-transform bg-cover bg-center"
                        style={{ backgroundImage: `url(${img})` }}
                      />
                    )}
                    <div className="relative z-10 w-full h-full flex flex-col justify-between">
                      <span className={`text-[8px] font-bold tracking-wider font-mono px-1 py-0.5 rounded w-max leading-none ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tag}
                      </span>
                      <span className="text-[10px] font-bold text-white line-clamp-1 leading-none mt-1">
                        {name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400 pl-2 bg-slate-900/30 py-2 px-2.5 rounded-xl border border-slate-900 mt-1">
              {currentScene.description}
            </p>
          </div>

          {/* 3050Ti防衛 ＆ VRAM リアルタイム予測シミュレータ */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">3050 Ti (4GB VRAM) 合併保護メーター</span>
              </div>
              
              {/* 保護プロトコルトグル */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={is3050TiProfile}
                  onChange={(e) => {
                    setIs3050TiProfile(e.target.checked);
                    triggerVibrate([40, 20]);
                    if (e.target.checked) {
                      setPointLimit(20000);
                      setFps(2);
                      setDenseQuality('medium');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white" />
                <span className="ml-1.5 text-[9px] font-bold font-mono text-slate-400 uppercase">
                  {is3050TiProfile ? '防衛ON' : '防衛OFF'}
                </span>
              </label>
            </div>

            {/* VRAM予測値表示 */}
            {(() => {
              const vramUsed = calculateVramPrediction();
              const vramLimit = 4.0;
              const ratio = Math.min(100, (vramUsed / vramLimit) * 100);
              
              // カラー指定
              let colorClass = 'bg-emerald-500';
              let textWarning = '安全帯：快適に変換が可能です。';
              let borderClass = 'border-emerald-950/20';
              let showRescueBtn = false;
              if (vramUsed > 3.6) {
                colorClass = 'bg-red-500 animate-pulse';
                textWarning = '危険：RTX 3050Ti 4GB でVRAMクラッシュの恐れ！解像度やFPSを下げてください。';
                borderClass = 'border-red-500/50 bg-red-950/10';
                showRescueBtn = true;
              } else if (vramUsed > 3.0) {
                colorClass = 'bg-amber-500';
                textWarning = '注意：高負荷。バックグラウンドアプリを閉じてください。';
                borderClass = 'border-amber-500/40 bg-amber-950/5';
                showRescueBtn = true;
              }

              return (
                <div className={`p-3 rounded-xl bg-slate-950/60 border ${borderClass} flex flex-col gap-2 transition-all`}>
                  <div className="flex justify-between items-end font-mono">
                    <span className="text-[10px] text-slate-500 uppercase">変換負荷予測指数</span>
                    <span className="text-xs font-bold text-white">
                      <span className="text-sm font-extrabold text-blue-400">{vramUsed} GB</span> / {vramLimit.toFixed(1)} GB
                    </span>
                  </div>

                  {/* ゲージバー */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${colorClass}`} 
                      style={{ width: `${ratio}%` }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className={`text-[9px] leading-relaxed ${vramUsed > 3.0 ? 'text-rose-300 font-medium' : 'text-slate-400'}`}>
                      {textWarning}
                      {is3050TiProfile && (
                        <span className="text-emerald-400 block font-semibold mt-0.5">
                          ※ 現在『防衛プロファイル』により最大SIFT特徴点ペアが20,000点にクランプ、さらに画像は自動ダウンサンプリングされます。
                        </span>
                      )}
                    </p>

                    {showRescueBtn && (
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={applyVramOptimization}
                        className="w-full mt-1.5 py-1.5 px-3 rounded-lg border border-red-500/30 bg-red-950/40 hover:bg-red-900/40 text-red-200 text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
                        [緊急回避] ワンクリック安全最適化を適用
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 3050Ti/混合アライメント 高度トラブルシューティングガイド */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
            <button
              onClick={() => {
                setShowTroubleshootGuide(!showTroubleshootGuide);
                triggerVibrate(20);
              }}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform duration-200" />
                <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                  VRAM 4GB制限＆混合アライメント 徹底対策ガイド
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 font-extrabold px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-900/30">
                {showTroubleshootGuide ? '閉じる ▲' : '開く ▼'}
              </span>
            </button>

            <AnimatePresence>
              {showTroubleshootGuide && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden flex flex-col gap-3 pt-1 border-t border-slate-850/60"
                >
                  {/* タブスイッチャー */}
                  <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-slate-900 shrink-0">
                    {([
                      { id: 'asa', name: '① ASA分離' },
                      { id: 'param', name: '② 4GB限界' },
                      { id: 'vmem', name: '③ 仮想メモリ' },
                      { id: 'downsample', name: '④ 間引き' }
                    ] as const).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setTroubleshootTab(tab.id as any);
                          triggerVibrate(15);
                        }}
                        className={`text-[9px] font-bold py-1 px-1 rounded transition-all leading-none ${
                          troubleshootTab === tab.id
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>

                  {/* タブ個別内容 */}
                  <div className="text-[10px] leading-relaxed text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-900/50 flex flex-col gap-2 font-sans select-text">
                    
                    {troubleshootTab === 'asa' && (
                      <div className="flex flex-col gap-1.5 animate-fade-in">
                        <div className="flex items-center gap-1 text-emerald-400 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ASA分離ワークフロー（アライメント・分離・アライメント）
                        </div>
                        <p className="text-slate-405 text-[9px] leading-relaxed">
                          360°全天球（球面モデル）とスマートフォン/通常カメラ（ピンホールモデル）を混合し、そのままMVS密度再構築を実行すると、幾何不整合により計算がクラッシュまたは破綻します。
                        </p>
                        <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 font-mono text-[9px] text-slate-300">
                          <p className="text-blue-400 font-bold">[新フェーズ3 解決手順]</p>
                          <p>1. <span className="text-emerald-400">Step A (360°分離)</span>: パノラマのみで別チャンク作成 → Sphericalでアライメント</p>
                          <p>2. <span className="text-emerald-400">Step B (単一分離)</span>: 通常写真のみで別チャンク作成 → Pinholeでアライメント</p>
                          <p>3. <span className="text-emerald-400">Step C (チャンク統合)</span>: 360°をベースに通常カメラを <span className="text-cyan-400">applyScaleTweak: true</span> にて手動/Tie-point調整しマージ</p>
                          <p>4. <span className="text-emerald-400">Step D (MVS再構築)</span>: 統合後、解像度を制限(下限)状態でMVSを実行</p>
                        </div>
                        <span className="text-[9px] text-slate-500 italic">※ Metashapeのチャンク統合機能が最も安定しておりお勧めです。</span>
                      </div>
                    )}

                    {troubleshootTab === 'param' && (
                      <div className="flex flex-col gap-1.5 animate-fade-in">
                        <div className="flex items-center gap-1 text-rose-300 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          NVIDIA RTX 3050 Ti (4GB) 限界回避パラメータ
                        </div>
                        <p className="text-slate-405 text-[9px] leading-relaxed">
                          COLMAPやMetashapeがデフォルト設定の場合、4K/8K画像処理で4GBのVRAM制限を瞬時に突き抜け、強制終了（Out of Memory）を誘発します。
                        </p>
                        
                        <div className="flex flex-col gap-1.5">
                          <span className="font-bold text-amber-300 text-[9px]">▼ Metashape(推奨設定値モデル)：</span>
                          <table className="w-full text-slate-400 text-[8px] font-mono border-collapse border border-slate-800">
                            <thead>
                              <tr className="bg-slate-900 text-[9px]">
                                <th className="border border-slate-800 p-1 text-left">設定項目</th>
                                <th className="border border-slate-800 p-1 text-left">推奨値</th>
                                <th className="border border-slate-800 p-1 text-left">効果</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-slate-800 p-1 font-bold">高密度クラウド品質</td>
                                <td className="border border-slate-800 p-1 text-emerald-400">Medium または Low</td>
                                <td className="border border-slate-800 p-1">VRAM/GPUクラッシュを大幅抑止</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-800 p-1 font-bold">高密度クラウドMVS</td>
                                <td className="border border-slate-800 p-1 text-emerald-400">Disable (CPU優先)</td>
                                <td className="border border-slate-800 p-1">GPU不足時にRAMへオフロード</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-800 p-1 font-bold">GPU CUDA</td>
                                <td className="border border-slate-800 p-1 text-rose-300">チェック解除 → OpenCL</td>
                                <td className="border border-slate-800 p-1">360°球モデル特有のCUDA競合回避</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-800 p-1 font-bold">グラボ動作ドライバ</td>
                                <td className="border border-slate-800 p-1 text-sky-400">NVIDIA Studio ドライバ</td>
                                <td className="border border-slate-800 p-1">安定性優先（Game Readyは競合多発）</td>
                              </tr>
                            </tbody>
                          </table>
                          
                          <span className="font-bold text-sky-300 mt-1 text-[9px]">▼ COLMAP CUI VRAM緊急制限コマンド：</span>
                          <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[8px] text-slate-300 overflow-x-auto whitespace-pre">
                            {"# 特徴点抽出(1200pxクランプ)\ncolmap feature_extractor --ImageReader.max_image_size 1200\n\n# マッチング制限 (VRAM 2.8GB以下)\ncolmap exhaustive_matcher --FeatureMatching.max_num_matches 8000\n\n# デンスMVS (cache大 & 画像縮小)\ncolmap patch_match_stereo --PatchMatchStereo.max_image_size 1200 --PatchMatchStereo.cache_size 7"}
                          </div>
                        </div>
                      </div>
                    )}

                    {troubleshootTab === 'vmem' && (
                      <div className="flex flex-col gap-1.5 animate-fade-in">
                        <div className="flex items-center gap-1 text-blue-300 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Windows 仮想メモリ（ページファイル）の拡張手順
                        </div>
                        <p className="text-slate-405 text-[9px] leading-relaxed">
                          MVSやバンドル調整が物理RAM/VRAMを使い切った場合、Windowsの仮想メモリ設定が「自動」または「少なすぎる」とOSごとクラッシュ（Colmap強制終了）します。手動で 16GB 以上に設定してください。
                        </p>
                        <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-sans text-[9px] text-slate-300 flex flex-col gap-1">
                          <p className="font-bold text-amber-400">【Windowsでの設定ステップ】</p>
                          <p>1. <b className="text-white">コントロール パネル</b> → <b className="text-white">システム</b> → <b className="text-white">システムの詳細設定</b> を開く。</p>
                          <p>2. 「詳細設定」タブの パフォーマンス 枠にある <b className="text-white">［設定］</b> メニュー。</p>
                          <p>3. 「詳細設定」タブ → 仮想メモリ 枠の <b className="text-white">［変更］</b> をクリック。</p>
                          <p>4. 「すべてのドライブのページングファイルのサイズを自動的に管理する」の <b className="text-amber-400">チェックを外す</b>。</p>
                          <p>5. Cドライブ等を選択し、<b className="text-white">［カスタム サイズ］</b> にチェック：</p>
                          <div className="pl-3 py-1 bg-slate-950 rounded font-mono text-[8px] border border-slate-850 mt-1">
                            <p>・初期サイズ: <span className="text-emerald-400 font-bold">8192 MB</span> (8GB)</p>
                            <p>・最大サイズ: <span className="text-emerald-400 font-bold">16000 MB</span> (16GB)</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {troubleshootTab === 'downsample' && (
                      <div className="flex flex-col gap-1.5 animate-fade-in">
                        <div className="flex items-center gap-1 text-sky-300 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          360°動画の間引き設定 ＆ セルフマスク処理
                        </div>
                        <p className="text-slate-405 text-[9px] leading-relaxed">
                          360°カメラ（Insta360等）の4K/5.7K/8K素材は情報量が膨大です。全フレームを投入すると必ずVRAMが破綻します。
                        </p>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 font-sans text-[9px] text-slate-300 flex flex-col gap-1.5">
                          <p><span className="font-bold text-amber-300">◆ 3秒間引き（FPS制限）：</span> 1秒30枚をそのまま読み込まず、<span className="text-white font-bold">「3秒間隔」</span>で間引き・間引く事前エクスポートで枚数を大幅削減します（1つのアライメントチャンクは最大500枚以下に抑えます）。</p>
                          <p><span className="font-bold text-amber-300">◆ セルフィー・マスク設定：</span> 正距円筒投影の底面に見える「自撮り棒」や「撮影者本人の手」は、動く障害（ノイズ点）となりアライメント異常、パッチマッチ失敗を巻き起こします。Metashape/COLMAPで撮影者領域に<span className="text-rose-400 font-semibold">「黒色透過マスクイメージ」</span>ファイルを作成して適用することで、その領域の特徴点検知を無視（バイパス）できます。</p>
                          <p><span className="font-bold text-amber-300">◆ 事前ダウンサンプル：</span> 8K素材は 4K(4096px) または 2K(2048px) にエクスポート段階で縮小してからSFM/MVSに入力することで効率を高められます。</p>
                        </div>
                      </div>
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 複数動画 ＆ 個別アセット管理領域 */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                2. 入力マルチアセット構成 (複数動画/写真)
              </span>
              <span className="text-[10px] font-mono text-slate-500">{assets.length} 件登録済</span>
            </div>

            {/* アセットリスト */}
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-thin">
              {assets.map((ast) => (
                <div key={ast.id} className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-850 gap-2.5 hover:border-slate-800 transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800 font-mono text-[9px] text-blue-400">
                      {ast.type === 'video_360' ? (
                        <Globe className="w-4 h-4 text-cyan-400" />
                      ) : ast.type === 'video_single' ? (
                        <Video className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Camera className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-[11px] font-bold text-slate-200 truncate leading-snug">
                        {ast.name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono uppercase">
                        {ast.type === 'video_360' ? '360° Panorama' : ast.type === 'video_single' ? 'Single Video' : 'HQ Image'}
                        {ast.duration > 0 && ` • ${ast.duration}s`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 解像度トグラー：3050Tiクラッシュ防衛 */}
                    <select
                      value={ast.resolution}
                      onChange={(e) => handleUpdateAssetResolution(ast.id, e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300 rounded px-1 py-0.5 focus:outline-none animate-none"
                    >
                      <option value="original">Original</option>
                      <option value="fhd">FHD(2K)</option>
                      <option value="hd">HD(1K)</option>
                    </select>

                    <button
                      onClick={() => handleRemoveAsset(ast.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {assets.length === 0 && (
                <div className="py-6 text-center text-[11px] text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/30">
                  アセットがありません。下のインポーターから追加してください。
                </div>
              )}
            </div>

            {/* 新規アセットの追加（パノラマ魚眼・単眼一般ビデオ／高精度スナップなど） */}
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {([
                { type: 'video_360' as const, label: '360°動画+', color: 'hover:text-cyan-400' },
                { type: 'video_single' as const, label: 'スマホ動画+', color: 'hover:text-amber-400' },
                { type: 'image_single' as const, label: '一眼写真+', color: 'hover:text-emerald-400' }
              ] as const).map(({ type, label, color }) => (
                <label
                  key={type}
                  className={`cursor-pointer bg-slate-950 border border-slate-850 py-1.5 px-2 rounded-lg text-center text-[10px] font-bold text-slate-400 hover:bg-slate-900 transition-all ${color} flex items-center justify-center gap-1`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{label}</span>
                  <input
                    type="file"
                    accept={type === 'image_single' ? 'image/*' : 'video/*'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddAsset(type, file);
                    }}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* SFM 姿勢アライメント用の調整系数 */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-500" />
                2. アライメント/3D推定パラメータ設定
              </span>
              <span className="text-[9px] font-mono text-slate-500">Android/低スペック耐性</span>
            </h3>

            {/* キーフレームFPS */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">抽出キーフレームレート</span>
                <span className="font-mono font-bold text-blue-400">{fps} fps <span className="text-[9px] text-slate-500">({fps * currentScene.cameraPath.length}枚)</span></span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={fps}
                onChange={(e) => {
                  setFps(Number(e.target.value));
                  triggerVibrate(20);
                }}
                disabled={isProcessing}
                className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[9px] text-slate-500 leading-normal">
                パノラマ動画から1秒間に何枚切り出すか。高密度ほどマッチング重なりが増えアライメントが強固になります。
              </span>
            </div>

            {/* SIFT特徴点制限 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium font-sans">画像あたりの最大特徴点(SIFT)</span>
                <span className="font-mono font-bold text-blue-400">{(pointLimit / 1000).toFixed(0)}K 点</span>
              </div>
              <input
                type="range"
                min="10000"
                max="40000"
                step="5000"
                value={pointLimit}
                onChange={(e) => {
                  setPointLimit(Number(e.target.value));
                  triggerVibrate(20);
                }}
                disabled={isProcessing}
                className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[9px] text-slate-500 leading-normal">
                特徴点抽出個数の上限制限。モバイルでのメモリバグを防ぐため25K前後の制限が黄金比です。
              </span>
            </div>

            {/* デンス品質調整 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">点群結合ノイズ・クオリティ（MVS）</span>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      triggerVibrate(20);
                      setDenseQuality(q);
                    }}
                    disabled={isProcessing}
                    className={`text-[10px] sm:text-[11px] font-bold py-1.5 rounded-lg border font-mono tracking-wider transition-colors uppercase ${
                      denseQuality === q 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-sm' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 抽出＆マッチングの実行トリガー */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col gap-3.5">
            <h4 className="text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-500" />
                4. 混合アライメント＆COLMAPマージ構築
              </span>
              {project.status === 'completed' && <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />}
            </h4>

            {/* プログレス、進捗中状態の描画 */}
            {project.status !== 'idle' && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2">
                <div className="flex justify-between text-[11px] font-mono font-bold">
                  <span className="text-blue-400">
                    {project.status === 'extracting' && '🎥 各動画・写真から対象フレームキー展開中...'}
                    {project.status === 'aligning' && '🔍 混合SIFT特徴点相関・共視Tie Pointsマッチング中...'}
                    {project.status === 'reconstructing' && '🧱 MVSフュージョン＆COLMAP合成アライメント中...'}
                    {project.status === 'completed' && '✨ 混合マージアライメント・COLMAP構築完了！'}
                  </span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${project.progress}%` }}
                    transition={{ ease: "easeInOut" }}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full"
                  />
                </div>
                {/* 物理変数の表示 */}
                <div className="grid grid-cols-2 gap-2 mt-1 xl:mt-1.5 text-[10px] font-mono border-t border-slate-850/60 pt-1.5 text-slate-400">
                  <div>切り出し総枚数: <strong className="text-white">{project.extractedFrames} 枚</strong></div>
                  <div>適合 Tie Points: <strong className="text-white">{project.matchedPoints.toLocaleString()} 点</strong></div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {project.status === 'idle' ? (
                <button
                  onClick={startReconstruction}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 text-xs sm:text-sm"
                >
                  <Cpu className="w-4.5 h-4.5" />
                  統合混合アライメント変換を開始 (VRAM保護)
                </button>
              ) : (
                <button
                  onClick={resetProject}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 px-4 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-transform active:scale-95 text-xs sm:text-sm"
                >
                  <RefreshCw className="w-4.5 h-4.5 animate-spin-slow" />
                  パラメータ変更してリスタート
                </button>
              )}
            </div>
          </div>

          {/* Gemini API撮影チャット */}
          <div className="flex-grow flex flex-col bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden h-[340px] xl:h-[380px]">
            <div className="bg-slate-900 px-3.5 py-2.5 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                全天球SFm撮影＆アライメント相談AI
              </span>
              <span className="text-[9px] font-mono text-indigo-400 uppercase bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                Gemini 3.5 API
              </span>
            </div>

            {/* チャット枠 */}
            <div className="flex-grow overflow-y-auto p-3.5 flex flex-col gap-3 h-[200px] xl:h-[240px]">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${
                      msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3.5 py-2 px-3 text-xs shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="leading-relaxed">{msg.text}</p>
                      ) : (
                        <div className="space-y-2">
                          {renderMessageContent(msg.text)}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-slate-600 mt-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}
              </AnimatePresence>
              {isChatLoading && (
                <div className="self-start flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-850">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">
                    アライメントのアドバイスを取得中...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* らくらくワンタップ入力 */}
            <div className="px-3 py-1 flex gap-1.5 overflow-x-auto border-t border-slate-900/60 bg-slate-900/30 scrollbar-none shrink-0">
              <button
                onClick={() => handleSendMessage("Insta365パノラマのアライメントがズレる時のチェック項目は？")}
                className="whitespace-nowrap text-[9px] font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 px-2.5 py-1 rounded border border-slate-850 transition-all"
              >
                アライメントエラー解決 🛠️
              </button>
              <button
                onClick={() => handleSendMessage("RealityScanで高密度メッシュ化する際のバウンズボックスの役割は？")}
                className="whitespace-nowrap text-[9px] font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 px-2.5 py-1 rounded border border-slate-850 transition-all"
              >
                バウンズボックス調整 📐
              </button>
              <button
                onClick={() => handleSendMessage("RealityScanでメッシュに穴があく・欠損するのを防ぐ方法は？")}
                className="whitespace-nowrap text-[9px] font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 px-2.5 py-1 rounded border border-slate-850 transition-all"
              >
                テクスチャ欠損対策 🧱
              </button>
            </div>

            {/* インプットフォーム */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2 bg-slate-900 border-t border-slate-905 flex gap-2 shrink-0 animate-fade-in"
            >
              <input
                type="text"
                placeholder="点群生成やRealityScan操作の連携を質問してください..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl border border-indigo-400/20 flex items-center justify-center active:scale-95 transition-all text-xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </section>

        {/* === B) 右側列：可視化 ＆ インタラクティブアライメント/COLMAPプレビュー === */}
        <section className="flex-grow w-full lg:w-[58%] xl:w-[62%] flex flex-col bg-slate-950">
          
          {/* 上部ステップ切り替えナビゲーター */}
          <div className="border-b border-slate-900 bg-slate-950 px-4 py-2 flex justify-start gap-1 sm:gap-2 overflow-x-auto scrollbar-none select-none shrink-0">
            {[
              { label: "1. 360°パノラマ映像", icon: ImageIcon, step: 0 },
              { label: "2. 特徴点アライメント", icon: Cpu, step: 1 },
              { label: "3. COLMAPエクスポート", icon: FileCode, step: 2 },
              { label: "4. RealityScan連携", icon: Smartphone, step: 3 },
              { label: "5. 3Dビューワー", icon: Eye, step: 4 }
            ].map((st, idx) => {
              const isPassed = activeStep >= st.step;
              const isCurrent = activeStep === st.step;
              const isLocked = isProcessing && st.step !== 1;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (isLocked) {
                      addLog(`[SYSTEM] アライメント/再構築 計算が進行中（現在: ${project.progress}%）のためステップ変更はロックされています。`, "warning");
                      triggerVibrate([100, 50, 100]);
                      return;
                    }
                    if (st.step > 0 && project.status === 'idle') {
                      triggerVibrate(60);
                      return;
                    }
                    triggerVibrate(20);
                    setActiveStep(st.step);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-left border text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                    isLocked
                      ? 'opacity-35 cursor-not-allowed bg-slate-950/40 border-slate-900/60 text-slate-550'
                      : isCurrent 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md' 
                        : isPassed 
                          ? 'bg-slate-900 border-blue-950/40 text-blue-400 hover:text-blue-300' 
                          : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                  disabled={isLocked}
                >
                  <st.icon className="w-3.5 h-3.5" />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* 各ステップごとの描画ビューポート */}
          <div className="flex-grow p-4 min-h-[360px] flex flex-col justify-start select-none relative bg-slate-950 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex-col flex-grow gap-4 flex"
                >
                  <div className="flex-grow min-h-[290px] sm:min-h-[350px] relative rounded-xl overflow-hidden border border-slate-900 bg-slate-900/30 flex flex-col items-center justify-center p-4">
                    {selectedSceneKey === 'custom' && customScene?.videoUrl ? (
                      <div className="absolute inset-0 w-full h-full flex flex-col justify-between bg-black">
                        <video
                          src={customScene.videoUrl}
                          className="w-full h-full object-contain"
                          controls
                          playsInline
                          autoPlay
                          muted
                          loop
                        />
                        <div className="absolute top-3 left-3 bg-black/75 border border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono font-medium text-emerald-400 flex items-center gap-1.5 pointer-events-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                          EQUIVIEW / PANORAMA MP4 ACTIVE
                        </div>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={currentScene.panoramas[0]} 
                          alt="360 Panorama equirectangular frame"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/20" />
                      </>
                    )}

                    {(!customScene || selectedSceneKey !== 'custom') && (
                      <div className="relative z-10 text-center max-w-sm flex flex-col items-center gap-3 bg-slate-950/90 [backdrop-filter:blur(10px)] p-6 rounded-2xl border border-slate-800 shadow-xl">
                        <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-400 flex items-center justify-center animate-pulse">
                          <Camera className="w-6 h-6 text-blue-450" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          Insta360 パノラマアライメント推定カメラ
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          パノラマ正距円筒図（Equirectangular）はロードされています。ジャイロのメタデータから自動水平維持（Horizon Lock）プロセスが適用されています。
                        </p>
                        <button
                          onClick={startReconstruction}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg border border-blue-400/30 w-full mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 shadow"
                        >
                          <Play className="w-4 h-4 fill-white text-white" />
                          このパノラマ映像からアライメント開始
                        </button>
                      </div>
                    )}

                    {selectedSceneKey === 'custom' && customScene?.videoUrl && (
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-slate-950/90 border border-slate-800 shadow-2xl px-5 py-3 rounded-xl flex flex-col items-center text-center gap-1.5 max-w-xs">
                        <span className="text-[10px] text-slate-500 font-mono">STEP 0 / INPUT READY</span>
                        <h4 className="text-xs font-bold text-white leading-tight font-sans">全天球動画のアライメントを計算</h4>
                        <button
                          onClick={startReconstruction}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3.5 py-2 rounded-lg border border-emerald-450/30 w-full mt-1 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          SFmトラッキング & 展開開始
                        </button>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-black/60 px-3 py-1.5 rounded-lg border border-slate-900 pointer-events-none z-10">
                      <span>歪みタイプ: 等長正方円筒投影 (360 Equirectangular)</span>
                      <span>Stitch状態: フュージョン完了</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 flex gap-3 text-xs items-start">
                    <Info className="w-5 h-5 text-indigo-405 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-white mb-0.5">全天球アライメントの仕組み (ゴッドモード・インサイト)</h5>
                      <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                        1枚の360度パノラマは強烈な歪みを持っていますが、本ツールはSFm（SfD）適合のために
                        <strong className="text-blue-400">「キューブマップ投影変換」</strong>
                        を行い、歪みのない仮想ピンホールカメラ6枚相当 of の座標パラメータを自動算出してアライメントを行います。これにより
                        <strong className="text-emerald-400">RealityScanが即座にカメラパスをロードできる仕組み</strong>
                        を構築します。
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: 特徴点マッチング進行 */}
              {activeStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full flex-grow flex flex-col gap-4"
                >
                  {/* 全体プログレス ＆ 残り作業時間 (ETA) モニター */}
                  <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl flex flex-col gap-3 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
                        <span className="text-xs font-bold text-white tracking-wide">
                          {project.status === 'extracting' ? 'フェーズ 1/3: 混合マルチカメラ映像からキーフレームを切り出し展開中...' :
                           project.status === 'aligning' ? 'フェーズ 2/3: 高倍率 SIFT DoG 特徴マッチング ＆ 共視 Tie Points 整列中...' :
                           'フェーズ 3/3: COLMAP バンドル調整 (Bundle Adjustment) ＆ 3D高密度点群フュージョン中...'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-5 text-xs font-mono shrink-0">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                          <span>予測残り時間:</span>
                          <span className="text-emerald-400 font-extrabold">{remainingEtaSeconds > 0 ? `約 ${remainingEtaSeconds} 秒` : 'まもなく処理完了'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>トータル進捗:</span>
                          <span className="text-blue-400 font-extrabold">{project.progress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 美しい進捗バー */}
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900 p-[1px] relative">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500"
                        initial={{ width: '0%' }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ ease: "easeInOut", duration: 0.3 }}
                      />
                    </div>
                  </div>

                  {/* 実時間アライメント実行ロードマップ （全9フェーズ詳細トラッキングタグ） */}
                  <div className="bg-slate-900/50 border border-slate-850 p-3 sm:p-4 rounded-xl flex flex-col gap-3 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-slate-850/40">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-white">実時間アライメント詳細実行ロードマップ</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">
                        {project.status === 'completed' ? '🎉 計算完了' : 
                         project.status === 'idle' ? '未起動' : `計算パイプライン稼働中: ${project.progress}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-1.5">
                      {getAlignmentDetailedSteps().map((step) => {
                        const isActive = step.status === 'active';
                        const isCompleted = step.status === 'completed';
                        
                        return (
                          <div 
                            key={step.id}
                            className={`flex flex-col justify-between p-2 rounded-xl border text-left transition-all relative overflow-hidden ${
                              isActive 
                                ? 'bg-indigo-950/70 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                                : isCompleted 
                                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' 
                                  : 'bg-slate-950 border-slate-900 text-slate-600'
                            }`}
                          >
                            {/* アクティブシグナル */}
                            {isActive && (
                              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400">
                                <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping" />
                              </div>
                            )}

                            <span className={`text-[8px] font-bold font-mono ${
                              isActive ? 'text-indigo-400' : isCompleted ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                            }`}>
                              {isCompleted ? '✓ 完了' : isActive ? '● 処理中' : '○ 待機'}
                            </span>

                            <div className="mt-1 flex flex-col gap-0.5">
                              <span className={`text-[9px] font-black tracking-tight leading-tight uppercase ${
                                isActive ? 'text-white' : isCompleted ? 'text-emerald-300' : 'text-slate-400'
                              }`}>
                                {step.label}
                              </span>
                              <span className="text-[8px] text-slate-500 truncate scale-90 origin-left">
                                {step.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* アライメント・3D再構築完了時の次のステップ誘導ブロック */}
                  {project.status === 'completed' && (
                    <motion.div 
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-gradient-to-r from-emerald-950/40 via-blue-950/40 to-slate-950/80 border border-emerald-500/30 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-400 animate-bounce" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                            【混合カメラアライメント完了】 3D空間への統合に成功しました！
                          </h4>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed md:max-w-xl">
                            全天球(360°)映像の基本空間スケールと、通常カメラによる詳細3D特徴点が、最適化ののち「同一の世界座標系」へマージされました。次のカメラ位置パラメータをDLするため、エクスポートに進んでください。
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          triggerVibrate([50, 30, 80]);
                          setActiveStep(2); // COLMAPエクスポート画面 (Step 2) へ
                        }}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all self-stretch md:self-auto"
                      >
                        COLMAPパラメータのエクスポート画面へ進む
                        <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                      </button>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-grow min-h-[380px]">
                    
                    {/* 左側：特徴点ビジュアルオーバーレイ */}
                    <div className="xl:col-span-7 flex flex-col gap-3 rounded-xl border border-slate-900 bg-slate-950 p-3 min-h-[280px]">
                      
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold font-mono">
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
                          空間コヴィジビリティ・プレビュー
                        </span>
                        <span>検出点: {project.matchedPoints.toLocaleString()} 点</span>
                      </div>

                      <div className="flex-grow w-full relative rounded-lg overflow-hidden border border-slate-900 bg-slate-950 flex items-center justify-center min-h-[220px]">
                        {selectedSceneKey === 'custom' && extractedImages.length > 0 ? (
                          <div className="absolute inset-0 w-full h-full flex flex-col justify-between bg-slate-950">
                            <div className="flex-grow relative overflow-hidden flex items-center justify-center">
                              <img
                                src={extractedImages[extractedImages.length - 1]}
                                alt="Captured video frame"
                                className="w-full h-full object-contain"
                              />
                              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                {Array.from({ length: 32 }).map((_, i) => {
                                  const x = (Math.sin(i * 412.5) * 0.45 + 0.5) * 100 + "%";
                                  const y = (Math.cos(i * 187.0) * 0.45 + 0.5) * 100 + "%";
                                  return (
                                    <g key={i}>
                                      <motion.circle
                                        cx={x} cy={y} r="3"
                                        fill="#10b981"
                                        stroke="#60a5fa"
                                        strokeWidth="1.2"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: [1, 1.8, 1] }}
                                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.02 }}
                                      />
                                      <line
                                        x1={x} y1={y}
                                        x2={(parseFloat(x) + (Math.sin(i) * 10)) + "%"}
                                        y2={(parseFloat(y) + (Math.cos(i) * 10)) + "%"}
                                        stroke="#10b981"
                                        strokeWidth="0.5"
                                        opacity="0.6"
                                      />
                                    </g>
                                  );
                                })}
                              </svg>
                              <div className="absolute top-2 left-2 bg-black/80 text-[9px] font-mono text-emerald-400 px-2 py-0.5 rounded border border-emerald-950 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                COMPUTING SIFT POINT: FRAME {extractedImages.length}
                              </div>
                            </div>

                            <div className="h-14 flex items-center gap-2 overflow-x-auto bg-slate-900/50 p-1 rounded-lg border border-slate-900 scrollbar-none shrink-0 min-w-0">
                              {extractedImages.map((img, idx) => (
                                <div key={idx} className="h-10 w-14 relative rounded overflow-hidden border border-slate-755 shrink-0">
                                  <img src={img} className="w-full h-full object-cover" alt={`Frame ${idx}`} />
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] font-mono text-center py-0.2 text-slate-300">
                                    #{idx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <img 
                              src={currentScene.panoramas[0] || "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&h=400&q=80"} 
                              alt="SIFT points overlay"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover opacity-25" 
                            />
                            <div className="absolute inset-0 bg-blue-950/5" />
                            
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              {project.status === 'aligning' && Array.from({ length: 48 }).map((_, i) => {
                                const x = (Math.sin(i * 354.5) * 0.5 + 0.5) * 100 + "%";
                                const y = (Math.cos(i * 123.0) * 0.5 + 0.5) * 100 + "%";
                                const x2 = (Math.sin((i + 2) * 354.5) * 0.5 + 0.5) * 100 + "%";
                                const y2 = (Math.cos((i + 2) * 123.0) * 0.5 + 0.5) * 100 + "%";
                                return (
                                  <g key={i}>
                                    <motion.line
                                      x1={x} y1={y} x2={x2} y2={y2}
                                      stroke="#3b82f6"
                                      strokeWidth="0.8"
                                      strokeDasharray="3 3"
                                      opacity={0.25}
                                      initial={{ pathLength: 0 }}
                                      animate={{ pathLength: 1 }}
                                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    />
                                    <motion.circle
                                      cx={x} cy={y} r="3"
                                      fill="#10b981"
                                      stroke="#60a5fa"
                                      strokeWidth="1.2"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: [1, 1.6, 1] }}
                                      transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.03 }}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          </>
                        )}

                        {(project.status === 'aligning' || project.status === 'reconstructing' || selectedSceneKey !== 'custom' || extractedImages.length === 0) && project.status !== 'completed' && (
                          <div className="relative z-10 bg-slate-950/95 border border-slate-800 p-5 rounded-2xl max-w-xs text-center shadow-2xl">
                            <Cpu className="w-8 h-8 text-blue-405 mx-auto animate-spin" />
                            <h4 className="text-xs sm:text-sm font-bold text-white mt-3">
                              SIFT特徴点ペア・バンドル調整中
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 pb-1.5 leading-relaxed">
                              ジャイロによる予測パス位置を起点に、各フレーム間の境界接続ピクセルの多点コヴィジビリティ（相互可視性）を算出しアライメントを実行しています。
                            </p>
                            <div className="bg-slate-900 border border-slate-850 py-1 px-2.5 rounded text-[10px] font-mono text-slate-200">
                              適合 Tie Points: {project.matchedPoints.toLocaleString()} 点
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右側：リアルタイム特徴点アライメント接続コンソール */}
                    <div className="xl:col-span-5 flex flex-col gap-3 rounded-xl border border-slate-900 bg-slate-950 p-3 min-h-[280px]">
                      
                      {/* 現在のペア進行状況 または 3D再構築進行状況 */}
                      {project.status === 'reconstructing' && reconstructInfo ? (
                        <div className="bg-slate-900/60 border border-indigo-950/80 rounded-xl p-3 flex flex-col gap-2.5 shrink-0 animate-fade-in text-slate-200">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="flex items-center gap-1.5 text-indigo-400">
                              <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                              COLMAP / MVS 3D再構築コア
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono leading-none bg-indigo-950 border border-indigo-900 text-indigo-300 animate-pulse">
                              演算処理稼働中
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-850">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-extrabold text-blue-400 font-mono tracking-wide">{reconstructInfo.phase}</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{reconstructInfo.subProgress}%</span>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-relaxed font-sans">{reconstructInfo.detail}</p>
                            
                            {/* ミニプログレスバー */}
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden p-[1px]">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full"
                                initial={{ width: "0%" }}
                                animate={{ width: `${reconstructInfo.subProgress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                            <div className="bg-slate-900/60 border border-slate-850 p-1.5 rounded flex flex-col justify-center">
                              <span className="text-slate-500 text-[8px] scale-90 origin-left">再構築3Dポイント数:</span>
                              <span className="font-extrabold text-white text-xs">{reconstructInfo.pointsTriangulated.toLocaleString()} 点</span>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-850 p-1.5 rounded flex flex-col justify-center">
                              <span className="text-slate-500 text-[8px] scale-90 origin-left">BA最適化イテレーション:</span>
                              <span className="font-extrabold text-indigo-400 text-xs">{reconstructInfo.iteration} L-M回</span>
                            </div>
                          </div>

                          {/* GPU / VRAM 擬似シグナルバー */}
                          <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono border-t border-slate-900 pt-1.5 px-0.5">
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                              RTX 3050Ti アロケーション(92%)
                            </span>
                            <div className="flex gap-0.5 items-end h-3">
                              {Array.from({ length: 8 }).map((_, i) => (
                                <motion.div 
                                  key={i} 
                                  className="w-0.5 bg-indigo-500 rounded-sm"
                                  style={{ height: '4px' }}
                                  animate={{ height: [4, i % 2 === 0 ? 10 : 7, 4] }}
                                  transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.4, delay: i * 0.04 }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : currentPair ? (
                        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 flex flex-col gap-2 shrink-0 animate-fade-in">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                              リアルタイム相関マッチング
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono leading-none ${
                              currentPair.status === 'matching' ? 'bg-blue-900/70 border border-blue-750 text-blue-400 animate-pulse' :
                              currentPair.status === 'filtering' ? 'bg-amber-950 border border-amber-900 text-amber-500' :
                              'bg-emerald-950 border border-emerald-900 text-emerald-400'
                            }`}>
                              {currentPair.status === 'matching' ? '1. 特徴点記述照合中' :
                               currentPair.status === 'filtering' ? '2. RANSACノイズ除外中' :
                               '3. アライメント合意完了'}
                            </span>
                          </div>

                          <div className="grid grid-cols-5 items-center gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                            <div className="col-span-2 text-center text-[10px] font-bold text-slate-100 truncate">
                              {currentPair.assetAName}
                            </div>
                            <div className="col-span-1 flex flex-col items-center justify-center">
                              <span className="text-[10px] font-extrabold font-mono text-blue-400 animate-pulse">⇆</span>
                              <span className="text-[7px] font-mono text-slate-500">SIFT</span>
                            </div>
                            <div className="col-span-2 text-center text-[10px] font-bold text-teal-400 truncate">
                              {currentPair.assetBName}
                            </div>
                          </div>

                          <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
                            <span>ペア適合 Tie Points:</span>
                            <span className="text-white font-extrabold">{currentPair.matchedFeatures.toLocaleString()} 点</span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/30 border border-slate-850/60 rounded-xl p-3 flex items-center justify-center text-center text-[10px] text-slate-500 shrink-0 h-[88px] border-dashed">
                          {project.status === 'idle' ? 'アライメントを開始してください。' :
                           project.status === 'extracting' ? 'フレームの切出を行っています。まもなくアライメント相関が開始されます。' :
                           '次のマージ座標ステップを適用中です...'}
                        </div>
                      )}

                      {/* リアルタイムログフィード */}
                      <div className="flex-grow flex flex-col border border-slate-900 bg-slate-950/90 rounded-xl overflow-hidden min-h-[160px]">
                        <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-900 flex justify-between items-center shrink-0">
                          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                            <FileCode className="w-3.5 h-3.5 text-blue-500" />
                            アライメント処理診断コンソール
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        {/* ログテキストスクロール */}
                        <div className="flex-grow p-2.5 font-mono text-[9px] sm:text-[10px] overflow-y-auto max-h-[180px] sm:max-h-[220px] scrollbar-thin flex flex-col gap-1.5 leading-relaxed bg-slate-950/40">
                          {alignmentLogs.map((log) => {
                            let textCol = 'text-slate-400';
                            let prefix = ' [INFO] ';
                            if (log.type === 'success') {
                              textCol = 'text-emerald-400 font-semibold';
                              prefix = ' [OK]   ';
                            } else if (log.type === 'warning') {
                              textCol = 'text-amber-500';
                              prefix = ' [WARN] ';
                            } else if (log.type === 'match') {
                              textCol = 'text-cyan-400 font-bold';
                              prefix = ' [LINK] ';
                            }

                            return (
                              <div key={log.id} className={`flex items-start gap-1 p-0.5 hover:bg-slate-900/30 rounded transition-colors ${textCol}`}>
                                <span className="opacity-45 text-[8px] tracking-wider font-semibold shrink-0 pt-0.5">{log.timestamp}</span>
                                <span className="opacity-95 tracking-wide shrink-0 font-bold">{prefix}</span>
                                <span className="break-all">{log.message}</span>
                              </div>
                            );
                          })}

                          {alignmentLogs.length === 0 && (
                            <div className="py-12 text-center text-[10px] text-slate-600 font-sans italic">
                              計算ログはアライメント実行中、ここにリアルタイムに出力されます。
                            </div>
                          )}
                          <div ref={alignmentEndRef} />
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* Step 2: COLMAPエクスポートコンポーネント */}
              {activeStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex-grow flex flex-col gap-4"
                >
                  <ColmapExporter 
                    scene={currentScene}
                    fps={fps}
                    pointLimit={pointLimit}
                    triggerVibrate={triggerVibrate}
                  />
                </motion.div>
              )}

              {/* Step 3: RealityScan / RealityCapture 連携ポータル */}
              {activeStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex-grow flex flex-col gap-4"
                >
                  <RealityScanWorkflow 
                    sceneId={selectedSceneKey}
                    triggerVibrate={triggerVibrate}
                  />
                </motion.div>
              )}

              {/* Step 4: Three.js WebGL ビューワー */}
              {activeStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  className="w-full flex-grow flex flex-col gap-3.5"
                >
                  {/* 可視化モードコントロール */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900/60 border border-slate-850 p-2.5 sm:p-3 rounded-xl">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none shrink-0 p-0.5">
                      {([
                        { mode: 'pointcloud', label: '1. 疎点群' },
                        { mode: 'wireframe', label: '2. ワイヤーメッシュ' },
                        { mode: 'textured', label: '3. フルテクスチャ' }
                      ] as const).map((vm) => (
                        <button
                          key={vm.mode}
                          onClick={() => {
                            triggerVibrate(20);
                            setViewMode(vm.mode);
                          }}
                          className={`text-[10px] sm:text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                            viewMode === vm.mode 
                              ? 'bg-blue-600 border-blue-400 text-white shadow-sm' 
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                          }`}
                        >
                          {vm.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 md:mt-0">
                      <button
                        onClick={() => {
                          triggerVibrate(20);
                          setShowCameraPath(prev => !prev);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${
                          showCameraPath 
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400' 
                            : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        <span>軌跡：{showCameraPath ? '表示' : '非表示'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3D 枠 */}
                  <div className="flex-grow w-full h-[320px] sm:h-[400px]">
                    <ThreeViewer 
                      sceneId={selectedSceneKey}
                      viewMode={viewMode}
                      showCameraPath={showCameraPath}
                      cameraPath={currentScene.cameraPath}
                      onExportObj={handleExportObjNotify}
                    />
                  </div>

                  {/* 3Dモデル補足 */}
                  <div className="bg-slate-900/40 border border-slate-850/80 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-950/40 rounded border border-indigo-900/30 flex items-center justify-center">
                        <Award className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-white font-bold block">アライメントされた3Dカメラポーズ (COLMAP反映)</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          推定された軌跡はエメラルドの軌跡線 ＋ 仮想コーン群で空間上に三次元プロットされています。
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </section>

      </main>

    </div>
  );
}
