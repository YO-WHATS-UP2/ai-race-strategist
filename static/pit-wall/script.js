import './bridge.js';

// --- GLOBAL STATE ---
let bridge;
let telemetryChart, anomalyChart;
let modelAnomaly;
let modelSimulator;
let isSimulationRunning = false;
let isFailureReported = false;
let timeStep = 0;
let impactChart; // New Chart instance
let lastCrashVibration = 55.0; // Default placeholder until real crash
let isIoMode = false;
// Rolling buffer for LSTM
const SEQUENCE_LENGTH = 10;
let dataBuffer = []; 
const ANOMALY_THRESHOLD = 0.65; 

// Simulator Stats (Approx Mean/Std from Python)
const SIM_STATS = {
    mean: [6.5, 1500],   // [Thickness, AeroLoad]
    std: [2.02, 288.6]   // [Thickness, AeroLoad]
};

// --- INITIALIZATION ---
async function initPitWall() {
  const statusEl = document.getElementById('connectionStatus');
  const specEl = document.getElementById('specContainer');
  const btnTest = document.getElementById('btnTest');

  // 1. Load Bridge
  try {
    bridge = await import('./bridge.js');
    statusEl.innerText = "🟢 Online";
    statusEl.style.color = "#00FF00";
  } catch (e) {
    statusEl.innerText = "❌ Bridge Error";
    console.error("Bridge Error:", e);
    return;
  }

  // 2. Initialize Charts
  initCharts();

  // 3. Load Anomaly Model (LSTM)
  try {
      specEl.innerText = "⏳ Loading Neural Network...";
      console.log("Attempting to load model from: ./models/model_anomaly_v3/model.json");
      
      // LOAD MODEL
      modelAnomaly = await tf.loadLayersModel('./models/model_anomaly_v3/model.json');
      
      // SUCCESS
      console.log("✅ Anomaly Model Loaded Successfully");
      specEl.innerText = "✅ LSTM Anomaly Detector: ONLINE\n\nReady for simulation.";
      
      // Enable Test Button
      btnTest.disabled = false;
      btnTest.onclick = startTestRun;
      
  } catch (e) {
      console.error("Model Load Failed:", e);
      specEl.innerText = "❌ Model Error: " + e.message;
      specEl.innerText += "\n\nCheck console for 404 errors.";
  }

  // 4. Load Simulator Model (What-If)
  try {
      console.log("Loading Simulator...");
      // Ensure this folder exists and model.json is fixed (batch_input_shape)
      modelSimulator = await tf.loadLayersModel('./models/model_simulator_v2/model.json');
      console.log("✅ Simulator Model Loaded");

      // Initialize Sliders
      updateSimulation();
      const inputThickness = document.getElementById('inputThickness');
      const inputLoad = document.getElementById('inputLoad');
      
      if(inputThickness && inputLoad) {
          inputThickness.oninput = updateSimulation;
          inputLoad.oninput = updateSimulation;
      }

  } catch (e) {
      console.error("Simulator Load Failed:", e);
  }

  // 5. Load Spec Data (Background)
  try {
    const response = await bridge.invoke('getSpecData');
    if(response.status === 'success') {
        specEl.innerText += "\n\n--- SPECS ---\n" + JSON.stringify(response.data, null, 2);
    }
  } catch(e) { console.error(e); }
}

function startTestRun() {
      const btnTest = document.getElementById('btnTest');
      if (isSimulationRunning) return;
      
      isSimulationRunning = true;
      isFailureReported = false; 
      timeStep = 0;
      dataBuffer = []; // Reset buffer
      
      btnTest.innerText = "Running...";
      btnTest.disabled = true;
      
      // Reset Alert Box
      const alertBox = document.getElementById('anomalyAlert');
      if(alertBox) alertBox.style.display = 'none';
      
      // Start the loop
      simulateTelemetryLoop();
}

// --- SIMULATION LOOP ---
// Global toggle: Set to true to listen for Python Data

