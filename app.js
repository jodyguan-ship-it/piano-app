const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let audioCtx, analyzer, data;
let smoothedNotes = [];

document.getElementById('start-btn').onclick = async () => {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('main-ui').classList.remove('hidden');
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 16384; // MAX accuracy for browser
    analyzer.smoothingTimeConstant = 0.8; // Makes the display less "jittery"
    
    source.connect(analyzer);
    data = new Float32Array(analyzer.frequencyBinCount);
    update();
};

function update() {
    analyzer.getFloatFrequencyData(data);
    let currentActive = [];

    for (let i = 0; i < 12; i++) {
        let maxDb = -Infinity;
        // Check 4 octaves of the piano
        for (let oct = 2; oct <= 5; oct++) {
            let freq = 440 * Math.pow(2, (i - 9 + (oct - 4) * 12) / 12);
            let bin = Math.round(freq * analyzer.fftSize / audioCtx.sampleRate);
            if (data[bin] > maxDb) maxDb = data[bin];
        }
        // Sensitivity threshold (-55 is usually perfect for a quiet room)
        if (maxDb > -55) currentActive.push(i);
    }

    const noteNames = currentActive.map(i => NOTES[i]);
    document.getElementById('note-display').innerText = noteNames.length ? noteNames.join('+') : '---';
    
    let score = calc(currentActive);
    document.getElementById('harmony-text').innerText = `Harmony: ${score}%`;
    document.getElementById('meter-fill').style.width = score + '%';
    
    requestAnimationFrame(update);
}

function calc(idx) {
    if (idx.length < 2) return 100;
    let p = 0;
    for (let i = 0; i < idx.length; i++) {
        for (let j = i + 1; j < idx.length; j++) {
            let d = Math.abs(idx[i] - idx[j]) % 12;
            if (d === 1 || d === 11) p += 55; // Minor 2nd
            if (d === 6) p += 40;            // Tritone
            if ([3, 4, 7].includes(d)) p -= 20; // Consonants
        }
    }
    return Math.max(0, Math.min(100, 100 - (p + 10)));
}