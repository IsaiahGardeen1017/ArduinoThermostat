import fs from "node:fs";
import { PNG } from "pngjs";

const imageLoc = "Images/this-clean.png";

buildImageHeaders();

async function buildImageHeaders() {
    const bg = await dataToWriteFromPngLocation("Images/this-clean.png");
    writeImageToCfile([bg]);
}

async function dataToWriteFromPngLocation(
    imageLoc: string,
): Promise<DataToGetWrittenToC> {
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

    return await dataToWriteToCfromTypeScriptArrays(
        colorValuesArray,
        pixelColorIndexArray,
    );
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

type DataToGetWrittenToC = {
    height: number;
    width: number;
    pixels: string;
    pallette: string;
    index: number;
    enum: string;
};

function dataToWriteToCfromTypeScriptArrays(
    palletteArr: string[],
    pixelIndexArray: number[],
): DataToGetWrittenToC {
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

    return {
        height: 135,
        width: 240,
        pixels: indexesContent,
        pallette: rgb565s,
        index: 0,
        enum: "BACKGROUND",
    };
}

function writeImageToCfile(images: DataToGetWrittenToC[]) {
    const fileContents = `
#pragma once
#include <Arduino.h>

struct ImageData
{
    uint16_t width;
    uint16_t height;
    const uint16_t *palette;
    const uint8_t *indexes;
};

enum ImageId {
    ${
        images.map((i) => {
            return `IMAGE_${i.enum}`;
        }).join(",\n")
    }
};


${
        images.map((i) => {
            return `constexpr uint16_t image${i.index}Palette[] = {${i.pallette}};
constexpr uint8_t image${i.index}Indexes[] = {${i.pixels}};\n`;
        }).join("\n")
    }


constexpr ImageData images[] = {
    ${
        images.map((i) => {
            return `{${i.width}, ${i.height}, image${i.index}Palette, image${i.index}Indexes},`;
        }).join("\n")
    }
};

`;

    fs.writeFileSync("../include/image.h", fileContents, "utf-8");
}
