import React, { useState } from "react";
import { 
  Compass, 
  Layers, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle, 
  BookOpen, 
  Sparkles,
  Smartphone,
  ChevronRight,
  Info
} from "lucide-react";

interface RealityScanWorkflowProps {
  sceneId: 'living_room' | 'sculpture' | 'japanese_garden';
  triggerVibrate: (pattern?: number | number[]) => void;
}

export const RealityScanWorkflow: React.FC<RealityScanWorkflowProps> = ({
  sceneId,
  triggerVibrate
}) => {
  const [activeStage, setActiveStage] = useState<number>(0);
  const [checks, setChecks] = useState<Record<string, boolean>>({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
  });

  const toggleCheck = (id: string) => {
    triggerVibrate(20);
    setChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 各ロードマップステージの定義
  const stages = [
    {
      title: "1. 360全天球パノラマ映像の変換",
      desc: "Insta365 2K/5.7K等の全天球動画からアライメント済みのフレーム（等長正方パノラマ）を、本ツールの「6面分割（Cubemap Pinhole）」にパラメータをリマッピングして、前後左右上下の6枚の平面画像（視野角90°）に切り出します。",
      advice: "直接パノラマのままRealityScanに入れると、超広角ゆえの強烈な歪み（Equirectangular）をピンホール投影エンジンが処理できず、カメラ位置が一点に融解して再構築がほぼ100%バグに陥ります。この6面分割がアライメントを完全に成功させる必須テクニックです。",
      paramTip: "切り出し比率：アスペクト比 1:1, 推奨2048x2048px, 歪み係数 radial k1=0"
    },
    {
      title: "2. COLMAPアライメントフォルダの統合",
      desc: "上記の「6面分割された切り出し画像群（計数十枚〜数百枚）」と、アライメントステップで出力された `cameras.txt`, `images.txt`, `points3D.txt` を同一の親フォルダ `/colmap_alignment` 内に作成します。",
      advice: "フォルダ構造は、最上部に `cameras.txt`, `images.txt`, `points3D.txt` を配置し、画像データは `images.txt` に記載されているファイル名（例: sculpture_frame_0_front.jpg 等）と完全に一致させる必要があります。大文字・小文字、アンダースコアのエラーにAndroid環境下では特に注意してください。",
      paramTip: "必要構成：/colmap_alignment/ (cameras.txt, images.txt, points3D.txt) ＋ 画像ファイル群"
    },
    {
      title: "3. RealityScan (またはCapture) へのインポート",
      desc: "RealityScan の左側パネルメニューから「Import COLMAP Model/Project」を選択。または RealityCaptureの場合は、ワークフロータブ内の「Import Component」からCOLMAPファイルを選択してドラッグします。",
      advice: "これにより、RealityScanがアライメント（第一段階の画像間の一致の計算）を自動で計算するプロセスを瞬時にスキップし、あらかじめ完璧に定義されたコーン位置を元画像とバインドできます。モバイルでの処理時間を大幅に節約でき、高負荷エラーを防御します。",
      paramTip: "推奨：「インポート時にカメラポーズを固定」設定にチェックを入れること。"
    },
    {
      title: "4. スマホ・Androidでの3Dメッシュ化 (MVS)",
      desc: "ボタン「MVS Mesh生成（Create High-Density Mesh）」または「点群のメッシュ化」を実行。クラウドにテクスチャマレイと点群を投影、またはローカルにて高精細なポリゴンメッシュ（数百万ポリゴン）を生成させます。",
      advice: "RealityScanは自動で頂点をクリーニングする機能があります。メッシュの抽出境界内にモデルが完全に収まるよう、境界の直方体ボックス（クリッピングバウンズ）を指先で回転・伸縮させ、土台のみ、または被写体のみが入るようにトリミング調整してください。",
      paramTip: "設定：クローズド・マテリアル・テクスチャ（4K resolution推奨、MVS Quality: High）"
    },
    {
      title: "5. Unreal Engine 5 / Blender への最適化エクスポート",
      desc: "点群とテクスチャ付きポリゴンメッシュが仕上がったら、RealityScanから直接Sketchfab経由またはローカルに「OBJ/FBX」およびテクスチャ（PNK / JPEG）として出力します。これでアライメントも取れた完璧な資産の完成です！",
      advice: "スケール補正（現実寸法へのリスケール調整）は、COLMAP上の特徴点から割り出し済みですが、Unreal EngineやBlenderに持ち込んだ際、100倍または1/100倍になっている事があるため、インポート時は「シーンのスケールに従う」か「cmスケール」に切り替えてください。",
      paramTip: "形式：.OBJ ＋ .MTL ＋ 4096px .PNG (テクスチャ)"
    }
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-5">
      
      {/* イントロダクション */}
      <div className="flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            RealityScan / RealityCapture 連携最適化ガイド
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-950 text-indigo-300 rounded border border-indigo-900/40">
              MVS対応
            </span>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Insta360などの全天球カメラ映像は、特殊な手順を踏むことで、Epic Gamesのモバイルアプリ「**RealityScan**」で極上の3D Mesh（点群・テクスチャ付きポリゴン）へ安全に再構築できます。以下のインタラクティブロードマップに従って手順を進めてください。
          </p>
        </div>
      </div>

      {/* インタラクティブ・ロードマップ (横型・縦型ブレンド) */}
      <div className="flex flex-col md:flex-row gap-4 border-t border-slate-800/80 pt-4">
        
        {/* 左側：リストステップボタン */}
        <div className="flex flex-col gap-2.5 md:w-[45%]">
          {stages.map((st, idx) => {
            const isSelected = activeStage === idx;
            return (
              <button
                key={idx}
                onClick={() => {
                  triggerVibrate(25);
                  setActiveStage(idx);
                }}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
                  isSelected 
                    ? 'bg-blue-600/10 border-blue-500 font-bold shadow-sm' 
                    : 'bg-slate-950/60 border-slate-900 hover:border-slate-800 text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  0{idx + 1}
                </div>
                <div className="flex-grow">
                  <h5 className={`text-[11px] leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {st.title.split(" ").slice(1).join(" ")}
                  </h5>
                  <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 ellipse line-clamp-1">
                    {st.desc}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform shrink-0 ${isSelected ? 'rotate-90 text-blue-400' : ''}`} />
              </button>
            );
          })}
        </div>

        {/* 右側：詳細カード */}
        <div className="flex-grow md:w-[55%] bg-slate-950/80 rounded-2xl border border-slate-850 p-4 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono font-bold text-blue-400 tracking-widest uppercase">
                Stage 0{activeStage + 1} の詳細ノウハウ
              </span>
              <BookOpen className="w-4 h-4 text-slate-500" />
            </div>

            <h5 className="text-xs font-bold text-white leading-tight">
              {stages[activeStage].title}
            </h5>

            <p className="text-xs text-slate-350 leading-relaxed">
              {stages[activeStage].desc}
            </p>

            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-850 flex gap-2.5 text-[11px] mt-1">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">全天球プロの秘訣：</strong>
                <p className="text-slate-405 leading-relaxed mt-0.5">{stages[activeStage].advice}</p>
              </div>
            </div>
          </div>

          {/* 技術的変数チップ */}
          <div className="flex gap-2 items-center bg-slate-900 border border-slate-800/60 p-2.5 rounded-lg text-[10px] font-mono text-slate-400">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>推奨パラメータ設定: <strong className="text-blue-300">{stages[activeStage].paramTip}</strong></span>
          </div>
        </div>

      </div>

      {/* 自主チェックテストボックス */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
        <h4 className="text-xs font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
            RealityScan アライメント接続チェックリスト
          </span>
          <span className="text-[10px] text-slate-500 font-mono">成功への全工程</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { id: "step1", label: "Insta360動画を6面タイル画像(Perspective)に展開した" },
            { id: "step2", label: "COLMAPの cameras, images, points3D.txt をDLした" },
            { id: "step3", label: "フォルダ内に画像ファイル名と images.txt の対応を完全一致させた" },
            { id: "step4", label: "RealityScanでCOLMAP形式プロジェクトとして正常に読み込んだ" },
            { id: "step5", label: "境界ボックス(BBox)で不要な空間をトリミングしてMVS作成に入った" }
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => toggleCheck(ch.id)}
              className="flex items-center gap-2.5 text-left p-2.5 rounded-xl border border-slate-850 hover:bg-slate-850/40 bg-slate-950/30 transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                checks[ch.id] ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-slate-900'
              }`}>
                {checks[ch.id] && <span className="text-[10px]">✔</span>}
              </div>
              <span className={`text-[10px] sm:text-[11px] leading-tight ${checks[ch.id] ? 'text-slate-350 line-through' : 'text-slate-200'}`}>
                {ch.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* よくあるエラー / トラブルシューティング */}
      <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-3 flex gap-2.5 text-[10px] leading-relaxed text-slate-400">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-red-300">⚠️【警告：RealityScanでカメラアライメントが合わない場合】</strong>
           特徴点ペア（Tie Points）が不鮮明な場合に起きる座標転化ズレが発生しています。
           Insta365のフレームレート（FPS設定）を本ツールで高く再設定(例: 2fps → 4fps)して
           キーフレームのオーバーラップ密度（重なり合い）を5%以上補填してから再構築を実行・アライメントデータを取り直してください。
        </div>
      </div>

    </div>
  );
};
