#include "communication.h"
#include <Arduino.h>
#include <WiFi.h>

// Wifi setup

const char* ssid = "iPhone de Amaury";
const char* password = "blablacar";

const char* host = "192.168.my.pc.ip"; // PC IP
const uint16_t port = 5000;

WiFiClient client;

unsigned long lastSend = 0;
const int sendInterval = 50; // ms (~20 Hz)

const int buzzerPin = 16;

int zoneIdentifier = 0;


void setupWiFi() {
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nConnected!");
    Serial.print("ESP IP: ");
    Serial.println(WiFi.localIP());
}

void sendData(float angle) {
    unsigned long now = millis();
    if (now - lastSend >= sendInterval) {
        lastSend = now;
        client.println(angle); //Sending pitch
        Serial.print("Sent: ");
        Serial.println(angle);
    }
}

void receiveData() {
    while (client.available()) {
        String response = client.readStringUntil('\n');

        Serial.print("Received: ");
        Serial.println(response);

        zoneIdentifier = response.toInt();
    }
}

void reconnect() {
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
}
    