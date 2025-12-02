// =====================================================
// 🧠 AI RACE STRATEGIST — ALIGNED WITH DAY 7 PLAN
// =====================================================

import api, { route, storage } from "@forge/api"; 
import Resolver from "@forge/resolver";

const resolver = new Resolver();

// 👇 FILL IN YOUR SLUGS HERE (As per Day 7 Plan)
const BB_WORKSPACE = "sairam-bisoyi"; 
const BB_REPO_SLUG = "ai-race-strategist-repo"; // <--- CHANGE THIS to your actual repo name

// =====================================================
// 1. UI RESOLVERS
// =====================================================

resolver.define("SAVE_CREDENTIALS", async (req) => {
  const { username, token } = req.payload;
  if (!username || !token) throw new Error("Missing details");

  // We save raw values. For Repos Tokens, we mainly need the token.
  await storage.setSecret('bb_username', username.trim());
  await storage.setSecret('bb_token', token.trim());
  
  return { success: true };
});

resolver.define("CHECK_AUTH_STATUS", async () => {
  const token = await storage.getSecret('bb_token');
  return { isConnected: !!token };
});

export const mainResolver = resolver.getDefinitions();

// =====================================================
// 2. TRIGGER HANDLER
// =====================================================

export async function triggerHandler(event) {
  const { key } = event.issue;
  console.log(`🔔 Trigger received for ${key}.`);

  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=labels`);
  const issueData = await response.json();
  const actualLabels = issueData.fields?.labels || [];

  if (actualLabels.includes("new-design")) {
    console.log(`✅ MATCH! Starting Strategist...`);
    await createDesignDraftHandler({ inputs: { jiraTicketKey: key } });
  }
}

// =====================================================
// 3. LOGIC HANDLER
// =====================================================

export async function createDesignDraftHandler(payload) {
  const { jiraTicketKey } = payload.inputs;
  console.log(`🤖 AI Action: createDesignDraft → ${jiraTicketKey}`);

  // --- STEP 1: BITBUCKET (Targeted Repo Access) ---
  const token = await storage.getSecret('bb_token');
  let repoContext = " (No repo access)";

  if (token) {
    try {
      console.log(`🔑 Accessing Repo: ${BB_WORKSPACE}/${BB_REPO_SLUG}...`);
      
      // ✅ ALIGNMENT: We check ONLY the specific repo defined in the plan.
      // This works perfectly with a Repository Token.
      const bbRes = await api.fetch(`https://api.bitbucket.org/2.0/repositories/${BB_WORKSPACE}/${BB_REPO_SLUG}`, {
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Accept': 'application/json' 
        }
      });

      if (bbRes.ok) {
        const repoData = await bbRes.json();
        // We proved we have access to the code!
        repoContext = `(Active Repo: ${repoData.full_name} - Main Branch: ${repoData.mainbranch.name})`;
        console.log(`✅ Bitbucket Connected: Access confirmed for ${repoData.full_name}`);
      } else {
        console.warn(`⚠️ Bitbucket Access Denied (${bbRes.status}). Check Repo Slug or Token.`);
      }
    } catch (e) {
      console.warn("⚠️ Bitbucket network error (Ignored):", e);
    }
  }

  try {
    // --- Step 2: Fetch Jira Data ---
    const jiraResponse = await api.asApp().requestJira(route`/rest/api/3/issue/${jiraTicketKey}?fields=summary,project,self`);
    const jiraData = await jiraResponse.json();
    const ticketSummary = jiraData.fields.summary;
    const jiraSiteUrl = "https://sairam-bisoyi.atlassian.net"; 

    // --- Step 3: SIMULATED AI ---
    console.log("🧠 Generating AI Specs...");
    const randomLoad = Math.floor(Math.random() * 5000) + 2000;
    const generatedSpecs = {
        "source": "AI Race Strategist (v2.1)",
        "context": `Analyzed ${ticketSummary} ${repoContext}`,
        "max_vibration": "45 Hz",
        "max_temperature": "120 °C",
        "max_load": `${randomLoad} N`,
        "material_suggestion": ticketSummary.toLowerCase().includes("wing") ? "Carbon Fiber (T800)" : "Titanium Alloy"
    };

    // --- Step 4: Create Confluence Page ---
    const pageTitle = `[Spec] ${ticketSummary} - ${Date.now().toString().slice(-4)}`;
    const SPACE_ID = "3735556"; // Your ID

    const storageBody = `
      <p>AI-generated spec sheet for <strong>${jiraTicketKey}</strong>.</p>
      <ac:structured-macro ac:name="code" ac:schema-version="1">
        <ac:parameter ac:name="language">json</ac:parameter>
        <ac:plain-text-body><![CDATA[${JSON.stringify(generatedSpecs, null, 2)}]]></ac:plain-text-body>
      </ac:structured-macro>
    `;

    const confRes = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: SPACE_ID,
        status: "current",
        title: pageTitle,
        body: { representation: "storage", value: storageBody }
      }),
    });

    if (!confRes.ok) {
       throw new Error("Confluence Error: " + await confRes.text());
    }

    const confData = await confRes.json();
    const confluenceUrl = `${jiraSiteUrl}/wiki${confData._links.webui}`;
    console.log("✅ Page Created:", confluenceUrl);

    // --- Step 5: Post Jira Comment ---
    await postJiraCommentFormatted(jiraTicketKey, pageTitle, confluenceUrl, generatedSpecs);

    return { status: "OK" };

  } catch (err) {
    console.error("❌ FAILED:", err);
    await api.asApp().requestJira(route`/rest/api/3/issue/${jiraTicketKey}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: `❌ AI Error: ${err.message}` }] }] } }),
    });
    return { status: "FAILED" };
  }
}

// -----------------------------------------------------
// 🎨 Helper — Post BEAUTIFUL comment to Jira
// -----------------------------------------------------
async function postJiraCommentFormatted(ticketKey, title, url, jsonSpecs) {
  const adfBody = {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "🏎️ " },
          { type: "text", text: "AI Race Strategist", marks: [{ type: "strong" }] },
          { type: "text", text: " activated." }
        ]
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Spec sheet created: " },
          { type: "text", text: title, marks: [{ type: "link", attrs: { href: url } }] }
        ]
      },
      {
        type: "codeBlock",
        attrs: { language: "json" },
        content: [{ type: "text", text: JSON.stringify(jsonSpecs, null, 2) }]
      }
    ]
  };

  await api.asApp().requestJira(route`/rest/api/3/issue/${ticketKey}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: adfBody }),
  });
}

// Stubs
export async function prescribeSolutionHandler(payload) { return { status: "OK" }; }
export async function run(event) { return { message: "Context Menu Stub" }; }
export async function invokeCreateDraft(payload) { return createDesignDraftHandler({ inputs: payload }); }
export async function createDesignDraftHandlerRovo(payload) { return createDesignDraftHandler({ inputs: { jiraTicketKey: payload.issue.key } }); }