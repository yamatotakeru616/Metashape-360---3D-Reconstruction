# 360動画 ⇨ RealityScan ⇨ LichtFeld-Studio 3DGS 統合パイプライン (GUI版)

本フォルダのツール群は、360度パノラマ動画（`360動画.mp4`）からアライメント済みのCOLMAP形式データを作成し、Epic Gamesの **RealityScan CLI** (RealityCaptureエンジン) を用いて超高精度な精密アライメントを自動実行した上で、**LichtFeld-Studio** や標準的な **3DGS (3D Gaussian Splatting)** 学習パイプラインに即座にインポートできるデータを構築するための **ローカルWeb GUI付き統合自動化パッケージ** です。

Windowsのネイティブなファイルダイアログ、リアルタイム診断ログ、経過時間および残り作業時間（カウントダウン）、そして **VRAM 4GB (RTX 3050 Ti) 環境下での絶対クラッシュ防止システム** を美しいネオン調のブラウザ画面からボタン一つで管理できます。

---

## 📂 フォルダ構成

```
realityscan_3dgs_pipeline/
  ├─ Run-Pipeline.ps1       # コアPowerShell自動化スクリプト (防衛変数引数対応)
  ├─ app.js                 # Expressローカルサーバー (ログ仲介・ダイアログ起動)
  ├─ index.html             # 超極上ダークネオン Web GUI フロントエンド
  ├─ package.json           # npm依存関係および起動コマンドの定義
  ├─ run_pipeline.bat       # ワンクリックで起動・自動ブラウザ起動を行うバッチ
  └─ README.md              # 本説明書
```

---

## ⚙️ 動作に必要な前提条件

本ツールを実行する前に、以下の外部ソフトウェアがWindowsPCにインストールされている必要があります。

1. **Node.js (推奨 LTS版)**
   - GUIサーバーおよびAPIを稼働させるために必須です。[公式ウェブサイト](https://nodejs.org/) からダウンロードしインストールしてください。
2. **FFmpeg / FFprobe**
   - 360度映像の展開と6面キューブマップ仮想カメラアサインに使用します。
   - `ffmpeg` および `ffprobe` は、環境変数 PATH に登録されているか、`C:\ffmpeg\bin\` 等の一般的なパスに配置されている必要があります。
3. **Epic Games RealityScan (または RealityCapture)**
   - ヘッドレス（CLI）での精密アライメントおよび3Dメッシュ出力に使用します。
   - 通常は以下のいずれかの場所にインストールされている必要があります（自動探索されます）：
     - `C:\Program Files\Epic Games\RealityScan_2.1\RealityScan.exe`
     - `C:\Program Files\Epic Games\RealityScan\RealityScan.exe`
     - `C:\Program Files\Capturing Reality\RealityScan\RealityScan.exe`
     - `C:\Program Files\Capturing Reality\RealityCapture\RealityCapture.exe`

---

## 🚀 起動および実行手順

1. **`run_pipeline.bat` をダブルクリック**して実行します。
   - 初回起動時のみ、裏で必要なライブラリ（Express）のインストール (`npm install`) が自動で走ります（1〜2分かかります）。
2. インストール完了後、ローカルWebサーバーが自動的に起動し、お使いのデフォルトブラウザで自動的に **[http://127.0.0.1:4000](http://127.0.0.1:4000)** が開きます。
3. **Web GUIの画面から操作を行います**：
   - **アセット選択**: `① 変換する360°動画パス` の「参照」ボタンを押すと、**Windows標準のファイル選択ダイアログ** が開きますので動画（mp4等）を選びます。
   - **保存先選択**: `② アライメント出力先フォルダ` の「参照」ボタンを押し、成果物を吐き出したいフォルダを選びます。
   - **VRAM 4GB防衛モード (RTX 3050 Ti保護)**:
     - **デフォルトでON** になっています。この状態では、ビデオキーフレーム抽出枚数が最大「30枚」に自動クランプされ、画像サイズも「1024x1024px」に自動制限されることで、VRAM 4GBの制限内で絶対にブラウザやシステムをクラッシュさせずに処理を完了させます（推定GPUメモリ: 2.4 GB）。
     - OFFにすると、最大120枚の抽出スライダーや4K (4096px) の高解像度キューブマップタイルを選択できますが、予測VRAMメーターが「限界危険 (レッドネオン警告: 3.7GB〜)」を検出し、クラッシュの危険性が高まるため警告が点滅します。
4. **「パイプライン実行」ボタン**を押すと、アライメント作業が開始されます：
   - **時間計測**: `作業開始時間`（例 18:24:02）が即座に記録され、`経過時間` がタイマーカウントアップされ、設定から自動算出した `残り予想時間` (ETA) がリアルタイムでカウントダウンされます。
   - **ライブ診断コンソール**: 下部の画面に、バックグラウンドのPowerShell（FFmpeg展開プロセスおよびRealityScan CLI）のログが1行ずつリアルタイムにストリーミング表示され、自動スクロールされます。
   - **進捗バー**: 進行状況に合わせて美しいネオンブルーのプログレスバーがシームレスに増加します。

---

## 📦 出力成果物の構造

実行完了後、指定した保存先フォルダに以下の成果物が自動整理されて格納されます：

```
[保存先フォルダ]/
  ├─ images/                       # 360動画から展開された6面キューブマップ画像群
  ├─ raw_frames/                   # 展開元の生の360度（Equirectangular）フレーム画像
  ├─ colmap_initial/               # 初期仮想リグ状態のCOLMAPフォルダ
  ├─ colmap_reconstructed/         # RealityScanによって精密アライメントされた最新COLMAPフォルダ
  ├─ reconstructed_mesh.obj/.mtl   # RealityScanが生成した高密度プレビュー3Dメッシュ
  ├─ reconstructed_project.rsproj  # RealityScanプロジェクトファイル
  │
  ├─ 3dgs_ready_package.zip        # LichtFeld-Studioへ即座に持ち出せるZIP圧縮版
  └─ lichtfeld_input/              # ★【最重要】LichtFeld-Studio / 3DGSトレーニング入力フォルダ
       ├─ images/                  # 展開された全画像ファイル
       ├─ cameras.txt              # 精密アライン後のカメラパラメータ (COLMAP)
       ├─ images.txt               # 精密アライン後の画像ファイル対応姿勢 (COLMAP)
       └─ points3D.txt             # アライメントから得られたスパース3D点群
```

---

## 🎨 LichtFeld-Studio ⇨ 3DGS への取り込み・トレーニング

1. **LichtFeld-Studioの起動 ＆ ロード**
   - 新規プロジェクト（New Project）を作成し、インポート形式として **「COLMAP (Text/Sparse Sparse Reconstruction)」** を選びます。
   - 参照先フォルダとして、上記で作成された `[保存先]\lichtfeld_input` フォルダを指定します。
   - 3Dビューポート上に、360動画の軌跡に沿った美しいリグカメラ配置が自動的に展開されます。
2. **3DGS（Gaussian Splatting）トレーニングの実行**
   - Studio内の3DGSトレーニング環境を有効にします。
   - VRAM 4GB (3050 Ti) 環境下での安全な学習のため、学習反復数を最大で **`7,550` 〜 `15,000` 反復** にクランプし、背景を透過・透過なしの調整を行って `Train` を開始します。
3. **完成とビューワー展開**
   - 学習が終了したら、エクスポートメニューから **`.ply`（ガウシアン点群フォーマット）** または **`.splat`** 形式として書き出します。
   - 出力されたファイルは、Luma SplatsやThree.js等のガウシアンビューワー、各種WebVR環境で実写さながらに自由移動することが可能です！
