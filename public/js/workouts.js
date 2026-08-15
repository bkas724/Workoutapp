function getEffortZoneInfo(workout) {
    let rpe = workout ? workout.targetRPE : null;
    if (!rpe || typeof rpe !== 'number' || rpe < 1 || rpe > 5) {
        if (workout) {
            if (workout.type === 'fast' || workout.isSpeedWorkout || workout.isBenchmark) rpe = 4;
            else if (workout.type === 'strength') rpe = 3;
            else if (workout.type === 'rest') rpe = 1;
            else rpe = 2;
        } else {
            rpe = 2;
        }
    }

    const zones = {
        1: { zone: 1, name: "Z-1", modalLabel: "Zone - 1 • Recovery", desc: "Recovery", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
        2: { zone: 2, name: "Z-2", modalLabel: "Zone - 2 • Easy", desc: "Easy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
        3: { zone: 3, name: "Z-3", modalLabel: "Zone - 3 • Moderate", desc: "Moderate", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
        4: { zone: 4, name: "Z-4", modalLabel: "Zone - 4 • Hard", desc: "Hard", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
        5: { zone: 5, name: "Z-5", modalLabel: "Zone - 5 • Max Effort", desc: "Max Effort", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/30" }
    };

    return zones[rpe] || zones[2];
}

function buildActivePhaseHTML() {
            const container = document.getElementById('jit-checklist-container');
            container.innerHTML = "";

            if (!activePhaseWorkouts || activePhaseWorkouts.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-10 bg-slate-900/50 rounded-2xl border border-slate-800 text-center gap-4">
                        <div class="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2">
                            <i class="fa-solid fa-flag-checkered text-2xl text-indigo-400"></i>
                        </div>
                        <h3 class="text-white font-bold text-lg">Phase Complete</h3>
                        <p class="text-slate-400 text-sm max-w-sm">You have no active workouts. Generate your next phase to continue your journey.</p>
                        <button onclick="proceedToNextPhase()" class="mt-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                            <i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Generate Next Phase
                        </button>
                    </div>
                `;
                return;
            }

            // Toggle Regenerate Button visibility
            const regenBtn = document.getElementById('regenerate-block-btn');
            if (regenBtn) {
                const anyCompleted = activePhaseWorkouts.some(w => w.completed);
                if (anyCompleted) {
                    regenBtn.classList.add('hidden');
                } else {
                    regenBtn.classList.remove('hidden');

                    if (userProfileData) {
                        const currentWeek = getISOWeekString();
                        let count = userProfileData.regenerationCount || 0;
                        if (userProfileData.lastRegenerationWeek !== currentWeek) {
                            count = 0;
                        }
                        const left = Math.max(0, 3 - count);
                        regenBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Regenerate\n(${left} Left)`;

                        if (left === 0) {
                            regenBtn.classList.add('opacity-50', 'cursor-not-allowed');
                        } else {
                            regenBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                    }
                }
            }

            // Group by sequenceOrder
            const groupedWorkouts = {};
            activePhaseWorkouts.forEach(step => {
                const day = step.sequenceOrder || 1;
                if (!groupedWorkouts[day]) {
                    groupedWorkouts[day] = [];
                }
                groupedWorkouts[day].push(step);
            });

            const sortedDays = Object.keys(groupedWorkouts).sort((a, b) => Number(a) - Number(b));

            sortedDays.forEach(day => {
                const dayWorkouts = groupedWorkouts[day];

                // Sort day workouts: non-strength (run/rest) first, strength second
                dayWorkouts.sort((a, b) => {
                    if (a.type === 'strength' && b.type !== 'strength') return 1;
                    if (a.type !== 'strength' && b.type === 'strength') return -1;
                    return 0;
                });

                const hasRest = dayWorkouts.some(w => w.type === 'rest');
                const canAddSecondary = dayWorkouts.length === 1 && !hasRest;

                let dayHTML = `<div class="mb-6 border-b border-slate-800/60 pb-5 last:border-b-0 last:pb-0">`;
                dayHTML += `
                <div class="flex items-center gap-3 mb-3">
                    <h3 class="text-xs font-black text-slate-300 uppercase tracking-widest bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50">Day ${day}</h3>
                    ${canAddSecondary ? `<button onclick="openAddActivityModal(${day})" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95" title="Add Activity to Day ${day}"><i class="fa-solid fa-plus text-[9px]"></i> activity</button>` : ''}
                </div>`;
                dayHTML += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

                dayWorkouts.forEach(step => {
                    const colSpan = dayWorkouts.length === 1 ? 'col-span-1 md:col-span-2' : 'col-span-1';
                    const iconSVG = icons[step.type] || icons.easy;
                    const cardBg = step.completed ? "bg-emerald-900/20 border-emerald-500/30" : "bg-slate-900/30 border-slate-800/55";
                    const showDeleteButton = dayWorkouts.length > 1 && !step.completed;

                    let plannedDist = "";
                    let plannedPace = "";
                    let plannedTime = "";

                    if (!step.completed) {
                        if (step.targetDistance) {
                            plannedDist = `${step.targetDistance} mi`;
                        } else if (step.distanceDuration && (step.distanceDuration.includes('mi') || step.distanceDuration.includes('Mile'))) {
                            plannedDist = step.distanceDuration;
                        }

                        if (step.targetPaceZone) {
                            if (step.targetPaceZone === 'easy') plannedPace = "Easy Pace";
                            else if (step.targetPaceZone === 'long') plannedPace = "Long Pace";
                            else if (step.targetPaceZone === 'tempo') plannedPace = "Tempo Pace";
                            else if (step.targetPaceZone === 'goal') plannedPace = `Goal: ${userProfileData ? userProfileData.activeAdjustedGoal : "6:26"} /mi`;
                            else plannedPace = step.targetPaceZone;
                        }

                        if (step.targetDuration) {
                            plannedTime = `${step.targetDuration} mins`;
                        } else if (getDisplayDuration(step) && !getDisplayDuration(step).includes('mi') && !getDisplayDuration(step).includes('Mile')) {
                            plannedTime = getDisplayDuration(step);
                        } else if (step.distanceDuration && !step.distanceDuration.includes('mi') && !step.distanceDuration.includes('Mile')) {
                            plannedTime = step.distanceDuration;
                        }
                    }

                    dayHTML += `
                        <div class="${colSpan} flex items-start gap-3 p-3.5 rounded-xl ${cardBg} hover:border-slate-700 transition-all h-full relative group">
                            
                            <div onclick="toggleStepCheckDirect('${step.id}')" class="relative p-2 bg-slate-950 rounded-lg border border-slate-800/80 shrink-0 cursor-pointer hover:border-emerald-500/50 transition-colors" title="Toggle Completion">
                                ${iconSVG}
                                ${step.completed ? `<div class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 shadow-sm border-2 border-slate-950 z-10"><i class="fa-solid fa-check text-[9px] font-black"></i></div>` : ''}
                            </div>

                            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                                <!-- Row 1: Workout Title (Left) & Modify Button (Right) -->
                                <div class="flex items-center justify-between gap-2">
                                    <h4 class="text-xs font-extrabold text-slate-200 truncate ${step.completed ? 'opacity-70' : ''}" title="${step.workoutTitle}">
                                        ${step.workoutTitle}
                                    </h4>
                                    ${!step.completed ? `
                                    <button onclick="openSwapModifyModal('${step.id}')" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 active:scale-95 border border-indigo-500/30 text-indigo-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer select-none shrink-0" title="Modify or Swap Workout">
                                        <i class="fa-solid fa-sliders text-[9px]"></i> Modify
                                    </button>
                                    ` : ''}
                                </div>

                                <!-- Row 2: Metric Badges (Grey when incomplete, Green when complete) -->
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    ${!step.completed ? `
                                        <!-- UNCOMPLETED: Planned Metrics in Grey Boxes -->
                                        ${plannedDist ? `<span class="text-[10px] text-slate-300 font-bold font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/80" title="Planned Distance">${plannedDist}</span>` : ''}
                                        ${plannedPace ? `<span class="text-[10px] text-slate-300 font-bold font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/80" title="Planned Pace">${plannedPace}</span>` : ''}
                                        ${plannedTime ? `<span class="text-[10px] text-slate-300 font-bold font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/80" title="Planned Duration">${plannedTime}</span>` : ''}
                                    ` : `
                                        <!-- COMPLETED: Actual Logged Metrics in Green Boxes (Planned Grey Boxes Removed) -->
                                        ${step.actualLoggedDistance ? `<span class="text-[10px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20" title="Actual Logged Distance">${step.actualLoggedDistance} mi</span>` : ''}
                                        ${step.actualLoggedDuration ? `<span class="text-[10px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20" title="Actual Logged Duration">${step.actualLoggedDuration} min</span>` : ''}
                                        ${step.actualLoggedPace ? `<span class="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20" title="Actual Logged Pace">${step.actualLoggedPace} /mi</span>` : ''}
                                        ${step.rpeScore ? `<span class="text-[10px] font-bold text-violet-400 font-mono bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20" title="Effort Score">RPE: ${step.rpeScore}/10</span>` : ''}
                                    `}
                                </div>

                                <!-- Row 3: Target Instructions (Uncompleted) or User Notes (Completed) -->
                                ${!step.completed ? `
                                    <div class="flex items-start justify-between mt-0.5 gap-2">
                                        <p class="text-xs text-slate-400 leading-relaxed line-clamp-2">${step.targetInstructions}</p>
                                        ${showDeleteButton ? `<button onclick="removeSecondaryWorkout('${step.id}')" class="text-slate-500 hover:text-rose-400 transition-colors shrink-0 ml-2" title="Remove Activity"><i class="fa-solid fa-times"></i></button>` : ''}
                                    </div>
                                ` : `
                                    ${(() => {
                            const note = step.userWorkoutNotes || step.userNotes || step.notes || step.workoutNotes;
                            return note ? `
                                        <div class="mt-1 bg-indigo-950/40 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs text-indigo-200/90 italic flex items-center gap-2">
                                            <i class="fa-regular fa-comment-dots text-indigo-400 not-italic shrink-0 text-xs"></i>
                                            <span class="truncate">"${note}"</span>
                                        </div>
                                        ` : '';
                        })()}
                                `}
                                ${step.completed && step.repSplits && step.repSplits.length > 0 ? `
                                <div class="mt-2 w-full">
                                    <button onclick="event.stopPropagation(); toggleRepSplitsDrawer('${step.id}')" class="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors cursor-pointer select-none">
                                        <i class="fa-solid fa-stopwatch text-[9px]"></i> View ${step.repSplits.length} Rep Splits <i class="fa-solid fa-chevron-down text-[8px] transition-transform duration-200" id="rep-chevron-${step.id}"></i>
                                    </button>
                                    <div id="rep-drawer-${step.id}" class="hidden mt-1.5 p-2 bg-slate-950/90 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                        ${step.repSplits.map((split, idx) => `
                                        <div class="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 flex justify-between items-center">
                                            <span class="text-slate-500 font-bold">R${idx + 1}:</span>
                                            <span class="font-bold text-emerald-400">${split}</span>
                                        </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                                ${step.completed && step.dateExecuted ? `
                                <div class="flex items-center gap-2 mt-1.5">
                                    <span class="text-[9px] text-slate-500 font-semibold">Completed on:</span>
                                    <input type="date" value="${step.dateExecuted}" onchange="updateWorkoutDate('${step.id}', this.value)" class="bg-slate-950 border border-slate-850 text-slate-400 text-[10px] px-2 py-0.5 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer font-mono select-none">
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });

                dayHTML += `</div></div>`;
                container.innerHTML += dayHTML;
            });
        }

function renderNextActivityCard() {
            lastUploadedWorkoutFile = null; // Reset uploaded workout file state for a fresh card
            const container = document.getElementById('focus-content');

            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const todayLocalStr = `${year}-${month}-${day}`;

            // Find the active sequence order
            let activeSequenceOrder = null;
            let lastCompletedStep = null;

            for (let i = 0; i < activePhaseWorkouts.length; i++) {
                if (activePhaseWorkouts[i].completed) {
                    lastCompletedStep = activePhaseWorkouts[i];
                }
            }

            for (let w of activePhaseWorkouts) {
                if (!w.completed) {
                    activeSequenceOrder = w.sequenceOrder;
                    break;
                }
            }

            // Lock to today's completed slate if applicable
            let renderSequenceOrder = activeSequenceOrder;
            if (lastCompletedStep && lastCompletedStep.dateExecuted === todayLocalStr) {
                if (activeSequenceOrder === null || activeSequenceOrder > lastCompletedStep.sequenceOrder) {
                    renderSequenceOrder = lastCompletedStep.sequenceOrder;
                }
            }

            if (renderSequenceOrder === null) {
                const completedBadgeEl = document.getElementById('todays-flow-completed-badge');
                if (completedBadgeEl) {
                    completedBadgeEl.classList.add('hidden');
                    completedBadgeEl.classList.remove('inline-flex', 'flex');
                }
                container.innerHTML = `
                    <div class="flex flex-col md:flex-row items-center md:items-start justify-between w-full gap-4 p-5 bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-xl text-emerald-400">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                                <i class="fa-solid fa-trophy"></i>
                            </div>
                            <div>
                                <h2 class="text-xl font-extrabold text-white tracking-tight">Phase Block Complete! 🎉</h2>
                                <p class="text-xs text-slate-300 mt-1">Great job finishing your 7-day training block. Ask Coach for your next block.</p>
                            </div>
                        </div>
                        <button id="gen-next-phase-btn-home" onclick="proceedToNextPhase()" class="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md whitespace-nowrap flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Next Phase
                        </button>
                    </div>`;
                updateJITConsistencyBadge();
                return;
            }

            const dailySlate = activePhaseWorkouts.filter(w => w.sequenceOrder === renderSequenceOrder);

            let allCompleted = dailySlate.length > 0 && dailySlate.every(w => w.completed);
            let isBlockFullyFinished = activeSequenceOrder === null;

            const completedBadgeEl = document.getElementById('todays-flow-completed-badge');
            if (completedBadgeEl) {
                if (allCompleted) {
                    completedBadgeEl.classList.remove('hidden');
                    completedBadgeEl.classList.add('inline-flex');
                } else {
                    completedBadgeEl.classList.add('hidden');
                    completedBadgeEl.classList.remove('inline-flex', 'flex');
                }
            }

            let htmlAccumulator = `<div class="space-y-4 w-full">
                <div class="flex flex-col gap-4 w-full">`;
            let modalsAccumulator = '';

            for (let i = 0; i < dailySlate.length; i++) {
                const nextStep = dailySlate[i];
                const isSpeed = nextStep.isSpeedWorkout;
                const isBenchmark = nextStep.isBenchmark;
                const iconSVG = icons[nextStep.type] || icons.easy;

                // Calculate defaults
                let defaultDistance = nextStep.actualLoggedDistance || "";
                if (!defaultDistance && nextStep.targetDistance) {
                    defaultDistance = parseFloat(nextStep.targetDistance) || "";
                }
                const distDurStr = getDisplayDuration(nextStep);
                if (!defaultDistance && distDurStr && distDurStr.toLowerCase().includes("mile")) {
                    defaultDistance = parseFloat(distDurStr) || "";
                }

                let defaultDuration = nextStep.actualLoggedDuration || "";

                let targetMidDecimal = null;
                const currentMins = parseFloat(document.getElementById('input-min') ? document.getElementById('input-min').value : 8) || 8;
                const currentSecs = parseFloat(document.getElementById('input-sec') ? document.getElementById('input-sec').value : 10) || 10;
                const decimalPace = currentMins + (currentSecs / 60);

                if (nextStep.targetPaceZone === 'easy') targetMidDecimal = decimalPace + (80 / 60);
                else if (nextStep.targetPaceZone === 'long') targetMidDecimal = decimalPace + (55 / 60);
                else if (nextStep.targetPaceZone === 'tempo') targetMidDecimal = decimalPace - (57.5 / 60);
                else if (nextStep.targetPaceZone === 'goal') {
                    const goalPaceStr = userProfileData ? userProfileData.activeAdjustedGoal : "6:26";
                    if (goalPaceStr) {
                        const p = goalPaceStr.split(':');
                        targetMidDecimal = parseInt(p[0]) + (parseInt(p[1] || 0) / 60);
                    }
                } else if (nextStep.targetPaceZone === 'race') targetMidDecimal = 6 + (25 / 60);

                let defaultMin = "", defaultSec = "";
                if (nextStep.actualLoggedPace) {
                    const parts = nextStep.actualLoggedPace.split(':');
                    defaultMin = parts[0];
                    defaultSec = parts[1];
                } else if (targetMidDecimal !== null) {
                    defaultMin = Math.floor(targetMidDecimal);
                    let sec = Math.round((targetMidDecimal - defaultMin) * 60);
                    defaultSec = sec < 10 ? '0' + sec : sec;
                }

                let paceHtml = "";
                if (nextStep.targetPaceZone || getDisplayDuration(nextStep) || nextStep.type !== 'rest') {
                    paceHtml = `<div class="mt-4 flex gap-8 flex-wrap">`;

                    if (getDisplayDuration(nextStep)) {
                        let label = getDisplayDuration(nextStep).toLowerCase().includes('mile') ? 'Distance' : 'Duration';
                        paceHtml += `<div>
                            <span class="block text-[10px] text-indigo-300 uppercase tracking-wider mb-1 font-bold">${label}</span>
                            <span class="font-mono text-xl md:text-2xl font-black text-white">${getDisplayDuration(nextStep)}</span>
                        </div>`;
                    }

                    if (nextStep.targetPaceZone) {
                        let pType = nextStep.targetPaceZone;
                        paceHtml += `<div>
                            <span class="block text-[10px] text-indigo-300 uppercase tracking-wider mb-1 font-bold">Target Pace</span>
                            <span class="font-mono text-xl md:text-2xl font-black text-white dynamic-pace-hint" data-type="${pType}">Computing...</span>
                        </div>`;
                    }

                    const zoneInfo = getEffortZoneInfo(nextStep);
                    paceHtml += `<div>
                        <span class="block text-[10px] text-indigo-300 uppercase tracking-wider mb-1 font-bold">Target Effort</span>
                        <span class="font-mono text-xl md:text-2xl font-black ${zoneInfo.color}">${zoneInfo.modalLabel}</span>
                    </div>`;

                    paceHtml += `</div>`;
                }

                const isCheckedAttr = nextStep.completed ? "checked" : "";
                const opacityClass = nextStep.completed ? "opacity-60 grayscale-[30%]" : "";

                const isComplexWorkout = nextStep.type === 'strength' ||
                    Boolean(nextStep.strengthGuideReference) ||
                    (nextStep.activities && nextStep.activities.filter(a => a.type === 'work').length > 1);

                htmlAccumulator += `
                    <div id="focus-card-${nextStep.id}" class="relative ${opacityClass} transition-all duration-300 w-full">
                        <!-- Outer Card Container -->
                        <div class="w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative group">
                            ${nextStep.completed ? `
                            <!-- CONDENSED COMPLETED STATE -->
                            <div class="p-3 md:p-4 flex flex-col gap-3">
                                <div class="flex items-center justify-between gap-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-6 h-6 shrink-0 text-slate-400">${iconSVG}</div>
                                        <h2 class="text-base md:text-lg font-bold text-white tracking-tight flex items-baseline gap-2">
                                            ${nextStep.workoutTitle}
                                        </h2>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <label class="relative flex items-center justify-center cursor-pointer w-8 h-8 rounded-lg group transition-all bg-teal-500 border border-teal-500 hover:bg-rose-500 hover:border-rose-500 shrink-0" title="Unsubmit Workout">
                                            <input type="checkbox" checked onchange="handleWorkoutCheckToggle('${nextStep.id}', ${isBenchmark}, '${nextStep.type}', this)" class="peer sr-only">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        </label>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 flex-wrap bg-slate-900/50 rounded-lg p-2 border border-slate-800/50">
                                    <div class="flex items-center gap-1 text-[10px] text-slate-400 font-bold font-mono bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                                        <i class="fa-regular fa-calendar text-slate-500"></i>
                                        <input type="date" value="${nextStep.dateExecuted}" onchange="updateWorkoutDate('${nextStep.id}', this.value)" class="bg-transparent border-none text-slate-400 hover:text-slate-300 p-0 focus:outline-none cursor-pointer select-none text-[10px] w-[80px]">
                                    </div>
                                    ${nextStep.actualActivityType && nextStep.actualActivityType !== nextStep.type ? `<span class="text-[10px] text-sky-400 font-bold font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 capitalize">Type: ${nextStep.actualActivityType}</span>` : ''}
                                    ${nextStep.actualLoggedDistance ? `<span class="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">${nextStep.actualLoggedDistance} mi</span>` : ''}
                                    ${nextStep.actualLoggedDuration ? `<span class="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">${nextStep.actualLoggedDuration} min</span>` : ''}
                                    ${nextStep.actualLoggedPace ? `<span class="text-[10px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">${nextStep.actualLoggedPace} /mi</span>` : ''}
                                    ${nextStep.rpeScore ? `<span class="text-[10px] text-violet-400 font-bold font-mono bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">RPE: ${nextStep.rpeScore}/10</span>` : ''}
                                </div>
                                ${nextStep.repSplits && nextStep.repSplits.length > 0 ? `
                                <div class="mt-2 w-full">
                                    <button onclick="event.stopPropagation(); toggleRepSplitsDrawer('${nextStep.id}')" class="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors cursor-pointer select-none">
                                        <i class="fa-solid fa-stopwatch text-[9px]"></i> View ${nextStep.repSplits.length} Rep Splits <i class="fa-solid fa-chevron-down text-[8px] transition-transform duration-200" id="rep-chevron-${nextStep.id}"></i>
                                    </button>
                                    <div id="rep-drawer-${nextStep.id}" class="hidden mt-1.5 p-2 bg-slate-950/90 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                        ${nextStep.repSplits.map((split, idx) => `
                                        <div class="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 flex justify-between items-center">
                                            <span class="text-slate-500 font-bold">R${idx + 1}:</span>
                                            <span class="font-bold text-emerald-400">${split}</span>
                                        </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <!-- Option B: Post-Execution Smart Button (Visible ONLY after today's workout is completed) -->
                            <button onclick="event.stopPropagation(); openAddActivityModal(${nextStep.sequenceOrder || 1});" class="mt-3 w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98" title="Add a secondary activity to today's log">
                                <i class="fa-solid fa-plus text-xs text-indigo-400"></i> Add Secondary Activity Today
                            </button>
                            ` : `
                            <!-- NORMAL UNCOMPLETED STATE -->
                            <!-- Header Bar -->
                            <div onclick="if(!event.target.closest('input') && !event.target.closest('button') && !event.target.closest('label')) openWorkoutModal('${nextStep.id}')" class="p-4 md:p-5 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between md:grid md:grid-cols-12 md:items-center gap-3 md:gap-4 cursor-pointer hover:bg-slate-800/80 transition-colors relative overflow-hidden group">
                                
                                <!-- Background Watermark Icon Backdrop -->
                                <div id="watermark-icon-${nextStep.id}" class="absolute top-1/2 right-4 md:right-16 -translate-y-1/2 w-40 sm:w-48 md:w-56 h-40 sm:h-48 md:h-56 pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center opacity-15 md:opacity-20 transition-all duration-300 group-hover:opacity-30 group-hover:scale-105 [&>div]:!w-full [&>div]:!h-full [&>svg]:!w-full [&>svg]:!h-full [&>i]:text-[130px] md:[&>i]:text-[160px]">
                                    ${iconSVG}
                                </div>

                                <!-- Left Section: Badges, Title & Time/Zone Pill (Flex-1 on Mobile, Cols 1-9 on Desktop) -->
                                <div class="flex flex-col min-w-0 flex-1 md:col-span-9 relative z-10">
                                    <!-- Top Row (Prep Badge, Time Readout & Subtle Z-X Zone Badge) -->
                                    <div class="flex items-center gap-2 flex-wrap mb-1">
                                        ${nextStep.jitPreparationTip ? `<button id="jit-badge-${nextStep.id}" onclick="event.stopPropagation(); openPrepTipModal(event, '${nextStep.id}')" class="text-[9px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full hover:bg-amber-900/60 transition-colors cursor-pointer ${!nextStep.hasReadJitTip ? 'pulse-slow' : ''}">🔥 Prep</button>` : ''}
                                        ${(() => {
                                            const zoneInfo = getEffortZoneInfo(nextStep);
                                            const dur = getDisplayDuration(nextStep);
                                            let timeStr = "";
                                            if (nextStep.type === 'rest') timeStr = "Rest Day";
                                            else if (nextStep.targetDuration) timeStr = `${nextStep.targetDuration} mins`;
                                            else if (dur && !dur.toLowerCase().includes('mile')) timeStr = dur;
                                            else if (nextStep.type === 'strength') timeStr = "35 mins";
                                            else timeStr = "30 mins";

                                            return `
                                            <span class="text-sm md:text-base font-black text-indigo-400 flex items-center gap-1">
                                                <i class="fa-regular fa-clock text-xs md:text-sm text-indigo-400"></i> ${timeStr}
                                            </span>
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${zoneInfo.bg} ${zoneInfo.color}">Z-${zoneInfo.zone}</span>
                                            `;
                                        })()}
                                    </div>

                                    <!-- Workout Title -->
                                    <h2 class="text-lg md:text-xl font-black text-white tracking-tight leading-snug line-clamp-2" title="${nextStep.workoutTitle}">${nextStep.workoutTitle}</h2>
                                </div>

                                <!-- Right Section: Action Controls Station (Stacked Checkbox + Log Button on Mobile, Horizontal on Desktop) -->
                                <div class="focus-action-controls-station flex flex-col md:flex-row items-center justify-center md:justify-end gap-1.5 shrink-0 relative z-10 md:col-span-3 self-center">
                                    ${nextStep.type === 'rest' ? `
                                    <button onclick="event.stopPropagation(); quickCompleteWorkout('${nextStep.id}', false, 'rest');" class="w-12 h-12 md:w-auto md:px-4 md:py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-2 border-teal-500/60 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-teal-950/40 active:scale-95" title="Confirm Rest Day">
                                        <i class="fa-solid fa-check text-xl md:text-sm text-teal-300"></i> <span class="hidden md:inline text-teal-200 font-extrabold">Confirm Rest</span>
                                    </button>
                                    ` : `
                                    <button id="quick-btn-${nextStep.id}" onclick="event.stopPropagation(); quickCompleteWorkout('${nextStep.id}', ${isBenchmark}, '${nextStep.type}');" class="w-12 h-12 md:w-auto md:px-4 md:py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-2 border-teal-500/60 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-950/40 active:scale-95" title="Quick Complete (Target Defaults)">
                                        <i class="fa-solid fa-check text-xl md:text-sm text-teal-300"></i> <span class="hidden md:inline text-teal-200 font-extrabold">Quick Complete</span>
                                    </button>
                                    <button id="log-btn-${nextStep.id}" onclick="event.stopPropagation(); toggleGatekeeper('${nextStep.id}');" class="w-12 h-8 md:w-auto md:px-3.5 md:py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95">
                                        <span class="hidden md:inline-block"><i class="fa-solid fa-sliders text-[11px] mr-1"></i></span><span>Log</span>
                                    </button>
                                    <button id="cancel-btn-${nextStep.id}" onclick="event.stopPropagation(); toggleGatekeeper('${nextStep.id}', false);" class="hidden w-12 h-8 md:w-auto md:px-3 md:py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95" title="Cancel">
                                        <span class="hidden md:inline-block"><i class="fa-solid fa-xmark text-xs mr-1"></i></span><span>Cancel</span>
                                    </button>
                                    `}
                                </div>
                            </div>

                            <!-- Body: Details and Logging -->
                            <div id="card-body-${nextStep.id}" class="p-4 md:p-5 hidden">
                                <div id="activity-details-${nextStep.id}" class="hidden"></div>
                                <div id="gatekeeper-form-container-${nextStep.id}" class="flex flex-col w-full hidden">
                                        <div id="gatekeeper-form-${nextStep.id}" class="flex flex-col gap-3 relative w-full">
                                            <div class="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-1">
                                                <span class="block text-xs font-black text-indigo-300 uppercase tracking-wider m-0">
                                                    Log Workout Metrics
                                                </span>
                                                <div class="flex items-center gap-2">
                                                    ${nextStep.type !== 'rest' ? `
                                                    <button onclick="openAlternativeModal('${nextStep.id}')" class="bg-slate-800/40 hover:bg-slate-700/60 text-slate-500 hover:text-slate-400 border border-slate-800/50 hover:border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer">
                                                        <i class="fa-solid fa-shuffle text-[9px]"></i> Alternative
                                                    </button>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            <div>
                                                ${nextStep.type !== 'rest' ? `
                                                <div class="flex flex-wrap items-center gap-3">
                                                    ${(nextStep.targetDistance || ['run', 'walk', 'bike', 'swim', 'easy', 'fast', 'long', 'tempo', 'interval', 'recovery', 'base', 'aerobic'].includes(nextStep.type?.toLowerCase())) ? `
                                                    ${(() => {
                                const intervalMeta = getIntervalMetadata(nextStep);
                                if (intervalMeta) {
                                    return `
                                                             <!-- Simplified Interval Entry Deck (Clean & Un-nested) -->
                                                                 <div class="flex flex-col gap-2 w-full">
                                                                     <div class="w-full flex items-stretch justify-center gap-4 py-1 max-w-md mx-auto">
                                                                     <!-- Left Column: Reps & Distance + Total Work underneath (Centered) -->
                                                                     <div class="flex-1 flex flex-col gap-2 items-center justify-center text-center">
                                                                         <div class="flex items-center justify-center gap-2">
                                                                             <!-- Reps (EDITABLE INPUT) -->
                                                                             <div class="flex flex-col items-center gap-1">
                                                                                 <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider select-none">Reps</span>
                                                                                 <input id="interval-reps-input-${nextStep.id}" type="number" min="1" max="50" value="${intervalMeta.repCount}" oninput="recalculateIntervalPace('${nextStep.id}')" class="w-12 bg-indigo-950/40 text-center font-bold text-amber-400 focus:outline-none focus:border-indigo-400 focus:bg-indigo-950/80 text-xs rounded-lg border border-indigo-500/30 py-1.5 font-mono shadow-inner transition-all" title="Editable Rep Count">
                                                                             </div>

                                                                             <span class="text-slate-600 font-bold text-xs mt-3 select-none">×</span>

                                                                             <!-- Distance (READ-ONLY TARGET BADGE) -->
                                                                             <div class="flex flex-col items-center gap-1">
                                                                                 <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider select-none">Distance</span>
                                                                                 <span class="text-xs font-bold text-slate-300 font-mono bg-slate-800/50 px-2.5 py-1.5 rounded-lg select-none leading-normal" title="Fixed Target Distance">${intervalMeta.repDistance}</span>
                                                                             </div>
                                                                         </div>

                                                                         <!-- Total Distance Readout (BORDERLESS CALCULATED & CENTERED) -->
                                                                         <div class="text-[10px] text-slate-400 font-medium select-none pt-0.5">
                                                                             Total: <span id="calculated-dist-display-${nextStep.id}" class="font-bold text-slate-200 font-mono">-- mi</span>
                                                                         </div>
                                                                     </div>

                                                                     <!-- Vertical Divider -->
                                                                     <div class="w-px bg-slate-800/60 my-1 self-center h-10"></div>

                                                                     <!-- Right Column: Avg Time + Mile Pace underneath (Centered) -->
                                                                     <div class="flex-1 flex flex-col gap-2 items-center justify-center text-center">
                                                                         <!-- Avg Rep Time (EDITABLE INPUTS OR CALCULATED BADGE) -->
                                                                         <div class="flex flex-col items-center gap-1">
                                                                             <div class="flex items-center justify-center gap-1">
                                                                                 <span class="text-[9px] text-indigo-300 font-bold uppercase tracking-wider select-none">Avg Time</span>
                                                                                 <span class="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-800 text-slate-400 text-[8px] cursor-pointer hover:bg-slate-700 hover:text-indigo-300 transition-colors" title="Average duration per interval rep. Per-mile pace is calculated automatically.">?</span>
                                                                             </div>
                                                                             <div id="interval-avg-inputs-container-${nextStep.id}" class="flex items-center justify-center gap-1">
                                                                                 <input id="interval-avg-min-${nextStep.id}" type="number" min="0" max="60" placeholder="Min" oninput="recalculateIntervalPace('${nextStep.id}')" class="w-11 bg-indigo-950/40 text-center font-bold text-white focus:outline-none focus:border-indigo-400 focus:bg-indigo-950/80 text-xs rounded-lg border border-indigo-500/30 py-1.5 font-mono shadow-inner transition-all" title="Editable Rep Minutes">
                                                                                 <span class="text-slate-500 font-bold text-xs">:</span>
                                                                                 <input id="interval-avg-sec-${nextStep.id}" type="number" min="0" max="59" placeholder="Sec" oninput="recalculateIntervalPace('${nextStep.id}')" class="w-11 bg-indigo-950/40 text-center font-bold text-white focus:outline-none focus:border-indigo-400 focus:bg-indigo-950/80 text-xs rounded-lg border border-indigo-500/30 py-1.5 font-mono shadow-inner transition-all" title="Editable Rep Seconds">
                                                                             </div>
                                                                             <div id="interval-avg-badge-container-${nextStep.id}" class="hidden py-0.5">
                                                                                 <span id="interval-avg-badge-display-${nextStep.id}" class="text-xs font-bold text-slate-300 font-mono bg-slate-800/50 px-2.5 py-1.5 rounded-lg select-none leading-normal" title="Calculated Average Rep Time">--:--</span>
                                                                             </div>
                                                                         </div>

                                                                         <!-- Pace Readout (BORDERLESS CALCULATED & CENTERED) -->
                                                                         <div class="text-[10px] text-emerald-400 font-bold font-mono select-none pt-0.5">
                                                                             <span id="calculated-pace-display-${nextStep.id}">--:-- /mi</span>
                                                                         </div>
                                                                     </div>
                                                                 </div>

                                                                 <!-- Hidden Standard Log Inputs (populated dynamically) -->
                                                                 <input id="logged-distance-${nextStep.id}" type="hidden" value="${defaultDistance}">
                                                                 <input id="logged-min-${nextStep.id}" type="hidden" value="${defaultMin}">
                                                                 <input id="logged-sec-${nextStep.id}" type="hidden" value="${defaultSec}">
                                                             </div>
                                                             `;
                                } else {
                                    return `
                                                            <div class="flex items-center bg-slate-900 p-2 rounded-xl border border-slate-800 w-max">
                                                                <input id="logged-distance-${nextStep.id}" type="number" step="0.01" min="0" placeholder="Dist" value="${defaultDistance}" class="w-12 bg-transparent text-center font-bold text-white focus:outline-none text-xs">
                                                                <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider ml-1 mr-3">mi</span>
                                                                
                                                                <div class="w-px h-4 bg-slate-700 mx-1"></div>
                                                                
                                                                <input id="logged-min-${nextStep.id}" type="number" min="0" max="60" placeholder="Min" value="${defaultMin}" class="w-10 bg-transparent text-center font-bold text-white focus:outline-none text-xs ml-3">
                                                                <span class="text-slate-650 font-bold text-xs">:</span>
                                                                <input id="logged-sec-${nextStep.id}" type="number" min="0" max="59" placeholder="Sec" value="${defaultSec}" class="w-10 bg-transparent text-center font-bold text-white focus:outline-none text-xs">
                                                                <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider ml-1 mr-1">/ mi</span>
                                                            </div>
                                                            `;
                                }
                            })()}
                                                </div>
                                                        <!-- Interval Rep Splits Container (Collapsible Accordion, Collapsed by Default) -->
                                                        <div id="interval-splits-container-${nextStep.id}" class="hidden flex flex-col gap-2 border-t border-slate-800/40 pt-2 mt-1">
                                                            <button type="button" onclick="toggleAdvancedRepSplits('${nextStep.id}')" class="w-full flex items-center justify-between text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors px-1 py-0.5 cursor-pointer select-none">
                                                                <span class="text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors" id="interval-splits-title-${nextStep.id}">
                                                                    Advanced Rep splits
                                                                </span>
                                                                <span class="text-[10px] text-slate-500 flex items-center gap-1">
                                                                    <span id="rep-split-count-badge-${nextStep.id}" class="hidden"></span>
                                                                    <i class="fa-solid fa-chevron-down text-[8px] transition-transform duration-200" id="rep-split-chevron-${nextStep.id}"></i>
                                                                </span>
                                                            </button>
                                                            
                                                            <div id="advanced-rep-body-${nextStep.id}" class="hidden flex flex-col gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 mt-1">
                                                                <div class="flex items-center justify-end w-full">
                                                                    <div class="flex items-center gap-1.5">
                                                                        <button type="button" onclick="autoFillIntervalTargetPace('${nextStep.id}')" class="px-2 py-0.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 transition-all active:scale-95 cursor-pointer" title="Pre-fill all reps with target split">
                                                                            Auto-Fill Target
                                                                        </button>
                                                                        <button type="button" onclick="adjustRepCount('${nextStep.id}', -1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black transition-all active:scale-95 cursor-pointer" title="Remove last rep">-</button>
                                                                        <button type="button" onclick="adjustRepCount('${nextStep.id}', 1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black transition-all active:scale-95 cursor-pointer" title="Add extra rep">+</button>
                                                                    </div>
                                                                </div>
                                                                <div id="rep-rows-grid-${nextStep.id}" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                            ` : `
                                            <div class="flex items-center gap-1.5 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <input id="logged-duration-${nextStep.id}" type="number" min="0" placeholder="Time" class="w-16 bg-transparent text-center font-bold text-white focus:outline-none text-xs">
                                                <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider ml-1 mr-1">mins</span>
                                            </div>
                                            `}
                                            <div class="flex flex-wrap items-center gap-2 mt-1">
                                                 <div class="flex-1 min-w-[120px]">
                                                     ${(() => {
                                                         const selRpe = nextStep.rpeScore || nextStep.targetRPE || 2;
                                                         return `
                                                         <select id="logged-rpe-${nextStep.id}" class="w-full bg-slate-900 border border-slate-800/80 text-slate-200 text-xs font-bold py-2 px-2.5 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer">
                                                             <option value="" disabled ${!selRpe ? 'selected' : ''}>Select Zone</option>
                                                             <option value="1" ${selRpe == '1' ? 'selected' : ''}>Zone - 1 (Recovery / Very Light)</option>
                                                             <option value="2" ${selRpe == '2' ? 'selected' : ''}>Zone - 2 (Easy / Conversational)</option>
                                                             <option value="3" ${selRpe == '3' ? 'selected' : ''}>Zone - 3 (Moderate / Steady)</option>
                                                             <option value="4" ${selRpe == '4' ? 'selected' : ''}>Zone - 4 (Hard / Threshold)</option>
                                                             <option value="5" ${selRpe == '5' ? 'selected' : ''}>Zone - 5 (Max Effort / Failure)</option>
                                                         </select>
                                                         `;
                                                     })()}
                                                 </div>
                                                 <div class="flex-1 min-w-[130px] max-w-full bg-slate-900 py-1.5 px-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                                                     <input id="logged-date-${nextStep.id}" type="date" value="${todayLocalStr}" class="w-full bg-transparent font-bold text-white focus:outline-none text-xs cursor-pointer select-none">
                                                 </div>
                                                 <div class="w-full mt-1">
                                                     <textarea id="logged-notes-${nextStep.id}" class="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs p-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600 resize-none h-16" placeholder="Add workout notes or splits...">${nextStep.actualLoggedNotes || ''}</textarea>
                                                 </div>
                                             </div>
                                            ${isSpeed ? `
                                            <div class="flex items-center gap-1.5 w-full mt-1">
                                                <input type="file" id="workout-file-upload-${nextStep.id}" accept=".gpx,.tcx,.json,.txt" class="hidden" onchange="handleWorkoutFileUpload(this, '${nextStep.id}')">
                                                <button type="button" onclick="document.getElementById('workout-file-upload-${nextStep.id}').click()" class="bg-indigo-650/10 hover:bg-indigo-650/20 text-indigo-400 border border-indigo-500/20 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full">
                                                    <i class="fa-solid fa-file-arrow-up"></i> Upload Run Data (GPX/TCX)
                                                </button>
                                            </div>
                                            ` : ''}
                                            </div>
                                            ` : `
                                            <!-- Rest Day Context -->
                                            <div class="flex items-center gap-1.5 bg-slate-900 p-2 rounded-xl border border-slate-800 w-max">
                                                <input id="logged-date-${nextStep.id}" type="date" value="${todayLocalStr}" class="bg-transparent font-bold text-white focus:outline-none text-xs cursor-pointer select-none">
                                            </div>
                                            `}
                                            <p id="workout-file-status-${nextStep.id}" class="text-[10px] text-slate-500 font-semibold italic ml-1 mt-2 hidden"></p>
                                            <p id="gatekeeper-warn-${nextStep.id}" class="text-[11px] text-rose-450 mt-2 font-medium hidden">⚠️ Please ensure all fields are valid before submitting.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            `}
                        </div>
                    </div>
                `;

                modalsAccumulator += `
                <!-- FULL SCREEN MODAL FOR WORKOUT DETAILS -->
                <div id="workout-modal-${nextStep.id}" class="fixed inset-0 z-[9999] hidden bg-slate-950 flex flex-col overflow-y-auto">
                    <!-- Modal Header -->
                    <div class="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 md:p-6 flex items-center justify-between z-50">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 shrink-0 text-slate-300 opacity-90 flex items-center justify-center">${iconSVG}</div>
                            <div class="flex flex-col">
                                <h2 class="text-lg md:text-xl font-extrabold text-white tracking-tight">${nextStep.workoutTitle}</h2>
                            </div>
                        </div>
                        <button onclick="document.getElementById('workout-modal-${nextStep.id}').classList.add('hidden')" class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700">
                            <i class="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>
                
                <!-- Modal Body (The original detailed view) -->
                <div class="p-5 md:p-8 max-w-3xl mx-auto w-full flex-1">
                    <div class="flex flex-col gap-6 w-full pb-10">
                        
                        <div class="flex flex-col gap-4">
                            ${nextStep.activities && Array.isArray(nextStep.activities) && nextStep.activities.length > 0 ? `
                            <div class="mt-2">
                                <div class="flex flex-col gap-4">
                                    ${(() => {
                            let displayActivities = [];
                            let guidesToSearch = [];
                            if (typeof userProfileData !== 'undefined') {
                                const isSimpleChecked = document.getElementById('simple-mode-toggle') && document.getElementById('simple-mode-toggle').checked;
                                guidesToSearch = (isSimpleChecked && userProfileData.simpleStrengthGuides) ? userProfileData.simpleStrengthGuides : userProfileData.currentStrengthGuides;
                            }
                            if ((!guidesToSearch || guidesToSearch.length === 0) && typeof getDefaultStrengthGuides === 'function') {
                                guidesToSearch = getDefaultStrengthGuides();
                            }

                            const findStrengthGuide = (guides, step, actRef) => {
                                if (!guides || !step) return null;

                                // Best match: Check for explicit ID match
                                if (actRef) {
                                    const exactMatch = guides.find(g => g.id && g.id.toLowerCase() === actRef.toLowerCase());
                                    if (exactMatch) return exactMatch;
                                }

                                const ref = (actRef || "").toLowerCase();
                                const title = (step.workoutTitle || "").toLowerCase();

                                // Fallback: Check for A, B, C specifically (legacy data support)
                                for (const letter of ['a', 'b', 'c']) {
                                    if (ref.includes(`workout ${letter}`) || title.includes(`workout ${letter}`)) {
                                        const guide = guides.find(g => (g.id && g.id.toLowerCase().includes(letter)) || (g.title && g.title.toLowerCase().includes(`workout ${letter}`)));
                                        if (guide) return guide;
                                    }
                                }

                                // Fallback: check if guide title includes ref
                                let guide = guides.find(g => ref && g.title && g.title.toLowerCase().includes(ref));
                                if (guide) return guide;

                                // Fallback: check if ref includes guide title or title includes guide title
                                guide = guides.find(g => g.title && ((ref && ref.includes(g.title.toLowerCase())) || (title && title.includes(g.title.toLowerCase()))));
                                return guide;
                            };

                            let expandedGuideForStep = false;
                            nextStep.activities.forEach(act => {
                                if (act.type === 'work' && nextStep.strengthGuideReference && !expandedGuideForStep) {
                                    const workActivities = nextStep.activities.filter(a => a.type === 'work');
                                    const isGenericPlaceholder = workActivities.length === 1 ||
                                        /circuit|routine|workout|guide|strength/i.test(act.name) ||
                                        (nextStep.strengthGuideReference && act.name.toLowerCase().includes(nextStep.strengthGuideReference.toLowerCase()));

                                    if (isGenericPlaceholder) {
                                        const guide = findStrengthGuide(guidesToSearch, nextStep, nextStep.strengthGuideReference);
                                        if (guide && guide.exercises && guide.exercises.length > 0) {
                                            expandedGuideForStep = true;
                                            guide.exercises.forEach(ex => {
                                                let sets = typeof ex.sets === 'number' ? ex.sets : 1;
                                                if (ex.setsReps && typeof ex.sets !== 'number') {
                                                    const match = ex.setsReps.match(/^(\d+)\s*sets?/i);
                                                    if (match) sets = parseInt(match[1]);
                                                }

                                                let extractedReps = "";
                                                if (ex.setsReps && (ex.setsReps.toLowerCase().includes("failure") || ex.setsReps.toLowerCase().includes("fail"))) {
                                                    extractedReps = "Fail";
                                                } else if (ex.setsReps) {
                                                    const rMatch = ex.setsReps.match(/(?:of\s+)?(\d+(?:-\d+)?)/);
                                                    if (rMatch) extractedReps = rMatch[1];
                                                }

                                                displayActivities.push({
                                                    ...act,
                                                    name: ex.name,
                                                    exerciseKey: ex.exerciseKey,
                                                    targetType: ex.targetType,
                                                    targetValue: ex.targetValue,
                                                    minimumViableTarget: ex.minimumViableTarget,
                                                    isPerSide: ex.isPerSide,
                                                    restSeconds: ex.restSeconds,
                                                    circuitRestSeconds: ex.circuitRestSeconds,
                                                    equipmentRequired: ex.equipmentRequired,
                                                    coachingCue: ex.coachingCue,
                                                    repsDistanceTime: ex.setsReps,
                                                    description: ex.coachingCue || ex.description,
                                                    sets: sets,
                                                    extractedReps: extractedReps,
                                                    isExpandedStrength: true
                                                });
                                            });
                                            return;
                                        }
                                    }
                                }

                                let extractedReps = "";
                                if (act.repsDistanceTime) {
                                    if (act.repsDistanceTime.toLowerCase().includes("failure") || act.repsDistanceTime.toLowerCase().includes("fail")) {
                                        extractedReps = "Fail";
                                    } else {
                                        const rMatch = act.repsDistanceTime.match(/(?:of\s+)?(\d+(?:-\d+)?)/);
                                        if (rMatch) extractedReps = rMatch[1];
                                    }
                                }
                                displayActivities.push({
                                    ...act,
                                    extractedReps: extractedReps
                                });
                            });

                            function formatActivityRepsDisplay(actItem, isCircuit) {
                                if (!actItem) return '';
                                
                                // 1. Structured Numeric Schema check
                                if (typeof actItem.targetValue === 'number' && actItem.targetValue > 0) {
                                    const val = actItem.targetValue;
                                    const type = actItem.targetType === 'seconds' ? 'sec' : (actItem.targetType === 'failure' ? 'to failure' : 'reps');
                                    const sideStr = actItem.isPerSide ? '/side' : '';
                                    const restStr = actItem.restSeconds ? ` • ${actItem.restSeconds}s rest` : '';
                                    const eqStr = (actItem.equipmentRequired && actItem.equipmentRequired !== 'Bodyweight' && actItem.equipmentRequired !== 'None') 
                                        ? ` • ${actItem.equipmentRequired}` : '';

                                    if (isCircuit) {
                                        return `${val} ${type}${sideStr} per round${restStr}${eqStr}`;
                                    } else {
                                        const sets = actItem.sets && actItem.sets > 1 ? `${actItem.sets} sets × ` : '';
                                        return `${sets}${val} ${type}${sideStr}${restStr}${eqStr}`;
                                    }
                                }

                                // 2. Legacy / Fallback String Sanitization
                                let text = (actItem.repsDistanceTime || '').trim();
                                if (!text && !actItem.sets) return '';

                                if (isCircuit) {
                                    text = text.replace(/^(\d+)\s*sets?\s*(?:of|x|\*)\s*/i, '');
                                    if (!text.toLowerCase().includes('round')) {
                                        text += ' per round';
                                    }
                                    return text;
                                }

                                const hasRepsRegex = /\b(\d+)\s*(?:x|reps?|sets?|times)\b/i;
                                const hasLeadingMultiplier = /^(\d+)\s*x\b/i;

                                if (hasRepsRegex.test(text) || hasLeadingMultiplier.test(text)) {
                                    return text;
                                }

                                if (actItem.sets && actItem.sets > 1) {
                                    return `${actItem.sets} x ${text}`;
                                }

                                const actName = (actItem.name || '').toLowerCase();
                                const isStrideOrRepeat = ['stride', 'sprint', 'repeat', 'interval', 'hill'].some(keyword => actName.includes(keyword));
                                if (isStrideOrRepeat && text) {
                                    return `4 x ${text}`;
                                }

                                return text;
                            }

                            let hasShownTargetInstructions = false;
                            let renderedCircuitTrackerFor = null;

                            return displayActivities.map((act, actIdx) => {
                                let prefixHtml = '';
                                let isCircuit = act.isCircuit;
                                let circuitRounds = act.circuitRounds || 0;
                                if (act.isExpandedStrength && !isCircuit && act.parentActId && act.parentActId.toLowerCase().includes('circuit')) {
                                    isCircuit = true;
                                    circuitRounds = nextStep.circuitRounds || act.circuitRounds || 3;
                                }

                                if (isCircuit && renderedCircuitTrackerFor !== act.parentActId) {
                                    renderedCircuitTrackerFor = act.parentActId;
                                    const rounds = circuitRounds || 1;
                                    const circuitIdStr = (act.parentActId || '').replace(/\s+/g, '-');
                                    prefixHtml = `
                                                <div class="sticky top-[73px] z-40 bg-slate-950/90 backdrop-blur-md border-y border-slate-800 p-4 -mx-5 px-5 md:-mx-8 md:px-8 shadow-md mt-4 mb-4 flex items-center justify-between">
                                                    <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">Circuit Rounds</span>
                                                    <div class="flex items-center gap-2 flex-wrap">
                                                        ${Array.from({ length: rounds }).map((_, r) => `
                                                        <button id="circuit-bubble-${nextStep.id}-${circuitIdStr}-${r}" 
                                                                onclick="toggleCircuitRound(this, '${circuitIdStr}')"
                                                                class="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center transition-all focus:outline-none hover:border-teal-400/50 group shrink-0">
                                                            <span class="text-[12px] font-bold text-slate-400 group-[.bg-teal-500]:hidden">${r + 1}</span>
                                                            <i class="fa-solid fa-check text-sm text-white hidden group-[.bg-teal-500]:block"></i>
                                                        </button>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                                `;
                                }

                                let coachTipText = act.description || act.coachingCue || '';
                                if (!act.isExpandedStrength && nextStep.strengthGuideReference) {
                                    const guide = findStrengthGuide(guidesToSearch, nextStep, nextStep.strengthGuideReference);
                                    if (guide && guide.exercises) {
                                        const ex = guide.exercises.find(e => e.name.toLowerCase().includes(act.name.toLowerCase()) || act.name.toLowerCase().includes(e.name.toLowerCase()));
                                        if (ex && (ex.coachingCue || ex.description)) coachTipText = ex.coachingCue || ex.description;
                                    }
                                }

                                if (act.type === 'work') {
                                    const showInstructions = !hasShownTargetInstructions && !act.isExpandedStrength;
                                    if (showInstructions) hasShownTargetInstructions = true;

                                    return prefixHtml + `
                                            <div id="act-container-${nextStep.id}-${actIdx}" class="flex flex-col gap-3 bg-slate-900 border border-indigo-500/30 p-5 rounded-2xl relative shadow-[0_0_15px_rgba(79,70,229,0.1)] transition-all duration-300">
                                                <div ${coachTipText ? `onclick="toggleStrengthTip(this, '${nextStep.id}', ${actIdx})"` : ''} class="flex flex-row items-start justify-between gap-3 ${coachTipText ? 'cursor-pointer group' : ''}">
                                                    <div class="flex-1 leading-tight">
                                                        <div class="flex items-center justify-between">
                                                            <span class="text-sm font-bold text-slate-200 block">${act.isExpandedStrength ? '' : 'Workout - '}${act.name}</span>
                                                            <div class="flex items-center gap-3">
                                                                <button id="act-checkbox-${nextStep.id}-${actIdx}" 
                                                                        data-circuit-id="${(act.parentActId || '').replace(/\s+/g, '-')}"
                                                                        data-step-id="${nextStep.id}" data-act-idx="${actIdx}"
                                                                        onclick="event.stopPropagation(); toggleActivityCheck(this, '${nextStep.id}', ${actIdx});"
                                                                        class="w-7 h-7 rounded-md border border-slate-600 bg-slate-800 flex items-center justify-center transition-all focus:outline-none hover:border-teal-400/50 shrink-0">
                                                                    <i class="fa-solid fa-check text-sm text-white opacity-0 transition-opacity"></i>
                                                                </button>
                                                                ${coachTipText ? `
                                                                <i class="fa-solid fa-chevron-down text-slate-500 text-[12px] transition-transform duration-300 coach-tip-caret-${nextStep.id}-${actIdx} group-hover:text-slate-300"></i>
                                                                ` : ''}
                                                            </div>
                                                        </div>
                                                        <div id="act-subtitle-${nextStep.id}-${actIdx}" class="flex items-center gap-3 mt-1 flex-wrap transition-all duration-300">
                                                            <span class="text-xs text-slate-400 font-medium">${formatActivityRepsDisplay(act, isCircuit)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                ${coachTipText ? `
                                                <div id="strength-tip-${nextStep.id}-${actIdx}" class="hidden mt-1 text-xs text-slate-400 italic leading-relaxed animate-fade-in pr-6">
                                                    ${coachTipText}
                                                </div>
                                                ` : ''}
                                                
                                                ${showInstructions && nextStep.targetInstructions ? `
                                                <div id="act-instructions-${nextStep.id}-${actIdx}" class="mt-2 transition-all duration-300">
                                                    <p class="text-base text-slate-300 leading-relaxed">${nextStep.targetInstructions}</p>
                                                    ${paceHtml ? `<div class="mt-4">${paceHtml.replace('mt-4', 'mt-0')}</div>` : ''}
                                                </div>
                                                ` : ''}
                                            </div>
                                            `;
                                } else {
                                    return prefixHtml + `
                                            <div class="flex flex-col gap-1 bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 border-dashed">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-[10px] font-bold uppercase tracking-wider ${act.type === 'prep' ? 'text-amber-500' : 'text-sky-400'}">${act.type === 'prep' ? 'Warm Up' : 'Cool Down'}</span>
                                                    <span class="text-sm font-bold text-slate-300">${act.name}</span>
                                                </div>
                                                <span class="text-xs text-slate-400 font-medium">${formatActivityRepsDisplay(act)}</span>
                                            </div>
                                            `;
                                }
                            }).join('');
                        })()}
                                </div>
                            </div>
                            ` : `
                            <div class="flex items-start gap-3 mt-2">
                                <div>
                                    <p class="text-base text-slate-300 leading-relaxed">${nextStep.targetInstructions}</p>
                                </div>
                            </div>
                            ${paceHtml ? `<div>${paceHtml}</div>` : ''}
                            `}
                        </div>
                        <div class="mt-8 flex justify-center pb-8">
                            <button onclick="document.getElementById('workout-modal-${nextStep.id}').classList.add('hidden'); toggleGatekeeper('${nextStep.id}', true)" class="w-full sm:w-auto min-w-[250px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-3 text-lg">
                                Log Activity <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
                </div>
                `;
            }

            htmlAccumulator += `</div>`;

            const isSlateFullyCompleted = dailySlate.every(w => w.completed);
            if (isSlateFullyCompleted && renderSequenceOrder === (lastCompletedStep ? lastCompletedStep.sequenceOrder : null)) {
                // Find next available sequence
                const nextSequenceOrder = activePhaseWorkouts.find(w => w.sequenceOrder > renderSequenceOrder)?.sequenceOrder;
                if (nextSequenceOrder !== undefined) {
                    const nextSlate = activePhaseWorkouts.filter(w => w.sequenceOrder === nextSequenceOrder);
                    htmlAccumulator += `<div class="mt-8 border-t border-slate-800/60 pt-6">
                        <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><i class="fa-solid fa-calendar-day"></i> Tomorrow's Preview</h3>
                        <div class="space-y-4">`;

                    for (let n of nextSlate) {
                        const nIconSVG = icons[n.type] || icons.easy;
                        htmlAccumulator += `
                        <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-white font-bold">${n.workoutTitle}</span>
                                ${getDisplayDuration(n) ? `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">${getDisplayDuration(n)}</span>` : ''}
                            </div>
                            <div class="flex items-start gap-3 mt-3">
                                <div class="mt-1 opacity-50 shrink-0 text-slate-500">${nIconSVG}</div>
                                <div>
                                    <p class="text-xs text-slate-400 leading-relaxed">${n.targetInstructions}</p>
                                </div>
                            </div>
                            ${n.jitPreparationTip ? `
                            <div class="mt-3 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 flex gap-3 relative overflow-hidden">
                                <div class="absolute -left-2 -top-2 opacity-5 pointer-events-none"><i class="fa-solid fa-fire text-4xl text-amber-500"></i></div>
                                <div class="mt-0.5 text-amber-500/50 shrink-0 z-10"><i class="fa-solid fa-lightbulb"></i></div>
                                <div class="z-10">
                                    <span class="block text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-0.5">Preparation</span>
                                    <p class="text-[11px] text-slate-400 leading-relaxed">${n.jitPreparationTip}</p>
                                </div>
                            </div>
                            ` : ''}
                        </div>`;
                    }
                    htmlAccumulator += `</div></div>`;
                }
            }



            if (isBlockFullyFinished && allCompleted) {
                htmlAccumulator += `
                    <div class="mt-6 bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                                <i class="fa-solid fa-trophy"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-extrabold text-white tracking-tight">Phase Block Complete! 🎉</h3>
                                <p class="text-xs text-slate-300 mt-0.5">Great job completing today's workout. Your next 7-day block will begin <strong class="text-amber-400">Tomorrow</strong>.</p>
                            </div>
                        </div>
                        <button id="gen-next-phase-btn-home" onclick="proceedToNextPhase()" class="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Next Phase
                        </button>
                    </div>
                `;
            }

            htmlAccumulator += `</div>`;
            container.innerHTML = htmlAccumulator;

            let modalsRoot = document.getElementById('modals-root');
            if (!modalsRoot) {
                modalsRoot = document.createElement('div');
                modalsRoot.id = 'modals-root';
                document.body.appendChild(modalsRoot);
            }
            modalsRoot.innerHTML = modalsAccumulator;

            // Set default date values dynamically for all generated cards
            for (let i = 0; i < dailySlate.length; i++) {
                const nextStep = dailySlate[i];
                const datePicker = document.getElementById(`date-picker-${nextStep.id}`);
                if (datePicker) datePicker.value = todayLocalStr;

                const loggedDate = document.getElementById(`logged-date-${nextStep.id}`);
                if (loggedDate) loggedDate.value = todayLocalStr;
            }

            calculateTargetPaces();
            updateJITConsistencyBadge();
        }

function toggleStepCheck(activityId, completed) {
            let selectedDate = null;
            const updatePayload = {
                completed: completed
            };

            if (completed) {
                const dateEl = document.getElementById(`date-picker-${activityId}`) || document.getElementById('logged-date');
                if (dateEl && dateEl.value) {
                    selectedDate = dateEl.value;
                } else {
                    const d = new Date();
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    selectedDate = `${year}-${month}-${day}`;
                }
                updatePayload.dateExecuted = selectedDate;
            } else {
                updatePayload.dateExecuted = null;
                updatePayload.actualLoggedPace = null;
                updatePayload.rpeScore = null;
                if (typeof firebase !== 'undefined' && firebase.firestore) {
                    updatePayload.uploadedWorkoutFile = firebase.firestore.FieldValue.delete();
                }
            }

            db.collection("users").doc(userId).collection("active_phase").doc(activityId).update(updatePayload).then(() => {
                console.log("Workout checklist item updated successfully.");
            }).catch(err => {
                console.error("Error writing checkmark to cloud: ", err);
            });
        }

function toggleActivityCheck(btn, stepId, actIdx) {
            btn.classList.toggle('bg-teal-500');
            btn.classList.toggle('border-teal-500');
            btn.classList.toggle('bg-slate-800');
            btn.classList.toggle('border-slate-600');

            const icon = btn.querySelector('i');
            if (icon) icon.classList.toggle('opacity-0');

            const isChecked = btn.classList.contains('bg-teal-500');
            const container = document.getElementById(`act-container-${stepId}-${actIdx}`);
            if (container) {
                if (isChecked) {
                    container.classList.add('opacity-50', 'scale-[0.98]');
                    container.classList.remove('shadow-[0_0_15px_rgba(79,70,229,0.1)]', 'border-indigo-500/30');
                    container.classList.add('border-slate-700/50');
                    const tip = document.getElementById(`strength-tip-${stepId}-${actIdx}`);
                    if (tip) tip.classList.add('hidden');
                    const caret = document.querySelector(`.coach-tip-caret-${stepId}-${actIdx}`);
                    if (caret) caret.classList.remove('-rotate-180');

                    const subtitle = document.getElementById(`act-subtitle-${stepId}-${actIdx}`);
                    if (subtitle) subtitle.classList.add('hidden');
                    const instructions = document.getElementById(`act-instructions-${stepId}-${actIdx}`);
                    if (instructions) instructions.classList.add('hidden');
                } else {
                    container.classList.remove('opacity-50', 'scale-[0.98]', 'border-slate-700/50');
                    container.classList.add('shadow-[0_0_15px_rgba(79,70,229,0.1)]', 'border-indigo-500/30');
                    const subtitle = document.getElementById(`act-subtitle-${stepId}-${actIdx}`);
                    if (subtitle) subtitle.classList.remove('hidden');
                    const instructions = document.getElementById(`act-instructions-${stepId}-${actIdx}`);
                    if (instructions) instructions.classList.remove('hidden');
                }
            }
        }

function updateWorkoutDate(activityId, newDate) {
            if (!newDate) return;
            db.collection("users").doc(userId).collection("active_phase").doc(activityId).update({
                dateExecuted: newDate
            }).then(() => {
                console.log("Workout date updated successfully.");
            }).catch(err => {
                console.error("Error updating workout date: ", err);
            });
        }

function toggleStepCheckDirect(stepId) {
            const workout = activePhaseWorkouts.find(w => w.id === stepId);
            if (!workout) return;

            const willBeCompleted = !workout.completed;

            if (workout.isSpeedWorkout && willBeCompleted) {
                alert("🔒 Speed & Benchmark workouts require explicit pace metrics validation. Please execute and log this session within the primary 'Up Next' card.");
                return;
            }

            toggleStepCheck(stepId, willBeCompleted);
        }

function toggleStrengthTip(btn, stepId, actIdx) {
            const modal = document.getElementById(`workout-modal-${stepId}`);
            if (modal) {
                // Collapse all other tips
                const allTips = modal.querySelectorAll('[id^="strength-tip-"]');
                const allCarets = modal.querySelectorAll('[class*="coach-tip-caret-"]');

                allTips.forEach(tip => {
                    if (tip.id !== `strength-tip-${stepId}-${actIdx}`) {
                        tip.classList.add('hidden');
                    }
                });

                allCarets.forEach(caret => {
                    if (!caret.classList.contains(`coach-tip-caret-${stepId}-${actIdx}`)) {
                        caret.classList.remove('-rotate-180');
                    }
                });
            }

            const tipDiv = document.getElementById(`strength-tip-${stepId}-${actIdx}`);
            if (tipDiv) {
                tipDiv.classList.toggle('hidden');
            }

            const caret = document.querySelector(`.coach-tip-caret-${stepId}-${actIdx}`);
            if (caret) {
                caret.classList.toggle('-rotate-180');
            }
        }

function toggleCircuitRound(btn, circuitIdStr) {
            btn.classList.toggle('bg-teal-500');
            btn.classList.toggle('border-teal-500');
            btn.classList.toggle('bg-slate-800');
            btn.classList.toggle('border-slate-700');

            const isChecked = btn.classList.contains('bg-teal-500');
            if (isChecked) {
                // Uncheck all activities in this circuit to reset for the next round
                const checkboxes = document.querySelectorAll(`button[data-circuit-id="${circuitIdStr}"]`);
                checkboxes.forEach(cb => {
                    cb.classList.remove('bg-teal-500', 'border-teal-500');
                    cb.classList.add('bg-slate-800', 'border-slate-600');
                    const icon = cb.querySelector('i');
                    if (icon) icon.classList.add('opacity-0');

                    const stepId = cb.getAttribute('data-step-id');
                    const actIdx = cb.getAttribute('data-act-idx');
                    if (stepId && actIdx) {
                        const container = document.getElementById(`act-container-${stepId}-${actIdx}`);
                        if (container) {
                            container.classList.remove('opacity-50', 'scale-[0.98]', 'border-slate-700/50');
                            container.classList.add('shadow-[0_0_15px_rgba(79,70,229,0.1)]', 'border-indigo-500/30');
                        }
                        const subtitle = document.getElementById(`act-subtitle-${stepId}-${actIdx}`);
                        if (subtitle) subtitle.classList.remove('hidden');
                        const instructions = document.getElementById(`act-instructions-${stepId}-${actIdx}`);
                        if (instructions) instructions.classList.remove('hidden');
                    }
                });
            }
        }

function openWorkoutModal(stepId) {
            document.getElementById(`workout-modal-${stepId}`).classList.remove('hidden');
        }

async function handleWorkoutFileUpload(input) {
            const statusEl = document.getElementById('workout-file-status');
            if (!input.files || input.files.length === 0) {
                lastUploadedWorkoutFile = null;
                if (statusEl) statusEl.classList.add('hidden');
                return;
            }

            const file = input.files[0];
            if (statusEl) {
                statusEl.className = "text-[10px] text-amber-400 font-semibold italic animate-pulse ml-1";
                statusEl.innerText = "Parsing file...";
                statusEl.classList.remove('hidden');
            }

            try {
                const parsed = await parseWorkoutFile(file);
                lastUploadedWorkoutFile = {
                    fileName: parsed.fileName,
                    format: parsed.format,
                    distance: parsed.distance,
                    duration: parsed.duration,
                    pace: parsed.pace,
                    avgCadence: parsed.avgCadence,
                    avgHeartRate: parsed.avgHeartRate,
                    maxHeartRate: parsed.maxHeartRate,
                    elevationGain: parsed.elevationGain,
                    avgGradient: parsed.avgGradient,
                    uploadedAt: new Date().toISOString()
                };

                // Auto-fill logged pace fields
                const minInput = document.getElementById('logged-min');
                const secInput = document.getElementById('logged-sec');
                if (parsed.pace && minInput && secInput) {
                    const parts = parsed.pace.split(':');
                    if (parts.length === 2) {
                        minInput.value = parseInt(parts[0]);
                        secInput.value = parseInt(parts[1]);
                    }
                }

                if (statusEl) {
                    statusEl.className = "text-[10px] text-emerald-450 font-bold ml-1";
                    statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-[9px]"></i> Parsed ${parsed.fileName} (${parsed.distance}mi at ${parsed.pace}/mi)`;
                }
            } catch (err) {
                console.error("Workout file parsing error:", err);
                if (statusEl) {
                    statusEl.className = "text-[10px] text-rose-450 font-bold ml-1";
                    statusEl.innerText = "Error parsing file: " + err.message;
                }
            }
        }

function getISOWeekString(d = new Date()) {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
            return `${date.getFullYear()}-W${weekNumber}`;
        }

function getDisplayDuration(step) {
            if (step.distanceDuration) return step.distanceDuration;
            if (step.targetDistance) return `${step.targetDistance} Miles`;
            if (step.targetDuration) return `${step.targetDuration} mins`;
            return "";
        }

function handleWorkoutCheckToggle(activityId, isBenchmark, type, cbElement) {
            if (cbElement.checked) {
                submitWorkout(activityId, isBenchmark, type, cbElement);
            } else {
                unsubmitWorkout(activityId);
            }
        }

function getCheckpointIndex(phase, activityId) {
            const phaseNum = parseInt(phase) || 1;
            if (phaseNum === 1) {
                if (activityId === 'act-4') return 1;
                if (activityId === 'act-7') return 2;
            } else if (phaseNum === 2) {
                if (activityId === 'act-4') return 3;
                if (activityId === 'act-7') return 4;
            } else if (phaseNum === 3) {
                if (activityId === 'act-3') return 5;
                if (activityId === 'act-5') return 6;
                if (activityId === 'act-7') return 7;
            }
            return -1;
        }

