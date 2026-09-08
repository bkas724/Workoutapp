// -----------------------------------------------------------------------------
// TIMEZONE-SAFE LOCAL DATE PARSING
// Avoids the JS new Date("YYYY-MM-DD") UTC midnight off-by-one bug
// -----------------------------------------------------------------------------
function parseLocalDate(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        if (trimmed.includes('T')) {
            return new Date(trimmed);
        }
    }
    return new Date(dateInput);
}
window.parseLocalDate = parseLocalDate;

function submitSpeedWorkout(stepId, subId, isBenchmark) {
    const minInput = document.getElementById('logged-min');
    const secInput = document.getElementById('logged-sec');
    const warning = document.getElementById('gatekeeper-warn');

    const mins = parseFloat(minInput.value);
    const secs = parseFloat(secInput.value);

    // Enforce data governance limits (Gating validation)
    if (isNaN(mins) || isNaN(secs) || minInput.value === "" || secInput.value === "") {
        warning.classList.remove('hidden');
        return;
    }
    warning.classList.add('hidden');

    // Process step completion status
    appState[stepId] = true;
    const timelineCb = document.getElementById(stepId);
    if (timelineCb) timelineCb.checked = true;

    // Capture the metrics directly to the subphases array
    const stepNum = stepId.substring(stepId.lastIndexOf('-') + 1);
    const stepObj = subphases.find(s => s.id === subId)?.steps[parseInt(stepNum)];
    if (stepObj) {
        stepObj.completed = true;
        stepObj.actualLoggedPace = `${mins}:${secs < 10 ? '0' + secs : secs}`;
    }

    // Handle Adaptive Physiological Recalculation if it is a benchmark day
    if (isBenchmark) {
        const actualWorkoutPaceDecimal = mins + (secs / 60);

        // Grab old baseline parameters
        const prevMins = parseFloat(document.getElementById('input-min').value) || 8;
        const prevSecs = parseFloat(document.getElementById('input-sec').value) || 10;
        const previousTargetBaselineDecimal = prevMins + (prevSecs / 60);

        // Execute the 70/30 EMA Formula
        const newBaselinePaceDecimal = (previousTargetBaselineDecimal * 0.70) + (actualWorkoutPaceDecimal * 0.30);

        // Convert the final updated decimal blueprint back to clean integers
        const finalMin = Math.floor(newBaselinePaceDecimal);
        const finalSec = Math.round((newBaselinePaceDecimal - finalMin) * 60);

        // Inject the updated baseline straight back to user data configuration views
        document.getElementById('input-min').value = finalMin;
        document.getElementById('input-sec').value = finalSec;

        if (document.getElementById('input-min-display')) {
            document.getElementById('input-min-display').innerText = finalMin;
            document.getElementById('input-sec-display').innerText = finalSec < 10 ? '0' + finalSec : finalSec;
        }

        console.log(`EMA recalibration triggered! Previous: ${prevMins}:${prevSecs}, Logged: ${mins}:${secs}, New Engine Base Calibration: ${finalMin}:${finalSec}`);
    }

    // Refresh UI components across layout streams
    updateSubphaseProgressBadge(subId);
    updateOverallProgressMeter();
    calculateTargetPaces(); // This will recalculate threshold slots
    saveStateToCloud(); // Explicitly push the speed workout metrics to Firestore
    renderNextActivityCard();
    updateStageProgress();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('block');
    });
    document.querySelectorAll(`.tab-${tabId}`).forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('block');
    });

    document.querySelectorAll('nav button').forEach(el => {
        el.classList.remove('text-indigo-400');
        el.classList.add('text-slate-500');
    });
    const btn = document.getElementById(`nav-btn-${tabId}`);
    if (btn) {
        btn.classList.remove('text-slate-500');
        btn.classList.add('text-indigo-400');
    }

    const header = document.getElementById('journey-header-card');
    const headerText = document.getElementById('header-text-toggle');
    const motivationBlock = document.getElementById('motivation-block-container');

    if (header) {
        if (tabId === 'home') {
            header.classList.remove('py-2', 'px-4');
            header.classList.add('p-4', 'md:p-5', 'mb-4');
            if (headerText) headerText.classList.remove('hidden');
            if (motivationBlock && motivationBlock.dataset.dismissed !== 'true' && motivationBlock.style.display !== 'none') {
                motivationBlock.classList.remove('hidden');
            }
            if (typeof userProfileData !== 'undefined' && userProfileData && typeof checkWeightReminderBanner === 'function') {
                checkWeightReminderBanner(userProfileData);
            }
        } else {
            header.classList.remove('p-4', 'md:p-5', 'mb-4');
            header.classList.add('py-2', 'px-4', 'mb-2');
            if (headerText) headerText.classList.add('hidden');
            if (motivationBlock) motivationBlock.classList.add('hidden');
        }
    }
}

