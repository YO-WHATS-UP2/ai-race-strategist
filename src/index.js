// =====================================================
// 🧠 AI RACE STRATEGIST — PHASE 2 HYBRID BACKEND
// =====================================================
// Mapped strictly to the Phase 2 manifest.yml
// Handles: UI Resolvers, Context Menus, Triggers, and Rovo Actions
// =====================================================

import api, { route, storage } from "@forge/api";

/**
 * 🔐 AUTH HELPER
 * Initializes the Bitbucket OAuth provider defined in manifest.yml
 */
function getBitbucketClient() {
  // 'bitbucket-oauth' matches manifest -> providers -> auth
  // 'bitbucket-api' matches manifest -> remotes
  return api.asUser().withProvider('bitbucket-oauth', 'bitbucket-api');
}

// =====================================================
// 1. CONTEXT MENU HANDLER (New in Phase 2)
// =====================================================
// Manifest: modules -> function -> key: main -> handler: index.run
// Triggered by: confluence:contextMenu (Define word)
// =====================================================
export async function run(event) {
  // This handles the "Define word" context menu item
  const selectedText = event.extension.selectedText;
  
  console.log(`Context menu triggered on text: ${selectedText}`);

  // Simple modal or popup response (depending on your UI implementation)
  // For a context menu, we usually just log or perform an action.
  // Since your manifest links this to a function, we can just return a success status
  // or use the "display" property if you were using a webpanel.
  
  return {
    message: `You selected: ${selectedText}`
  };
}

// =====================================================
// 2. MAIN RESOLVER (UI ROUTER)
// =====================================================
// Manifest: modules -> function -> key: main-resolver -> handler: index.mainResolver
// Triggered by: Frontend invoke() calls
// =====================================================
export async function mainResolver(req) {
  const { payload, context } = req;
  const jiraTicketKey = context?.extension?.issue?.key;

  console.log(`mainResolver received: ${payload.type} for ${jiraTicketKey}`);

  try {
    switch (payload.type) {
      // --- AUTH CHECK ---
      case "CHECK_BITBUCKET_AUTH":
        const bitbucket = getBitbucketClient();
        if (!await bitbucket.hasCredentials()) {
          return await bitbucket.requestCredentials();
        }
        const userRes = await bitbucket.fetch('/2.0/user');
        const userData = await userRes.json();
        return { status: "connected", user: userData.display_name };
      
      // --- DATA FETCHING ---
      case "GET_SPEC_DATA":
        return await getSpecData(jiraTicketKey);
      case "START_TELEMETRY":
        return await startTelemetry(jiraTicketKey);
      case "GET_TELEMETRY":
        return await getTelemetry(jiraTicketKey);
      
      // --- STUBS ---
      case "TRIGGER_SOLUTION_ANALYSIS":
        console.warn(`(Stub) TRIGGER_SOLUTION_ANALYSIS for ${jiraTicketKey}`);
        return { status: "stub_success" };
      case "SAVE_COMMIT_LINK":
        console.warn(`(Stub) SAVE_COMMIT_LINK for ${jiraTicketKey}`);
        return { status: "stub_success" };
      
      default:
        throw new Error(`Unknown resolver type: ${payload.type}`);
    }
  } catch (error) {
    console.error(`mainResolver error (${payload.type}):`, error);
    throw error;
  }
}

// =====================================================
// 3. INTERNAL HELPERS (Data & Telemetry)
// =====================================================

async function getSpecData(jiraTicketKey) {
  const confluenceLink = await storage.get(jiraTicketKey);
  if (!confluenceLink?.confluencePageId)
    throw new Error(`No Confluence link found for ${jiraTicketKey}`);

  const specData = await storage.get(confluenceLink.confluencePageId);
  if (!specData?.specs)
    throw new Error(`No spec data found for page ${confluenceLink.confluencePageId}`);

  return specData.specs;
}

async function startTelemetry(jiraTicketKey) {
  const streamKey = `stream_${jiraTicketKey}`;
  let simulatedData = [];

  for (let i = 0; i < 200; i++) {
    let vibration, temp, load;
    if (i < 150) {
      vibration = 50 + Math.sin(i * 0.1) * 2 + (Math.random() - 0.5);
      temp = 85 - (i / 1000) * 5 + (Math.random() - 0.5) * 0.3;
      load = 1500 + Math.sin(i * 0.05) * 10 + (Math.random() - 0.5) * 2;
    } else {
      const j = i - 150;
      vibration = 50 + j * 0.5 + Math.sin(j * 0.5) * 5 + (Math.random() - 0.5) * 4;
      temp = 85 + (i / 200) * 10 + (Math.random() - 0.5) * 0.3;
      load = 1500 + Math.sin(i * 0.05) * 10 + (Math.random() - 0.5) * 2;
    }
    simulatedData.push([vibration, temp, load]);
  }

  await storage.set(streamKey, simulatedData);
  return { success: true, points: simulatedData.length };
}

async function getTelemetry(jiraTicketKey) {
  return (await storage.get(`stream_${jiraTicketKey}`)) || [];
}

// =====================================================
// 4. TRIGGER HANDLERS
// =====================================================
// Manifest: modules -> trigger -> key: issue-created-trigger -> handler: index.triggerHandler
// Manifest: modules -> function -> key: invoke-create-draft -> handler: index.invokeCreateDraft
// =====================================================

export async function triggerHandler(event) {
  const { key, fields } = event.issue;
  
  // 🔍 DAY 4 REQUIREMENT: Filter by label "new-design"
  const hasLabel = fields.labels && fields.labels.includes("new-design");

  if (!hasLabel) {
    console.log(`Issue ${key} created, but missing 'new-design' label. Skipping AI.`);
    return;
  }

  console.log(`🚀 Trigger fired for ${key} (Label match!). Invoking AI...`);

  // We call the "invoke-create-draft" function via the API to bridge to Rovo
  await api.asApp().invoke("invoke-create-draft", {
    jiraTicketKey: key
  });
}

