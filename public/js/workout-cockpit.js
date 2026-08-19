// =========================================================================
// YOURFLOW: WORKOUT COCKPIT ENGINE (Phase 2 - 50/50 Split Execution Player)
// Fluid Dynamic Scaling across Mobile, Tablet, Desktop, and 4K Displays
// =========================================================================

window.workoutCockpitState = window.workoutCockpitState || {};

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
            sideState: {} // { [actIdx]: 1 | 2 } for per-side exercises
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
 * Toggle the coaching tip pill
 */
function toggleCockpitTip(stepId) {
    const tipEl = document.getElementById(`cockpit-tip-${stepId}`);
    const chevron = document.getElementById(`cockpit-tip-chevron-${stepId}`);
    if (tipEl) tipEl.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180');
}

/**
 * Render the Visual Progress Dots & 2px Emerald Volume Line in Header
 */
function updateCockpitProgressBar(stepId) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    // 1. Top 2px Emerald Progress Line
    const total = state.activities.length;
    let totalExpectedVolume = total;
    let completedVolume = state.completedActivities.size;

    if (state.isCircuit && state.circuitRounds > 1) {
        totalExpectedVolume = total * state.circuitRounds;
        completedVolume = ((state.currentCircuitRound - 1) * total) + state.completedActivities.size;
    }

    const pct = totalExpectedVolume > 0 ? (completedVolume / totalExpectedVolume) * 100 : 0;
    const bar = document.getElementById(`cockpit-progress-bar-${stepId}`);
    if (bar) bar.style.width = `${pct}%`;

    // 2. Visual Dot Groupings in Header
    const dotsContainer = document.getElementById(`cockpit-progress-dots-${stepId}`);
    if (!dotsContainer || total === 0) return;

    if (state.isCircuit && state.circuitRounds > 1) {
        // CIRCUIT: Groupings of dots per round with subtle background changes on completion
        let html = '';
        for (let r = 1; r <= state.circuitRounds; r++) {
            const isPastRound = r < state.currentCircuitRound;
            const isCurrentRound = r === state.currentCircuitRound;
            const isCurrentRoundCompleted = isCurrentRound && state.completedActivities.size >= state.activities.length;

            let capsuleClass = 'bg-slate-900/60 border border-slate-800/80 opacity-40';
            if (isPastRound || isCurrentRoundCompleted) {
                capsuleClass = 'bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
            } else if (isCurrentRound) {
                capsuleClass = 'bg-slate-800/90 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/30';
            }

            const dotsHtml = state.activities.map((_, idx) => {
                let dotClass = 'bg-slate-700';
                if (isPastRound || isCurrentRoundCompleted) {
                    dotClass = 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]';
                } else if (isCurrentRound) {
                    if (state.completedActivities.has(idx)) {
                        dotClass = 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]';
                    } else if (idx === state.activeIdx) {
                        dotClass = 'bg-amber-400 scale-125 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.9)]';
                    } else {
                        dotClass = 'bg-slate-700';
                    }
                }
                return `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300 ${dotClass}"></span>`;
            }).join('');

            html += `
                <div class="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 transition-all duration-300 ${capsuleClass}" title="Round ${r} of ${state.circuitRounds}">
                    ${dotsHtml}
                </div>
            `;
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

    // Safely stop any running timer
    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    state.activeIdx = targetIdx;
    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
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

    // Reset side state if applicable
    if (state.sideState[state.activeIdx]) {
        state.sideState[state.activeIdx] = 1;
    }

    renderCockpitHeroStage(stepId);
}

/**
 * Render the Hero Stage with Fluid Mathematical Scaling
 */