async function simulateTelemetryLoop() {
    if (!isSimulationRunning) return;

    let vibration, temp, load;

    // --- OPTION A: LIVE IOT MODE ---
    if (isIoMode) {
        try {
            // 1. Ask Forge Storage for the latest data packet
            const latest = await bridge.invoke('fetchLiveTelemetry');
            
            if (latest && latest.timestamp) {
                vibration = latest.vibration;
                temp = latest.temperature;
                load = latest.aero_load;
                // Log occasionally to confirm connection
                if (timeStep % 5 === 0) console.log("📡 Receiving IoT Data:", latest);
            } 
        } catch (e) {
            console.warn("⚠️ IoT Polling Error (Falling back to Simulation):", e);
            isIoMode = false; // Switch to math mode automatically on error
        }
    }

    // --- OPTION B: MATH SIMULATION (Fallback / Default) ---
    // Runs if isIoMode is false OR if IoT data came back empty
    if (!isIoMode || vibration === undefined) {
        const isChaosMode = timeStep > 60; 
        
        vibration = 50 + Math.sin(timeStep * 0.1) * 2 + (Math.random() - 0.5);
        temp = 85 + (timeStep * 0.01) + (Math.random() * 0.2);
        load = 1500 + Math.sin(timeStep * 0.05) * 10;

        if (isChaosMode) {
            vibration += (timeStep - 60) * 0.8 + (Math.random() * 5); 
        }
    }

    // 2. Preprocessing (StandardScaler)
    const vib_scaled = (vibration - 50.0) / 1.5;
    const temp_scaled = (temp - 82.5) / 1.5;
    const load_scaled = (load - 1500.0) / 7.0;

    dataBuffer.push([vib_scaled, temp_scaled, load_scaled]);

    // 3. Prediction (Once buffer is full)
    let anomalyScore = 0;
    if (dataBuffer.length > SEQUENCE_LENGTH) {
        dataBuffer.shift(); 

        const inputTensor = tf.tensor3d([dataBuffer]);
        const prediction = modelAnomaly.predict(inputTensor);
        const inputData = inputTensor.dataSync();
        const predData = prediction.dataSync();
        
        let mae = 0;
        for(let i=0; i<inputData.length; i++) {
            mae += Math.abs(inputData[i] - predData[i]);
        }
        anomalyScore = mae / inputData.length;
        
        inputTensor.dispose();
        prediction.dispose();
    }

    // 4. Update Charts
    updateChartData(telemetryChart, vibration);
    updateChartData(anomalyChart, anomalyScore);

    // 5. Trigger Logic (Save crash value for Impact Chart)
    if (anomalyScore > ANOMALY_THRESHOLD && !isFailureReported) {
        if (typeof lastCrashVibration !== 'undefined') {
             lastCrashVibration = vibration; // Save for Impact Chart
             if (typeof updateSimulation === 'function') updateSimulation();
        }
        triggerFailureProtocol(anomalyScore, vibration, temp);
    }

    // 6. Loop Control
    timeStep++;
    
    // IF IOT MODE: Loop slower (500ms) to match Python script speed & save API calls
    // IF MATH MODE: Loop fast (50ms) for smooth animation
    const delay = isIoMode ? 500 : 50;
    
    // Stop condition (e.g., run for 200 steps)
    if (timeStep < 200) {
        setTimeout(simulateTelemetryLoop, delay);
    } else {
        isSimulationRunning = false;
        const btn = document.getElementById('btnTest');
        if(btn) {
            btn.innerText = "Test Complete";
            btn.disabled = false;
        }
    }
}

