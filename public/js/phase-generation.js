function triggerEmergencyAdaptation() {
            document.getElementById('emergency-adapt-modal').classList.remove('hidden');
            document.getElementById('emergency-override-notes').value = "";
        }

function closeEmergencyModal() {
            document.getElementById('emergency-adapt-modal').classList.add('hidden');
        }

async function buildEliteCoachPayload(userDocRef, activeWorkouts, userProfile) {
    // 1. Fetch recent history (pull up to 28 completed workouts to cover the last month of activity)
    let historySnapshot = null;
    try {
        historySnapshot = await userDocRef.collection("history")
            .orderBy("dateExecuted", "desc")
            .limit(28)
            .get();
    } catch (e) {
        console.warn("History fetch warning:", e);
    }

    const allCompletedMap = new Map();

    // Add past history items
    if (historySnapshot) {
        historySnapshot.forEach(doc => {
            const data = doc.data();
            if (data && (data.completed || data.dateExecuted)) {
                allCompletedMap.set(data.id || doc.id, { ...data, id: data.id || doc.id });
            }
        });
    }

    // Add/override active phase completed workouts
    if (Array.isArray(activeWorkouts)) {
        activeWorkouts.forEach(w => {
            if (w && w.completed) {
                allCompletedMap.set(w.id, w);
            }
        });
    }

    const allCompletedList = Array.from(allCompletedMap.values());
    // Sort chronologically (oldest to newest)
    allCompletedList.sort((a, b) => {
        const timeA = a.dateExecuted ? parseLocalDate(a.dateExecuted).getTime() : 0;
        const timeB = b.dateExecuted ? parseLocalDate(b.dateExecuted).getTime() : 0;
        return timeA - timeB;
    });

    // Take the most recent 14 completed workouts (representing the last 2 completed training blocks)
    const recentCompleted = allCompletedList.slice(-14);

    // 2. Extract clean, lightweight, ground-truth workout summaries (strip DOM, trackpoints, heavy exercise arrays)
    const sanitizedHistory = recentCompleted.map(w => {
        const type = (w.type || w.actualActivityType || 'run').toLowerCase();
        const workoutCategory = w.workoutCategory || (type === 'strength' ? 'strength' : (type === 'rest' ? 'rest' : 'continuous_run'));

        // Distance & duration resolution
        let actualDist = null;
        if (w.actualLoggedDistance !== null && w.actualLoggedDistance !== undefined && w.actualLoggedDistance !== "") {
            actualDist = parseFloat(w.actualLoggedDistance);
        } else if (w.uploadedWorkoutFile && w.uploadedWorkoutFile.totalDistanceMeters) {
            actualDist = parseFloat((w.uploadedWorkoutFile.totalDistanceMeters / 1609.344).toFixed(2));
        }

        let actualDur = null;
        if (w.actualLoggedDuration !== null && w.actualLoggedDuration !== undefined && w.actualLoggedDuration !== "") {
            actualDur = parseFloat(w.actualLoggedDuration);
        } else if (w.uploadedWorkoutFile && w.uploadedWorkoutFile.duration) {
            actualDur = Math.round(parseFloat(w.uploadedWorkoutFile.duration) / 60);
        }

        // Heart rate & zone
        const avgHr = (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgHeartRate) || w.actualHeartRate || w.rawHr || null;

        return {
            id: w.id,
            dateExecuted: w.dateExecuted || null,
            workoutTitle: w.workoutTitle || "Workout",
            type: type,
            workoutCategory: workoutCategory,
            actualLoggedPace: w.actualLoggedPace || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgPace) || null,
            actualLoggedDistance: actualDist,
            targetDistance: w.targetDistance ? parseFloat(w.targetDistance) : null,
            actualLoggedDuration: actualDur,
            targetDuration: w.targetDuration ? parseFloat(w.targetDuration) : null,
            avgHeartRate: avgHr ? Math.round(avgHr) : null,
            effortZone: w.effortZone || null,
            rpeScore: w.rpeScore ? parseInt(w.rpeScore) : null,
            intervalRepCount: w.intervalRepCount ? parseInt(w.intervalRepCount) : null,
            intervalWorkValue: w.intervalWorkValue ? parseFloat(w.intervalWorkValue) : null,
            intervalWorkUnit: w.intervalWorkUnit || null,
            intervalRestSeconds: w.intervalRestSeconds ? parseInt(w.intervalRestSeconds) : null,
            repSplits: Array.isArray(w.repSplits) ? w.repSplits : null,
            circuitRounds: w.circuitRounds ? parseInt(w.circuitRounds) : null,
            isCircuit: Boolean(w.isCircuit),
            userWorkoutNotes: w.userWorkoutNotes ? String(w.userWorkoutNotes).trim().slice(0, 150) : null
        };
    });

    // 3. Compute Aggregate Training Metrics
    // A. Rolling JIT Consistency & Block Completion timeframe
    let jitScore = 100;
    if (typeof calculateRollingJITConsistency === 'function') {
        jitScore = calculateRollingJITConsistency(Array.from(allCompletedMap.values()), activeWorkouts);
    }

    let daysElapsedForLastBlock = null;
    let lastBlockWorkoutCount = 0;
    let totalSpanDays = null;

    if (recentCompleted.length > 0) {
        const lastBlock = recentCompleted.slice(-7);
        lastBlockWorkoutCount = lastBlock.length;
        const firstDateLastBlock = lastBlock[0].dateExecuted ? parseLocalDate(lastBlock[0].dateExecuted) : null;
        const lastDateLastBlock = lastBlock[lastBlock.length - 1].dateExecuted ? parseLocalDate(lastBlock[lastBlock.length - 1].dateExecuted) : null;
        if (firstDateLastBlock && lastDateLastBlock && !isNaN(firstDateLastBlock.getTime()) && !isNaN(lastDateLastBlock.getTime())) {
            daysElapsedForLastBlock = Math.max(1, Math.ceil(Math.abs(lastDateLastBlock - firstDateLastBlock) / (1000 * 60 * 60 * 24)) + 1);
        }

        const overallFirstDate = recentCompleted[0].dateExecuted ? parseLocalDate(recentCompleted[0].dateExecuted) : null;
        const overallLastDate = recentCompleted[recentCompleted.length - 1].dateExecuted ? parseLocalDate(recentCompleted[recentCompleted.length - 1].dateExecuted) : null;
        if (overallFirstDate && overallLastDate && !isNaN(overallFirstDate.getTime()) && !isNaN(overallLastDate.getTime())) {
            totalSpanDays = Math.max(1, Math.ceil(Math.abs(overallLastDate - overallFirstDate) / (1000 * 60 * 60 * 24)) + 1);
        }
    }

    const jitRating = jitScore >= 90 ? "High (100% on-schedule)" : (jitScore >= 70 ? "Moderate" : "Extended spacing / Deload pace");

    // B. Weekly Volume aggregates for last 2 blocks
    const weeklyVolume = [];
    const block1Workouts = recentCompleted.slice(0, Math.max(0, recentCompleted.length - 7));
    const block2Workouts = recentCompleted.slice(-7);

    const aggregateBlockVolume = (workouts, label) => {
        let totalMiles = 0;
        let totalMins = 0;
        let runCount = 0;
        let strengthCount = 0;

        workouts.forEach(w => {
            const isRun = w.type === 'run' || w.type === 'easy' || w.type === 'fast' || w.type === 'tempo' || w.type === 'interval' || w.type === 'long';
            const isStrength = w.type === 'strength';

            if (isRun) {
                runCount++;
                if (w.actualLoggedDistance) totalMiles += w.actualLoggedDistance;
                else if (w.targetDistance) totalMiles += w.targetDistance;
            }
            if (isStrength) {
                strengthCount++;
            }

            if (w.actualLoggedDuration) totalMins += w.actualLoggedDuration;
            else if (w.targetDuration) totalMins += w.targetDuration;
            else if (isStrength) totalMins += 30;
            else if (isRun) totalMins += 30;
        });

        return {
            label,
            totalMiles: parseFloat(totalMiles.toFixed(1)),
            totalMinutes: Math.round(totalMins),
            runCount,
            strengthCount
        };
    };

    if (block1Workouts.length > 0) {
        weeklyVolume.push(aggregateBlockVolume(block1Workouts, "Prior Block"));
    }
    if (block2Workouts.length > 0) {
        weeklyVolume.push(aggregateBlockVolume(block2Workouts, "Most Recent Block"));
    }

    let volumeDeltaPct = null;
    if (weeklyVolume.length === 2 && weeklyVolume[0].totalMiles > 0) {
        const delta = ((weeklyVolume[1].totalMiles - weeklyVolume[0].totalMiles) / weeklyVolume[0].totalMiles) * 100;
        volumeDeltaPct = parseFloat(delta.toFixed(1));
    }

    // C. Biometric Weight Trend (Current Weight + 7-14 day delta)
    let weightTrend = null;
    const currentWeight = userProfile?.weight ? parseFloat(userProfile.weight) : null;
    if (currentWeight) {
        let previousWeight = null;
        let daysElapsed = 14;
        const bmiHist = userProfile?.bmiHistory;
        if (Array.isArray(bmiHist) && bmiHist.length > 1) {
            const now = new Date().getTime();
            const olderEntries = bmiHist.filter(entry => {
                if (!entry.date) return false;
                const entryTime = new Date(entry.date).getTime();
                const diffDays = (now - entryTime) / (1000 * 60 * 60 * 24);
                return diffDays >= 6;
            });
            if (olderEntries.length > 0) {
                const targetOldEntry = olderEntries[olderEntries.length - 1];
                previousWeight = parseFloat(targetOldEntry.weight);
                const oldTime = new Date(targetOldEntry.date).getTime();
                daysElapsed = Math.max(1, Math.round((now - oldTime) / (1000 * 60 * 60 * 24)));
            }
        }
        weightTrend = {
            currentWeight: currentWeight,
            previousWeight: previousWeight,
            deltaLbs: previousWeight ? parseFloat((currentWeight - previousWeight).toFixed(1)) : null,
            daysElapsed: daysElapsed
        };
    }

    const trainingMetrics = {
        recentJITConsistency: {
            score: jitScore,
            daysElapsedForLastBlock: daysElapsedForLastBlock,
            workoutCount: lastBlockWorkoutCount,
            rating: jitRating
        },
        weeklyVolume: weeklyVolume,
        volumeDeltaPct: volumeDeltaPct,
        weightTrend: weightTrend
    };

    // 4. Slim down profile payload (strip bmiHistory, paceHistory, large GPX blobs)
    const cleanProfile = {
        age: userProfile?.age,
        weight: userProfile?.weight,
        heightInches: userProfile?.heightInches,
        sex: userProfile?.sex,
        fitnessLevel: userProfile?.fitnessLevel,
        primaryGoal: userProfile?.primaryGoal,
        daysAvailable: userProfile?.daysAvailable,
        desiredWorkoutLength: userProfile?.desiredWorkoutLength,
        includeStrength: userProfile?.includeStrength,
        trainingFocusRatio: userProfile?.trainingFocusRatio,
        equipmentList: userProfile?.equipmentList,
        why: userProfile?.why || userProfile?.whyMotivation,
        userBaselineNotes: userProfile?.userBaselineNotes,
        chronicLimitations: userProfile?.chronicLimitations,
        acuteInjuries: userProfile?.acuteInjuries,
        emergencyOverrideNotes: userProfile?.emergencyOverrideNotes,
        prescriptiveMeals: userProfile?.prescriptiveMeals,
        dietaryPreferences: userProfile?.dietaryPreferences,
        activeAdjustedGoal: userProfile?.activeAdjustedGoal,
        currentEstimated5k: userProfile?.currentEstimated5k,
        baseline5k: userProfile?.baseline5k,
        macrocyclePlan: userProfile?.macrocyclePlan,
        journeyStartDate: userProfile?.journeyStartDate
    };

    // Remove undefined/null/NaN
    const sanitizeObj = (obj) => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'number' && isNaN(obj)) return null;
        if (Array.isArray(obj)) return obj.map(sanitizeObj);
        if (typeof obj === 'object') {
            const newObj = {};
            for (let k in obj) {
                if (obj[k] !== undefined) {
                    newObj[k] = sanitizeObj(obj[k]);
                }
            }
            return newObj;
        }
        return obj;
    };

    return {
        cleanProfile: sanitizeObj(cleanProfile),
        cleanHistory: sanitizeObj(sanitizedHistory),
        trainingMetrics: sanitizeObj(trainingMetrics)
    };
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

                // 2. Build streamlined 2-week history, training metrics, and slim profile
                const { cleanProfile, cleanHistory, trainingMetrics } = await buildEliteCoachPayload(userDocRef, activePhaseWorkouts, userProfileData);

                // 3. Call the AI API BEFORE wiping active_phase
                const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock', { timeout: 120000 });
                const aiResult = await generateWorkoutBlock({
                    phaseIndex: currentPhaseIndex,
                    profile: cleanProfile,
                    history: cleanHistory,
                    trainingMetrics: trainingMetrics
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

            const notesEl = document.getElementById('gateway-override-notes');
            const notes = notesEl ? notesEl.value.trim() : "";
            const acuteEl = document.getElementById('gateway-acute-injury-notes');
            const acuteNotes = acuteEl ? acuteEl.value.trim() : "";
            const weightEl = document.getElementById('gateway-weight');
            const newWeightStr = weightEl ? weightEl.value : "";
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

            const gatewayModal = document.getElementById('checkout-gateway-modal');
            if (gatewayModal) gatewayModal.classList.add('hidden');
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
                            return parseLocalDate(b.dateExecuted) - parseLocalDate(a.dateExecuted);
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

                // Fetch streamlined 2-week history, training metrics, and slim profile
                const { cleanProfile, cleanHistory, trainingMetrics } = await buildEliteCoachPayload(userDocRef, activePhaseWorkouts, userProfileData);

                // Call Firebase Cloud Function to generate AI workouts BEFORE wiping
                let nextWorkouts = [];
                try {
                    const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock', { timeout: 120000 });
                    const aiResult = await generateWorkoutBlock({
                        phaseIndex: nextPhaseIndex,
                        profile: cleanProfile,
                        history: cleanHistory,
                        trainingMetrics: trainingMetrics
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
                    console.error("Failed to generate AI workouts.", error);
                    const useFallback = confirm("AI Generation Error: " + error.message + "\n\nWould you like to fall back to a default offline template based on your fitness level? (Click Cancel to try AI regeneration again)");
                    if (useFallback) {
                        nextWorkouts = getDefaultWorkouts(userProfileData.fitnessLevel);
                        nextWorkouts = nextWorkouts.map(w => ({
                            ...w,
                            id: userDocRef.collection("active_phase").doc().id,
                            phaseNumber: nextPhaseIndex
                        }));
                    } else {
                        throw new Error("AI Generation Error: " + error.message);
                    }
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
                alert("Checkout Failed: " + err.message + "\n\nPlease try to generate your next phase again.");
                window.isGeneratingBlock = false;

                const homeGenBtn = document.getElementById('gen-next-phase-btn-home');
                const checklistGenBtn = document.getElementById('gen-next-phase-btn-checklist');
                const gatewayBtn = document.getElementById('gateway-submit-btn');
                const regenBtn = document.getElementById('regenerate-block-btn');

                if (homeGenBtn) {
                    homeGenBtn.disabled = false;
                    homeGenBtn.className = "shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap";
                    homeGenBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Next Phase`;
                }
                if (checklistGenBtn) {
                    checklistGenBtn.disabled = false;
                    checklistGenBtn.className = "shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap";
                    checklistGenBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Next Phase`;
                }
                if (gatewayBtn) {
                    gatewayBtn.disabled = false;
                    gatewayBtn.innerHTML = `Unlock Next Subphase Autopilot`;
                    gatewayBtn.classList.remove('opacity-60', 'cursor-not-allowed');
                }
                if (regenBtn) {
                    regenBtn.disabled = false;
                    regenBtn.innerHTML = `<i class="fa-solid fa-rotate-right mr-1"></i> Regenerate Active Block`;
                }
            }
        }

async function retryAIBlockGeneration() {
            if (window.isGeneratingBlock) {
                console.warn("Block generation already in progress.");
                return;
            }

            if (!userProfileData || !userId) {
                console.warn("User profile or ID not loaded.");
                return;
            }

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

            const confirmed = window.confirm("Are you sure you want to regenerate this block? This will replace your current uncompleted workouts with a new AI-generated plan.");
            if (!confirmed) return;

            window.isGeneratingBlock = true;

            // Increment and save regeneration count
            regenCount++;
            userProfileData.regenerationCount = regenCount;
            userProfileData.lastRegenerationWeek = currentWeek;

            const regenBtn = document.getElementById('regenerate-block-btn');
            if (regenBtn) {
                regenBtn.disabled = true;
                regenBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Regenerating...`;
                regenBtn.classList.add('opacity-60', 'cursor-not-allowed');
            }

            showAutopilotLoader();

            try {
                await db.collection("users").doc(userId).update({
                    regenerationCount: regenCount,
                    lastRegenerationWeek: currentWeek
                });
            } catch (err) {
                console.error("Failed to update regeneration count", err);
            }

            const userDocRef = db.collection("users").doc(userId);
            const currentPhaseIndex = userProfileData.currentPhaseIndex || 1;

            try {
                if (firebase.auth().currentUser) {
                    await firebase.auth().currentUser.getIdToken(true);
                }
            } catch (e) {
                console.warn("Token refresh failed:", e);
            }

            try {
                // Build streamlined history, training metrics, and slim profile
                const { cleanProfile, cleanHistory, trainingMetrics } = await buildEliteCoachPayload(userDocRef, activePhaseWorkouts, userProfileData);

                const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock', { timeout: 120000 });
                const aiResult = await generateWorkoutBlock({
                    phaseIndex: currentPhaseIndex,
                    profile: cleanProfile,
                    history: cleanHistory,
                    trainingMetrics: trainingMetrics
                });

                const newWorkouts = aiResult.data.workouts || [];
                const strengthGuides = aiResult.data.strengthGuides || [];
                const healthInsights = aiResult.data.healthInsights || null;

                let profileUpdates = {};
                if (strengthGuides.length > 0) {
                    profileUpdates.currentStrengthGuides = strengthGuides;
                    profileUpdates.simpleStrengthGuides = firebase.firestore.FieldValue.delete();
                }
                if (healthInsights) {
                    profileUpdates.healthInsights = healthInsights;
                }
                if (Object.keys(profileUpdates).length > 0) {
                    await userDocRef.update(profileUpdates);
                }

                // Archive completed workouts and remove uncompleted from active_phase
                const batchArchive = db.batch();
                if (Array.isArray(activePhaseWorkouts)) {
                    activePhaseWorkouts.forEach(w => {
                        if (w && w.completed) {
                            batchArchive.set(userDocRef.collection("history").doc(w.id), w);
                        }
                    });
                }

                const activeDocs = await userDocRef.collection("active_phase").get();
                activeDocs.forEach(doc => {
                    batchArchive.delete(doc.ref);
                });
                await batchArchive.commit();

                // Save new workouts to active_phase
                const batchWrite = db.batch();
                newWorkouts.forEach(w => {
                    batchWrite.set(userDocRef.collection("active_phase").doc(w.id), w);
                });
                await batchWrite.commit();

                console.log(`Successfully regenerated block for Phase ${currentPhaseIndex}`);
                setTimeout(() => {
                    hideAutopilotLoader();
                    window.isGeneratingBlock = false;
                }, 2000);

            } catch (err) {
                console.error("Block regeneration failure:", err);
                hideAutopilotLoader();
                alert("Failed to regenerate block: " + err.message);
                window.isGeneratingBlock = false;
                if (regenBtn) {
                    regenBtn.disabled = false;
                    const left = Math.max(0, 3 - regenCount);
                    regenBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Regenerate\n(${left} Left)`;
                    regenBtn.classList.remove('opacity-60', 'cursor-not-allowed');
                }
            }
        }

function getDefaultWorkouts(fitnessLevel) {
    let level = (fitnessLevel || "").toLowerCase();
    
    // Higher end athlete in a training cycle
    if (level.includes("advanced") || level.includes("elite") || level.includes("competitive") || level.includes("pro") || level.includes("ambitious")) {
        return [
            { id: "act-1", phaseNumber: 1, sequenceOrder: 1, workoutTitle: "Aerobic Base Run", type: "easy", distanceDuration: "6 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Steady aerobic state. Focus on maintaining a quick turnover.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-2", phaseNumber: 1, sequenceOrder: 2, workoutTitle: "Strength: Power Output", type: "strength", distanceDuration: "45 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Heavy posterior chain loading and plyometric elasticity.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "A" },
            { id: "act-3", phaseNumber: 1, sequenceOrder: 3, workoutTitle: "Speed: Threshold Intervals", type: "fast", distanceDuration: "50 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "6 x 1000m at Threshold Pace with 90s jog recovery.", targetPaceZone: "tempo", actualLoggedPace: null, rpeScore: null },
            { id: "act-4", phaseNumber: 1, sequenceOrder: 4, workoutTitle: "Active Recovery", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Light mobility and dynamic stretching to aid fiber repair.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
            { id: "act-5", phaseNumber: 1, sequenceOrder: 5, workoutTitle: "Easy Base + Strides", type: "easy", distanceDuration: "5 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Easy miles followed by 6x100m strides to flush legs.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-6", phaseNumber: 1, sequenceOrder: 6, workoutTitle: "Strength: Core & Stability", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Anti-rotational core stability and hip mechanics.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "C" },
            { id: "act-7", phaseNumber: 1, sequenceOrder: 7, workoutTitle: "Long Run Simulation", type: "easy", distanceDuration: "12 Miles", isSpeedWorkout: false, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "Sustained long run. Practice race-day nutrition.", targetPaceZone: "long", actualLoggedPace: null, rpeScore: null }
        ];
    }
    // Average athlete
    else if (level.includes("intermediate") || level.includes("average") || level.includes("progressive")) {
        return [
            { id: "act-1", phaseNumber: 1, sequenceOrder: 1, workoutTitle: "Easy Recovery Run", type: "easy", distanceDuration: "3 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Highly relaxed base building. Keep your breathing perfectly controlled.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-2", phaseNumber: 1, sequenceOrder: 2, workoutTitle: "Strength Workout A", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Hip stability and front heel lunge force from your strength library.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "A" },
            { id: "act-3", phaseNumber: 1, sequenceOrder: 3, workoutTitle: "Easy Base Run", type: "easy", distanceDuration: "4 Miles", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Smooth and steady. Focus on keeping contact time on ground minimal.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-4", phaseNumber: 1, sequenceOrder: 4, workoutTitle: "Speed Session: 8 x 400m", type: "fast", distanceDuration: "35 mins", isSpeedWorkout: true, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "8x400m intervals on Track (90s rest). Strive for a steady cadence.", targetPaceZone: "goal", actualLoggedPace: null, rpeScore: null },
            { id: "act-5", phaseNumber: 1, sequenceOrder: 5, workoutTitle: "Active Recovery Rest Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Recommended rest to allow muscle fibers to adapt and rebuild.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
            { id: "act-6", phaseNumber: 1, sequenceOrder: 6, workoutTitle: "Strength Workout C", type: "strength", distanceDuration: "30 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Stride elasticity and Achilles tendon rigidity. Use bands/calf raises.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "C" },
            { id: "act-7", phaseNumber: 1, sequenceOrder: 7, workoutTitle: "Long Run", type: "easy", distanceDuration: "6 Miles", isSpeedWorkout: false, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "Comfortable long run. Focus on time on feet.", targetPaceZone: "long", actualLoggedPace: null, rpeScore: null }
        ];
    }
    // Get healthy / lower end athlete / beginner
    else {
        return [
            { id: "act-1", phaseNumber: 1, sequenceOrder: 1, workoutTitle: "Walk/Jog Intervals", type: "easy", distanceDuration: "20 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "2 min walk, 1 min jog. Keep it very easy and strictly conversational.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-2", phaseNumber: 1, sequenceOrder: 2, workoutTitle: "Mobility & Core", type: "strength", distanceDuration: "20 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Basic bodyweight squats, glute bridges, and plank holds.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "A" },
            { id: "act-3", phaseNumber: 1, sequenceOrder: 3, workoutTitle: "Rest Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Full rest. Focus on hydration and getting 8 hours of sleep.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
            { id: "act-4", phaseNumber: 1, sequenceOrder: 4, workoutTitle: "Walk/Jog Intervals", type: "easy", distanceDuration: "25 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "3 min walk, 2 min jog. Gradually build your aerobic capacity.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null },
            { id: "act-5", phaseNumber: 1, sequenceOrder: 5, workoutTitle: "Rest Day", type: "rest", distanceDuration: "As Needed", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Full rest. Gentle stretching if feeling tight.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null },
            { id: "act-6", phaseNumber: 1, sequenceOrder: 6, workoutTitle: "Light Strength & Balance", type: "strength", distanceDuration: "20 mins", isSpeedWorkout: false, isBenchmark: false, completed: false, dateExecuted: null, targetInstructions: "Single leg balances, calf raises, and core stabilization.", targetPaceZone: null, actualLoggedPace: null, rpeScore: null, strengthGuideReference: "C" },
            { id: "act-7", phaseNumber: 1, sequenceOrder: 7, workoutTitle: "Continuous Easy Run/Walk", type: "easy", distanceDuration: "1.5 Miles", isSpeedWorkout: false, isBenchmark: true, completed: false, dateExecuted: null, targetInstructions: "Try to jog as much as possible, taking walk breaks only when needed.", targetPaceZone: "easy", actualLoggedPace: null, rpeScore: null }
        ];
    }
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


