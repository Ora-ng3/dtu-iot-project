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

float FSR::getForce() {
    // Pour l'instant, nous retournons la valeur brute.
    // Une conversion en force réelle (par exemple, en Newtons) nécessiterait un étalonnage.
    return getRawValue();
}
