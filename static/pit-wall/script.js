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

// 3D Globals
let cube, renderer, camera, scene;
let is3DInitialized = false;

// Config
const SEQUENCE_LENGTH = 10;
const ANOMALY_THRESHOLD = 0.65;

// SHARED STATE
let sharedState = {
    mode: "MATH",
    vibration: 50,
    temperature: 85,
    aeroLoad: 1500,
    anomaly: 0.02,
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

    // 3. Initialize 3D (With Delay to ensure DOM is ready)
    setTimeout(() => {
        init3D();
    }, 500);

    // 4. Load AI Models
    try {
        modelAnomaly = await tf.loadLayersModel('./models/model_anomaly_v3/model.json');
        modelSimulator = await tf.loadLayersModel('./models/model_simulator_v2/model.json');
        console.log("✅ Local AI Models Loaded");
    } catch (e) { console.warn("Using Math Fallback"); }

    // 5. Bind Frontend Simulation Button
    const btnTest = document.getElementById('btnTest');
    if (btnTest) btnTest.onclick = startTestRun;

    // 6. Bind Sliders
    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(inputThickness) inputThickness.oninput = updateSimulation;
    if(inputLoad) inputLoad.oninput = updateSimulation;

    // 7. Bind Radio
    const btnRadio = document.getElementById('btnRadio');
    if (btnRadio) btnRadio.onclick = toggleRadio;

    // 8. Background Processes
    setInterval(updateDashboardStats, 2000);
    updateDashboardStats();
    setInterval(backgroundTelemetryFetch, 1000);

    updateSimulation();
}

// ==========================================
// 🧊 DIGITAL TWIN (THREE.JS)
// ==========================================
function init3D() {
    const container = document.getElementById("canvas3d");
    if (!container) return;
    if (is3DInitialized) return;

    // Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091E42); 

    // Camera
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 180;
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 3;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Create Cube
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x36B37E, wireframe: true, transparent: true, opacity: 0.8 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const innerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x36B37E, transparent: true, opacity: 0.3 });
    const innerCube = new THREE.Mesh(innerGeo, innerMat);
    cube.add(innerCube); 

    // Handle Window Resize
    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    is3DInitialized = true;
    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (!cube) return;

    // Link Physics to Vibration State
    const vib = sharedState.vibration || 50;
    let stress = Math.max(0, (vib - 50) / 40);
    stress = Math.min(stress, 1.2);

    // Shake
    const shake = stress * 0.15; 
    cube.position.x = (Math.random() - 0.5) * shake;
    cube.position.y = (Math.random() - 0.5) * shake;

    // Rotate
    const rotSpeed = 0.01 + (stress * 0.05);
    cube.rotation.x += rotSpeed;
    cube.rotation.y += rotSpeed;

    // Color
    const targetColor = new THREE.Color();
    if (stress > 0.8) targetColor.setHex(0xFF5630);
    else if (stress > 0.4) targetColor.setHex(0xFFAB00);
    else targetColor.setHex(0x36B37E);

    cube.material.color.lerp(targetColor, 0.1);
    cube.children[0].material.color.lerp(targetColor, 0.1);

    renderer.render(scene, camera);
}

// ==========================================
// 🎙️ PIT RADIO LOGIC
// ==========================================
let recognition;
let isRadioActive = false;
let radioRestartTimer;

function initRadioSystem() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { console.warn("No Web Speech API"); return null; }

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = true;      
    rec.interimResults = false; 

    rec.onstart = () => {
        const btn = document.getElementById('btnRadio');
        if (btn) { btn.classList.add('listening'); btn.innerHTML = "🔴 CHANNEL OPEN"; }
    };

    rec.onresult = (event) => {
        const lastIdx = event.results.length - 1;
        const command = event.results[lastIdx][0].transcript.toLowerCase().trim();
        processVoiceCommand(command);
    };

    rec.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'network') return; 
        if (event.error === 'not-allowed') { stopRadioSystem(); alert("Microphone denied."); }
    };

    rec.onend = () => {
        if (isRadioActive) {
            clearTimeout(radioRestartTimer);
            radioRestartTimer = setTimeout(() => { try { rec.start(); } catch(e) {} }, 100); 
        } else {
            const btn = document.getElementById('btnRadio');
            if (btn) { btn.classList.remove('listening'); btn.innerHTML = "🎙️ PIT RADIO"; }
        }
    };
    return rec;
}