function renderCockpitHeroStage(stepId) {
    const state = window.workoutCockpitState[stepId];
    const stage = document.getElementById(`cockpit-hero-stage-${stepId}`);
    if (!state || !stage) return;

    // Check if current round or entire workout is completed
    const isRoundDone = state.completedActivities.size >= state.activities.length;
    
    if (isRoundDone) {
        if (state.isCircuit && state.circuitRounds > 1 && state.currentCircuitRound < state.circuitRounds) {
            // CIRCUIT ROUND RECOVERY STAGE
            stage.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 animate-fade-in w-full h-full my-auto gap-3">
                    <span class="text-xs sm:text-sm font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl shadow-sm">
                        Round ${state.currentCircuitRound} of ${state.circuitRounds} Finished
                    </span>
                    <h3 style="font-size: clamp(1.75rem, min(4.5vw, 4.5vh), 3.25rem); line-height: 1.15;" class="font-black text-white tracking-tight">
                        🎉 Great Round! Take a Breather
                    </h3>
                    
                    <!-- 60s Circuit Rest Timer -->
                    <div style="width: clamp(130px, min(28vw, 24vh), 200px); height: clamp(130px, min(28vw, 24vh), 200px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group my-1" onclick="event.stopPropagation(); if(window.workoutTimer){ if(window.workoutTimer.isPaused) window.workoutTimer.resume(); else window.workoutTimer.pause(); }">
                        <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]" viewBox="0 0 36 36">
                            <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                            <path id="cockpit-circuit-ring-${stepId}" class="text-amber-400 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span id="cockpit-circuit-text-${stepId}" style="font-size: clamp(2.5rem, min(7vw, 6.5vh), 4.5rem);" class="font-black text-white font-mono tracking-tight leading-none">60</span>
                            <span style="font-size: clamp(0.7rem, min(1.5vw, 1.6vh), 0.95rem);" class="font-black text-amber-300 uppercase tracking-widest mt-1">Round Rest</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-center gap-3">
                        <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1rem, 2vw, 1.75rem);" class="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-extrabold transition-all shadow-md active:scale-95 cursor-pointer">
                            +15s
                        </button>
                        <button onclick="advanceCircuitRound('${stepId}')" style="font-size: clamp(1rem, min(2.2vw, 2.4vh), 1.35rem); padding: clamp(0.75rem, 1.6vh, 1.15rem) clamp(1.75rem, 3vw, 2.5rem);" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all flex items-center gap-2 cursor-pointer active:scale-95">
                            <i class="fa-solid fa-play text-sm"></i> Start Round ${state.currentCircuitRound + 1}
                        </button>
                    </div>

                    <span style="font-size: clamp(0.85rem, min(1.7vw, 1.9vh), 1.15rem);" class="font-bold text-slate-400 mt-1">
                        Next: Round ${state.currentCircuitRound + 1} • ${state.activities[0].name}
                    </span>
                </div>
            `;

            if (window.workoutTimer) {
                window.workoutTimer.start(60,
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
            return;
        }

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
        const setsStr = act.sets && act.sets > 1 ? `${act.sets} sets × ` : '';
        targetDisplay = `${setsStr}${act.targetValue} ${type}${sideStr}`;
    } else {
        targetDisplay = act.repsDistanceTime || (act.sets ? `${act.sets} sets` : '1 set');
    }

    const eqStr = (act.equipmentRequired && act.equipmentRequired !== 'Bodyweight' && act.equipmentRequired !== 'None')
        ? ` • <span class="text-slate-200 font-semibold">${act.equipmentRequired}</span>` : '';

    const cueText = act.coachingCue || act.description || '';

    // Build Interaction Area HTML with Fluid Dimensions
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
    } else if (act.sets && act.sets > 1) {
        // MULTI-SET STRENGTH MOVEMENT (Set Bubbles)
        if (!state.completedSets[state.activeIdx]) {
            state.completedSets[state.activeIdx] = new Set();
        }
        const doneSets = state.completedSets[state.activeIdx];

        interactionHtml = `
            <div class="flex flex-col items-center gap-3 sm:gap-4 my-2 w-full max-w-xl">
                <!-- Large Fluid Set Bubbles Row -->
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

                <!-- Inter-Set Rest Container (Hidden until a set is checked) -->
                <div id="cockpit-rest-box-${stepId}" class="hidden flex-col items-center gap-3 w-full animate-fade-in"></div>
            </div>
        `;
    } else {
        // SINGLE-SET REPS MOVEMENT
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
            <!-- Circuit Round Badge if applicable -->
            ${state.isCircuit && state.circuitRounds > 1 ? `
            <span class="text-[11px] sm:text-xs font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl shadow-sm mb-1">
                Round ${state.currentCircuitRound} of ${state.circuitRounds}
            </span>
            ` : ''}

            <!-- Exercise Name (Massive, Fluidly Scaled) -->
            <h2 style="font-size: clamp(1.75rem, min(5vw, 5.5vh), 4.25rem); line-height: 1.1;" class="font-black text-white tracking-tight">
                ${act.name}
            </h2>

            <!-- Metric & Equipment -->
            <div style="font-size: clamp(0.95rem, min(2.2vw, 2.4vh), 1.65rem);" class="font-extrabold text-indigo-300 mt-1 flex items-center justify-center gap-2 flex-wrap">
                <span>${targetDisplay}</span>
                ${eqStr}
            </div>

            <!-- Subtle Form Tip Pill -->
            ${cueText ? `
            <div class="my-1.5 flex flex-col items-center">
                <button onclick="toggleCockpitTip('${stepId}')" style="font-size: clamp(0.75rem, min(1.5vw, 1.8vh), 1rem);" class="font-bold text-slate-400 hover:text-indigo-200 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition-colors flex items-center gap-2 cursor-pointer shadow-sm">
                    <i class="fa-regular fa-lightbulb text-amber-400"></i> Form Tip <i id="cockpit-tip-chevron-${stepId}" class="fa-solid fa-chevron-down text-[9px] transition-transform duration-200"></i>
                </button>
                <div id="cockpit-tip-${stepId}" style="font-size: clamp(0.8rem, min(1.6vw, 1.9vh), 1.05rem);" class="hidden text-slate-300 bg-slate-950/95 p-3.5 sm:p-4 rounded-2xl border border-slate-800 mt-2 text-center leading-relaxed shadow-2xl max-w-sm sm:max-w-md md:max-w-lg">
                    ${cueText}
                </div>
            </div>
            ` : ''}

            <!-- Primary Interactive Stage (Bubbles / Timers) -->
            ${interactionHtml}
        </div>
    `;
}

