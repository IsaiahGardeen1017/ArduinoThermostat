#pragma once

#include <Arduino.h>

namespace Sound
{
    void init();
    void update(unsigned long now, bool btnHeld);
    void startSong(unsigned long instant);
} // namespace Sound
