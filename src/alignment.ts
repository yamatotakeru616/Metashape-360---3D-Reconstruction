import { InputAsset } from "./types";

export interface AlignmentPair {
  a: string;
  b: string;
  finalPts: number;
}

const MIN_VIDEO_FRAMES = 4;
const EXTRACTION_SECONDS_PER_FRAME = 0.2;
const PAIR_STEPS = 4;
const PAIR_STEP_SECONDS = 0.4;
const RECONSTRUCTION_STEPS = 5;
const ESTIMATE_BUFFER_SECONDS = 3;

export function getEffectiveFps(fps: number, is3050TiProfile: boolean) {
  return is3050TiProfile ? Math.min(fps, 3) : fps;
}

export function getFrameCountForAsset(asset: InputAsset, fps: number, is3050TiProfile: boolean) {
  if (asset.type === "image_single") return 1;
  const effectiveFps = getEffectiveFps(fps, is3050TiProfile);
  return Math.max(MIN_VIDEO_FRAMES, Math.floor(asset.duration * effectiveFps));
}

export function getTotalFrameCount(assets: InputAsset[], fps: number, is3050TiProfile: boolean) {
  return assets.reduce(
    (total, asset) => total + getFrameCountForAsset(asset, fps, is3050TiProfile),
    0
  );
}

export function estimateAlignmentSeconds(assets: InputAsset[], fps: number, is3050TiProfile: boolean) {
  const totalFrames = getTotalFrameCount(assets, fps, is3050TiProfile);
  const pairCount = Math.max(1, getPairCount(assets.length));
  const extractTime = totalFrames * EXTRACTION_SECONDS_PER_FRAME;
  const pairTime = pairCount * PAIR_STEPS * PAIR_STEP_SECONDS;
  const reconTime = RECONSTRUCTION_STEPS * PAIR_STEP_SECONDS;

  return Math.ceil(extractTime + pairTime + reconTime + ESTIMATE_BUFFER_SECONDS);
}

export function buildAlignmentPairs(assets: InputAsset[], pointLimit: number): AlignmentPair[] {
  if (assets.length < 2) {
    const asset = assets[0];
    const seedName = asset?.name || "メイン動画";
    return [
      {
        a: seedName,
        b: "推定ベースカメラパス",
        finalPts: estimateFeatureMatches(seedName, "推定ベースカメラパス", asset?.type || "video_360", pointLimit)
      }
    ];
  }

  const pairs: AlignmentPair[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      pairs.push({
        a: assets[i].name,
        b: assets[j].name,
        finalPts: estimateFeatureMatches(assets[i].name, assets[j].name, `${assets[i].type}:${assets[j].type}`, pointLimit)
      });
    }
  }

  return pairs;
}

function getPairCount(assetCount: number) {
  if (assetCount < 2) return 1;
  return (assetCount * (assetCount - 1)) / 2;
}

function estimateFeatureMatches(nameA: string, nameB: string, pairType: string, pointLimit: number) {
  const seed = hashString(`${nameA}|${nameB}|${pairType}`);
  const typeBonus = pairType.includes("video_360") ? 180 : 0;
  const detailBonus = pairType.includes("image_single") ? 120 : 0;
  const limitScale = Math.max(0.55, Math.min(1.35, pointLimit / 20000));
  const base = 620 + (seed % 620) + typeBonus + detailBonus;

  return Math.round(base * limitScale);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
