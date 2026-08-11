function openSwapModifyModal(workoutId) {
            activeSwapWorkoutId = workoutId;
            selectedTargetDay = null;
            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === workoutId) : null;
            if (!workout) return;

            document.getElementById('swap-modify-subtitle').innerText = `Modifying: ${workout.workoutTitle}`;
            document.getElementById('swap-ai-notes').value = '';
            document.getElementById('swap-ai-warning').classList.add('hidden');
            document.getElementById('swap-order-warning').classList.add('hidden');

            const previewEl = document.getElementById('swap-action-preview');
            if (previewEl) previewEl.classList.add('hidden');

            renderSwapDayTiles();

            switchSwapModalTab('ai');
            const modal = document.getElementById('swap-modify-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

function closeSwapModifyModal() {
            const modal = document.getElementById('swap-modify-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            activeSwapWorkoutId = null;
            selectedTargetDay = null;
        }

function renderSwapDayTiles() {
            const grid = document.getElementById('swap-tiles-grid');
            const previewEl = document.getElementById('swap-action-preview');
            const previewText = document.getElementById('swap-action-preview-text');
            if (!grid) return;
            grid.innerHTML = '';

            const sourceWorkout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === activeSwapWorkoutId) : null;
            if (!sourceWorkout) return;

            const daysMap = {};
            for (let d = 1; d <= 7; d++) {
                daysMap[d] = [];
            }
            if (activePhaseWorkouts) {
                activePhaseWorkouts.forEach(w => {
                    const dayNum = w.sequenceOrder || 1;
                    if (daysMap[dayNum]) {
                        daysMap[dayNum].push(w);
                    }
                });
            }

            const sourceDay = sourceWorkout.sequenceOrder || 1;

            for (let d = 1; d <= 7; d++) {
                const isCurrentDay = d === sourceDay;
                const dayWorkouts = daysMap[d] || [];
                const isSelected = selectedTargetDay === d;

                let badgeHtml = '';
                let actionDescription = '';

                if (isCurrentDay) {
                    badgeHtml = `<span class="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Current Day</span>`;
                    actionDescription = `Current position of ${sourceWorkout.workoutTitle}.`;
                } else {
                    const typeA = sourceWorkout.type === 'strength' ? 'strength' : (sourceWorkout.type === 'rest' ? 'rest' : 'cardio');
                    const sameTypeMatch = dayWorkouts.find(w => {
                        const typeB = w.type === 'strength' ? 'strength' : (w.type === 'rest' ? 'rest' : 'cardio');
                        return typeA === typeB;
                    });

                    if (sameTypeMatch) {
                        badgeHtml = `<span class="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/40">🔄 Swap</span>`;
                        actionDescription = `Will swap ${sourceWorkout.workoutTitle} with ${sameTypeMatch.workoutTitle} on Day ${d}.`;
                    } else if (dayWorkouts.length === 1 && dayWorkouts[0].type !== 'rest') {
                        badgeHtml = `<span class="text-[9px] font-bold text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/40">➕ Combine</span>`;
                        actionDescription = `Will move ${sourceWorkout.workoutTitle} to Day ${d} alongside ${dayWorkouts[0].workoutTitle}.`;
                    } else {
                        badgeHtml = `<span class="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40">➡️ Move</span>`;
                        actionDescription = `Will move ${sourceWorkout.workoutTitle} to Day ${d}.`;
                    }
                }

                const tileBorder = isSelected
                    ? 'border-indigo-500 bg-indigo-950/80 ring-2 ring-indigo-500/60 shadow-lg'
                    : (isCurrentDay ? 'border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed' : 'border-slate-800 bg-slate-950 hover:border-indigo-500/40 hover:bg-slate-900 cursor-pointer');

                const tile = document.createElement('div');
                tile.className = `p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 text-left relative ${tileBorder}`;

                let itemsSummary = dayWorkouts.map(w => `<span class="truncate block text-[10px] text-slate-300 font-medium">• ${w.workoutTitle}</span>`).join('') || `<span class="text-[10px] text-slate-500 italic">Rest Day</span>`;

                tile.innerHTML = `
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-extrabold text-white">Day ${d}</span>
                        ${badgeHtml}
                    </div>
                    <div class="space-y-0.5">
                        ${itemsSummary}
                    </div>
                `;

                if (!isCurrentDay) {
                    tile.onclick = function () {
                        selectedTargetDay = d;
                        renderSwapDayTiles();
                        if (previewEl && previewText) {
                            previewText.innerText = actionDescription;
                            previewEl.classList.remove('hidden');
                        }
                    };
                }

                grid.appendChild(tile);
            }
        }

function switchSwapModalTab(tab) {
            const aiTabBtn = document.getElementById('swap-tab-ai');
            const orderTabBtn = document.getElementById('swap-tab-order');
            const aiContent = document.getElementById('swap-content-ai');
            const orderContent = document.getElementById('swap-content-order');

            if (tab === 'ai') {
                aiTabBtn.className = 'flex-1 py-2 rounded-lg bg-indigo-600 text-white font-bold transition-all cursor-pointer';
                orderTabBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white font-bold transition-all cursor-pointer';
                aiContent.classList.remove('hidden');
                orderContent.classList.add('hidden');
            } else {
                orderTabBtn.className = 'flex-1 py-2 rounded-lg bg-indigo-600 text-white font-bold transition-all cursor-pointer';
                aiTabBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white font-bold transition-all cursor-pointer';
                orderContent.classList.remove('hidden');
                aiContent.classList.add('hidden');
                renderSwapDayTiles();
            }
        }

async function submitWorkoutOrderSwap() {
            if (!activeSwapWorkoutId) return;
            const warnEl = document.getElementById('swap-order-warning');
            const submitBtn = document.getElementById('swap-order-submit-btn');

            if (!selectedTargetDay) {
                warnEl.innerText = "Please tap a destination day tile above to swap or move this workout.";
                warnEl.classList.remove('hidden');
                return;
            }
            warnEl.classList.add('hidden');

            const sourceWorkout = activePhaseWorkouts.find(w => w.id === activeSwapWorkoutId);
            if (!sourceWorkout) return;

            const sourceDay = sourceWorkout.sequenceOrder || 1;
            const targetDay = selectedTargetDay;

            if (sourceDay === targetDay) return;

            const targetWorkouts = activePhaseWorkouts.filter(w => (w.sequenceOrder || 1) === targetDay);
            const typeA = sourceWorkout.type === 'strength' ? 'strength' : (sourceWorkout.type === 'rest' ? 'rest' : 'cardio');

            const sameTypeMatch = targetWorkouts.find(w => {
                const typeB = w.type === 'strength' ? 'strength' : (w.type === 'rest' ? 'rest' : 'cardio');
                return typeA === typeB;
            });

            const origHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving changes...`;
            }

            try {
                if (sameTypeMatch) {
                    const docRefA = db.collection("users").doc(userId).collection("active_phase").doc(sourceWorkout.id);
                    const docRefB = db.collection("users").doc(userId).collection("active_phase").doc(sameTypeMatch.id);

                    await Promise.all([
                        docRefA.update({ sequenceOrder: targetDay }),
                        docRefB.update({ sequenceOrder: sourceDay })
                    ]);

                    sourceWorkout.sequenceOrder = targetDay;
                    sameTypeMatch.sequenceOrder = sourceDay;
                } else {
                    const docRefA = db.collection("users").doc(userId).collection("active_phase").doc(sourceWorkout.id);
                    await docRefA.update({ sequenceOrder: targetDay });
                    sourceWorkout.sequenceOrder = targetDay;

                    const restOnTarget = targetWorkouts.find(w => w.type === 'rest');
                    if (restOnTarget) {
                        const docRefRest = db.collection("users").doc(userId).collection("active_phase").doc(restOnTarget.id);
                        await docRefRest.update({ sequenceOrder: sourceDay });
                        restOnTarget.sequenceOrder = sourceDay;
                    }
                }

                closeSwapModifyModal();
                renderNextActivityCard();
                buildActivePhaseHTML();
            } catch (err) {
                console.error("Error swapping/moving workout:", err);
                warnEl.innerText = "⚠️ Failed to move workout: " + (err.message || "Unknown error");
                warnEl.classList.remove('hidden');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = origHtml;
                }
            }
        }

async function submitSingleWorkoutModification() {
            if (!activeSwapWorkoutId) return;
            const currentWorkout = activePhaseWorkouts.find(w => w.id === activeSwapWorkoutId);
            const notesVal = document.getElementById('swap-ai-notes').value.trim();
            const warnEl = document.getElementById('swap-ai-warning');
            const submitBtn = document.getElementById('swap-ai-submit-btn');

            if (!notesVal) {
                warnEl.innerText = "Please describe what adjustment or replacement you need.";
                warnEl.classList.remove('hidden');
                return;
            }
            warnEl.classList.add('hidden');

            const origBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Coach is generating replacement...`;

            try {
                const modifySingleWorkout = firebase.functions().httpsCallable('modifySingleWorkout');
                const result = await modifySingleWorkout({
                    profile: userProfileData,
                    currentWorkout: currentWorkout,
                    userNotes: notesVal
                });

                if (result.data && result.data.workout) {
                    const newWorkout = result.data.workout;
                    const workoutDocRef = db.collection("users").doc(userId).collection("active_phase").doc(activeSwapWorkoutId);
                    await workoutDocRef.set(newWorkout, { merge: true });

                    const idx = activePhaseWorkouts.findIndex(w => w.id === activeSwapWorkoutId);
                    if (idx !== -1) {
                        activePhaseWorkouts[idx] = newWorkout;
                    }

                    closeSwapModifyModal();
                    renderNextActivityCard();
                    buildActivePhaseHTML();
                } else {
                    throw new Error("Invalid response structure from AI Coach.");
                }
            } catch (err) {
                console.error("Error modifying single workout:", err);
                warnEl.innerText = "⚠️ Failed to modify workout: " + (err.message || "Unknown error");
                warnEl.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnHtml;
            }
        }

