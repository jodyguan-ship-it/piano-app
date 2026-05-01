const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_MAP = {"0,4,7": "Major", "0,3,7": "Minor", "0,4,7,10": "7th", "0,4,7,11": "Maj7", "0,3,7,10": "m7"};

let audioCtx, analyzer, data, source;
let isAnalyzing = false;
let isLocked = false; 

const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');

startBtn.onclick = async () => {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        source = audioCtx.createMediaStreamSource(stream);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 16384; // High resolution
        source.connect(analyzer);
        data = new Float32Array(analyzer.frequencyBinCount);

        isAnalyzing = true;
        isLocked = false; 
        startBtn.innerText = "LISTENING...";
        startBtn.style.background = "#e67e22"; 
        update();
    } catch (e) {
        alert("Mic error: " + e);
    }
};

resetBtn.onclick = () => {
    location.reload(); 
};

function update() {
    if (!isAnalyzing) return;

    analyzer.getFloatFrequencyData(data);
    let currentActive = [];

    for (let i = 0; i < 12; i++) {
        let maxDb = -Infinity;
        for (let oct = 2; oct <= 5; oct++) {
            let freq = 440 * Math.pow(2, (i - 9 + (oct - 4) * 12) / 12);
            let centerBin = Math.round(freq * analyzer.fftSize / audioCtx.sampleRate);
            
            // Check a small range (3 bins) instead of just one spot
            for (let b = centerBin - 1; b <= centerBin + 1; b++) {
                if (data[b] > maxDb) maxDb = data[b];
            }
        }
        // INCREASED SENSITIVITY to -60 to catch non-C notes
        if (maxDb > -60) currentActive.push(i);
    }

    if (currentActive.length > 0 && !isLocked) {
        // Remove duplicate notes if they appear in different octaves
        currentActive = [...new Set(currentActive)].sort((a, b) => a - b);
        
        const noteNames = currentActive.map(i => NOTES[i]);
        document.getElementById('note-display').innerText = noteNames.join(' ');
        
        const root = currentActive[0];
        const relativePattern = currentActive.map(n => (n - root + 12) % 12).sort((a,b) => a-b).join(',');
        const chordType = CHORD_MAP[relativePattern] || "Chord";
        
        document.getElementById('chord-name').innerText = `${NOTES[root]} ${chordType}`;
        
        let score = calculateHarmony(currentActive);
        document.getElementById('meter-fill').style.width = score + '%';
        document.getElementById('harmony-text').innerText = `Harmony Score: ${score}%`;

        // SCREEN LOCK: Increased to 0.4s to let non-C chords stabilize
        setTimeout(() => {
            isLocked = true; 
        }, 300); 

        // BUTTON LOCK: 2.0s
        setTimeout(() => {
            if (isAnalyzing) {
                startBtn.innerText = "CAPTURED";
                startBtn.style.background = "#27ae60";
            }
        }, 2000);
    }

    requestAnimationFrame(update);
}

function calculateHarmony(idx) {
    if (idx.length < 2) return 100;
    let penalty = 0;
    for (let i = 0; i < idx.length; i++) {
        for (let j = i + 1; j < idx.length; j++) {
            let diff = Math.abs(idx[i] - idx[j]) % 12;
            if (diff === 1 || diff === 11) penalty += 50;
            if (diff === 6) penalty += 30;
        }
    }
    return Math.max(0, Math.min(100, 100 - penalty));
}