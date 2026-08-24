function submitWorkout(activityId, isBenchmark, defaultType, cbElement) {
            const hasDistInput = !!document.getElementById(`logged-distance-${activityId}`);
            const isDistType = hasDistInput || ['run', 'walk', 'bike', 'swim', 'easy', 'fast', 'long', 'tempo', 'interval', 'recovery', 'base', 'aerobic'].includes(defaultType?.toLowerCase());
            const typeClass = isDistType ? 'distance' : 'duration';

            const rpeSelect = document.getElementById(`logged-rpe-${activityId}`);
            const warning = document.getElementById(`gatekeeper-warn-${activityId}`);
            const rpeVal = rpeSelect ? rpeSelect.value : null;

            const hrInputEl = document.getElementById(`logged-hr-${activityId}`);
            const hrVal = hrInputEl ? hrInputEl.value : null;

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
                    actualHeartRate: (hrVal && !isNaN(parseInt(hrVal))) ? parseInt(hrVal) : null,
                    effortZone: (rpeVal && !isNaN(parseInt(rpeVal))) ? parseInt(rpeVal) : null,
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
                effortZone: 5
            }).then(() => {
                console.log("Quick completed workout:", activityId);
            }).catch(err => {
                console.error("Quick completion error:", err);
            });
        }

