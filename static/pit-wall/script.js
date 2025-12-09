import './bridge.js';

// --- GLOBALS ---
let bridge;
let telemetryChart, anomalyChart, impactChart, healthDonut;
let modelAnomaly, modelSimulator;
let isSimulationRunning = false;
let isFailureReported = false;
let timeStep = 0;
let dataBuffer = []; 
let lastCrashVibration = 55.0;

// Config
const SEQUENCE_LENGTH = 10;
const ANOMALY_THRESHOLD = 0.65;

// SHARED STATE
let sharedState = {
    mode: "MATH", // "MATH" or "IOT"
    vibration: 50,
    temperature: 85,
    aeroLoad: 1500,
    lastUpdate: 0
};

// --- INITIALIZATION ---
initPitWall();

async function initPitWall() {
    console.log("🏎️ Pit Wall Initializing...");
    
    // 1. Initialize Bridge
    try {
        bridge = await import('./bridge.js');
        const statusEl = document.getElementById('connectionStatus');
        if(statusEl) { statusEl.innerText = "🟢 Online"; statusEl.style.color = "#36B37E"; }
    } catch (e) { console.error("Bridge Error:", e); }

    // 2. Initialize Charts
    initCharts();

    // 3. Load AI Models
    try {
        modelAnomaly = await tf.loadLayersModel('./models/model_anomaly_v3/model.json');
        modelSimulator = await tf.loadLayersModel('./models/model_simulator_v2/model.json');
        console.log("✅ Local AI Models Loaded");
    } catch (e) { 
        console.warn("Using Math Fallback"); 
    }

    // 4. Bind Inputs
    const btnTest = document.getElementById('btnTest');
    if (btnTest) btnTest.onclick = startTestRun;

    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(inputThickness) inputThickness.oninput = updateSimulation;
    if(inputLoad) inputLoad.oninput = updateSimulation;

    // 5. START BACKGROUND PROCESSES
    // Process A: Dashboard Poller (Every 2s)
    setInterval(updateDashboardStats, 2000);
    
    // Process B: Telemetry Fetcher (Every 1s)
    setInterval(backgroundTelemetryFetch, 1000);

    // Initial Sim Update
    updateSimulation();
}

// ==========================================
// 1. BACKGROUND FETCHER (Does not block UI)
// ==========================================
async function backgroundTelemetryFetch() {
    if (!bridge) return;

    try {
        const now = Date.now();
        const latest = await bridge.invoke('fetchLiveTelemetry');

        if (latest && latest.timestamp) {
            const dataTimeMs = latest.timestamp * 1000;
            // FIX: Increased timeout to 60 seconds to prevent clock-drift issues
            if ((now - dataTimeMs) < 60000) {
                sharedState.mode = "IOT";
                sharedState.vibration = latest.vibration;
                sharedState.temperature = latest.temperature;
                sharedState.aeroLoad = latest.aero_load;
                sharedState.lastUpdate = now;
                
                // Update Badge
                const statusEl = document.getElementById('connectionStatus');
                if(statusEl) { statusEl.innerText = "📡 Live Data"; statusEl.style.color = "#579DFF"; }
                
                // Auto-start simulation if data comes in
                if (!isSimulationRunning) startTestRun();
                
                return;
            }
        }
    } catch (e) { }

    // Fallback if no data
    sharedState.mode = "MATH";
    const statusEl = document.getElementById('connectionStatus');
    if(statusEl) { statusEl.innerText = "⚡ Simulation"; statusEl.style.color = "#FFAB00"; }
}

// ==========================================
// 2. ANIMATION LOOP (Runs Fast - 50ms)
// ==========================================
function startTestRun() {
    if (isSimulationRunning) return;
    
    // Auto-switch to Telemetry Tab
    const simTabBtn = document.querySelector("button[onclick=\"switchTab('telemetry')\"]");
    if(simTabBtn) simTabBtn.click();

    isSimulationRunning = true;
    isFailureReported = false; 
    // timeStep = 0; // Don't reset timeStep for infinite stream
    dataBuffer = []; 
    
    const btnTest = document.getElementById('btnTest');
    btnTest.innerText = "Running...";
    btnTest.disabled = true; // Keep disabled while running
    
    simulateTelemetryLoop();
}

