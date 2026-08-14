        let currentAddActivityDay = null;

        function openAddActivityModal(dayOrder) {
            currentAddActivityDay = dayOrder;
            const modal = document.getElementById('add-activity-modal');
            const typeSelect = document.getElementById('add-activity-type');

            // Find existing activity type for this day
            const existingWorkouts = activePhaseWorkouts.filter(w => w.sequenceOrder == dayOrder);
            const existingType = existingWorkouts.length > 0 ? existingWorkouts[0].type : null;

            // Reset UI
            document.getElementById('add-activity-dynamic-area').classList.add('hidden');
            document.getElementById('add-activity-manual-form').classList.add('hidden');
            document.getElementById('add-activity-ai-form').classList.add('hidden');
            document.getElementById('add-activity-ai-form').classList.remove('flex');
            document.getElementById('btn-ai-generate').classList.remove('hidden');

            const btnQuickRun = document.getElementById('btn-quick-run');
            const btnQuickStrength = document.getElementById('btn-quick-strength');
            const btnQuickRoutine = document.getElementById('btn-quick-routine');
            if (btnQuickRun) btnQuickRun.classList.add('hidden');
            if (btnQuickStrength) btnQuickStrength.classList.add('hidden');
            if (btnQuickRoutine) btnQuickRoutine.classList.add('hidden');

            document.getElementById('add-activity-loading').classList.add('hidden');
            document.getElementById('add-activity-loading').classList.remove('flex');
            document.getElementById('close-add-modal-btn').disabled = false;
            typeSelect.value = "";
            document.getElementById('add-activity-duration').value = "";
            document.getElementById('add-activity-distance').value = "";
            document.getElementById('add-activity-notes').value = "";

            // Disable the option that is already on this day
            Array.from(typeSelect.options).forEach(opt => {
                if (opt.value && existingType && opt.value === existingType) {
                    opt.disabled = true;
                    if (!opt.text.includes('(Already scheduled)')) opt.text = opt.text + ' (Already scheduled)';
                } else if (opt.value) {
                    opt.disabled = false;
                    opt.text = opt.text.replace(' (Already scheduled)', '');
                }
            });

            modal.classList.remove('hidden');
        }

        function closeAddActivityModal() {
            document.getElementById('add-activity-modal').classList.add('hidden');
        }

        function handleAddActivityTypeChange() {
            const type = document.getElementById('add-activity-type').value;
            const dynamicArea = document.getElementById('add-activity-dynamic-area');
            const manualForm = document.getElementById('add-activity-manual-form');
            const aiForm = document.getElementById('add-activity-ai-form');
            const distContainer = document.getElementById('add-activity-distance-container');

            const btnQuickRun = document.getElementById('btn-quick-run');
            const btnQuickStrength = document.getElementById('btn-quick-strength');
            if (btnQuickRun) btnQuickRun.classList.add('hidden');
            if (btnQuickStrength) btnQuickStrength.classList.add('hidden');

            dynamicArea.classList.remove('hidden');

            const manualTypes = ['walk', 'bike', 'swim', 'sport'];
            const aiTypes = ['run', 'strength', 'core', 'yoga', 'stretching'];

            if (manualTypes.includes(type)) {
                manualForm.classList.remove('hidden');
                aiForm.classList.add('hidden');
                aiForm.classList.remove('flex');

                if (type === 'sport') {
                    distContainer.classList.add('hidden');
                } else {
                    distContainer.classList.remove('hidden');
                }
            } else if (aiTypes.includes(type)) {
                aiForm.classList.remove('hidden');
                aiForm.classList.add('flex');
                manualForm.classList.add('hidden');

                if (type === 'run' && btnQuickRun) {
                    btnQuickRun.classList.remove('hidden');
                } else if (type === 'strength' && btnQuickStrength) {
                    btnQuickStrength.classList.remove('hidden');
                } else if ((type === 'core' || type === 'yoga' || type === 'stretching') && btnQuickRoutine) {
                    btnQuickRoutine.classList.remove('hidden');
                    const textSpan = document.getElementById('quick-routine-text');
                    if (type === 'core') textSpan.innerText = "Add Basic Core Routine";
                    else if (type === 'yoga') textSpan.innerText = "Add Basic Yoga Flow";
                    else if (type === 'stretching') textSpan.innerText = "Add Basic Stretching";
                }
            }
        }

        async function submitManualSecondaryWorkout() {
            const type = document.getElementById('add-activity-type').value;
            const duration = document.getElementById('add-activity-duration').value;
            const distance = document.getElementById('add-activity-distance').value;
            const notes = document.getElementById('add-activity-notes').value;

            if (!duration) {
                alert("Please enter a duration.");
                return;
            }

            const existingPhase = activePhaseWorkouts.length > 0 ? activePhaseWorkouts[0].phaseNumber : 1;
            const newId = 'sec_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

            let title = type.charAt(0).toUpperCase() + type.slice(1);
            if (type === 'sport') title = "Sport Activity";

            let distDur = duration ? `${duration} mins` : '';
            if (distance && (type === 'walk' || type === 'bike' || type === 'swim')) {
                distDur = `${distance} mi in ${duration} mins`;
            }

            const newWorkout = {
                id: newId,
                phaseNumber: existingPhase,
                sequenceOrder: Number(currentAddActivityDay),
                workoutTitle: title,
                type: type,
                distanceDuration: distDur,
                isSpeedWorkout: false,
                isBenchmark: false,
                completed: false,
                dateExecuted: null,
                targetInstructions: notes || "Focus on consistency and feel.",
                targetPaceZone: null,
                actualLoggedPace: null,
                rpeScore: null
            };

            await saveSecondaryWorkout(newWorkout);
        }

        async function submitQuickRun() {
            const existingPhase = activePhaseWorkouts.length > 0 ? activePhaseWorkouts[0].phaseNumber : 1;
            const newId = 'sec_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

            const newWorkout = {
                id: newId,
                phaseNumber: existingPhase,
                sequenceOrder: Number(currentAddActivityDay),
                workoutTitle: "Easy Recovery Run",
                type: "run",
                distanceDuration: "2.0 mi in 20 mins",
                targetDistance: 2.0,
                targetDuration: 20,
                isSpeedWorkout: false,
                isBenchmark: false,
                completed: false,
                dateExecuted: null,
                targetInstructions: "2/10 Effort (Very Easy). Focus on keeping heart rate low.",
                targetPaceZone: "easy",
                jitPreparationTip: "Hydrate well and keep it light.",
                actualLoggedPace: null,
                rpeScore: null
            };

            await saveSecondaryWorkout(newWorkout);
        }

        async function submitQuickStrength() {
            const existingPhase = activePhaseWorkouts.length > 0 ? activePhaseWorkouts[0].phaseNumber : 1;
            const newId = 'sec_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

            const newWorkout = {
                id: newId,
                phaseNumber: existingPhase,
                sequenceOrder: Number(currentAddActivityDay),
                workoutTitle: "Full Body Bodyweight",
                type: "strength",
                distanceDuration: "15 mins",
                isSpeedWorkout: false,
                isBenchmark: false,
                completed: false,
                dateExecuted: null,
                targetInstructions: "Simple bodyweight routine. 3 rounds.",
                targetPaceZone: null,
                jitPreparationTip: "Find a clear space on the floor.",
                activities: [
                    { name: "Push Ups", exerciseKey: "push_ups", type: "work", sets: 1, targetType: "reps", targetValue: 12, minimumViableTarget: 6, restSeconds: 30, circuitRestSeconds: 90, equipmentRequired: "Bodyweight", coachingCue: "Keep core tight and elbows at 45 degrees.", repsDistanceTime: "12 reps", isCircuit: true, circuitRounds: 3 },
                    { name: "Bodyweight Squats", exerciseKey: "bodyweight_squats", type: "work", sets: 1, targetType: "reps", targetValue: 15, minimumViableTarget: 8, restSeconds: 30, circuitRestSeconds: 90, equipmentRequired: "Bodyweight", coachingCue: "Keep chest tall and weight in heels.", repsDistanceTime: "15 reps", isCircuit: true, circuitRounds: 3 },
                    { name: "Alternating Lunges", exerciseKey: "alternating_lunges", type: "work", sets: 1, targetType: "reps", targetValue: 10, minimumViableTarget: 5, isPerSide: true, restSeconds: 30, circuitRestSeconds: 90, equipmentRequired: "Bodyweight", coachingCue: "Step forward cleanly with front heel grounded.", repsDistanceTime: "10 per leg", isCircuit: true, circuitRounds: 3 },
                    { name: "Situps", exerciseKey: "situps", type: "work", sets: 1, targetType: "reps", targetValue: 15, minimumViableTarget: 8, restSeconds: 30, circuitRestSeconds: 90, equipmentRequired: "Bodyweight", coachingCue: "Engage core and avoid pulling neck.", repsDistanceTime: "15 reps", isCircuit: true, circuitRounds: 3 }
                ],
                actualLoggedPace: null,
                rpeScore: null
            };

            await saveSecondaryWorkout(newWorkout);
        }

        async function submitQuickRoutine() {
            const type = document.getElementById('add-activity-type').value;
            const existingPhase = activePhaseWorkouts.length > 0 ? activePhaseWorkouts[0].phaseNumber : 1;
            const newId = 'sec_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

            let title = "Basic Routine";
            let exerciseName = "Exercises";

            if (type === 'core') {
                title = "Core Workout";
                exerciseName = "Core Exercises";
            } else if (type === 'yoga') {
                title = "Yoga Flow";
                exerciseName = "Yoga Exercises";
            } else if (type === 'stretching') {
                title = "Stretching Routine";
                exerciseName = "Stretching Exercises";
            }

            const newWorkout = {
                id: newId,
                phaseNumber: existingPhase,
                sequenceOrder: Number(currentAddActivityDay),
                workoutTitle: title,
                type: type,
                distanceDuration: "15 mins",
                isSpeedWorkout: false,
                isBenchmark: false,
                completed: false,
                dateExecuted: null,
                targetInstructions: "Basic routine. Log your specific exercises in the notes.",
                targetPaceZone: null,
                jitPreparationTip: "Find a clear space on the floor.",
                activities: [
                    { name: exerciseName, type: "work", sets: 1, repsDistanceTime: "15 mins", isCircuit: false, circuitRounds: 0 }
                ],
                actualLoggedPace: null,
                rpeScore: null
            };

            await saveSecondaryWorkout(newWorkout);
        }

        async function submitAISecondaryWorkout() {
            const type = document.getElementById('add-activity-type').value;
            const generateBtn = document.getElementById('btn-ai-generate');
            const loadingArea = document.getElementById('add-activity-loading');
            const closeBtn = document.getElementById('close-add-modal-btn');

            generateBtn.classList.add('hidden');
            loadingArea.classList.remove('hidden');
            loadingArea.classList.add('flex');
            closeBtn.disabled = true;

            const existingPhase = activePhaseWorkouts.length > 0 ? activePhaseWorkouts[0].phaseNumber : 1;

            try {
                const generateSecondary = firebase.functions().httpsCallable('generateSecondaryWorkout');
                const response = await generateSecondary({
                    targetType: type,
                    sequenceOrder: currentAddActivityDay,
                    currentPhaseIndex: existingPhase,
                    profileContext: {
                        goal: userProfileData?.activeAdjustedGoal || "general fitness",
                        currentBlock: activePhaseWorkouts.map(w => ({ type: w.type, title: w.workoutTitle, day: w.sequenceOrder }))
                    }
                });

                if (response.data && response.data.workout) {
                    const newWorkout = response.data.workout;
                    newWorkout.id = 'sec_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
                    newWorkout.phaseNumber = existingPhase;
                    newWorkout.sequenceOrder = Number(currentAddActivityDay);
                    newWorkout.completed = false;
                    newWorkout.dateExecuted = null;

                    await saveSecondaryWorkout(newWorkout);
                } else {
                    throw new Error("Invalid response from Coach.");
                }
            } catch (err) {
                console.error("AI Generation failed:", err);
                alert("Coach couldn't generate a workout right now. Try again later.");
                generateBtn.classList.remove('hidden');
                loadingArea.classList.add('hidden');
                loadingArea.classList.remove('flex');
                closeBtn.disabled = false;
            }
        }

        async function saveSecondaryWorkout(newWorkout) {
            try {
                closeAddActivityModal();
                const userDocRef = db.collection("users").doc(userId);
                await userDocRef.collection("active_phase").doc(newWorkout.id).set(newWorkout);
            } catch (err) {
                console.error("Error saving secondary workout:", err);
                alert("Failed to save workout.");
            }
        }

        async function removeSecondaryWorkout(activityId) {
            if (!confirm("Are you sure you want to remove this activity?")) return;

            try {
                await db.collection("users").doc(userId).collection("active_phase").doc(activityId).delete();
            } catch (err) {
                console.error("Error removing workout:", err);
                alert("Failed to remove workout.");
            }
        }
        // ==========================================
        // TURKEY TROT CHALLENGE LOGIC
        // ==========================================