import './bridge.js';

async function initPitWall() {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('authBtn');
  let bridge;

  try {
    bridge = await import('./bridge.js');
  } catch (e) {
    statusEl.innerText = "❌ Bridge Load Error"; 
    return; 
  }

  // Check Auth Status
  const authRes = await bridge.invoke('CHECK_AUTH_STATUS');

  if (authRes.isConnected) {
      statusEl.innerText = "✅ System Online (Credentials Saved)";
      statusEl.style.color = "green";
      btn.innerText = "🔄 Update Credentials";
      btn.style.backgroundColor = "#ffab00"; 
      btn.style.display = "inline-block"; 
  } else {
      statusEl.innerText = "⚠️ Setup Required";
      statusEl.style.color = "#172B4D";
      btn.innerText = "🔑 Enter Bitbucket Login";
      btn.style.display = "inline-block"; 
  }

  // Button Click Logic
  btn.onclick = async () => {
      // 1. Get Username
      const user = prompt("Enter your Bitbucket Username:");
      if(!user) return;

      // 2. Get Token
      const token = prompt("Enter your Bitbucket API Token:");
      if(!token) return;

      statusEl.innerText = "⏳ Saving...";
      
      try {
          // Send BOTH to the backend
          await bridge.invoke('SAVE_CREDENTIALS', { username: user, token: token });
          statusEl.innerText = "✅ Saved! Reloading...";
          setTimeout(() => location.reload(), 1000);
      } catch (e) {
          console.error(e);
          statusEl.innerText = "❌ Save Failed: " + e.message;
      }
  };
}

initPitWall();