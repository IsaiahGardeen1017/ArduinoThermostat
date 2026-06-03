#include <Arduino.h>
#include <TFT_eSPI.h>
#include "image.h"
#include "sound.h"

namespace
{
    constexpr int kBacklightPin = 4;
    constexpr int kButton1Pin = 35;
    constexpr int kButton2Pin = 0;

    constexpr int kScreenWidth = 240;
    constexpr int kScreenHeight = 135;

    int tick = 0;
    bool lastButton1Pressed = false;
    bool lastButton2Pressed = false;

    bool button1isBeingHeld = false;

    unsigned long lastScreenRefresh = 0;

    TFT_eSPI tft = TFT_eSPI();
    TFT_eSprite framebuffer = TFT_eSprite(&tft);

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
        framebuffer.pushSprite(0, 0);
    }

} // namespace

void setup()
{
    Serial.begin(115200);
    delay(250);

    pinMode(kBacklightPin, OUTPUT);
    digitalWrite(kBacklightPin, HIGH);

    pinMode(kButton1Pin, INPUT);
    pinMode(kButton2Pin, INPUT_PULLUP);

    Sound::init();

    tft.init();
    tft.setRotation(3);
    framebuffer.setColorDepth(16);
    framebuffer.createSprite(kScreenWidth, kScreenHeight);
    drawStatusScreen(0, 0, false);

    Serial.println();
    Serial.println("Booting LILYGO T-Display starter project...");
}

void loop()
{
    tick++;
    const unsigned long timestamp = millis();

    const bool button1Signal = digitalRead(kButton1Pin) == LOW;
    if (!button1isBeingHeld && button1Signal)
    {
        // Button 1 was pressed
        button1isBeingHeld = true;
        Sound::startSong(timestamp);
    }
    if (button1isBeingHeld && !button1Signal)
    {
        // Button 1 was release
        button1isBeingHeld = false;
    }

    const bool button2Signal = digitalRead(kButton2Pin) == LOW;
    Sound::update(timestamp, button1isBeingHeld);

    if (timestamp - lastScreenRefresh > 16)
    {
        // drawStatusScreen(timestamp, tick);
        lastScreenRefresh = timestamp;
    }

    drawStatusScreen(0, 0, button1isBeingHeld);

    // Serial.print("uptime=");
    // Serial.print(timestamp);
    // Serial.print("s button1=");
    // Serial.print(button1Signal ? "pressed" : "released");
    // Serial.print(" button2=");
    // Serial.println(button2Signal ? "pressed" : "released");
}
