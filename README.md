# ArduinoThermostat

Starter PlatformIO project for a LILYGO ESP32 T-Display board in VS Code.

## What is set up

- Board target: `lilygo-t-display`
- Framework: Arduino framework via PlatformIO
- Upload port: `COM3`
- Serial monitor: `115200`
- Built-in display wired through `TFT_eSPI`

## Open in VS Code

```powershell
code .
```

## Terminal commands

Build:

```powershell
pio run
```

Upload:

```powershell
pio run -t upload
```

```powershell
pio run -t upload && pio device monitor
```

Open serial monitor:

```powershell
pio device monitor
```

Clean build files:

```powershell
pio run -t clean
```

## Notes

- If the board shows up on a different COM port later, update `upload_port` and
  `monitor_port` in `platformio.ini`.
- The current starter app writes status text to the TFT display and logs button
  state to serial.
