// Speech-to-Text
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
const user1SourceLanguage = document.getElementById('user1-source-language');
const user1TargetLanguage = document.getElementById('user1-target-language');
const user2SourceLanguage = document.getElementById('user2-source-language');
const user2TargetLanguage = document.getElementById('user2-target-language');
const recordButtons = document.querySelectorAll('.record-button');
const historySection = document.getElementById('history-section');
const historyContent = document.getElementById('history-content');
const historyButton = document.getElementById('history-button');

let currentUser = null;
let chatHistory = [];
let audioPlayCounts = {}; // Feature 11: Audio Replay Count

// Feature 13: Speech Recognition Timeout
recognition.maxAlternatives = 1;
recognition.continuous = false;
recognition.interimResults = false;
recognition.timeout = 10000; // 10 seconds timeout

// ड्रॉपडाउन वैल्यूज को चेक करने और डिफॉल्ट सेट करने का फंक्शन
function ensureDropdownValues() {
    if (!user1SourceLanguage || !user1TargetLanguage || !user2SourceLanguage || !user2TargetLanguage) {
        console.error("Dropdown elements not found!");
        alert("Error: Dropdown elements not found. Please refresh the page.");
        return false;
    }

    user1SourceLanguage.value = user1SourceLanguage.value || 'en';
    user1TargetLanguage.value = user1TargetLanguage.value || 'hi';
    user2SourceLanguage.value = user2SourceLanguage.value || 'hi';
    user2TargetLanguage.value = user2TargetLanguage.value || 'ja';

    console.log("Dropdown values ensured:");
    console.log(`User 1 - Source: ${user1SourceLanguage.value}, Target: ${user1TargetLanguage.value}`);
    console.log(`User 2 - Source: ${user2SourceLanguage.value}, Target: ${user2TargetLanguage.value}`);
    return true;
}

// Feature 8: Dark/Light Mode Toggle
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

// Feature 9: Multi-Language UI
async function updateUILabels() {
    const targetLang = currentUser === 1 ? user1TargetLanguage.value : user2TargetLanguage.value;
    const labels = [
        'Speak in:',
        'Listen in:',
        'Speak',
        'Listening...',
        'Chat History',
        'No history available.',
        'Show Chat History',
        'Hide Chat History',
        'User 1 (You)',
        'User 2 (Other Person)',
        'Detect Language',
        'Toggle Theme',
        'Delete History',
        'Download History',
        'Search in history...',
        'Font Size:'
    ];

    try {
        const response = await fetch('http://localhost:8080/translate', {
            method: 'POST',
            body: JSON.stringify({ ui_labels: labels, target: targetLang }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        const translatedLabels = data.translatedLabels;

        document.querySelectorAll('label[for="user1-source-language"]').forEach(el => el.childNodes[2].textContent = translatedLabels['Speak in:']);
        document.querySelectorAll('label[for="user1-target-language"]').forEach(el => el.childNodes[2].textContent = translatedLabels['Listen in:']);
        document.querySelectorAll('label[for="user2-source-language"]').forEach(el => el.childNodes[2].textContent = translatedLabels['Speak in:']);
        document.querySelectorAll('label[for="user2-target-language"]').forEach(el => el.childNodes[2].textContent = translatedLabels['Listen in:']);
        document.querySelectorAll('.record-button span').forEach(el => {
            if (el.textContent === 'Speak' || el.textContent === translatedLabels['Speak']) {
                el.textContent = translatedLabels['Speak'];
            }
        });
        document.querySelector('.history-section h2').textContent = translatedLabels['Chat History'];
        document.getElementById('history-button').childNodes[2].textContent = historySection.style.display === 'block' ? translatedLabels['Hide Chat History'] : translatedLabels['Show Chat History'];
        document.querySelector('.user-section h2:first-child').childNodes[2].textContent = translatedLabels['User 1 (You)'];
        document.querySelector('.user-section:last-child h2').childNodes[2].textContent = translatedLabels['User 2 (Other Person)'];
        document.querySelectorAll('.detect-language-button').forEach(el => el.textContent = translatedLabels['Detect Language']);
        document.querySelector('.theme-toggle-button').childNodes[2].textContent = translatedLabels['Toggle Theme'];
        document.querySelector('.delete-history-button').childNodes[2].textContent = translatedLabels['Delete History'];
        document.querySelector('.download-history-button').childNodes[2].textContent = translatedLabels['Download History'];
        document.getElementById('history-search').placeholder = translatedLabels['Search in history...'];
        document.querySelector('.font-size-control label').textContent = translatedLabels['Font Size:'];
    } catch (error) {
        console.log('Error translating UI labels:', error);
    }
}

// Feature 2: Manual Language Detection
async function detectLanguage(userNumber) {
    currentUser = userNumber;
    recognition.start();
}

// हिस्ट्री को टॉगल करने का फंक्शन
function toggleHistory() {
    if (historySection.style.display === 'none' || historySection.style.display === '') {
        historySection.style.display = 'block';
        historyButton.innerHTML = '<img src="images/chat-icon.png" alt="Chat Icon"> Hide Chat History';
        renderHistory();
    } else {
        historySection.style.display = 'none';
        historyButton.innerHTML = '<img src="images/chat-icon.png" alt="Chat Icon"> Show Chat History';
    }
    updateUILabels();
}

// Feature 3: Delete History
function deleteHistory() {
    chatHistory = [];
    audioPlayCounts = {};
    renderHistory();
}

// Feature 4: Download History
function downloadHistory() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chatHistory));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'chat_history.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Feature 7: Copy Text
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Text copied to clipboard!');
    });
}

