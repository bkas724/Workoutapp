// =========================================================================
// YOURFLOW: WORKOUT COCKPIT ENGINE (Phase 2 - 50/50 Split Execution Player)
// Fluid Dynamic Scaling across Mobile, Tablet, Desktop, and 4K Displays
// =========================================================================

window.workoutCockpitState = window.workoutCockpitState || {};

/**
 * Activity category helpers
 */
function getPrepActivityIndices(state) {
    if (!state || !state.activities) return [];
    return state.activities
        .map((act, idx) => ({ act, idx }))
        .filter(({ act }) => act.type === 'prep' || (!act.type && /warm|prep|dynamic/i.test(act.name)))
        .map(({ idx }) => idx);
}

function getWorkActivityIndices(state) {
    if (!state || !state.activities) return [];
    return state.activities
        .map((act, idx) => ({ act, idx }))
        .filter(({ act }) => act.type === 'work' || (!act.type && !/warm|prep|dynamic|cool|stretch|flush/i.test(act.name)))
        .map(({ idx }) => idx);
}

function getCoolActivityIndices(state) {
    if (!state || !state.activities) return [];
    return state.activities
        .map((act, idx) => ({ act, idx }))
        .filter(({ act }) => act.type === 'cool' || (!act.type && /cool|stretch|flush/i.test(act.name)))
        .map(({ idx }) => idx);
}

/**
 * Deterministically calculates rest duration based on sport science rules
 */
function getDeterministicRestSeconds(workoutState, activity) {
    if (activity && typeof activity.restSeconds === 'number' && activity.restSeconds > 0) {
        return Math.max(5, Math.round(activity.restSeconds / 5) * 5);
    }

    const profile = typeof userProfileData !== 'undefined' ? userProfileData : null;
    const fitnessLevel = (profile && profile.fitnessLevel) ? profile.fitnessLevel.toLowerCase() : 'intermediate';
    const isCircuit = !!(workoutState && workoutState.isCircuit);
    const rpe = (workoutState && workoutState.targetRPE) ? workoutState.targetRPE : 3;

    // 1. CIRCUIT STRENGTH TRANSITION
    if (isCircuit) {
        if (fitnessLevel === 'beginner') return 25;
        if (fitnessLevel === 'advanced') return 10;
        return 15; // Intermediate default
    }

    // 2. RUNNING / SPEED / INTERVAL REST
    const title = (workoutState && workoutState.workoutTitle ? workoutState.workoutTitle : '').toLowerCase();
    const actName = (activity && activity.name ? activity.name : '').toLowerCase();
    if (/interval|tempo|speed|track|hill|stride|repeat/i.test(title) || /interval|speed|repeat|surge/i.test(actName)) {
        if (rpe >= 4 || /sprint|hill|400m|800m/i.test(actName)) return 120; // 2:00 for hard speed repeats
        return 60; // 1:00 for tempo float
    }

    // 3. STRAIGHT-SET STRENGTH
    if (activity && activity.sets && activity.sets > 1) {
        return rpe >= 4 ? 45 : 30;
    }

    return 15; // Standard transition default
}

/**
 * Deterministically calculates circuit round recovery duration
 */
function getDeterministicRoundRestSeconds(workoutState) {
    if (workoutState && typeof workoutState.circuitRestSeconds === 'number' && workoutState.circuitRestSeconds > 0) {
        return Math.max(15, Math.round(workoutState.circuitRestSeconds / 5) * 5);
    }
    const profile = typeof userProfileData !== 'undefined' ? userProfileData : null;
    const fitnessLevel = (profile && profile.fitnessLevel) ? profile.fitnessLevel.toLowerCase() : 'intermediate';
    const rpe = (workoutState && workoutState.targetRPE) ? workoutState.targetRPE : 3;

    if (fitnessLevel === 'beginner' || rpe >= 4) return 45;
    if (fitnessLevel === 'advanced' && rpe <= 3) return 25;
    return 30; // Intermediate default
}


/**
 * Initialize or retrieve the cockpit session state for a given workout
 */
function getOrCreateCockpitState(stepId, workoutTitle, activities, isCircuit, circuitRounds) {
    if (!window.workoutCockpitState[stepId]) {
        window.workoutCockpitState[stepId] = {
            stepId: stepId,
            workoutTitle: workoutTitle || 'Workout',
            activities: activities || [],
            activeIdx: 0,
            completedActivities: new Set(),
            completedSets: {}, // { [actIdx]: Set([setIndices]) }
            isCircuit: !!isCircuit,
            circuitRounds: typeof circuitRounds === 'number' && circuitRounds > 0 ? circuitRounds : (isCircuit ? 3 : 1),
            currentCircuitRound: 1,
            sideState: {}, // { [actIdx]: 1 | 2 } for per-side exercises
            isTransitioning: false
        };
    } else {
        const s = window.workoutCockpitState[stepId];
        s.workoutTitle = workoutTitle || s.workoutTitle;
        if (activities && activities.length > 0) s.activities = activities;
        s.isCircuit = !!isCircuit;
        if (typeof circuitRounds === 'number' && circuitRounds > 0) {
            s.circuitRounds = circuitRounds;
        } else if (isCircuit && s.circuitRounds <= 1) {
            s.circuitRounds = 3;
        }
    }
    return window.workoutCockpitState[stepId];
}

/**
 * Launch the 50/50 Workout Cockpit
 */
