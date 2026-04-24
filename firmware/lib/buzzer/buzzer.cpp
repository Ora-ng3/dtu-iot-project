#include "buzzer.h"
#include <Arduino.h>

const int buzzerPin = 16;
static bool buzzerActive = false;

void setupBuzzer() {
    pinMode(buzzerPin, OUTPUT);
    digitalWrite(buzzerPin, LOW);
    buzzerActive = false;
}

void buzz() {
    if (buzzerActive) {
        return;
    }

    Serial.println("BUZZ");
    tone(buzzerPin, 80); // Buzz at 80 Hz
    buzzerActive = true;
}

void noBuzz() {
    if (!buzzerActive) {
        return;
    }

    noTone(buzzerPin);
    buzzerActive = false;
}