/**
 * Curated Punchy Motivational Sayings Library (40 High-Impact Sayings)
 */
const MOTIVATION_SAYINGS = [
    // Group 1: Direct & Anti-Excuses
    "You can suck, but you can't skip.",
    "I wonder what would happen if you worked out today.",
    "Mood follows action. Move first.",
    "50% effort beats 0% every single time.",
    "Discipline is remembering what you wanted before you got comfortable.",
    "The voice telling you to skip has terrible cardio.",
    "Action cures anxiety. Every time.",
    "Nobody ever finished a workout and regretted it.",
    "Forget motivation. You need shoes and 20 minutes.",
    "Don't negotiate with your alarm clock. Just get up.",

    // Group 2: Funny, Sarcastic & Relatable
    "Run like an overcooked noodle. Still beats the couch.",
    "Lace up. Complain the whole way. Still counts.",
    "Treat it like brushing your teeth: quick, necessary, weird to skip.",
    "Your couch is comfy, but it won't fix your mood.",
    "Sweat now. Smug later.",
    "You didn't come this far just to quit on the couch.",
    "Your future self is watching. Don't embarrass them.",
    "Call it an aggressive walk with arm flailing. Just go.",
    "You're not slow. You're just maximizing outdoor time.",
    "Stop overthinking. 20 ugly minutes beats 0 perfect ones.",

    // Group 3: ADHD-Friendly & Low Barrier (Start Small)
    "Just put the shoes on. Momentum does the rest.",
    "Done beats perfect. 15 minutes of shuffling is a win.",
    "Half-assing a workout still gets the checkmark.",
    "Permission granted to do a terrible workout. Just log it.",
    "The hardest distance is the couch to the front door.",
    "Start now. Stop overthinking the start.",
    "One stride at a time. No heroics needed.",
    "Lower the bar. Step over it. Keep moving.",
    "Do the bare minimum. Let momentum take over.",
    "10 minutes out, 10 minutes back. That's it.",

    // Group 4: Guilt-Free & Sequence Flow
    "Sequence, not calendar. Pick up right where you left off.",
    "Boring consistency beats sporadic intensity every time.",
    "Zero guilt. Zero drama. Just one foot forward.",
    "One bad mile doesn't make a bad runner.",
    "Small deposits. Massive compounding.",
    "Run your own pace. Comparison is a trap.",
    "Fitness isn't lost in a few days. Reset and resume.",
    "Keep easy days easy. Slow builds fast.",
    "You're building a habit, not passing a test.",
    "Showing up when you don't feel like it is the whole game."
];

/**
 * Gets the next motivational saying using a persistent shuffle-deck to prevent immediate repeats.
 */
function getNextMotivationSaying() {
    let pool = [];
    try {
        const storedPool = localStorage.getItem('motivation_unseen_pool');
        if (storedPool) {
            pool = JSON.parse(storedPool);
        }
    } catch (e) {
        pool = [];
    }

    if (!Array.isArray(pool) || pool.length === 0) {
        // Refill pool with all indices and shuffle
        pool = Array.from({ length: MOTIVATION_SAYINGS.length }, (_, i) => i);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
    }

    const nextIndex = pool.pop();
    try {
        localStorage.setItem('motivation_unseen_pool', JSON.stringify(pool));
        localStorage.setItem('motivation_last_saying_index', nextIndex.toString());
    } catch (e) { }

    return MOTIVATION_SAYINGS[nextIndex] || MOTIVATION_SAYINGS[0];
}

