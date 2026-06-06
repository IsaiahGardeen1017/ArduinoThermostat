#pragma once

#include <Arduino.h>

namespace Display
{
    void init();
    void update(unsigned long instant);

    void updateIndoorTemp(float newTemp);
    void updateSetTemp(int newTemp);
} // namespace Display
