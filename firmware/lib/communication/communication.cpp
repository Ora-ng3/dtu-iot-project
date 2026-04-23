#include "communication.h"
#include <Arduino.h>
#include <WiFi.h>

// Wifi setup

const char* ssid = "printer hp";
const char* password = "lolmdrswagswag";

const char* host = "172.20.10.12"; // PC IP
const uint16_t port = 5000;

WiFiClient client;

unsigned long lastSend = 0;
const int sendInterval = 50; // ms (~20 Hz)
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 1000;

const int buzzerPin = 16;

int zoneIdentifier = 0;


void setupWiFi() {
    const unsigned long wifiTimeoutMs = 10000;
    const unsigned long startMs = millis();

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");

    while (WiFi.status() != WL_CONNECTED && (millis() - startMs) < wifiTimeoutMs) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nConnected!");
        Serial.print("ESP IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi timeout, continuing without network");
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

void sendData(float angle) {
    unsigned long now = millis();
    if (now - lastSend >= sendInterval) {
        lastSend = now;

        if (WiFi.status() != WL_CONNECTED) {
            return;
        }

        if (!client.connected()) {
            if (now - lastReconnectAttempt >= reconnectInterval) {
                lastReconnectAttempt = now;
                reconnect();
            }
            return;
        }

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
    