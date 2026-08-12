async function setupProfileSync(profileId) {
    const syncBadge = document.getElementById('sync-badge');
    if (!db) {
        console.warn("Sync Offline: Firestore unreachable.");
        if (syncBadge) {
            syncBadge.className = "inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
            syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> <span class="hidden sm:inline">Offline</span>`;
            syncBadge.title = "Sync Status: Offline";
        }
        return;
    }

    // Show loading feedback
    showAutopilotLoader();

    // Show immediate syncing state feedback on the badge
    if (syncBadge) {
        syncBadge.className = "inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
        syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> <span class="hidden sm:inline">Syncing...</span>`;
        syncBadge.title = "Sync Status: Syncing...";
    }

    // Unsubscribe existing snapshot streams
    if (activeUserListener) {
        activeUserListener();
        activeUserListener = null;
    }
    if (activeWorkoutsListener) {
        activeWorkoutsListener();
        activeWorkoutsListener = null;
    }

    userId = profileId.trim();
    localStorage.setItem('yf_active_profile', userId);

    const profileDisplay = document.getElementById('active-athlete-id-display');
    if (profileDisplay) profileDisplay.innerText = userId;

    console.log("Syncing database channel: users/", userId);
    const userDocRef = db.collection("users").doc(userId);

    // Start connection timeout (30 seconds)
    const connectionTimeout = setTimeout(() => {
        console.warn("Sync Timeout: Connection delayed for profile:", userId);
        if (syncBadge) {
            syncBadge.className = "inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
            syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> <span class="hidden sm:inline">Timeout</span>`;
            syncBadge.title = "Sync Status: Timeout";
        }
        document.getElementById('timeout-error-modal').classList.remove('hidden');
        hideAutopilotLoader();
    }, 30000);

    // Bind real-time listener to user profile
    activeUserListener = userDocRef.onSnapshot((docSnapshot) => {
        clearTimeout(connectionTimeout);
        hideAutopilotLoader();
        if (docSnapshot.exists) {
            console.log("☁️ User profile change detected.");
            const data = docSnapshot.data();
            userProfileData = data;
            if (data && (data.hasCompletedTour || data.tourCompleted)) {
                localStorage.setItem('myflow_tour_completed', 'true');
            }

            if (data.journeyStatus === 'pending_review') {
                // Render Review Panel
                document.getElementById('onboarding-modal').classList.remove('hidden');
                document.getElementById('profile-lookup-panel').classList.add('hidden');
                document.getElementById('medical-disclaimer-panel').classList.add('hidden');
                document.getElementById('onboarding-form-panel').classList.add('hidden');
                document.getElementById('macrocycle-review-panel').classList.remove('hidden');

                document.getElementById('review-overarching-theme').innerText = data.overarchingTheme || "Your Training Journey";

                const stagesContainer = document.getElementById('review-macrocycle-stages');
                stagesContainer.innerHTML = '';
                let planToRender = [];
                if (data.macrocyclePlan && data.macrocyclePlan.length > 0) {
                    planToRender = data.macrocyclePlan;
                }

                let currentAccumulatedDate = data.journeyStartDate ? new Date(data.journeyStartDate) : new Date();

                planToRender.forEach((stage, index) => {
                    let dateBadge = '';
                    if (stage.expectedDurationWeeks) {
                        currentAccumulatedDate.setDate(currentAccumulatedDate.getDate() + (stage.expectedDurationWeeks * 7));
                        const options = { month: 'short', day: 'numeric' };
                        dateBadge = `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-md whitespace-nowrap">Target: ${currentAccumulatedDate.toLocaleDateString(undefined, options)}</span>`;
                    }

                    stagesContainer.innerHTML += `
                                <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col gap-1 text-left">
                                    <div class="flex items-center justify-between w-full">
                                        <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Phase ${stage.phase || (index + 1)}</span>
                                        ${dateBadge}
                                    </div>
                                    <span class="text-sm font-bold text-white">${stage.theme}</span>
                                    <span class="text-xs text-slate-400 mt-1">${stage.description}</span>
                                </div>
                            `;
                });
                return; // Halt rendering of the dashboard
            } else {
                // Ensure modal is closed
                document.getElementById('onboarding-modal').classList.add('hidden');
            }

            // Update UI text views if they aren't currently being edited
            const titleEl = document.getElementById('plan-title');
            const descEl = document.getElementById('plan-desc');
            if (titleEl && document.activeElement !== titleEl) {
                titleEl.innerText = data.journeyTitle || "Your Journey";
            }
            if (descEl && document.activeElement !== descEl) {
                descEl.innerText = data.journeyDescription || "";
            }

            // Set remaining weeks display
            if (data.journeyStartDate && data.targetDate) {
                const target = new Date(data.targetDate);
                const today = new Date();
                const diffTime = target - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const displayEl = document.getElementById('days-remaining-display');
                if (displayEl) {
                    displayEl.innerText = `${Math.max(0, diffDays)} Days to go`;
                }
            }

            // Set modal profile stats and coach comments
            const modalBaselineEl = document.getElementById('modal-baseline-pace');
            if (modalBaselineEl) modalBaselineEl.innerText = data.baseline5k || "-";

            const modalGoalEl = document.getElementById('modal-goal-pace');
            if (modalGoalEl) modalGoalEl.innerText = data.activeAdjustedGoal || "-";

            const modalTierEl = document.getElementById('modal-tier');
            if (modalTierEl) modalTierEl.innerText = data.challengeTier || "-";

            const coachCommentsEl = document.getElementById('drawer-coach-comments');
            if (coachCommentsEl) coachCommentsEl.innerText = data.journeyComments || "-";

            const isSimpleChecked = document.getElementById('simple-mode-toggle') && document.getElementById('simple-mode-toggle').checked;
            let guidesToRender = (isSimpleChecked && data.simpleStrengthGuides) ? data.simpleStrengthGuides : data.currentStrengthGuides;

            if (!guidesToRender || guidesToRender.length === 0) {
                guidesToRender = getDefaultStrengthGuides();
            }

            if (guidesToRender) {
                renderStrengthGuides(guidesToRender);
                if (guidesToRender.length > 0) {
                    switchStrength('A');
                }
            }

            // Auto-sync pace constraints
            const baselinePace = data.currentEstimated5k || data.baseline5k;
            if (baselinePace) {
                const minSec = baselinePace.split(':');
                if (minSec.length === 2) {
                    const inMin = document.getElementById('input-min');
                    const inSec = document.getElementById('input-sec');
                    if (inMin) inMin.value = parseInt(minSec[0]);
                    if (inSec) inSec.value = parseInt(minSec[1]);

                    const minDisp = document.getElementById('input-min-display');
                    const secDisp = document.getElementById('input-sec-display');
                    if (minDisp) minDisp.innerText = parseInt(minSec[0]);
                    if (secDisp) secDisp.innerText = minSec[1];
                }
            }

            if (data.primaryGoal === 'race') {
                document.getElementById('pace-chart-card').style.display = '';
                if (typeof updatePaceAndVolumeHub === 'function') {
                    updatePaceAndVolumeHub(data);
                }
            } else {
                document.getElementById('pace-chart-card').style.display = 'none';
            }

            // Render GPX Baseline card dynamically
            renderGPXBaselineCard(data);

            if (typeof window.updateDashboardBMI === 'function') {
                window.updateDashboardBMI(data);
            }

            // Hide onboarding modal
            hideOnboardingModal();
            calculateTargetPaces();
            updateTimelineView(data.currentPhaseIndex || 1);

            if (syncBadge) {
                syncBadge.className = "inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
                syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> <span class="hidden sm:inline">Synced</span>`;
                syncBadge.title = "Sync Status: Synced";
            }
        } else {
            console.log("Profile empty. Displaying lookup panel.");
            if (syncBadge) {
                syncBadge.className = "inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
                syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> <span class="hidden sm:inline">Onboarding</span>`;
                syncBadge.title = "Sync Status: Onboarding";
            }
            showProfileLookupPanel(userId);
            const errorEl = document.getElementById('lookup-error');
            if (errorEl && userId) {
                errorEl.innerText = `Athlete ID "${userId}" not found.`;
                errorEl.classList.remove('hidden');
            }
        }
    }, (error) => {
        clearTimeout(connectionTimeout);
        hideAutopilotLoader();
        console.error("Profile channel sync error: ", error);
        if (syncBadge) {
            syncBadge.className = "inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase";
            syncBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> <span class="hidden sm:inline">Error</span>`;
            syncBadge.title = "Sync Status: Error";
        }
    });

    // Bind real-time listener to active phase workouts
    activeWorkoutsListener = userDocRef.collection("active_phase").orderBy("sequenceOrder").onSnapshot((querySnapshot) => {
        activePhaseWorkouts = [];
        querySnapshot.forEach((doc) => {
            activePhaseWorkouts.push(doc.data());
        });

        console.log("☁️ Workout snapshot updated: ", activePhaseWorkouts.length);
        buildActivePhaseHTML();
        renderNextActivityCard();
        updateOverallProgressMeter();
        checkPhaseCompletion();
        if (userProfileData && typeof updatePaceAndVolumeHub === 'function') {
            updatePaceAndVolumeHub(userProfileData);
        }
        setTimeout(() => {
            if (typeof startAppTour === 'function') startAppTour();
        }, 800);
    }, (error) => {
        console.error("Workouts channel sync error: ", error);
    });
}

function getActivePhaseTheme(phaseIndex) {
    if (phaseIndex === 2) return "Speed Endurance";
    if (phaseIndex === 3) return "Peak & Taper";
    return "Speed Induction";
}

// 2. Medical Shield & Onboarding Modal Toggles
let isRestartingJourney = false;
let currentOnboardingStep = 1;

function goToOnboardingStep(step) {
    // Validation before moving forward
    if (step > currentOnboardingStep) {
        if (!validateOnboardingStep(currentOnboardingStep)) return;
    }
    currentOnboardingStep = step;

    // UI Stepper Updates
    for (let i = 1; i <= 3; i++) {
        const ind = document.getElementById('step-ind-' + i);
        const panel = document.getElementById('onboarding-step-' + i);
        if (ind) {
            if (i <= step) {
                ind.classList.remove('bg-slate-800');
                ind.classList.add('bg-indigo-500');
            } else {
                ind.classList.add('bg-slate-800');
                ind.classList.remove('bg-indigo-500');
            }
        }
        if (panel) {
            if (i === step) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    }

    // Footer buttons logic
    const backBtn = document.getElementById('btn-onboarding-back');
    const nextBtn = document.getElementById('btn-onboarding-next');
    const submitBtn = document.getElementById('btn-build-plan');

    if (backBtn) backBtn.classList.toggle('hidden', step === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', step === 3);
    if (submitBtn) submitBtn.classList.toggle('hidden', step !== 3);
}

function nextOnboardingStep() {
    if (currentOnboardingStep < 3) {
        goToOnboardingStep(currentOnboardingStep + 1);
    }
}

function prevOnboardingStep() {
    if (currentOnboardingStep > 1) {
        goToOnboardingStep(currentOnboardingStep - 1);
    }
}

function validateOnboardingStep(step) {
    if (step === 1) {
        const title = document.getElementById('intake-title').value.trim();
        const goal = document.getElementById('intake-primary-goal').value;
        if (!title || !goal) {
            alert("Please select a Primary Goal and provide a Flow Title.");
            return false;
        }
    } else if (step === 2) {
        const age = document.getElementById('intake-birthyear').value;
        const weight = document.getElementById('intake-weight').value;
        const fitness = document.getElementById('intake-fitness-level').value;
        if (!age || !weight || !fitness) {
            alert("Please fill out Birth Year, Weight, and Fitness Level.");
            return false;
        }
    }
    return true;
}

function promptRestartJourney() {
    const confirmed = window.confirm("Are you sure you want to start a new journey? This will archive your current journey and allow you to design a fresh, new one.");
    if (confirmed) {
        restartJourney();
    }
}

function restartJourney() {
    isRestartingJourney = true;
    closeProfileModal();
    goToOnboardingStep(1); // Reset to step 1

    if (userProfileData) {
        document.getElementById('intake-athlete-id').value = userId;
        document.getElementById('intake-title').value = userProfileData.journeyTitle || "";
        const notesStr = userProfileData.userBaselineNotes || "";
        document.getElementById('intake-general').value = "";
        document.getElementById('intake-goals').value = "";
        document.getElementById('intake-limitations').value = "";

        if (notesStr) {
            const sections = notesStr.split(" | ");
            sections.forEach(sec => {
                if (sec.startsWith("General: ")) {
                    document.getElementById('intake-general').value = sec.replace("General: ", "").trim();
                } else if (sec.startsWith("Goals: ")) {
                    document.getElementById('intake-goals').value = sec.replace("Goals: ", "").trim();
                } else if (sec.startsWith("Limitations: ")) {
                    document.getElementById('intake-limitations').value = sec.replace("Limitations: ", "").trim();
                } else {
                    // fallback for old legacy string without labels
                    const current = document.getElementById('intake-general').value;
                    document.getElementById('intake-general').value = current ? current + " " + sec : sec;
                }
            });
        }

        if (userProfileData.birthYear) {
            document.getElementById('intake-birthyear').value = userProfileData.birthYear;
        } else if (userProfileData.age) {
            document.getElementById('intake-birthyear').value = new Date().getFullYear() - userProfileData.age;
        } else {
            document.getElementById('intake-birthyear').value = "";
        }
        document.getElementById('intake-weight').value = userProfileData.weight || "";
        document.getElementById('intake-sex').value = userProfileData.sex || "male";
        if (userProfileData.heightInches) {
            document.getElementById('intake-height-ft').value = Math.floor(userProfileData.heightInches / 12);
            document.getElementById('intake-height-in').value = userProfileData.heightInches % 12;
        } else {
            document.getElementById('intake-height-ft').value = "";
            document.getElementById('intake-height-in').value = "";
        }
        setTimeout(updateBMIVisual, 100);

        if (userProfileData.fitnessLevel) {
            selectFitness(userProfileData.fitnessLevel);
        }

        if (userProfileData.primaryGoal) {
            selectGoal(userProfileData.primaryGoal);
            document.getElementById('intake-days-available').value = userProfileData.daysAvailable || 4;
            if (userProfileData.strengthType) {
                selectStrength(userProfileData.strengthType);
            } else {
                selectStrength('runner_specific');
            }
        }

        if (userProfileData.dynamicGoalData) {
            if (userProfileData.primaryGoal === 'race') {
                document.getElementById('intake-target-distance').value = userProfileData.dynamicGoalData.targetDistance || "";
                document.getElementById('intake-date').value = userProfileData.dynamicGoalData.targetDate || "";
                document.getElementById('intake-current-pace').value = userProfileData.dynamicGoalData.currentPace || "";
                document.getElementById('intake-goal-pace').value = userProfileData.dynamicGoalData.goalPace || "";
            } else if (userProfileData.primaryGoal === 'recovery') {
                document.getElementById('intake-recovery-nature').value = userProfileData.dynamicGoalData.natureOfBreak || "injury";
                document.getElementById('intake-recovery-phase').value = userProfileData.dynamicGoalData.currentPhase || "just_starting";
            }
        }
    }

    document.getElementById('onboarding-modal').classList.remove('hidden');
    document.getElementById('profile-lookup-panel').classList.add('hidden');
    document.getElementById('medical-disclaimer-panel').classList.add('hidden');
    document.getElementById('onboarding-form-panel').classList.remove('hidden');

    // Hide Athlete ID field on restart completely or make it read-only prominently
    const idInputContainer = document.getElementById('intake-athlete-id').closest('.space-y-1');
    if (idInputContainer) {
        idInputContainer.classList.add('hidden');
    }
    document.getElementById('intake-athlete-id').disabled = true;
}

async function startFlow() {
    if (!userId) return;
    const userDocRef = db.collection("users").doc(userId);
    try {
        await userDocRef.update({ journeyStatus: "active" });
    } catch (e) {
        console.error("Failed to start flow", e);
        alert("Failed to start flow. Please check connection.");
    }
}

function signOut() {
    localStorage.removeItem('yf_active_profile');
    window.location.reload();
}

function randomizeGatewayBadge() {
    const badges = [
        'Train At Your Own Pace',
        'Fitness Made Simple',
        'Smart Meal & Fuel Guides',
        'Zero Guesswork',
        'Your goals, your pace',
        'Simple daily activities',
        'Target-Driven Roadmap',
        'Zero Overwhelm',
        'Tailored daily tips',
        'Paced For Success'
    ];
    const badgeEl = document.getElementById('gateway-random-badge');
    if (badgeEl) {
        const picked = badges[Math.floor(Math.random() * badges.length)];
        badgeEl.innerText = picked;
    }
}

function showProfileLookupPanel(prefilledId) {
    document.getElementById('onboarding-modal').classList.remove('hidden');
    document.getElementById('profile-lookup-panel').classList.remove('hidden');
    document.getElementById('medical-disclaimer-panel').classList.add('hidden');
    document.getElementById('onboarding-form-panel').classList.add('hidden');
    const errorEl = document.getElementById('lookup-error');
    if (errorEl) errorEl.classList.add('hidden');
    randomizeGatewayBadge();
    const inputEl = document.getElementById('lookup-athlete-id');
    if (inputEl) inputEl.value = prefilledId || "";
}

function startNewProfileOnboarding() {
    document.getElementById('profile-lookup-panel').classList.add('hidden');
    document.getElementById('create-id-panel').classList.remove('hidden');
    const errorEl = document.getElementById('create-id-error');
    if (errorEl) errorEl.classList.add('hidden');

    const createIdInput = document.getElementById('create-athlete-id');
    const lookupVal = document.getElementById('lookup-athlete-id').value.trim();
    if (createIdInput) createIdInput.value = lookupVal;
}

function cancelCreateId() {
    document.getElementById('create-id-panel').classList.add('hidden');
    document.getElementById('profile-lookup-panel').classList.remove('hidden');
}

async function verifyAndReserveId() {
    const inputVal = document.getElementById('create-athlete-id').value;
    const errorEl = document.getElementById('create-id-error');
    const cleanId = inputVal.replace(/[^a-zA-Z0-9_]/g, '').trim();

    if (!cleanId) {
        errorEl.innerText = "Athlete ID must contain alphanumeric characters or underscores.";
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    showAutopilotLoader();

    try {
        const doc = await db.collection("users").doc(cleanId).get();
        if (doc.exists) {
            hideAutopilotLoader();
            errorEl.innerText = `The Athlete ID "${cleanId}" is already taken. Please choose another.`;
            errorEl.classList.remove('hidden');
        } else {
            hideAutopilotLoader();

            // Route to medical disclaimer
            document.getElementById('create-id-panel').classList.add('hidden');
            document.getElementById('medical-disclaimer-panel').classList.remove('hidden');
            document.getElementById('medical-ack').checked = false;
            toggleDisclaimerNextBtn();

            // Prep the main intake form ID field
            const intakeAthleteId = document.getElementById('intake-athlete-id');
            if (intakeAthleteId) {
                intakeAthleteId.value = cleanId;
            }
        }
    } catch (err) {
        console.error("ID verification error:", err);
        hideAutopilotLoader();
        errorEl.innerText = "Connection error verifying ID. Please try again.";
        errorEl.classList.remove('hidden');
    }
}

async function submitProfileLookup() {
    const input = document.getElementById('lookup-athlete-id');
    const errorEl = document.getElementById('lookup-error');
    const val = input.value.trim();
    if (!val) {
        if (errorEl) {
            errorEl.innerText = "Please enter an Athlete ID.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (errorEl) errorEl.classList.add('hidden');
    showAutopilotLoader();

    try {
        const doc = await db.collection("users").doc(val).get();
        if (doc.exists) {
            hideAutopilotLoader();
            hideOnboardingModal();
            setupProfileSync(val);
        } else {
            hideAutopilotLoader();
            if (errorEl) {
                errorEl.innerText = `Athlete ID "${val}" not found. Please check spelling or create a new profile.`;
                errorEl.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Lookup failure: ", err);
        hideAutopilotLoader();
        if (errorEl) {
            errorEl.innerText = "Connection error. Please try again.";
            errorEl.classList.remove('hidden');
        }
    }
}

function showOnboardingModal(profileId) {
    showProfileLookupPanel(profileId);
}

function hideOnboardingModal() {
    document.getElementById('onboarding-modal').classList.add('hidden');
}

function toggleDisclaimerNextBtn() {
    const checked = document.getElementById('medical-ack').checked;
    const btn = document.getElementById('btn-disclaimer-next');
    if (checked) {
        btn.disabled = false;
        btn.className = "w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg cursor-pointer text-xs";
    } else {
        btn.disabled = true;
        btn.className = "w-full bg-slate-850 text-slate-500 py-3 rounded-xl font-bold transition-all cursor-not-allowed text-xs";
    }
}

async function acceptMedicalDisclaimer() {
    document.getElementById('medical-disclaimer-panel').classList.add('hidden');
    document.getElementById('onboarding-form-panel').classList.remove('hidden');
    goToOnboardingStep(1);

    const cleanId = document.getElementById('intake-athlete-id').value;
    if (cleanId) {
        try {
            await db.collection('legal_agreements').doc(cleanId).set({
                athleteId: cleanId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent,
                acceptedLiabilityDisclaimer: true
            });
            console.log("Logged medical disclaimer acceptance.");
        } catch (e) {
            console.warn("Could not log legal agreement immediately", e);
        }
    }
}

function calculateOnboardingGoalPace(baselineMin, baselineSec, targetDateStr, tier) {
    const baselineSeconds = (baselineMin * 60) + baselineSec;
    const targetDate = new Date(targetDateStr);
    const currentDate = new Date();
    const diffTime = targetDate - currentDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const W = Math.max(1, Math.ceil(diffDays / 7));

    let pScale = 0;
    if (tier === 'recreational') {
        pScale = Math.min(0.50 * W, 10);
    } else if (tier === 'progressive') {
        pScale = Math.min(1.00 * W, 15);
    } else if (tier === 'ambitious') {
        pScale = Math.min(1.25 * W, 22.5);
    } else if (tier === 'elite') {
        pScale = Math.min(1.50 * W, 30);
    }

    const targetSeconds = Math.floor(baselineSeconds * (1 - (pScale / 100)));
    const targetMin = Math.floor(targetSeconds / 60);
    const targetSec = targetSeconds % 60;
    return `${targetMin}:${targetSec < 10 ? '0' : ''}${targetSec}`;
}
let parsedIntakeWorkout = null;

async function handleIntakeFileUpload(input) {
    const statusEl = document.getElementById('intake-file-status');
    const previewEl = document.getElementById('intake-file-preview');

    if (!input.files || input.files.length === 0) {
        parsedIntakeWorkout = null;
        if (statusEl) {
            statusEl.innerText = "";
            statusEl.classList.add('hidden');
        }
        if (previewEl) previewEl.classList.add('hidden');
        return;
    }

    const file = input.files[0];
    if (statusEl) {
        statusEl.innerText = "Parsing workout file...";
        statusEl.classList.remove('hidden');
    }

    try {
        const parsed = await parseWorkoutFile(file);
        parsedIntakeWorkout = {
            fileName: parsed.fileName,
            format: parsed.format,
            distance: parsed.distance,
            duration: parsed.duration,
            pace: parsed.pace,
            avgCadence: parsed.avgCadence,
            avgHeartRate: parsed.avgHeartRate,
            maxHeartRate: parsed.maxHeartRate,
            elevationGain: parsed.elevationGain,
            avgGradient: parsed.avgGradient,
            uploadedAt: new Date().toISOString()
        };

        if (statusEl) {
            statusEl.className = "text-[10px] text-emerald-450 font-bold mt-2";
            statusEl.innerText = `Successfully parsed: ${parsed.fileName}`;
        }

        // Auto-populate manual entry fields
        const minInput = document.getElementById('intake-pace-min');
        const secInput = document.getElementById('intake-pace-sec');
        const distanceInput = document.getElementById('intake-distance');

        if (parsed.pace) {
            const parts = parsed.pace.split(':');
            if (parts.length === 2) {
                if (minInput) minInput.value = parseInt(parts[0]);
                if (secInput) secInput.value = parseInt(parts[1]);
            }
        }

        if (parsed.distance && distanceInput) {
            distanceInput.value = parsed.distance;
        }

        // Show dynamic workout preview
        if (previewEl) {
            previewEl.innerHTML = `
                        <div class="font-bold text-indigo-400 uppercase tracking-widest text-[9px] mb-1.5 flex items-center gap-1">
                            <i class="fa-solid fa-square-poll-vertical text-[10px]"></i> Coach Insights: Parsed Workout Baseline
                        </div>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-350">
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Distance:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.distance} mi</strong></div>
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Avg Pace:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.pace} /mi</strong></div>
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Cadence:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.avgCadence ? parsed.avgCadence + ' spm' : 'N/A'}</strong></div>
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Avg / Max HR:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.avgHeartRate ? parsed.avgHeartRate + ' / ' + parsed.maxHeartRate + ' bpm' : 'N/A'}</strong></div>
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Elevation Gain:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.elevationGain ? parsed.elevationGain + ' ft' : 'N/A'}</strong></div>
                            <div><span class="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Avg Gradient:</span> <strong class="text-slate-100 font-mono font-bold">${parsed.avgGradient ? parsed.avgGradient + '%' : 'N/A'}</strong></div>
                        </div>
                    `;
            previewEl.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Intake GPX parsing error: ", err);
        parsedIntakeWorkout = null;
        if (statusEl) {
            statusEl.className = "text-[10px] text-rose-450 font-bold mt-2";
            statusEl.innerText = `Error parsing file: ${err.message}`;
        }
        if (previewEl) previewEl.classList.add('hidden');
    }
}

function selectFitness(level) {
    document.getElementById('intake-fitness-level').value = level;

    document.getElementById('fit-brand_new').classList.remove('border-green-500', 'bg-green-900/50');
    document.getElementById('fit-returning').classList.remove('border-teal-500', 'bg-teal-900/50');
    document.getElementById('fit-intermediate').classList.remove('border-blue-500', 'bg-blue-900/50');
    document.getElementById('fit-advanced').classList.remove('border-purple-500', 'bg-purple-900/50');

    document.getElementById('fit-brand_new').classList.add('border-slate-700', 'bg-slate-900');
    document.getElementById('fit-returning').classList.add('border-slate-700', 'bg-slate-900');
    document.getElementById('fit-intermediate').classList.add('border-slate-700', 'bg-slate-900');
    document.getElementById('fit-advanced').classList.add('border-slate-700', 'bg-slate-900');

    if (level === 'brand_new') {
        document.getElementById('fit-brand_new').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('fit-brand_new').classList.add('border-green-500', 'bg-green-900/50');
        document.getElementById('training-focus-container').classList.add('hidden');
    } else if (level === 'returning') {
        document.getElementById('fit-returning').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('fit-returning').classList.add('border-teal-500', 'bg-teal-900/50');
        document.getElementById('training-focus-container').classList.add('hidden');
    } else if (level === 'intermediate') {
        document.getElementById('fit-intermediate').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('fit-intermediate').classList.add('border-blue-500', 'bg-blue-900/50');
        document.getElementById('training-focus-container').classList.remove('hidden');
    } else if (level === 'advanced') {
        document.getElementById('fit-advanced').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('fit-advanced').classList.add('border-purple-500', 'bg-purple-900/50');
        document.getElementById('training-focus-container').classList.remove('hidden');
    }
}

function selectStrength(type) {
    document.getElementById('intake-strength').value = type;

    const opts = ['runner_specific', 'full_body', 'none'];
    opts.forEach(opt => {
        const el = document.getElementById('strength-' + opt);
        if(el) {
            el.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-500/20', 'font-bold');
            el.classList.add('bg-transparent', 'text-slate-400', 'font-medium', 'hover:bg-slate-800/50', 'hover:text-slate-200');
        }
    });

    const sel = document.getElementById('strength-' + type);
    if(sel) {
        sel.classList.remove('bg-transparent', 'text-slate-400', 'font-medium', 'hover:bg-slate-800/50', 'hover:text-slate-200');
        sel.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-500/20', 'font-bold');
    }
}

function selectGoal(goal) {
    document.getElementById('intake-primary-goal').value = goal;

    document.getElementById('goal-health').classList.remove('border-emerald-500', 'bg-emerald-900/50');
    document.getElementById('goal-race').classList.remove('border-amber-500', 'bg-amber-900/50');

    document.getElementById('goal-health').classList.add('border-slate-700', 'bg-slate-900');
    document.getElementById('goal-race').classList.add('border-slate-700', 'bg-slate-900');

    document.getElementById('dynamic-form-race').classList.add('hidden');
    document.getElementById('dynamic-form-strength').classList.add('hidden');

    const descBrandNew = document.getElementById('desc-brand_new');
    const descReturning = document.getElementById('desc-returning');
    const descIntermediate = document.getElementById('desc-intermediate');
    const descAdvanced = document.getElementById('desc-advanced');

    if (goal === 'health') {
        document.getElementById('goal-health').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('goal-health').classList.add('border-emerald-500', 'bg-emerald-900/50');

        if (descBrandNew) descBrandNew.innerText = "Starting fresh. Focusing on building a consistent habit and learning the basics.";
        if (descReturning) descReturning.innerText = "Returning to build consistency after time off.";
        if (descIntermediate) descIntermediate.innerText = "Occasionally active. Looking to build strength and improve overall health.";
        if (descAdvanced) descAdvanced.innerText = "Consistently active. Seeking a balanced, well-rounded fitness regimen.";

    } else if (goal === 'race') {
        document.getElementById('goal-race').classList.remove('border-slate-700', 'bg-slate-900');
        document.getElementById('goal-race').classList.add('border-amber-500', 'bg-amber-900/50');
        document.getElementById('dynamic-form-race').classList.remove('hidden');
        document.getElementById('dynamic-form-strength').classList.remove('hidden');

        if (descBrandNew) descBrandNew.innerText = "Completely new to running. Needs to start with the fundamentals.";
        if (descReturning) descReturning.innerText = "Returning / refresh after a long break.";
        if (descIntermediate) descIntermediate.innerText = "Runs regularly, building endurance or speed.";
        if (descAdvanced) descAdvanced.innerText = "High mileage, training for specific time goals.";
    }
}


async function getGoalPaces() {
    const fitness = document.getElementById('intake-fitness-level').value;
    const targetDistance = document.getElementById('intake-target-distance').value;
    const targetDate = document.getElementById('intake-date').value;
    const currentPace = document.getElementById('intake-current-pace').value;
    const daysAvailable = document.getElementById('intake-days-available').value;
    const generalStr = document.getElementById('intake-general').value.trim();
    const goalsStr = document.getElementById('intake-goals').value.trim();
    const limStr = document.getElementById('intake-limitations').value.trim();

    let combinedNotes = "";
    if (generalStr) combinedNotes += `General: ${generalStr}\n`;
    if (goalsStr) combinedNotes += `Goals: ${goalsStr}\n`;
    if (limStr) combinedNotes += `Limitations: ${limStr}\n`;
    const notes = combinedNotes.trim();
    const why = document.getElementById('intake-why').value;

    if (!fitness || !targetDate || !currentPace) {
        alert("Please fill out Fitness Level, Target Date, and Current Pace first.");
        return;
    }

    const btnIcon = document.getElementById('goal-pace-spinner');
    btnIcon.classList.remove('fa-wand-magic-sparkles');
    btnIcon.classList.add('fa-spinner', 'fa-spin');

    try {
        const proposeGoalPaces = firebase.functions().httpsCallable('proposeGoalPaces');

        let birthYearVal = parseInt(document.getElementById('intake-birthyear').value);
        let ageVal = isNaN(birthYearVal) ? null : new Date().getFullYear() - birthYearVal;

        const result = await proposeGoalPaces({
            age: ageVal,
            weight: document.getElementById('intake-weight').value || null,
            sex: document.getElementById('intake-sex').value || null,
            fitnessLevel: fitness,
            targetDistance: targetDistance,
            targetDate: targetDate,
            currentPace: currentPace,
            daysAvailable: daysAvailable,
            notes: notes,
            why: why
        });

        const container = document.getElementById('goal-pace-proposals');
        container.innerHTML = '';

        if (result.data && result.data.paces) {
            const tiers = ['Elite', 'Aggressive', 'Progressive', 'Consistent'];
            const colors = ['border-fuchsia-500 text-fuchsia-400', 'border-red-500 text-red-400', 'border-amber-500 text-amber-400', 'border-emerald-500 text-emerald-400'];

            tiers.forEach((tier, i) => {
                const pace = result.data.paces[tier] || 'N/A';
                container.innerHTML += `
                            <div onclick="document.getElementById('intake-goal-pace').value = '${pace}'" class="cursor-pointer border border-slate-700 bg-slate-900 hover:bg-slate-800 p-2 rounded-xl text-center transition-all">
                                <div class="text-[10px] uppercase font-bold text-slate-500">${tier}</div>
                                <div class="font-bold text-sm ${colors[i].split(' ')[1]} mt-0.5">${pace}</div>
                            </div>
                        `;
            });
            container.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        alert('Error proposing paces');
    }

    btnIcon.classList.remove('fa-spinner', 'fa-spin');
    btnIcon.classList.add('fa-wand-magic-sparkles');
}

async function submitOnboardingForm() {
    const intakeAthleteId = document.getElementById('intake-athlete-id').value.trim();
    const title = document.getElementById('intake-title').value.trim();
    const why = document.getElementById('intake-why').value.trim();
    const generalStr = document.getElementById('intake-general').value.trim();
    const goalsStr = document.getElementById('intake-goals').value.trim();
    const limitationsStr = document.getElementById('intake-limitations').value.trim();

    let notesParts = [];
    if (generalStr) notesParts.push(`General: ${generalStr}`);
    if (goalsStr) notesParts.push(`Goals: ${goalsStr}`);
    if (limitationsStr) notesParts.push(`Limitations: ${limitationsStr}`);
    const notes = notesParts.join(" | ");

    const birthYear = parseInt(document.getElementById('intake-birthyear').value);
    const currentYear = new Date().getFullYear();
    const age = birthYear ? (currentYear - birthYear) : null;
    const weight = parseFloat(document.getElementById('intake-weight').value);
    const sex = document.getElementById('intake-sex').value;
    const ft = parseInt(document.getElementById('intake-height-ft').value) || 0;
    const inch = parseInt(document.getElementById('intake-height-in').value) || 0;
    const heightInches = (ft * 12) + inch;

    const fitnessLevel = document.getElementById('intake-fitness-level').value;
    const primaryGoal = document.getElementById('intake-primary-goal').value;

    const daysAvailable = parseInt(document.getElementById('intake-days-available').value);
    const minsAvailable = parseInt(document.getElementById('intake-mins-available').value) || 45;
    const strength = document.getElementById('intake-strength').value;
    const targetWeightRaw = document.getElementById('intake-target-weight').value;
    const targetWeight = targetWeightRaw ? parseFloat(targetWeightRaw) : null;

    const equipmentList = Array.from(window.selectedEquipment);

    let trainingFocusRatio = "auto";
    if (fitnessLevel !== 'brand_new' && fitnessLevel !== 'returning') {
        const sliderVal = document.getElementById('intake-training-focus')?.value;
        if (sliderVal) trainingFocusRatio = parseInt(sliderVal);
    }

    if (!intakeAthleteId) {
        alert("Please specify a unique Athlete ID.");
        return;
    }

    const cleanId = intakeAthleteId.replace(/[^a-zA-Z0-9_]/g, '').trim();
    if (!cleanId) {
        alert("Athlete ID must contain alphanumeric characters or underscores.");
        return;
    }

    if (!age || !weight || !fitnessLevel || !primaryGoal || !daysAvailable || !title) {
        alert("Please fill out all required base fields (Age, Weight, Fitness, Goal, Days, Title).");
        return;
    }

    // Collect dynamic fields
    let dynamicData = {};
    let activeAdjustedGoal = "10:00"; // fallback

    if (primaryGoal === 'race') {
        dynamicData = {
            targetDistance: document.getElementById('intake-target-distance').value,
            targetDate: document.getElementById('intake-date').value,
            currentPace: document.getElementById('intake-current-pace').value,
            goalPace: document.getElementById('intake-goal-pace').value
        };
        if (!dynamicData.targetDate) {
            alert("Please select a target date for your race goal.");
            return;
        }
        activeAdjustedGoal = dynamicData.goalPace || dynamicData.currentPace || "10:00";
    }

    showAutopilotLoader();

    const userDocRef = db.collection("users").doc(cleanId);
    userId = cleanId;
    localStorage.setItem('yf_active_profile', userId);

    const todayStr = new Date().toISOString().split('T')[0];

    let coachJourneyComments = `Welcome to your training plan. Your goal is set to ${primaryGoal.toUpperCase()}. We have adapted the initial block to your fitness level (${fitnessLevel}).`;

    const profilePayload = {
        activeAdjustedGoal: activeAdjustedGoal,
        userBaselineNotes: notes,
        title: title,
        why: why,
        desiredWorkoutLength: minsAvailable,
        journeyTitle: title,
        userBaselineNotes: notes,
        whyMotivation: why,
        journeyStartDate: todayStr,
        birthYear: birthYear,
        age: age,
        weight: weight,
        heightInches: heightInches > 0 ? heightInches : null,
        sex: sex,
        fitnessLevel: fitnessLevel,
        primaryGoal: primaryGoal,
        dynamicGoalData: dynamicData,
        trainingFocusRatio: trainingFocusRatio,
        daysAvailable: daysAvailable,
        targetWeight: targetWeight,
        includeStrength: strength !== 'none',
        strengthType: strength,
        equipmentList: equipmentList,
        activeAdjustedGoal: activeAdjustedGoal,
        baseline5k: dynamicData.currentPace || "10:00",
        paceHistory: [
            { phase: 1, pace: dynamicData.currentPace || "10:00", date: todayStr, label: "Start", index: 0 }
        ],
        bmiHistory: [
            { date: new Date().toISOString(), weight: weight, bmi: parseFloat(((weight / (heightInches * heightInches)) * 703).toFixed(1)) }
        ],
        medicalAcknowledge: true,
        journeyComments: coachJourneyComments,
        currentPhaseIndex: 1,
        journeyStatus: "pending_review"
    };

    try {
        const ticker = document.getElementById('autopilot-loading-ticker');
        if (ticker) ticker.innerText = "Designing macrocycle roadmap...";
        const generateMacrocyclePlan = firebase.functions().httpsCallable('generateMacrocyclePlan');
        const cleanProfilePayload = JSON.parse(JSON.stringify(profilePayload));
        const planResult = await generateMacrocyclePlan({ profile: cleanProfilePayload });
        if (targetWeight) {
            document.getElementById('review-target-weight-badge').classList.remove('hidden');
            document.getElementById('review-target-weight-val').innerText = targetWeight;
        } else {
            document.getElementById('review-target-weight-badge').classList.add('hidden');
        }

        if (planResult.data && planResult.data.macrocyclePlan) {
            profilePayload.macrocyclePlan = planResult.data.macrocyclePlan;
            profilePayload.overarchingTheme = planResult.data.overarchingTheme || "Your Training Journey";
        } else {
            throw new Error("Invalid format");
        }
    } catch (err) {
        console.warn("Failed to generate AI macrocycle, falling back to default.", err);
        profilePayload.macrocyclePlan = [
            { phase: 1, theme: "Baseline Establishment", description: "Getting familiar with consistent volume and intensity." }
        ];
        profilePayload.overarchingTheme = "Your Training Journey";
    }

    if (parsedIntakeWorkout) {
        profilePayload.parsedBaselineWorkout = parsedIntakeWorkout;
    }

    try {
        if (isRestartingJourney) {
            // Create archive object from previous journey
            const archiveObject = {
                journeyStartDate: userProfileData.journeyStartDate || null,
                journeyEndDate: new Date().toISOString(),
                journeyTitle: userProfileData.journeyTitle || null,
                primaryGoal: userProfileData.primaryGoal || null,
                startingWeight: userProfileData.startingWeight || userProfileData.weight || null,
                endingWeight: weight,
                baselinePace: userProfileData.baseline5k || null,
                endingPace: activeAdjustedGoal || null
            };

            profilePayload.historicalJourneys = firebase.firestore.FieldValue.arrayUnion(archiveObject);

            await userDocRef.update(profilePayload);
            const batchArchive = db.batch();
            const activePhaseSnapshot = await userDocRef.collection("active_phase").get();
            activePhaseSnapshot.forEach(doc => {
                const w = doc.data();
                if (w.completed) {
                    batchArchive.set(userDocRef.collection("history").doc(w.id), w);
                }
                batchArchive.delete(userDocRef.collection("active_phase").doc(w.id));
            });
            await batchArchive.commit();
        } else {
            await userDocRef.set(profilePayload);
        }

        let p1Workouts = [];
        try {
            const ticker = document.getElementById('autopilot-loading-ticker');
            if (ticker) ticker.innerText = "Designing initial workout block...";
            const generateWorkoutBlock = firebase.functions().httpsCallable('generateWorkoutBlock');
            const cleanProfilePayload = JSON.parse(JSON.stringify(profilePayload));
            const aiResult = await generateWorkoutBlock({
                phaseIndex: 1,
                profile: cleanProfilePayload,
                history: []
            });
            p1Workouts = aiResult.data.workouts || getPhase1DefaultWorkouts();
            const strengthGuides = aiResult.data.strengthGuides || [];
            let updatePayload = {};
            if (strengthGuides.length > 0) {
                updatePayload.currentStrengthGuides = strengthGuides;
                updatePayload.simpleStrengthGuides = firebase.firestore.FieldValue.delete();
                const simpleToggle = document.getElementById('simple-mode-toggle');
                if (simpleToggle) simpleToggle.checked = false;
            }

            if (Object.keys(updatePayload).length > 0) {
                await userDocRef.update(updatePayload);
            }
        } catch (error) {
            console.error("Failed to generate AI initial workouts, falling back to defaults.", error);
            p1Workouts = getPhase1DefaultWorkouts();
        }

        const batch = db.batch();
        p1Workouts.forEach((w) => {
            batch.set(userDocRef.collection("active_phase").doc(w.id), w);
        });
        await batch.commit();
        isRestartingJourney = false;

        setTimeout(() => {
            hideAutopilotLoader();
            setupProfileSync(userId);
        }, 3000);
    } catch (err) {
        console.error("Onboarding setup failure: ", err);
        hideAutopilotLoader();
        alert("Firestore error seeding plan.");
    }
}

// 3. Render checklist UI to Flat JIT Layout
