#include "sound.h"
#include "soundBytes.h"

namespace
{
    constexpr int buzzerPins[] = {13, 17, 21, 22};

    const uint16_t *currentSong = nullptr;
    size_t currentSongLength = 0;

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

    void silence(unsigned long now)
    {
        songStart = 0;
        noteIndex = 0;
        timeOfCompletedNotes = 0;
        for (int i = 0; i < snd_NumChannels; i++)
        {
            writeTone(i, 0);
        }
    }

    void buttonPressed(uint8_t buttonId, unsigned long now)
    {
        if (buttonId == 0)
        {
            startSong(now, 1);
        }
        else if (buttonId == 1)
        {
            startSong(now, 0);
        }
    }

    void buttonReleased(uint8_t buttonId, unsigned long now)
    {
    }

    void startSong(unsigned long instant, int song)
    {
        if (song == 0)
        {
            currentSong = snd_tempUp;
            currentSongLength = sizeof(snd_tempUp) / sizeof(snd_tempUp[0]);
        }
        else if (song == 1)
        {
            currentSong = snd_tempDown;
            currentSongLength = sizeof(snd_tempDown) / sizeof(snd_tempDown[0]);
        }

        songStart = instant;
        noteIndex = 0;
        timeOfCompletedNotes = 0;

        for (int i = 0; i < snd_NumChannels; i++)
        {
            writeTone(i, currentSong[i + 1]);
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

    void update(unsigned long now)
    {
        if (songStart != 0)
        {
            // We are playing a song.
            unsigned long timeSinceStart = now - songStart;
            unsigned long timeInNote = timeSinceStart - timeOfCompletedNotes;

            int currNoteIndex = noteIndex * (snd_NumChannels + 1);
            int currDuration = currentSong[currNoteIndex];
            if (timeInNote > currDuration)
            {
                // Go to next note
                noteIndex++;
                timeOfCompletedNotes += currDuration;
                currNoteIndex = noteIndex * (snd_NumChannels + 1);
                if (currentSongLength < ((noteIndex + 1) * (snd_NumChannels + 1)))
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
                        writeTone(i, currentSong[currNoteIndex + i + 1]);
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
