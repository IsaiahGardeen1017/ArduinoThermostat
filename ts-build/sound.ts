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

buildSound();

async function buildSound() {
    const channels = 3;
    const channelShift = 3;
    const freqs = odeToJoy.map((note) => {
        return Math.round(
            FrequencyFromMidiNum(MidiNumFromNote(note, channelShift)),
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

    console.log(notes);
    const EspData = EspSoundArrayFromNotBlocks(notes, channels);
    console.log(EspData);

    const fileContents = `
#pragma once
#include <Arduino.h>
    
    
constexpr uint8_t snd_NumChannels = ${channels};
    
constexpr uint16_t snd_OdeToJoy[] = {${EspData.join(", ")}};
`;

    fs.writeFileSync("../include/soundBytes.h", fileContents, "utf-8");

    console.log(freqs);
}

function EspSoundArrayFromNotBlocks(
    notes: NoteBlock[],
    numChannels: number,
): Uint16Array {
    const finalArr = new Uint16Array(notes.length * (numChannels + 1));
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        console.log(note);
        console.log(i * (numChannels + 1));
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
