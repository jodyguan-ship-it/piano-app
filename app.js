const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord Patterns (Relative to Root 0)
const CHORD_MAP = {
    "0,4,7": "Major",
    "0,3,7": "Minor",
    "0,4,7,10": "7th",
    "0,4,7,11": "Maj7",
    "0,3,7,10": "m7",
    "0,4,8": "Aug",
    "0,3,6": "Dim"
};

let audioCtx, analyzer, data;
let isRunning = true;

document.getElementById('start-btn').onclick = async () => {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('main-ui').classList.remove('hidden');
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 16384; 
    analyzer.smoothingTimeConstant = 0.8;
    
    source.connect(analyzer);
    data = new Float32Array(analyzer.frequencyBinCount);
    update();
};

document.getElementById('reset-btn').onclick = () => {
    document.getElementById('note-display').innerText = "---";
    document.getElementById('chord-name').innerText = "Ready...";
    document.getElementById('meter-fill').style.width = "0%";
    document.getElementById('harmony-text').innerText = "Harmony Score: 0%";
};

function update() {
    analyzer.getFloatFrequencyData(data);
    let currentActive = [];

    // Find active note frequencies
    for (let i = 0; i < 12; i++) {
        let maxDb = -Infinity;
        for (let oct = 2; oct <= 5; oct++) {
            let freq = 440 * Math.pow(2, (i - 9 + (oct - 4) * 12) / 12);
            let bin = Math.round(freq * analyzer.fftSize / audioCtx.sampleRate);
            if (data[bin] > maxDb) maxDb = data[bin];
        }
        if (maxDb > -58) currentActive.push(i);
    }

    // Display Notes
    const noteNames = currentActive.map(i => NOTES[i]);
    if (currentActive.length > 0) {
        document.getElementById('note-display').innerText = noteNames.join(' ');
        
        // Detect Chord Type
        const root = currentActive[0];
        const relativePattern = currentActive.map(n => (n - root + 12) % 12).sort((a,b) => a-b).join(',');
        const chordType = CHORD_MAP[relativePattern] || "Harmony";
        document.getElementById('chord-name').innerText = `${NOTES[root]} ${chordType}`;
        
        // Calculate and display Harmony Score
        let score = calculateHarmony(currentActive);
        document.getElementById('harmony-text').innerText = `Harmony Score: ${score}%`;
        document.getElementById('meter-fill').style.width = score + '%';
    }

    requestAnimationFrame(update);
}

function calculateHarmony(idx) {
    if (idx.length < 2) return 100;
    let penalty = 0;
    for (let i = 0; i < idx.length; i++) {
        for (let j = i + 1; j < idx.length; j++) {
            let diff = Math.abs(idx[i] - idx[j]) % 12;
            if (diff === 1 || diff === 11) penalty += 50; // Dissonant (Minor 2nd)
            if (diff === 6) penalty += 30;                 // Dissonant (Tritone)
            if ([3, 4, 7].includes(diff)) penalty -= 10;  // Consonant (3rds/5ths)
        }
    }
    return Math.max(0, Math.min(100, 100 - penalty));
}