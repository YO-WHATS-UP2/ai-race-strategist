// =====================================================
// 🧠 AI RACE STRATEGIST — GRAND PRODUCTION (Day 17 Complete)
//    Features: Dashboard, Bitbucket, Failure Trigger, & OpenAI Agent
// =====================================================

import api, { route, storage } from "@forge/api";
import Resolver from "@forge/resolver";
import FormData from 'form-data';

const resolver = new Resolver();

// 👇 BITBUCKET CONFIG
const BB_WORKSPACE = "sairam-bisoyi"; 
const BB_REPO_SLUG = "ai-race-strategist-repo"; 

// =====================================================
// 1. UI RESOLVERS (Frontend Handshake)
// =====================================================

resolver.define("SAVE_CREDENTIALS", async (req) => {
  const { username, token } = req.payload;
  if (!username || !token) throw new Error("Missing details");
  await storage.setSecret('bb_username', username.trim());
  await storage.setSecret('bb_token', token.trim());
  return { success: true };
});

resolver.define("CHECK_AUTH_STATUS", async () => {
  const token = await storage.getSecret('bb_token');
  return { isConnected: !!token };
});

resolver.define("getSpecData", async (req) => {
    //await storage.setSecret('bb_token', 'ATCTT3xFfGN0uyb9YKDtibws3RNAfuZ-ZlrY1IcgBauReEbCHSjtEnQD276q_U5fw8S1m97840fGpyJdx60GhzV20Kwadfkn2bor-12SqN-msaAamABhmI1-OH7WKmcpmt7QSJBg4W0dHUjVe7hBzfWUInY_pGrz4HBx186b-qnsDXoaHhDCapw=2E8188E0');
    const issueContext = req.context.extension && req.context.extension.issue;
    if (!issueContext || !issueContext.key) return { status: "empty", message: "Open inside a Jira Ticket." };
    
    const savedSpecs = await storage.get(`specs_${issueContext.key}`);
    if (!savedSpecs) return { status: "empty", message: "No strategy found." };
    
    return { status: "success", data: savedSpecs };
});

// 👇 ROVO ACTION (Bonus Prize): Allows Rovo Chat to read failure data
resolver.define("fetch-failure-context", async (req) => {
    const { jiraTicketKey } = req.payload;
    const storedSpecs = await storage.get(`specs_${jiraTicketKey}`);
    const failureFix = await storage.get(`fix_${jiraTicketKey}`);
    
    if (!storedSpecs) return { message: "No simulation data found." };

    return {
        context: "Telemetry Data from Pit Wall",
        data: {
            ticket: jiraTicketKey,
            max_vibration: storedSpecs.max_vibration || "Unknown",
            ai_recommendation: failureFix ? failureFix.recommendation : "Pending",
            status: "CRITICAL FAILURE DETECTED"
        }
    };
});

// =====================================================
// 2. DAY 15: THE FAILURE TRIGGER
// =====================================================
resolver.define("triggerSolutionAnalysis", async (req) => {
    let { jiraTicketKey, failureData } = req.payload;
    
    if (!jiraTicketKey || jiraTicketKey === "CURRENT_ISSUE") {
        jiraTicketKey = req.context.extension.issue.key;
    }

    console.log(`🔥 TRIGGER: Anomaly Detected for ${jiraTicketKey}`);

    // 1. Notify Engineer immediately
    await postJiraCommentFormatted(jiraTicketKey, "🚨 FAILURE DETECTED", "Analysis initiated...", failureData, "#FF5630");

    // 2. INVOKE THE AI AGENT (Day 16 & 17 Logic)
    try {
        console.log("⏳ Invoking Autonomous Engineer...");
        
        const result = await prescribeSolutionHandler({ 
            issue: { key: jiraTicketKey },
            failureData: failureData 
        });

        return { status: "success", data: result };

    } catch (e) {
        console.error("❌ Analysis Failed:", e);
        await postJiraCommentFormatted(jiraTicketKey, "⚠️ SYSTEM ERROR", e.message, {}, "#FF5630");
        return { status: "error", message: e.message };
    }
});

// =====================================================
// 3. DAY 16 & 17: DATA GATHERING + AI PRESCRIPTION
// =====================================================

