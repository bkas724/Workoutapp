window.openFogOfWarModal = function (isCompetitor) {
            const modal = document.getElementById('fog-of-war-modal');
            if (!modal) return;
            const title = document.getElementById('fow-modal-title');
            const subtitle = document.getElementById('fow-modal-subtitle');
            const icon = document.getElementById('fow-modal-icon');
            const content = document.getElementById('fow-modal-content');

            if (isCompetitor) {
                title.innerText = "Fog of War Active";
                subtitle.innerText = "Competitor Blind Mode";
                icon.className = "p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20";
                icon.innerHTML = '<i class="fa-solid fa-user-shield text-lg"></i>';
                content.innerHTML = `
                    <p><strong>Why can't I see my opponent's actual time?</strong></p>
                    <p class="text-slate-400">To keep the competition fair and prevent runners from pacing off each other's weekly numbers or sandbagging, active competitors cannot see each other's live scores or screenshot proofs.</p>
                    <div class="bg-indigo-950/40 border border-indigo-500/30 p-3 rounded-xl mt-2 text-indigo-200">
                        <p class="font-bold mb-1"><i class="fa-solid fa-chart-line mr-1 text-indigo-400"></i> What you are seeing:</p>
                        <p class="text-[11px] leading-normal">You are viewing your opponent's <strong>Estimated Trajectory</strong> based on consistent weekly training (+2.0% score per week from their baseline seed).</p>
                    </div>
                    <p class="text-[11px] text-slate-500 italic mt-2">Note: Spectators and visitors have V.I.P. access and can view all live, unfiltered scores!</p>
                `;
            } else {
                title.innerText = "Spectator Access";
                subtitle.innerText = "V.I.P. Unfiltered View";
                icon.className = "p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20";
                icon.innerHTML = '<i class="fa-solid fa-eye text-lg"></i>';
                content.innerHTML = `
                    <p><strong>You have V.I.P. Spectator Access!</strong></p>
                    <p class="text-slate-400">Because you are viewing as a guest or family member (not logged in as Bryan or Anthony), you get to see all the behind-the-scenes drama!</p>
                    <div class="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl mt-2 text-emerald-200">
                        <p class="font-bold mb-1"><i class="fa-solid fa-unlock mr-1 text-emerald-400"></i> Full Visibility:</p>
                        <p class="text-[11px] leading-normal">You are seeing both runners' <strong>actual live scores</strong>, real projected race paces, and have full access to view their weekly screenshot proofs!</p>
                    </div>
                    <p class="text-[11px] text-slate-500 italic mt-2">Note: Bryan and Anthony cannot see each other's real numbers—only you can!</p>
                `;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

window.closeFogOfWarModal = function () {
            const modal = document.getElementById('fog-of-war-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

function toggleGatekeeper(id, forceShow) {
            const leftCol = document.getElementById(`activity-details-${id}`);
            const rightCol = document.getElementById(`gatekeeper-form-container-${id}`);
            const card = document.getElementById(`focus-card-${id}`);
            const prepTip = document.getElementById(`prep-tip-${id}`);
            const cardBody = document.getElementById(`card-body-${id}`);
            const logBtn = document.getElementById(`log-btn-${id}`);
            const cancelBtn = document.getElementById(`cancel-btn-${id}`);
            const quickBtn = document.getElementById(`quick-btn-${id}`);
            const watermark = document.getElementById(`watermark-icon-${id}`);
            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === id) : null;

            const isCurrentlyHidden = rightCol ? rightCol.classList.contains('hidden') : true;
            const shouldShow = forceShow !== undefined ? forceShow : isCurrentlyHidden;

            if (shouldShow) {
                if (leftCol) leftCol.classList.add('hidden');
                if (rightCol) rightCol.classList.remove('hidden');
                if (prepTip) prepTip.classList.add('hidden');
                if (cardBody) cardBody.classList.remove('hidden');
                if (workout) {
                    const intervalMeta = getIntervalMetadata(workout);
                    const intervalContainer = document.getElementById(`interval-splits-container-${id}`);
                    const intervalTitle = document.getElementById(`interval-splits-title-${id}`);
                    const badgeCount = document.getElementById(`rep-split-count-badge-${id}`);
                    if (intervalMeta && intervalContainer) {
                        intervalContainer.classList.remove('hidden');
                        if (intervalTitle) {
                            intervalTitle.innerText = "Advanced Rep splits";
                        }
                        if (badgeCount) {
                            badgeCount.innerText = "";
                            badgeCount.classList.add('hidden');
                        }

                        // Compute default raw rep time from target pace (e.g. 6:00 /mi -> 1:29 for 400m)
                        const minInput = document.getElementById(`logged-min-${id}`);
                        const secInput = document.getElementById(`logged-sec-${id}`);
                        let targetPaceSecPerMile = 360;
                        if (minInput && minInput.value !== "") {
                            const m = parseInt(minInput.value) || 6;
                            const s = parseInt(secInput ? secInput.value : 0) || 0;
                            targetPaceSecPerMile = (m * 60) + s;
                        }
                        const repDistMiles = parseRepDistanceInMiles(intervalMeta.repDistance);
                        const rawRepSecTotal = Math.round(targetPaceSecPerMile * repDistMiles);
                        const defaultRepMin = Math.floor(rawRepSecTotal / 60);
                        const defaultRepSec = rawRepSecTotal % 60;

                        const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
                        const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
                        if (avgMinInput && !avgMinInput.value) avgMinInput.value = defaultRepMin;
                        if (avgSecInput && !avgSecInput.value) avgSecInput.value = defaultRepSec < 10 ? '0' + defaultRepSec : defaultRepSec;

                        renderRepRows(id, intervalMeta.repCount, defaultRepMin, defaultRepSec < 10 ? '0' + defaultRepSec : defaultRepSec);
                        recalculateIntervalPace(id);
                    }
                }

                if (logBtn) {
                    logBtn.innerHTML = '<span class="hidden md:inline-block"><i class="fa-solid fa-check text-xs mr-1"></i></span><span>Submit</span>';
                    logBtn.className = "w-12 h-8 md:w-auto md:px-4 md:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1 active:scale-95";
                    const isBenchmark = workout ? workout.isBenchmark : false;
                    const type = workout ? workout.type : 'easy';
                    logBtn.onclick = function (e) {
                        e.stopPropagation();
                        submitWorkout(id, isBenchmark, type);
                    };
                }

                if (cancelBtn) {
                    cancelBtn.classList.remove('hidden');
                }

                if (card) {
                    setTimeout(() => {
                        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }
            } else {
                if (leftCol) leftCol.classList.remove('hidden');
                if (rightCol) rightCol.classList.add('hidden');
                if (prepTip) prepTip.classList.remove('hidden');
                if (cardBody) cardBody.classList.add('hidden');
                if (quickBtn) quickBtn.classList.remove('hidden');
                if (watermark) watermark.classList.remove('hidden');

                if (logBtn) {
                    logBtn.innerHTML = '<span class="hidden md:inline-block"><i class="fa-solid fa-sliders text-[11px] mr-1"></i></span><span>Log</span>';
                    logBtn.className = "w-12 h-8 md:w-auto md:px-3.5 md:py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95";
                    logBtn.onclick = function (e) {
                        e.stopPropagation();
                        toggleGatekeeper(id);
                    };
                }

                if (cancelBtn) {
                    cancelBtn.classList.add('hidden');
                }
            }
        }

function openPrepTipModal(event, stepId) {
            if (event) event.stopPropagation();

            const workout = activePhaseWorkouts.find(w => w.id === stepId);
            if (!workout || !workout.jitPreparationTip) return;

            const modal = document.getElementById('global-prep-tip-modal');
            const content = document.getElementById('global-prep-tip-content');

            if (modal && content) {
                content.innerText = workout.jitPreparationTip;
                modal.classList.remove('hidden');
            }

            if (!workout.hasReadJitTip && typeof db !== 'undefined' && userId) {
                db.collection("users").doc(userId).collection("active_phase").doc(stepId).update({
                    hasReadJitTip: true
                }).catch(err => console.error("Error updating hasReadJitTip", err));

                const badge = document.getElementById(`jit-badge-${stepId}`);
                if (badge) badge.classList.remove('pulse-slow');
                workout.hasReadJitTip = true;
            }
        }

function closePrepTipModal() {
            const modal = document.getElementById('global-prep-tip-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        }

