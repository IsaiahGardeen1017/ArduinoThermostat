#pragma once

#include <Arduino.h>

namespace Thermometer
{
    void init(uint8_t sdaPin = 21, uint8_t sclPin = 22, unsigned long minReadIntervalMs = 1000);
    void update(unsigned long now);

    float getTemp();
    float getHumidity();
} // namespace Thermometer
