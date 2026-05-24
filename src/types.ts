/**
 * Metashape 360 - 型定義ファイル
 */

export interface InputAsset {
  id: string;
  name: string;
  type: 'video_360' | 'video_single' | 'image_single';
  file: File | null;
  url: string;       // ObjectURL またはデモ用プレースホルダー
  duration: number;  // 動画の場合の秒数（画像は0）
  frameCount: number; // 解析に使用する予定のフレーム数
  resolution: 'original' | 'fhd' | 'hd'; // 3050Ti/モバイル VRAMクラッシュ保護
  extractedImages: string[]; // 抽出されたベース64画像、あるいはサンプルフレーム
}

export interface Project {
  id: string;
  name: string;
  type: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge';
  status: 'idle' | 'extracting' | 'aligning' | 'reconstructing' | 'completed' | 'error';
  extractedFrames: number;
  matchedPoints: number;
  progress: number; // 0 - 100
  createdAt: string;
  settings: {
    fps: number; // 抽出フレーム数/秒
    pointLimit: number; // 特徴点制限
    denseQuality: 'low' | 'medium' | 'high';
    is3050TiProfile: boolean; // 3050 Ti VRAM保護モード
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface AlignmentLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'match';
}

export interface MatchingPairState {
  assetAName: string;
  assetBName: string;
  matchedFeatures: number;
  status: 'matching' | 'filtering' | 'solved';
}

export interface SampleScene {
  id: 'living_room' | 'sculpture' | 'japanese_garden' | 'custom' | 'hybrid_merge';
  name: string;
  description: string;
  panoramas: string[]; // 360パノラマ画像URL
  videoPlaceholder: string; // 疑似ビデオ用サムネイル
  pointsCount: number;
  facesCount: number;
  generatePoints?: () => { pos: [number, number, number], color: [number, number, number] }[];
  generateMesh?: () => { vertices: Float32Array, normals: Float32Array, colors: Float32Array, indices?: Uint16Array };
  cameraPath: [number, number, number][]; // 撮影時のカメラ軌跡。
  videoUrl?: string; // アップロードされた動画のオブジェクトURL
  extractedFrameUrls?: string[]; // 実際に生成または抽出されたフレーム画像のURLリスト
  videoFileName?: string; // 読み込まれたローカルファイル名称
  videoDuration?: number; // 動画の秒数
}

