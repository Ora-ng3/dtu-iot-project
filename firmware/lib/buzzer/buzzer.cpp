#include "buzzer.h"
#include <Arduino.h>

const int buzzerPin = 16;

void setupBuzzer() {
    pinMode(buzzerPin, OUTPUT);
}

void buzz() {
    Serial.println("BUZZ");
    tone(buzzerPin, 80); // Buzz at 80 Hz
}

void noBuzz() {
    noTone(buzzerPin);
}