// Popup script for extension icon click
console.log('[AnzeigenBoost] Popup loaded');

// Elements
const statusCard = document.getElementById('statusCard');
const statusText = document.getElementById('statusText');
const statusDetail = document.getElementById('statusDetail');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const reloadExtensionBtn = document.getElementById('reloadExtensionBtn');

// Check connection status
function checkConnection() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      statusCard.className = 'status-card status-disconnected';
      statusText.textContent = '❌ Extension Fehler';
      statusDetail.textContent = chrome.runtime.lastError.message;
      return;
    }
    
    if (response?.connected) {
      statusCard.className = 'status-card status-connected';
      statusText.textContent = '✅ Extension aktiv';
      statusDetail.textContent = 'Bereit für Verbindung';
    } else {
      statusCard.className = 'status-card status-disconnected';
      statusText.textContent = '⚠️ Nicht verbunden';
      statusDetail.textContent = 'Starte die Web-App';
    }
  });
}

// Open dashboard
openDashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' });
});

// Reload extension
reloadExtensionBtn.addEventListener('click', () => {
  chrome.runtime.reload();
  setTimeout(() => {
    statusText.textContent = '✅ Neu geladen';
    statusDetail.textContent = 'Extension wurde neugestartet';
    checkConnection();
  }, 500);
});

// Initial check
checkConnection();

// Refresh status every 5 seconds
setInterval(checkConnection, 5000);
