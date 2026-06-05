/*
 * HiveArm ESP32 client
 * --------------------
 * Connects over TLS WebSocket to the Cloudflare relay and exchanges
 * "servoIdx,angle" commands with the browser.
 *
 * Requires libraries:
 *   - WiFi.h                  (built-in)
 *   - WebSocketsClient        (by Markus Sattler — "WebSockets" in Library Manager)
 *   - Adafruit_PWMServoDriver (PCA9685 driver)
 *
 * IMPORTANT: WebSocketsClient supports WSS on ESP32 via beginSSL().
 *            Cloudflare's edge presents a valid Let's Encrypt cert, so we use
 *            beginSSL() without pinning. For stricter security pin the CA.
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// ---------- USER CONFIG ----------
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* WS_HOST = "hivearm.noreplyglobalx1.workers.dev";
const int   WS_PORT = 443;
const char* WS_PATH = "/ws?role=esp32";
// ---------------------------------

WebSocketsClient webSocket;
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// Servo pulse range for PCA9685 @ 50 Hz
const int SERVO_MIN = 150;
const int SERVO_MAX = 600;

int currentAngle[5] = {90, 90, 90, 90, 90};

int angleToPulse(int angle) {
  angle = constrain(angle, 0, 180);
  return map(angle, 0, 180, SERVO_MIN, SERVO_MAX);
}

void moveServoSmooth(int idx, int target) {
  target = constrain(target, 0, 180);
  int step = (target > currentAngle[idx]) ? 1 : -1;
  while (currentAngle[idx] != target) {
    currentAngle[idx] += step;
    pwm.setPWM(idx, 0, angleToPulse(currentAngle[idx]));
    delay(8);
  }
}

void sendTelemetry() {
  // Simple JSON telemetry — browser parses with JSON.parse
  String payload = "{\"temperature\":";
  payload += String(25 + (millis() / 1000) % 10);
  payload += "}";
  webSocket.sendTXT(payload);
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("[ws] connected to relay");
      webSocket.sendTXT("{\"type\":\"hello\",\"from\":\"esp32\"}");
      break;
    case WStype_DISCONNECTED:
      Serial.println("[ws] disconnected");
      break;
    case WStype_TEXT: {
      String msg = String((char*)payload).substring(0, length);
      Serial.printf("[ws] rx: %s\n", msg.c_str());
      // Expected command format: "idx,angle"  e.g. "0,120"
      int comma = msg.indexOf(',');
      if (comma > 0) {
        int idx   = msg.substring(0, comma).toInt();
        int angle = msg.substring(comma + 1).toInt();
        if (idx >= 0 && idx < 5) moveServoSmooth(idx, angle);
      }
      break;
    }
    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pwm.begin();
  pwm.setPWMFreq(50);
  for (int i = 0; i < 5; i++) pwm.setPWM(i, 0, angleToPulse(currentAngle[i]));

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  // TLS WebSocket to Cloudflare. No cert pinning — relies on SNI + CF cert.
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(onWsEvent);
  webSocket.setReconnectInterval(3000);
  webSocket.enableHeartbeat(15000, 3000, 2);
}

unsigned long lastTelem = 0;
void loop() {
  webSocket.loop();
  if (millis() - lastTelem > 2000) {
    lastTelem = millis();
    if (webSocket.isConnected()) sendTelemetry();
  }
}
