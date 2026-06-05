import fs from "node:fs";

const odeToJoy = [
    "E3",
    "E3",
    "F3",
    "G3",

    "G3",
    "F3",
    "E3",
    "D3",

    "C3",
    "C3",
    "D3",
    "E3",

    "E3",
    "D3",
    "D3",
];

export type NoteBlock = {
    freqs: number[];
    duration: number;
};

export type FlatMidiNote = {
    startTick: number;
    endTick: number;
    midi: number;
};

const tempUpSound: NoteBlock[] = [{
    freqs: [1000, 1500],
    duration: 50,
}, {
    freqs: [2000, 2500],
    duration: 50,
}];

const tempDownSound: NoteBlock[] = [{
    freqs: [2000, 2500],
    duration: 50,
}, {
    freqs: [2000, 1500],
    duration: 50,
}, {
    freqs: [1500, 1000],
    duration: 50,
}];

buildSound();

async function buildSound() {
    const channels = 4;
    const midiPath = "./Sounds/FinlandiaCorrected.mid";

    const flatNotes = await extractFlatMidiNotes(midiPath, 0);
    const ticksPerQuarter = await readMidiTicksPerQuarter(midiPath);
    fs.writeFileSync(
        "./Sounds/FinlandiaCorrected.notes.json",
        JSON.stringify(flatNotes, null, 2),
        "utf-8",
    );

    const idumeaNoteBlocks = flatMidiNotesToNoteBlocks(
        flatNotes,
        channels,
        120,
        ticksPerQuarter,
    );
    const idumeaEspData = EspSoundArrayFromNoteBlocks(
        idumeaNoteBlocks,
        channels,
    );

    const OdeToJoyEspData = EspSoundArrayFromNoteBlocks(
        NoteBlocksFromRawNotes(odeToJoy, channels, 3),
        channels,
    );

    const rawTempUp = EspSoundArrayFromNoteBlocks(tempUpSound, channels);
    const rawTempDown = EspSoundArrayFromNoteBlocks(tempDownSound, channels);

    const fileContents = `
#pragma once
#include <Arduino.h>
    
    
constexpr uint8_t snd_NumChannels = ${channels};

constexpr uint16_t snd_OdeToJoy[] = {${OdeToJoyEspData.join(", ")}};

constexpr uint16_t snd_Idumea[] = {${idumeaEspData.join(", ")}};

constexpr uint16_t snd_tempUp[] = {${rawTempUp.join(", ")}};
constexpr uint16_t snd_tempDown[] = {${rawTempDown.join(", ")}};


`;

    fs.writeFileSync("../include/soundBytes.h", fileContents, "utf-8");
}

function NoteBlocksFromRawNotes(
    songnotes: string[],
    channels: number,
    octaveShift: number,
) {
    const freqs = songnotes.map((note) => {
        return Math.round(
            FrequencyFromMidiNum(MidiNumFromNote(note, octaveShift)),
        );
    });

    const notes: NoteBlock[] = freqs.flatMap((f) => {
        return [{
            duration: 250,
            freqs: [f],
        }, {
            duration: 250,
            freqs: [],
        }];
    });

    return notes;
}

function EspSoundArrayFromNoteBlocks(
    notes: NoteBlock[],
    numChannels: number,
): Uint16Array {
    const finalArr = new Uint16Array(notes.length * (numChannels + 1));
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        finalArr[i * (numChannels + 1)] = note.duration;
        for (let j = 0; j < numChannels; j++) {
            if (note.freqs[j]) {
                finalArr[(i * (numChannels + 1)) + j + 1] = note.freqs[j];
            } else {
                finalArr[(i * (numChannels + 1)) + j + 1] = 0;
            }
        }
    }
    return finalArr;
}

