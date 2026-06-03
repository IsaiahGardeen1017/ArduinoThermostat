import fs from "node:fs";
import { PNG } from "pngjs";

const imageLoc = "Images/this-clean.png";

buildImageHeaders();

async function buildImageHeaders() {
    const buffer = await fs.readFileSync(imageLoc);
    const colorMap: Record<string, number> = {};
    const colorIndexMap: Record<string, number> = {};
    const png = PNG.sync.read(buffer);
    let orderingIndex = 0;
    const pixelColorIndexArray: number[] = [];
    const hashArray: string[] = [];
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;

            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];
            const a = png.data[idx + 3];

            const rgb = { r, g, b };

            const hash = rgbToHex(rgb);
            if (colorIndexMap[hash] === undefined) {
                colorMap[hash] = 1;

                colorIndexMap[hash] = orderingIndex;
                orderingIndex++;

                hashArray.push(hash);
            } else {
                colorMap[hash] = colorMap[hash] + 1;
            }

            pixelColorIndexArray.push(colorIndexMap[hash]);
        }
    }

    //Print color info
    hashArray.forEach((hash) => {
        printColor(
            `████████ ${hash} (${colorIndexMap[hash]}) ${colorMap[hash]}\n`,
            hash,
        );
    });

    const colorValuesArray = [];
    for (let i = 0; i < hashArray.length; i++) {
        colorValuesArray.push(hashArray[i]);
    }

    writeImageToCfile(colorValuesArray, pixelColorIndexArray);
    0;
}

function printColor(text: string, color: string | RGB): void {
    const rgb: RGB = typeof color === "string" ? hexToRgb(color) : color;

    process.stdout.write(
        `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`,
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
        throw new Error(
            "Expected a 6-character hex color like ff00aa or #ff00aa",
        );
    }

    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
}

function rgb565(rgb: RGB): number {
    return ((rgb.r & 0xf8) << 8) | ((rgb.g & 0xfc) << 3) | (rgb.b >> 3);
}

function writeImageToCfile(palletteArr: string[], pixelIndexArray: number[]) {
    const indexRows = [];
    let currRow = [];
    for (let i = 0; i < pixelIndexArray.length; i++) {
        currRow.push(pixelIndexArray[i]);
        if (currRow.length >= 240) {
            indexRows.push(`    ${currRow.join(", ")},`);
            currRow = [];
        }
    }
    if (currRow.length > 0) {
        throw "Somethign is wrong";
    }
    const indexesContent = indexRows.join("\n");

    const rgb565s = palletteArr.map((col) => rgb565(hexToRgb(col))).join(",");

    const fileContents = `
#pragma once
#include <Arduino.h>

constexpr uint16_t imageWidth = 240;
constexpr uint16_t imageHeight = 135;

constexpr uint16_t imagePalette[] = {
    ${rgb565s}
};

constexpr uint8_t imageIndexes[] = {
${indexesContent}
};
    `;

    fs.writeFileSync("../include/image.h", fileContents, "utf-8");
}