function simulateTelemetryLoop() {
    if (!isSimulationRunning) return;

    let vibration, temp;

    // READ FROM SHARED STATE
    if (sharedState.mode === "IOT") {
        vibration = sharedState.vibration;
        temp = sharedState.temperature;
        console.log(`Plotting Live: ${vibration.toFixed(2)} Hz`); // Debug Log
    } else {
        // MATH MODE
        const isChaosMode = timeStep > 60; 
        vibration = 50 + Math.sin(timeStep * 0.1) * 2 + (Math.random() - 0.5);
        temp = 85 + (timeStep * 0.01);
        if (isChaosMode) {
            vibration += (timeStep - 60) * 0.8 + (Math.random() * 5); 
        }
    }

    // UPDATE CHARTS
    telemetryChart.data.labels.shift(); telemetryChart.data.labels.push('');
    telemetryChart.data.datasets[0].data.shift(); telemetryChart.data.datasets[0].data.push(vibration);
    telemetryChart.update('none'); 

    // ANOMALY CHECK
    let anomalyScore = 0.02;
    if (vibration > 60) {
        anomalyScore = (vibration - 60) / 30; 
        anomalyScore = Math.min(Math.max(anomalyScore, 0.1), 1.0);
    }

    const anomalyText = document.getElementById('anomalyText');
    if(anomalyText) {
        anomalyText.innerText = anomalyScore.toFixed(2);
        anomalyText.style.color = anomalyScore > 0.5 ? '#FF5630' : '#36B37E';
    }
    
    anomalyChart.data.datasets[0].data.shift();
    anomalyChart.data.datasets[0].data.push(anomalyScore);
    anomalyChart.update('none');

    // TRIGGER FAILURE
    if (anomalyScore > ANOMALY_THRESHOLD && !isFailureReported) {
        lastCrashVibration = vibration;
        if(impactChart) {
            impactChart.data.datasets[0].data = [lastCrashVibration, 30.5]; 
            impactChart.update();
        }
        triggerFailureProtocol(anomalyScore, vibration, temp);
    }

    timeStep++;
    
    // FIX: Infinite Loop for IoT Mode
    if (sharedState.mode === "IOT") {
        setTimeout(simulateTelemetryLoop, 50); // Keep running forever
    } else {
        // Simulation Mode stops after 400 frames
        if (timeStep < 400) {
            setTimeout(simulateTelemetryLoop, 50);
        } else {
            stopSimulation();
        }
    }
}

function stopSimulation() {
    isSimulationRunning = false;
    timeStep = 0;
    const btn = document.getElementById('btnTest');
    if(btn) { btn.innerText = "START CRASH TEST"; btn.disabled = false; }
}

// ==========================================
// 3. BACKEND TRIGGERS & DASHBOARD
// ==========================================
async function triggerFailureProtocol(score, vib, temp) {
    if (isFailureReported) return;
    isFailureReported = true;
    try {
        await bridge.invoke('triggerSolutionAnalysis', { 
            jiraTicketKey: "CURRENT_ISSUE",
            failureData: { 
                max_vibration: vib.toFixed(2) + " Hz", 
                temperature: (temp || 85).toFixed(1) + " C",
                anomaly_score: score.toFixed(4),
                timestamp: new Date().toISOString()
            }
        });
    } catch(e) { }
}

