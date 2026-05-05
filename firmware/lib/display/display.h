#ifndef DISPLAY_H
#define DISPLAY_H

#include <stdbool.h>

void setupDisplay();

void updateDisplay(float angleDeg, const char* modeLabel, bool wifiConnected);
void updateForceDisplay(int force, const char* modeLabel, bool wifiConnected, int maxForce);

#endif
