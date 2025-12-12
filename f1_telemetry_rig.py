import requests
import time
import math
import random
import json

# ⚠️ REPLACE THIS WITH YOUR WEBTRIGGER URL
WEBHOOK_URL = "https://c7104b49-0a91-46dc-b2c6-de1b156b9b96.hello.atlassian-dev.net/x1/tkzYBpzjL0lYSzz4p7uWA2lXyoU"

def generate_telemetry(step):
    # BASELINE: 50Hz (Safe)
    base_vibration = 50.0 
    
    # 🔥 CHANGE: Crash now starts at Frame 15 (approx 7.5 seconds in)
    CRASH_START_FRAME = 15

    # 1. NORMAL PHASE
    if step < CRASH_START_FRAME:
        # smooth sine wave + tiny noise
        noise = random.uniform(-0.5, 0.5)
        vibration = base_vibration + math.sin(step * 0.2) * 1.5 + noise
        
    # 2. THE CRASH
    else:
        print("⚠️  INJECTING ANOMALY...")
        # Exponential growth to failure
        # We adjust the math to subtract 15 instead of 40 so the math works correctly
        crash_intensity = min((step - CRASH_START_FRAME) * 2.0, 45.0) # Cap at +45Hz
        
        # Vibration jumps to ~95Hz
        vibration = base_vibration + crash_intensity + random.uniform(-1.0, 1.0)

    # 3. OTHER SENSORS
    temperature = 85.0 + (step * 0.05) # Heat builds up
    aero_load = 1500.0 + math.sin(step * 0.1) * 10.0

    return {
        "vibration": vibration,
        "temperature": temperature,
        "aero_load": aero_load,
        "timestamp": time.time()
    }

def main():
    print(f"🏎️  Starting F1 Telemetry Rig...")
    print(f"📡 Target: {WEBHOOK_URL}")
    print(f"⏱️  Crash scheduled for T-minus 7.5 seconds (Frame 15)...")
    print("------------------------------------------------")

    step = 0
    try:
        while True:
            data = generate_telemetry(step)
            
            try:
                # Send Data to Atlassian
                response = requests.post(WEBHOOK_URL, json=data)
                
                # Visual Log
                status = "✅" if response.status_code == 200 else "❌"
                print(f"Frame {step}: Vib={data['vibration']:.2f}Hz -> {response.status_code} {status}")
                
            except Exception as e:
                print(f"Frame {step}: ❌ Connection Error: {e}")

            step += 1
            time.sleep(0.5) # Send every 500ms

    except KeyboardInterrupt:
        print("\n🛑 Telemetry Rig Stopped.")

if __name__ == "__main__":
    main()