function toggleRadio() {
    if (!recognition) recognition = initRadioSystem();
    if (!recognition) return;
    if (isRadioActive) stopRadioSystem();
    else { isRadioActive = true; try { recognition.start(); } catch(e) {} }
}

function stopRadioSystem() {
    isRadioActive = false;
    if (recognition) recognition.stop();
}

function processVoiceCommand(cmd) {
    const synth = window.speechSynthesis;
    if (synth.speaking) synth.cancel();
    let replyText = "";

    if (cmd.includes("status") || cmd.includes("report")) {
        const vib = sharedState.vibration.toFixed(1);
        if (sharedState.vibration > 60) replyText = `Critical Alert. Vibration ${vib} Hz.`;
        else replyText = `Systems nominal. Vibration ${vib} Hz.`;
    }
    else if (cmd.includes("box") || cmd.includes("fix")) replyText = "Copy, box box. Analyzing solution.";
    else if (cmd.includes("weather")) replyText = "Track dry. Temp 28.";
    else if (cmd.length < 3) return; 
    else replyText = "Command not recognized.";

    if (replyText) {
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.rate = 1.1; 
        synth.speak(utterance);
    }
}

// ==========================================
// 1. BACKGROUND FETCHER
// ==========================================
async function backgroundTelemetryFetch() {
    if (!bridge) return;
    try {
        const now = Date.now();
        const latest = await bridge.invoke('fetchLiveTelemetry');
        if (latest && latest.timestamp && (now - latest.timestamp * 1000) < 60000) {
            sharedState.mode = "IOT";
            sharedState.vibration = latest.vibration;
            sharedState.temperature = latest.temperature;
            sharedState.aeroLoad = latest.aero_load;
            const statusEl = document.getElementById('connectionStatus');
            if(statusEl) { statusEl.innerText = "📡 Live Data"; statusEl.style.color = "#579DFF"; }
            if (!isSimulationRunning) startTestRun();
            return;
        }
    } catch (e) { }
    sharedState.mode = "MATH";
    const statusEl = document.getElementById('connectionStatus');
    if(statusEl) { statusEl.innerText = "⚡ Simulation"; statusEl.style.color = "#FFAB00"; }
}

// ==========================================
// 2. ANIMATION LOOP
// ==========================================
function startTestRun() {
    if (isSimulationRunning) return;
    const simTabBtn = document.querySelector("button[onclick=\"switchTab('telemetry')\"]");
    if(simTabBtn) simTabBtn.click();

    isSimulationRunning = true;
    isFailureReported = false; 
    dataBuffer = []; 
    const btnTest = document.getElementById('btnTest');
    btnTest.innerText = "Running...";
    btnTest.disabled = true;
    simulateTelemetryLoop();
}

function simulateTelemetryLoop() {
    if (!isSimulationRunning) return;

    let vibration;
    if (sharedState.mode === "IOT") {
        vibration = sharedState.vibration;
    } else {
        const isChaosMode = timeStep > 60; 
        vibration = 50 + Math.sin(timeStep * 0.1) * 2 + (Math.random() - 0.5);
        if (isChaosMode) vibration += (timeStep - 60) * 0.8 + (Math.random() * 5); 
    }

    // Feeds 3D
    sharedState.vibration = vibration;

    telemetryChart.data.labels.shift(); telemetryChart.data.labels.push('');
    telemetryChart.data.datasets[0].data.shift(); telemetryChart.data.datasets[0].data.push(vibration);
    telemetryChart.update('none'); 

    let anomalyScore = 0.02;
    if (vibration > 60) {
        anomalyScore = (vibration - 60) / 30; 
        anomalyScore = Math.min(Math.max(anomalyScore, 0.1), 1.0);
    }
    sharedState.anomaly = anomalyScore; 

    const anomalyText = document.getElementById('anomalyText');
    if(anomalyText) {
        anomalyText.innerText = anomalyScore.toFixed(2);
        anomalyText.style.color = anomalyScore > 0.5 ? '#FF5630' : '#36B37E';
    }
    
    anomalyChart.data.datasets[0].data.shift();
    anomalyChart.data.datasets[0].data.push(anomalyScore);
    anomalyChart.update('none');

    if (anomalyScore > ANOMALY_THRESHOLD && !isFailureReported) {
        lastCrashVibration = vibration;
        if(impactChart) {
            impactChart.data.datasets[0].data = [lastCrashVibration, 30.5]; 
            impactChart.update();
        }
        triggerFailureProtocol(anomalyScore, vibration);
    }

    timeStep++;
    if (sharedState.mode === "IOT") setTimeout(simulateTelemetryLoop, 50);
    else {
        if (timeStep < 400) setTimeout(simulateTelemetryLoop, 50);
        else stopSimulation();
    }
}

