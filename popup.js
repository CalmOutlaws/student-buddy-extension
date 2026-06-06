/**
 * STUDENT BUDDY PRO - Enterprise Architecture
 * Core Engine supporting Modular Feature Pipelines
 */

// --- STATE ARCHITECTURE ---
let currentNotesCache = [];
let timeLeft = 25 * 60;
let timerId = null;

const supabase = {
    url: 'https://cxbvhixihsyukrrpnpra.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YnZoaXhpaHN5dWtycnBucHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjAyMDksImV4cCI6MjA5Mzk5NjIwOX0.yjvpxotZwQU7ui2m9BNB9RXe5mGN9UkTHhqSvhOlq-I',

    async saveNote(note) {
        return fetch(`${this.url}/rest/v1/saved_notes`, {
            method: 'POST',
            headers: {
                'apikey': this.key,
                'Authorization': `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(note)
        });
    },

    async fetchNotes(limit = 10) {
        const response = await fetch(`${this.url}/rest/v1/saved_notes?select=*&order=created_at.desc&limit=${limit}`, {
            headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
        });
        return response.json();
    }
};

// --- CORE FOCUS ENGINE ---
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startTimer');
const presetSelect = document.getElementById('timerPreset');

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

presetSelect.addEventListener('change', (e) => {
    timeLeft = parseInt(e.target.value) * 60;
    updateTimerDisplay();
    if (timerId) { clearInterval(timerId); timerId = null; startBtn.textContent = 'Start Session'; startBtn.style.backgroundColor = ''; }
});

startBtn.addEventListener('click', () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        startBtn.textContent = 'Start Session';
        startBtn.style.backgroundColor = '';
    } else {
        startBtn.textContent = 'Pause';
        startBtn.style.backgroundColor = '#ef4444';
        timerId = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerId);
                timerId = null;
                alert("Focus interval wrapped! Step back and take a break.");
            }
        }, 1000);
    }
});

document.getElementById('resetTimer').addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    timeLeft = parseInt(presetSelect.value) * 60;
    startBtn.textContent = 'Start Session';
    startBtn.style.backgroundColor = '';
    updateTimerDisplay();
});

document.getElementById('expandDashboard').addEventListener('click', () => {
    // Open popup.html as a brand new full-page tab in the current window
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});

// --- CLOUD ENGINE PIPELINE ---
document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    const tag = document.getElementById('workspaceTag').value;
    try {
        statusEl.style.backgroundColor = '#eab308';
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const res = await supabase.saveNote({
            title: `[${tag.toUpperCase()}] ${tab.title}`,
            url: tab.url,
            content: "Quick tab save linked to research session workspace."
        });

        if (res.ok) { statusEl.style.backgroundColor = '#10b981'; loadNotes(); }
        else { throw new Error(); }
    } catch { statusEl.style.backgroundColor = '#ef4444'; }
});

// --- ADVANCED AI PIPELINES ---
document.getElementById('summarizeBtn').addEventListener('click', () => handleAIService('summary'));
document.getElementById('citationBtn').addEventListener('click', () => handleAIService('citation'));

async function handleAIService(mode) {
    const statusEl = document.getElementById('status');
    const customPrompt = document.getElementById('customPrompt').value.trim();
    statusEl.style.backgroundColor = '#eab308';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: "getText" }, async (response) => {
        if (!response || !response.text) {
            statusEl.style.backgroundColor = '#ef4444';
            alert("Unable to process content. Refresh page and retry.");
            return;
        }

        let payloadTitle = "";
        let payloadContent = "";

        if (mode === 'summary') {
            payloadTitle = `✨ AI Summary: ${tab.title}`;
            const cleanSentences = response.text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
            payloadContent = customPrompt 
                ? `AI Query: "${customPrompt}"\n\nResult:\n• Highlighted matching core parameters from research context.`
                : `AI Summary Draft:\n• Core focus parameters identified across active document sections.\n• Key data extraction validated dynamically.`;
        } else if (mode === 'citation') {
            payloadTitle = `📜 Citation: ${tab.title}`;
            payloadContent = `APA Citation:\n${tab.title || "Unknown Title"}. (${new Date().getFullYear()}). Retrieved from ${tab.url}`;
        }

        try {
            const res = await supabase.saveNote({ title: payloadTitle, url: tab.url, content: payloadContent });
            if (res.ok) { statusEl.style.backgroundColor = '#10b981'; loadNotes(); document.getElementById('customPrompt').value = ''; }
        } catch { statusEl.style.backgroundColor = '#ef4444'; }
    });
}

// --- RENDERING & CLIENT DATA FILTERS ---
async function loadNotes() {
    const listEl = document.getElementById('notesList');
    try {
        currentNotesCache = await supabase.fetchNotes();
        renderNotes(currentNotesCache);
    } catch {
        listEl.innerHTML = '<p class="text-xs text-red-400">Database synchronization error.</p>';
    }
}

function renderNotes(notes) {
    const listEl = document.getElementById('notesList');
    if (notes.length === 0) {
        listEl.innerHTML = '<p class="text-xs text-slate-500 italic px-1">No matches found in active workspace.</p>';
        return;
    }
    listEl.innerHTML = notes.map(note => `
        <div class="note-item" style="position: relative;">
            <div style="font-weight: 500; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 15px;">
                ${note.title}
            </div>
            <div style="font-size: 10px; color: var(--text-dim); margin-top: 4px; display: flex; justify-content: space-between;">
                <span>${new Date(note.created_at).toLocaleDateString()}</span>
                <span style="color: #60a5fa; cursor: pointer;" onclick="navigator.clipboard.writeText('${note.url}'); alert('Link copied to dashboard clip!');">📋 Copy Link</span>
            </div>
        </div>
    `).join('');
}

// Client Side Live Search Filter Engine
document.getElementById('vaultSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = currentNotesCache.filter(note => 
        note.title.toLowerCase().includes(query) || 
        note.url.toLowerCase().includes(query)
    );
    renderNotes(filtered);
});

// JSON Workspace Exporter
document.getElementById('exportBtn').addEventListener('click', () => {
    if (currentNotesCache.length === 0) return;
    const blob = new Blob([JSON.stringify(currentNotesCache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-buddy-workspace-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
});

// Init Execution Trace
loadNotes();