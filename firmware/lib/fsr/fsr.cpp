#include "fsr.h"

float prevForce = 0.0f;
float filterWeight = 0.1f; // Poids pour le filtre de lissage (0.1 = 10% du nouveau, 90% de l'ancien)

FSR::FSR(int pin) {
    _pin = pin;
}

void FSR::begin() {
    pinMode(_pin, INPUT);
}

int FSR::getRawValue() {
    return analogRead(_pin);
}

int FSR::getForce() {
    int adc_raw = getRawValue();
    

    return adc_raw ; 
}