// Feature 10: Search History
function searchHistory() {
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const filteredHistory = chatHistory.filter(entry =>
        entry.inputText.toLowerCase().includes(searchTerm) ||
        entry.translatedText.toLowerCase().includes(searchTerm)
    );
    renderFilteredHistory(filteredHistory);
}

// Feature 14: Adjust Font Size
function adjustFontSize(size) {
    document.querySelectorAll('.history-entry p').forEach(p => {
        p.style.fontSize = `${size}px`;
    });
}

// Feature 15: Edit History Entry
async function editHistoryEntry(index) {
    const newText = prompt('Edit your input text:', chatHistory[index].inputText);
    if (newText && newText.trim() !== '') {
        const entry = chatHistory[index];
        const sourceLang = entry.user === 1 ? user1SourceLanguage.value : user2SourceLanguage.value;
        const targetLang = entry.user === 1 ? user1TargetLanguage.value : user2TargetLanguage.value;

        try {
            const response = await fetch('http://localhost:8080/translate', {
                method: 'POST',
                body: JSON.stringify({ q: newText, source: sourceLang, target: targetLang }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const ttsResponse = await fetch('http://localhost:8080/tts', {
                method: 'POST',
                body: JSON.stringify({ text: data.translatedText, lang: targetLang }),
                headers: { 'Content-Type': 'application/json' }
            });
            const ttsData = await ttsResponse.json();
            if (ttsData.error) throw new Error(ttsData.error);

            chatHistory[index] = {
                user: entry.user,
                inputText: newText,
                translatedText: data.translatedText,
                audio: ttsData.audio_base64,
                errorDetails: data.errorDetails
            };
            renderHistory();
        } catch (error) {
            console.log('Error editing history entry:', error);
            alert('Failed to edit and translate the text.');
        }
    }
}

// हिस्ट्री को रेंडर करने का फंक्शन
function renderHistory() {
    if (chatHistory.length === 0) {
        historyContent.innerHTML = '<p>No history available.</p>';
        return;
    }

    historyContent.innerHTML = chatHistory.map((entry, index) => `
        <div class="history-entry">
            <div>
                <p><strong>User ${entry.user}:</strong> ${entry.inputText}</p>
                <p><strong>Translated:</strong> ${entry.translatedText}</p>
                ${entry.errorDetails ? `<button class="error-button" onclick="alert('${entry.errorDetails.replace(/'/g, "\\'")}')">Show Errors</button>` : ''}
            </div>
            <div class="audio-controls">
                <button class="play-button" onclick="playAudio('${entry.audio}', ${index})">
                    <img src="images/play-icon.png" alt="Play Icon"> Play (${audioPlayCounts[index] || 0})
                </button>
                <!-- Feature 5: Audio Speed Control -->
                <div class="audio-speed-control">
                    <label>Speed:</label>
                    <select onchange="setAudioSpeed(this.value, ${index})">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                <!-- Feature 6: Audio Volume Control -->
                <div class="audio-volume-control">
                    <label>Volume:</label>
                    <input type="range" min="0" max="1" step="0.1" value="1" oninput="setAudioVolume(this.value, ${index})">
                </div>
                <!-- Feature 7: Copy Buttons -->
                <button class="copy-button" onclick="copyText('${entry.inputText}')">Copy Input</button>
                <button class="copy-button" onclick="copyText('${entry.translatedText}')">Copy Translated</button>
                <!-- Feature 15: Edit Button -->
                <button class="edit-button" onclick="editHistoryEntry(${index})">Edit</button>
            </div>
        </div>
    `).join('');
}

// Filtered history rendering for search (Feature 10)
function renderFilteredHistory(filteredHistory) {
    if (filteredHistory.length === 0) {
        historyContent.innerHTML = '<p>No matching history found.</p>';
        return;
    }

    historyContent.innerHTML = filteredHistory.map((entry, index) => `
        <div class="history-entry">
            <div>
                <p><strong>User ${entry.user}:</strong> ${entry.inputText}</p>
                <p><strong>Translated:</strong> ${entry.translatedText}</p>
                ${entry.errorDetails ? `<button class="error-button" onclick="alert('${entry.errorDetails.replace(/'/g, "\\'")}')">Show Errors</button>` : ''}
            </div>
            <div class="audio-controls">
                <button class="play-button" onclick="playAudio('${entry.audio}', ${index})">
                    <img src="images/play-icon.png" alt="Play Icon"> Play (${audioPlayCounts[index] || 0})
                </button>
                <div class="audio-speed-control">
                    <label>Speed:</label>
                    <select onchange="setAudioSpeed(this.value, ${index})">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                <div class="audio-volume-control">
                    <label>Volume:</label>
                    <input type="range" min="0" max="1" step="0.1" value="1" oninput="setAudioVolume(this.value, ${index})">
                </div>
                <button class="copy-button" onclick="copyText('${entry.inputText}')">Copy Input</button>
                <button class="copy-button" onclick="copyText('${entry.translatedText}')">Copy Translated</button>
                <button class="edit-button" onclick="editHistoryEntry(${index})">Edit</button>
            </div>
        </div>
    `).join('');
}

let audioElements = {};

// Feature 5 & 6: Audio Speed and Volume Control
function setAudioSpeed(speed, index) {
    if (audioElements[index]) {
        audioElements[index].playbackRate = parseFloat(speed);
    }
}

function setAudioVolume(volume, index) {
    if (audioElements[index]) {
        audioElements[index].volume = parseFloat(volume);
    }
}

// Feature 11: Audio Replay Count
function playAudio(audioBase64, index) {
    audioPlayCounts[index] = (audioPlayCounts[index] || 0) + 1;
    renderHistory();

    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audioElements[index] = audio;
    audio.play().catch(error => {
        console.log('Audio playback error:', error);
        alert('Failed to play audio.');
    });
}

// ट्रांसलेशन शुरू करने का फंक्शन
async function startTranslation(userNumber) {
    if (!ensureDropdownValues()) return;

    currentUser = userNumber;
    const sourceLang = userNumber === 1 ? user1SourceLanguage.value : user2SourceLanguage.value;
    recognition.lang = sourceLang === 'auto' ? 'en-US' : sourceLang; // Default to en-US for auto-detect

    const recordButton = recordButtons[userNumber - 1];
    recordButton.classList.add('recording');
    recordButton.querySelector('span').textContent = 'Listening...';

    try {
        recognition.start();
    } catch (error) {
        console.log('Speech recognition error:', error);
        recordButton.classList.remove('recording');
        recordButton.querySelector('span').textContent = 'Speak';
        alert('Failed to start speech recognition. Please try again.');
    }
}

// Speech Recognition इवेंट्स
recognition.onresult = async (event) => {
    const recordButton = recordButtons[currentUser - 1];
    recordButton.classList.remove('recording');
    recordButton.querySelector('span').textContent = 'Speak';

    const transcript = event.results[0][0].transcript;
    console.log(`User ${currentUser} said: ${transcript}`);

    const sourceLang = currentUser === 1 ? user1SourceLanguage.value : user2SourceLanguage.value;
    const targetLang = currentUser === 1 ? user1TargetLanguage.value : user2TargetLanguage.value;

    try {
        // Feature 1: Auto-Detect Language
        let detectedSourceLang = sourceLang;
        if (sourceLang === 'auto') {
            const detectResponse = await fetch('http://localhost:8080/detect_language', {
                method: 'POST',
                body: JSON.stringify({ text: transcript }),
                headers: { 'Content-Type': 'application/json' }
            });
            const detectData = await detectResponse.json();
            if (detectData.error) throw new Error(detectData.error);
            detectedSourceLang = detectData.detectedLang;
            console.log(`Auto-detected language: ${detectedSourceLang}`);
        }

        // ट्रांसलेशन रिक्वेस्ट भेजें
        const response = await fetch('http://localhost:8080/translate', {
            method: 'POST',
            body: JSON.stringify({ q: transcript, source: detectedSourceLang, target: targetLang }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // TTS (Text-to-Speech) रिक्वेस्ट भेजें
        const ttsResponse = await fetch('http://localhost:8080/tts', {
            method: 'POST',
            body: JSON.stringify({ text: data.translatedText, lang: targetLang }),
            headers: { 'Content-Type': 'application/json' }
        });
        const ttsData = await ttsResponse.json();

        if (ttsData.error) throw new Error(ttsData.error);

        // हिस्ट्री में एंट्री डालें
        chatHistory.push({
            user: currentUser,
            inputText: transcript,
            translatedText: data.translatedText,
            audio: ttsData.audio_base64,
            errorDetails: data.errorDetails
        });

        // हिस्ट्री रेंडर करें
        renderHistory();

        // ऑडियो प्ले करें
        playAudio(ttsData.audio_base64, chatHistory.length - 1);

    } catch (error) {
        console.log('Translation/TTS error:', error);
        alert('Translation failed. Please try again.');
    }
};

recognition.onerror = (event) => {
    const recordButton = recordButtons[currentUser - 1];
    recordButton.classList.remove('recording');
    recordButton.querySelector('span').textContent = 'Speak';
    console.log('Speech recognition error:', event.error);
    alert('Speech recognition failed. Please try again.');
};

recognition.onend = () => {
    const recordButton = recordButtons[currentUser - 1];
    recordButton.classList.remove('recording');
    recordButton.querySelector('span').textContent = 'Speak';
};

// Feature 12: Offline Mode Alert
window.addEventListener('offline', () => {
    alert('You are offline. Please connect to the internet to use the translator.');
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ensureDropdownValues();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});
