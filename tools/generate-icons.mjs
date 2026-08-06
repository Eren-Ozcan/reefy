// Reefy app icon üretici.
//
// Kaynak: tools/icon-src/fish-full.svg (arka plan + balık, legacy launcher ve
// mağaza ikonu için) ve tools/icon-src/fish-foreground.svg (şeffaf arka
// planlı balık, adaptive icon foreground katmanı için).
//
// Kullanım: node tools/generate-icons.mjs

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FULL_SVG = join(root, "tools/icon-src/fish-full.svg");
const FOREGROUND_SVG = join(root, "tools/icon-src/fish-foreground.svg");
const RES = join(root, "android/app/src/main/res");

const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function renderPng(svgPath, size, outPath, { flatten } = {}) {
  let pipeline = sharp(svgPath, { density: 384 }).resize(size, size);
  if (flatten) pipeline = pipeline.flatten({ background: "#3AA6B6" });
  await pipeline.png().toFile(outPath);
  console.log("wrote", outPath);
}

async function main() {
  // Android legacy launcher icons (ic_launcher / ic_launcher_round) - aynı kare görüntü,
  // OS gerektiğinde yuvarlak maske uygular.
  for (const [density, size] of Object.entries(LAUNCHER_SIZES)) {
    const dir = join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    await renderPng(FULL_SVG, size, join(dir, "ic_launcher.png"));
    await renderPng(FULL_SVG, size, join(dir, "ic_launcher_round.png"));
  }

  // Adaptive icon foreground katmanı (şeffaf arka plan, balık ortalanmış).
  for (const [density, size] of Object.entries(FOREGROUND_SIZES)) {
    const dir = join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    await renderPng(FOREGROUND_SVG, size, join(dir, "ic_launcher_foreground.png"));
  }

  // iOS app icon (opak olmalı, alfa kanalı kabul edilmiyor).
  const iosDir = join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
  mkdirSync(iosDir, { recursive: true });
  await renderPng(FULL_SVG, 1024, join(iosDir, "AppIcon-512@2x.png"), { flatten: true });

  // Play Store yüksek çözünürlüklü ikon (512x512) - gitignore'lu originals klasörü
  // + private pictures reposu.
  const storeDir = join(root, "docs/store-assets-originals");
  mkdirSync(storeDir, { recursive: true });
  await renderPng(FULL_SVG, 512, join(storeDir, "icon-512.png"), { flatten: true });

  const picturesDir = "C:/Projects/pictures/reefy";
  mkdirSync(picturesDir, { recursive: true });
  await renderPng(FULL_SVG, 512, join(picturesDir, "icon-512.png"), { flatten: true });

  console.log("Tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
