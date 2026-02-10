import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const inputSvg = join(process.cwd(), "src/assets/icons/logo.svg");
const outputDir = join(process.cwd(), "src/assets/images");

async function generateIcons() {
  try {
    console.log("Generating app icons from logo.svg...");

    const svgBuffer = readFileSync(inputSvg);

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 230, g: 244, b: 254, alpha: 1 },
      })
      .png()
      .toFile(join(outputDir, "icon.png"));
    console.log("✓ Generated icon.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 230, g: 244, b: 254, alpha: 1 },
      })
      .flatten({ background: { r: 230, g: 244, b: 254 } })
      .png()
      .toFile(join(outputDir, "ios-icon-light.png"));
    console.log("✓ Generated ios-icon-light.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 20, g: 26, b: 31, alpha: 1 },
      })
      .flatten({ background: { r: 20, g: 26, b: 31 } })
      .modulate({ brightness: 1.05, saturation: 0.9 })
      .png()
      .toFile(join(outputDir, "ios-icon-dark.png"));
    console.log("✓ Generated ios-icon-dark.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toFile(join(outputDir, "splash-icon.png"));
    console.log("✓ Generated splash-icon.png (512x512)");

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 230, g: 244, b: 254, alpha: 1 },
      })
      .png()
      .toFile(join(outputDir, "android-icon-foreground.png"));
    console.log("✓ Generated android-icon-foreground.png (1024x1024)");

    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 230, g: 244, b: 254, alpha: 1 },
      },
    })
      .png()
      .toFile(join(outputDir, "android-icon-background.png"));
    console.log("✓ Generated android-icon-background.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .grayscale()
      .png()
      .toFile(join(outputDir, "android-icon-monochrome.png"));
    console.log("✓ Generated android-icon-monochrome.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .grayscale()
      .png()
      .toFile(join(outputDir, "ios-icon-tinted.png"));
    console.log("✓ Generated ios-icon-tinted.png (1024x1024)");

    await sharp(svgBuffer)
      .resize(192, 192, {
        fit: "contain",
        background: { r: 230, g: 244, b: 254, alpha: 1 },
      })
      .png()
      .toFile(join(outputDir, "favicon.png"));
    console.log("✓ Generated favicon.png (192x192)");

    console.log("\n✅ All icons generated successfully!");
  } catch (error) {
    console.error("Error generating icons:", error);
    process.exit(1);
  }
}

generateIcons();
