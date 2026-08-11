function submitWorkout(activityId, isBenchmark, defaultType, cbElement) {
            const hasDistInput = !!document.getElementById(`logged-distance-${activityId}`);
            const isDistType = hasDistInput || ['run', 'walk', 'bike', 'swim', 'easy', 'fast', 'long', 'tempo', 'interval', 'recovery', 'base', 'aerobic'].includes(defaultType?.toLowerCase());
            const typeClass = isDistType ? 'distance' : 'duration';

            const rpeSelect = document.getElementById(`logged-rpe-${activityId}`);
            const warning = document.getElementById(`gatekeeper-warn-${activityId}`);
            const rpeVal = rpeSelect ? rpeSelect.value : null;

            let actualDistance = null;
            let actualDuration = null;
            let actualWorkoutPaceDecimal = null;
            let paceStr = null;

            if (defaultType === 'rest') {
                // Rest day needs no distance/duration/RPE validation
            } else if (typeClass === 'distance') {
                const distInput = document.getElementById(`logged-distance-${activityId}`);
                const minInput = document.getElementById(`logged-min-${activityId}`);
                const secInput = document.getElementById(`logged-sec-${activityId}`);

                const dist = parseFloat(distInput.value);
                const mins = parseFloat(minInput.value);
                const secs = parseFloat(secInput.value);

                if (isNaN(dist) || isNaN(mins) || isNaN(secs) || minInput.value === "" || secInput.value === "" || !rpeVal) {
                    if (warning) {
                        warning.innerText = "⚠️ Please fill out all metrics and select an Effort score before submitting.";
                        warning.classList.remove('hidden');
                    }
                    if (cbElement) cbElement.checked = false;
                    return;
                }

                actualDistance = dist;
                actualWorkoutPaceDecimal = mins + (secs / 60);
                paceStr = `${mins}:${secs < 10 ? '0' + secs : secs}`;
            } else {
                const durInput = document.getElementById(`logged-duration-${activityId}`);
                const dur = parseFloat(durInput.value);

                if (isNaN(dur) || !rpeVal) {
                    if (warning) {
                        warning.innerText = "⚠️ Please fill out duration and select an RPE score before submitting.";
                        warning.classList.remove('hidden');
                    }
                    if (cbElement) cbElement.checked = false;
                    return;
                }
                actualDuration = dur;
            }

            if (warning) warning.classList.add('hidden');

            const loggedDateEl = document.getElementById(`logged-date-${activityId}`);
            const completionDate = (loggedDateEl && loggedDateEl.value) ? loggedDateEl.value : new Date().toISOString().split('T')[0];
            const notesEl = document.getElementById(`logged-notes-${activityId}`);
            const notesVal = (notesEl && notesEl.value.trim() !== '') ? notesEl.value.trim() : null;

            const workoutDocRef = db.collection("users").doc(userId).collection("active_phase").doc(activityId);

            let emaPromise = Promise.resolve();
            if (isBenchmark && typeClass === 'distance') {
                const prevMins = parseFloat(document.getElementById('input-min').value) || 8;
                const prevSecs = parseFloat(document.getElementById('input-sec').value) || 10;
                const previousTargetBaselineDecimal = prevMins + (prevSecs / 60);

                // Execute the 70/30 EMA formula
                const newBaselinePaceDecimal = (previousTargetBaselineDecimal * 0.70) + (actualWorkoutPaceDecimal * 0.30);

                const finalMin = Math.floor(newBaselinePaceDecimal);
                const finalSec = Math.round((newBaselinePaceDecimal - finalMin) * 60);
                const newEstimatedPace = `${finalMin}:${finalSec < 10 ? '0' + finalSec : finalSec}`;

                console.log(`EMA Recalibration: Prev=${prevMins}:${prevSecs}, Logged=${Math.floor(actualWorkoutPaceDecimal)}:${Math.round((actualWorkoutPaceDecimal - Math.floor(actualWorkoutPaceDecimal)) * 60)}, New=${newEstimatedPace}`);

                const currentPhase = (userProfileData && userProfileData.currentPhaseIndex) || 1;
                const checkpointIdx = getCheckpointIndex(currentPhase, activityId);
                const checkpointLabel = getCheckpointLabel(checkpointIdx);

                const updatePayload = {
                    currentEstimated5k: newEstimatedPace
                };
                if (checkpointIdx >= 0) {
                    updatePayload.paceHistory = firebase.firestore.FieldValue.arrayUnion({
                        phase: currentPhase,
                        activityId: activityId,
                        pace: newEstimatedPace,
                        date: completionDate,
                        label: checkpointLabel,
                        index: checkpointIdx
                    });
                }

                // Update baseline in root profile document
                emaPromise = db.collection("users").doc(userId).update(updatePayload).then(() => {
                    flashPaceChart();
                });
            }

            const repSplits = [];
            const repGrid = document.getElementById(`rep-rows-grid-${activityId}`);
            if (repGrid) {
                const rows = repGrid.querySelectorAll('.rep-split-row');
                rows.forEach(row => {
                    const minVal = row.querySelector('.rep-min-input')?.value || "0";
                    const secVal = row.querySelector('.rep-sec-input')?.value || "00";
                    if (minVal !== "" || secVal !== "") {
                        const formattedSec = parseInt(secVal || 0) < 10 ? `0${parseInt(secVal || 0)}` : `${parseInt(secVal || 0)}`;
                        repSplits.push(`${minVal || 0}:${formattedSec}`);
                    }
                });
            }

            emaPromise.then(() => {
                const updatePayload = {
                    completed: true,
                    actualActivityType: defaultType,
                    actualLoggedDistance: actualDistance,
                    actualLoggedDuration: actualDuration,
                    actualLoggedPace: paceStr,
                    rpeScore: (rpeVal && !isNaN(parseInt(rpeVal))) ? parseInt(rpeVal) : null,
                    dateExecuted: completionDate
                };
                if (repSplits.length > 0) {
                    updatePayload.repSplits = repSplits;
                }
                if (notesVal) {
                    updatePayload.userWorkoutNotes = notesVal;
                }
                if (lastUploadedWorkoutFile) {
                    updatePayload.uploadedWorkoutFile = lastUploadedWorkoutFile;
                }
                return workoutDocRef.update(updatePayload);
            }).then(() => {
                console.log("Workout metrics synced to cloud.");
                lastUploadedWorkoutFile = null;
            }).catch(err => {
                console.error("Error writing metrics to cloud: ", err);
                alert("Firestore sync failure.");
            });
        }

