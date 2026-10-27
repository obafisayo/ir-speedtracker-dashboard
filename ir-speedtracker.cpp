#include <Arduino.h>
#include <WiFiNINA.h> // Built-in WiFi on the Arduino Uno WiFi Rev2

// ---- WiFi + dashboard server settings (edit these) ----
const char WIFI_SSID[] = "ir-tracker";
const char WIFI_PASS[] = "irtracker123";
const char SERVER_HOST[] = "172.20.10.3"; // Laptop's IP (server.py prints it on startup)
const int SERVER_PORT = 8080;

const int sensor1Pin = 3; // Start sensor
const int sensor2Pin = 4; // Finish sensor

const float distanceMeters = 0.10; // Distance between sensors
const unsigned long timeoutMicros = 3000000; // Give up if sensor 2 isn't hit within 3 s

unsigned long startTime = 0;
bool waitingForFinish = false;

// Variables to track previous states for edge detection
int lastState1 = HIGH;
int lastState2 = HIGH;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  for (int attempt = 0; attempt < 5 && WiFi.status() != WL_CONNECTED; attempt++) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(2000);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. Arduino IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed; readings will only go to Serial.");
  }
}

// POST one reading to the laptop server as JSON
void sendReading(float timeSeconds, float speedMPS) {
  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("Could not reach dashboard server.");
    return;
  }

  String body = "{\"time_s\":" + String(timeSeconds, 6) +
                ",\"speed_mps\":" + String(speedMPS, 4) + "}";

  client.println("POST /api/speed HTTP/1.1");
  client.print("Host: ");
  client.println(SERVER_HOST);
  client.println("Content-Type: application/json");
  client.print("Content-Length: ");
  client.println(body.length());
  client.println("Connection: close");
  client.println();
  client.print(body);

  // Wait briefly for the status line (e.g. "HTTP/1.0 201 Created") so we know it arrived
  unsigned long waitStart = millis();
  while (!client.available() && millis() - waitStart < 2000) {
    delay(10);
  }
  if (client.available()) {
    Serial.print("Server: ");
    Serial.println(client.readStringUntil('\n'));
  } else {
    Serial.println("No response from server.");
  }
  client.stop();
}

void setup() {
  Serial.begin(9600);
  pinMode(sensor1Pin, INPUT);
  pinMode(sensor2Pin, INPUT);
  connectWiFi();
  Serial.println("Precision Edge-Triggered Speed Trap Ready.");
}

void loop() {
  int currentState1 = digitalRead(sensor1Pin);
  int currentState2 = digitalRead(sensor2Pin);

  // Detect Falling Edge on Sensor 1 (Transition from HIGH to LOW = Front edge crosses)
  if (!waitingForFinish && lastState1 == HIGH && currentState1 == LOW) {
    startTime = micros();
    waitingForFinish = true;
  }

  // Reset if the car triggered sensor 1 but never reached sensor 2
  if (waitingForFinish && micros() - startTime > timeoutMicros) {
    waitingForFinish = false;
    Serial.println("Timed out waiting for sensor 2; reset.");
  }

  // Detect Falling Edge on Sensor 2 (Transition from HIGH to LOW = Front edge arrives)
  if (waitingForFinish && lastState2 == HIGH && currentState2 == LOW) {
    unsigned long endTime = micros();
    waitingForFinish = false;

    unsigned long elapsedMicros = endTime - startTime;
    float timeSeconds = (float)elapsedMicros / 1000000.0;

    if (timeSeconds > 0) {
      float speedMPS = distanceMeters / timeSeconds;
      float speedKMPH = speedMPS * 3.6;

      Serial.print("Time: ");
      Serial.print(timeSeconds, 4);
      Serial.print(" s | Speed: ");
      Serial.print(speedMPS, 2);
      Serial.print(" m/s (");
      Serial.print(speedKMPH, 1);
      Serial.println(" km/h)");

      sendReading(timeSeconds, speedMPS);
    }

    delay(500); // Cooldown
  }

  // Save current states for the next loop iteration
  lastState1 = currentState1;
  lastState2 = currentState2;
}
