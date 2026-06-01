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

// --- FLASHCARD LOGIC ---
document.getElementById('flashcardBtn').addEventListener('click', () => {
    document.getElementById('flashcardModal').style.display = 'block';
    loadFlashcards();
});

// --- SETTINGS LOGIC ---
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'block';
    loadSettings();
});

// Close modal listeners
document.getElementById('closeFlashcardModal').addEventListener('click', () => {
    document.getElementById('flashcardModal').style.display = 'none';
});

document.getElementById('closeSettingsModal').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
});

// Flashcard tab switching
function openFlashcardTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// Flashcard functionality with Spaced Repetition (SM-2 algorithm)
let flashcards = [];
let currentCardIndex = 0;
let isShowingAnswer = false;
let reviewQueue = []; // Cards due for review

// SM-2 Algorithm Constants
const SM2_CONSTANTS = {
    MIN_INTERVAL: 1,
    MAX_INTERVAL: 365,
    EASINESS_BONUS: 0.1,
    EASINESS_PENALTY: 0.8,
    MIN_EASINESS: 1.3
};

async function loadFlashcards() {
    try {
        const data = await supabase.fetchNotes(100); // Fetch more for flashcards
        flashcards = data.filter(note => note.title.startsWith('🎴 Flashcard:')).map(note => {
            const parts = note.content.split('|||');
            const front = parts[0] || note.content;
            const back = parts[1] || '';
            const tags = parts[2] || '';

            // Parse SM-2 data if exists, otherwise use defaults
            let easeFactor = 2.5;
            let interval = 0;
            let repetitions = 0;
            let nextReview = Date.now();

            if (parts.length > 3) {
                try {
                    const sm2Data = JSON.parse(parts[3]);
                    easeFactor = sm2Data.ease || 2.5;
                    interval = sm2Data.interval || 0;
                    repetitions = sm2Data.repetitions || 0;
                    nextReview = sm2Data.nextReview || Date.now();
                } catch (e) {
                    // If parsing fails, use defaults
                }
            }

            return {
                id: note.id,
                front: front,
                back: back,
                tags: tags,
                easeFactor: easeFactor,
                interval: interval,
                repetitions: repetitions,
                nextReview: nextReview
            };
        }));

        // Filter cards due for review and sort by priority
        reviewQueue = flashcards
            .filter(card => card.nextReview <= Date.now())
            .sort((a, b) => a.nextReview - b.nextReview);

        if (flashcards.length === 0) {
            document.getElementById('flashcardList').innerHTML = '<p class="text-xs text-slate-500 italic px-1">No flashcards yet.</p>';
            document.getElementById('flashcardReview').innerHTML = '<p class="text-xs text-slate-500 italic px-1">No flashcards to review.</p>';
        } else {
            displayFlashcardList();
            if (reviewQueue.length > 0) {
                startFlashcardReview();
            } else {
                document.getElementById('flashcardReview').innerHTML = '<p class="text-xs text-slate-500 italic px-1">No flashcards due for review. Come back later or add new cards!</p>';
            }
        }
    } catch (e) {
        document.getElementById('flashcardList').innerHTML = '<p class="text-xs text-red-400">Sync Error</p>';
    }
}

function displayFlashcardList() {
    const searchTerm = document.getElementById('flashcardSearch').value.toLowerCase();
    const filterTags = document.getElementById('flashcardFilterTags').value.toLowerCase().split(',').map(tag => tag.trim());

    const filteredCards = flashcards.filter(card => {
        const matchesSearch = card.front.toLowerCase().includes(searchTerm) ||
                             card.back.toLowerCase().includes(searchTerm);
        const matchesTags = filterTags.length === 0 || filterTags.every(tag =>
            card.tags.toLowerCase().includes(tag));
        return matchesSearch && matchesTags;
    });

    const listEl = document.getElementById('flashcardList');
    if (filteredCards.length === 0) {
        listEl.innerHTML = '<p class="text-xs text-slate-500 italic px-1">No flashcards match your search.</p>';
        return;
    }

    listEl.innerHTML = filteredCards.map(card => `
        <div class="note-item">
            <div style="font-weight: 500; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${card.front.length > 30 ? card.front.substring(0, 30) + '...' : card.front}
            </div>
            <div style="font-size: 10px; color: var(--text-dim); margin-top: 4px;">
                Tags: ${card.tags || 'none'}
            </div>
        </div>
    `).join('');
}

function startFlashcardReview() {
    currentCardIndex = 0;
    isShowingAnswer = false;
    showFlashcard();
}

