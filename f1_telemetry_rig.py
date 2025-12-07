import requests
import time
import math
import random
import json

# ⚠️ REPLACE THIS WITH YOUR WEBTRIGGER URL (See Step 5)
WEBHOOK_URL = "https://c7104b49-0a91-46dc-b2c6-de1b156b9b96.hello.atlassian-dev.net/x1/tkzYBpzjL0lYSzz4p7uWA2lXyoU"

print("🏎️  F1 TELEMETRY RIG: ONLINE")
print("Target: Pit Wall (Atlassian Forge)")
print("----------------------------------")

time_step = 0

try:
    while True:
        # 1. Normal Physics
        vibration = 50 + math.sin(time_step * 0.1) * 2 + random.uniform(-0.5, 0.5)
        temp = 85 + (time_step * 0.01)
        load = 1500 + math.sin(time_step * 0.05) * 10

        # 2. TRIGGER CRASH (Press 'C' logic or just manual override)
        # Let's say we crash at step 20 automatically for the demo
        if time_step > 20:
             print("⚠️  INJECTING ANOMALY...")
             vibration += 15 # HUGE SPIKE

        payload = {
            "vibration": vibration,
            "temperature": temp,
            "aero_load": load,
            "timestamp": time.time()
        }

        # 3. Send to Forge
        try:
            r = requests.post(WEBHOOK_URL, json=payload)
            print(f"Frame {time_step}: Vib={vibration:.2f}Hz -> {r.status_code}")
        except Exception as e:
            print(f"Connection Error: {e}")

        time.sleep(1) # Send data every second
        time_step += 1

except KeyboardInterrupt:
    print("\n🏁 Session Stopped.")