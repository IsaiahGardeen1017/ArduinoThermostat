import fs from "node:fs";
import { PNG } from "pngjs";


console.log('Hello World');



const imageLoc = 'Images/this-clean.png'

processPixels();


async function processPixels() {
    const buffer = await fs.readFileSync(imageLoc);
    const colorMap: Record<string, number> = {};
    const png = PNG.sync.read(buffer);
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;

            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];
            const a = png.data[idx + 3];

            const rgb = { r, g, b };

            const hash = rgbToHex(rgb);
            if (!colorMap[hash]) {
                colorMap[hash] = 1
            } else {
                colorMap[hash] = colorMap[hash] + 1;
            }
        }
    }
    const hashes = Object.keys(colorMap);
    hashes.sort((a, b) => {
        return colorMap[b] - colorMap[a];
    });

    hashes.forEach((hash) => {
        printColor(`████████ ${hash} ${colorMap[hash]}\n`, hash);
    });
}

function printColor(text: string, color: string | RGB): void {
  const rgb: RGB = typeof color === "string" ? hexToRgb(color) : color;

  process.stdout.write(
    `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`
  );
}

function rgbToHex(rgb: RGB): string {
    const toHex = (n: number): string => {
        const clamped: number = Math.max(0, Math.min(255, Math.round(n)));
        return clamped.toString(16).padStart(2, "0");
    };

    return `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

type RGB = {
    r: number;
    g: number;
    b: number;
};

function hexToRgb(hex: string): RGB {
    hex = hex.replace(/^#/, "");

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        throw new Error("Expected a 6-character hex color like ff00aa or #ff00aa");
    }

    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
}