function showFlashcard() {
    const reviewDiv = document.getElementById('flashcardReview');
    if (flashcards.length === 0) {
        reviewDiv.innerHTML = '<p class="text-xs text-slate-500 italic px-1">No flashcards to review.</p>';
        document.getElementById('flashcardControls').classList.add('hidden');
        return;
    }

    const card = flashcards[currentCardIndex];
    document.getElementById('flashcardPrompt').textContent = card.front;
    document.getElementById('flashcardAnswer').textContent = card.back;
    document.getElementById('flashcardAnswer').classList.remove('visible');
    document.getElementById('flashcardControls').classList.add('hidden');
    document.getElementById('remainingCount').textContent = flashcards.length - currentCardIndex - 1;

    if (!isShowingAnswer) {
        document.getElementById('flipCard').textContent = 'Show Answer';
        document.getElementById('flipCard').onclick = () => {
            document.getElementById('flashcardAnswer').classList.add('visible');
            document.getElementById('flashcardControls').classList.remove('hidden');
            document.getElementById('flipCard').textContent = 'Next Card';
            document.getElementById('flipCard').onclick = nextFlashcard;
        };
    } else {
        document.getElementById('flashcardAnswer').classList.add('visible');
        document.getElementById('flashcardControls').classList.remove('hidden');
        document.getElementById('flipCard').textContent = 'Next Card';
        document.getElementById('flipCard').onclick = nextFlashcard;
    }
}

function nextFlashcard() {
    currentCardIndex++;
    if (currentCardIndex >= flashcards.length) {
        alert('You have reviewed all flashcards!');
        startFlashcardReview();
    } else {
        isShowingAnswer = false;
        showFlashcard();
    }
}

document.getElementById('flipCard').addEventListener('click', () => {
    if (document.getElementById('flipCard').textContent === 'Show Answer') {
        document.getElementById('flashcardAnswer').classList.add('visible');
        document.getElementById('flashcardControls').classList.remove('hidden');
        document.getElementById('flipCard').textContent = 'Next Card';
        document.getElementById('flipCard').onclick = nextFlashcard;
    } else {
        nextFlashcard();
    }
});

document.getElementById('saveFlashcard').addEventListener('click', async () => {
    const front = document.getElementById('flashcardFront').value.trim();
    const back = document.getElementById('flashcardBack').value.trim();
    const tags = document.getElementById('flashcardTags').value.trim();

    if (!front || !back) {
        alert('Please fill in both front and back of the flashcard.');
        return;
    }

    const statusEl = document.getElementById('status');
    statusEl.style.backgroundColor = '#eab308'; // Processing (Yellow)

    try {
        const content = `${front}|||${back}|||${tags}`;
        const res = await supabase.saveNote({
            title: `🎴 Flashcard: ${front.substring(0, 30)}${front.length > 30 ? '...' : ''}`,
            url: window.location.href,
            content: content
        });

        if (res.ok) {
            statusEl.style.backgroundColor = '#10b981'; // Success Green
            alert('Flashcard saved successfully!');
            document.getElementById('flashcardFront').value = '';
            document.getElementById('flashcardBack').value = '';
            document.getElementById('flashcardTags').value = '';
            loadFlashcards();
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Supabase Error:', error);
        statusEl.style.backgroundColor = '#ef4444'; // Error Red
    }
});

document.getElementById('flashcardSearch').addEventListener('input', displayFlashcardList);
document.getElementById('flashcardFilterTags').addEventListener('input', displayFlashcardList);

// Settings functionality
function loadSettings() {
    // Load saved settings or use defaults
    const workDuration = localStorage.getItem('pomodoroWork') || '25';
    const breakDuration = localStorage.getItem('pomodoroBreak') || '5';
    const theme = localStorage.getItem('themeSelect') || 'light';
    const enableNotifications = localStorage.getItem('enableNotifications') === 'true';
    const enableSounds = localStorage.getItem('enableSounds') === 'true';

    document.getElementById('pomodoroWork').value = workDuration;
    document.getElementById('pomodoroBreak').value = breakDuration;
    document.getElementById('themeSelect').value = theme;
    document.getElementById('enableNotifications').checked = enableNotifications;
    document.getElementById('enableSounds').checked = enableSounds;
}

document.getElementById('saveSettings').addEventListener('click', () => {
    const workDuration = document.getElementById('pomodoroWork').value;
    const breakDuration = document.getElementById('pomodoroBreak').value;
    const theme = document.getElementById('themeSelect').value;
    const enableNotifications = document.getElementById('enableNotifications').checked;
    const enableSounds = document.getElementById('enableSounds').checked;

    localStorage.setItem('pomodoroWork', workDuration);
    localStorage.setItem('pomodoroBreak', breakDuration);
    localStorage.setItem('themeSelect', theme);
    localStorage.setItem('enableNotifications', enableNotifications);
    localStorage.setItem('enableSounds', enableSounds);

    // Apply theme immediately
    applyTheme(theme);

    alert('Settings saved successfully!');
    document.getElementById('settingsModal').style.display = 'none';
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.style.backgroundColor = '#000000';
        document.body.style.color = '#ffffff';
    } else if (theme === 'light') {
        document.body.style.backgroundColor = '#0f172a';
        document.body.style.color = '#f1f5f9';
    } else { // system
        // Respect system preference
        const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (darkMode) {
            document.body.style.backgroundColor = '#000000';
            document.body.style.color = '#ffffff';
        } else {
            document.body.style.backgroundColor = '#0f172a';
            document.body.style.color = '#f1f5f9';
        }
    }
}

// Apply saved theme on load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('themeSelect') || 'light';
    applyTheme(savedTheme);
});

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