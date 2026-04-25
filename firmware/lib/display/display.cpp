#include "display.h"

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

static constexpr int SCREEN_WIDTH = 128;
static constexpr int SCREEN_HEIGHT = 64;
static constexpr int OLED_RESET = -1;
static constexpr uint8_t OLED_ADDRESS = 0x3C;

static Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
static bool oledReady = false;

void setupDisplay() {
    // Wire is already configured in setupIMUs on pins 8/9.
    oledReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, false, false);
    if (!oledReady) {
        Serial.println("OLED init failed");
        return;
    }

    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.println("OLED ready");
    oled.display();
}

void updateDisplay(float angleDeg, const char* modeLabel, bool wifiConnected) {
    if (!oledReady) {
        return;
    }

    oled.clearDisplay();

    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.print("Angle: ");
    oled.print(angleDeg, 1);
    oled.println(" deg");

    oled.setCursor(0, 10);
    oled.print("Mode: ");
    oled.println(modeLabel);

    oled.setCursor(0, 20);
    oled.print("WiFi: ");
    oled.println(wifiConnected ? "Connected" : "Offline");

    // Shared origin for both lines.
    const int x0 = 96;
    const int y0 = 48; // Move the origin up by 10 pixels
    const int lineLen = 22;

    // Draw the fixed vertical reference line
    oled.drawLine(x0, y0, x0, y0 - lineLen, SSD1306_WHITE);

    // The moving line now starts horizontally for angle = 0.
    float angleRad = angleDeg * PI / 180.0;
    int16_t x1 = x0 + static_cast<int16_t>(lineLen * cos(angleRad));
    int16_t y1 = y0 - static_cast<int16_t>(lineLen * sin(angleRad));
    oled.drawLine(x0, y0, x1, y1, SSD1306_WHITE);

    oled.display();
}

void updateForceDisplay(float force, const char* modeLabel, bool wifiConnected, int maxForce) {
    if (!oledReady) {
        return;
    }

    oled.clearDisplay();

    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.print("Force: ");
    oled.print(force, 1);
    oled.println(" N");

    oled.setCursor(0, 10);
    oled.print("Mode: ");
    oled.println(modeLabel);

    oled.setCursor(0, 20);
    oled.print("WiFi: ");
    oled.println(wifiConnected ? "Connected" : "Offline");

    // Gauge
    int gaugeWidth = map(force, 0, maxForce, 0, SCREEN_WIDTH - 10);
    oled.drawRect(5, SCREEN_HEIGHT - 15, SCREEN_WIDTH - 10, 10, SSD1306_WHITE);
    oled.fillRect(5, SCREEN_HEIGHT - 15, gaugeWidth, 10, SSD1306_WHITE);

    oled.display();
}