// ✅ RESET LOGIC ADDED HERE
function stopSimulation() {
    isSimulationRunning = false;
    timeStep = 0;
    
    // 1. Reset Physics (Turns Cube Green)
    sharedState.vibration = 50; 
    sharedState.anomaly = 0.02;

    // 2. Reset UI
    const anomalyText = document.getElementById('anomalyText');
    if(anomalyText) {
        anomalyText.innerText = "0.00";
        anomalyText.style.color = "#36B37E";
    }

    const btn = document.getElementById('btnTest');
    if(btn) { btn.innerText = "START CRASH TEST"; btn.disabled = false; }
}

async function triggerFailureProtocol(score, vib) {
    if (isFailureReported) return;
    isFailureReported = true;
    try {
        await bridge.invoke('triggerSolutionAnalysis', { 
            jiraTicketKey: "CURRENT_ISSUE",
            failureData: { max_vibration: vib.toFixed(2) + " Hz", anomaly_score: score.toFixed(4) }
        });
    } catch(e) { }
}

async function updateDashboardStats() {
    try {
        const data = await bridge.invoke('fetchDashboardData');
        if (!data) return;
        const score = parseFloat(data.health.score);
        if (healthDonut) {
            const isCrit = score < 80;
            healthDonut.data.datasets[0].backgroundColor = isCrit ? ['#FF5630', '#091E42'] : ['#36B37E', '#091E42'];
            healthDonut.data.datasets[0].data = [score, 100 - score];
            healthDonut.update();
        }
        document.getElementById('healthScore').innerText = score.toFixed(0);
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

function updateSimulation() {
    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(!inputThickness || !inputLoad) return;
    const thickness = parseFloat(inputThickness.value);
    const load = parseFloat(inputLoad.value);
    document.getElementById('valThickness').innerText = thickness.toFixed(1);
    document.getElementById('valLoad').innerText = load.toFixed(0);
    const predictedVib = 80 - (5 * thickness) + (0.005 * load);
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

function initCharts() {
    const commonOptions = { responsive: true, maintainAspectRatio: false, animation: false, elements: { point: { radius: 0 } }, scales: { x: { display: false }, y: { grid: { color: '#2C3E50' } } } };
    const ctx1 = document.getElementById('telemetryChart').getContext('2d');
    telemetryChart = new Chart(ctx1, { type: 'line', data: { labels: Array(50).fill(''), datasets: [{ label: 'Vibration', data: Array(50).fill(50), borderColor: '#579DFF', borderWidth: 2 }] }, options: { ...commonOptions, scales: { ...commonOptions.scales, y: { suggestedMin: 40, suggestedMax: 100 } } } });
    const ctx2 = document.getElementById('anomalyChart').getContext('2d');
    anomalyChart = new Chart(ctx2, { type: 'line', data: { labels: Array(50).fill(''), datasets: [{ label: 'Error Score', data: Array(50).fill(0), borderColor: '#FF5630', borderWidth: 2, fill: true, backgroundColor: 'rgba(255, 86, 48, 0.2)' }] }, options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: 0, max: 1.0 } } } });
    const ctx3 = document.getElementById('impactChart').getContext('2d');
    impactChart = new Chart(ctx3, { type: 'bar', data: { labels: ['Failure', 'AI Fix'], datasets: [{ data: [0, 0], backgroundColor: ['#FF5630', '#36B37E'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { y: { beginAtZero: true, suggestedMax: 100 } } } });
    const ctxH = document.getElementById('healthDonut').getContext('2d');
    healthDonut = new Chart(ctxH, { type: 'doughnut', data: { datasets: [{ data: [100, 0], backgroundColor: ['#36B37E', '#091E42'], borderWidth: 0, cutout: '85%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false }, animation: { duration: 800 } } });
}