function MidiNumFromNote(note: string, octaveShift = 0): number {
    const match = note.match(/^([A-G])([#b]?)(-?\d+)$/);
    if (!match) {
        throw new Error(`Invalid note: ${note}`);
    }

    const [, letter, accidental, octaveText] = match;
    const octave = Number(octaveText) + octaveShift;

    const semitonesFromC: Record<string, number> = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11,
    };

    let noteIndex = semitonesFromC[letter];

    if (accidental === "#") noteIndex += 1;
    if (accidental === "b") noteIndex -= 1;

    return (octave + 1) * 12 + noteIndex;
}

function FrequencyFromMidiNum(midiNumber: number): number {
    return 440 * 2 ** ((midiNumber - 69) / 12);
}

async function extractFlatMidiNotes(
    filePath: string,
    noteShift: number,
): Promise<FlatMidiNote[]> {
    if (!Number.isInteger(noteShift)) {
        throw new Error("noteShift must be an integer number of semitones");
    }

    const data = await fs.promises.readFile(filePath);
    let offset = 0;

    function readString(length: number): string {
        const value = data.toString("ascii", offset, offset + length);
        offset += length;
        return value;
    }

    function readUint32(): number {
        const value = data.readUInt32BE(offset);
        offset += 4;
        return value;
    }

    function readUint16(): number {
        const value = data.readUInt16BE(offset);
        offset += 2;
        return value;
    }

    function readUint8(): number {
        const value = data.readUInt8(offset);
        offset += 1;
        return value;
    }

    function readVarInt(track: Buffer, state: { offset: number }): number {
        let value = 0;
        while (true) {
            const byte = track.readUInt8(state.offset);
            state.offset += 1;
            value = (value << 7) | (byte & 0x7f);
            if ((byte & 0x80) === 0) {
                return value;
            }
        }
    }

    if (readString(4) !== "MThd") {
        throw new Error("Invalid MIDI header chunk");
    }

    const headerLength = readUint32();
    const format = readUint16();
    const numTracks = readUint16();
    const division = readUint16();

    if (headerLength > 6) {
        offset += headerLength - 6;
    }

    if (format > 1) {
        throw new Error(`Unsupported MIDI format: ${format}`);
    }

    if (division & 0x8000) {
        throw new Error("SMPTE time division is not supported");
    }

    const flatNotes: FlatMidiNote[] = [];

    for (let trackIndex = 0; trackIndex < numTracks; trackIndex++) {
        if (readString(4) !== "MTrk") {
            throw new Error(`Invalid MIDI track chunk at index ${trackIndex}`);
        }

        const trackLength = readUint32();
        const track = data.subarray(offset, offset + trackLength);
        offset += trackLength;

        const state = { offset: 0 };
        let absoluteTick = 0;
        let runningStatus = 0;
        const activeVoiceNotes = new Map<number, Map<number, number[]>>();

        while (state.offset < track.length) {
            absoluteTick += readVarInt(track, state);

            const firstByte = track.readUInt8(state.offset);
            let status = firstByte;

            if (firstByte & 0x80) {
                state.offset += 1;
                runningStatus = status;
            } else {
                if (runningStatus === 0) {
                    throw new Error(
                        `Running status used before status byte in track ${trackIndex}`,
                    );
                }
                status = runningStatus;
            }

            if (status === 0xff) {
                runningStatus = 0;
                const metaType = track.readUInt8(state.offset);
                state.offset += 1;
                const metaLength = readVarInt(track, state);

                state.offset += metaLength;
                continue;
            }

            if (status === 0xf0 || status === 0xf7) {
                runningStatus = 0;
                const sysexLength = readVarInt(track, state);
                state.offset += sysexLength;
                continue;
            }

            const eventType = status & 0xf0;
            const midiChannel = status & 0x0f;
            if (eventType === 0x80 || eventType === 0x90) {
                const rawMidi = track.readUInt8(state.offset);
                const velocity = track.readUInt8(state.offset + 1);
                state.offset += 2;

                // Channel 10 is percussion in General MIDI; its note numbers
                // are drum IDs, not pitched notes.
                if (midiChannel === 9) {
                    continue;
                }

                const midi = rawMidi + noteShift;
                if (midi < 0 || midi > 127) {
                    continue;
                }

                const voiceId = (trackIndex << 4) | midiChannel;

                if (eventType === 0x90 && velocity > 0) {
                    let voiceActiveNotes = activeVoiceNotes.get(voiceId);
                    if (!voiceActiveNotes) {
                        voiceActiveNotes = new Map<number, number[]>();
                        activeVoiceNotes.set(voiceId, voiceActiveNotes);
                    }

                    const activeStarts = voiceActiveNotes.get(midi) ?? [];
                    activeStarts.push(absoluteTick);
                    voiceActiveNotes.set(midi, activeStarts);
                } else {
                    const voiceActiveNotes = activeVoiceNotes.get(voiceId);
                    const activeStarts = voiceActiveNotes?.get(midi);
                    if (activeStarts && activeStarts.length > 0) {
                        const startTick = activeStarts.shift()!;
                        flatNotes.push({
                            startTick,
                            endTick: absoluteTick,
                            midi,
                        });
                        if (activeStarts.length === 0) {
                            voiceActiveNotes!.delete(midi);
                        }
                        if (voiceActiveNotes && voiceActiveNotes.size === 0) {
                            activeVoiceNotes.delete(voiceId);
                        }
                    }
                }
                continue;
            }

            if (
                eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0
            ) {
                state.offset += 2;
                continue;
            }

            if (eventType === 0xc0 || eventType === 0xd0) {
                state.offset += 1;
                continue;
            }

            throw new Error(
                `Unsupported MIDI event 0x${
                    status.toString(16)
                } in track ${trackIndex}`,
            );
        }

        for (const [voiceId, voiceActiveNotes] of activeVoiceNotes.entries()) {
            void voiceId;
            for (const [midi, activeStarts] of voiceActiveNotes.entries()) {
                for (const startTick of activeStarts) {
                    flatNotes.push({
                        startTick,
                        endTick: absoluteTick,
                        midi,
                    });
                }
            }
        }
    }

    flatNotes.sort((a, b) =>
        a.startTick - b.startTick ||
        a.endTick - b.endTick ||
        a.midi - b.midi
    );

    return flatNotes;
}

async function readMidiTicksPerQuarter(filePath: string): Promise<number> {
    const data = await fs.promises.readFile(filePath);
    if (data.toString("ascii", 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header chunk");
    }

    const division = data.readUInt16BE(12);
    if (division & 0x8000) {
        throw new Error("SMPTE time division is not supported");
    }

    return division;
}

async function parseMidi(
    filePath: string,
    channels: number,
    noteShift: number,
    bpm: number,
): Promise<NoteBlock[]> {
    if (!Number.isFinite(bpm) || bpm <= 0) {
        throw new Error("bpm must be a positive number");
    }

    const noteSpans = await extractFlatMidiNotes(filePath, noteShift);
    const ticksPerQuarter = await readMidiTicksPerQuarter(filePath);
    return flatMidiNotesToNoteBlocks(noteSpans, channels, bpm, ticksPerQuarter);
}

function flatMidiNotesToNoteBlocks(
    noteSpans: FlatMidiNote[],
    channels: number,
    bpm: number,
    ticksPerQuarter: number,
): NoteBlock[] {
    const noteBlocks: NoteBlock[] = [];
    const microsecondsPerQuarter = 60_000_000 / bpm;
    const boundaryTicks = new Set<number>();
    for (const span of noteSpans) {
        if (span.endTick > span.startTick) {
            boundaryTicks.add(span.startTick);
            boundaryTicks.add(span.endTick);
        }
    }

    const sortedBoundaries = [...boundaryTicks].sort((a, b) => a - b);
    let previousSlots: Array<FlatMidiNote | null> = new Array(channels).fill(
        null,
    );

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const startTick = sortedBoundaries[i];
        const endTick = sortedBoundaries[i + 1];
        const deltaTicks = endTick - startTick;
        if (deltaTicks <= 0) {
            continue;
        }

        const activeNotes = noteSpans
            .filter((span) =>
                span.startTick <= startTick && span.endTick > startTick
            )
            .sort((a, b) =>
                a.startTick - b.startTick ||
                a.endTick - b.endTick ||
                a.midi - b.midi ||
                0
            );

        const activeByKey = new Map(
            activeNotes.map((span, index) => [
                `${span.startTick}:${span.endTick}:${span.midi}:${index}`,
                span,
            ]),
        );
        const nextSlots: Array<FlatMidiNote | null> = new Array(channels).fill(
            null,
        );

        for (let slot = 0; slot < channels; slot++) {
            const previousSpan = previousSlots[slot];
            if (!previousSpan) {
                continue;
            }

            const continuingKey = [...activeByKey.entries()].find(([, span]) =>
                span.startTick === previousSpan.startTick &&
                span.endTick === previousSpan.endTick &&
                span.midi === previousSpan.midi
            )?.[0];
            const continuingSpan = continuingKey
                ? activeByKey.get(continuingKey)
                : undefined;
            if (continuingSpan) {
                nextSlots[slot] = continuingSpan;
                activeByKey.delete(continuingKey!);
            }
        }

        for (const span of activeNotes) {
            const spanKey = [...activeByKey.entries()].find(([, candidate]) =>
                candidate.startTick === span.startTick &&
                candidate.endTick === span.endTick &&
                candidate.midi === span.midi
            )?.[0];
            if (!spanKey) {
                continue;
            }

            const emptySlot = nextSlots.findIndex((slot) => slot === null);
            if (emptySlot === -1) {
                break;
            }

            nextSlots[emptySlot] = span;
            activeByKey.delete(spanKey);
        }

        const duration = Math.round(
            (deltaTicks * microsecondsPerQuarter) / (ticksPerQuarter * 1000),
        );

        if (duration <= 0) {
            continue;
        }

        noteBlocks.push({
            duration,
            freqs: nextSlots.map((span) => {
                if (!span) {
                    return 0;
                }
                return Math.round(FrequencyFromMidiNum(span.midi));
            }),
        });
        previousSlots = nextSlots;
    }

    return noteBlocks;
}
