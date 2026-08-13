function triggerEmergencyAdaptation() {
            document.getElementById('emergency-adapt-modal').classList.remove('hidden');
            document.getElementById('emergency-override-notes').value = "";
        }

function closeEmergencyModal() {
            document.getElementById('emergency-adapt-modal').classList.add('hidden');
        }

async function submitEmergencyAdaptation() {
            if (window.isGeneratingBlock) {
                console.warn("Block generation already in progress.");
                return;
            }
            window.isGeneratingBlock = true;

            const emergencyBtn = document.getElementById('emergency-submit-btn');
            if (emergencyBtn) {
                emergencyBtn.disabled = true;
                emergencyBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Adapting...`;
                emergencyBtn.classList.add('opacity-60', 'cursor-not-allowed');
            }

            const notes = document.getElementById('emergency-override-notes').value.trim();
            closeEmergencyModal();
            showAutopilotLoader();

            const userDocRef = db.collection("users").doc(userId);

            try {
                const currentPhaseIndex = userProfileData.currentPhaseIndex || 1;

                // 1. Update Profile with new Acute Injury locally first (so it gets sent to AI)
                let newAcute = (userProfileData.acuteInjuries || "").trim();
                if (notes) {
                    newAcute = newAcute ? newAcute + " | " + notes : notes;
                }
                userProfileData.acuteInjuries = newAcute;

                // 2. Fetch recent history for AI (without completed active workouts yet, because we don't want to archive until API succeeds)
                let historySnapshot = await userDocRef.collection("history")
                    .orderBy("dateExecuted", "desc")
                    .limit(14)
                    .get();

                const recentHistory = [];
                historySnapshot.forEach(doc => recentHistory.push(doc.data()));

                // Append the locally completed active workouts to history for the AI's context
                activePhaseWorkouts.forEach(w => {
                    if (w.completed) recentHistory.push(w);
                });

                // Sanitize payloads
                const sanitizePayload = (obj) => {
                    if (obj === null || obj === undefined) return obj;
                    if (typeof obj === 'number' && isNaN(obj)) return null;
                    if (Array.isArray(obj)) return obj.map(sanitizePayload);
                    if (typeof obj === 'object') {
                        const newObj = {};
                        for (let key in obj) {
                            newObj[key] = sanitizePayload(obj[key]);
                        }
                        return newObj;
                    }
                    return obj;
                };

                const cleanProfile = sanitizePayload(userProfileData);
                const cleanHistory = sanitizePayload(recentHistory);

                // 3. Call the AI API BEFORE wiping active_phase
                const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock');
                const aiResult = await generateWorkoutBlock({
                    phaseIndex: currentPhaseIndex,
                    profile: cleanProfile,
                    history: cleanHistory
                });

                let newWorkouts = aiResult.data.workouts || [];

                // 4. If AI succeeds, NOW we safely wipe the uncompleted workouts in active_phase 
                // and archive the completed ones.
                const batchArchive = db.batch();
                activePhaseWorkouts.forEach((w) => {
                    if (w.completed) {
                        batchArchive.set(userDocRef.collection("history").doc(w.id), w);
                    }
                });

                // Fetch fresh active docs to ensure we don't miss any orphans during wipe
                const activeDocs = await userDocRef.collection("active_phase").get();
                activeDocs.forEach(doc => {
                    batchArchive.delete(doc.ref);
                });
                await batchArchive.commit();

                // 5. Save the new AI-generated workouts
                const batchWrite = db.batch();
                newWorkouts.forEach((w) => {
                    batchWrite.set(userDocRef.collection("active_phase").doc(w.id), w);
                });
                await batchWrite.commit();

                // 6. Update root user profile document
                await userDocRef.update({
                    acuteInjuries: newAcute, // Save the appended acute injury
                    journeyComments: `Adapted plan dynamically. Notes: "${notes}".`
                });

                console.log("Emergency adaptation applied via AI.");
                setTimeout(() => {
                    hideAutopilotLoader();
                }, 3000);

            } catch (err) {
                console.error("Emergency adaptation failure: ", err);
                hideAutopilotLoader();
                alert("Failed to adapt plan using AI. Your current workouts were kept safe. Error: " + err.message);
            } finally {
                window.isGeneratingBlock = false;
            }
        }

async function proceedToNextPhase() {
            if (window.isGeneratingBlock) {
                console.warn("Block generation already in progress.");
                return;
            }
            window.isGeneratingBlock = true;

            if (!userProfileData || !userProfileData.primaryGoal || !userProfileData.fitnessLevel || !userProfileData.daysAvailable) {
                alert("Your profile is missing essential details! Please go to the Profile tab and fill out all categories before generating a new training block.");
                document.getElementById('checkout-gateway-modal').classList.add('hidden');
                switchTab('profile');
                window.isGeneratingBlock = false;
                return;
            }

            const homeGenBtn = document.getElementById('gen-next-phase-btn-home');
            const checklistGenBtn = document.getElementById('gen-next-phase-btn-checklist');
            const gatewayBtn = document.getElementById('gateway-submit-btn');
            const regenBtn = document.getElementById('regenerate-block-btn');

            if (homeGenBtn) {
                homeGenBtn.disabled = true;
                homeGenBtn.className = "shrink-0 bg-slate-800 text-slate-500 border border-slate-700 px-6 py-3 rounded-xl text-xs font-bold transition-all cursor-not-allowed opacity-60 flex items-center gap-2 whitespace-nowrap";
                homeGenBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin text-indigo-400"></i> Generating Next Block...`;
            }
            if (checklistGenBtn) {
                checklistGenBtn.disabled = true;
                checklistGenBtn.className = "shrink-0 bg-slate-800 text-slate-500 border border-slate-700 px-6 py-3 rounded-xl text-xs font-bold transition-all cursor-not-allowed opacity-60 flex items-center gap-2 whitespace-nowrap";
                checklistGenBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin text-indigo-400"></i> Generating Next Block...`;
            }
            if (gatewayBtn) {
                gatewayBtn.disabled = true;
                gatewayBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Generating...`;
                gatewayBtn.classList.add('opacity-60', 'cursor-not-allowed');
            }
            if (regenBtn) {
                regenBtn.disabled = true;
                regenBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Regenerating...`;
                regenBtn.classList.add('opacity-60', 'cursor-not-allowed');
            }

            try {
                if (firebase.auth().currentUser) {
                    await firebase.auth().currentUser.getIdToken(true); // Force token refresh if backgrounded overnight
                }
            } catch (e) {
                console.warn("Token refresh failed:", e);
            }

            const notes = document.getElementById('gateway-override-notes').value.trim();
            const acuteNotes = document.getElementById('gateway-acute-injury-notes').value.trim();
            const newWeightStr = document.getElementById('gateway-weight').value;
            let newWeight = parseFloat(newWeightStr);
            let bmiHistoryUpdate = null;
            if (newWeight && !isNaN(newWeight) && userProfileData && userProfileData.heightInches) {
                const bmi = (newWeight / (userProfileData.heightInches * userProfileData.heightInches)) * 703;
                userProfileData.weight = newWeight;
                bmiHistoryUpdate = firebase.firestore.FieldValue.arrayUnion({
                    date: new Date().toISOString(),
                    weight: newWeight,
                    bmi: parseFloat(bmi.toFixed(1))
                });
            } else if (newWeight && !isNaN(newWeight)) {
                userProfileData.weight = newWeight;
            }

            userProfileData.acuteInjuries = acuteNotes;

            document.getElementById('checkout-gateway-modal').classList.add('hidden');
            showAutopilotLoader();

            const userDocRef = db.collection("users").doc(userId);
            const previousPhaseIndex = userProfileData.currentPhaseIndex || 1;

            // Fetch completed history count to evaluate block progression
            let historyCount = 0;
            try {
                const historySnap = await userDocRef.collection("history").get();
                historyCount = historySnap.size;
            } catch (e) {
                console.warn("Could not fetch history count for phase calculation", e);
            }

            const nextPhaseIndex = calculateTargetPhase(userProfileData, historyCount);

            document.getElementById('jit-checklist-container').innerHTML = `
                <div class="text-center py-8 text-slate-500 text-xs">
                    <i class="fa-solid fa-circle-notch animate-spin text-lg mb-2 block text-indigo-500"></i>
                    Generating next block of workouts...
                </div>`;

            try {
                // Compute average RPE score of this phase block to show token optimization
                const completedWithRPE = activePhaseWorkouts.filter(w => w.completed && w.rpeScore);
                const avgRpe = completedWithRPE.length ? (completedWithRPE.reduce((sum, w) => sum + w.rpeScore, 0) / completedWithRPE.length).toFixed(1) : null;

                // Prioritize the most recent GPX file from the latest completed speed workout in the active phase
                const workoutsWithFiles = activePhaseWorkouts
                    .filter(w => w.completed && w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgCadence)
                    .sort((a, b) => {
                        if (a.dateExecuted && b.dateExecuted) {
                            return new Date(b.dateExecuted) - new Date(a.dateExecuted);
                        }
                        return b.sequenceOrder - a.sequenceOrder;
                    });

                let sourceLabel = "";
                let targetCadence = null;

                if (workoutsWithFiles.length > 0) {
                    const latestWorkout = workoutsWithFiles[0];
                    targetCadence = latestWorkout.uploadedWorkoutFile.avgCadence;
                    sourceLabel = `your latest speed workout (${latestWorkout.uploadedWorkoutFile.fileName})`;
                } else if (userProfileData && userProfileData.parsedBaselineWorkout && userProfileData.parsedBaselineWorkout.avgCadence) {
                    targetCadence = userProfileData.parsedBaselineWorkout.avgCadence;
                    sourceLabel = `your baseline workout file (${userProfileData.parsedBaselineWorkout.fileName})`;
                }

                // Personalize journey comments based on cadence analysis
                let coachComments = notes ? `Next block overrides: "${notes}". ` : "";
                if (targetCadence) {
                    coachComments += `Your Flow AICoach analyzed ${sourceLabel}. Your cadence was ${targetCadence} spm. We've customized your Phase ${nextPhaseIndex} workouts to build on this, helping you scale up cadence toward 170-180 spm for your sub-20 minute run.`;
                } else {
                    coachComments += `Generating a new block for Phase ${nextPhaseIndex}. Keep executing your sequential workouts with steady pacing.`;
                }

                // Fetch recent history (up to last 14 workouts)
                // We append locally completed workouts since we haven't archived them yet.
                let historySnapshot;
                try {
                    historySnapshot = await userDocRef.collection("history")
                        .orderBy("dateExecuted", "desc")
                        .limit(14)
                        .get();
                } catch (e) {
                    throw new Error("History Fetch Error: " + e.message);
                }

                const recentHistory = [];
                historySnapshot.forEach(doc => {
                    recentHistory.push(doc.data());
                });

                activePhaseWorkouts.forEach(w => {
                    if (w.completed) recentHistory.push(w);
                });

                // Sanitize payloads to remove NaN
                const sanitizePayload = (obj) => {
                    if (obj === null || obj === undefined) return obj;
                    if (typeof obj === 'number' && isNaN(obj)) return null;
                    if (Array.isArray(obj)) return obj.map(sanitizePayload);
                    if (typeof obj === 'object') {
                        const newObj = {};
                        for (let key in obj) {
                            newObj[key] = sanitizePayload(obj[key]);
                        }
                        return newObj;
                    }
                    return obj;
                };

                const cleanProfile = sanitizePayload(userProfileData);
                const cleanHistory = sanitizePayload(recentHistory);

                // Call Firebase Cloud Function to generate AI workouts BEFORE wiping
                let nextWorkouts = [];
                try {
                    const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock');
                    const aiResult = await generateWorkoutBlock({
                        phaseIndex: nextPhaseIndex,
                        profile: cleanProfile,
                        history: cleanHistory
                    });
                    nextWorkouts = aiResult.data.workouts || [];
                    const strengthGuides = aiResult.data.strengthGuides || [];
                    const healthInsights = aiResult.data.healthInsights || null;
                    let profileUpdates = {};

                    profileUpdates.currentPhaseIndex = nextPhaseIndex;
                    profileUpdates.lastPhaseComments = notes;
                    profileUpdates.lastPhaseAverageRPE = avgRpe ? parseFloat(avgRpe) : null;
                    profileUpdates.journeyComments = coachComments;
                    profileUpdates.acuteInjuries = acuteNotes;

                    if (newWeight && !isNaN(newWeight)) {
                        profileUpdates.weight = newWeight;
                    }
                    if (bmiHistoryUpdate) {
                        profileUpdates.bmiHistory = bmiHistoryUpdate;
                    }

                    if (strengthGuides.length > 0) {
                        profileUpdates.currentStrengthGuides = strengthGuides;
                        profileUpdates.simpleStrengthGuides = firebase.firestore.FieldValue.delete();
                        const simpleToggle = document.getElementById('simple-mode-toggle');
                        if (simpleToggle) simpleToggle.checked = false;
                    }
                    if (healthInsights) {
                        profileUpdates.healthInsights = healthInsights;
                    }

                    await userDocRef.update(profileUpdates);

                } catch (error) {
                    console.error("Failed to generate AI workouts, falling back to defaults.", error);
                    alert("AI Generation Error: " + error.message + "\n\nFalling back to default workouts instead.");
                    nextWorkouts = getPhase1DefaultWorkouts();
                }

                // Only if AI succeeds do we wipe active_phase
                const batchArchive = db.batch();
                activePhaseWorkouts.forEach((w) => {
                    if (w.completed) {
                        batchArchive.set(userDocRef.collection("history").doc(w.id), w);
                    }
                });

                const activeDocs = await userDocRef.collection("active_phase").get();
                activeDocs.forEach(doc => {
                    batchArchive.delete(doc.ref);
                });
                await batchArchive.commit();

                const batchWrite = db.batch();
                nextWorkouts.forEach((w) => {
                    batchWrite.set(userDocRef.collection("active_phase").doc(w.id), w);
                });

                try {
                    await batchWrite.commit();
                } catch (e) {
                    throw new Error("Batch Write Next Workouts Error: " + e.message);
                }

                console.log(`Successfully advanced to Phase ${nextPhaseIndex}`);
                setTimeout(() => {
                    hideAutopilotLoader();
                    window.isGeneratingBlock = false;

                    if (nextPhaseIndex > previousPhaseIndex) {
                        showPhaseTransitionModal(previousPhaseIndex, nextPhaseIndex);
                    }
                }, 3000);

            } catch (err) {
                console.error("Gateway transition failure: ", err);
                hideAutopilotLoader();
                alert("Checkout Failed: " + err.message);
                window.isGeneratingBlock = false;
            }
        }

