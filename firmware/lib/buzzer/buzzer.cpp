#include "buzzer.h"
#include <Arduino.h>

const int buzzerPin = 3;
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
    tone(buzzerPin, 800); // Buzz at 800 Hz
    buzzerActive = true;
}

void noBuzz() {
    if (!buzzerActive) {
        return;
    }

    noTone(buzzerPin);
    buzzerActive = false;
}