function getIntervalMetadata(workout) {
            if (!workout) return null;

            // 1. Check direct structured properties on workout object
            if (workout.intervalRepCount && (workout.intervalWorkValue || workout.workoutCategory === 'intervals')) {
                const repCount = parseInt(workout.intervalRepCount) || 1;
                const workVal = parseFloat(workout.intervalWorkValue) || 1;
                const rawUnit = (workout.intervalWorkUnit || '').toLowerCase();
                const intervalType = workout.intervalType ? workout.intervalType.toLowerCase() : (rawUnit.includes('min') || rawUnit.includes('sec') ? 'time' : 'distance');
                const restSec = typeof workout.intervalRestSeconds === 'number' ? workout.intervalRestSeconds : 60;
                const targetPaceStr = (typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(workout.intervalTargetPace || workout.targetPaceZone || "7:15") : (workout.intervalTargetPace || "7:15"));
                const targetPaceSec = typeof paceStringToSeconds === 'function' ? paceStringToSeconds(targetPaceStr) : 435;
                const targetPaceMin = Math.floor(targetPaceSec / 60);
                const targetPaceSeconds = targetPaceSec % 60;
                const targetPaceSecStr = targetPaceSeconds < 10 ? '0' + targetPaceSeconds : String(targetPaceSeconds);

                let repDistanceMiles = 0.24855; // 400m default
                let repDurationSeconds = 120;
                let repLabel = "";

                if (intervalType === 'time') {
                    repDurationSeconds = rawUnit.includes('sec') ? workVal : Math.round(workVal * 60);
                    const repMins = repDurationSeconds / 60;
                    const paceMins = targetPaceSec / 60;
                    repDistanceMiles = paceMins > 0 ? (repMins / paceMins) : 0.70;
                    const repM = Math.floor(repDurationSeconds / 60);
                    const repS = repDurationSeconds % 60;
                    repLabel = repS > 0 ? `${repM}:${repS < 10 ? '0' + repS : repS} min` : `${repM} min`;

                    const repDurMin = Math.floor(repDurationSeconds / 60);
                    const repDurSec = repDurationSeconds % 60;
                    const repDurSecStr = repDurSec < 10 ? '0' + repDurSec : String(repDurSec);

                    return {
                        isInterval: true,
                        repCount: repCount,
                        intervalType: 'time',
                        workValue: workVal,
                        workUnit: rawUnit || 'mins',
                        restSeconds: restSec,
                        repDistance: repLabel,
                        repDistanceMiles: repDistanceMiles,
                        repDurationSeconds: repDurationSeconds,
                        targetPace: targetPaceStr,
                        targetPaceSec: targetPaceSec,
                        defaultPaceMin: targetPaceMin,
                        defaultPaceSec: targetPaceSecStr,
                        defaultSplitMin: targetPaceMin,
                        defaultSplitSec: targetPaceSecStr,
                        defaultDurMin: repDurMin,
                        defaultDurSec: repDurSecStr,
                        defaultDistVal: workVal,
                        defaultDistUnit: 'min'
                    };
                } else {
                    if (rawUnit.includes('k')) repDistanceMiles = workVal * 0.621371;
                    else if (rawUnit.includes('mi')) repDistanceMiles = workVal;
                    else if (rawUnit.includes('m') || workVal > 50) repDistanceMiles = workVal * 0.000621371;
                    repDurationSeconds = Math.round(repDistanceMiles * targetPaceSec);
                    repLabel = `${workVal}${rawUnit || 'm'}`;

                    const defaultMin = Math.floor(repDurationSeconds / 60);
                    const defaultSec = repDurationSeconds % 60;

                    return {
                        isInterval: true,
                        repCount: repCount,
                        intervalType: 'distance',
                        workValue: workVal,
                        workUnit: rawUnit || 'm',
                        restSeconds: restSec,
                        repDistance: repLabel,
                        repDistanceMiles: repDistanceMiles,
                        repDurationSeconds: repDurationSeconds,
                        targetPace: targetPaceStr,
                        targetPaceSec: targetPaceSec,
                        defaultPaceMin: targetPaceMin,
                        defaultPaceSec: targetPaceSecStr,
                        defaultSplitMin: defaultMin,
                        defaultSplitSec: defaultSec < 10 ? '0' + defaultSec : String(defaultSec),
                        defaultDurMin: defaultMin,
                        defaultDurSec: defaultSec < 10 ? '0' + defaultSec : String(defaultSec),
                        defaultDistVal: workVal,
                        defaultDistUnit: rawUnit || 'm'
                    };
                }
            }

            // 2. Check activities array
            if (workout.activities && Array.isArray(workout.activities)) {
                const workAct = workout.activities.find(a => a.type === 'work' || (!a.type && !/warm|prep|cool|stretch/i.test(a.name)));
                if (workAct && (workAct.sets > 1 || (workAct.targetValue && workAct.sets > 1) || (workAct.repsDistanceTime && workAct.sets > 1))) {
                    const repCount = parseInt(workAct.sets) || 1;
                    const targetPaceStr = typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(workAct.targetPace || workout.targetPaceZone || "7:15") : "7:15";
                    const targetPaceSec = typeof paceStringToSeconds === 'function' ? paceStringToSeconds(targetPaceStr) : 435;
                    const targetPaceMin = Math.floor(targetPaceSec / 60);
                    const targetPaceSeconds = targetPaceSec % 60;
                    const targetPaceSecStr = targetPaceSeconds < 10 ? '0' + targetPaceSeconds : String(targetPaceSeconds);
                    const restSec = typeof workAct.restSeconds === 'number' ? workAct.restSeconds : (typeof workout.intervalRestSeconds === 'number' ? workout.intervalRestSeconds : 60);

                    const timeMatch = (workAct.repsDistanceTime || '').match(/(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|min)/i);
                    const distMatch = (workAct.repsDistanceTime || '').match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|mi|miles?|km|k)/i);

                    if (workAct.targetType === 'time' || timeMatch) {
                        const workVal = workAct.targetValue || (timeMatch ? parseFloat(timeMatch[1]) : 5);
                        const repDurationSeconds = Math.round(workVal * 60);
                        const paceMins = targetPaceSec / 60;
                        const repDistanceMiles = paceMins > 0 ? (workVal / paceMins) : 0.70;
                        const repM = Math.floor(repDurationSeconds / 60);
                        const repS = repDurationSeconds % 60;
                        const repLabel = repS > 0 ? `${repM}:${repS < 10 ? '0' + repS : repS} min` : `${repM} min`;
                        const repDurSecStr = repS < 10 ? '0' + repS : String(repS);

                        return {
                            isInterval: true,
                            repCount: repCount,
                            intervalType: 'time',
                            workValue: workVal,
                            workUnit: 'mins',
                            restSeconds: restSec,
                            repDistance: repLabel,
                            repDistanceMiles: repDistanceMiles,
                            repDurationSeconds: repDurationSeconds,
                            targetPace: targetPaceStr,
                            targetPaceSec: targetPaceSec,
                            defaultPaceMin: targetPaceMin,
                            defaultPaceSec: targetPaceSecStr,
                            defaultSplitMin: targetPaceMin,
                            defaultSplitSec: targetPaceSecStr,
                            defaultDurMin: repM,
                            defaultDurSec: repDurSecStr,
                            defaultDistVal: workVal,
                            defaultDistUnit: 'min'
                        };
                    } else if (workAct.targetType === 'distance' || distMatch) {
                        const workVal = workAct.targetValue || (distMatch ? parseFloat(distMatch[1]) : 400);
                        const rawUnit = workAct.targetUnit || (distMatch ? distMatch[0].replace(/[\d\.]+/g, '').trim() : 'm');
                        const repDistanceMiles = parseRepDistanceInMiles(`${workVal}${rawUnit}`);
                        const repDurationSeconds = Math.round(repDistanceMiles * targetPaceSec);
                        const defaultMin = Math.floor(repDurationSeconds / 60);
                        const defaultSec = repDurationSeconds % 60;

                        return {
                            isInterval: true,
                            repCount: repCount,
                            intervalType: 'distance',
                            workValue: workVal,
                            workUnit: rawUnit,
                            restSeconds: restSec,
                            repDistance: `${workVal}${rawUnit}`,
                            repDistanceMiles: repDistanceMiles,
                            repDurationSeconds: repDurationSeconds,
                            targetPace: targetPaceStr,
                            targetPaceSec: targetPaceSec,
                            defaultPaceMin: targetPaceMin,
                            defaultPaceSec: targetPaceSecStr,
                            defaultSplitMin: defaultMin,
                            defaultSplitSec: defaultSec < 10 ? '0' + defaultSec : String(defaultSec),
                            defaultDurMin: defaultMin,
                            defaultDurSec: defaultSec < 10 ? '0' + defaultSec : String(defaultSec),
                            defaultDistVal: workVal,
                            defaultDistUnit: rawUnit || 'm'
                        };
                    }
                }
            }

            // 3. Fallback to Legacy Regex Parsing
            const textToSearch = `${workout.workoutTitle || ''} ${workout.targetInstructions || ''}`;
            const match = textToSearch.match(/(\d+)\s*x\s*([\d\.]+\s*(?:mins?|minutes?|min|m|meters?|mi|miles?|k|km)?)/i);
            if (match) {
                const count = parseInt(match[1]);
                const rawDistOrTime = match[2].trim();
                if (count && count > 1) {
                    const isTime = /min|minute/i.test(rawDistOrTime);
                    const num = parseFloat(rawDistOrTime) || (isTime ? 5 : 400);
                    const targetPaceStr = typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(workout.targetPaceZone || "7:15") : "7:15";
                    const targetPaceSec = typeof paceStringToSeconds === 'function' ? paceStringToSeconds(targetPaceStr) : 435;
                    const targetPaceMin = Math.floor(targetPaceSec / 60);
                    const targetPaceSeconds = targetPaceSec % 60;
                    const targetPaceSecStr = targetPaceSeconds < 10 ? '0' + targetPaceSeconds : String(targetPaceSeconds);

                    let repDistMiles = 0.24855;
                    let repDurSec = 120;
                    let repLabel = "";
                    let repM = 5, repS = 0;
                    if (isTime) {
                        repDurSec = Math.round(num * 60);
                        repDistMiles = (num) / (targetPaceSec / 60);
                        repM = Math.floor(repDurSec / 60);
                        repS = repDurSec % 60;
                        repLabel = repS > 0 ? `${repM}:${repS < 10 ? '0' + repS : repS} min` : `${repM} min`;
                    } else {
                        repDistMiles = parseRepDistanceInMiles(rawDistOrTime);
                        repDurSec = Math.round(repDistMiles * targetPaceSec);
                        repLabel = rawDistOrTime;
                    }

                    const defaultMin = isTime ? targetPaceMin : Math.floor(repDurSec / 60);
                    const defaultSec = isTime ? targetPaceSecStr : (repDurSec % 60 < 10 ? '0' + (repDurSec % 60) : String(repDurSec % 60));

                    return {
                        isInterval: true,
                        repCount: count,
                        intervalType: isTime ? 'time' : 'distance',
                        workValue: num,
                        workUnit: isTime ? 'mins' : 'm',
                        restSeconds: 60,
                        repDistance: repLabel,
                        repDistanceMiles: repDistMiles,
                        repDurationSeconds: repDurSec,
                        targetPace: targetPaceStr,
                        targetPaceSec: targetPaceSec,
                        defaultPaceMin: targetPaceMin,
                        defaultPaceSec: targetPaceSecStr,
                        defaultSplitMin: defaultMin,
                        defaultSplitSec: defaultSec,
                        defaultDurMin: isTime ? repM : defaultMin,
                        defaultDurSec: isTime ? (repS < 10 ? '0' + repS : String(repS)) : defaultSec,
                        defaultDistVal: num,
                        defaultDistUnit: isTime ? 'min' : 'm'
                    };
                }
            }
            return null;
        }