async function retryAIBlockGeneration() {
            if (!userProfileData) return;
            const currentWeek = getISOWeekString();
            let regenCount = userProfileData.regenerationCount || 0;
            const lastRegenWeek = userProfileData.lastRegenerationWeek;

            if (lastRegenWeek !== currentWeek) {
                regenCount = 0;
            }

            if (regenCount >= 3) {
                alert("You've hit your limit of 3 AI regenerations this week. Try to stick to the plan or use the Adapt Plan feature if needed!");
                return;
            }

            const confirmed = window.confirm("Are you sure you want to regenerate this block? This will replace your current workouts with a new AI-generated plan.");
            if (!confirmed) return;

            // Increment and save
            regenCount++;
            userProfileData.regenerationCount = regenCount;
            userProfileData.lastRegenerationWeek = currentWeek;

            try {
                await db.collection("users").doc(userId).update({
                    regenerationCount: regenCount,
                    lastRegenerationWeek: currentWeek
                });
            } catch (err) {
                console.error("Failed to update regeneration count", err);
            }

            const notesEl = document.getElementById('gateway-override-notes');
            if (notesEl) notesEl.value = "";
            const weightEl = document.getElementById('gateway-weight');
            if (weightEl) weightEl.value = "";

            showAutopilotLoader();

            proceedToNextPhase().catch(err => {
                console.error(err);
                alert("Failed to regenerate block.");
                hideAutopilotLoader();
            });
        }

