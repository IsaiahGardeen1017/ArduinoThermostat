#include <Arduino.h>
#include <TFT_eSPI.h>
#include <Wire.h>
#include "image.h"
#include "chars.h"

namespace
{
    int setTemp = 0;
    float indoorTemp = 0;

    TFT_eSPI tft = TFT_eSPI();
    TFT_eSprite framebuffer = TFT_eSprite(&tft);

    constexpr int kBacklightPin = 4;
    constexpr int kScreenWidth = 240;
    constexpr int kScreenHeight = 135;

    unsigned long lastScreenRefresh = 0;

    uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b)
    {
        return ((r & 0xF8) << 8) |
               ((g & 0xFC) << 3) |
               (b >> 3);
    }

    uint16_t blendRgb565(uint16_t background, uint16_t foreground, uint8_t alpha)
    {
        if (alpha == 0)
        {
            return background;
        }
        if (alpha == 255)
        {
            return foreground;
        }

        const uint8_t bgR = ((background >> 11) & 0x1F) << 3;
        const uint8_t bgG = ((background >> 5) & 0x3F) << 2;
        const uint8_t bgB = (background & 0x1F) << 3;

        const uint8_t fgR = ((foreground >> 11) & 0x1F) << 3;
        const uint8_t fgG = ((foreground >> 5) & 0x3F) << 2;
        const uint8_t fgB = (foreground & 0x1F) << 3;

        const uint16_t invAlpha = 255 - alpha;
        const uint8_t outR = (fgR * alpha + bgR * invAlpha) / 255;
        const uint8_t outG = (fgG * alpha + bgG * invAlpha) / 255;
        const uint8_t outB = (fgB * alpha + bgB * invAlpha) / 255;

        return rgb565(outR, outG, outB);
    }

    void drawCharacterToFrameBuffer(CharId c, int x, int y, uint16_t color)
    {
        const CharData &characterData = chars[c];
        for (int localY = 0; localY < characterData.height; localY++)
        {
            for (int localX = 0; localX < characterData.width; localX++)
            {
                const int idx = localY * characterData.width + localX;
                uint8_t intensity = characterData.intensities[idx];
                if (intensity == 0)
                {
                    continue;
                }

                const int screenX = x + localX;
                const int screenY = y + localY;
                if (screenX < 0 || screenX >= kScreenWidth || screenY < 0 || screenY >= kScreenHeight)
                {
                    continue;
                }

                const uint16_t background = framebuffer.readPixel(screenX, screenY);
                const uint16_t blended = blendRgb565(background, color, intensity);
                framebuffer.drawPixel(screenX, screenY, blended);
            }
        }
    }
} // namespace

namespace Display
{

    void updateIndoorTemp(float newTemp)
    {
        indoorTemp = newTemp;
    }
    void updateSetTemp(int newTemp)
    {
        setTemp = newTemp;
    }

    void init()
    {
        tft.init();
        tft.setRotation(3);

        pinMode(kBacklightPin, OUTPUT);
        digitalWrite(kBacklightPin, HIGH);
        framebuffer.setColorDepth(16);
        framebuffer.createSprite(kScreenWidth, kScreenHeight);
    }

    void update(unsigned long instant)
    {

        if (instant - lastScreenRefresh <= 16)
        {
            lastScreenRefresh = instant;
            return;
        }

        framebuffer.fillSprite(TFT_BLACK);

        const ImageData &bgimage = images[IMAGE_BACKGROUND];

        for (int y = 0; y < bgimage.height; y++)
        {
            for (int x = 0; x < bgimage.width; x++)
            {
                int idx = y * bgimage.width + x;
                uint8_t paletteIndex = bgimage.indexes[idx];
                uint16_t color = bgimage.palette[paletteIndex];
                framebuffer.drawPixel(x, y, color);
            }
        }
        framebuffer.setTextColor(rgb565(255, 128, 0));
        framebuffer.setTextFont(1);
        framebuffer.setTextSize(2);
        framebuffer.setCursor(20, 20);
        framebuffer.println(indoorTemp, 1);

        uint16_t color = rgb565(200, 100, 100);
        drawCharacterToFrameBuffer(CHAR_40_7, 40, 40, color);
        drawCharacterToFrameBuffer(CHAR_40_2, 60, 40, color);
        drawCharacterToFrameBuffer(CHAR_40_p, 80, 40, color);
        drawCharacterToFrameBuffer(CHAR_40_5, 100, 40, color);
        drawCharacterToFrameBuffer(CHAR_40_d, 120, 40, color);
        drawCharacterToFrameBuffer(CHAR_40_F, 140, 40, color);
        framebuffer.pushSprite(0, 0);
    }
} // namespace Display
