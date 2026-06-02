#include <Arduino.h>
#include <TFT_eSPI.h>

namespace
{
    constexpr int kBacklightPin = 4;
    constexpr int kButton1Pin = 35;
    constexpr int kButton2Pin = 0;

    constexpr int kBuzzer1Pin = 17;
    constexpr int kBuzzer2Pin = 21;
    constexpr int kBuzzer3Pin = 22;

    constexpr int kBuzzerChannel1 = 0;
    constexpr int kBuzzerChannel2 = 1;
    constexpr int kBuzzerChannel3 = 2;

    constexpr int kScreenWidth = 240;
    constexpr int kScreenHeight = 135;
    constexpr unsigned long kBeepDurationMs = 120;

    unsigned long channel1EndTime = 0;
    unsigned long channel2EndTime = 0;
    unsigned long channel3EndTime = 0;

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

    void renderPixel(int i, int j)
    {
        int seed = (((i * kScreenWidth) + j) * 3) + tick;
        framebuffer.drawPixel(i, j, rgb565(xorshift32(seed), 0, xorshift32(seed + 2)));
    }

    void drawStatusScreen(unsigned long secondsSinceBoot, bool button1Pressed, bool button2Pressed, u_int8_t tick)
    {
        framebuffer.fillSprite(TFT_BLACK);
        for (int i = 0; i < kScreenWidth; i++)
        {
            for (int j = 0; j < kScreenHeight; j++)
            {
                renderPixel(i, j);
            }
        }

        framebuffer.pushSprite(0, 0);
    }

    void buzzerOn(int channel, uint32_t frequencyHz)
    {
        ledcWriteTone(channel, frequencyHz);
    }

    void buzzerOff(int channel)
    {
        ledcWriteTone(channel, 0);
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

    ledcSetup(kBuzzerChannel1, 2000, 8);
    ledcSetup(kBuzzerChannel2, 2000, 8);
    ledcSetup(kBuzzerChannel3, 2000, 8);
    ledcAttachPin(kBuzzer1Pin, kBuzzerChannel1);
    ledcAttachPin(kBuzzer2Pin, kBuzzerChannel2);
    ledcAttachPin(kBuzzer3Pin, kBuzzerChannel3);
    ledcWriteTone(kBuzzerChannel1, 0);
    ledcWriteTone(kBuzzerChannel2, 0);
    ledcWriteTone(kBuzzerChannel3, 0);

    buzzerOn(kBuzzerChannel3, 1750);

    tft.init();
    tft.setRotation(1);
    framebuffer.setColorDepth(16);
    framebuffer.createSprite(kScreenWidth, kScreenHeight);

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
        buzzerOn(kBuzzerChannel1, 1500);
        channel1EndTime = timestamp + 250;
        button1isBeingHeld = true;
    }
    if (button1isBeingHeld && !button1Signal)
    {
        // Button 1 was release
        buzzerOn(kBuzzerChannel2, 2000);
        channel2EndTime = timestamp + 250;
        button1isBeingHeld = false;
    }

    const bool button2Signal = digitalRead(kButton2Pin) == LOW;

    if (timestamp > channel1EndTime)
    {
        buzzerOff(kBuzzerChannel1);
    }
    if (timestamp > channel2EndTime)
    {
        buzzerOff(kBuzzerChannel2);
    }

    if (lastScreenRefresh > timestamp - 16)
    {
        drawStatusScreen(timestamp, button1Signal, button2Signal, tick);
        lastScreenRefresh = timestamp;
    }

    // Serial.print("uptime=");
    // Serial.print(timestamp);
    // Serial.print("s button1=");
    // Serial.print(button1Signal ? "pressed" : "released");
    // Serial.print(" button2=");
    // Serial.println(button2Signal ? "pressed" : "released");
}
