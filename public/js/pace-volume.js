async function updatePaceAndVolumeHub(data) {
            if (!data) return;

            let historyWorkouts = [];
            if (userId) {
                historyWorkouts = await getOrFetchHistoryWorkouts(userId);
            }

            const activeWorkouts = typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : [];
            const allWorkouts = [...activeWorkouts, ...historyWorkouts];

            const completedRuns = allWorkouts.filter(w => {
                if (!w) return false;
                return w.completed === true || w.completed === "true" || (w.actualLoggedDistance !== undefined && w.actualLoggedDistance !== null && w.actualLoggedDistance !== "") || !!w.actualLoggedPace || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgPace);
            });

            let totalMiles = 0;
            completedRuns.forEach(w => {
                totalMiles += extractWorkoutMileage(w);
            });

            const totalDistEl = document.getElementById('total-distance-display');
            if (totalDistEl) {
                totalDistEl.innerText = `${totalMiles.toFixed(1)} mi`;
            }

            const est5KPace = calculateEst5KRacePace(completedRuns, data.baseline5k);
            const est5KEl = document.getElementById('est-5k-pace-display');
            if (est5KEl) {
                est5KEl.innerText = `${est5KPace} / mi`;
            }

            const estLabel = document.getElementById('est-race-pace-label');
            if (estLabel) {
                let distanceLabel = '5K';
                if (data.dynamicGoalData && data.dynamicGoalData.targetDistance && data.dynamicGoalData.targetDistance !== 'Other') {
                    distanceLabel = data.dynamicGoalData.targetDistance;
                }
                estLabel.innerText = distanceLabel === '5K' ? 'Pace Est.' : `${distanceLabel} Est.`;
            }

            window.cachedPaceCompletedRuns = completedRuns;
            window.cachedPaceData = data;

            updatePaceChart(data, completedRuns, false);
        }

function calculateRollingJITConsistency(historyWorkouts, activeWorkouts) {
            const allCompleted = [];

            if (historyWorkouts && Array.isArray(historyWorkouts)) {
                historyWorkouts.forEach(w => {
                    if (w.completed && w.dateExecuted) allCompleted.push(w);
                });
            }

            if (activeWorkouts && Array.isArray(activeWorkouts)) {
                activeWorkouts.forEach(w => {
                    if (w.completed && w.dateExecuted && !allCompleted.some(h => h.id === w.id)) {
                        allCompleted.push(w);
                    }
                });
            }

            if (allCompleted.length === 0) return 100;

            allCompleted.sort((a, b) => parseLocalDate(a.dateExecuted) - parseLocalDate(b.dateExecuted));

            const blocks = [];
            for (let i = 0; i + 7 <= allCompleted.length; i += 7) {
                blocks.push(allCompleted.slice(i, i + 7));
            }

            const recentBlocks = blocks.slice(-5);
            const blockScores = [];

            let prevEndDate = null;
            if (blocks.length > recentBlocks.length) {
                const precedingBlock = blocks[blocks.length - recentBlocks.length - 1];
                prevEndDate = parseLocalDate(precedingBlock[precedingBlock.length - 1].dateExecuted);
            }

            recentBlocks.forEach(chunk => {
                if (chunk.length < 7) return;

                const endDate = parseLocalDate(chunk[chunk.length - 1].dateExecuted);
                let diffDays;

                if (prevEndDate) {
                    const diffTime = Math.abs(endDate - prevEndDate);
                    diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
                } else {
                    const startDate = parseLocalDate(chunk[0].dateExecuted);
                    const diffTime = Math.abs(endDate - startDate);
                    diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
                }

                const targetDays = 7;
                const score = Math.min(100, Math.round((targetDays / diffDays) * 100));
                blockScores.push(score);

                prevEndDate = endDate;
            });

            if (blockScores.length === 0) return 100;
            const avgScore = Math.round(blockScores.reduce((sum, s) => sum + s, 0) / blockScores.length);
            return Math.min(100, Math.max(10, avgScore));
        }

