#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <stdbool.h>

void setupWiFi();

void sendData(float angle);

bool isWifiConnected();

#endif