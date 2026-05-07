#include "fsr.h"

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
    // we wanted to convert the raw adc values but it was not consistent the sensor had
    // to be calibrated every 20 minutes and it was not worth the effort for the current project,
    // so we just return the raw value for now

    return adc_raw ; 
}
