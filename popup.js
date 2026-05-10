// Day 1 Logic: Timer & UI State
let timeLeft = 25 * 60;
let timerId = null;

const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startTimer');

function updateDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

startBtn.addEventListener('click', () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        startBtn.textContent = 'Start';
        startBtn.classList.replace('bg-red-600', 'bg-blue-600');
    } else {
        startBtn.textContent = 'Pause';
        startBtn.classList.replace('bg-blue-600', 'bg-red-600');
        timerId = setInterval(() => {
            timeLeft--;
            updateDisplay();
            if (timeLeft <= 0) clearInterval(timerId);
        }, 1000);
    }
});
// Day 2: Supabase Integration
const SUPABASE_URL = 'sb_publishable_--B-Ndk3Ata6TO-rC7tokA_PMeAEFPH';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YnZoaXhpaHN5dWtycnBucHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjAyMDksImV4cCI6MjA5Mzk5NjIwOX0.yjvpxotZwQU7ui2m9BNB9RXe5mGN9UkTHhqSvhOlq-I';

document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    
    // Get the current active tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const noteData = {
        title: tab.title,
        url: tab.url,
        content: "Quick save from extension"
    };

    try {
        statusEl.classList.replace('bg-emerald-500', 'bg-yellow-500'); // Show "processing"
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/saved_notes`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(noteData)
        });

        if (response.ok) {
            statusEl.classList.replace('bg-yellow-500', 'bg-emerald-500');
            alert('Study link saved to dashboard!');
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        console.error(error);
        statusEl.classList.replace('bg-yellow-500', 'bg-red-500');
        alert('Error saving note.');
    }
});
async function loadNotes() {
    const listEl = document.getElementById('notesList');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/saved_notes?select=*&order=created_at.desc&limit=3`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await response.json();
        
        listEl.innerHTML = data.map(note => `
            <div class="p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-xs">
                <div class="text-slate-300 font-medium truncate">${note.title}</div>
                <div class="text-slate-500 truncate">${new Date(note.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<p class="text-xs text-red-400">Failed to load</p>';
    }
}

// Call on startup
loadNotes();