function getPhase1DefaultWorkouts() {
            return [
                { id: "act-1", phaseNumber: 1, sequenceOrder: 1, workoutTitle: "Easy Recovery Run", type: "easy", distanceDuration: "3 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Highly relaxed base building. Keep your breathing perfectly controlled.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
                { id: "act-2", phaseNumber: 1, sequenceOrder: 2, workoutTitle: "Strength Workout A", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Hip stability and front heel lunge force from your strength library.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "A" },
                { id: "act-3", phaseNumber: 1, sequenceOrder: 3, workoutTitle: "Easy Base Run", type: "easy", distanceDuration: "3 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Smooth and steady. Focus on keeping contact time on ground minimal.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
                { id: "act-4", phaseNumber: 1, sequenceOrder: 4, workoutTitle: "Speed Session: 8 x 400m", type: "fast", distanceDuration: "30 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "8x400m intervals on Track (90s rest). Strive for a steady cadence of ~170 spm.", targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null },
                { id: "act-5", phaseNumber: 1, sequenceOrder: 5, workoutTitle: "Active Recovery Rest Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Recommended rest to allow muscle fibers to adapt and rebuild.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
                { id: "act-6", phaseNumber: 1, sequenceOrder: 6, workoutTitle: "Strength Workout C", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Stride elasticity and Achilles tendon rigidity. Use bands/calf raises.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "C" },
                { id: "act-7", phaseNumber: 1, sequenceOrder: 7, workoutTitle: "Threshold Tempo Run", type: "fast", distanceDuration: "2 Miles", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "2 Miles at threshold tempo. Comfortably hard effort.", targetPaceZone: "tempo", actualLoggedPace: null, rpeScore: null }
            ];
        }

function getPhase2DefaultWorkouts(avgCadence) {
            const cadHint = avgCadence ? `Focus on sustaining your speed cadence of ${avgCadence} spm.` : "Focus on flat footstrike and high cadence.";
            return [
                { id: "act-1", phaseNumber: 2, sequenceOrder: 1, workoutTitle: "Easy Run + Strides", type: "easy", distanceDuration: "4 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Relaxed easy run. Add 4 x 100m light strides at the end.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
                { id: "act-2", phaseNumber: 2, sequenceOrder: 2, workoutTitle: "Strength Workout B", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Posterior engine and hamstring loading. RDLs and clamshells.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "B" },
                { id: "act-3", phaseNumber: 2, sequenceOrder: 3, workoutTitle: "Rest / Active Recovery Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Complete rest. Stay hydrated and stretch.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
                { id: "act-4", phaseNumber: 2, sequenceOrder: 4, workoutTitle: "Intervals: 5 x 1000m", type: "fast", distanceDuration: "40 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: `5 repetitions at goal 5K speed with 2.5 min walking rests. ${cadHint}`, targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null },
                { id: "act-5", phaseNumber: 2, sequenceOrder: 5, workoutTitle: "Strength Workout A", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Hip stability, single-leg reverse lunges, and plank sets.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "A" },
                { id: "act-6", phaseNumber: 2, sequenceOrder: 6, workoutTitle: "Long Aerobic Base Run", type: "easy", distanceDuration: "6 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Build cardiovascular volume. Keep the pace conversational.", targetPaceZone: "long", actualLoggedPace: null, rpeScore: null },
                { id: "act-7", phaseNumber: 2, sequenceOrder: 7, workoutTitle: "Speed Capacity Check", type: "fast", distanceDuration: "45 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: `5 x 1000m intervals on Track. Focus on flat footstrike and high cadence. ${cadHint}`, targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null }
            ];
        }

function getPhase3DefaultWorkouts(avgCadence) {
            const cadHint = avgCadence ? `Focus on maintaining your stride rate of ${avgCadence} spm under fatigue.` : "Focus on flat footstrike and high cadence.";
            return [
                { id: "act-1", phaseNumber: 3, sequenceOrder: 1, workoutTitle: "Easy Recovery Run", type: "easy", distanceDuration: "4 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Slow restorative recovery jog. Keep effort very low.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
                { id: "act-2", phaseNumber: 3, sequenceOrder: 2, workoutTitle: "Strength Workout C", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Heel tendon stiffness, calf raises, and mobility stretches.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "C" },
                { id: "act-3", phaseNumber: 3, sequenceOrder: 3, workoutTitle: "Speed Test: 3 x 1.5 Miles", type: "fast", distanceDuration: "45 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: `3 x 1.5 Miles at goal pace with 3 min walking recovery. ${cadHint}`, targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null },
                { id: "act-4", phaseNumber: 3, sequenceOrder: 4, workoutTitle: "Rest / Active Recovery Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Complete restorative rest. Rehydrate and foam roll.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
                { id: "act-5", phaseNumber: 3, sequenceOrder: 5, workoutTitle: "Goal Benchmark: 3 x 1 Mile", type: "fast", distanceDuration: "35 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: `3 x 1 Mile at goal 5K pace with 3min rest. Sub-20 test day. ${cadHint}`, targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null },
                { id: "act-6", phaseNumber: 3, sequenceOrder: 6, workoutTitle: "Strength Workout B", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Deadlifts, single leg balances, and torso rotation resistance.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "B" },
                { id: "act-7", phaseNumber: 3, sequenceOrder: 7, workoutTitle: "Long Run Simulation", type: "easy", distanceDuration: "7 Miles", isSpeedWorkout: false, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "Treat this as a race rehearsal. Dial in your nutrition.", targetPaceZone: "long", actualLoggedPace: null, rpeScore: null }
            ];
        }

function calculateTargetPhase(userProfileData, completedHistoryCount = 0) {
    if (!userProfileData) return 1;
    const currentPhase = userProfileData.currentPhaseIndex || 1;
    const macroPlan = userProfileData.macrocyclePlan;

    if (!macroPlan || !Array.isArray(macroPlan) || macroPlan.length === 0) {
        return currentPhase;
    }

    const totalPhases = macroPlan.length;

    // Calculate total completed 7-workout blocks (plus the 1 block just completed/checked out)
    const completedBlocks = Math.floor((completedHistoryCount || 0) / 7) + 1;

    let cumulativeWeeks = 0;
    let targetPhase = 1;

    for (let i = 0; i < totalPhases; i++) {
        const phaseObj = macroPlan[i];
        const phaseDuration = phaseObj.expectedDurationWeeks || 4;
        cumulativeWeeks += phaseDuration;

        if (completedBlocks > (cumulativeWeeks - phaseDuration)) {
            targetPhase = phaseObj.phase || (i + 1);
        }
    }

    // Check calendar target date milestone for current phase
    if (userProfileData.journeyStartDate) {
        const startDate = new Date(userProfileData.journeyStartDate);
        const now = new Date();
        const elapsedWeeks = Math.floor((now - startDate) / (7 * 24 * 60 * 60 * 1000));

        let accumulatedTargetWeeks = 0;
        for (let i = 0; i < currentPhase; i++) {
            const phaseObj = macroPlan[i] || {};
            accumulatedTargetWeeks += (phaseObj.expectedDurationWeeks || 4);
        }

        if (elapsedWeeks >= accumulatedTargetWeeks && currentPhase < totalPhases) {
            targetPhase = Math.max(targetPhase, currentPhase + 1);
        }
    }

    const calculatedIndex = Math.min(totalPhases, Math.max(1, targetPhase));

    // Clamp advancement to at most +1 phase per block generation cycle to prevent skipping
    if (calculatedIndex > currentPhase) {
        return currentPhase + 1;
    }

    return currentPhase;
}


