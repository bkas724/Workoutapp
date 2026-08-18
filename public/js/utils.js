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
    } catch (e) {}

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
