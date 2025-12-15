# 🏎️ AI Race Strategist — Atlassian Codegeist 2025

> **"What if your DevOps infrastructure had the reflexes of an F1 Pit Crew?"**

**AI Race Strategist** is an autonomous DevOps agent for Formula 1 teams, built on Atlassian Forge. It acts as a "Ghost Monitor" inside Jira, bridging the gap between physical hardware telemetry (IoT sensors) and software operations (Jira/Bitbucket/Confluence).

---

## 🔗 Quick Links
* **📦 Installation Link:** https://developer.atlassian.com/console/install/c7104b49-0a91-46dc-b2c6-de1b156b9b96?signature=AYABePm25aj4lYViJ1oiUL9Uy6gAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4IOp8r3eKNYw8z2v%2FEq3%2FfvrZguoGsXpNSaDveR%2FF%2Fo0BlQWj9z9bbXCbrieEXa33JwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDMk4hawebVWE7ZwZDgIBEIA7%2BO493n%2B7AumIRx24hqjrcRGHfcCMq%2Fr8ZVk%2F1VALGJhZK5G99AoBeYMUxoj1n0wMOWMcdPt0CdFsrxEAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHijmwVTMt6Oj3F%2B0%2B0cVrojrS8yZ9ktpdfDxqPMSIkvHAHEklvZ0nlyCgGos0Hg4unpAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM3DZwSfBotoxFtCiZAgEQgDvefDGmL0anQ%2FvUukqutqry5SdVu0%2FkFypSmrRQ3oWQr0VBs9LvBZS7y97J12yu6UHn1tPK1nhZvNYmWwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeLKa7Dfn9BgbXaQmJGrkKztjV4vrreTkqr7wGwhqIYs5ASrwollxX%2BPROye%2BH43pvVkAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwstHK2yFvAx5peCR4CARCAO12MEZvvmdRAr5YahoY5PbO%2BrpvmQnDAes18Oz2ZYNZ3S2jLgzjbkJtdJa%2FskZ3zc3nxd1qCpfmYAYZWAgAAAAAMAAAQAAAAAAAAAAAAAAAAACq6PY2a%2FwTKn%2BbtpALW5c7%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADInooRBeyhoT0MaQwsVrGn%2BvA%2FW4lXoVm0u7C1k%2BG3ZPiRKT6iDgo8q3loFDwxDqWJ3y%2Bb4M4lFoP%2FG7IV5fMObcpg%3D&product=jira&product=confluence
* **🎬 Demo Video:** 
* **📄 Devpost Submission:** 

---

## 🧪 Judge's Testing Guide (The "Happy Path")

Follow these steps to experience the full autonomous workflow:

### Phase 1: The "Crash Test" (Simulation)
1.  **Open any Jira Ticket** (e.g., `KAN-1` or create a new one).
2.  Open the **"🏁 Pit Wall (real)"** Issue Panel.
3.  Navigate to the **"Sim & Telemetry"** tab.
4.  Click the **"START CRASH TEST"** button.
    * *Observation:* Watch the 3D Digital Twin (Cube) turn **RED** and shake.
    * *Observation:* Watch the Graph spike to a critical anomaly.
5.  Check the **Jira Comments**:
    * You will see an automated **"🚨 FAILURE DETECTED"** comment posted by the system backend.

### Phase 2: The Rovo Agent (AI Analysis)
*You can test the Agent in two ways:*

**Option A: The Rovo Simulator (Inside the App)**
* Go to the **"Rovo Agent (Beta)"** tab in the app.
* Type: **"Analyze KAN-1"** (or your current ticket key).
* *Result:* The simulated agent will perform a Root Cause Analysis and provide a Bitbucket Fix Link.

**Option B: The Native Rovo Agent (If enabled on your instance)**
* Open the Rovo sidebar in Jira.
* Select the **"Race Strategist"** Agent.
* Prompt: **"Report Fleet Status"** or **"Analyze KAN-1"**.

### Phase 3: The Autonomous Fix
1.  In the Rovo Chat (or Simulator), click the **Bitbucket Link** provided.
2.  It will take you to a real Pull Request created by the AI (e.g., `fix/compliance-KAN-1`), showing the code change from `5.0mm` to `8.0mm`.
3.  Check **Confluence** (if linked) for the auto-generated "Post-Mortem Report."

---

## 📂 Codebase Navigation
Here is a map of the file structure to help you review the logic:

### 1. The Backend (`src/`)
* **`src/index.js`**: **(CORE LOGIC)** This single file contains the entire backend intelligence.
    * **Lines 10-50:** Bridge Resolvers (Handling the "Crash Test" trigger from frontend).
    * **Lines 100-180:** `prescribeSolutionHandler` (The AI Logic: Physics Calc + Compliance Check + Bitbucket PR generation).
    * **Lines 250+:** Rovo Agent Resolvers (`rovoGetStatus`, `rovoGetIncident`).

### 2. The Frontend (`static/`)
* **`static/pit-wall/`**: The main Jira Issue Panel.
    * **`script.js`**: Contains the **Three.js** logic for the 3D Cube and the **TensorFlow.js** inference engine.
    * **`index.html`**: The UI layout.

### 3. Configuration
* **`manifest.yml`**: The critical configuration file.
    * Defines the **`rovo:agent`** ("Race Strategist") and its System Prompt.
    * Defines the **`action`** modules (`get-live-status`) that connect the AI to the backend.
    * Defines the custom **OAuth2 Provider** (`bitbucket-oauth-v2`) used for the autonomous PR integration.

---

## ⚙️ Technology Stack
* **Platform:** Atlassian Forge (Node.js Runtime)
* **AI & Agents:** Atlassian Rovo, TensorFlow.js (Local Inference)
* **Visualization:** Three.js (WebGL Digital Twin), Chart.js
* **Integrations:** Jira Software, Bitbucket Cloud API, Confluence Cloud API

---

## ⚠️ Important Notes for Reviewers

### 1. Bitbucket OAuth2 Integration
The app uses a custom OAuth2 provider to perform actions on Bitbucket (creating branches/PRs). If you fork this repo, you must update the `clientId` in `manifest.yml` with your own Bitbucket Consumer credentials.

### 2. Rovo Simulator vs. Native Agent
Due to access limitations on my development instance during the hackathon, I built a **"Rovo Simulator"** tab within the app to visually demonstrate the agent's logic for the video. However, the **Native Rovo Agent** is fully configured in `manifest.yml` and is functional if installed on a Rovo-enabled instance.

---

**Built with ❤️ for the Atlassian Codegeist 2025 Hackathon.**