/**
 * Handle Multi-Set Bubble Click
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
        // UNCHECK SET: Cancel any timer, uncheck, and reset focus
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

    // Is this the final set of this movement?
    const isFinalSet = doneSets.size >= act.sets;

    if (isFinalSet) {
        // Movement Finished: Skip set rest timer and patient-advance!
        state.completedActivities.add(actIdx);
        if (window.workoutTimer) window.workoutTimer.stop();

        // Advance to next uncompleted exercise
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
    } else {
        // Inter-set rest: Start 30s rest countdown with runway
        const restSec = typeof act.restSeconds === 'number' && act.restSeconds > 0 ? act.restSeconds : 30;
        startCockpitRestTimer(stepId, actIdx, setIdx, restSec);
        renderCockpitHeroStage(stepId);
        renderCockpitPlaylist(stepId);
        updateCockpitProgressBar(stepId);
    }
}

/**
 * Start Inter-Set Rest Countdown with Large Fluid Timer Ring
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
            <div class="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-950/90 rounded-3xl border border-slate-800/80 shadow-2xl w-full max-w-md md:max-w-lg">
                <!-- Large Fluid Circular Countdown Ring -->
                <div style="width: clamp(130px, min(28vw, 24vh), 210px); height: clamp(130px, min(28vw, 24vh), 210px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group" onclick="event.stopPropagation(); if(window.workoutTimer){ if(window.workoutTimer.isPaused) window.workoutTimer.resume(); else window.workoutTimer.pause(); }">
                    <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]" viewBox="0 0 36 36">
                        <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                        <path id="cockpit-rest-ring-${stepId}" class="text-indigo-500 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span id="cockpit-rest-text-${stepId}" style="font-size: clamp(2.5rem, min(7vw, 6.5vh), 4.75rem);" class="font-black text-white font-mono tracking-tight leading-none">${durationSec}</span>
                        <span style="font-size: clamp(0.7rem, min(1.5vw, 1.6vh), 0.95rem);" class="font-black text-indigo-300 uppercase tracking-widest mt-1">Rest</span>
                    </div>
                </div>

                <!-- Ghost Controls Bar Below Timer -->
                <div class="flex items-center justify-center gap-3 sm:gap-4 w-full">
                    <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1rem, 2vw, 1.75rem);" class="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-extrabold transition-all shadow-md active:scale-95 cursor-pointer">
                        +15s
                    </button>
                    <button onclick="event.stopPropagation(); resetActiveCockpitTimer('${stepId}');" style="width: clamp(38px, min(8vw, 6vh), 48px); height: clamp(38px, min(8vw, 6vh), 48px);" class="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer" title="Reset Timer">
                        <i class="fa-solid fa-rotate-left text-sm sm:text-base"></i>
                    </button>
                    <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.skip();" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1.2rem, 2.5vw, 2rem);" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-check mr-1.5"></i> Done
                    </button>
                </div>

                <!-- Rest Runway Identifier -->
                <div style="font-size: clamp(0.85rem, min(1.7vw, 1.9vh), 1.15rem);" class="font-bold text-indigo-200 text-center tracking-tight bg-indigo-950/50 border border-indigo-500/30 px-4 py-2 rounded-2xl mt-1 shadow-sm">
                    Next: Set ${nextSetNum} of ${act.sets}${eqLabel}
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
                // Rest Finished: Hide rest box and refresh hero stage
                renderCockpitHeroStage(stepId);
            }
        );
    }, 50);
}

/**
 * Start Timed Hold Countdown with Large Fluid Timer Ring
 */
