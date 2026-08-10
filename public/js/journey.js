function openStartNewJourneyModal() {
    if (typeof closeProfileModal === 'function') closeProfileModal();

    if (userProfileData && userId) {
        const confirmed = confirm("Are you sure you want to start a new journey? This will wipe your current active block and restart you at Phase 1. Your historical completed workouts will be archived.");
        if (!confirmed) return;

        // Open onboarding modal directly for existing athlete ID
        document.getElementById('onboarding-modal').classList.remove('hidden');
        document.getElementById('profile-lookup-panel').classList.add('hidden');
        document.getElementById('create-id-panel').classList.add('hidden');
        document.getElementById('medical-disclaimer-panel').classList.remove('hidden');
    } else {
        showProfileLookupPanel();
    }
}

function renderJourneyAnchorCard() {
            const anchorTitle = document.getElementById('journey-anchor-title');
            const anchorHorizon = document.getElementById('journey-anchor-horizon');
            const anchorWhy = document.getElementById('journey-anchor-why');
            const anchorMetrics = document.getElementById('journey-anchor-metrics');

            if (!anchorTitle || !anchorMetrics) return;

            const data = userProfileData || {};
            const dynData = data.dynamicGoalData || {};

            const titleToDisplay = data.journeyGoalTitle || data.journeyTitle || dynData.journeyTitle || "My Flow Quest";
            anchorTitle.innerText = titleToDisplay;

            if (anchorWhy) {
                const whyToDisplay = data.whyMotivation || data.why || data.journeyDescription || data.userBaselineNotes || "Achieve my fitness targets with consistency and zero guilt.";
                anchorWhy.innerText = whyToDisplay;
            }

            // Target Date calculation
            const targetDateStr = data.targetDate || dynData.targetDate;
            if (targetDateStr) {
                const target = new Date(targetDateStr);
                const now = new Date();
                const diffTime = target - now;
                if (diffTime > 0) {
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const diffWeeks = Math.ceil(diffDays / 7);
                    if (anchorHorizon) anchorHorizon.innerText = `${diffWeeks} Weeks Remaining`;
                } else {
                    if (anchorHorizon) anchorHorizon.innerText = "Goal Horizon Reached";
                }
            } else {
                if (anchorHorizon) anchorHorizon.innerText = "12-Week Horizon";
            }

            const primaryGoal = data.primaryGoal || 'race';
            anchorMetrics.innerHTML = '';

            if (primaryGoal === 'race') {
                const basePace = data.baseline5k || data.currentEstimated5k || dynData.currentPace || "25:00";
                const goalPace = data.activeAdjustedGoal || dynData.goalPace || "22:30";
                const tier = data.challengeTier || "Progressive";

                anchorMetrics.innerHTML = `
                    <div class="space-y-0.5">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Baseline Pace</span>
                        <span class="text-xs font-black text-slate-200">${basePace} /mi</span>
                    </div>
                    <div class="space-y-0.5">
                        <span class="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Target Goal Pace</span>
                        <span class="text-xs font-black text-indigo-300">${goalPace} /mi</span>
                    </div>
                    <div class="space-y-0.5 col-span-2 sm:col-span-1">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Progression Tier</span>
                        <span class="text-xs font-bold text-emerald-400 capitalize">${tier}</span>
                    </div>
                `;
            } else {
                // Health / Weight / Habit Goal
                const weeklyVolume = data.goalMetrics?.weeklyVolumeMiles || data.weeklyVolumeMiles || "4.5";
                const startWeight = data.startingWeight || data.weight || "185";
                const targetWeight = data.targetWeight || (parseFloat(startWeight) - 15).toString();

                anchorMetrics.innerHTML = `
                    <div class="space-y-0.5">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Target</span>
                        <span class="text-xs font-black text-indigo-300">${weeklyVolume} Active Miles</span>
                    </div>
                    <div class="space-y-0.5">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Weight Horizon</span>
                        <span class="text-xs font-black text-emerald-400">${startWeight} ➔ ${targetWeight} lbs</span>
                    </div>
                    <div class="space-y-0.5 col-span-2 sm:col-span-1">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Days</span>
                        <span class="text-xs font-bold text-slate-200">${data.daysAvailable || 4} Days / Week</span>
                    </div>
                `;
            }
        }

function openDetailedPlanModal() {
            const modal = document.getElementById('detailed-plan-modal');
            if (!modal) return;
            renderDetailedPlanStages();
            modal.classList.remove('hidden');
        }

function renderDetailedPlanStages() {
            const container = document.getElementById('detailed-plan-stages');
            const toggle = document.getElementById('detailed-plan-toggle');
            if (!container) return;

            const isDetailed = toggle ? toggle.checked : true;
            container.innerHTML = '';

            let plan = [];
            if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
                plan = userProfileData.macrocyclePlan;
            } else {
                plan = [
                    { theme: "Speed Induction", simpleDescription: "Neuromuscular speed coordination.", detailedDescription: "Neuromuscular speed coordination. Alternating explosive 400m intervals with targeted glute/heel stability." },
                    { theme: "Speed Endurance", simpleDescription: "Aerobic threshold development.", detailedDescription: "Aerobic threshold development. Extending speed efforts to 1000m blocks and posterior hamstring deadlifts." },
                    { theme: "Peak & Taper", simpleDescription: "Maximum capacity and recovery.", detailedDescription: "Maximum capacity and recovery. Testing 1-mile repetitions before backing off volume for supercompensation." }
                ];
            }

            let currentAccumulatedDate = userProfileData && userProfileData.journeyStartDate ? new Date(userProfileData.journeyStartDate) : new Date();

            plan.forEach((stage, idx) => {
                let dateBadge = '';
                if (stage.expectedDurationWeeks) {
                    currentAccumulatedDate.setDate(currentAccumulatedDate.getDate() + (stage.expectedDurationWeeks * 7));
                    const options = { month: 'short', day: 'numeric' };
                    dateBadge = `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-md whitespace-nowrap">Target: ${currentAccumulatedDate.toLocaleDateString(undefined, options)}</span>`;
                }

                const descToShow = isDetailed
                    ? (stage.detailedDescription || stage.description || 'No detailed description available.')
                    : (stage.simpleDescription || stage.description || 'No description available.');

                container.innerHTML += `
                    <div class="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-left">
                        <div class="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            ${idx + 1}
                        </div>
                        <div class="w-full">
                            <div class="flex items-center justify-between gap-2">
                                <h4 class="text-sm font-bold text-slate-200">${stage.theme || 'Phase ' + (idx + 1)}</h4>
                                ${dateBadge}
                            </div>
                            <p class="text-xs text-slate-500 leading-relaxed mt-1">${descToShow}</p>
                        </div>
                    </div>
                `;
            });
        }

function closeDetailedPlanModal() {
            const modal = document.getElementById('detailed-plan-modal');
            if (modal) modal.classList.add('hidden');

            // Force redraw of the timeline to prevent browser rendering bugs or missing states
            if (typeof userProfileData !== 'undefined' && userProfileData) {
                updateTimelineView(userProfileData.currentPhaseIndex || 1);
            } else {
                updateTimelineView(1);
            }
        }



