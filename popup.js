/**
 * STUDENT BUDDY PRO - Day 2 Final
 * Features: Pomodoro Timer & Supabase Cloud Sync
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
        // Change status to "processing" (Yellow)
        statusEl.style.backgroundColor = '#eab308'; 
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const res = await supabase.saveNote({
            title: tab.title,
            url: tab.url,
            content: "Quick save from extension"
        });

        if (res.ok) {
            statusEl.style.backgroundColor = '#10b981'; // Back to Green
            loadNotes(); // Refresh the list without reloading the popup
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Supabase Error:', error);
        statusEl.style.backgroundColor = '#ef4444'; // Error Red
    }
    document.getElementById('summarizeBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send a message to content.js
    chrome.tabs.sendMessage(tab.id, { action: "getText" }, (response) => {
        if (response) {
            console.log("Received text from page:", response.text);
            alert("Content Script captured text! Ready for AI summarizing tomorrow.");
        }
    });
});
});

async function loadNotes() {
    const listEl = document.getElementById('notesList');
    try {
        const data = await supabase.fetchNotes();
        
        if (data.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-slate-500 italic px-1">No saves yet.</p>';
            return;
        }

        // Replace the map section inside your loadNotes function:
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