// --- FAILURE TRIGGER ---
async function triggerFailureProtocol(score, vib, temp) {
    if (isFailureReported) return; // Prevent double firing
    isFailureReported = true;
    lastCrashVibration = vib;
    updateSimulation();
    // 1. Show the Red Alert Box
    const alertBox = document.getElementById('anomalyAlert');
    if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerText = `🚨 FAILURE DETECTED (Score: ${score.toFixed(2)})`;
    }

    console.log("Invoking Backend Trigger...");
    
    try {
        // 2. Call the Backend
        // NOTE: We do not need 'view.getContext()' here.
        // The backend resolver automatically wraps the request with the issue context.
        await bridge.invoke('triggerSolutionAnalysis', {
            failureData: {
                max_vibration: vib.toFixed(2) + " Hz",
                temperature: temp.toFixed(2) + " C",
                anomaly_score: score.toFixed(4),
                timestamp: new Date().toISOString()
            }
        });
        console.log("✅ Backend Triggered Successfully");
        
    } catch (e) {
        console.error("Trigger Failed:", e);
    }
}

// --- SIMULATOR LOGIC (WHAT-IF) ---
async function updateSimulation() {
    if (!modelSimulator) return;

    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(!inputThickness || !inputLoad) return;

    // 1. Get Inputs & Predict
    const thickness = parseFloat(inputThickness.value);
    const load = parseFloat(inputLoad.value);
    
    document.getElementById('valThickness').innerText = thickness.toFixed(1) + " mm";
    document.getElementById('valLoad').innerText = load.toFixed(0) + " N";

    const thk_scaled = (thickness - SIM_STATS.mean[0]) / SIM_STATS.std[0];
    const load_scaled = (load - SIM_STATS.mean[1]) / SIM_STATS.std[1];

    const inputTensor = tf.tensor2d([[thk_scaled, load_scaled]]);
    const prediction = modelSimulator.predict(inputTensor);
    const predictedVib = prediction.dataSync()[0];

    // 2. Update Text UI
    const outputEl = document.getElementById('predVibration');
    outputEl.innerText = predictedVib.toFixed(2) + " Hz";
    
    if (predictedVib > 45) outputEl.style.color = "#FF5630"; 
    else outputEl.style.color = "#36B37E";

    // 3. UPDATE THE CHART (Before vs After) 📊
    if (impactChart) {
        // Bar 1: The Crash (Red)
        impactChart.data.datasets[0].data[0] = lastCrashVibration;
        // Bar 2: The Fix (Green)
        impactChart.data.datasets[0].data[1] = predictedVib;
        
        impactChart.update();
    }

    inputTensor.dispose();
    prediction.dispose();
}
// --- CHART UTILS ---
function initCharts() {
    const commonOptions = {
        responsive: true, 
        maintainAspectRatio: false,
        animation: false,
        elements: { point: { radius: 0 } },
        scales: { x: { display: false }, y: { grid: { color: '#2C3E50' } } }
    };

    const ctx1 = document.getElementById('telemetryChart').getContext('2d');
    telemetryChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: Array(50).fill(''), datasets: [{ label: 'Vibration', data: Array(50).fill(null), borderColor: '#579DFF', borderWidth: 2 }] },
        options: commonOptions
    });

    const ctx2 = document.getElementById('anomalyChart').getContext('2d');
    anomalyChart = new Chart(ctx2, {
        type: 'line',
        data: { labels: Array(50).fill(''), datasets: [{ label: 'Error Score', data: Array(50).fill(0), borderColor: '#FF5630', borderWidth: 2, fill: true, backgroundColor: 'rgba(255, 86, 48, 0.2)' }] },
        options: {
            ...commonOptions,
            scales: { ...commonOptions.scales, y: { min: 0, max: 1.0, grid: { color: '#2C3E50' } } }
        }
    });
    const ctx3 = document.getElementById('impactChart').getContext('2d');
    impactChart = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: ['Failure State', 'AI Prediction'],
            datasets: [{
                label: 'Vibration (Hz)',
                data: [0, 0], // Will fill dynamically
                backgroundColor: ['#FF5630', '#36B37E'], // Red vs Green
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Impact Analysis', color: '#8993A4' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#2C3E50' }, title: { display: true, text: 'Hz' } },
                x: { grid: { display: false } }
            }
        }
    });
}
function updateChartData(chart, value) {
    const data = chart.data.datasets[0].data;
    data.push(value);
    data.shift();
    chart.update();
}

// Start
initPitWall();