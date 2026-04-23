#include <Arduino.h>
#include "angle.h"
#include "communication.h"
#include "buzzer.h"
#include "display.h"

// TODO: Change PC address in communication.cpp before running

// Pin definitions
const int MODE_BUTTON_PIN = 6; // Button to switch between Angle and Force modes
static constexpr unsigned long DEBOUNCE_MS = 40;
static constexpr float FORCE_THRESHOLD_DEG = 30.0f;
static constexpr bool BUTTON_ACTIVE_LOW = true;

enum class AppMode {
    Angle,
    Force
};

AppMode currentMode = AppMode::Angle;
int lastButtonReading = HIGH;
int stableButtonState = HIGH;
bool buttonPressHandled = false;
unsigned long lastDebounceTime = 0;
unsigned long lastDiagPrintTime = 0;

void updateModeFromButton() {
    const int reading = digitalRead(MODE_BUTTON_PIN);

    if (reading != lastButtonReading) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > DEBOUNCE_MS) {
        stableButtonState = reading;

        const bool pressed = BUTTON_ACTIVE_LOW ? (stableButtonState == LOW) : (stableButtonState == HIGH);
        if (pressed && !buttonPressHandled) {
            buttonPressHandled = true;
            currentMode = (currentMode == AppMode::Angle) ? AppMode::Force : AppMode::Angle;
            Serial.print("Mode switched to: ");
            Serial.println(currentMode == AppMode::Force ? "FORCE" : "ANGLE");
        } else if (!pressed) {
            buttonPressHandled = false;
        }
    }

    lastButtonReading = reading;
}

void setup() {
    Serial.begin(115200);
    // Initialize button pin
    pinMode(MODE_BUTTON_PIN, INPUT_PULLUP);
    
    setupIMUs();
    setupDisplay();
    setupWiFi();
    setupBuzzer();
}

void loop() {
    updateModeFromButton();

    float angle = getAngle();
    const bool forceMode = (currentMode == AppMode::Force);
    const char* modeLabel = forceMode ? "FORCE" : "ANGLE";

    if (!areIMUsReady() && (millis() - lastDiagPrintTime) > 1500) {
        lastDiagPrintTime = millis();
        Serial.print("IMU ready? tibia=");
        Serial.print(isTibiaReady() ? "OK" : "NO");
        Serial.print(" foot=");
        Serial.println(isFootReady() ? "OK" : "NO");
    }

    updateDisplay(angle, modeLabel);

    sendData(angle);

    if (forceMode && angle > FORCE_THRESHOLD_DEG) {
        buzz();
    } else {
        noBuzz();
    }

    delay(100);
}
