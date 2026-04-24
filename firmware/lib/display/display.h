#ifndef DISPLAY_H
#define DISPLAY_H

#include <stdbool.h>

void setupDisplay();

void updateDisplay(float angleDeg, const char* modeLabel, bool wifiConnected);

#endif
