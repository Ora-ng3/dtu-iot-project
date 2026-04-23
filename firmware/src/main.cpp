#include <Arduino.h>
#include "angle.h"
#include "communication.h"
#include "buzzer.h"

// TODO: Change PC address in communication.cpp before running

void setup() {
    Serial.begin(115200);
    
    setupIMUs();
    setupWiFi();
    setupBuzzer();
}

void loop() {
    float angle = getAngle();

    sendData(angle);

    if (angle > 30) {
        buzz();
    } else {
        noBuzz();
    }

    delay(100);
}
