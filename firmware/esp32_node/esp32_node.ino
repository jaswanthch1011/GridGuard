// GridGuard Mini - ESP32 node firmware (one per load).
// Libraries: PubSubClient, ArduinoJson. Sensors: ZMPT101B (voltage), ACS712 (current), relay module.
// Calibrate VOLT_SCALE / AMP_SCALE against a multimeter before trusting readings.
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASS";
const char* MQTT_HOST = "192.168.1.10";
const uint16_t MQTT_PORT = 1883;
const char* NODE_ID = "esp32-05";  // must match nodeId in server/src/grid.js
const char* PREFIX = "gridguard";

const int PIN_V = 34, PIN_I = 35, PIN_RELAY = 26;
const float VOLT_SCALE = 0.62f;  // calibrate
const float AMP_SCALE = 0.0185f; // calibrate
const bool RELAY_ACTIVE_HIGH = true;

WiFiClient net;
PubSubClient mqtt(net);
bool relayOn = true;
String topicTelemetry, topicCmd;

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, (on == RELAY_ACTIVE_HIGH) ? HIGH : LOW);
}

float rmsRead(int pin, float scale) {
  const int N = 1000;
  double sum = 0, sumSq = 0;
  for (int i = 0; i < N; i++) { int r = analogRead(pin); sum += r; sumSq += (double)r * r; delayMicroseconds(200); }
  double mean = sum / N;
  return sqrt(max(0.0, sumSq / N - mean * mean)) * scale;
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<96> doc;
  if (deserializeJson(doc, payload, len)) return;
  const char* r = doc["relay"];
  if (!r) return;
  setRelay(strcmp(r, "ON") == 0);
}

void connectAll() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) delay(300);
  }
  while (!mqtt.connected()) {
    if (mqtt.connect(NODE_ID)) mqtt.subscribe(topicCmd.c_str(), 1);
    else delay(2000);
  }
}

void setup() {
  pinMode(PIN_RELAY, OUTPUT);
  setRelay(true);
  topicTelemetry = String(PREFIX) + "/" + NODE_ID + "/telemetry";
  topicCmd = String(PREFIX) + "/" + NODE_ID + "/cmd";
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
}

void loop() {
  connectAll();
  mqtt.loop();
  static uint32_t last = 0;
  if (millis() - last >= 1000) {
    last = millis();
    float v = rmsRead(PIN_V, VOLT_SCALE);
    float a = relayOn ? rmsRead(PIN_I, AMP_SCALE) : 0.0f;
    if (a < 0.05f) a = 0.0f;  // noise floor
    char buf[96];
    snprintf(buf, sizeof(buf), "{\"voltage\":%.1f,\"current\":%.3f,\"relay\":\"%s\"}", v, a, relayOn ? "ON" : "OFF");
    mqtt.publish(topicTelemetry.c_str(), buf);
  }
}