function startWorkoutCockpit(stepId, startIdx = 0) {
    const state = window.workoutCockpitState[stepId];
    if (!state || !state.activities || state.activities.length === 0) return;

    // 1. Initialize Audio & WakeLock via timer-utils
    if (window.workoutTimer) {
        window.workoutTimer.initAudio();
        window.workoutTimer.requestWakeLock();
    }

    // 2. Set active index
    state.activeIdx = Math.max(0, Math.min(startIdx, state.activities.length - 1));
    state.isTransitioning = false;

    // 3. Switch View
    const listView = document.getElementById(`workout-list-view-${stepId}`);
    const cockpitView = document.getElementById(`workout-cockpit-view-${stepId}`);
    if (listView) listView.classList.add('hidden');
    if (cockpitView) {
        cockpitView.classList.remove('hidden');
        cockpitView.classList.add('flex');
    }

    // 4. Render Cockpit Components
    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Exit Cockpit back to the clean Workout List (Overview)
 */
function exitWorkoutCockpit(stepId) {
    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    const listView = document.getElementById(`workout-list-view-${stepId}`);
    const cockpitView = document.getElementById(`workout-cockpit-view-${stepId}`);
    if (cockpitView) {
        cockpitView.classList.add('hidden');
        cockpitView.classList.remove('flex');
    }
    if (listView) {
        listView.classList.remove('hidden');
    }
}

/**
 * Render the Visual Progress Dots & 2px Emerald Volume Line in Header
 */
function updateCockpitProgressBar(stepId) {
    const state = window.workoutCockpitState[stepId];
    if (!state || !state.activities) return;

    const prepIndices = getPrepActivityIndices(state);
    const workIndices = getWorkActivityIndices(state);
    const coolIndices = getCoolActivityIndices(state);

    // Calculate dynamic total expected volume
    let totalExpectedVolume = state.activities.length;
    let completedVolume = state.completedActivities.size;

    if (state.isCircuit && state.circuitRounds > 1) {
        const completedPrepCount = prepIndices.filter(i => state.completedActivities.has(i)).length;
        const completedWorkThisRound = workIndices.filter(i => state.completedActivities.has(i)).length;
        const completedCoolCount = coolIndices.filter(i => state.completedActivities.has(i)).length;

        totalExpectedVolume = prepIndices.length + (workIndices.length * state.circuitRounds) + coolIndices.length;
        completedVolume = completedPrepCount + ((state.currentCircuitRound - 1) * workIndices.length) + completedWorkThisRound + completedCoolCount;
    }

    const pct = totalExpectedVolume > 0 ? (completedVolume / totalExpectedVolume) * 100 : 0;
    const bar = document.getElementById(`cockpit-progress-bar-${stepId}`);
    if (bar) bar.style.width = `${pct}%`;

    // Visual Dot Groupings in Header
    const dotsContainer = document.getElementById(`cockpit-progress-dots-${stepId}`);
    if (!dotsContainer || state.activities.length === 0) return;

    if (state.isCircuit && state.circuitRounds > 1) {
        // CIRCUIT ACCORDION: Focus dots on the work activities for each round
        let html = '';
        const isAllWorkDone = workIndices.every(idx => state.completedActivities.has(idx));
        const isAllWorkoutDone = isAllWorkDone && state.currentCircuitRound >= state.circuitRounds && coolIndices.every(idx => state.completedActivities.has(idx));

        for (let r = 1; r <= state.circuitRounds; r++) {
            const isPastRound = r < state.currentCircuitRound;
            const isCurrentRound = r === state.currentCircuitRound;
            const isCurrentRoundCompleted = isCurrentRound && isAllWorkDone;

            if (isPastRound || (isCurrentRoundCompleted && isAllWorkoutDone)) {
                // COMPACT COMPLETED ROUND BADGE (Green Checkmark)
                html += `
                    <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)] shrink-0 transition-all duration-300" title="Round ${r} Complete">
                        <i class="fa-solid fa-check text-[10px] sm:text-xs"></i>
                    </div>
                `;
            } else if (isCurrentRound && !isAllWorkoutDone) {
                // EXPANDED ACTIVE ROUND CAPSULE (Dots for work activities in this round)
                const targetActs = workIndices.length > 0 ? workIndices.map(i => state.activities[i]) : state.activities;
                const dotsHtml = targetActs.map((_, dotIdx) => {
                    const actualActIdx = workIndices.length > 0 ? workIndices[dotIdx] : dotIdx;
                    let dotClass = 'bg-slate-700';
                    if (state.completedActivities.has(actualActIdx)) {
                        dotClass = 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]';
                    } else if (actualActIdx === state.activeIdx) {
                        dotClass = 'bg-amber-400 scale-125 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.9)]';
                    }
                    return `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300 ${dotClass}"></span>`;
                }).join('');

                html += `
                    <div class="bg-slate-900/95 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 transition-all duration-300 shrink-0" title="Active Round ${r}">
                        ${dotsHtml}
                    </div>
                `;
            } else {
                // COMPACT UPCOMING ROUND BADGE (Muted Number)
                html += `
                    <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 font-bold text-[10px] sm:text-xs shrink-0 transition-all duration-300 opacity-60" title="Upcoming Round ${r}">
                        ${r}
                    </div>
                `;
            }
        }
        dotsContainer.innerHTML = html;
    } else {
        // LINEAR / SET-BASED: Single sleek capsule containing 1 dot per movement
        const dotsHtml = state.activities.map((act, idx) => {
            let dotClass = 'bg-slate-700';
            if (state.completedActivities.has(idx)) {
                dotClass = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]';
            } else if (idx === state.activeIdx) {
                dotClass = 'bg-indigo-400 scale-125 animate-pulse ring-2 ring-indigo-400/30 shadow-[0_0_8px_rgba(99,102,241,0.9)]';
            }
            return `<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${dotClass}" title="${act.name}"></span>`;
        }).join('');

        dotsContainer.innerHTML = `
            <div class="bg-slate-900/90 border border-slate-800/90 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 shadow-inner">
                ${dotsHtml}
            </div>
        `;
    }
}

/**
 * Jump to any exercise in the session (e.g. Gym Machine occupied)
 */
function jumpToCockpitExercise(stepId, targetIdx) {
    const state = window.workoutCockpitState[stepId];
    if (!state || targetIdx < 0 || targetIdx >= state.activities.length) return;

    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    state.isTransitioning = false;
    state.activeIdx = targetIdx;
    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Reset Active Timer / Re-do current exercise
 */
function resetActiveCockpitTimer(stepId) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    state.isTransitioning = false;
    if (state.sideState[state.activeIdx]) {
        state.sideState[state.activeIdx] = 1;
    }

    renderCockpitHeroStage(stepId);
}

/**
 * Render the Hero Stage
 */
