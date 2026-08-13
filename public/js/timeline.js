function checkPhaseCompletion() {
            if (activePhaseWorkouts.length === 0) return;
            const allDone = activePhaseWorkouts.every(w => w.completed);
            if (allDone) {
                document.getElementById('checkout-gateway-modal').classList.remove('hidden');
            } else {
                document.getElementById('checkout-gateway-modal').classList.add('hidden');
            }
        }

function updateOverallProgressMeter() {
            if (activePhaseWorkouts.length === 0) return;
            const completedCount = activePhaseWorkouts.filter(w => w.completed).length;
            const currentPhase = userProfileData ? (userProfileData.currentPhaseIndex || 1) : 1;
            const totalCompleted = ((currentPhase - 1) * 7) + completedCount;
            const totalWorkouts = 21; // 3 phases * 7 workouts

            const percent = Math.min(100, Math.round((totalCompleted / totalWorkouts) * 100));
            const completionText = document.getElementById('overall-completion-text');
            const completionBar = document.getElementById('overall-completion-bar');
            if (completionText) completionText.innerText = `${percent}%`;
            if (completionBar) completionBar.style.width = `${percent}%`;
        }

function updateTimelineView(phaseIndex) {
            const phase = parseInt(phaseIndex) || (userProfileData ? (userProfileData.currentPhaseIndex || 1) : 1) || 1;
            const container = document.getElementById('timeline-3d-container');
            const pagination = document.getElementById('timeline-pagination');

            // Render Phase Progression Pills Track & Active Stage Spotlight Card
            renderJourneyPillsTrack(phase);
            renderActiveStageSpotlight(phase);

            if (!container || !pagination) return;

            // Default phases if none provided
            let plan = [];
            if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
                plan = userProfileData.macrocyclePlan;
            } else {
                plan = [
                    { theme: "Speed Induction", description: "Neuromuscular speed coordination. Alternating explosive 400m intervals with targeted glute/heel stability." },
                    { theme: "Speed Endurance", description: "Aerobic threshold development. Extending speed efforts to 1000m blocks and posterior hamstring deadlifts." },
                    { theme: "Peak & Taper", description: "Maximum capacity and recovery. Testing 1-mile repetitions before backing off volume for supercompensation." }
                ];
            }

            const N = plan.length;
            container.innerHTML = '';
            pagination.innerHTML = '';

            // Generate Pagination Bubbles
            for (let i = 1; i <= N; i++) {
                const bubble = document.createElement('div');
                if (i < phase) {
                    bubble.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 cursor-pointer";
                } else if (i === phase) {
                    bubble.className = "w-3 h-3 rounded-full bg-indigo-400 shadow-md shadow-indigo-500 ring-2 ring-indigo-500/30 scale-110 transition-transform cursor-pointer";
                } else {
                    bubble.className = "w-2 h-2 rounded-full bg-slate-700 self-center opacity-50 cursor-pointer";
                }
                bubble.onclick = () => updateTimelineView(i);
                pagination.appendChild(bubble);
            }

            // Generate 3D Cards
            // Previous Phase (Left)
            if (phase > 1) {
                const prev = plan[phase - 2];
                const prevHtml = `
                    <div onclick="updateTimelineView(${phase - 1})" class="absolute left-[2%] md:left-[10%] w-1/3 max-w-[180px] flex flex-col items-center select-none z-0 opacity-40 transition-all duration-700 cursor-pointer hover:opacity-75" style="transform: scale(0.75) translateZ(-150px) rotateY(25deg);">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10 mb-2">
                            <i class="fa-solid fa-check text-[10px] text-emerald-400"></i>
                        </div>
                        <span class="text-[9px] md:text-[10px] font-bold text-emerald-400 block tracking-tight text-center uppercase leading-snug">${prev?.theme || 'Phase ' + (phase - 1)}</span>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', prevHtml);
            }

            // Active Phase (Center)
            const current = plan[phase - 1];
            const activeHtml = `
                <div class="absolute w-3/4 md:w-1/2 max-w-[340px] flex flex-col items-center select-none z-10 transition-all duration-700" style="transform: scale(1.05) translateZ(50px);">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center border-2 border-indigo-400 bg-indigo-950 shadow-[0_0_15px_rgba(99,102,241,0.5)] ring-4 ring-indigo-500/20 mb-3">
                        <span class="text-sm font-black text-indigo-300">${phase}</span>
                    </div>
                    <span class="text-[11px] md:text-xs font-black text-indigo-300 block tracking-wider text-center uppercase drop-shadow-md leading-tight">${current?.theme || 'Phase ' + phase}</span>
                    <p class="text-[10px] md:text-xs text-indigo-100/80 mt-3 leading-relaxed text-center p-4 rounded-3xl border border-indigo-500/30 bg-indigo-950/40 backdrop-blur-sm shadow-xl w-full">
                        ${current?.simpleDescription || current?.description || ''}
                    </p>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', activeHtml);

            // Next Phase (Right)
            if (phase < N) {
                const next = plan[phase];
                const nextHtml = `
                    <div onclick="updateTimelineView(${phase + 1})" class="absolute right-[2%] md:right-[10%] w-1/3 max-w-[180px] flex flex-col items-center select-none z-0 opacity-40 transition-all duration-700 cursor-pointer hover:opacity-75" style="transform: scale(0.75) translateZ(-150px) rotateY(-25deg);">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-700 bg-slate-900 mb-2">
                            <span class="text-[10px] font-black text-slate-500">${phase + 1}</span>
                        </div>
                        <span class="text-[9px] md:text-[10px] font-semibold text-slate-500 block tracking-tight text-center uppercase leading-snug">${next?.theme || 'Phase ' + (phase + 1)}</span>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', nextHtml);
            }
        }

function renderJourneyPillsTrack(activePhaseIndex) {
    const trackContainer = document.getElementById('journey-pills-track');
    if (!trackContainer) return;

    const data = userProfileData || {};
    const plan = (data.macrocyclePlan && data.macrocyclePlan.length > 0) 
        ? data.macrocyclePlan 
        : [
            { phase: 1, theme: "Speed Induction", description: "Neuromuscular speed coordination.", expectedDurationWeeks: 4 },
            { phase: 2, theme: "Speed Endurance", description: "Aerobic threshold development.", expectedDurationWeeks: 4 },
            { phase: 3, theme: "Peak & Taper", description: "Maximum capacity and recovery.", expectedDurationWeeks: 4 }
        ];

    const currentActivePhase = (data.currentPhaseIndex || 1);
    const viewedPhase = parseInt(activePhaseIndex) || currentActivePhase;
    const totalPhases = plan.length;
    const isRaceGoal = (data.primaryGoal || 'race') === 'race' || !!data.targetDate || !!data.activeAdjustedGoal;

    // Determine expected weeks for each stage to calculate proportional flex widths
    const stageWeeks = plan.map((stage, idx) => {
        let w = stage.expectedDurationWeeks || stage.durationWeeks;
        if (!w || w <= 0) {
            if (data.journeyStartDate && data.targetDate) {
                const totalDays = Math.ceil((new Date(data.targetDate) - new Date(data.journeyStartDate)) / (1000 * 60 * 60 * 24));
                const totalWeeks = Math.max(3, Math.ceil(totalDays / 7));
                w = Math.max(2, Math.round(totalWeeks / totalPhases));
            } else {
                w = 4; // Standard 4-week default phase duration
            }
        }
        return w;
    });

    const activeWeeks = stageWeeks[currentActivePhase - 1] || 4;
    const expectedTotalJITsInPhase = Math.max(7, activeWeeks * 7);

    // Calculate workouts completed in current active phase
    const activeWorkouts = (typeof activePhaseWorkouts !== 'undefined' && Array.isArray(activePhaseWorkouts)) ? activePhaseWorkouts : [];
    const completedInCurrentBlock = activeWorkouts.filter(w => w.completed).length;

    // Total completed in phase = (blocks completed in phase * 7) + completed in current block
    const blocksCompletedInPhase = data.blocksCompletedInPhase || 0;
    const totalCompletedInPhase = (blocksCompletedInPhase * 7) + completedInCurrentBlock;

    const percentInPhase = Math.min(100, Math.max(0, Math.round((totalCompletedInPhase / expectedTotalJITsInPhase) * 100)));

    let html = '';

    plan.forEach((stage, idx) => {
        const phaseNum = stage.phase || (idx + 1);
        const weeks = stageWeeks[idx] || 4;
        const isSelected = (phaseNum === viewedPhase);

        if (phaseNum < currentActivePhase) {
            // Completed Phase Pill (Solid Green, Checkmark + Number, Proportional flex size)
            html += `
                <div onclick="updateTimelineView(${phaseNum})" 
                    title="Phase ${phaseNum}: Completed (${weeks} Wks)"
                    style="flex: ${weeks} 1 0%; min-width: 32px;"
                    class="h-8 px-1.5 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center gap-1 shadow-md shadow-emerald-950/40 cursor-pointer transition-all hover:scale-[1.02] border ${isSelected ? 'border-white ring-2 ring-emerald-400' : 'border-emerald-400/50'} select-none">
                    <i class="fa-solid fa-check text-[10px] font-black shrink-0"></i>
                    <span class="text-[11px] font-black">${phaseNum}</span>
                </div>
            `;
        } else if (phaseNum === currentActivePhase) {
            // Active Phase Pill (Indigo Highlighted Border, Green Fill Progress Bar inside, Number overlay, Proportional flex size)
            html += `
                <div onclick="updateTimelineView(${phaseNum})" 
                    title="Phase ${phaseNum} Progress: ${totalCompletedInPhase}/${expectedTotalJITsInPhase} Workouts (${percentInPhase}%)"
                    style="flex: ${weeks} 1 0%; min-width: 44px;"
                    class="relative h-8 rounded-xl border-2 border-indigo-400 bg-slate-900 overflow-hidden cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.4)] ${isSelected ? 'ring-4 ring-indigo-500/30 scale-[1.02]' : 'ring-2 ring-indigo-500/20'} flex items-center justify-center transition-all hover:scale-[1.02] select-none">
                    
                    <!-- Dynamic Green Progress Fill Across Active Phase -->
                    <div class="absolute top-0 left-0 bottom-0 bg-emerald-500 transition-all duration-500" style="width: ${percentInPhase}%;"></div>
                    
                    <!-- Text Overlay (Number only) -->
                    <div class="relative z-10 flex items-center justify-center gap-1 px-1.5 text-[11px] font-black text-slate-100 drop-shadow">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                        <span>${phaseNum}</span>
                    </div>
                </div>
            `;
        } else {
            // Future Phase Pill (Slate Outline, Number only, Proportional flex size)
            html += `
                <div onclick="updateTimelineView(${phaseNum})" 
                    title="Phase ${phaseNum}: Upcoming (${weeks} Wks)"
                    style="flex: ${weeks} 1 0%; min-width: 32px;"
                    class="h-8 px-1.5 rounded-xl bg-slate-900 border ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-500/20 text-indigo-200' : 'border-slate-800 text-slate-400'} flex items-center justify-center cursor-pointer transition-all hover:border-slate-700 hover:text-slate-300 select-none">
                    <span class="text-[11px] font-extrabold">${phaseNum}</span>
                </div>
            `;
        }
    });

    // Checkered Race Flag at the end if it's a race target
    if (isRaceGoal) {
        const raceTargetLabel = data.journeyGoalTitle || data.journeyTitle || "Race Milestone";
        html += `
            <div title="Target Goal: ${raceTargetLabel}" 
                class="h-8 px-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-sm text-xs shrink-0 cursor-default">
                <i class="fa-solid fa-flag-checkered text-amber-400 text-sm"></i>
            </div>
        `;
    }

    trackContainer.innerHTML = html;
}

let isJourneySimpleViewActive = false;

function toggleJourneySimpleView() {
    isJourneySimpleViewActive = !isJourneySimpleViewActive;
    const toggleBtn = document.getElementById('journey-simple-toggle');
    if (toggleBtn) {
        if (isJourneySimpleViewActive) {
            toggleBtn.className = "text-[10px] md:text-xs font-bold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 border border-indigo-500/40 select-none cursor-pointer shadow-sm shadow-indigo-950/40";
            toggleBtn.innerHTML = `<i class="fa-solid fa-square-check text-indigo-400 text-xs"></i> Simple`;
        } else {
            toggleBtn.className = "text-[10px] md:text-xs font-bold text-slate-400 bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 border border-slate-700 select-none cursor-pointer";
            toggleBtn.innerHTML = `<i class="fa-regular fa-square text-slate-500 text-xs"></i> Simple`;
        }
    }
    const currentPhase = (typeof userProfileData !== 'undefined' && userProfileData ? userProfileData.currentPhaseIndex : 1) || 1;
    renderActiveStageSpotlight(currentPhase);
}
window.toggleJourneySimpleView = toggleJourneySimpleView;

function renderActiveStageSpotlight(phaseIndex) {
    const spotlightContainer = document.getElementById('journey-active-stage-card');
    if (!spotlightContainer) return;

    const data = userProfileData || {};
    const plan = (data.macrocyclePlan && data.macrocyclePlan.length > 0) 
        ? data.macrocyclePlan 
        : [
            { phase: 1, theme: "Speed Induction", simpleDescription: "Neuromuscular speed coordination.", description: "Neuromuscular speed coordination. Alternating explosive 400m intervals with targeted glute/heel stability." },
            { phase: 2, theme: "Speed Endurance", simpleDescription: "Aerobic threshold development.", description: "Aerobic threshold development. Extending speed efforts to 1000m blocks and posterior hamstring deadlifts." },
            { phase: 3, theme: "Peak & Taper", simpleDescription: "Maximum capacity and recovery.", description: "Maximum capacity and recovery. Testing 1-mile repetitions before backing off volume for supercompensation." }
        ];

    const currentActivePhase = (data.currentPhaseIndex || 1);
    const viewedPhase = parseInt(phaseIndex) || currentActivePhase;
    const stageObj = plan.find(p => (p.phase === viewedPhase)) || plan[viewedPhase - 1] || plan[0];

    const theme = stageObj.theme || `Phase ${viewedPhase}`;
    const desc = isJourneySimpleViewActive
        ? (stageObj.simpleDescription || stageObj.description || "Focusing on building your aerobic base and movement consistency.")
        : (stageObj.detailedDescription || stageObj.description || stageObj.simpleDescription || "Focusing on building your aerobic base and movement consistency.");

    spotlightContainer.innerHTML = `
        <div class="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
            <div class="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                        ${theme}
                    </h3>
                </div>
                <p class="text-xs md:text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60 italic transition-all duration-300">
                    "${desc}"
                </p>
            </div>
        </div>
    `;
}

function showPhaseTransitionModal(oldPhaseIndex, newPhaseIndex) {
    const modal = document.getElementById('phase-transition-modal');
    if (!modal) return;

    let plan = [];
    if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
        plan = userProfileData.macrocyclePlan;
    }

    const oldPhaseObj = plan.find(p => p.phase === oldPhaseIndex) || plan[oldPhaseIndex - 1] || {};
    const newPhaseObj = plan.find(p => p.phase === newPhaseIndex) || plan[newPhaseIndex - 1] || {};

    const prevTitleEl = document.getElementById('modal-prev-phase-title');
    const nextTitleEl = document.getElementById('modal-next-phase-title');
    const focusDescEl = document.getElementById('modal-phase-focus-desc');
    const nextNumEl = document.getElementById('modal-next-phase-num');

    if (prevTitleEl) {
        prevTitleEl.innerText = `Phase ${oldPhaseIndex}: ${oldPhaseObj.theme || 'Phase ' + oldPhaseIndex}`;
    }
    if (nextTitleEl) {
        nextTitleEl.innerText = `Phase ${newPhaseIndex}: ${newPhaseObj.theme || 'Phase ' + newPhaseIndex}`;
    }
    if (focusDescEl) {
        focusDescEl.innerText = newPhaseObj.simpleDescription || newPhaseObj.description || 'Focusing on your next training milestone.';
    }
    if (nextNumEl) {
        nextNumEl.innerText = `${newPhaseIndex}`;
    }

    modal.classList.remove('hidden');
}

function closePhaseTransitionModal() {
    const modal = document.getElementById('phase-transition-modal');
    if (modal) modal.classList.add('hidden');

    if (typeof userProfileData !== 'undefined' && userProfileData) {
        updateTimelineView(userProfileData.currentPhaseIndex || 1);
    } else {
        updateTimelineView(1);
    }
}


