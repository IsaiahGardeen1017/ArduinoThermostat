import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import fs from "node:fs";

const CHARSET = "0123456789.FC°-";
const CHARSET_SIZES = [40];
function charToSafeCharMapper(char: string) {
    switch (char) {
        case ".":
            return "p";
        case "°":
            return "d";
        case "-":
            return "h";
        default:
            return char;
    }
}

type DataToGetWrittenToC = {
    height: number;
    width: number;
    intensities: string;
    index: number;
    enum: string;
};

go();

export async function go() {
    await CHARSET_SIZES.forEach(async (cs) => {
        await buildCharSet(cs);
    });

    const data = await getCharPngData();
    await writeImageToCfile(data);
}

async function getCharPngData(): Promise<DataToGetWrittenToC[]> {
    const data: DataToGetWrittenToC[] = [];
    const charset = CHARSET;
    const sizes = CHARSET_SIZES;

    let count = 0;

    for (const size of sizes) {
        const chars = charset.split("");
        for (const char of chars) {
            const filename = `./Images/digits/${
                charToSafeCharMapper(char)
            }__${size}.png`;
            const buffer = await fs.readFileSync(filename);
            const png = PNG.sync.read(buffer);
            const pixelIntesityValues: number[] = [];
            for (let y = 0; y < png.height; y++) {
                for (let x = 0; x < png.width; x++) {
                    const idx = (png.width * y + x) << 2;

                    const r = png.data[idx];
                    const g = png.data[idx + 1];
                    const b = png.data[idx + 2];
                    const a = png.data[idx + 3];

                    const intensity = Math.floor(
                        (((r / 255.0) + (g / 255.0) + (b / 255.0)) / 3.0) *
                            (a / 255.0) * 255.0,
                    );
                    pixelIntesityValues.push(intensity);
                }
            }
            const charData: DataToGetWrittenToC = {
                height: png.height,
                width: png.width,
                intensities: pixelIntesityValues.join(","),
                index: count,
                enum: `CHAR_${size}_${charToSafeCharMapper(char)}`,
            };
            count++;
            data.push(charData);
        }
    }
    return data;
}

async function buildCharSet(size: number) {
    const wPerC = size / 2;
    const weight = 100;
    const fontSize = size;
    const defaultOpts: RenderCharOptions = {
        char: CHARSET,
        outputPath: `./Images/digits/all_${fontSize}.png`,
        width: wPerC,
        height: wPerC * 2,
        background: "black",
        fill: "white",
        /*
        glow: {
            color: "white",
            blur: 6,
            passes: 2,
        },
        */
        fontSize: fontSize,
        fontWeight: `${weight}`,
    };
    await CHARSET.split("").forEach(async (c) => {
        const opts: RenderCharOptions = {
            ...defaultOpts,
            char: c,
            outputPath: `./Images/digits/${
                charToSafeCharMapper(c)
            }__${fontSize}.png`,
        };
        await renderCharToPng(opts);
    });
    await renderCharToPng({
        ...defaultOpts,
        width: 240,
        height: 135,
        background: "#50aeca",
        fill: "#FFF200",
    });
}

type RenderCharOptions = {
    char: string;
    outputPath: string;

    width: number;
    height: number;

    fontPath?: string;
    fontFamily?: string;
    fontSize: number;
    fontWeight?: string;

    fill?: string;
    background?: string;

    stroke?: {
        color: string;
        width: number;
    };

    glow?: {
        color: string;
        blur: number;
        passes?: number;
    };

    yOffset?: number;
};

export async function renderCharToPng(
    options: RenderCharOptions,
): Promise<void> {
    const {
        char,
        outputPath,
        width,
        height,
        fontPath = "C:/Windows/Fonts/bahnschrift.ttf",
        fontFamily = "Bahnschrift",
        fontSize,
        fontWeight = "600",
        fill = "white",
        background = "transparent",
        stroke,
        glow,
        yOffset = 0,
    } = options;

    if (fontPath) {
        GlobalFonts.registerFromPath(fontPath, fontFamily);
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    if (background !== "transparent") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const x = width / 2;
    const y = height / 2 + yOffset;

    // Glow first, behind the actual glyph.
    if (glow) {
        ctx.save();
        ctx.fillStyle = glow.color;
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur;

        const passes = glow.passes ?? 1;
        for (let i = 0; i < passes; i++) {
            ctx.fillText(char, x, y);
        }

        ctx.restore();
    }

    // Border / outline.
    if (stroke && stroke.width > 0) {
        ctx.save();
        ctx.lineJoin = "round";
        ctx.lineWidth = stroke.width;
        ctx.strokeStyle = stroke.color;
        ctx.strokeText(char, x, y);
        ctx.restore();
    }

    // Main fill.
    ctx.fillStyle = fill;
    ctx.fillText(char, x, y);

    const png = await canvas.encode("png");
    await writeFile(outputPath, png);
}

function writeImageToCfile(chars: DataToGetWrittenToC[]) {
    const fileContents = `
#pragma once
#include <Arduino.h>

struct CharData
{
    uint16_t width;
    uint16_t height;
    const uint8_t *intensities;
};

enum CharId {
    ${
        chars.map((i) => {
            return `${i.enum}`;
        }).join(",\n")
    }
};


${
        chars.map((i) => {
            return `constexpr uint8_t char${i.index}Intensity[] = {${i.intensities}};`;
        }).join("\n")
    }


constexpr CharData chars[] = {
    ${
        chars.map((i) => {
            return `{${i.width}, ${i.height}, char${i.index}Intensity},`;
        }).join("\n")
    }
};

`;

    fs.writeFileSync("../include/chars.h", fileContents, "utf-8");
}