async function updateJITConsistencyBadge() {
            const badgeContainer = document.getElementById('jit-consistency-badge');
            const badgeValEl = document.getElementById('jit-consistency-val');
            if (!badgeContainer && !badgeValEl) return;

            let historyWorkouts = [];
            if (typeof userId !== 'undefined' && userId) {
                historyWorkouts = await getOrFetchHistoryWorkouts(userId);
            }
            const activeWorkouts = typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : [];
            const score = calculateRollingJITConsistency(historyWorkouts, activeWorkouts);

            if (badgeContainer) {
                if (score === 100) {
                    badgeContainer.className = "flex flex-col items-center justify-center bg-indigo-950/80 border border-indigo-500/50 px-3 py-1.5 md:px-6 md:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 rounded-xl md:rounded-2xl lg:rounded-3xl text-indigo-300 shadow-xl shrink-0 text-center cursor-default transition-all duration-300";
                    badgeContainer.innerHTML = `<div class="flex items-center gap-1.5 md:gap-2.5 font-black text-sm md:text-2xl lg:text-3xl xl:text-4xl leading-none"><img src="assets/flow-state-icon.jpg" class="w-3.5 h-3.5 md:w-6 md:h-6 lg:w-8 lg:h-8 xl:w-9 xl:h-9 rounded-full object-cover mix-blend-screen" alt="Flow State"><span>100%</span></div><span class="text-[9px] md:text-xs lg:text-sm xl:text-base font-extrabold uppercase tracking-wider md:tracking-widest text-indigo-300/90 leading-tight mt-0.5 md:mt-1.5" id="jit-consistency-val">Flow State</span>`;
                } else if (score >= 90) {
                    badgeContainer.className = "flex flex-col items-center justify-center bg-amber-950/60 border border-amber-500/50 px-3 py-1.5 md:px-6 md:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 rounded-xl md:rounded-2xl lg:rounded-3xl text-amber-300 shadow-xl shrink-0 text-center cursor-default transition-all duration-300";
                    badgeContainer.innerHTML = `<div class="flex items-center gap-1.5 md:gap-2.5 font-black text-sm md:text-2xl lg:text-3xl xl:text-4xl leading-none"><i class="fa-solid fa-trophy text-amber-400 text-xs md:text-xl lg:text-2xl xl:text-3xl"></i><span>${score}%</span></div><span class="text-[9px] md:text-xs lg:text-sm xl:text-base font-extrabold uppercase tracking-wider md:tracking-widest text-amber-400/90 leading-tight mt-0.5 md:mt-1.5" id="jit-consistency-val">Elite</span>`;
                } else if (score >= 80) {
                    badgeContainer.className = "flex flex-col items-center justify-center bg-slate-800/80 border border-slate-400/50 px-3 py-1.5 md:px-6 md:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 rounded-xl md:rounded-2xl lg:rounded-3xl text-slate-200 shadow-xl shrink-0 text-center cursor-default transition-all duration-300";
                    badgeContainer.innerHTML = `<div class="flex items-center gap-1.5 md:gap-2.5 font-black text-sm md:text-2xl lg:text-3xl xl:text-4xl leading-none"><i class="fa-solid fa-medal text-slate-300 text-xs md:text-xl lg:text-2xl xl:text-3xl"></i><span>${score}%</span></div><span class="text-[9px] md:text-xs lg:text-sm xl:text-base font-extrabold uppercase tracking-wider md:tracking-widest text-slate-300/90 leading-tight mt-0.5 md:mt-1.5" id="jit-consistency-val">High Level</span>`;
                } else if (score >= 70) {
                    badgeContainer.className = "flex flex-col items-center justify-center bg-orange-950/60 border border-orange-700/50 px-3 py-1.5 md:px-6 md:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 rounded-xl md:rounded-2xl lg:rounded-3xl text-orange-300 shadow-xl shrink-0 text-center cursor-default transition-all duration-300";
                    badgeContainer.innerHTML = `<div class="flex items-center gap-1.5 md:gap-2.5 font-black text-sm md:text-2xl lg:text-3xl xl:text-4xl leading-none"><i class="fa-solid fa-medal text-orange-600 text-xs md:text-xl lg:text-2xl xl:text-3xl"></i><span>${score}%</span></div><span class="text-[9px] md:text-xs lg:text-sm xl:text-base font-extrabold uppercase tracking-wider md:tracking-widest text-orange-400/90 leading-tight mt-0.5 md:mt-1.5" id="jit-consistency-val">Solid</span>`;
                } else {
                    badgeContainer.className = "flex flex-col items-center justify-center bg-slate-900/80 border border-slate-700/50 px-3 py-1.5 md:px-6 md:py-3.5 lg:px-8 lg:py-4 xl:px-10 xl:py-5 rounded-xl md:rounded-2xl lg:rounded-3xl text-slate-400 shadow-xl shrink-0 text-center cursor-default transition-all duration-300";
                    badgeContainer.innerHTML = `<div class="flex items-center gap-1.5 md:gap-2.5 font-black text-sm md:text-2xl lg:text-3xl xl:text-4xl leading-none"><i class="fa-solid fa-seedling text-emerald-500/70 text-xs md:text-xl lg:text-2xl xl:text-3xl"></i><span>${score > 0 ? score + '%' : 'Flow'}</span></div><span class="text-[9px] md:text-xs lg:text-sm xl:text-base font-extrabold uppercase tracking-wider md:tracking-widest text-slate-400/90 leading-tight mt-0.5 md:mt-1.5" id="jit-consistency-val">Building Flow</span>`;
                }
            }
        }