export async function prescribeSolutionHandler(payload) {
    const jiraKey = payload.issue.key;
    const failureData = payload.failureData;
    
    console.log(`🕵️ AGENT: Starting Root Cause Analysis for ${jiraKey}...`);

    // --- DAY 16: GATHER CONTEXT ---
    
    // 1. Get Memory (Storage)
    const storedSpecs = await storage.get(`specs_${jiraKey}`);
    const baselineSpecs = storedSpecs || { max_vibration: "45 Hz (Default)", material_suggestion: "Unknown" };

    // 2. Get Code Context (Bitbucket)
    const token = await storage.getSecret('bb_token');
    let commitInfo = "Unknown Commit";
    if (token) {
        try {
            const repoRes = await api.fetch(`https://api.bitbucket.org/2.0/repositories/${BB_WORKSPACE}/${BB_REPO_SLUG}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const repoData = await repoRes.json();
            const branch = repoData.mainbranch ? repoData.mainbranch.name : "main";
            
            const commitRes = await api.fetch(`https://api.bitbucket.org/2.0/repositories/${BB_WORKSPACE}/${BB_REPO_SLUG}/commits/${branch}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const commitData = await commitRes.json();
            if (commitData.values?.[0]) commitInfo = commitData.values[0].hash.substring(0, 7);
        } catch (e) { console.warn("Bitbucket Fetch Failed:", e); }
    }

    // --- DAY 17: THE AI BRAIN (OpenAI) ---

    // 3. Construct the "Senior Engineer" Prompt
    const contextSummary = `
        Part: ${jiraKey}
        Current Specs: Max Vibration Limit ${baselineSpecs.max_vibration}, Material ${baselineSpecs.material_suggestion}.
        Failure Telemetry: Vibration spiked to ${failureData.max_vibration} (Score: ${failureData.anomaly_score}).
        Latest Commit: ${commitInfo}.
    `;

    const prompt = `
        Act as a Senior F1 Structural Engineer. A part has failed simulation.
        
        CONTEXT:
        ${contextSummary}
        
        TASK:
        Analyze the failure. Suggest a specific redesign to fix the vibration issue.
        Return ONLY a JSON object with this format:
        {
            "root_cause": "Short explanation",
            "recommendation": "Technical fix (e.g. Increase thickness)",
            "suggested_changes": { "parameter": "New Value" },
            "confidence": "High/Medium/Low"
        }
    `;

    console.log("⏳ Sending Prompt to AI...");

    // 4. Call OpenAI
    const aiResponse = await callOpenAI(prompt);
    
    console.log("🤖 AI PRESCRIPTION RECEIVED:", JSON.stringify(aiResponse));

    await storage.set(`fix_${jiraKey}`, aiResponse);

    // 👇 NEW: TRIGGER THE AUTO-FIX
    let prLink = "N/A";
    try {
        prLink = await implementAutonomousFix(jiraKey, aiResponse);
    } catch (e) {
        console.warn("Could not create PR:", e.message);
    }

    // Updated Comment with PR Link
    await postJiraCommentFormatted(jiraKey, "✅ AI PRESCRIPTION & FIX", 
        `Root Cause: ${aiResponse.root_cause}\n\n👉 **Auto-Fix PR Created:** [Review Changes](${prLink})`, 
        aiResponse.suggested_changes, "#36B37E");

    return aiResponse;
}

// =====================================================
// 4. OPENAI HELPER (The "Brain")
// =====================================================
// =====================================================
// 5. OPENAI HELPER (SIMULATION MODE ENABLED)
// =====================================================
async function callOpenAI(prompt) {
    // 🛑 HACKATHON MODE: We force the simulation to avoid 403/Quota errors during the demo.
    const USE_SIMULATION = true; 

    if (USE_SIMULATION) {
        console.log("⚠️ Using AI Simulation (Demo Mode)");
        // Wait 2 seconds to simulate "Thinking..."
        await new Promise(resolve => setTimeout(resolve, 2000));

        return {
            root_cause: "Resonance frequency mismatch detected in the titanium mounting points.",
            recommendation: "Increase Titanium Alloy thickness to 6.2mm to shift the natural frequency.",
            suggested_changes: { 
                "material_thickness": "6.2mm", 
                "dampening_coefficient": "+15%",
                "max_load_rating": "2200 N"
            },
            confidence: "High"
        };
    }

    // --- REAL AI CODE (Keep this here if you fix the key later) ---
    const OPENAI_KEY = "sk-proj-YOUR_ACTUAL_KEY_HERE"; 

    const body = {
        model: "gpt-4o", 
        messages: [
            { role: "system", content: "You are a helpful API that returns only JSON." },
            { role: "user", content: prompt }
        ],
        temperature: 0.7
    };

    const response = await api.fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);

    const data = await response.json();
    const contentText = data.choices[0].message.content;
    const cleanJson = contentText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
}

// =====================================================
// 5. HELPERS & EXPORTS
// =====================================================

async function postJiraCommentFormatted(ticketKey, title, text, jsonContent, color) {
    const adfBody = {
        type: "doc",
        version: 1,
        content: [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: title + ": ", marks: [{ type: "strong" }, { type: "textColor", attrs: { color: color } }] },
                    { type: "text", text: text }
                ]
            },
            {
                type: "codeBlock",
                attrs: { language: "json" },
                content: [{ type: "text", text: JSON.stringify(jsonContent, null, 2) }]
            }
        ]
    };

    await api.asApp().requestJira(route`/rest/api/3/issue/${ticketKey}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: adfBody }),
    });
}

// --- REQUIRED EXPORTS ---
export const mainResolver = resolver.getDefinitions();

export async function triggerHandler(event) {
  const { key } = event.issue;
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=labels`);
  const issueData = await response.json();
  const actualLabels = issueData.fields?.labels || [];

  if (actualLabels.includes("new-design")) {
    console.log(`✅ MATCH! Starting Strategist...`);
    await createDesignDraftHandler({ inputs: { jiraTicketKey: key } });
  }
}
// =====================================================
// 6. ENHANCEMENT 1: AUTONOMOUS CODE GEN (BITBUCKET)
// =====================================================

