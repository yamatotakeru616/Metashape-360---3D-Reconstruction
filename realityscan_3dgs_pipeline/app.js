import express from "express";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000; // 重複を避けるため4000ポートを使用

app.use(express.json());
app.use(express.static(__dirname));

// PowerShellダイアログ起動ヘルパー
function runPowerShellDialog(script) {
  const tmpFile = path.join(os.tmpdir(), `dialog_${Date.now()}.ps1`);
  // UTF-8 BOM + UTF-8出力強制を先頭に付与して保存
  const utf8Header = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n";
  fs.writeFileSync(tmpFile, "\uFEFF" + utf8Header + script, "utf8"); // UTF-8 with BOM
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pwsh",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", tmpFile],
      {
        cwd: process.cwd(),
        windowsHide: false, // GUIダイアログを表示するため必須
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => { try { fs.unlinkSync(tmpFile); } catch {} reject(err); });
    child.on("close", (code) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (code === 0 || (code === 1 && !stderr.trim())) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`PowerShell Dialog Error (code=${code}): ${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}

// 1. ビデオ選択ダイアログ API
app.post("/api/pick-video", async (req, res) => {
  try {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      "$dialog.Filter = 'Video Files (*.mp4;*.mov;*.mkv;*.avi)|*.mp4;*.mov;*.mkv;*.avi|All Files (*.*)|*.*'",
      "$dialog.Multiselect = $false",
      "$dialog.CheckFileExists = $true",
      "$dialog.Title = '360度パノラマ映像(MP4等)を選択してください'",
      "$owner = New-Object System.Windows.Forms.Form",
      "$owner.TopMost = $true",
      "$owner.ShowInTaskbar = $false",
      "$null = $owner.Handle",
      "$result = $dialog.ShowDialog($owner)",
      "$owner.Dispose()",
      "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }",
    ].join("\n");

    const selectedPath = await runPowerShellDialog(script);
    res.json({ path: selectedPath || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. フォルダ選択ダイアログ API
app.post("/api/pick-folder", async (req, res) => {
  try {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'アライメントデータの保存先フォルダーを選択してください'",
      "$dialog.ShowNewFolderButton = $true",
      "$owner = New-Object System.Windows.Forms.Form",
      "$owner.TopMost = $true",
      "$owner.ShowInTaskbar = $false",
      "$null = $owner.Handle",
      "$result = $dialog.ShowDialog($owner)",
      "$owner.Dispose()",
      "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
    ].join("\n");

    const selectedPath = await runPowerShellDialog(script);
    res.json({ path: selectedPath || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. パイプライン実行ログストリーミング (Server-Sent Events)
app.get("/api/run-pipeline", (req, res) => {
  const { videoPath, outputDir, frameCount, imageSize } = req.query;

  if (!videoPath) {
    return res.status(400).json({ error: "videoPath が指定されていません。" });
  }

  // SSEヘッダーを設定
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const psScriptPath = path.join(__dirname, "Run-Pipeline.ps1");

  // 日本語パスの文字化け回避: コマンドライン引数でなく環境変数経由でパスを渡す
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    psScriptPath,
    "-FrameCount", String(frameCount || "40"),
    "-ImageSize",  String(imageSize || "1600"),
  ];

  sendEvent("status", { message: "PowerShellプロセスを起動しています..." });

  const psProcess = spawn("pwsh", args, {
    cwd: __dirname,
    windowsHide: true,
    env: {
      ...process.env,
      PIPELINE_VIDEO_PATH: videoPath,
      PIPELINE_OUTPUT_DIR: outputDir || "",
    },
  });

  let logBuffer = "";

  const handleData = (data) => {
    logBuffer += data.toString();
    const lines = logBuffer.split(/\r?\n/);
    logBuffer = lines.pop(); // 未完成の最後の行をバッファに残す
    for (const line of lines) {
      if (line.trim()) {
        sendEvent("log", { message: line });
      }
    }
  };

  psProcess.stdout.on("data", handleData);
  psProcess.stderr.on("data", handleData);

  psProcess.on("error", (err) => {
    sendEvent("error", { message: `起動エラー: ${err.message}` });
    res.end();
  });

  psProcess.on("close", (code) => {
    // 残りのバッファを出力
    if (logBuffer.trim()) {
      sendEvent("log", { message: logBuffer });
    }

    if (code === 0) {
      sendEvent("complete", { message: "すべてのパイプライン処理が正常に完了しました！🎉" });
    } else {
      sendEvent("error", { message: `プロセスが終了コード ${code} で異常終了しました。` });
    }
    res.end();
  });

  // クライアント切断時のハンドラ
  req.on("close", () => {
    psProcess.kill();
  });
});

// 静的 SPA フォールバック
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`   360動画 ⇨ 3DGS 統合 Web GUI サーバー起動完了`);
  console.log(`=========================================================`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`=========================================================\n`);

  // ブラウザ自動起動
  const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(startCmd, [`http://localhost:${PORT}`], { shell: true });
});
