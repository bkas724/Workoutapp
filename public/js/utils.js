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
            if (motivationBlock) motivationBlock.classList.remove('hidden');
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
