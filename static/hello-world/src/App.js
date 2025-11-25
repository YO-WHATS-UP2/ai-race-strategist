import React, { useEffect, useState } from "react";
// Import the invoke function from the Forge bridge
import { invoke } from "@forge/bridge";

// --- (Day 10) STYLING ---
// Basic inline styles to look like a "Pit Wall"
const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    color: "#FFFFFF",
    backgroundColor: "#172B4D", // Atlassian Dark Blue
    padding: "16px",
    borderRadius: "8px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "16px",
  },
  status: {
    fontSize: "16px",
    padding: "8px",
    backgroundColor: "#0052CC",
    borderRadius: "4px",
    marginBottom: "16px",
  },
  error: {
    fontSize: "16px",
    padding: "8px",
    backgroundColor: "#DE350B", // Atlassian Red
    borderRadius: "4px",
    marginBottom: "16px",
  },
  specGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "16px",
  },
  specBox: {
    backgroundColor: "#091E42", // Darker Blue
    padding: "12px",
    borderRadius: "4px",
  },
  specLabel: {
    fontSize: "12px",
    color: "#B3BAC5", // Light grey
    textTransform: "uppercase",
  },
  specValue: {
    fontSize: "20px",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#0065FF",
    color: "#FFFFFF",
    padding: "12px 16px",
    borderRadius: "4px",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
  },
};

// --- (Day 10) MAIN REACT COMPONENT ---
function App() {
  const [status, setStatus] = useState("Loading spec data...");
  const [error, setError] = useState(null);
  const [specs, setSpecs] = useState(null);

  // --- On component mount, load the spec data ---
  useEffect(() => {
    setError(null);
    invoke("main-resolver", { type: "GET_SPEC_DATA" })
      .then((specData) => {
        console.log("Got spec data from backend:", specData);
        setSpecs(specData);
        setStatus("Ready to start test.");
      })
      .catch((err) => {
        console.error("Error fetching spec data:", err);
        setError("Could not load spec data. Is this ticket linked to a spec sheet?");
        setStatus("Error");
      });
  }, []);

  // --- "Start Test" button handler ---
  const handleStartTest = () => {
    setStatus("Simulating telemetry... This may take a moment.");
    setError(null);
    invoke("main-resolver", { type: "START_TELEMETRY" })
      .then(() => {
        setStatus("Simulation complete. Getting stream...");
        // Now that the simulation is "done", get the full stream
        // (This is where Day 11's polling logic will go)
        return invoke("main-resolver", { type: "GET_TELEMETRY" });
      })
      .then((telemetryStream) => {
        console.log("Got telemetry stream:", telemetryStream);
        setStatus(`Test complete. ${telemetryStream.length} data points recorded.`);
        // TODO (Day 11): Load models and analyze this stream
      })
      .catch((err) => {
        console.error("Error starting test:", err);
        setError("Failed to run simulation.");
        setStatus("Error");
      });
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>AI Pit Wall (Day 10)</div>

      {/* --- STATUS & ERROR BANNERS --- */}
      {error && <div style={styles.error}>{error}</div>}
      {!error && <div style={styles.status}>{status}</div>}

      {/* --- SPEC SHEET DATA --- */}
      {specs && (
        <div style={styles.specGrid}>
          <div style={styles.specBox}>
            <div style={styles.specLabel}>Max Vibration (Hz)</div>
            <div style={styles.specValue}>{specs.max_vibration || "N/A"}</div>
          </div>
          <div style={styles.specBox}>
            <div style={styles.specLabel}>Max Temp (°C)</div>
            <div style={styles.specValue}>{specs.max_temperature || "N/A"}</div>
          </div>
          <div style={styles.specBox}>
            <div style={styles.specLabel}>Max Aero Load (N)</div>
            <div style={styles.specValue}>{specs.max_aero_load || "N/A"}</div>
          </div>
        </div>
      )}

      {/* --- CONTROLS --- */}
      <button
        style={styles.button}
        onClick={handleStartTest}
        disabled={!specs || status.includes("Simulating")}
      >
        {status.includes("Simulating") ? "Test in Progress..." : "Start Test"}
      </button>

      {/* --- CHARTS (To be added on Day 11) --- */}
      <div style={{ marginTop: '20px', color: '#B3BAC5' }}>
        (Day 11: Live Telemetry & Anomaly Charts will go here)
      </div>

    </div>
  );
}

export default App;