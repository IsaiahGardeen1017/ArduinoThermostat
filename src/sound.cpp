#include "sound.h"
#include "soundBytes.h"

namespace
{
    constexpr int buzzerPins[] = {17, 21, 22};

    int lastTone[snd_NumChannels] = {0};

    unsigned long songStart = 0;
    unsigned long timeOfCompletedNotes = 0;
    int noteIndex = 0;
} // namespace

namespace Sound
{
    void writeTone(int channel, uint32_t f)
    {
        if (lastTone[channel] != f)
        {
            ledcWriteTone(channel, f);
            lastTone[channel] = f;
        }
    }

    void startSong(unsigned long instant)
    {
        songStart = instant;
        noteIndex = 0;
        timeOfCompletedNotes = 0;

        for (int i = 0; i < snd_NumChannels; i++)
        {
            writeTone(i, snd_OdeToJoy[i + 1]);
        }
    }

    void init()
    {
        for (int i = 0; i < snd_NumChannels; i++)
        {
            ledcSetup(i, 2000, 8);
            ledcAttachPin(buzzerPins[i], i);
            writeTone(i, 0);
        }
    }

    void update(unsigned long now, bool btnHeld)
    {
        if (songStart != 0)
        {
            // We are playing a song.
            unsigned long timeSinceStart = now - songStart;
            unsigned long timeInNote = timeSinceStart - timeOfCompletedNotes;

            int currNoteIndex = noteIndex * (snd_NumChannels + 1);
            int currDuration = snd_OdeToJoy[currNoteIndex];
            if (timeInNote > currDuration)
            {
                // Go to next note
                noteIndex++;
                timeOfCompletedNotes += currDuration;
                currNoteIndex = noteIndex * (snd_NumChannels + 1);
                int snd_OdeToJoyLength = sizeof(snd_OdeToJoy) / sizeof(snd_OdeToJoy[0]);
                if (snd_OdeToJoyLength < ((noteIndex + 1) * (snd_NumChannels + 1)))
                {
                    songStart = 0;
                    noteIndex = 0;
                    timeOfCompletedNotes = 0;
                    for (int i = 0; i < snd_NumChannels; i++)
                    {
                        writeTone(i, 0);
                    }
                }
                else
                {

                    for (int i = 0; i < snd_NumChannels; i++)
                    {
                        writeTone(i, snd_OdeToJoy[currNoteIndex + i + 1]);
                    }
                }
            }
            else
            {
                // Do nothing
            }
        }

        /*
        if (btnHeld)
        {
            writeTone(0, 2500);
            writeTone(1, 2500);
            writeTone(2, 2500);
        }
        else
        {
            writeTone(0, 0);
            writeTone(1, 0);
            writeTone(2, 0);
        }
        */
    }
} // namespace Sound