function unsubmitWorkout(activityId) {
            const workoutDocRef = db.collection("users").doc(userId).collection("active_phase").doc(activityId);
            workoutDocRef.update({
                completed: false
            }).then(() => {
                console.log("Workout unsubmitted.");
            }).catch(err => {
                console.error("Failed to unsubmit workout:", err);
            });
        }

function quickCompleteWorkout(activityId, isBenchmark, type) {
            const workout = activePhaseWorkouts.find(w => w.id === activityId);
            if (!workout) return;

            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const defaultDist = workout.targetDistance ? parseFloat(workout.targetDistance) : null;
            const defaultDur = workout.targetDuration ? parseFloat(workout.targetDuration) : 30;

            const workoutDocRef = db.collection("users").doc(userId).collection("active_phase").doc(activityId);
            workoutDocRef.update({
                completed: true,
                dateExecuted: todayStr,
                actualActivityType: type,
                actualLoggedDistance: defaultDist,
                actualLoggedDuration: defaultDur,
                rpeScore: 5
            }).then(() => {
                console.log("Quick completed workout:", activityId);
            }).catch(err => {
                console.error("Quick completion error:", err);
            });
        }

function getIntervalMetadata(workout) {
            if (!workout) return null;
            if (workout.isIntervalWorkout && workout.intervalRepCount) {
                return {
                    repCount: parseInt(workout.intervalRepCount) || 1,
                    repDistance: workout.intervalRepDistance || "Rep"
                };
            }
            const textToSearch = `${workout.workoutTitle || ''} ${workout.targetInstructions || ''}`;
            const match = textToSearch.match(/(\d+)\s*x\s*([\d\.]+\s*(?:m|meter|meters|mi|mile|miles|k|km)?)/i);
            if (match) {
                const count = parseInt(match[1]);
                const dist = match[2].trim();
                if (count && count > 1) {
                    return { repCount: count, repDistance: dist };
                }
            }
            return null;
        }