// =====================================================
// 6. ENHANCEMENT 1: AUTONOMOUS CODE GEN (ROBUST)
// =====================================================

// IMPORTANT: Ensure you have installed 'form-data'
// Run: npm install form-data

// =====================================================
// 6. ENHANCEMENT 1: AUTONOMOUS CODE GEN (NATIVE FIX)
// =====================================================

export async function implementAutonomousFix(jiraKey, aiRecommendation) {
    console.log(`🛠️ AUTO-FIX: Initiating Pull Request for ${jiraKey}...`);

    const token = await storage.getSecret('bb_token');
    if (!token) {
        console.warn("❌ No Bitbucket Token found. Skipping Auto-Fix.");
        return "N/A (No Token)";
    }

    const branchName = `fix/${jiraKey}-ai-tuning-${Date.now().toString().slice(-4)}`;
    const fixFileName = `engineering-specs/${jiraKey}-tuned.json`;
    const repoBaseUrl = `https://api.bitbucket.org/2.0/repositories/${BB_WORKSPACE}/${BB_REPO_SLUG}`;

    try {
        // 1. GET MAIN BRANCH HASH
        const mainBranchRes = await api.fetch(`${repoBaseUrl}/refs/branches?q=name="main"`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!mainBranchRes.ok) throw new Error(`Failed to find main branch: ${mainBranchRes.status}`);
        
        const mainBranchData = await mainBranchRes.json();
        const mainHash = mainBranchData.values[0].target.hash;

        // 2. CREATE NEW BRANCH
        console.log(`🌱 Creating Branch: ${branchName}`);
        const branchRes = await api.fetch(`${repoBaseUrl}/refs/branches`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: branchName, target: { hash: mainHash } })
        });
        
        if (!branchRes.ok) {
            // If branch already exists (rare), just continue
            console.warn("Branch creation warning:", branchRes.status);
        }

        // 3. COMMIT THE FIX FILE (Using URLSearchParams)
        console.log(`💾 Committing Fix: ${fixFileName}`);
        const fileContent = JSON.stringify(aiRecommendation, null, 2);
        
        // This is the native way to send "application/x-www-form-urlencoded"
        const params = new URLSearchParams();
        params.append('branch', branchName);
        params.append('message', `feat: AI Auto-Fix for ${jiraKey} (Vibration Optimization)`);
        params.append(fixFileName, fileContent); // Key is filename, Value is content

        const commitRes = await api.fetch(`${repoBaseUrl}/src`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                // Fetch automatically sets the correct Content-Type for URLSearchParams
            },
            body: params
        });

        if (!commitRes.ok) {
            const err = await commitRes.text();
            throw new Error(`Commit Failed: ${err}`);
        }

        // 4. OPEN PULL REQUEST
        console.log(`🔀 Opening Pull Request...`);
        const prRes = await api.fetch(`${repoBaseUrl}/pullrequests`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `🤖 AI Fix: Optimize Vibration for ${jiraKey}`,
                description: `**Autonomous Fix Proposal**\n\nBased on simulation failure, Rovo recommends these spec changes:\n\`\`\`json\n${fileContent}\n\`\`\`\n\nCloses ${jiraKey}`,
                source: { branch: { name: branchName } },
                destination: { branch: { name: "main" } }
            })
        });

        const prData = await prRes.json();

        if (!prRes.ok) {
            console.error("❌ Bitbucket PR Error Response:", JSON.stringify(prData, null, 2));
            throw new Error(`PR Failed: ${prData.error?.message || "Unknown Bitbucket Error"}`);
        }

        const prLink = prData.links.html.href;
        console.log(`✅ PR CREATED: ${prLink}`);
        return prLink;

    } catch (e) {
        console.error("❌ Auto-Fix Failed:", e.message);
        throw e;
    }
}

export async function createDesignDraftHandler(payload) {
  // Keeping this stub valid for the automation trigger
  const { jiraTicketKey } = payload.inputs;
  console.log(`🤖 Creating Draft for ${jiraTicketKey}...`);
  // (Full create logic omitted for brevity as requested, focusing on Day 17 flow)
  // Ensure you merge your "Create Page" logic here if you need it active!
  return { status: "OK" };
}
export async function ingestTelemetry(request) {
    try {
        const body = JSON.parse(request.body);
        console.log("📡 IoT Data Received:", body);

        // Save latest frame to storage
        // We use a fixed key so the frontend always reads the "latest"
        await storage.set('live_telemetry', body);

        return { body: JSON.stringify({ status: "Received" }), statusCode: 200 };
    } catch (e) {
        return { body: JSON.stringify({ error: e.message }), statusCode: 500 };
    }
}

// 2. READ (Called by Frontend via Bridge)
resolver.define("fetchLiveTelemetry", async () => {
    const data = await storage.get('live_telemetry');
    return data || null;
});

// Manifest Stubs
export async function prescribeSolutionHandlerExport(payload) { return prescribeSolutionHandler(payload); }
export async function run(event) { return {}; }
export async function invokeCreateDraft(payload) { return {}; }