#include <Arduino.h>

#include "sound.h"
#include "thermometer.h"
#include "display.h"

namespace
{
    constexpr int numButtons = 2;
    constexpr int buttonPins[] = {35, 0};
    bool buttonStates[numButtons] = {0, 0};

    int tick = 0;

    // constexpr int kButton1Pin = 35;
    // constexpr int kButton2Pin = 0;

    int targetTemp = 70;
    int lastTimeCheckedTemp = 0;

    uint32_t xorshift32(int seed)
    {
        uint32_t x = seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return x;
    }

} // namespace

void setup()
{
    Serial.begin(115200);
    delay(250);

    pinMode(buttonPins[0], INPUT);
    pinMode(buttonPins[1], INPUT_PULLUP);

    Sound::init();
    Thermometer::init();
    Display::init();

    Serial.println();
    Serial.println("Yongo Plongo");
}

void loop()
{
    tick++;
    const unsigned long timestamp = millis();

    for (int i = 0; i < numButtons; i++)
    {
        const bool signal = digitalRead(buttonPins[i]) == LOW;
        if (!buttonStates[i] && signal)
        {
            // Button pressed
            buttonStates[i] = true;
            Sound::buttonPressed(i, timestamp);
            if (i == 0)
            {
                targetTemp--;
            }
            else if (i == 1)
            {
                targetTemp++;
            }
        }
        if (buttonStates[i] && !signal)
        {
            // Button released
            buttonStates[i] = false;
            Sound::buttonReleased(i, timestamp);
        }
    }

    if ((lastTimeCheckedTemp + 2000) < timestamp)
    {
        float temp = Thermometer::getTemp();
        Display::updateIndoorTemp(temp);
        lastTimeCheckedTemp = timestamp;
    }

    Sound::update(timestamp);
    Thermometer::update(timestamp);
    Display::update(timestamp);

    // Serial.print("uptime=");
    // Serial.print(timestamp);
    // Serial.print("s button1=");
    // Serial.print(button1Signal ? "pressed" : "released");
    // Serial.print(" button2=");
    // Serial.println(button2Signal ? "pressed" : "released");
}