function renderCockpitHeroStage(stepId) {
    const state = window.workoutCockpitState[stepId];
    const stage = document.getElementById(`cockpit-hero-stage-${stepId}`);
    if (!state || !stage) return;

    // If currently showing transition timer, do not override
    if (state.isTransitioning) return;

    const prepIndices = getPrepActivityIndices(state);
    const workIndices = getWorkActivityIndices(state);
    const coolIndices = getCoolActivityIndices(state);

    const isAllPrepDone = prepIndices.every(idx => state.completedActivities.has(idx));
    const isAllWorkDone = workIndices.every(idx => state.completedActivities.has(idx));
    const isAllCoolDone = coolIndices.every(idx => state.completedActivities.has(idx));

    // Check for full workout completion
    const isEntireWorkoutComplete = isAllPrepDone && isAllWorkDone && isAllCoolDone && (!state.isCircuit || state.currentCircuitRound >= state.circuitRounds);

    if (isEntireWorkoutComplete) {
        updateCockpitProgressBar(stepId);

        const funnyQuotes = [
            "See? That wasn't so bad, was it?",
            "Boom. Done. You survived.",
            "Look at you, actually following through.",
            "And you almost talked yourself into staying on the couch.",
            "The hardest rep was getting off the couch. Mission accomplished.",
            "Honestly? We both know you wanted to skip today. Proud of you.",
            "Done! Your future self officially owes you one.",
            "You showed up, did the thing, and didn't die. 10/10.",
            "Workout complete. Permission to collapse granted.",
            "That wasn't so terrible. Now go take all the credit.",
            "Done! Now you can complain about being sore tomorrow.",
            "Workout over. You may resume horizontal living.",
            "Tell everyone you worked out today. You earned the bragging rights.",
            "That was 90% mental bargaining and 10% movement. Done!",
            "That's it. Now go drink some water."
        ];
        const randomQuote = funnyQuotes[Math.floor(Math.random() * funnyQuotes.length)];

        stage.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-6 animate-fade-in w-full h-full my-auto">
                <div class="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 text-4xl sm:text-5xl md:text-6xl mb-4 shadow-[0_0_40px_rgba(16,185,129,0.35)] animate-pulse">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <h3 style="font-size: clamp(1.75rem, min(4.5vw, 4.5vh), 3.5rem); line-height: 1.15;" class="font-black text-white tracking-tight">Workout Complete!</h3>
                <p style="font-size: clamp(1rem, min(2vw, 2.2vh), 1.35rem);" class="text-slate-300 mt-2 max-w-md font-medium">
                    ${randomQuote}
                </p>
                <button onclick="document.getElementById('workout-modal-${stepId}').classList.add('hidden'); toggleGatekeeper('${stepId}', true)" style="font-size: clamp(1rem, min(2vw, 2.2vh), 1.35rem); padding: clamp(0.85rem, 1.8vh, 1.25rem) clamp(1.5rem, 3vw, 3rem);" class="mt-6 w-full sm:w-auto min-w-[260px] bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.45)] transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-98">
                    🚀 Log & Complete Workout
                </button>
            </div>
        `;
        return;
    }

    const act = state.activities[state.activeIdx];
    if (!act) return;

    // Target metric formatting
    let targetDisplay = '';
    if (typeof act.targetValue === 'number' && act.targetValue > 0) {
        const type = act.targetType === 'seconds' ? 'sec hold' : (act.targetType === 'failure' ? 'to failure' : 'reps');
        const sideStr = act.isPerSide ? '/side' : '';
        const setsStr = act.sets && act.sets > 1 && !state.isCircuit ? `${act.sets} sets × ` : '';
        targetDisplay = `${setsStr}${act.targetValue} ${type}${sideStr}`;
    } else {
        targetDisplay = act.repsDistanceTime || (act.sets && !state.isCircuit ? `${act.sets} sets` : '1 set');
    }

    const eqStr = (act.equipmentRequired && act.equipmentRequired !== 'Bodyweight' && act.equipmentRequired !== 'None')
        ? ` • <span class="text-slate-200 font-semibold">${act.equipmentRequired}</span>` : '';

    const cueText = act.coachingCue || act.description || '';

    // Build Interaction Area HTML
    let interactionHtml = '';

    if (act.targetType === 'seconds' && act.targetValue) {
        // TIMED HOLD (e.g. Plank, Wall Sit)
        const isPerSide = !!act.isPerSide || (act.repsDistanceTime && act.repsDistanceTime.toLowerCase().includes('side'));
        const currentSide = state.sideState[state.activeIdx] || 1;

        if (isPerSide && currentSide === 2) {
            interactionHtml = `
                <div class="flex flex-col items-center gap-4 my-2 w-full">
                    <button onclick="startCockpitTimedHold('${stepId}', ${state.activeIdx}, ${act.targetValue}, true, 2)" style="font-size: clamp(1.1rem, min(2.5vw, 2.8vh), 1.65rem); padding: clamp(0.85rem, 1.8vh, 1.35rem) clamp(2rem, 3.5vw, 3.5rem);" class="w-full sm:w-auto rounded-3xl border-2 border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-3.5 transition-all shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-play text-indigo-200 text-base sm:text-lg"></i> Start Side 2 (${act.targetValue}s)
                    </button>
                    <div id="cockpit-hold-timer-${stepId}" class="hidden flex-col items-center w-full"></div>
                </div>
            `;
        } else {
            const btnLabel = isPerSide ? `Start Side 1 (${act.targetValue}s)` : `Start Hold (${act.targetValue}s)`;
            interactionHtml = `
                <div class="flex flex-col items-center gap-4 my-2 w-full">
                    <button id="cockpit-start-hold-btn-${stepId}" onclick="startCockpitTimedHold('${stepId}', ${state.activeIdx}, ${act.targetValue}, ${isPerSide}, 1)" style="font-size: clamp(1.1rem, min(2.5vw, 2.8vh), 1.65rem); padding: clamp(0.85rem, 1.8vh, 1.35rem) clamp(2rem, 3.5vw, 3.5rem);" class="w-full sm:w-auto rounded-3xl border-2 border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-3.5 transition-all shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-play text-indigo-200 text-base sm:text-lg"></i> ${btnLabel}
                    </button>
                    <div id="cockpit-hold-timer-${stepId}" class="hidden flex-col items-center w-full"></div>
                </div>
            `;
        }
    } else if (act.sets && act.sets > 1 && !state.isCircuit) {
        // MULTI-SET STRENGTH MOVEMENT (Straight Sets Only)
        if (!state.completedSets[state.activeIdx]) {
            state.completedSets[state.activeIdx] = new Set();
        }
        const doneSets = state.completedSets[state.activeIdx];

        interactionHtml = `
            <div class="flex flex-col items-center gap-3 sm:gap-4 my-2 w-full max-w-xl">
                <div class="flex items-center justify-center gap-3 sm:gap-4 md:gap-5 py-2">
                    ${Array.from({ length: act.sets }).map((_, s) => {
                        const isDone = doneSets.has(s);
                        const isNextTarget = !isDone && (s === 0 || doneSets.has(s - 1));
                        const activeBorder = isNextTarget ? 'border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.65)] scale-110 ring-4 ring-indigo-500/25' : 'border-slate-700';
                        const bgClass = isDone ? 'bg-teal-500 border-teal-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.45)]' : 'bg-slate-800/90 text-slate-300 hover:border-teal-400/50';

                        return `
                            <button onclick="handleCockpitSetClick('${stepId}', ${state.activeIdx}, ${s})" style="width: clamp(48px, min(10vw, 8.5vh), 80px); height: clamp(48px, min(10vw, 8.5vh), 80px); font-size: clamp(1rem, min(2.5vw, 2.5vh), 1.6rem);" class="rounded-2xl sm:rounded-3xl border-2 sm:border-3 ${activeBorder} ${bgClass} flex items-center justify-center font-black transition-all active:scale-95 cursor-pointer shrink-0" title="Set ${s + 1}">
                                ${isDone ? '<i class="fa-solid fa-check"></i>' : s + 1}
                            </button>
                        `;
                    }).join('')}
                </div>
                <div id="cockpit-rest-box-${stepId}" class="hidden flex-col items-center gap-3 w-full animate-fade-in"></div>
            </div>
        `;
    } else {
        // SINGLE-SET REPS / CIRCUIT MOVEMENT
        const isDone = state.completedActivities.has(state.activeIdx);
        interactionHtml = `
            <div class="flex items-center justify-center my-2 w-full">
                <button onclick="handleCockpitSingleComplete('${stepId}', ${state.activeIdx})" style="font-size: clamp(1.1rem, min(2.5vw, 2.8vh), 1.65rem); padding: clamp(0.85rem, 1.8vh, 1.35rem) clamp(2rem, 3.5vw, 3.5rem);" class="w-full sm:w-auto rounded-3xl ${isDone ? 'bg-teal-500 text-white shadow-[0_0_30px_rgba(20,184,166,0.45)]' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.5)]'} font-black transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95">
                    <i class="fa-solid fa-check text-base sm:text-lg"></i> ${isDone ? 'Exercise Done (Tap to Redo)' : 'Mark Exercise Complete'}
                </button>
            </div>
        `;
    }

    stage.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center max-w-2xl w-full h-full my-auto animate-fade-in py-2 gap-2">
            <!-- Exercise Name -->
            <h2 style="font-size: clamp(1.65rem, min(4.8vw, 5vh), 3.75rem); line-height: 1.1;" class="font-black text-white tracking-tight">
                ${act.name}
            </h2>

            <!-- Metric & Equipment -->
            <div style="font-size: clamp(0.9rem, min(2vw, 2.2vh), 1.5rem);" class="font-extrabold text-indigo-300 mt-0.5 flex items-center justify-center gap-2 flex-wrap">
                <span>${targetDisplay}</span>
                ${eqStr}
            </div>

            <!-- Open Form Tip -->
            ${cueText ? `
            <div class="my-1 px-3.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs sm:text-sm text-slate-300 flex items-center justify-center gap-2 shadow-inner max-w-md">
                <i class="fa-regular fa-lightbulb text-amber-400 text-xs shrink-0"></i>
                <span class="leading-snug font-medium line-clamp-2">${cueText}</span>
            </div>
            ` : ''}

            <!-- Primary Interactive Stage -->
            ${interactionHtml}
        </div>
    `;
}

/**
 * Activity completion hub: routes to transition timers, round rest, or complete
 */
function handleCockpitActivityFinished(stepId, actIdx) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    state.completedActivities.add(actIdx);
    if (window.workoutTimer) window.workoutTimer.stop();

    const act = state.activities[actIdx];
    const prepIndices = getPrepActivityIndices(state);
    const workIndices = getWorkActivityIndices(state);
    const coolIndices = getCoolActivityIndices(state);

    if (!state.isCircuit || state.circuitRounds <= 1) {
        // LINEAR WORKOUT: Simple linear progression
        let nextUncompleted = -1;
        for (let i = 0; i < state.activities.length; i++) {
            if (!state.completedActivities.has(i)) {
                nextUncompleted = i;
                break;
            }
        }
        if (nextUncompleted !== -1) {
            state.activeIdx = nextUncompleted;
        }
        renderCockpitHeroStage(stepId);
        renderCockpitPlaylist(stepId);
        updateCockpitProgressBar(stepId);
        return;
    }

    // ==========================================
    // CIRCUIT WORKOUT LIFECYCLE
    // ==========================================
    const isPrep = prepIndices.includes(actIdx);
    const isWork = workIndices.includes(actIdx);
    const isCool = coolIndices.includes(actIdx);

    if (isPrep) {
        // 1. WARMUP PHASE (Outside circuit loop)
        const uncompletedPrep = prepIndices.find(idx => !state.completedActivities.has(idx));
        if (uncompletedPrep !== undefined) {
            state.activeIdx = uncompletedPrep;
            renderCockpitHeroStage(stepId);
        } else {
            // Warmup finished -> Transition into Circuit Round 1!
            const firstWorkIdx = workIndices[0] !== undefined ? workIndices[0] : 0;
            const nextAct = state.activities[firstWorkIdx];
            startCockpitTransitionTimer(stepId, 15, nextAct ? nextAct.name : 'Round 1', firstWorkIdx, 'Warm-up Complete • Starting Round 1');
        }
    } else if (isWork) {
        // 2. CIRCUIT ROUND WORK PHASE
        const uncompletedWork = workIndices.find(idx => !state.completedActivities.has(idx));

        if (uncompletedWork !== undefined) {
            // Deterministic inter-activity rest
            const restSec = getDeterministicRestSeconds(state, act);
            const nextAct = state.activities[uncompletedWork];
            const workCompletedCount = workIndices.filter(idx => state.completedActivities.has(idx)).length;
            startCockpitTransitionTimer(stepId, restSec, nextAct ? nextAct.name : 'Next Exercise', uncompletedWork, `Exercise ${workCompletedCount} of ${workIndices.length} Done`);
        } else {
            // All work activities completed for THIS round!
            if (state.currentCircuitRound < state.circuitRounds) {
                // Post-Round Recovery (60s Rest)
                renderCockpitRoundRecovery(stepId);
            } else {
                // Final round finished! Check if there are cool-down activities
                const uncompletedCool = coolIndices.find(idx => !state.completedActivities.has(idx));
                if (uncompletedCool !== undefined) {
                    const nextAct = state.activities[uncompletedCool];
                    startCockpitTransitionTimer(stepId, 15, nextAct ? nextAct.name : 'Cool-down', uncompletedCool, 'All Rounds Done • Heading to Cool-down');
                } else {
                    // Entire workout complete!
                    renderCockpitHeroStage(stepId);
                }
            }
        }
    } else if (isCool) {
        // 3. COOLDOWN PHASE (Outside circuit loop)
        const uncompletedCool = coolIndices.find(idx => !state.completedActivities.has(idx));
        if (uncompletedCool !== undefined) {
            state.activeIdx = uncompletedCool;
            renderCockpitHeroStage(stepId);
        } else {
            // Entire workout complete!
            renderCockpitHeroStage(stepId);
        }
    }

    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Start Inter-Activity Transition Rest Timer (15s Default)
 * Eye-Level "UP NEXT" Preview Card on Top, Timer in Center, Thumb Controls on Bottom
 */
function startCockpitTransitionTimer(stepId, durationSec, nextName, nextIdx, badgeText) {
    const state = window.workoutCockpitState[stepId];
    const stage = document.getElementById(`cockpit-hero-stage-${stepId}`);
    if (!state || !stage || !window.workoutTimer) return;

    state.isTransitioning = true;
    const nextAct = state.activities[nextIdx];
    
    let nextTargetDisplay = '';
    if (nextAct) {
        if (typeof nextAct.targetValue === 'number' && nextAct.targetValue > 0) {
            const type = nextAct.targetType === 'seconds' ? 's hold' : (nextAct.targetType === 'failure' ? 'to failure' : 'reps');
            const sideStr = nextAct.isPerSide ? '/side' : '';
            nextTargetDisplay = `${nextAct.targetValue} ${type}${sideStr}`;
        } else if (nextAct.repsDistanceTime) {
            nextTargetDisplay = nextAct.repsDistanceTime;
        }
    }

    const nextEq = nextAct && nextAct.equipmentRequired && nextAct.equipmentRequired !== 'Bodyweight' && nextAct.equipmentRequired !== 'None'
        ? ` • ${nextAct.equipmentRequired}` : '';

    const badgeLabel = badgeText || 'Quick Rest & Transition';

    stage.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-3 sm:p-5 animate-fade-in w-full h-full my-auto gap-2 sm:gap-2.5 max-w-md mx-auto">
            <!-- Prominent UP NEXT Preview Card (Top Eye-Scan Zone) -->
            <div class="w-full bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3 sm:p-3.5 shadow-lg flex flex-col items-center gap-0.5">
                <span class="text-[10px] sm:text-xs font-bold text-indigo-400 uppercase tracking-wider">Up Next</span>
                <h3 style="font-size: clamp(1.25rem, min(3.8vw, 3.5vh), 2rem);" class="font-black text-white tracking-tight leading-tight">
                    ${nextAct ? nextAct.name : nextName}
                </h3>
                <span class="text-xs sm:text-sm text-slate-300 font-semibold mt-0.5">
                    ${nextTargetDisplay}${nextEq}
                </span>
            </div>

            <!-- 3. Central 15s Countdown Ring (Tap to Play/Pause) -->
            <div style="width: clamp(95px, min(22vw, 16vh), 135px); height: clamp(95px, min(22vw, 16vh), 135px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group my-0.5" onclick="event.stopPropagation(); toggleCockpitTimer('${stepId}', 'cockpit-trans-icon-${stepId}');">
                <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]" viewBox="0 0 36 36">
                    <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                    <path id="cockpit-trans-ring-${stepId}" class="text-indigo-400 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span id="cockpit-trans-text-${stepId}" style="font-size: clamp(2rem, min(6vw, 4.5vh), 3.25rem);" class="font-black text-white font-mono tracking-tight leading-none">${durationSec}</span>
                    <i id="cockpit-trans-icon-${stepId}" class="fa-solid fa-pause text-[11px] text-indigo-400 opacity-80 mt-0.5"></i>
                </div>
            </div>

            <!-- 4. Action Controls (Natural Thumb Zone) -->
            <div class="flex items-center justify-center gap-3 w-full mt-0.5">
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1rem, 2vw, 1.75rem);" class="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-extrabold transition-all shadow-md active:scale-95 cursor-pointer">
                    +15s
                </button>
                <button onclick="skipCockpitTransition('${stepId}', ${nextIdx})" style="font-size: clamp(0.95rem, min(2vw, 2.2vh), 1.25rem); padding: clamp(0.65rem, 1.4vh, 0.95rem) clamp(1.5rem, 2.8vw, 2.25rem);" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.45)] transition-all flex items-center gap-2 cursor-pointer active:scale-95">
                    <i class="fa-solid fa-play text-xs"></i> Start ${nextAct ? nextAct.name : 'Next'}
                </button>
            </div>
        </div>
    `;

    window.workoutTimer.start(durationSec,
        (remainingSec, fraction) => {
            const textEl = document.getElementById(`cockpit-trans-text-${stepId}`);
            const ringEl = document.getElementById(`cockpit-trans-ring-${stepId}`);
            if (textEl) {
                const m = Math.floor(remainingSec / 60);
                const s = remainingSec % 60;
                textEl.innerText = m > 0 ? `${m}:${s < 10 ? '0' + s : s}` : s;
            }
            if (ringEl) {
                ringEl.setAttribute('stroke-dasharray', `${fraction * 100}, 100`);
            }
        },
        () => {
            skipCockpitTransition(stepId, nextIdx);
        }
    );
}

/**
 * Skip transition timer and load next activity
 */
function skipCockpitTransition(stepId, nextIdx) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;
    if (window.workoutTimer) window.workoutTimer.stop();
    state.isTransitioning = false;
    state.activeIdx = nextIdx;
    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Render Post-Round Recovery Stage (60s Rest between rounds)
 * Eye-Level "UP NEXT" Preview Card on Top, Timer in Center, Thumb Controls on Bottom
 */
function renderCockpitRoundRecovery(stepId) {
    const state = window.workoutCockpitState[stepId];
    const stage = document.getElementById(`cockpit-hero-stage-${stepId}`);
    if (!state || !stage || !window.workoutTimer) return;

    state.isTransitioning = true;
    const workIndices = getWorkActivityIndices(state);
    const firstWorkAct = workIndices.length > 0 ? state.activities[workIndices[0]] : null;
    const nextActName = firstWorkAct ? firstWorkAct.name : 'Circuit';
    
    let nextTargetDisplay = '';
    if (firstWorkAct) {
        if (typeof firstWorkAct.targetValue === 'number' && firstWorkAct.targetValue > 0) {
            const type = firstWorkAct.targetType === 'seconds' ? 's hold' : (firstWorkAct.targetType === 'failure' ? 'to failure' : 'reps');
            const sideStr = firstWorkAct.isPerSide ? '/side' : '';
            nextTargetDisplay = `${firstWorkAct.targetValue} ${type}${sideStr}`;
        } else if (firstWorkAct.repsDistanceTime) {
            nextTargetDisplay = firstWorkAct.repsDistanceTime;
        }
    }

    const nextEq = firstWorkAct && firstWorkAct.equipmentRequired && firstWorkAct.equipmentRequired !== 'Bodyweight' && firstWorkAct.equipmentRequired !== 'None'
        ? ` • ${firstWorkAct.equipmentRequired}` : '';

    // Deterministic round recovery break
    const roundRestDuration = getDeterministicRoundRestSeconds(state);

    stage.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-3 sm:p-5 animate-fade-in w-full h-full my-auto gap-2 sm:gap-2.5 max-w-md mx-auto">
            <!-- Round Complete Badge -->
            <span class="text-[11px] sm:text-xs font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-xl shadow-sm">
                Round ${state.currentCircuitRound} Complete
            </span>

            <!-- 2. Prominent UP NEXT Preview Card (Top Eye-Scan Zone) -->
            <div class="w-full bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 sm:p-3.5 shadow-lg flex flex-col items-center gap-0.5">
                <span class="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider">Up Next</span>
                <h3 style="font-size: clamp(1.25rem, min(3.8vw, 3.5vh), 2rem);" class="font-black text-white tracking-tight leading-tight">
                    Round ${state.currentCircuitRound + 1}: ${nextActName}
                </h3>
                <span class="text-xs sm:text-sm text-slate-300 font-semibold mt-0.5">
                    ${nextTargetDisplay}${nextEq}
                </span>
            </div>

            <!-- 3. Central 60s Countdown Ring (Tap to Play/Pause) -->
            <div style="width: clamp(100px, min(24vw, 17vh), 140px); height: clamp(100px, min(24vw, 17vh), 140px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group my-0.5" onclick="event.stopPropagation(); toggleCockpitTimer('${stepId}', 'cockpit-circuit-icon-${stepId}');">
                <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]" viewBox="0 0 36 36">
                    <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                    <path id="cockpit-circuit-ring-${stepId}" class="text-amber-400 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span id="cockpit-circuit-text-${stepId}" style="font-size: clamp(2rem, min(6vw, 4.5vh), 3.5rem);" class="font-black text-white font-mono tracking-tight leading-none">${roundRestDuration}</span>
                    <i id="cockpit-circuit-icon-${stepId}" class="fa-solid fa-pause text-[11px] text-amber-400 opacity-80 mt-0.5"></i>
                </div>
            </div>

            <!-- 4. Controls (Natural Thumb Zone) -->
            <div class="flex items-center justify-center gap-3 w-full mt-0.5">
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1rem, 2vw, 1.75rem);" class="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-extrabold transition-all shadow-md active:scale-95 cursor-pointer">
                    +15s
                </button>
                <button onclick="advanceCircuitRound('${stepId}')" style="font-size: clamp(0.95rem, min(2vw, 2.2vh), 1.25rem); padding: clamp(0.65rem, 1.4vh, 0.95rem) clamp(1.5rem, 2.8vw, 2.25rem);" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all flex items-center gap-2 cursor-pointer active:scale-95">
                    <i class="fa-solid fa-play text-sm"></i> Start Round ${state.currentCircuitRound + 1}
                </button>
            </div>
        </div>
    `;

    window.workoutTimer.start(roundRestDuration,
        (remainingSec, fraction) => {
            const textEl = document.getElementById(`cockpit-circuit-text-${stepId}`);
            const ringEl = document.getElementById(`cockpit-circuit-ring-${stepId}`);
            if (textEl) {
                const m = Math.floor(remainingSec / 60);
                const s = remainingSec % 60;
                textEl.innerText = m > 0 ? `${m}:${s < 10 ? '0' + s : s}` : s;
            }
            if (ringEl) {
                ringEl.setAttribute('stroke-dasharray', `${fraction * 100}, 100`);
            }
        },
        () => {
            advanceCircuitRound(stepId);
        }
    );
}