function startCockpitTimedHold(stepId, actIdx, durationSec, isPerSide, sideNum) {
    const state = window.workoutCockpitState[stepId];
    if (!state || !window.workoutTimer) return;

    const startBtn = document.getElementById(`cockpit-start-hold-btn-${stepId}`);
    if (startBtn) startBtn.classList.add('hidden');

    const timerBox = document.getElementById(`cockpit-hold-timer-${stepId}`);
    if (!timerBox) return;

    timerBox.innerHTML = `
        <div class="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-950/90 rounded-3xl border border-slate-800/80 shadow-2xl w-full max-w-md md:max-w-lg">
            <!-- Large Fluid Circular Countdown Ring -->
            <div style="width: clamp(130px, min(28vw, 24vh), 210px); height: clamp(130px, min(28vw, 24vh), 210px);" class="relative flex items-center justify-center shrink-0 cursor-pointer group" onclick="event.stopPropagation(); if(window.workoutTimer){ if(window.workoutTimer.isPaused) window.workoutTimer.resume(); else window.workoutTimer.pause(); }">
                <svg class="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_25px_rgba(99,102,241,0.45)]" viewBox="0 0 36 36">
                    <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                    <path id="cockpit-hold-ring-${stepId}" class="text-indigo-500 transition-all duration-200" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span id="cockpit-hold-text-${stepId}" style="font-size: clamp(2.5rem, min(7vw, 6.5vh), 4.75rem);" class="font-black text-white font-mono tracking-tight leading-none">${durationSec}</span>
                    <span style="font-size: clamp(0.7rem, min(1.5vw, 1.6vh), 0.95rem);" class="font-black text-indigo-300 uppercase tracking-widest mt-1">${isPerSide ? `Side ${sideNum}` : 'Hold'}</span>
                </div>
            </div>

            <!-- Ghost Controls Bar Below Timer -->
            <div class="flex items-center justify-center gap-3 sm:gap-4 w-full">
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.addTime(15);" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1rem, 2vw, 1.75rem);" class="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-extrabold transition-all shadow-md active:scale-95 cursor-pointer">
                    +15s
                </button>
                <button onclick="event.stopPropagation(); resetActiveCockpitTimer('${stepId}');" style="width: clamp(38px, min(8vw, 6vh), 48px); height: clamp(38px, min(8vw, 6vh), 48px);" class="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer" title="Reset Timer">
                    <i class="fa-solid fa-rotate-left text-sm sm:text-base"></i>
                </button>
                <button onclick="event.stopPropagation(); if(window.workoutTimer) window.workoutTimer.skip();" style="font-size: clamp(0.85rem, min(1.8vw, 2vh), 1.15rem); padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(1.2rem, 2.5vw, 2rem);" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95 cursor-pointer">
                    <i class="fa-solid fa-check mr-1.5"></i> Done
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
                // Advance to Side 2
                state.sideState[actIdx] = 2;
                renderCockpitHeroStage(stepId);
            } else {
                // Completed Hold
                state.completedActivities.add(actIdx);
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
        state.completedActivities.delete(actIdx);
    } else {
        state.completedActivities.add(actIdx);
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
    }

    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}

/**
 * Render the Bottom 50% / Right 45% Scrollable Gym Playlist with Fluid Typography
 */
function renderCockpitPlaylist(stepId) {
    const state = window.workoutCockpitState[stepId];
    const container = document.getElementById(`cockpit-playlist-${stepId}`);
    if (!state || !container) return;

    container.innerHTML = state.activities.map((act, idx) => {
        const isCompleted = state.completedActivities.has(idx);
        const isActive = idx === state.activeIdx;

        let rowStyle = 'bg-slate-900/60 border-slate-800 text-slate-300';
        let statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs sm:text-sm text-slate-400 font-bold font-mono shrink-0">${idx + 1}</span>`;

        if (isCompleted) {
            rowStyle = 'bg-slate-900/30 border-slate-800/40 opacity-60 text-slate-400';
            statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-xs sm:text-sm text-teal-400 font-bold shrink-0"><i class="fa-solid fa-check"></i></span>`;
        } else if (isActive) {
            rowStyle = 'bg-indigo-950/50 border-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.25)] text-white';
            statusIcon = `<span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-500 border border-indigo-400 flex items-center justify-center text-[10px] sm:text-xs text-white font-bold animate-pulse shrink-0"><i class="fa-solid fa-play ml-0.5"></i></span>`;
        }

        // Subtitle
        let targetText = '';
        if (typeof act.targetValue === 'number' && act.targetValue > 0) {
            const type = act.targetType === 'seconds' ? 's hold' : (act.targetType === 'failure' ? ' to fail' : ' reps');
            const sideStr = act.isPerSide ? '/side' : '';
            const setsStr = act.sets && act.sets > 1 ? `${act.sets}×` : '';
            targetText = `${setsStr}${act.targetValue}${type}${sideStr}`;
        } else {
            targetText = act.repsDistanceTime || '';
        }

        return `
            <div id="cockpit-item-${stepId}-${idx}" onclick="jumpToCockpitExercise('${stepId}', ${idx})" class="flex items-center justify-between p-3 sm:p-4 rounded-2xl border ${rowStyle} transition-all cursor-pointer hover:border-slate-700 active:scale-98">
                <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    ${statusIcon}
                    <div class="flex flex-col min-w-0 flex-1">
                        <span class="text-xs sm:text-sm md:text-base font-bold truncate ${isActive ? 'text-indigo-200' : ''}">${act.name}</span>
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
 * Advance to next Circuit Round
 */
function advanceCircuitRound(stepId) {
    const state = window.workoutCockpitState[stepId];
    if (!state) return;

    if (window.workoutTimer) {
        window.workoutTimer.stop();
    }

    state.currentCircuitRound++;
    state.completedActivities.clear();
    state.completedSets = {};
    state.sideState = {};
    state.activeIdx = 0;

    renderCockpitHeroStage(stepId);
    renderCockpitPlaylist(stepId);
    updateCockpitProgressBar(stepId);
}