/**
 * Initializes and displays the motivation popup once per week (or on demand),
 * with non-repeating sayings.
 */
function initMotivationPopup(forceShow = false) {
    const container = document.getElementById('motivation-block-container');
    const textEl = document.getElementById('motivation-text');
    if (!container || !textEl) return;

    const lastShown = localStorage.getItem('motivationLastShown');
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    if (forceShow || !lastShown || now - parseInt(lastShown, 10) > oneWeek) {
        const saying = getNextMotivationSaying();
        textEl.textContent = `"${saying}"`;
        container.style.display = 'flex';
        container.style.opacity = '1';
        container.dataset.dismissed = 'false';
        if (!forceShow) {
            localStorage.setItem('motivationLastShown', now.toString());
        }
    }
}

/**
 * Refreshes the currently displayed saying with another one from the deck without closing the popup.
 */
function refreshMotivationSaying() {
    const textEl = document.getElementById('motivation-text');
    if (!textEl) return;

    textEl.style.opacity = '0';
    setTimeout(() => {
        const saying = getNextMotivationSaying();
        textEl.textContent = `"${saying}"`;
        textEl.style.opacity = '1';
    }, 150);
}

/**
 * Closes the motivation popup and marks it dismissed for this session.
 */
function closeMotivationPopup() {
    const container = document.getElementById('motivation-block-container');
    if (!container) return;
    container.style.opacity = '0';
    container.dataset.dismissed = 'true';
    setTimeout(() => {
        container.style.display = 'none';
    }, 300);
}

tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: {
                    easy: '#22c55e', /* Green for easy runs */
                    speed: '#6366f1', /* Indigo for speed runs */
                    strength: '#f97316', /* Orange for strength */
                }
            }
        }
    }
};

/**
 * Converts decimal minute patterns (e.g. "5.25 mins", "5.25 reps", "1.5 min") into proper time strings ("5:15 min", "1:30 min").
 */
function formatDecimalMinutesString(str) {
    if (!str) return '';
    let result = String(str);
    result = result.replace(/(\d+)\.(\d+)\s*(?:mins?|minutes?|min|reps)/gi, (match, mStr, decStr) => {
        const val = parseFloat(`${mStr}.${decStr}`);
        const totalSec = Math.round(val * 60);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const isReps = /reps/i.test(match);
        if (s > 0) {
            return `${m}:${s < 10 ? '0' + s : s} min`;
        }
        return isReps ? `${m} reps` : `${m} min`;
    });
    return result;
}

/**
 * Splits a rep target string (e.g. "5:15 min", "400m", "1.5 mi") into distinct value and unit for clean UI rendering.
 */
function parseRepValueAndUnit(str, type) {
    if (!str) return { val: type === 'time' ? '5:00' : '400', unit: type === 'time' ? 'min' : 'm' };
    const clean = formatDecimalMinutesString(str).trim();
    
    // Time format (e.g. "5:15 min", "5:00 min", "5 min")
    const timeMatch = clean.match(/^(\d+:\d+|\d+(?:\.\d+)?)\s*(?:mins?|minutes?|min)?/i);
    if (timeMatch && (type === 'time' || clean.includes(':') || /min/i.test(clean))) {
        let val = timeMatch[1];
        if (!val.includes(':') && type === 'time') {
            const num = parseFloat(val);
            if (num % 1 !== 0) {
                const totalSec = Math.round(num * 60);
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                val = `${m}:${s < 10 ? '0' + s : s}`;
            } else {
                val = `${val}:00`;
            }
        }
        return { val, unit: 'min' };
    }
    
    // Distance format (e.g. "400m", "1.5 mi", "1000m")
    const distMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(m|meters?|mi|miles?|k|km)?/i);
    if (distMatch) {
        return { val: distMatch[1], unit: distMatch[2] || 'm' };
    }
    return { val: clean, unit: '' };
}