function recalculateIntervalPace(id, syncToGrid = false) {
            const repsInput = document.getElementById(`interval-reps-input-${id}`);
            const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
            const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
            const durMinInput = document.getElementById(`interval-dur-min-${id}`);
            const durSecInput = document.getElementById(`interval-dur-sec-${id}`);
            const distValInput = document.getElementById(`interval-dist-val-${id}`);
            
            const calculatedPaceDisplay = document.getElementById(`calculated-pace-display-${id}`);
            const calculatedDistDisplay = document.getElementById(`calculated-dist-display-${id}`);

            const loggedDistInput = document.getElementById(`logged-distance-${id}`);
            const loggedMinInput = document.getElementById(`logged-min-${id}`);
            const loggedSecInput = document.getElementById(`logged-sec-${id}`);

            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === id) : null;
            const intervalMeta = getIntervalMetadata(workout);

            const reps = repsInput ? parseInt(repsInput.value) || 1 : (intervalMeta ? intervalMeta.repCount : 1);
            const avgMin = avgMinInput ? parseInt(avgMinInput.value) || 0 : 0;
            const avgSec = avgSecInput ? parseInt(avgSecInput.value) || 0 : 0;
            const totalPaceSec = (avgMin * 60) + avgSec;

            let totalDistMiles = 0;
            let paceMin = 7, paceSec = 15;
            let paceStr = "--:--";

            if (intervalMeta && intervalMeta.intervalType === 'time') {
                // Time-based interval: avgMin and avgSec are the RUNNER'S PACE (min/mile)
                const enteredPaceSec = totalPaceSec > 0 ? totalPaceSec : (intervalMeta.targetPaceSec || 435);
                paceMin = Math.floor(enteredPaceSec / 60);
                paceSec = enteredPaceSec % 60;
                paceStr = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec}`;

                const paceMins = enteredPaceSec / 60;
                
                let repDurationSeconds = intervalMeta.repDurationSeconds || 300;
                if (durMinInput && durSecInput) {
                    const enteredDurSec = (parseInt(durMinInput.value) || 0) * 60 + (parseInt(durSecInput.value) || 0);
                    if (enteredDurSec > 0) repDurationSeconds = enteredDurSec;
                }
                const repDurationMins = repDurationSeconds / 60;
                const milesPerRep = paceMins > 0 ? (repDurationMins / paceMins) : 0.70;
                totalDistMiles = reps * milesPerRep;
            } else {
                // Distance-based interval: avgMin and avgSec are the AVG REP TIME (e.g. 1:30 for 400m)
                let repDistMiles = intervalMeta ? intervalMeta.repDistanceMiles : parseRepDistanceInMiles("400m");
                if (distValInput && distValInput.value) {
                    const rawVal = parseFloat(distValInput.value);
                    if (!isNaN(rawVal) && rawVal > 0) {
                        repDistMiles = parseRepDistanceInMiles(`${rawVal}${intervalMeta?.workUnit || 'm'}`);
                    }
                }
                totalDistMiles = reps * repDistMiles;

                if (totalPaceSec > 0 && repDistMiles > 0) {
                    const paceSecPerMile = Math.round(totalPaceSec / repDistMiles);
                    paceMin = Math.floor(paceSecPerMile / 60);
                    paceSec = paceSecPerMile % 60;
                    paceStr = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec}`;
                }
            }

            if (totalDistMiles > 0) {
                if (calculatedPaceDisplay) calculatedPaceDisplay.innerText = `~${paceStr} /mi`;
                if (calculatedDistDisplay) calculatedDistDisplay.innerText = `${totalDistMiles.toFixed(2)} mi`;

                if (loggedDistInput) loggedDistInput.value = totalDistMiles.toFixed(2);
                if (loggedMinInput) loggedMinInput.value = paceMin;
                if (loggedSecInput) loggedSecInput.value = paceSec < 10 ? '0' + paceSec : paceSec;
            } else {
                if (calculatedPaceDisplay) calculatedPaceDisplay.innerText = `--:-- /mi`;
                if (calculatedDistDisplay) calculatedDistDisplay.innerText = `-- mi`;
            }

            // Sync down to advanced rep rows if requested or if rep count changed
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (grid) {
                const currentRows = grid.querySelectorAll('.rep-split-row').length;
                if (currentRows !== reps) {
                    renderRepRows(id, reps);
                } else if (syncToGrid) {
                    if (durMinInput && durSecInput) {
                        grid.querySelectorAll('.rep-dur-min-input').forEach(i => i.value = durMinInput.value);
                        grid.querySelectorAll('.rep-dur-sec-input').forEach(i => i.value = durSecInput.value);
                    }
                    if (distValInput) {
                        grid.querySelectorAll('.rep-dist-val-input').forEach(i => i.value = distValInput.value);
                    }
                    if (avgMinInput && avgSecInput) {
                        grid.querySelectorAll('.rep-pace-min-input, .rep-min-input').forEach(i => i.value = avgMinInput.value);
                        grid.querySelectorAll('.rep-pace-sec-input, .rep-sec-input').forEach(i => i.value = avgSecInput.value);
                    }
                }
            }
        }

