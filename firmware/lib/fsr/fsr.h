#ifndef FSR_H
#define FSR_H

#include <Arduino.h>

class FSR {
public:
    FSR(int pin);
    void begin();
    float getForce(); // Pourrait être utilisé plus tard pour une conversion en Newtons, etc.
    int getRawValue();

private:
    int _pin;
};

#endif // FSR_H
