#include <Arduino.h>
#include <ESP8266WiFi.h>
#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"
#include "Wire.h"

// IMU A (Tibia) on 0x68
MPU6050 mpuTibia(0x68);
// IMU B (Foot) on 0x69
MPU6050 mpuFoot(0x69);

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

// Wifi setup

const char* ssid = "Wifi name";
const char* password = "secret password";

const char* host = "192.168.my.pc.ip"; // PC IP
const uint16_t port = 5000;

WiFiClient client;

unsigned long lastSend = 0;
const int sendInterval = 50; // ms (~20 Hz)

const int buzzerPin = 16;

int zoneIdentifier = 0;

float euler[3];

void setup() {
    Wire.begin();

    Serial.begin(115200);
    while (!Serial);

    Serial.println("Initializing I2C devices...");
    mpuTibia.initialize();
    mpuFoot.initialize();

    Serial.println("Initializing DMPs...");
    uint8_t statusTibia = mpuTibia.dmpInitialize();
    uint8_t statusFoot = mpuFoot.dmpInitialize();

    // IMU A (Tibia) Offsets
    mpuTibia.setXAccelOffset(-1179);
    mpuTibia.setYAccelOffset(2043);
    mpuTibia.setZAccelOffset(1010);
    mpuTibia.setXGyroOffset(18);
    mpuTibia.setYGyroOffset(-13);
    mpuTibia.setZGyroOffset(12);

    // IMU B (Foot) Offsets
    mpuFoot.setXAccelOffset(-693);
    mpuFoot.setYAccelOffset(335);
    mpuFoot.setZAccelOffset(1519);
    mpuFoot.setXGyroOffset(66);
    mpuFoot.setYGyroOffset(38);
    mpuFoot.setZGyroOffset(-4);

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
    
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nConnected!");
    Serial.print("ESP IP: ");
    Serial.println(WiFi.localIP());

    startTime = millis();
}

void loop() {
 
    if (!dmpReadyTibia || !dmpReadyFoot) return;

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
        
        // Wait 5 seconds for the DMP to fully stabilize before taking the "Neutral" snapshot
        if (!calibrated) {
            if (millis() - startTime < 5000) return;
            qRelInitial = qRel;
            calibrated = true;
            Serial.println("--- CALIBRATED NEUTRAL POSE ---");
            return;
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
        Serial.print("Yaw: "); Serial.print(yaw);
        Serial.print("\tPitch: "); Serial.print(pitch);
        Serial.print("\tRoll: "); Serial.println(roll);
    }

    // Buzz if outside zone
    if (zoneIdentifier == 1){
        Serial.println("BUZZ");
        tone(buzzerPin,80);
    }
    else {
        noTone(buzzerPin);
    }


    // --- WIFI CODE --- //
    

    // Reconnect if needed
    if (!client.connected()) {
        Serial.println("Connecting to server...");
        if (client.connect(host, port)) {
        Serial.println("Connected to server");
        } else {
        Serial.println("Failed, retrying...");
        delay(1000);
        return;
        }
    }

    // --- SEND SENSOR VALUE ---
    unsigned long now = millis();
    if (now - lastSend >= sendInterval) {
        lastSend = now;
        client.println(euler[1]); //Sending pitch
        Serial.print("Sent: ");
        Serial.println(euler[1]);
    }

    // --- RECEIVE DATA BACK ---
    while (client.available()) {
        String response = client.readStringUntil('\n');

        Serial.print("Received: ");
        Serial.println(response);

        zoneIdentifier = response.toInt();
    }


    delay(100);
}
