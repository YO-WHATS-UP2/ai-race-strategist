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
const CURRENT_TICKET = "KAN-42"; 
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

    // 3. Initialize 3D
    setTimeout(() => { init3D(); }, 500);

    // 4. Load AI Models
    try {
        modelAnomaly = await tf.loadLayersModel('./models/model_anomaly_v3/model.json');
        modelSimulator = await tf.loadLayersModel('./models/model_simulator_v2/model.json');
    } catch (e) { console.warn("Using Math Fallback"); }

    // 5. Bind Inputs
    const btnTest = document.getElementById('btnTest');
    if (btnTest) btnTest.onclick = startTestRun;

    const inputThickness = document.getElementById('inputThickness');
    const inputLoad = document.getElementById('inputLoad');
    if(inputThickness) inputThickness.oninput = updateSimulation;
    if(inputLoad) inputLoad.oninput = updateSimulation;

    // 6. Bind Radio
    const btnRadio = document.getElementById('btnRadio');
    if (btnRadio) btnRadio.onclick = toggleRadio;

    // 7. Bind Rovo Chat
    const btnSendChat = document.getElementById('btnSendChat');
    const inputChat = document.getElementById('chatInput');
    if (btnSendChat) btnSendChat.onclick = () => sendRovoMessage(); // Fix PointerEvent bug
    if (inputChat) {
        inputChat.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                sendRovoMessage();
            }
        });
    }

    // 8. Background Processes
    setInterval(updateDashboardStats, 2000);
    updateDashboardStats();
    setInterval(backgroundTelemetryFetch, 1000);

    updateSimulation();
}

// ==========================================
// 🤖 ROVO SIMULATOR (SMARTER & BUG FREE)
// ==========================================
window.triggerRovoQuickAction = function(text) {
    sendRovoMessage(text);
};

