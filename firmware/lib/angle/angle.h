#ifndef ANGLE_H
#define ANGLE_H

void setupIMUs();

float getAngle();

bool areIMUsReady();

bool isTibiaReady();

bool isFootReady();

void calibrateNeutralPose();

#endif