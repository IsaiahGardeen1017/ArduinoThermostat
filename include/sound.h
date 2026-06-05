#pragma once

#include <Arduino.h>

namespace Sound
{
    void init();
    void update(unsigned long now);
    void startSong(unsigned long instant, int song);
    void silence(unsigned long now);
    void buttonPressed(uint8_t buttonId, unsigned long now);
    void buttonReleased(uint8_t buttonId, unsigned long now);
} // namespace Sound