function renderRepRows(id, repCount, defaultPaceMin, defaultPaceSec, defaultDurMin, defaultDurSec, defaultDistVal, defaultDistUnit) {
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;

            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === id) : null;
            const intervalMeta = getIntervalMetadata(workout);
            const isTimeInterval = intervalMeta ? intervalMeta.intervalType === 'time' : true;

            const pMin = defaultPaceMin !== undefined && defaultPaceMin !== null ? defaultPaceMin : (document.getElementById(`interval-avg-min-${id}`)?.value || intervalMeta?.defaultPaceMin || 7);
            const pSec = defaultPaceSec !== undefined && defaultPaceSec !== null ? defaultPaceSec : (document.getElementById(`interval-avg-sec-${id}`)?.value || intervalMeta?.defaultPaceSec || "15");

            const dMin = defaultDurMin !== undefined && defaultDurMin !== null ? defaultDurMin : (document.getElementById(`interval-dur-min-${id}`)?.value || intervalMeta?.defaultDurMin || 5);
            const dSec = defaultDurSec !== undefined && defaultDurSec !== null ? defaultDurSec : (document.getElementById(`interval-dur-sec-${id}`)?.value || intervalMeta?.defaultDurSec || "15");

            const dVal = defaultDistVal !== undefined && defaultDistVal !== null ? defaultDistVal : (document.getElementById(`interval-dist-val-${id}`)?.value || intervalMeta?.defaultDistVal || 400);
            const dUnit = defaultDistUnit || intervalMeta?.defaultDistUnit || (isTimeInterval ? 'min' : 'm');

            let html = '';
            for (let i = 1; i <= repCount; i++) {
                html += `
                <div class="rep-split-row grid grid-cols-[48px_1fr_1fr] items-center gap-2 w-full px-2 py-0.5">
                    <!-- Col 1: Rep Number Label (Read-only) -->
                    <div class="flex items-center justify-start">
                        <span class="font-bold text-amber-400 font-mono text-xs pl-1 select-none">R${i}</span>
                    </div>
                    
                    <!-- Col 2: Rep Duration / Distance -->
                    <div class="flex items-center justify-center">
                        <div class="flex items-center justify-center gap-0.5 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-0.5">
                            ${isTimeInterval ? `
                                <input type="number" min="0" max="120" value="${dMin}" oninput="recalculateFromRepGrid('${id}')" class="rep-dur-min-input w-7 sm:w-8 bg-transparent text-center font-bold text-white focus:outline-none text-xs font-mono" title="R${i} Duration Minutes">
                                <span class="text-slate-500 font-bold text-xs">:</span>
                                <input type="number" min="0" max="59" value="${dSec}" oninput="recalculateFromRepGrid('${id}')" class="rep-dur-sec-input w-7 sm:w-8 bg-transparent text-center font-bold text-white focus:outline-none text-xs font-mono" title="R${i} Duration Seconds">
                                <span class="text-[9px] text-slate-400 font-bold uppercase ml-0.5 select-none">min</span>
                            ` : `
                                <input type="number" min="0" step="any" value="${dVal}" oninput="recalculateFromRepGrid('${id}')" class="rep-dist-val-input w-10 sm:w-12 bg-transparent text-center font-bold text-white focus:outline-none text-xs font-mono" title="R${i} Distance">
                                <span class="text-[9px] text-slate-400 font-bold uppercase ml-0.5 select-none">${dUnit}</span>
                            `}
                        </div>
                    </div>

                    <!-- Col 3: Rep Pace / Time -->
                    <div class="flex items-center justify-center">
                        <div class="flex items-center justify-center gap-0.5 bg-indigo-950/30 border border-indigo-500/20 rounded-lg px-2 py-0.5">
                            <input type="number" min="0" max="60" value="${pMin}" oninput="recalculateFromRepGrid('${id}')" class="rep-pace-min-input rep-min-input w-7 sm:w-8 bg-transparent text-center font-bold text-indigo-100 focus:outline-none text-xs font-mono" title="R${i} Pace Minutes">
                            <span class="text-indigo-400/60 font-bold text-xs">:</span>
                            <input type="number" min="0" max="59" value="${pSec}" oninput="recalculateFromRepGrid('${id}')" class="rep-pace-sec-input rep-sec-input w-7 sm:w-8 bg-transparent text-center font-bold text-indigo-100 focus:outline-none text-xs font-mono" title="R${i} Pace Seconds">
                            <span class="text-[9px] text-indigo-400/80 font-bold uppercase ml-0.5 select-none">${isTimeInterval ? '/mi' : 'time'}</span>
                        </div>
                    </div>
                </div>`;
            }
            grid.innerHTML = html;
            if (typeof initTouchWheelInputs === 'function') {
                initTouchWheelInputs(grid);
            }
        }

