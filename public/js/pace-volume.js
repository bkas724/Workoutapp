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

            allCompleted.sort((a, b) => new Date(a.dateExecuted) - new Date(b.dateExecuted));

            const blocks = [];
            for (let i = 0; i + 7 <= allCompleted.length; i += 7) {
                blocks.push(allCompleted.slice(i, i + 7));
            }

            const recentBlocks = blocks.slice(-5);
            const blockScores = [];

            let prevEndDate = null;
            if (blocks.length > recentBlocks.length) {
                const precedingBlock = blocks[blocks.length - recentBlocks.length - 1];
                prevEndDate = new Date(precedingBlock[precedingBlock.length - 1].dateExecuted);
            }

            recentBlocks.forEach(chunk => {
                if (chunk.length < 7) return;

                const endDate = new Date(chunk[chunk.length - 1].dateExecuted);
                let diffDays;

                if (prevEndDate) {
                    const diffTime = Math.abs(endDate - prevEndDate);
                    diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
                } else {
                    const startDate = new Date(chunk[0].dateExecuted);
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

            // Parse Date
            const d = new Date(w.dateExecuted || w.createdAt || Date.now());
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const mathText = item.mathType || "Fallback";

            // Visual state for discarded vs active
            const borderClass = isDiscarded ? "border-slate-800/50 bg-slate-900/30 opacity-50 grayscale" : "border-indigo-500/30 bg-slate-900";
            const strikeClass = isDiscarded ? "line-through text-slate-500" : "text-amber-400";
            const badgeHTML = isDiscarded ? `<span class="absolute -top-2 -right-2 bg-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-400 uppercase tracking-wider">Outlier</span>` : '';

            const el = document.createElement('div');
            el.className = `relative p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${borderClass}`;
            el.innerHTML = `
                ${badgeHTML}
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-slate-300">${dateStr}</span>
                        <span class="text-[9px] font-bold font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">${w.actualLoggedDistance || 0} mi</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Logged:</span>
                        <span class="text-xs font-bold font-mono text-slate-300">${item.rawPace || "--:--"}</span>
                    </div>
                </div>
                
                <div class="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800/50">
                    <span class="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20"><i class="fa-solid fa-microchip mr-1 opacity-70"></i> ${mathText}</span>
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