// -----------------------------------------------------------------------------
// PACE BREAKDOWN MODAL LOGIC
// -----------------------------------------------------------------------------
window.openPaceBreakdownModal = function() {
    const modal = document.getElementById('pace-breakdown-modal');
    const listContainer = document.getElementById('pace-breakdown-list');
    const finalDisplay = document.getElementById('pace-breakdown-final');

    if (!modal || !listContainer) return;

    listContainer.innerHTML = '';
    
    if (!window.lastPaceBreakdown || window.lastPaceBreakdown.length === 0) {
        listContainer.innerHTML = '<div class="text-xs text-slate-500 italic p-4 text-center">No runs available to calculate an estimated pace.</div>';
        finalDisplay.innerText = "--:-- /mi";
    } else {
        window.lastPaceBreakdown.forEach(item => {
            const w = item.workout;
            const isDiscarded = item.discarded;
            
            // Format projected pace
            const mins = Math.floor(item.estSec / 60);
            const secs = item.estSec % 60;
            const paceStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            // Parse Date timezone-safely
            const d = parseLocalDate(w.dateExecuted || w.createdAt);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const mathText = item.mathType || "Fallback";

            // Visual state for discarded vs active
            const borderClass = isDiscarded ? "border-slate-800/50 bg-slate-900/30 opacity-50 grayscale" : "border-indigo-500/40 bg-slate-900 shadow-md shadow-indigo-500/5";
            const strikeClass = isDiscarded ? "line-through text-slate-500" : "text-amber-400 font-black";
            const badgeHTML = isDiscarded 
                ? `<span class="absolute -top-2 -right-2 bg-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400 uppercase tracking-wider">Aerobic / Base</span>` 
                : `<span class="absolute -top-2 -right-2 bg-amber-500/20 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-amber-500/30 text-amber-400 uppercase tracking-wider flex items-center gap-1"><i class="fa-solid fa-bolt text-[7px]"></i> Capability Benchmark</span>`;

            const el = document.createElement('div');
            el.className = `relative p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${borderClass}`;
            el.innerHTML = `
                ${badgeHTML}
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-xs font-black text-slate-300 shrink-0">${dateStr}</span>
                        <span class="text-[9px] font-bold font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 shrink-0">${w.actualLoggedDistance || 0} mi</span>
                        ${w.workoutTitle ? `<span class="text-[9px] font-bold text-slate-400 truncate max-w-[90px] sm:max-w-[130px]" title="${w.workoutTitle}">${w.workoutTitle}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Logged:</span>
                        <span class="text-xs font-bold font-mono text-slate-300">${item.rawPace || "--:--"}</span>
                    </div>
                </div>
                
                <div class="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800/50">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20"><i class="fa-solid fa-microchip mr-1 opacity-70"></i> ${mathText}</span>
                        ${w.id ? `<button onclick="openEditWorkoutModal('${w.id}')" class="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-300 border border-slate-700/60 text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95" title="Adjust workout details"><i class="fa-solid fa-pen-to-square text-[8px]"></i> Edit</button>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">= Est. Pace</span>
                        <span class="text-sm font-black font-mono ${strikeClass}">${paceStr}</span>
                    </div>
                </div>
            `;
            listContainer.appendChild(el);
        });

        const activeRuns = window.lastPaceBreakdown.filter(d => !d.discarded);
        if (activeRuns.length > 0) {
            const totalSec = activeRuns.reduce((sum, d) => sum + d.estSec, 0);
            const avg = Math.round(totalSec / activeRuns.length);
            const m = Math.floor(avg / 60);
            const s = avg % 60;
            finalDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s} /mi`;
        } else {
            finalDisplay.innerText = "--:-- /mi";
        }
    }

    modal.classList.remove('hidden');
    // slight delay for transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
};

window.closePaceBreakdownModal = function() {
    const modal = document.getElementById('pace-breakdown-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// -----------------------------------------------------------------------------
// FULL JOURNEY PACE MODAL LOGIC
// -----------------------------------------------------------------------------
window.openFullPaceJourneyModal = function () {
    const modal = document.getElementById('full-pace-journey-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const data = window.cachedPaceData || (typeof userProfileData !== 'undefined' ? userProfileData : null);
    const runs = window.cachedPaceCompletedRuns || [];

    if (data) {
        setTimeout(() => {
            try {
                updatePaceChart(data, runs, true);
            } catch (e) {
                console.error("Crash in updatePaceChart full journey:", e);
            }
        }, 100);
    }
};

window.closeFullPaceJourneyModal = function () {
    const modal = document.getElementById('full-pace-journey-modal');
    if (!modal) return;
    modal.classList.add('hidden');

    const data = window.cachedPaceData || (typeof userProfileData !== 'undefined' ? userProfileData : null);
    const runs = window.cachedPaceCompletedRuns || [];
    if (data) updatePaceChart(data, runs, false);
};

// -----------------------------------------------------------------------------
// 5-WEEK ACTIVITY HISTORY & REVIEW MODAL LOGIC
// -----------------------------------------------------------------------------
window.openActivityHistoryModal = async function () {
    const modal = document.getElementById('activity-history-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const contentBox = modal.querySelector('div');
        if (contentBox) contentBox.classList.remove('scale-95');
    }, 10);

    await window.renderActivityHistoryList();
};

window.closeActivityHistoryModal = function () {
    const modal = document.getElementById('activity-history-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const contentBox = modal.querySelector('div');
    if (contentBox) contentBox.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
};

window.renderActivityHistoryList = async function () {
    const listContainer = document.getElementById('activity-history-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="flex items-center justify-center p-8 text-slate-400 gap-2 text-xs">
            <i class="fa-solid fa-spinner fa-spin text-emerald-400"></i> Loading 5-week activity logs...
        </div>
    `;

    let historyWorkouts = [];
    if (typeof userId !== 'undefined' && userId) {
        historyWorkouts = await getOrFetchHistoryWorkouts(userId);
    }
    const activeWorkouts = typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : [];

    // Merge workouts without duplicate IDs
    const workoutMap = new Map();
    [...activeWorkouts, ...historyWorkouts].forEach(w => {
        if (w && w.id) workoutMap.set(w.id, w);
    });
    const allWorkouts = Array.from(workoutMap.values());

    const profileData = window.cachedPaceData || (typeof userProfileData !== 'undefined' ? userProfileData : {});
    const { labels: allLabels, windows: allWindows, numWeeks, startMs } = generateWeeklyTimeline(profileData.journeyStartDate, profileData.targetDate, 12);

    // Determine 5-week active window slice matching the chart
    let latestActiveWeekIdx = 0;
    const nowMs = Date.now();
    for (let i = 0; i < numWeeks; i++) {
        const hasWorkouts = allWorkouts.some(w => {
            let wMs = w.dateExecuted ? parseLocalDate(w.dateExecuted).getTime() : 0;
            return wMs >= allWindows[i].start && wMs < allWindows[i].end;
        });
        if (hasWorkouts || (nowMs >= allWindows[i].start)) {
            latestActiveWeekIdx = i;
        }
    }

    let sliceEnd = Math.max(5, latestActiveWeekIdx + 1);
    sliceEnd = Math.min(numWeeks, sliceEnd);
    let sliceStart = Math.max(0, sliceEnd - 5);

    const windowStartMs = allWindows[sliceStart] ? allWindows[sliceStart].start : (nowMs - 35 * 86400000);
    const windowEndMs = allWindows[sliceEnd - 1] ? allWindows[sliceEnd - 1].end : (nowMs + 7 * 86400000);

    // Filter workouts within the 5-week performance window
    const eligibleWorkouts = allWorkouts.filter(w => {
        let wMs = 0;
        if (w.dateExecuted) {
            wMs = parseLocalDate(w.dateExecuted).getTime();
        } else if (w.sequenceOrder) {
            const wkOffset = Math.floor((w.sequenceOrder - 1) / 3);
            wMs = startMs + (wkOffset * 7 * 86400000);
        } else if (w.createdAt) {
            wMs = new Date(w.createdAt).getTime();
        }
        return wMs >= windowStartMs && wMs < windowEndMs;
    });

    // Sort descending by date / timestamp
    eligibleWorkouts.sort((a, b) => {
        const dateA = a.dateExecuted ? parseLocalDate(a.dateExecuted).getTime() : (a.sequenceOrder || 0);
        const dateB = b.dateExecuted ? parseLocalDate(b.dateExecuted).getTime() : (b.sequenceOrder || 0);
        return dateB - dateA;
    });

    if (eligibleWorkouts.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-10 text-slate-500 text-xs italic">
                <i class="fa-solid fa-calendar-xmark text-2xl text-slate-600 block mb-2"></i>
                No activities logged in the current 5-week window.
            </div>
        `;
        return;
    }

    listContainer.innerHTML = '';

    // Stats summary header
    const totalCount = eligibleWorkouts.length;
    const completedCount = eligibleWorkouts.filter(w => w.completed).length;
    const needsAttentionCount = eligibleWorkouts.filter(w => {
        const type = (w.actualActivityType || w.type || '').toLowerCase();
        const isDistType = ['run', 'easy', 'long', 'tempo', 'interval', 'fast'].some(k => type.includes(k));
        const missingDist = w.actualLoggedDistance === null || w.actualLoggedDistance === undefined || w.actualLoggedDistance === '';
        const missingPace = !w.actualLoggedPace;
        const missingDur = w.actualLoggedDuration === null || w.actualLoggedDuration === undefined || w.actualLoggedDuration === '';
        return w.completed && isDistType && (missingDist || missingPace || missingDur);
    }).length;

    const summaryHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 mb-3 text-xs gap-2">
            <div class="flex items-center gap-3">
                <span class="text-slate-400 font-medium"><strong class="text-white">${totalCount}</strong> Activities</span>
                <span class="text-emerald-400 font-medium"><strong class="text-emerald-300">${completedCount}</strong> Completed</span>
            </div>
            ${needsAttentionCount > 0 ? `
                <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 self-start sm:self-auto">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${needsAttentionCount} Missing Metrics
                </span>
            ` : `
                <span class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 self-start sm:self-auto">
                    <i class="fa-solid fa-check"></i> All Metrics Complete
                </span>
            `}
        </div>
    `;
    listContainer.insertAdjacentHTML('beforeend', summaryHTML);

    // Group activities by week
    const weekMap = new Map();
    eligibleWorkouts.forEach(w => {
        let wMs = w.dateExecuted ? parseLocalDate(w.dateExecuted).getTime() : 0;
        let weekLabel = "Recent Sessions";
        for (let i = sliceStart; i < sliceEnd; i++) {
            if (allWindows[i] && wMs >= allWindows[i].start && wMs < allWindows[i].end) {
                weekLabel = `Week ${allWindows[i].weekNum} (${allWindows[i].dateStr})`;
                break;
            }
        }
        if (!weekMap.has(weekLabel)) weekMap.set(weekLabel, []);
        weekMap.get(weekLabel).push(w);
    });

    weekMap.forEach((workouts, weekTitle) => {
        const weekHeader = document.createElement('div');
        weekHeader.className = "flex items-center gap-2 pt-2 pb-1 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider";
        weekHeader.innerHTML = `<i class="fa-regular fa-calendar text-indigo-400"></i> ${weekTitle}`;
        listContainer.appendChild(weekHeader);

        workouts.forEach(w => {
            const type = (w.actualActivityType || w.type || 'run').toLowerCase();
            const isDistType = ['run', 'easy', 'long', 'tempo', 'interval', 'fast', 'walk'].some(k => type.includes(k));
            const d = w.dateExecuted ? parseLocalDate(w.dateExecuted) : (w.createdAt ? new Date(w.createdAt) : new Date());
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

            const isMissingDist = isDistType && w.completed && (w.actualLoggedDistance === null || w.actualLoggedDistance === undefined || w.actualLoggedDistance === '');
            const isMissingPace = isDistType && w.completed && !w.actualLoggedPace;
            const isMissingDur = w.completed && (w.actualLoggedDuration === null || w.actualLoggedDuration === undefined || w.actualLoggedDuration === '');
            const hasMissingData = isMissingDist || isMissingPace || isMissingDur;

            const hr = w.actualHeartRate || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgHeartRate);
            const effort = w.effortZone || w.rpeScore;
            const notes = w.userWorkoutNotes || w.userNotes || w.notes || w.workoutNotes;

            const cardBorder = hasMissingData 
                ? "border-amber-500/40 bg-slate-900/90 shadow-sm shadow-amber-500/5" 
                : (w.completed ? "border-slate-800 bg-slate-900/60" : "border-slate-800/40 bg-slate-900/30 opacity-70");

            const el = document.createElement('div');
            el.className = `p-3.5 rounded-2xl border flex flex-col gap-2 transition-all ${cardBorder}`;
            el.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-xs font-black text-slate-200 shrink-0">${dateStr}</span>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 shrink-0">${type}</span>
                        <h4 class="text-xs font-bold text-slate-300 truncate max-w-[130px] sm:max-w-[220px]" title="${w.workoutTitle || ''}">${w.workoutTitle || 'Workout'}</h4>
                    </div>
                    <button onclick="openEditWorkoutModal('${w.id}')" class="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95">
                        <i class="fa-solid fa-pen-to-square text-[9px]"></i> Edit
                    </button>
                </div>

                <!-- Metrics Badges Row -->
                <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    ${w.completed ? `
                        <!-- Distance Badge -->
                        ${w.actualLoggedDistance ? `
                            <span class="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">${w.actualLoggedDistance} mi</span>
                        ` : (isDistType ? `
                            <span class="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">⚠️ Missing Dist</span>
                        ` : '')}

                        <!-- Duration Badge -->
                        ${w.actualLoggedDuration ? `
                            <span class="text-slate-300 font-bold bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/80">${w.actualLoggedDuration} min</span>
                        ` : `
                            <span class="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">⚠️ Missing Time</span>
                        `}

                        <!-- Pace Badge -->
                        ${w.actualLoggedPace ? `
                            <span class="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">${w.actualLoggedPace} /mi</span>
                        ` : (isDistType ? `
                            <span class="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">⚠️ Missing Pace</span>
                        ` : '')}

                        <!-- Heart Rate Badge -->
                        ${hr ? `
                            <span class="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20"><i class="fa-solid fa-heart-pulse text-[9px] mr-0.5"></i> ${hr} BPM</span>
                        ` : ''}

                        <!-- Effort Badge -->
                        ${effort ? `
                            <span class="text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">Zone ${effort}</span>
                        ` : ''}
                    ` : `
                        <span class="text-slate-500 font-bold italic bg-slate-800/40 px-2 py-0.5 rounded-md">Incomplete</span>
                    `}
                </div>

                ${notes ? `
                    <p class="text-[11px] text-slate-400 italic bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 truncate">"${notes}"</p>
                ` : ''}
            `;
            listContainer.appendChild(el);
        });
    });
};
