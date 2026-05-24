import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// APIキーの取得とGeminiクライアント初期化（遅延/安全処理）
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
} catch (e) {
  console.error("Gemini APIクライアント初期化失敗:", e);
}

// 1. AI 撮影・再構築アシスタント API
app.post("/api/gemini/advice", async (req, res) => {
  const { prompt, chatHistory } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "プロンプトがありません" });
  }

  // APIキーが有効に設定されていない場合のフォールバック（ユーザー体験を維持）
  if (!ai) {
    let mockResponse = "Insta360などの全天球カメラから高品質な3Dモデルを生成するコツをお答えします！\n\n1. **重複度（オーバーラップ）**: カメラを細かく移動させ、隣り合うコマが少なくとも60〜80%重なるように撮影してください。\n2. **歩行速度と手ブレ**: ゆっくり歩き、カメラを一定の高さ（目の高さが最適）に維持します。Androidアプリ内の「手振れフィルタ」を活用すると自動でキーフレームの品質を補正できます。\n3. **照明環境**: 逆光や、極端に暗いポイントが無いか事前に確認してください。3D再構築ソフト（Metashape）は特徴点（テクスチャパッチ）のコントラストを頼りにカメラ位置を特定するため、均一な明るさが理想的です。\n\n何か具体的な機材の設定でお悩みですか？";
    
    const p = prompt.toLowerCase();
    if (p.includes("ブレ") || p.includes("ぼや")) {
      mockResponse = "カメラの手ブレや移動速度が早すぎると、再構築プロセスで「エラー」が出たり、カメラ軌跡が整合しなくなったりします。\n\n**Android端末を使用した撮影の対策:**\n- カメラ用の一脚（自撮り棒）を使用して、自分の歩行振動を吸収させます。\n- Insta360 の「FlowState手ブレ補正」動画をそのまま読み込み、フレーム抽出レートを **1秒あたり2フレーム (2 fps)** 程度に調整すると、ブレが少ないクリアな特徴点を網羅的に抽出できます。";
    } else if (p.includes("設定") || p.includes("パラメータ")) {
      mockResponse = "3D構築プロセスの推奨パラメータ詳細:\n\n- **キーフレーム抽出レート**: 1.5s〜3.0s間隔（移動が遅い場合は長く、早い場合は細かく）。\n- **特徴点抽出限界**: 40,000 点（高精度。Androidのメモリ負荷を抑えるには 15,000〜20,000 点が推奨値）。\n- **深度フィルタリング**: 中（ノイズが多い屋外は「強」、ディテールが重要な彫刻や小物は「弱」に設定します）。";
    } else if (p.includes("エクスポート") || p.includes("obj") || p.includes("書き出し")) {
      mockResponse = "Metashape 360では、生成された「点群（Point Cloud）」や「ポリゴンメッシュ（Textured Mesh）」を業界標準形式でエクスポートできます。\n\n- **OBJ / MTL (波面メッシュ)**: Blender, Unity, Unreal Engine への展開に最適。テクスチャも保持されます。\n- **PLY (点群フォーマット)**: 各頂点にカラー情報（RGBA）が格納されたシンプルな形式です。\n\n当アプリのプレビュー画面右上にある「.OBJ書き出し」ボタンから、いつでも直接スマホのダウンロードフォルダに疑似保存が可能です。";
    }

    return res.json({ text: mockResponse });
  }

  try {
    // 過去チャット履歴の構成
    const formattedHistory = (chatHistory || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    // 会話メッセージの送信
    const systemInstruction = `あなたは3Dモデリングおよび写真測量（Photogrammetry）の世界的エキスパートです。
特に「Insta360」などの全天球パノラマ魚眼カメラから「Metashape 360」のように3Dスキャンモデル（点群、メッシュ、テクスチャ）を生成する技術に極めて精通しています。
ユーザーの質問に対し、具体的、技術的、かつ初心者にも非常にわかりやすい日本語でアドバイスを返答してください。
スマートフォンやAndroidでのアプリ操作、ジャイロセンサーを活用した補正など、モバイル体験に密着した現実的な代替テクニックも適宜織り交ぜてください。
Markdown（マークダウン）を使用して見やすく構造化されたテキストを返却してください。`;

    const chatInstance = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      history: formattedHistory,
    });

    const response = await chatInstance.sendMessage({ message: prompt });
    return res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini APIエラー:", error);
    return res.status(500).json({ error: "Gemini APIの処理中にエラーが発生しました。" });
  }
});


// 2. 静的ファイルの配信 ＆ Vite統合
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPAフォールバック
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