function openAlternativeModal(activityId) {
            document.getElementById('alt-activity-id').value = activityId;
            document.getElementById('alternative-activity-modal').classList.remove('hidden');
            document.getElementById('alternative-activity-modal').classList.add('flex');

            // Pre-fill targetRPE if available
            const workout = typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts.find(w => w.id === activityId) : null;
            const targetRPE = workout?.targetRPE || 2;
            const rpeSelect = document.getElementById('alt-rpe');
            if (rpeSelect) rpeSelect.value = String(targetRPE);

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
            const rpeLabel = document.getElementById('alt-rpe-label');
            const rpeTooltip = document.getElementById('alt-rpe-tooltip');

            if (['run', 'walk', 'bike', 'swim'].includes(type)) {
                distContainer.classList.remove('hidden');
                paceContainer.classList.remove('hidden');
                durContainer.classList.add('hidden');
                rpeContainer.classList.remove('hidden');
                if (rpeLabel) rpeLabel.childNodes[0].nodeValue = "Cardio Effort (Zone 1-5) ";
                if (rpeTooltip) rpeTooltip.title = "Cardio intensity: Zone 1 (Recovery) to Zone 5 (Max Effort).";
            } else if (['strength', 'other'].includes(type)) {
                distContainer.classList.add('hidden');
                paceContainer.classList.add('hidden');
                durContainer.classList.remove('hidden');
                rpeContainer.classList.remove('hidden');
                if (rpeLabel) rpeLabel.childNodes[0].nodeValue = "Muscle Exertion (Zone 1-5) ";
                if (rpeTooltip) rpeTooltip.title = "Muscular fatigue: Zone 1 (Light Weight) to Zone 5 (Failure).";
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
                updatePayload.effortZone = !isNaN(parseInt(rpeVal)) ? parseInt(rpeVal) : null;
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
            const durMinInput = document.getElementById(`interval-dur-min-${id}`);
            const durSecInput = document.getElementById(`interval-dur-sec-${id}`);
            const distValInput = document.getElementById(`interval-dist-val-${id}`);

            const targetPaceMin = avgMinInput ? avgMinInput.value : "7";
            const targetPaceSec = avgSecInput ? avgSecInput.value : "15";
            const targetDurMin = durMinInput ? durMinInput.value : "5";
            const targetDurSec = durSecInput ? durSecInput.value : "15";
            const targetDistVal = distValInput ? distValInput.value : "400";

            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;

            grid.querySelectorAll('.rep-pace-min-input, .rep-min-input').forEach(i => i.value = targetPaceMin);
            grid.querySelectorAll('.rep-pace-sec-input, .rep-sec-input').forEach(i => i.value = targetPaceSec);
            grid.querySelectorAll('.rep-dur-min-input').forEach(i => i.value = targetDurMin);
            grid.querySelectorAll('.rep-dur-sec-input').forEach(i => i.value = targetDurSec);
            grid.querySelectorAll('.rep-dist-val-input').forEach(i => i.value = targetDistVal);

            recalculateFromRepGrid(id);
        }

function adjustRepCount(id, delta) {
            const grid = document.getElementById(`rep-rows-grid-${id}`);
            if (!grid) return;
            const currentRows = grid.querySelectorAll('.rep-split-row').length;
            const newCount = Math.max(1, currentRows + delta);
            renderRepRows(id, newCount);

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

            const workout = activePhaseWorkouts ? activePhaseWorkouts.find(w => w.id === id) : null;
            const intervalMeta = getIntervalMetadata(workout);
            const isTimeInterval = intervalMeta ? intervalMeta.intervalType === 'time' : true;

            const rows = grid.querySelectorAll('.rep-split-row');
            let totalPaceSec = 0;
            let totalDurSec = 0;
            let totalDistSum = 0;
            let validCount = 0;

            rows.forEach(row => {
                const pMin = parseInt(row.querySelector('.rep-pace-min-input, .rep-min-input')?.value || 0);
                const pSec = parseInt(row.querySelector('.rep-pace-sec-input, .rep-sec-input')?.value || 0);
                const repPaceSec = (pMin * 60) + pSec;

                if (isTimeInterval) {
                    const dMin = parseInt(row.querySelector('.rep-dur-min-input')?.value || 0);
                    const dSec = parseInt(row.querySelector('.rep-dur-sec-input')?.value || 0);
                    const repDurSec = (dMin * 60) + dSec;

                    if (repPaceSec > 0 && repDurSec > 0) {
                        totalPaceSec += repPaceSec;
                        totalDurSec += repDurSec;
                        const repDistMiles = (repDurSec / 60) / (repPaceSec / 60);
                        totalDistSum += repDistMiles;
                        validCount++;
                    }
                } else {
                    const distVal = parseFloat(row.querySelector('.rep-dist-val-input')?.value || 0);
                    if (distVal > 0) {
                        const repDistMiles = parseRepDistanceInMiles(`${distVal}${intervalMeta?.workUnit || 'm'}`);
                        totalDistSum += repDistMiles;
                        if (repPaceSec > 0) {
                            totalPaceSec += repPaceSec;
                            validCount++;
                        }
                    }
                }
            });

            if (validCount > 0) {
                const avgPaceSecTotal = Math.round(totalPaceSec / validCount);
                const avgPaceMin = Math.floor(avgPaceSecTotal / 60);
                const avgPaceSec = avgPaceSecTotal % 60;
                const formattedPaceSec = avgPaceSec < 10 ? '0' + avgPaceSec : String(avgPaceSec);

                const avgMinInput = document.getElementById(`interval-avg-min-${id}`);
                const avgSecInput = document.getElementById(`interval-avg-sec-${id}`);
                if (avgMinInput) avgMinInput.value = avgPaceMin;
                if (avgSecInput) avgSecInput.value = formattedPaceSec;

                const badgeDisplay = document.getElementById(`interval-avg-badge-display-${id}`);
                if (badgeDisplay) badgeDisplay.innerText = `${avgPaceMin}:${formattedPaceSec}`;

                if (isTimeInterval) {
                    const avgDurSecTotal = Math.round(totalDurSec / validCount);
                    const avgDurMin = Math.floor(avgDurSecTotal / 60);
                    const avgDurSec = avgDurSecTotal % 60;
                    const formattedDurSec = avgDurSec < 10 ? '0' + avgDurSec : String(avgDurSec);

                    const durMinInput = document.getElementById(`interval-dur-min-${id}`);
                    const durSecInput = document.getElementById(`interval-dur-sec-${id}`);
                    if (durMinInput) durMinInput.value = avgDurMin;
                    if (durSecInput) durSecInput.value = formattedDurSec;
                }

                // Update hidden submission inputs
                const loggedDistInput = document.getElementById(`logged-distance-${id}`);
                const loggedMinInput = document.getElementById(`logged-min-${id}`);
                const loggedSecInput = document.getElementById(`logged-sec-${id}`);

                if (loggedDistInput) loggedDistInput.value = totalDistSum.toFixed(2);
                if (loggedMinInput) loggedMinInput.value = avgPaceMin;
                if (loggedSecInput) loggedSecInput.value = formattedPaceSec;
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

