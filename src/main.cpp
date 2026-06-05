#include <Arduino.h>
#include <TFT_eSPI.h>
#include "image.h"
#include "sound.h"
#include "thermometer.h"

namespace
{
    constexpr int numButtons = 2;
    constexpr int buttonPins[] = {35, 0};
    bool buttonStates[numButtons] = {0, 0};

    int tick = 0;

    // constexpr int kButton1Pin = 35;
    // constexpr int kButton2Pin = 0;

    constexpr int kBacklightPin = 4;
    constexpr int kScreenWidth = 240;
    constexpr int kScreenHeight = 135;

    unsigned long lastScreenRefresh = 0;

    TFT_eSPI tft = TFT_eSPI();
    TFT_eSprite framebuffer = TFT_eSprite(&tft);

    int targetTemp = 70;

    uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b)
    {
        return ((r & 0xF8) << 8) |
               ((g & 0xFC) << 3) |
               (b >> 3);
    }

    uint32_t xorshift32(int seed)
    {
        uint32_t x = seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return x;
    }

    void drawStatusScreen(unsigned long secondsSinceBoot, u_int8_t tick, bool flipped)
    {
        float temp = Thermometer::getTemp();

        bool flipY = flipped;
        bool flipX = flipped;

        framebuffer.fillSprite(TFT_BLACK);

        for (int y = 0; y < imageHeight; y++)
        {
            for (int x = 0; x < imageWidth; x++)
            {
                int rX = flipX ? imageWidth - 1 - x : x;
                int rY = flipY ? imageHeight - 1 - y : y;
                int idx = rY * imageWidth + rX;
                uint8_t paletteIndex = imageIndexes[idx];
                uint16_t color = imagePalette[paletteIndex];
                framebuffer.drawPixel(x, y, color);
            }
        }
        framebuffer.setTextColor(rgb565(255, 128, 0));
        framebuffer.setTextFont(1);
        framebuffer.setTextSize(1);
        framebuffer.setCursor(10, 20);
        framebuffer.println(temp, 1);

        framebuffer.setTextColor(rgb565(0, 128, 255));
        framebuffer.setTextFont(1);
        framebuffer.setTextSize(1);
        framebuffer.setCursor(10, 60);
        framebuffer.println(targetTemp);

        framebuffer.pushSprite(0, 0);
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
    tft.init();
    tft.setRotation(3);

    pinMode(kBacklightPin, OUTPUT);
    digitalWrite(kBacklightPin, HIGH);
    framebuffer.setColorDepth(16);
    framebuffer.createSprite(kScreenWidth, kScreenHeight);
    drawStatusScreen(0, 0, false);

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

    Sound::update(timestamp);
    Thermometer::update(timestamp);

    if (timestamp - lastScreenRefresh > 16)
    {
        lastScreenRefresh = timestamp;
        drawStatusScreen(0, 0, false);
    }

    // Serial.print("uptime=");
    // Serial.print(timestamp);
    // Serial.print("s button1=");
    // Serial.print(button1Signal ? "pressed" : "released");
    // Serial.print(" button2=");
    // Serial.println(button2Signal ? "pressed" : "released");
}