/**
 * Universal formatter for activity targets across playlists, hero stages, and cards.
 * Handles holds/seconds, time intervals (MM:SS), distance, failure, and reps cleanly.
 */
function formatTargetDisplay(act, options = {}) {
    if (!act) return '';
    const { includeSets = true, isCircuit = false, short = false } = options;
    const setsStr = (includeSets && act.sets && act.sets > 1 && !isCircuit) ? `${act.sets}×` : '';
    const setsPrefix = (includeSets && act.sets && act.sets > 1 && !isCircuit) ? `${act.sets} sets × ` : '';

    const targetType = (act.targetType || '').toLowerCase().trim();
    const targetUnit = (act.targetUnit || '').toLowerCase().trim();
    const val = (typeof act.targetValue === 'number' && act.targetValue > 0) ? act.targetValue : null;

    // 1. EXPLICIT REPS
    if (targetType === 'reps') {
        const sideStr = act.isPerSide ? (short ? '/side' : ' / side') : '';
        const repVal = val !== null ? val : (parseInt(act.repsDistanceTime) || 10);
        return `${short ? setsStr : setsPrefix}${repVal} reps${sideStr}`;
    }

    // 2. EXPLICIT FAILURE
    if (targetType === 'failure') {
        const sideStr = act.isPerSide ? (short ? '/side' : ' / side') : '';
        return `${short ? setsStr : setsPrefix}to failure${sideStr}`;
    }

    // 3. TIMED HOLD / DURATION IN SECONDS
    if (targetType === 'seconds' || (!targetType && targetUnit.includes('sec'))) {
        const secVal = val !== null ? val : parseInt(act.repsDistanceTime) || 30;
        const sideStr = act.isPerSide ? (short ? '/side' : ' / side') : '';
        if (secVal >= 60 && secVal % 60 !== 0) {
            const m = Math.floor(secVal / 60);
            const s = secVal % 60;
            const timeStr = `${m}:${s < 10 ? '0' + s : s}`;
            return `${short ? setsStr : setsPrefix}${timeStr} hold${sideStr}`;
        }
        return `${short ? setsStr : setsPrefix}${secVal}s hold${sideStr}`;
    }

    // 4. DISTANCE-BASED INTERVAL / RUN
    if (targetType === 'distance' || (!targetType && ['m', 'km', 'mi', 'k'].includes(targetUnit)) || (!targetType && act.repsDistanceTime && /(\d+)\s*(?:m|km|mi)/i.test(act.repsDistanceTime))) {
        const unit = targetUnit || (val && val > 50 ? 'm' : 'mi');
        const distStr = val !== null ? `${val}${unit}` : (act.repsDistanceTime || '');
        const paceStr = act.targetPace ? ` @ ~${typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(act.targetPace) : act.targetPace}` : '';
        return `${short ? setsStr : setsPrefix}${distStr}${paceStr}`;
    }

    // 5. TIME-BASED INTERVAL / RUN
    if (targetType === 'time' || (!targetType && targetUnit.includes('min')) || (!targetType && val !== null && (act.name || '').toLowerCase().includes('interval'))) {
        let timeStr = '';
        if (val !== null) {
            if (val > 60 && !targetUnit.includes('min')) {
                const m = Math.floor(val / 60);
                const s = Math.round(val % 60);
                timeStr = `${m}:${s < 10 ? '0' + s : s} min`;
            } else {
                const totalSec = Math.round(val * 60);
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                if (s > 0) {
                    timeStr = `${m}:${s < 10 ? '0' + s : s} min`;
                } else {
                    timeStr = `${m} min`;
                }
            }
        } else if (act.repsDistanceTime) {
            timeStr = formatDecimalMinutesString(act.repsDistanceTime);
        }

        const paceStr = act.targetPace ? ` @ ~${typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(act.targetPace) : act.targetPace} Pace` : '';
        return `${short ? setsStr : setsPrefix}${timeStr}${paceStr}`;
    }

    // 6. INFERRED INTEGER FALLBACK -> REPS
    if (val !== null && Number.isInteger(val)) {
        const sideStr = act.isPerSide ? (short ? '/side' : ' / side') : '';
        return `${short ? setsStr : setsPrefix}${val} reps${sideStr}`;
    }

    // 7. INFERRED DECIMAL NUMBER FALLBACK -> MINUTES
    if (val !== null) {
        const totalSec = Math.round(val * 60);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${short ? setsStr : setsPrefix}${m}:${s < 10 ? '0' + s : s} min`;
    }

    // 7. Fallback to repsDistanceTime
    if (act.repsDistanceTime) {
        return formatDecimalMinutesString(act.repsDistanceTime);
    }

    return `${short ? setsStr : setsPrefix}1 set`;
}

/**
 * Calculates above, center, and below numbers for the 3D roller wheel HUD.
 */
function getWheelDrumNumbers(currentVal, min, max, step, pad) {
    const formatNum = (v) => {
        let clamped = Math.max(min, Math.min(max, v));
        if (step >= 1) clamped = Math.round(clamped);
        else clamped = parseFloat(clamped.toFixed(2));
        return (pad && clamped < 10 && clamped >= 0) ? `0${clamped}` : String(clamped);
    };

    const cur = parseFloat(currentVal) || 0;
    const aboveVal = (cur + step <= max) ? formatNum(cur + step) : '';
    const centerVal = formatNum(cur);
    const belowVal = (cur - step >= min) ? formatNum(cur - step) : '';

    return { aboveVal, centerVal, belowVal };
}

/**
 * Creates or retrieves the floating roller wheel HUD bubble for touch/drag scrub entry.
 */
function getOrCreateScrubHud() {
    let hud = document.getElementById('touch-scrub-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'touch-scrub-hud';
        hud.className = 'fixed z-[99999] pointer-events-none hidden flex-col items-center justify-center bg-slate-950/95 text-white border border-indigo-500/50 shadow-2xl shadow-indigo-500/40 rounded-2xl py-1.5 px-3 backdrop-blur-md transition-opacity duration-100 select-none min-w-[58px] text-center';
        hud.innerHTML = `
            <span id="scrub-hud-above" class="text-[11px] font-bold text-slate-500 opacity-40 font-mono select-none tracking-tight h-3.5 flex items-center justify-center leading-none"></span>
            <div class="flex items-center justify-center my-0.5 border-y border-indigo-500/30 px-2.5 py-0.5 rounded bg-indigo-950/40 w-full">
                <span id="scrub-hud-val" class="text-2xl font-black text-amber-400 font-mono tracking-tight select-none leading-none"></span>
            </div>
            <span id="scrub-hud-below" class="text-[11px] font-bold text-slate-500 opacity-40 font-mono select-none tracking-tight h-3.5 flex items-center justify-center leading-none"></span>
        `;
        document.body.appendChild(hud);
    }
    return hud;
}

/**
 * Attaches a touch-wheel / scrub-wheel interaction with a floating roller wheel HUD.
 * Shows faint number above and below to give a true mechanical number wheel feel.
 * Solves screen shake by locking document scroll momentum during active touch.
 */
function initTouchWheelInputs(container = document) {
    if (!container) return;
    const inputs = container.querySelectorAll('input[type="number"], .scrub-wheel-input');
    inputs.forEach(input => {
        if (input.dataset.wheelInitialized) return;
        input.dataset.wheelInitialized = 'true';

        let startY = 0;
        let startVal = 0;
        let isDragging = false;
        let hud = null;

        const getMin = () => input.min !== "" ? parseFloat(input.min) : 0;
        const getMax = () => input.max !== "" ? parseFloat(input.max) : 999;
        const getStep = () => input.step !== "" && !isNaN(parseFloat(input.step)) ? parseFloat(input.step) : 1;
        const shouldPad = () => input.dataset.pad === "2" || (input.placeholder && input.placeholder.toLowerCase() === 'sec') || (input.id && input.id.includes('sec'));

        const updateHud = (valStr) => {
            const { aboveVal, centerVal, belowVal } = getWheelDrumNumbers(valStr, getMin(), getMax(), getStep(), shouldPad());
            const aboveEl = document.getElementById('scrub-hud-above');
            const valEl = document.getElementById('scrub-hud-val');
            const belowEl = document.getElementById('scrub-hud-below');

            if (aboveEl) aboveEl.innerText = aboveVal;
            if (valEl) valEl.innerText = centerVal;
            if (belowEl) belowEl.innerText = belowVal;
        };

        const showHud = (valStr) => {
            hud = getOrCreateScrubHud();
            updateHud(valStr);

            const rect = input.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const topY = Math.max(70, rect.top - 15);

            hud.style.left = `${centerX}px`;
            hud.style.top = `${topY}px`;
            hud.style.transform = 'translate(-50%, -100%)';
            hud.classList.remove('hidden');
            hud.classList.add('flex');
        };

        const hideHud = () => {
            if (hud) {
                hud.classList.add('hidden');
                hud.classList.remove('flex');
            }
        };

        const applyValue = (newVal) => {
            const min = getMin();
            const max = getMax();
            const step = getStep();
            
            let clamped = Math.max(min, Math.min(max, newVal));
            if (step >= 1) clamped = Math.round(clamped);
            else clamped = parseFloat(clamped.toFixed(2));

            const formatted = (shouldPad() && clamped < 10) ? `0${clamped}` : String(clamped);
            if (input.value !== formatted) {
                input.value = formatted;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                if (navigator.vibrate) {
                    try { navigator.vibrate(6); } catch (e) {}
                }
            }
            updateHud(formatted);
        };

        // Touch Drag Scrubbing (Mobile)
        input.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            startY = e.touches[0].clientY;
            startVal = parseFloat(input.value) || 0;
            isDragging = false;

            // Freeze document scrolling to prevent screen shake completely
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        }, { passive: true });

        input.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            const currentY = e.touches[0].clientY;
            const deltaY = startY - currentY; // Upward swipe = positive = increment

            if (Math.abs(deltaY) > 5) {
                if (!isDragging) {
                    isDragging = true;
                    showHud(input.value);
                }
                if (e.cancelable) e.preventDefault(); // Prevent whole-page bounce

                const step = getStep();
                const pixelsPerStep = step < 1 ? 14 : 10;
                const stepsMoved = Math.trunc(deltaY / pixelsPerStep);
                applyValue(startVal + (stepsMoved * step));

                input.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-950/90', 'scale-105');
            }
        }, { passive: false });

        const endTouch = () => {
            input.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-950/90', 'scale-105');
            hideHud();

            // Restore document scrolling
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';

            if (isDragging) {
                input.blur(); // Dismiss keyboard
            }
            isDragging = false;
        };

        input.addEventListener('touchend', endTouch);
        input.addEventListener('touchcancel', endTouch);

        // Desktop Mouse Drag Scrubbing
        input.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            startY = e.clientY;
            startVal = parseFloat(input.value) || 0;
            isDragging = false;

            const onMouseMove = (moveEvent) => {
                const deltaY = startY - moveEvent.clientY;
                if (Math.abs(deltaY) > 4) {
                    if (!isDragging) {
                        isDragging = true;
                        showHud(input.value);
                    }
                    const step = getStep();
                    const pixelsPerStep = step < 1 ? 14 : 10;
                    const stepsMoved = Math.trunc(deltaY / pixelsPerStep);
                    applyValue(startVal + (stepsMoved * step));
                    input.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-950/90', 'scale-105');
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                input.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-950/90', 'scale-105');
                hideHud();
                if (isDragging) {
                    input.blur();
                }
                isDragging = false;
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Desktop Mouse Wheel
        input.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = getStep();
            const currentVal = parseFloat(input.value) || 0;
            const dir = e.deltaY < 0 ? 1 : -1;
            applyValue(currentVal + (dir * step));
        }, { passive: false });

        input.classList.add('cursor-ns-resize', 'select-none', 'touch-none');
    });
}
