#include "angle.h"
#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"
#include "Wire.h"

static constexpr int I2C_ANKLE_SCREEN_SDA = 8;
static constexpr int I2C_ANKLE_SCREEN_SCL = 9;
static constexpr int I2C_FOOT_SDA = 2;
static constexpr int I2C_FOOT_SCL = 1;

TwoWire i2cFoot(1);

// MPU6050 objects
MPU6050 mpuTibia(0x68); // Ankle/Tibia sensor on default I2C bus (Wire)
MPU6050 mpuFoot(0x68, &i2cFoot); // Foot sensor on the second I2C bus

bool dmpReadyTibia = false;
bool dmpReadyFoot = false;

// Buffer used to grab DMP packets
uint8_t fifoBuffer[64];

// Current Absolute Quaternions
Quaternion qTibia;
Quaternion qFoot;

// Calibration Quaternions
Quaternion qRelInitial;
bool calibrated = false;
unsigned long startTime;

float euler[3];

void setupIMUs() {
    Wire.begin(I2C_ANKLE_SCREEN_SDA, I2C_ANKLE_SCREEN_SCL, 400000);
    i2cFoot.begin(I2C_FOOT_SDA, I2C_FOOT_SCL, 400000);

    Serial.println("Initializing I2C devices...");
    mpuTibia.initialize();
    mpuFoot.initialize();

    Serial.println("Initializing DMPs...");
    uint8_t statusTibia = mpuTibia.dmpInitialize();
    uint8_t statusFoot = mpuFoot.dmpInitialize();

    // IMU A (Tibia) Offsets
    mpuTibia.setXAccelOffset(-657);
    mpuTibia.setYAccelOffset(341);
    mpuTibia.setZAccelOffset(1471);
    mpuTibia.setXGyroOffset(12);
    mpuTibia.setYGyroOffset(35);
    mpuTibia.setZGyroOffset(0);

    // IMU B (Foot) Offsets
    mpuFoot.setXAccelOffset(-1015);
    mpuFoot.setYAccelOffset(2009);
    mpuFoot.setZAccelOffset(1045);
    mpuFoot.setXGyroOffset(41);
    mpuFoot.setYGyroOffset(-8);
    mpuFoot.setZGyroOffset(2);

    if (statusTibia == 0) {
        mpuTibia.setDMPEnabled(true);
        dmpReadyTibia = true;
    } else {
        Serial.print("Tibia DMP failed: "); Serial.println(statusTibia);
    }

    if (statusFoot == 0) {
        mpuFoot.setDMPEnabled(true);
        dmpReadyFoot = true;
    } else {
        Serial.print("Foot DMP failed: "); Serial.println(statusFoot);
    }

    startTime = millis();
}

float getAngle() {
    if (!dmpReadyTibia || !dmpReadyFoot) return 0;

    bool updated = false;

    // Poll Tibia IMU
    // This drains the buffer and grabs the most recent quaternion
    if (mpuTibia.dmpGetCurrentFIFOPacket(fifoBuffer)) {
        mpuTibia.dmpGetQuaternion(&qTibia, fifoBuffer);
        updated = true;
    }

    // Poll Foot IMU
    if (mpuFoot.dmpGetCurrentFIFOPacket(fifoBuffer)) {
        mpuFoot.dmpGetQuaternion(&qFoot, fifoBuffer);
        updated = true;
    }

    // Mathematical rotation calculation if at least one sensor updated
    if (updated) {
        // Q_relative = Q_Tibia_Inverse * Q_Foot
        Quaternion qRel = qTibia.getConjugate().getProduct(qFoot);
        
        // Wait 3 seconds for the DMP to fully stabilize before taking the "Neutral" snapshot
        if (!calibrated) {
            if (millis() - startTime < 3000) return 0;
            qRelInitial = qRel;
            calibrated = true;
            Serial.println("--- CALIBRATED NEUTRAL POSE ---");
            return 0;
        }
        
        // Q_movement = Q_rel_init_Inverse * Q_rel_current
        // This math mathematically bends space so the 90 degree starting tilt 
        // becomes exactly [0, 0, 0], placing the rotation far away from the gimbal lock pole.
        Quaternion qMovement = qRelInitial.getConjugate().getProduct(qRel);

        
        // The dmpGetEuler function calculates euler math directly from the given quaternion
        mpuTibia.dmpGetEuler(euler, &qMovement);

        // Convert radians to degrees
        float yaw = euler[0] * 180 / M_PI;
        float pitch = euler[1] * 180 / M_PI;
        float roll = euler[2] * 180 / M_PI;

        // Outputting the isolated angle from the neutral starting pose
        return ( pitch);
    }

    return 0;
}

bool areIMUsReady() {
    return dmpReadyTibia && dmpReadyFoot;
}

bool isTibiaReady() {
    return dmpReadyTibia;
}

bool isFootReady() {
    return dmpReadyFoot;
}

void calibrateNeutralPose() {
}