/**
 * Handle Multi-Set Bubble Click (Straight sets)
 */
function handleCockpitSetClick(stepId, actIdx, setIdx) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    if (!state.completedSets[actIdx]) {
        state.completedSets[actIdx] = new Set();
    }
    const doneSets = state.completedSets[actIdx];
    const act = state.activities[actIdx];

    if (doneSets.has(setIdx)) {
        // UNCHECK SET
        doneSets.delete(setIdx);
        state.completedActivities.delete(actIdx);
        if (window.workoutTimer) window.workoutTimer.stop();
        renderCockpitHeroStage(stepId);
        renderCockpitPlaylist(stepId);
        updateCockpitProgressBar(stepId);
        return;
    }

    // CHECK SET
    doneSets.add(setIdx);
    const isFinalSet = doneSets.size >= act.sets;

    if (isFinalSet) {
        handleCockpitActivityFinished(stepId, actIdx);
    } else {
        const restSec = getDeterministicRestSeconds(state, act);
        startCockpitRestTimer(stepId, actIdx, setIdx, restSec);
        renderCockpitHeroStage(stepId);
        renderCockpitPlaylist(stepId);
        updateCockpitProgressBar(stepId);
    }
}

/**
 * Start Inter-Set Rest Countdown with Large Fluid Timer Ring (3-Column layout)
 */