async function updateDashboardStats() {
    try {
        const data = await bridge.invoke('fetchDashboardData');
        if (!data) return;

        // Health Gauge
        const score = parseFloat(data.health.score);
        if (healthDonut) {
            const isCrit = score < 80;
            healthDonut.data.datasets[0].backgroundColor = isCrit ? ['#FF5630', '#091E42'] : ['#36B37E', '#091E42'];
            healthDonut.data.datasets[0].data = [score, 100 - score];
            healthDonut.update();
        }
        
        const scoreEl = document.getElementById('healthScore');
        if(scoreEl) scoreEl.innerText = score.toFixed(0);
        
        const statusBadge = document.getElementById('healthStatus');
        if(statusBadge) {
            statusBadge.innerText = data.health.status;
            statusBadge.className = `status-badge ${data.health.status === 'OPTIMAL' ? 'nominal' : 'critical'}`;
        }

        document.getElementById('knowledgeCount').innerText = data.ai.knowledge_size;
        document.getElementById('optRate').innerText = data.ai.optimization_rate;

        const feedContainer = document.getElementById('feedContainer');
        if(feedContainer) {
            feedContainer.innerHTML = ""; 
            data.feed.slice(0, 4).forEach(log => {
                const row = document.createElement('div');
                row.className = 'feed-item';
                row.innerHTML = `<span class="feed-time">${log.time}</span> <span>${log.msg}</span>`;
                feedContainer.appendChild(row);
            });
        }
    } catch (e) { }
}

// ==========================================
// 4. SLIDER LOGIC
// ==========================================
function updateSimulation() {
    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(!inputThickness || !inputLoad) return;

    const thickness = parseFloat(inputThickness.value);
    const load = parseFloat(inputLoad.value);
    
    document.getElementById('valThickness').innerText = thickness.toFixed(1);
    document.getElementById('valLoad').innerText = load.toFixed(0);

    // Visual Predictor
    const predictedVib = 80 - (5 * thickness) + (0.005 * load);
    
    // Resultant Text Display
    const resultText = document.getElementById('resultText');
    if (resultText) {
        resultText.innerText = predictedVib.toFixed(2) + " Hz";
        resultText.style.color = predictedVib < 50 ? "#36B37E" : "#FF5630";
    }
    
    if (impactChart) {
        impactChart.data.datasets[0].data[1] = predictedVib;
        impactChart.update();
    }
}

// ==========================================
// 5. CHART SETUP
// ==========================================
function initCharts() {
    const commonOptions = { responsive: true, maintainAspectRatio: false, animation: false, elements: { point: { radius: 0 } }, scales: { x: { display: false }, y: { grid: { color: '#2C3E50' } } } };

    const ctx1 = document.getElementById('telemetryChart').getContext('2d');
    telemetryChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: Array(50).fill(''), datasets: [{ label: 'Vibration', data: Array(50).fill(50), borderColor: '#579DFF', borderWidth: 2 }] },
        options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 40, suggestedMax: 100 } } }
    });

    const ctx2 = document.getElementById('anomalyChart').getContext('2d');
    anomalyChart = new Chart(ctx2, {
        type: 'line',
        data: { labels: Array(50).fill(''), datasets: [{ label: 'Error Score', data: Array(50).fill(0), borderColor: '#FF5630', borderWidth: 2, fill: true, backgroundColor: 'rgba(255, 86, 48, 0.2)' }] },
        options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: 0, max: 1.0 } } }
    });

    const ctx3 = document.getElementById('impactChart').getContext('2d');
    impactChart = new Chart(ctx3, {
        type: 'bar',
        data: { labels: ['Failure', 'AI Fix'], datasets: [{ data: [0, 0], backgroundColor: ['#FF5630', '#36B37E'], borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { y: { beginAtZero: true, suggestedMax: 100 } } }
    });

    const ctxH = document.getElementById('healthDonut').getContext('2d');
    healthDonut = new Chart(ctxH, {
        type: 'doughnut',
        data: { datasets: [{ data: [100, 0], backgroundColor: ['#36B37E', '#091E42'], borderWidth: 0, cutout: '85%' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, animation: { duration: 800 } }
    });
}