const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_MAP = {"0,4,7": "Major", "0,3,7": "Minor", "0,4,7,10": "7th", "0,4,7,11": "Maj7", "0,3,7,10": "m7"};

let audioCtx, analyzer, data, source;
let isAnalyzing = false;
let isLocked = false;

const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');

// 1. START LOGIC
startBtn.onclick = async () => {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        source = audioCtx.createMediaStreamSource(stream);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 16384;
        source.connect(analyzer);
        data = new Float32Array(analyzer.frequencyBinCount);

        isAnalyzing = true;
        isLocked = false; // Ensure it's unlocked for a new session
        startBtn.innerText = "LISTENING...";
        startBtn.style.background = "#e67e22"; 
        update();
    } catch (e) {
        alert("Microphone error. Please ensure you have allowed access.");
    }
};

// 2. RESET LOGIC
resetBtn.onclick = () => {
    // Reloading is the safest way to clear the audio buffer and reset the UI
    location.reload(); 
};

// 3. MAIN ANALYZER LOOP
function update() {
    // If the user hit reset, stop the loop entirely
    if (!isAnalyzing) return;

    analyzer.getFloatFrequencyData(data);
    let currentActive = [];

    // Check all musical frequencies
    for (let i = 0; i < 12; i++) {
        let maxDb = -Infinity;
        for (let oct = 2; oct <= 5; oct++) {
            let freq = 440 * Math.pow(2, (i - 9 + (oct - 4) * 12) / 12);
            let bin = Math.round(freq * analyzer.fftSize / audioCtx.sampleRate);
            if (data[bin] > maxDb) maxDb = data[bin];
        }
        // Sensitivity threshold (-52 is sensitive enough for acoustic piano)
        if (maxDb > -52) currentActive.push(i);
    }

    // 4. DISPLAY & LOCK LOGIC
    // We only update the text if we haven't "Locked" yet
    if (currentActive.length > 0 && !isLocked) {
        const noteNames = currentActive.map(i => NOTES[i]);
        
        // Update the big Note display
        document.getElementById('note-display').innerText = noteNames.join(' ');
        
        // Identify the Root and Chord Type
        const root = currentActive[0];
        const relativePattern = currentActive.map(n => (n - root + 12) % 12).sort((a,b) => a-b).join(',');
        const chordType = CHORD_MAP[relativePattern] || "Chord";
        
        document.getElementById('chord-name').innerText = `${NOTES[root]} ${chordType}`;
        
        // Update the Harmony Meter
        let score = calculateHarmony(currentActive);
        document.getElementById('meter-fill').style.width = score + '%';
        document.getElementById('harmony-text').innerText = `Harmony Score: ${score}%`;

        // THE QUICK SNAP: After 0.2 seconds of hearing notes, freeze the UI
        setTimeout(() => {
            if (isAnalyzing) {
                isLocked = true; 
                startBtn.innerText = "CAPTURED";
                startBtn.style.background = "#27ae60"; // Turn green to show success
            }
        }, 500); 
    }

    // Keep the loop running so it can detect the next start
    requestAnimationFrame(update);
}

// 5. HARMONY CALCULATOR
function calculateHarmony(idx) {
    if (idx.length < 2) return 100;
    let penalty = 0;
    for (let i = 0; i < idx.length; i++) {
        for (let j = i + 1; j < idx.length; j++) {
            let diff = Math.abs(idx[i] - idx[j]) % 12;
            // Heavily penalize minor seconds (dissonance)
            if (diff === 1 || diff === 11) penalty += 50;
            // Penalize tritones
            if (diff === 6) penalty += 30;
        }
    }
    return Math.max(0, Math.min(100, 100 - penalty));
}