function startCockpitRestTimer(stepId, actIdx, currentSetIdx, durationSec) {
    const state = window.workoutCockpitState[stepId];
    const act = state ? state.activities[actIdx] : null;
    if (!act || !window.workoutTimer) return;

    setTimeout(() => {
        const restBox = document.getElementById(`cockpit-rest-box-${stepId}`);
        if (!restBox) return;

        const nextSetNum = currentSetIdx + 2;
        const eqLabel = act.equipmentRequired && act.equipmentRequired !== 'Bodyweight' && act.equipmentRequired !== 'None'
            ? ` • ${act.equipmentRequired}` : '';

        restBox.innerHTML = `
            <div class="flex flex-col items-center gap-2.5 p-3 sm:p-4 bg-slate-950/90 rounded-3xl border border-slate-800/80 shadow-2xl w-full max-w-sm sm:max-w-md">
                <!-- Top Runway Badge (Eye-Level) -->
                <div style="font-size: clamp(0.8rem, min(1.8vw, 2vh), 1rem);" class="font-bold text-indigo-200 text-center tracking-tight bg-indigo-950/60 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl w-full shadow-sm">
                    Next: Set ${nextSetNum}${eqLabel}
                </div>

                <!-- 3-Column Balanced Layout: [Left Stack: +15s & Reset] [Center: Timer Ring] [Right: Check Done] -->
                <div class="flex items-center justify-between w-full px-2">
                    <div class="flex flex-col items-center gap-2 shrink-0">
                        <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" class="w-11 h-11 sm:w-12 sm:h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center active:scale-95 cursor-pointer" title="Add 15 Seconds">
                            +15s
                        </button>
                        <button onclick="event.stopPropagation(); resetActiveCockpitTimer('${stepId}');" class="w-11 h-11 sm:w-12 sm:h-12 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center active:scale-95 cursor-pointer border border-slate-800" title="Reset Timer">
                            <i class="fa-solid fa-rotate-left text-xs"></i>
                        </button>
                    </div>

                    <div style="width: clamp(105px, min(26vw, 18vh), 145px); height: clamp(105px, min(26vw, 18vh), 145px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group" onclick="event.stopPropagation(); toggleCockpitTimer('${stepId}', 'cockpit-rest-icon-${stepId}');">
                        <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]" viewBox="0 0 36 36">
                            <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                            <path id="cockpit-rest-ring-${stepId}" class="text-indigo-500 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span id="cockpit-rest-text-${stepId}" style="font-size: clamp(2rem, min(6.5vw, 4.8vh), 3.5rem);" class="font-black text-white font-mono tracking-tight leading-none">${durationSec}</span>
                            <i id="cockpit-rest-icon-${stepId}" class="fa-solid fa-pause text-[11px] text-indigo-400 opacity-80 mt-1"></i>
                        </div>
                    </div>

                    <div class="flex items-center justify-center shrink-0">
                        <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.skip();" class="w-12 h-24 sm:w-14 sm:h-26 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center active:scale-95 cursor-pointer" title="Done / Next Set">
                            <i class="fa-solid fa-check text-xl sm:text-2xl"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        restBox.classList.remove('hidden');
        restBox.classList.add('flex');

        window.workoutTimer.start(durationSec,
            (remainingSec, fraction) => {
                const textEl = document.getElementById(`cockpit-rest-text-${stepId}`);
                const ringEl = document.getElementById(`cockpit-rest-ring-${stepId}`);
                if (textEl) {
                    const m = Math.floor(remainingSec / 60);
                    const s = remainingSec % 60;
                    textEl.innerText = m > 0 ? `${m}:${s < 10 ? '0' + s : s}` : s;
                }
                if (ringEl) {
                    ringEl.setAttribute('stroke-dasharray', `${fraction * 100}, 100`);
                }
            },
            () => {
                renderCockpitHeroStage(stepId);
            }
        );
    }, 50);
}

/**
 * Start Timed Hold Countdown (e.g. Plank)
 */
function startCockpitTimedHold(stepId, actIdx, durationSec, isPerSide, sideNum) {
    const state = window.workoutCockpitState[stepId];
    if (!state || !window.workoutTimer) return;

    const startBtn = document.getElementById(`cockpit-start-hold-btn-${stepId}`);
    if (startBtn) startBtn.classList.add('hidden');

    const timerBox = document.getElementById(`cockpit-hold-timer-${stepId}`);
    if (!timerBox) return;

    timerBox.innerHTML = `
        <div class="flex items-center justify-between p-3 sm:p-4 bg-slate-950/90 rounded-3xl border border-slate-800/80 shadow-2xl w-full max-w-sm sm:max-w-md px-3 sm:px-4">
            <div class="flex flex-col items-center gap-2 shrink-0">
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" class="w-11 h-11 sm:w-12 sm:h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center active:scale-95 cursor-pointer" title="Add 15 Seconds">
                    +15s
                </button>
                <button onclick="event.stopPropagation(); resetActiveCockpitTimer('${stepId}');" class="w-11 h-11 sm:w-12 sm:h-12 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center active:scale-95 cursor-pointer border border-slate-800" title="Reset Timer">
                    <i class="fa-solid fa-rotate-left text-xs"></i>
                </button>
            </div>

            <div style="width: clamp(105px, min(26vw, 18vh), 145px); height: clamp(105px, min(26vw, 18vh), 145px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group" onclick="event.stopPropagation(); toggleCockpitTimer('${stepId}', 'cockpit-hold-icon-${stepId}');">
                <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(99,102,241,0.45)]" viewBox="0 0 36 36">
                    <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                    <path id="cockpit-hold-ring-${stepId}" class="text-indigo-500 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span id="cockpit-hold-text-${stepId}" style="font-size: clamp(2rem, min(6.5vw, 4.8vh), 3.5rem);" class="font-black text-white font-mono tracking-tight leading-none">${durationSec}</span>
                    <i id="cockpit-hold-icon-${stepId}" class="fa-solid fa-pause text-[11px] text-indigo-400 opacity-80 mt-1"></i>
                </div>
            </div>

            <div class="flex items-center justify-center shrink-0">
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.skip();" class="w-12 h-24 sm:w-14 sm:h-26 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center active:scale-95 cursor-pointer" title="Complete / Next">
                    <i class="fa-solid fa-check text-xl sm:text-2xl"></i>
                </button>
            </div>
        </div>
    `;
    timerBox.classList.remove('hidden');
    timerBox.classList.add('flex');

    window.workoutTimer.start(durationSec,
        (remainingSec, fraction) => {
            const textEl = document.getElementById(`cockpit-hold-text-${stepId}`);
            const ringEl = document.getElementById(`cockpit-hold-ring-${stepId}`);
            if (textEl) {
                const m = Math.floor(remainingSec / 60);
                const s = remainingSec % 60;
                textEl.innerText = m > 0 ? `${m}:${s < 10 ? '0' + s : s}` : s;
            }
            if (ringEl) {
                ringEl.setAttribute('stroke-dasharray', `${fraction * 100}, 100`);
            }
        },
        () => {
            if (isPerSide && sideNum === 1) {
                state.sideState[actIdx] = 2;
                renderCockpitHeroStage(stepId);
            } else {
                handleCockpitActivityFinished(stepId, actIdx);
            }
        }
    );
}

/**
 * Handle Single-set Movement Complete
 */
function handleCockpitSingleComplete(stepId, actIdx) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    if (state.completedActivities.has(actIdx)) {
        // Redo / Uncheck
        state.completedActivities.delete(actIdx);
        renderCockpitHeroStage(stepId);
        renderCockpitPlaylist(stepId);
        updateCockpitProgressBar(stepId);
    } else {
        handleCockpitActivityFinished(stepId, actIdx);
    }
}

/**
 * Advance to next Circuit Round
 */
function advanceCircuitRound(stepId) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    state.currentCircuitRound++;
    state.isTransitioning = false;

    // Reset completion for WORK activities ONLY (Warmup stays marked as completed!)
    const workIndices = getWorkActivityIndices(state);
    workIndices.forEach(idx => {
        state.completedActivities.delete(idx);
        delete state.completedSets[idx];
        delete state.sideState[idx];
    });

    state.activeIdx = workIndices[0] !== undefined ? workIndices[0] : 0;

    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Render the Bottom 50% / Right 45% Scrollable Gym Playlist
 */
function renderCockpitPlaylist(stepId) {
    const state = window.workoutCockpitState[stepId];
    const container = document.getElementById(`cockpit-playlist-${stepId}`);
    if (!state || !container) return;

    const prepIndices = getPrepActivityIndices(state);
    const coolIndices = getCoolActivityIndices(state);

    container.innerHTML = state.activities.map((act, idx) => {
        const isCompleted = state.completedActivities.has(idx);
        const isActive = idx === state.activeIdx;
        const isPrep = prepIndices.includes(idx);
        const isCool = coolIndices.includes(idx);

        let rowStyle = 'bg-slate-900/60 border-slate-800 text-slate-300';
        let statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs sm:text-sm text-slate-400 font-bold font-mono shrink-0">${idx + 1}</span>`;

        if (isCompleted) {
            rowStyle = 'bg-slate-900/30 border-slate-800/40 opacity-60 text-slate-400';
            statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-xs sm:text-sm text-teal-400 font-bold shrink-0"><i class="fa-solid fa-check"></i></span>`;
        } else if (isActive) {
            rowStyle = 'bg-indigo-950/50 border-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.25)] text-white';
            statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-500 border border-indigo-400 flex items-center justify-center text-[10px] sm:text-xs text-white font-bold animate-pulse shrink-0"><i class="fa-solid fa-play ml-0.5"></i></span>`;
        }

        // Tag label for prep / cool
        let tagBadge = '';
        if (isPrep) {
            tagBadge = `<span class="text-[9px] text-amber-400/90 font-extrabold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mr-1.5 shrink-0">Warm-up</span>`;
        } else if (isCool) {
            tagBadge = `<span class="text-[9px] text-teal-400/90 font-extrabold uppercase bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 mr-1.5 shrink-0">Cool-down</span>`;
        }

        // Subtitle
        let targetText = '';
        if (typeof act.targetValue === 'number' && act.targetValue > 0) {
            const type = act.targetType === 'seconds' ? 's hold' : (act.targetType === 'failure' ? ' to fail' : ' reps');
            const sideStr = act.isPerSide ? '/side' : '';
            const setsStr = act.sets && act.sets > 1 && !state.isCircuit ? `${act.sets}×` : '';
            targetText = `${setsStr}${act.targetValue}${type}${sideStr}`;
        } else {
            targetText = act.repsDistanceTime || '';
        }

        return `
            <div id="cockpit-item-${stepId}-${idx}" onclick="jumpToCockpitExercise('${stepId}', ${idx})" class="flex items-center justify-between p-3 sm:p-4 rounded-2xl border ${rowStyle} transition-all cursor-pointer hover:border-slate-700 active:scale-98">
                <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    ${statusIcon}
                    <div class="flex flex-col min-w-0 flex-1">
                        <div class="flex items-center min-w-0">
                            ${tagBadge}
                            <span class="text-xs sm:text-sm md:text-base font-bold truncate ${isActive ? 'text-indigo-200' : ''}">${act.name}</span>
                        </div>
                        <span class="text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium truncate">${targetText} ${act.equipmentRequired && act.equipmentRequired !== 'Bodyweight' && act.equipmentRequired !== 'None' ? '• ' + act.equipmentRequired : ''}</span>
                    </div>
                </div>
                ${!isActive && !isCompleted ? `
                <span class="text-[11px] sm:text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 shrink-0 ml-2">Jump</span>
                ` : ''}
            </div>
        `;
    }).join('');

    // Auto-scroll active item to view
    setTimeout(() => {
        const activeItem = document.getElementById(`cockpit-item-${stepId}-${state.activeIdx}`);
        if (activeItem && container) {
            container.scrollTo({
                top: activeItem.offsetTop - container.offsetTop - 10,
                behavior: 'smooth'
            });
        }
    }, 50);
}

/**
 * Toggle Timer Play/Pause with visual icon update
 */
function toggleCockpitTimer(stepId, iconId) {
    if (!window.workoutTimer) return;
    const iconEl = document.getElementById(iconId);
    if (window.workoutTimer.isPaused) {
        window.workoutTimer.resume();
        if (iconEl) iconEl.className = 'fa-solid fa-pause text-[11px] text-indigo-400 opacity-80 mt-1';
    } else {
        window.workoutTimer.pause();
        if (iconEl) iconEl.className = 'fa-solid fa-play text-[11px] text-amber-400 opacity-90 mt-1';
    }
}
