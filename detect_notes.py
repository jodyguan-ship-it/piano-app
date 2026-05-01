import tkinter as tk
from tkinter import messagebox
import librosa
import numpy as np
import os
import sounddevice as sd
import soundfile as sf

# --- PREVENT MAC INTERFACE HANGS ---
os.environ['TK_SILENCE_DEPRECATION'] = '1'

# --- THE HARMONY ENGINE ---
def calculate_harmony(indices):
    """Analyzes the relationship between all detected notes for 'sweetness'."""
    if len(indices) < 2: return 100
    
    indices.sort()
    crunch = 0
    for i in range(len(indices)):
        for j in range(i + 1, len(indices)):
            dist = abs(indices[i] - indices[j]) % 12
            if dist == 1 or dist == 11: crunch += 55  # Clashing half-steps
            elif dist == 6: crunch += 40             # The 'Tritone'
            elif dist in [3, 4, 7]: crunch -= 30      # Harmonious intervals
    
    final_score = 100 - max(0, min(100, crunch + 20))
    return final_score

# --- THE RECORDER ---
def record_audio():
    fs = 44100  
    seconds = 3 
    label_status.config(text="● LISTENING...", fg="#ff4b2b")
    root.update()
    
    try:
        recording = sd.rec(int(seconds * fs), samplerate=fs, channels=1)
        sd.wait()  
        sf.write('analysis.wav', recording, fs)
        label_status.config(text="ANALYZING...", fg="#2ecc71")
        run_analysis()
    except Exception as e:
        messagebox.showerror("Error", f"Mic failed: {e}")
        label_status.config(text="IDLE", fg="#555")

# --- THE ANALYZER (GOLDILOCKS VERSION) ---
def run_analysis():
    if not os.path.exists('analysis.wav'): return
    
    y, sr = librosa.load('analysis.wav')
    # Use a higher margin to aggressively kill 'ghost' noise
    y_harmonic = librosa.effects.harmonic(y, margin=4.0) 
    
    # Increase bins to 48 for much higher resolution
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr, bins_per_octave=48)
    mean_chroma = np.mean(chroma, axis=1)
    
    if np.max(mean_chroma) > 0:
        mean_chroma = mean_chroma / np.max(mean_chroma)

    note_labels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    detected_indices = []

    for i in range(12):
        val = mean_chroma[i]
        prev_i = (i - 1) % 12
        next_i = (i + 1) % 12
        
        # INCREASED STRICTURE: 
        # The note must be at least 2.5x louder than the notes next to it
        # This prevents 'G' from showing up as a side-effect of F and A
        if val > 0.4:
            if val > (mean_chroma[prev_i] * 2.5) and val > (mean_chroma[next_i] * 2.5):
                detected_indices.append(i)

    detected_indices.sort()
    detected_names = [note_labels[i] for i in detected_indices]

# --- UI DESIGN ---
root = tk.Tk()
root.title("Stable Note Detector")
root.geometry("350x500")
root.configure(bg="#1a1a2e")

# Force window to top
root.lift()
root.attributes('-topmost', True)
root.after_idle(root.attributes, '-topmost', False)

tk.Label(root, text="STABLE DETECTOR", font=("Impact", 28), fg="white", bg="#3498db").pack(fill="x")

label_notes = tk.Label(root, text="Waiting...", font=("Arial", 22, "bold"), 
                       fg="#3498db", bg="#1a1a2e", wraplength=300, pady=50)
label_notes.pack()

label_harmony = tk.Label(root, text="---", font=("Arial", 18), fg="white", bg="#1a1a2e")
label_harmony.pack()

meter_canvas = tk.Canvas(root, width=300, height=20, bg="#16213e", highlightthickness=0)
meter_canvas.pack(pady=10)

label_status = tk.Label(root, text="IDLE", font=("Arial", 10, "bold"), fg="#555", bg="#1a1a2e")
label_status.pack(pady=20)

btn_record = tk.Button(root, text="ANALYZE NOTES", font=("Arial", 14, "bold"), 
                       command=record_audio, padx=20, pady=10)
btn_record.pack(side="bottom", pady=40)

root.mainloop()