export async function invokeCreateDraft(payload) {
  const { jiraTicketKey } = payload;
  
  // This calls the Rovo Action defined in `extensions`
  // Note: ensure 'action-create-draft' matches extensions -> rovo:action -> key
  return await rovo.actions.invoke("action-create-draft", {
    jiraTicketKey,
  });
}


// =====================================================
// 5. ROVO ACTION HANDLERS
// =====================================================
// Manifest: modules -> function -> key: create-design-draft-handler -> handler: index.createDesignDraftHandler
// Manifest: modules -> function -> key: prescribe-solution-handler -> handler: index.prescribeSolutionHandler
// =====================================================

export async function createDesignDraftHandler(payload) {
  // Rovo inputs come in payload.inputs
  const { jiraTicketKey } = payload.inputs;
  console.log(`Rovo Action: createDesignDraft → ${jiraTicketKey}`);

  // --- 🔐 AUTH CHECK ---
  const bitbucket = getBitbucketClient();
  if (!await bitbucket.hasCredentials()) {
    // Rovo will prompt the user to authenticate if this is returned
    return await bitbucket.requestCredentials();
  }

  try {
    // --- Step 1: Fetch Jira issue
    const jiraResponse = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${jiraTicketKey}?fields=summary,project,self`);
    const jiraData = await jiraResponse.json();

    const ticketSummary = jiraData.fields.summary;
    const jiraSiteUrl = jiraData.self.split(".atlassian.net")[0] + ".atlassian.net";

    // --- Optional: Fetch Bitbucket Context ---
    const bbRes = await bitbucket.fetch('/2.0/repositories?role=member&pagelen=5');
    let repoContext = "";
    if (bbRes.ok) {
        const bbData = await bbRes.json();
        const repoNames = bbData.values ? bbData.values.map(r => r.full_name).join(', ') : 'None';
        repoContext = `(User has access to repos: ${repoNames})`;
    }

    // --- Step 2: Generate specs with Rovo AI ---
    const aiPrompt = `
      Act as a senior F1 engineer. Based on the Jira ticket summary "${ticketSummary}",
      generate a JSON object of realistic test parameters for a new part:
      {"max_vibration": <Hz>, "max_temperature": <°C>, "max_load": <N>, "material_suggestion": <string>}
      Respond ONLY with valid JSON.
      ${repoContext}
    `;

    const aiResponse = await rovo.chat.create({ prompt: aiPrompt });
    const text = (await aiResponse.text()) || "{}";
    
    // Safety cleanup for JSON parsing (sometimes AI adds markdown ticks)
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const generatedSpecs = JSON.parse(cleanJson);

    console.log("AI-generated specs:", generatedSpecs);

    // --- Step 3: Create Confluence spec sheet ---
    const spaceKey = "SAI"; // Ensure this Space Key exists in your Confluence!
    const pageTitle = `[Spec Sheet] ${ticketSummary} - ${Date.now()}`; // Added timestamp to avoid title conflicts

    const pageBody = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `AI-generated spec sheet for ${jiraTicketKey}.` },
          ],
        },
      ],
    };

    const confRes = await api.asApp().requestConfluence(route`/wiki/rest/api/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page",
        title: pageTitle,
        space: { key: spaceKey },
        body: {
          atlas_doc_format: {
            value: JSON.stringify(pageBody),
            representation: "atlas_doc_format",
          },
        },
      }),
    });

    if (!confRes.ok) throw new Error(await confRes.text());
    const confData = await confRes.json();
    const pageId = confData.id;
    const confluenceUrl = `${jiraSiteUrl}/wiki${confData._links.webui}`;

    // --- Step 4: Store linkage + specs ---
    await storage.set(pageId, { specs: generatedSpecs });
    await storage.set(jiraTicketKey, { confluencePageId: pageId });

    // --- Step 5: Post Jira comment ---
    await postJiraComment(
      jiraTicketKey,
      `**AI Race Strategist activated.**
      
      A new Confluence spec sheet has been created:
      [${pageTitle}|${confluenceUrl}]
      
      Generated parameters:
      \`\`\`json
      ${JSON.stringify(generatedSpecs, null, 2)}
      \`\`\`
      
      _Authenticated with Bitbucket for cross-workspace context._`
    );

    console.log(`Design draft completed for ${jiraTicketKey}`);
    return { status: "OK" };
  } catch (err) {
    console.error("createDesignDraftHandler FAILED:", err);
    await postJiraComment(jiraTicketKey, `AI Strategist failed: ${err.message}`);
    return { status: "FAILED" };
  }
}

export async function prescribeSolutionHandler(payload) {
  const { jiraTicketKey } = payload.inputs;
  console.log(`(Stub) prescribeSolution → ${jiraTicketKey}`);

  const bitbucket = getBitbucketClient();
  if (!await bitbucket.hasCredentials()) {
    return await bitbucket.requestCredentials();
  }

  await postJiraComment(jiraTicketKey, "(Stub) AI prescription triggered. Bitbucket Auth Verified.");
  return { status: "OK" };
}

// -----------------------------------------------------
// 💬 Helper — Post comment to Jira issue
// -----------------------------------------------------
async function postJiraComment(jiraTicketKey, text) {
  const adfBody = {
    type: "doc",
    version: 1,
    content: text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };

  await api.asApp().requestJira(route`/rest/api/3/issue/${jiraTicketKey}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: adfBody }),
  });
}