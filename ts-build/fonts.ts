import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";

go();

async function go() {
    await buildCharSet(20);
    await buildCharSet(40);
    await buildCharSet(80);
}

async function buildCharSet(size: number) {
    const chars = "0123456789.FC°";
    const wPerC = size / 2;
    const weight = 100;
    const fontSize = size;
    const defaultOpts: RenderCharOptions = {
        char: chars,
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
    chars.split("").forEach((c) => {
        const opts: RenderCharOptions = {
            ...defaultOpts,
            char: c,
            outputPath: `./Images/digits/${
                c === "." ? "p" : c
            }__${fontSize}.png`,
        };
        renderCharToPng(opts);
    });
    renderCharToPng({
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