function recalculateIntervalPace(id) {
            const repsInput = document.getElementById(`interval-reps-input-${id}`);
            const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
            const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
            const calculatedPaceDisplay = document.getElementById(`calculated-pace-display-${id}`);
            const calculatedDistDisplay = document.getElementById(`calculated-dist-display-${id}`);

            const loggedDistInput = document.getElementById(`logged-distance-${id}`);
            const loggedMinInput = document.getElementById(`logged-min-${id}`);
            const loggedSecInput = document.getElementById(`logged-sec-${id}`);

            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === id) : null;
            const intervalMeta = getIntervalMetadata(workout);

            const reps = repsInput ? parseInt(repsInput.value) || 1 : (intervalMeta ? intervalMeta.repCount : 1);
            const repDistMiles = parseRepDistanceInMiles(intervalMeta ? intervalMeta.repDistance : "400m");
            const avgMin = avgMinInput ? parseInt(avgMinInput.value) || 0 : 0;
            const avgSec = avgSecInput ? parseInt(avgSecInput.value) || 0 : 0;

            const totalRepTimeSec = (avgMin * 60) + avgSec;
            const totalDistMiles = reps * repDistMiles;

            if (totalRepTimeSec > 0 && repDistMiles > 0) {
                const paceSecPerMile = Math.round(totalRepTimeSec / repDistMiles);
                const paceMin = Math.floor(paceSecPerMile / 60);
                const paceSec = paceSecPerMile % 60;
                const paceStr = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec}`;

                if (calculatedPaceDisplay) calculatedPaceDisplay.innerText = `${paceStr} /mi`;
                if (calculatedDistDisplay) calculatedDistDisplay.innerText = `${totalDistMiles.toFixed(2)} mi`;

                if (loggedDistInput) loggedDistInput.value = totalDistMiles.toFixed(2);
                if (loggedMinInput) loggedMinInput.value = paceMin;
                if (loggedSecInput) loggedSecInput.value = paceSec < 10 ? '0' + paceSec : paceSec;
            } else {
                if (calculatedPaceDisplay) calculatedPaceDisplay.innerText = `--:-- /mi`;
                if (calculatedDistDisplay) calculatedDistDisplay.innerText = `${totalDistMiles.toFixed(2)} mi`;
            }
        }

function renderRepRows(id, repCount, defaultMin, defaultSec) {
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;
            let html = '';
            for (let i = 1; i <= repCount; i++) {
                html += `
                <div class="rep-split-row flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800/80">
                    <span class="text-[10px] font-bold text-slate-400 font-mono">R${i}</span>
                    <div class="flex items-center gap-0.5">
                        <input type="number" min="0" max="60" placeholder="0" value="${defaultMin || ''}" oninput="recalculateFromRepGrid('${id}')" class="rep-min-input w-7 bg-transparent text-center font-bold text-white focus:outline-none text-xs font-mono">
                        <span class="text-slate-500 font-bold text-xs">:</span>
                        <input type="number" min="0" max="59" placeholder="00" value="${defaultSec || ''}" oninput="recalculateFromRepGrid('${id}')" class="rep-sec-input w-8 bg-transparent text-center font-bold text-white focus:outline-none text-xs font-mono">
                    </div>
                </div>`;
            }
            grid.innerHTML = html;
        }

function openAlternativeModal(activityId) {
            document.getElementById('alt-activity-id').value = activityId;
            document.getElementById('alternative-activity-modal').classList.remove('hidden');
            document.getElementById('alternative-activity-modal').classList.add('flex');

            // Set default date
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            document.getElementById('alt-date').value = `${year}-${month}-${day}`;

            handleAltActivityTypeChange();
        }

function closeAlternativeModal() {
            document.getElementById('alternative-activity-modal').classList.add('hidden');
            document.getElementById('alternative-activity-modal').classList.remove('flex');

            // reset fields
            document.getElementById('alt-activity-type').value = 'run';
            document.getElementById('alt-distance').value = '';
            document.getElementById('alt-duration').value = '';
            document.getElementById('alt-pace-min').value = '';
            document.getElementById('alt-pace-sec').value = '';
            document.getElementById('alt-rpe').value = '';
        }

function handleAltActivityTypeChange() {
            const type = document.getElementById('alt-activity-type').value;
            const distContainer = document.getElementById('alt-distance-container');
            const durContainer = document.getElementById('alt-duration-container');
            const paceContainer = document.getElementById('alt-pace-container');
            const rpeContainer = document.getElementById('alt-rpe-container');

            if (['run', 'walk', 'bike', 'swim'].includes(type)) {
                distContainer.classList.remove('hidden');
                paceContainer.classList.remove('hidden');
                durContainer.classList.add('hidden');
                rpeContainer.classList.remove('hidden');
            } else if (['strength', 'other'].includes(type)) {
                distContainer.classList.add('hidden');
                paceContainer.classList.add('hidden');
                durContainer.classList.remove('hidden');
                rpeContainer.classList.remove('hidden');
            } else if (type === 'rest') {
                distContainer.classList.add('hidden');
                paceContainer.classList.add('hidden');
                durContainer.classList.add('hidden');
                rpeContainer.classList.add('hidden');
            }
        }

function submitAlternativeActivity() {
            const activityId = document.getElementById('alt-activity-id').value;
            const type = document.getElementById('alt-activity-type').value;
            const dateVal = document.getElementById('alt-date').value;
            const rpeVal = document.getElementById('alt-rpe').value;

            const updatePayload = {
                completed: true,
                actualActivityType: type,
                dateExecuted: dateVal || new Date().toISOString().split('T')[0]
            };

            if (type !== 'rest') {
                if (!rpeVal) {
                    alert("Please select an RPE score.");
                    return;
                }
                updatePayload.rpeScore = !isNaN(parseInt(rpeVal)) ? parseInt(rpeVal) : null;
            }

            if (['run', 'walk', 'bike', 'swim'].includes(type)) {
                const dist = parseFloat(document.getElementById('alt-distance').value);
                const mins = parseFloat(document.getElementById('alt-pace-min').value);
                const secs = parseFloat(document.getElementById('alt-pace-sec').value);

                if (isNaN(dist) || isNaN(mins) || isNaN(secs)) {
                    alert("Please fill out distance and pace.");
                    return;
                }
                updatePayload.actualLoggedDistance = dist;
                updatePayload.actualLoggedPace = `${mins}:${secs < 10 ? '0' + secs : secs}`;
            } else if (['strength', 'other'].includes(type)) {
                const dur = parseFloat(document.getElementById('alt-duration').value);
                if (isNaN(dur)) {
                    alert("Please fill out duration.");
                    return;
                }
                updatePayload.actualLoggedDuration = dur;
            }

            const workoutDocRef = db.collection("users").doc(userId).collection("active_phase").doc(activityId);

            workoutDocRef.update(updatePayload).then(() => {
                console.log("Alternative activity logged successfully.");
                closeAlternativeModal();
            }).catch(err => {
                console.error("Error logging alternative activity: ", err);
                alert("Firestore sync failure.");
            });
        }

function flashPaceChart() {
            const card = document.getElementById('pace-chart-card');
            if (!card) return;
            card.classList.add('border-emerald-500/80', 'bg-emerald-950/20', 'shadow-emerald-500/10');
            setTimeout(() => {
                card.classList.remove('border-emerald-500/80', 'bg-emerald-950/20', 'shadow-emerald-500/10');
            }, 1500);
        }

function autoFillIntervalTargetPace(id) {
            const avgMinInput = document.getElementById(`interval-avg-min-${id}`) || document.getElementById(`logged-min-${id}`);
            const avgSecInput = document.getElementById(`interval-avg-sec-${id}`) || document.getElementById(`logged-sec-${id}`);
            const targetMin = avgMinInput ? avgMinInput.value : "1";
            const targetSec = avgSecInput ? avgSecInput.value : "30";

            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;

            const minInputs = grid.querySelectorAll('.rep-min-input');
            const secInputs = grid.querySelectorAll('.rep-sec-input');
            minInputs.forEach(i => i.value = targetMin);
            secInputs.forEach(i => i.value = targetSec);

            recalculateFromRepGrid(id);
        }

function adjustRepCount(id, delta) {
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;
            const currentRows = grid.querySelectorAll('.rep-split-row').length;
            const newCount = Math.max(1, currentRows + delta);
            const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
            const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
            const defaultMin = avgMinInput ? avgMinInput.value : "";
            const defaultSec = avgSecInput ? avgSecInput.value : "";
            renderRepRows(id, newCount, defaultMin, defaultSec);

            const repsInput = document.getElementById(`interval-reps-input-${id}`);
            if (repsInput) repsInput.value = newCount;
            recalculateIntervalPace(id);
        }

function toggleRepSplitsDrawer(id) {
            const drawer = document.getElementById(`rep-drawer-${id}`);
            const chevron = document.getElementById(`rep-chevron-${id}`);
            if (!drawer) return;
            const isHidden = drawer.classList.contains('hidden');
            if (isHidden) {
                drawer.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            } else {
                drawer.classList.add('hidden');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            }
        }

function toggleAdvancedRepSplits(id) {
            const body = document.getElementById(`advanced-rep-body-${id}`);
            const chevron = document.getElementById(`rep-split-chevron-${id}`);
            const inputsContainer = document.getElementById(`interval-avg-inputs-container-${id}`);
            const badgeContainer = document.getElementById(`interval-avg-badge-container-${id}`);
            const badgeDisplay = document.getElementById(`interval-avg-badge-display-${id}`);

            if (!body) return;
            const isHidden = body.classList.contains('hidden');
            if (isHidden) {
                body.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
                if (inputsContainer) inputsContainer.classList.add('hidden');
                if (badgeContainer) badgeContainer.classList.remove('hidden');

                const minInput = document.getElementById(`interval-avg-min-${id}`);
                const secInput = document.getElementById(`interval-avg-sec-${id}`);
                const m = minInput ? (minInput.value || '0') : '0';
                const s = secInput ? (secInput.value || '00') : '00';
                const sFormatted = parseInt(s) < 10 ? '0' + parseInt(s) : s;
                if (badgeDisplay) badgeDisplay.innerText = `${m}:${sFormatted}`;

                recalculateFromRepGrid(id);
            } else {
                body.classList.add('hidden');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
                if (inputsContainer) inputsContainer.classList.remove('hidden');
                if (badgeContainer) badgeContainer.classList.add('hidden');
            }
        }

function recalculateFromRepGrid(id) {
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;
            const rows = grid.querySelectorAll('.rep-split-row');
            let totalSec = 0;
            let validCount = 0;

            rows.forEach(row => {
                const m = parseInt(row.querySelector('.rep-min-input')?.value || 0);
                const s = parseInt(row.querySelector('.rep-sec-input')?.value || 0);
                if (m > 0 || s > 0) {
                    totalSec += (m * 60) + s;
                    validCount++;
                }
            });

            if (validCount > 0) {
                const avgSecTotal = Math.round(totalSec / validCount);
                const avgMin = Math.floor(avgSecTotal / 60);
                const avgSec = avgSecTotal % 60;

                const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
                const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
                const formattedSec = avgSec < 10 ? '0' + avgSec : avgSec;
                if (avgMinInput) avgMinInput.value = avgMin;
                if (avgSecInput) avgSecInput.value = formattedSec;

                const badgeDisplay = document.getElementById(`interval-avg-badge-display-${id}`);
                if (badgeDisplay) badgeDisplay.innerText = `${avgMin}:${formattedSec}`;

                recalculateIntervalPace(id);
            }
        }

function parseRepDistanceInMiles(distStr) {
            if (!distStr) return 0.24855; // default 400m
            const str = distStr.toLowerCase().trim();
            const numMatch = str.match(/[\d\.]+/);
            const num = numMatch ? parseFloat(numMatch[0]) : 400;

            if (str.includes('k') || str.includes('km')) {
                return num * 0.621371;
            } else if (str.includes('m') && !str.includes('mi') && !str.includes('mile')) {
                return num * 0.000621371;
            } else if (str.includes('mi') || str.includes('mile')) {
                return num;
            }
            if (num > 50) return num * 0.000621371;
            return num;
        }

function getAccurateStrengthExerciseCount(step) {
            if (!step) return 0;
            let guidesToSearch = [];
            if (typeof userProfileData !== 'undefined' && userProfileData) {
                const isSimpleChecked = document.getElementById('simple-mode-toggle') && document.getElementById('simple-mode-toggle').checked;
                guidesToSearch = (isSimpleChecked && userProfileData.simpleStrengthGuides) ? userProfileData.simpleStrengthGuides : userProfileData.currentStrengthGuides;
            }
            if ((!guidesToSearch || guidesToSearch.length === 0) && typeof getDefaultStrengthGuides === 'function') {
                guidesToSearch = getDefaultStrengthGuides();
            }

            if (step.strengthGuideReference && guidesToSearch && guidesToSearch.length > 0) {
                const ref = step.strengthGuideReference.toLowerCase();
                const title = (step.workoutTitle || "").toLowerCase();
                
                let guide = guidesToSearch.find(g => g.id && g.id.toLowerCase() === ref);
                if (!guide) {
                    for (const letter of ['a', 'b', 'c']) {
                        if (ref.includes(`workout ${letter}`) || title.includes(`workout ${letter}`)) {
                            guide = guidesToSearch.find(g => (g.id && g.id.toLowerCase().includes(letter)) || (g.title && g.title.toLowerCase().includes(`workout ${letter}`)));
                            if (guide) break;
                        }
                    }
                }
                if (!guide) {
                    guide = guidesToSearch.find(g => g.title && g.title.toLowerCase().includes(ref));
                }
                if (!guide) {
                    guide = guidesToSearch.find(g => g.title && (ref.includes(g.title.toLowerCase()) || title.includes(g.title.toLowerCase())));
                }

                if (guide && guide.exercises && guide.exercises.length > 0) {
                    return guide.exercises.length;
                }
            }

            if (step.activities && Array.isArray(step.activities)) {
                const workActs = step.activities.filter(a => a.type === 'work');
                if (workActs.length > 0) return workActs.length;
            }
            return 4;
        }

