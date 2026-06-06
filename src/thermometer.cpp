#include "thermometer.h"

#include <Wire.h>

namespace
{
    constexpr uint8_t kCandidateAddresses[] = {0x44, 0x45, 0x46};
    constexpr uint8_t kCommandMeasureHighPrecision = 0xFD;
    constexpr uint8_t kCommandSoftReset = 0x94;
    constexpr unsigned long kMeasurementTimeMs = 10;
    constexpr unsigned long kDefaultMinReadIntervalMs = 1000;

    TwoWire &wire = Wire;

    bool initialized = false;
    bool sensorConnected = false;
    bool sampleAvailable = false;

    uint8_t activeAddress = 0x44;
    uint8_t activeSdaPin = 21;
    uint8_t activeSclPin = 22;
    unsigned long readIntervalMs = kDefaultMinReadIntervalMs;
    unsigned long lastReadAt = 0;

    float lastTempC = NAN;
    float lastHumidity = NAN;

    uint8_t crc8(const uint8_t *data, size_t len)
    {
        uint8_t crc = 0xFF;
        for (size_t i = 0; i < len; i++)
        {
            crc ^= data[i];
            for (uint8_t bit = 0; bit < 8; bit++)
            {
                if ((crc & 0x80) != 0)
                {
                    crc = static_cast<uint8_t>((crc << 1) ^ 0x31);
                }
                else
                {
                    crc <<= 1;
                }
            }
        }

        return crc;
    }

    bool sendCommand(uint8_t address, uint8_t command)
    {
        wire.beginTransmission(address);
        wire.write(command);
        return wire.endTransmission() == 0;
    }

    bool probeSensor()
    {
        for (uint8_t address : kCandidateAddresses)
        {
            wire.beginTransmission(address);
            if (wire.endTransmission() == 0)
            {
                activeAddress = address;
                return true;
            }
        }

        return false;
    }

    bool readSensor()
    {
        if (!sensorConnected)
        {
            return false;
        }

        if (!sendCommand(activeAddress, kCommandMeasureHighPrecision))
        {
            sensorConnected = false;
            return false;
        }

        delay(kMeasurementTimeMs);

        constexpr uint8_t responseSize = 6;
        if (wire.requestFrom(static_cast<int>(activeAddress), static_cast<int>(responseSize)) != responseSize)
        {
            return false;
        }

        uint8_t raw[responseSize];
        for (uint8_t i = 0; i < responseSize; i++)
        {
            raw[i] = wire.read();
        }

        if (crc8(raw, 2) != raw[2] || crc8(raw + 3, 2) != raw[5])
        {
            return false;
        }

        const uint16_t rawTemp = static_cast<uint16_t>(raw[0] << 8) | raw[1];
        const uint16_t rawHumidity = static_cast<uint16_t>(raw[3] << 8) | raw[4];

        lastTempC = -45.0f + (175.0f * static_cast<float>(rawTemp) / 65535.0f);
        lastHumidity = -6.0f + (125.0f * static_cast<float>(rawHumidity) / 65535.0f);

        if (lastHumidity < 0.0f)
        {
            lastHumidity = 0.0f;
        }
        else if (lastHumidity > 100.0f)
        {
            lastHumidity = 100.0f;
        }

        sampleAvailable = true;
        sensorConnected = true;
        return true;
    }

    void refreshIfDue(unsigned long now, bool force)
    {
        if (!initialized)
        {
            return;
        }

        if (!sensorConnected)
        {
            sensorConnected = probeSensor();
            if (!sensorConnected)
            {
                return;
            }

            sendCommand(activeAddress, kCommandSoftReset);
            delay(1);
        }

        if (!force && sampleAvailable && (now - lastReadAt) < readIntervalMs)
        {
            return;
        }

        if (readSensor())
        {
            lastReadAt = now;
        }
    }
} // namespace

namespace Thermometer
{
    void init(uint8_t sdaPin, uint8_t sclPin, unsigned long minReadIntervalMs)
    {
        activeSdaPin = sdaPin;
        activeSclPin = sclPin;
        readIntervalMs = minReadIntervalMs == 0 ? kDefaultMinReadIntervalMs : minReadIntervalMs;
        lastReadAt = 0;
        lastTempC = NAN;
        lastHumidity = NAN;
        sampleAvailable = false;

        wire.begin(activeSdaPin, activeSclPin);
        initialized = true;
        sensorConnected = probeSensor();
        if (sensorConnected)
        {
            sendCommand(activeAddress, kCommandSoftReset);
            delay(1);
            refreshIfDue(millis(), true);
        }
    }

    void update(unsigned long now)
    {
        refreshIfDue(now, false);
    }

    float getTemp()
    {
        refreshIfDue(millis(), !sampleAvailable);
        if (!sampleAvailable)
        {
            return NAN;
        }

        return lastTempC;
    }

    float getHumidity()
    {
        refreshIfDue(millis(), !sampleAvailable);
        return lastHumidity;
    }
} // namespace Thermometer
