#include <Arduino.h>
#include "fsr.h"

const int FSR_PIN = 4;
const int READINGS_REQUIRED = 4;
const float VCC = 3.3f;
const int ADC_RESOLUTION = 12;
const int ADC_MAX_VALUE = (1 << ADC_RESOLUTION) - 1;

struct CalibrationPoint {
    float weightGrams;
    int rawValue;
    float voltage;
    float conductance;
};

CalibrationPoint points[READINGS_REQUIRED];
int currentPoint = 0;

FSR fsr(FSR_PIN);

void printPrompt() {
    Serial.println();
    Serial.print("Point de calibration ");
    Serial.print(currentPoint + 1);
    Serial.print(" / ");
    Serial.println(READINGS_REQUIRED);
    Serial.println("Place un poids sur le FSR, puis saisis sa masse en grammes et appuie sur ENTRÉE.");
    Serial.println("Par exemple : 100");
    Serial.print("> ");
}

bool readWeightInput(float &weight) {
    if (!Serial.available()) {
        return false;
    }

    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) {
        return false;
    }

    weight = line.toFloat();
    if (weight <= 0.0f) {
        Serial.println("Valeur invalide. Entre un nombre positif en grammes.");
        return false;
    }

    return true;
}

void computeCalibration() {
    float sumWeight = 0.0f;
    float sumConductance = 0.0f;
    float sumWeightConductance = 0.0f;
    float sumWeight2 = 0.0f;

    Serial.println();
    Serial.println("--- Résultats de calibration ---");
    for (int i = 0; i < READINGS_REQUIRED; ++i) {
        Serial.print("Point ");
        Serial.print(i + 1);
        Serial.print(": poids = ");
        Serial.print(points[i].weightGrams, 2);
        Serial.print(" g, raw = ");
        Serial.print(points[i].rawValue);
        Serial.print(", tension = ");
        Serial.print(points[i].voltage, 4);
        Serial.print(" V, conductance relative = ");
        Serial.println(points[i].conductance, 4);

        sumWeight += points[i].weightGrams;
        sumConductance += points[i].conductance;
        sumWeightConductance += points[i].weightGrams * points[i].conductance;
        sumWeight2 += points[i].weightGrams * points[i].weightGrams;
    }

    float n = READINGS_REQUIRED;
    float denominator = n * sumWeight2 - sumWeight * sumWeight;
    if (fabs(denominator) < 1e-6f) {
        Serial.println("Erreur : les points de calibration sont trop proches ou invalides.");
        return;
    }

    float slope = (n * sumWeightConductance - sumWeight * sumConductance) / denominator;
    float intercept = (sumConductance - slope * sumWeight) / n;

    Serial.println();
    Serial.println("Modèle linéaire de calibration :");
    Serial.println("  conductance_rel = slope * poids_g + intercept");
    Serial.print("  slope = ");
    Serial.println(slope, 8);
    Serial.print("  intercept = ");
    Serial.println(intercept, 8);
    Serial.println();
    Serial.println("Utilisation :");
    Serial.println("  - Mesure la valeur brute du capteur via analogRead.");
    Serial.println("  - Convertis en conductance relative : raw / 4095.");
    Serial.println("  - Appliques le modèle linéaire pour estimer le poids.");
    Serial.println();
    Serial.println("Attention : cette calibration suppose que la conductance du FSR est linéairement proportionnelle à la lecture analogique.");
    Serial.println("Refais la calibration si les valeurs sont trop bruyantes ou incohérentes.");
}

void setup() {
    Serial.begin(115200);
    while (!Serial) {
        delay(10);
    }

    analogReadResolution(ADC_RESOLUTION);
    fsr.begin();

    Serial.println("=== Calibration FSR ===");
    Serial.println("Ce test lit 4 poids différents et calcule un modèle linéaire.");
    Serial.println("Assure-toi que le capteur est bien connecté à VCC, GND et A0.");
    printPrompt();
}

void loop() {
    if (currentPoint >= READINGS_REQUIRED) {
        computeCalibration();
        Serial.println();
        Serial.println("Calibration terminée. Déconnecte et redémarre le module si nécessaire.");
        while (true) {
            delay(1000);
        }
    }

    float weight = 0.0f;
    if (!readWeightInput(weight)) {
        return;
    }

    int raw = fsr.getRawValue();
    float voltage = (raw / (float)ADC_MAX_VALUE) * VCC;
    float conductance = raw / (float)ADC_MAX_VALUE;

    points[currentPoint].weightGrams = weight;
    points[currentPoint].rawValue = raw;
    points[currentPoint].voltage = voltage;
    points[currentPoint].conductance = conductance;

    Serial.print("Mesure ");
    Serial.print(currentPoint + 1);
    Serial.print(" : raw = ");
    Serial.print(raw);
    Serial.print(", tension = ");
    Serial.print(voltage, 4);
    Serial.print(" V, conductance relative = ");
    Serial.println(conductance, 4);

    currentPoint++;
    if (currentPoint < READINGS_REQUIRED) {
        printPrompt();
    }
}
