class WorkoutTimer {
    constructor() {
        this.audioCtx = null;
        this.wakeLock = null;
        this.targetEndTime = 0;
        this.timerId = null;
        this.onTickCb = null;
        this.onCompleteCb = null;
        
        this.durationSeconds = 0;
        this.remainingSeconds = 0;
        this.isPaused = false;
        this.pauseRemaining = 0; // if paused, how much time was left
        this.lastBeepPlayed = -1;

        // Handle background/foreground transitions
        document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    }

    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playBeep(frequency, type, duration) {
        if (!this.audioCtx) return;
        try {
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(1, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn("Audio play failed", e);
        }
    }

    playTick() {
        this.playBeep(600, 'sine', 0.1); // Short blip
        if (navigator.vibrate) navigator.vibrate(50);
    }

    playChime() {
        this.playBeep(880, 'sine', 0.1);
        setTimeout(() => this.playBeep(1100, 'sine', 0.3), 100);
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    }

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.warn("Wake lock failed:", err);
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock !== null) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
            }).catch(err => console.warn(err));
        }
    }

    start(seconds, onTick, onComplete) {
        this.initAudio();
        this.requestWakeLock();
        
        this.durationSeconds = seconds;
        this.onTickCb = onTick;
        this.onCompleteCb = onComplete;
        this.isPaused = false;
        this.lastBeepPlayed = -1;
        
        this.targetEndTime = Date.now() + (seconds * 1000);
        
        this.clearLoop();
        this.loop();
    }

    pause() {
        if (this.isPaused || !this.targetEndTime) return;
        this.isPaused = true;
        this.clearLoop();
        this.pauseRemaining = Math.max(0, this.targetEndTime - Date.now());
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.targetEndTime = Date.now() + this.pauseRemaining;
        this.loop();
    }

    addTime(seconds) {
        if (this.isPaused) {
            this.pauseRemaining += (seconds * 1000);
            this.durationSeconds += seconds;
            if (this.onTickCb) {
                const fraction = 1 - (this.pauseRemaining / (this.durationSeconds * 1000));
                this.onTickCb(Math.ceil(this.pauseRemaining / 1000), fraction);
            }
        } else if (this.targetEndTime) {
            this.targetEndTime += (seconds * 1000);
            this.durationSeconds += seconds;
            // Prevent 3-2-1 beeps from firing immediately if time is added at exactly 3s
            this.lastBeepPlayed = -1; 
        }
    }

    skip() {
        this.clearLoop();
        this.releaseWakeLock();
        this.playChime();
        const cb = this.onCompleteCb;
        this.targetEndTime = 0;
        this.onTickCb = null;
        this.onCompleteCb = null;
        if (cb) cb();
    }
    
    stop() {
        this.clearLoop();
        this.releaseWakeLock();
        this.targetEndTime = 0;
        this.onTickCb = null;
        this.onCompleteCb = null;
    }

    clearLoop() {
        if (this.timerId !== null) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
    }

    loop() {
        if (this.isPaused) return;

        const now = Date.now();
        const remainingMs = this.targetEndTime - now;
        
        if (remainingMs <= 0) {
            this.clearLoop();
            this.releaseWakeLock();
            this.playChime();
            
            if (this.onTickCb) this.onTickCb(0, 1.0);
            const cb = this.onCompleteCb;
            
            // Clear state so returning to app doesn't re-trigger
            this.targetEndTime = 0;
            this.onTickCb = null;
            this.onCompleteCb = null;

            if (cb) cb();
            return;
        }

        const remainingSec = Math.ceil(remainingMs / 1000);
        const fraction = 1 - (remainingMs / (this.durationSeconds * 1000));

        // 3-2-1 Beeps
        if (remainingSec <= 3 && remainingSec > 0 && this.lastBeepPlayed !== remainingSec) {
            this.lastBeepPlayed = remainingSec;
            this.playTick();
        }

        if (this.onTickCb) {
            this.onTickCb(remainingSec, Math.min(1.0, Math.max(0, fraction)));
        }

        this.timerId = requestAnimationFrame(() => this.loop());
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // When app goes to background, clear the rapid RAF loop to save battery
            this.clearLoop();
        } else {
            // Returned to foreground
            if (this.wakeLock === null && !this.isPaused && this.targetEndTime > Date.now()) {
                this.requestWakeLock();
            }
            if (!this.isPaused && this.targetEndTime > 0) {
                // Resume loop, which will instantly recalculate against Date.now() 
                this.loop();
            }
        }
    }
}

// Expose a global instance
window.workoutTimer = new WorkoutTimer();
