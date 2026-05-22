/**
 * STUDENT BUDDY PRO - Day 4 Final
 * Features: Pomodoro Timer, Supabase Cloud Sync, & Local AI Summarizer
 */

// --- CONFIGURATION ---
const supabase = {
    url: 'https://cxbvhixihsyukrrpnpra.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YnZoaXhpaHN5dWtycnBucHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjAyMDksImV4cCI6MjA5Mzk5NjIwOX0.yjvpxotZwQU7ui2m9BNB9RXe5mGN9UkTHhqSvhOlq-I',

    // Helper for POST requests
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

    // Helper for GET requests
    async fetchNotes(limit = 3) {
        const response = await fetch(`${this.url}/rest/v1/saved_notes?select=*&order=created_at.desc&limit=${limit}`, {
            headers: {
                'apikey': this.key,
                'Authorization': `Bearer ${this.key}`
            }
        });
        return response.json();
    }
};

// --- TIMER LOGIC (Day 1 Core) ---
let timeLeft = 25 * 60;
let timerId = null;

const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startTimer');

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

startBtn.addEventListener('click', () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        startBtn.textContent = 'Start';
        startBtn.style.backgroundColor = ''; // Reverts to CSS default
    } else {
        startBtn.textContent = 'Pause';
        startBtn.style.backgroundColor = '#ef4444'; // Red for pause
        timerId = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerId);
                alert("Time to take a break!");
            }
        }, 1000);
    }
});

// --- CLOUD LOGIC (Day 2 Advanced) ---
document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    
    try {
        statusEl.style.backgroundColor = '#eab308'; // Processing (Yellow)
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const res = await supabase.saveNote({
            title: tab.title,
            url: tab.url,
            content: "Quick save from extension"
        });

        if (res.ok) {
            statusEl.style.backgroundColor = '#10b981'; // Back to Green
            loadNotes(); // Refresh list
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Supabase Error:', error);
        statusEl.style.backgroundColor = '#ef4444'; // Error Red
    }
});

// --- AI SUMMARIZATION LOGIC (Day 4 Core) ---
document.getElementById('summarizeBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    
    statusEl.style.backgroundColor = '#eab308'; // Processing (Yellow)
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: "getText" }, async (response) => {
        if (!response || !response.text) {
            statusEl.style.backgroundColor = '#ef4444'; 
            alert("Could not read page content. Try refreshing the page.");
            return;
        }

        try {
            if (!window.ai || !window.ai.summarizer) {
                console.log("On-device AI not configured. Running simulation mode.");
                simulateAISummarization(response.text, tab, statusEl);
                return;
            }

            const summarizer = await window.ai.summarizer.create();
            const summary = await summarizer.summarize(response.text);
            
            await saveAISummaryToCloud(tab.title, tab.url, summary, statusEl);
            
        } catch (error) {
            console.error("AI Error:", error);
            statusEl.style.backgroundColor = '#ef4444';
            simulateAISummarization(response.text, tab, statusEl);
        }
    });
});

// Production Fallback
async function simulateAISummarization(text, tab, statusEl) {
    const cleanSentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    const keyTakeaways = cleanSentences.slice(0, 3).map(s => `• ${s}`).join('\n');
    const structuralSummary = `AI SUMMARY (Simulated):\nThis page covers "${tab.title}". Key points:\n${keyTakeaways}`;
    
    await saveAISummaryToCloud(tab.title, tab.url, structuralSummary, statusEl);
}

// Cloud sync helper for AI
async function saveAISummaryToCloud(title, url, summaryContent, statusEl) {
    try {
        const res = await supabase.saveNote({
            title: `✨ AI Summary: ${title}`,
            url: url,
            content: summaryContent
        });

        if (res.ok) {
            statusEl.style.backgroundColor = '#10b981'; // Success Green
            alert('AI Summary generated and synced to cloud!');
            loadNotes(); 
        } else {
            throw new Error();
        }
    } catch {
        statusEl.style.backgroundColor = '#ef4444';
    }
}

// --- RENDERING LOGIC ---
async function loadNotes() {
    const listEl = document.getElementById('notesList');
    try {
        const data = await supabase.fetchNotes();
        
        if (data.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-slate-500 italic px-1">No saves yet.</p>';
            return;
        }

        listEl.innerHTML = data.map(note => `
            <div class="note-item">
                <div style="font-weight: 500; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${note.title}
                </div>
                <div style="font-size: 10px; color: var(--text-dim); margin-top: 4px;">
                    ${new Date(note.created_at).toLocaleDateString()} • Saved to Cloud
                </div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<p class="text-xs text-red-400">Sync Error</p>';
    }
}

// Initialize on open
loadNotes();