// ==========================================
// 🤖 ROVO SIMULATOR (FIXED: Dynamic Ticket & Link)
// ==========================================
// ==========================================
// 🤖 ROVO SIMULATOR (FINAL: Robust Ticket Logic)
// ==========================================
async function sendRovoMessage(overrideText = null) {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if (!input || !history) return;

    // 1. Get User Input
    let userText = typeof overrideText === 'string' ? overrideText : input.value.trim();
    if (!userText) return;

    // 2. SMART TICKET DETECTION (Case Insensitive)
    // Matches: "kan-54", "KAN-54", "kan 54", "KAN54"
    const ticketMatch = userText.match(/([a-z]+)[-\s]?(\d+)/i);
    
    let activeTicket = CURRENT_TICKET; // Default fallback
    let ticketNumber = "80"; // Default PR ID

    if (ticketMatch) {
        // Standardize: "kan" -> "KAN" + "-" + "54"
        const projectKey = ticketMatch[1].toUpperCase();
        const issueId = ticketMatch[2];
        activeTicket = `${projectKey}-${issueId}`;
        ticketNumber = issueId; // Use the ticket number for the PR link logic (optional)
    }

    // 3. Render User Message
    const userMsg = document.createElement('div');
    userMsg.innerHTML = `<strong style="color: #579DFF;">YOU:</strong> ${userText}`;
    userMsg.style.marginBottom = "10px";
    userMsg.style.textAlign = "right";
    history.appendChild(userMsg);
    input.value = "";

    // 4. Simulate Thinking
    const loadingMsg = document.createElement('div');
    loadingMsg.id = "loading-" + Date.now();
    loadingMsg.innerHTML = `<em style="color: #8993A4; font-size: 11px;">Agent is analyzing telemetry...</em>`;
    history.appendChild(loadingMsg);
    history.scrollTop = history.scrollHeight;

    await new Promise(r => setTimeout(r, 800));

    // 5. GENERATE RESPONSE
    let responseHTML = "";
    let isCritical = sharedState.vibration > 60;
    const color = isCritical ? "#FF5630" : "#36B37E"; 
    const bg = isCritical ? "rgba(255, 86, 48, 0.1)" : "rgba(54, 179, 126, 0.1)";

    const txt = userText.toLowerCase();

    // --- LOGIC TREE ---
    if (txt.includes("status") || txt.includes("report")) {
        if (isCritical) {
            responseHTML = `
                <div style="color: ${color}; font-weight: bold;">🚨 CRITICAL ANOMALY DETECTED</div>
                <div>Vibration: ${sharedState.vibration.toFixed(2)} Hz (Limit: 60Hz)</div>
                <div>Status: <span style="background:${color}; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">FAILURE IMMINENT</span></div>
                <div style="margin-top:5px; font-size:11px;">I recommend immediate analysis of ${activeTicket}.</div>
            `;
        } else {
            responseHTML = `
                <div style="color: ${color}; font-weight: bold;">✅ FLEET NOMINAL</div>
                <div>Vibration: ${sharedState.vibration.toFixed(2)} Hz</div>
                <div>All systems operating within normal parameters.</div>
            `;
        }
    } 
    else if (txt.includes("analyze") || txt.includes("incident") || ticketMatch) {
        // ✅ Uses the detected 'activeTicket' (e.g. KAN-54)
        responseHTML = `
            <div style="margin-bottom:5px;"><strong style="color:${color}">🔍 Incident Analysis: ${activeTicket}</strong></div>
            <ul style="margin:0; padding-left:20px; font-size:12px;">
                <li><strong>Root Cause:</strong> Resonance Mismatch (${sharedState.vibration.toFixed(1)}Hz)</li>
                <li><strong>AI Suggestion:</strong> Increase Strut Thickness (+3.5mm)</li>
                <li><strong>Confidence:</strong> 99.8% (Based on Training Set)</li>
            </ul>
            <div style="margin-top:8px; font-size:11px;">
                <strong>Next Step:</strong> Review Compliance or Auto-Fix?
            </div>
        `;
    }
    else if (txt.includes("fix") || txt.includes("solution") || txt.includes("pr")) {
        // ✅ LINK LOGIC: Defaults to PR #80 (your real one), or uses ticket # if you prefer
        // Currently set to always use your REAL link for safety.
        responseHTML = `
            <div><strong>🛠️ Autonomous Repair Protocol</strong></div>
            <div>I have generated a JSON Spec Sheet and opened a Pull Request.</div>
            <div style="margin-top:5px; font-size:11px; background:rgba(0,0,0,0.3); padding:5px; border-radius:4px;">
                <code>Adjust material_thickness = 8.5mm</code><br>
                <code>Set material_grade = Ti-64</code>
            </div>
            <div style="margin-top:5px;">
                <a href="https://bitbucket.org/sairam-bisoyi/ai-race-strategist-repo/pull-requests/80" target="_blank" style="color:#579DFF; text-decoration:none; font-weight:bold;">
                   🔗 bitbucket/.../pull-requests/80
                </a>
            </div>
        `;
    }
    else if (txt.includes("compliance") || txt.includes("regulations")) {
        responseHTML = `
            <div><strong>⚖️ FIA Compliance Check</strong></div>
            <ul style="margin:0; padding-left:20px; font-size:12px;">
                <li><strong>Article 3.4:</strong> Max Thickness 8.0mm <span style="color:#FFAB00;">(WARNING)</span></li>
                <li><strong>Article 5.1:</strong> Max Weight 500g <span style="color:#36B37E;">(PASS)</span></li>
            </ul>
            <div style="margin-top:5px;">AI has capped the thickness at <strong>8.0mm</strong> to remain legal.</div>
        `;
    }
    else {
        responseHTML = `I am the Race Strategist Agent. I can help with:<br>
        • "Fleet Status"<br>
        • "Analyze ${activeTicket}"<br>
        • "Show Auto-Fix"`;
    }

    // Render Agent Response
    const loadingEl = document.getElementById(loadingMsg.id);
    if(loadingEl) history.removeChild(loadingEl);

    const agentContainer = document.createElement('div');
    agentContainer.style.cssText = `margin-bottom: 15px; padding: 10px; border-radius: 0 8px 8px 8px; background-color: ${bg}; border-left: 3px solid ${color};`;
    
    agentContainer.innerHTML = `
        <div style="font-size:10px; color:${color}; margin-bottom:4px; font-weight:bold;">ROVO AGENT</div>
        <div style="color: #B3BAC5; line-height: 1.4;">${responseHTML}</div>
    `;
    
    const chipContainer = document.createElement('div');
    chipContainer.style.cssText = "margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;";

    if (isCritical && txt.includes("status")) {
        addChip(chipContainer, `Analyze ${activeTicket}`, color);
    } 
    else if (txt.includes("analyze") || ticketMatch) {
        addChip(chipContainer, "Show Auto-Fix", "#579DFF");
        addChip(chipContainer, "Check Compliance", "#FFAB00");
    }

    if (chipContainer.children.length > 0) agentContainer.appendChild(chipContainer);
    history.appendChild(agentContainer);
    history.scrollTop = history.scrollHeight;
}

function addChip(container, text, color) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.onclick = () => window.triggerRovoQuickAction(text);
    btn.style.cssText = `background:transparent; border:1px solid ${color}; color:${color}; padding:4px 8px; border-radius:12px; cursor:pointer; font-size:10px; transition:all 0.2s;`;
    btn.onmouseover = () => { btn.style.background = color; btn.style.color = "#091E42"; };
    btn.onmouseout = () => { btn.style.background = "transparent"; btn.style.color = color; };
    container.appendChild(btn);
}

// ==========================================
// 🧊 DIGITAL TWIN (THREE.JS)
// ==========================================
function init3D() {
    const container = document.getElementById("canvas3d");
    if (!container) return;
    if (is3DInitialized) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091E42); 

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 180;
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 3;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x36B37E, wireframe: true, transparent: true, opacity: 0.8 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const innerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x36B37E, transparent: true, opacity: 0.3 });
    const innerCube = new THREE.Mesh(innerGeo, innerMat);
    cube.add(innerCube); 

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

    const vib = sharedState.vibration || 50;
    let stress = Math.max(0, (vib - 50) / 40);
    stress = Math.min(stress, 1.2);

    const shake = stress * 0.15; 
    cube.position.x = (Math.random() - 0.5) * shake;
    cube.position.y = (Math.random() - 0.5) * shake;

    const rotSpeed = 0.01 + (stress * 0.05);
    cube.rotation.x += rotSpeed;
    cube.rotation.y += rotSpeed;

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

function stopSimulation() {
    isSimulationRunning = false;
    timeStep = 0;
    
    sharedState.vibration = 50; 
    sharedState.anomaly = 0.02;

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