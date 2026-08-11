function openProfileModal() {
            if (userProfileData) {
                if (userProfileData.birthYear) {
                    document.getElementById('modal-birthyear').value = userProfileData.birthYear;
                } else if (userProfileData.age) {
                    document.getElementById('modal-birthyear').value = new Date().getFullYear() - userProfileData.age;
                } else {
                    document.getElementById('modal-birthyear').value = "";
                }
                document.getElementById('modal-weight').value = userProfileData.weight || "";
                document.getElementById('modal-target-weight').value = userProfileData.targetWeight || "";
                document.getElementById('modal-sex').value = userProfileData.sex || "male";
                if (userProfileData.heightInches) {
                    document.getElementById('modal-height-ft').value = Math.floor(userProfileData.heightInches / 12);
                    document.getElementById('modal-height-in').value = userProfileData.heightInches % 12;
                } else {
                    document.getElementById('modal-height-ft').value = "";
                    document.getElementById('modal-height-in').value = "";
                }
                document.getElementById('modal-workout-length').value = userProfileData.desiredWorkoutLength || 45;
                document.getElementById('modal-days-available').value = userProfileData.daysAvailable || 4;
                document.getElementById('modal-include-strength').value = userProfileData.strengthType || "runner_specific";
                document.getElementById('modal-why-notes').value = userProfileData.why || "";
                document.getElementById('modal-baseline-notes').value = userProfileData.userBaselineNotes || "";

                // Fix for users who had their personal notes accidentally copied to chronic limitations
                let chronic = userProfileData.chronicLimitations || "";
                if (chronic === (userProfileData.userBaselineNotes || "")) {
                    chronic = "";
                }
                document.getElementById('modal-chronic-limitations').value = chronic;
                document.getElementById('modal-acute-injuries').value = userProfileData.acuteInjuries || "";

                const hwChecked = userProfileData.equipmentList || [];
                window.selectedEquipment = new Set(hwChecked);
                if (window.renderBubbles) window.renderBubbles('modal-equipment-bubbles');

                modalGPXCleared = false;
                const statusEl = document.getElementById('modal-gpx-status');
                const clearBtn = document.getElementById('modal-gpx-clear-btn');
                if (statusEl) {
                    if (userProfileData.parsedBaselineWorkout) {
                        statusEl.className = "text-[10px] text-indigo-400 font-bold";
                        statusEl.innerText = `Current: ${userProfileData.parsedBaselineWorkout.fileName}`;
                        if (clearBtn) clearBtn.classList.remove('hidden');
                    } else {
                        statusEl.className = "text-[10px] text-slate-500 italic";
                        statusEl.innerText = "No file uploaded";
                        if (clearBtn) clearBtn.classList.add('hidden');
                    }
                }
                tempModalGPXData = null;

                // Check if user is missing AI Insights or Journey Blueprint
                const refreshBtn = document.getElementById('btn-refresh-insights');
                if (refreshBtn) {
                    const hasInsights = userProfileData && userProfileData.healthInsights;
                    const hasEnrichedMacrocyclePlan = userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0 && userProfileData.macrocyclePlan[0].expectedDurationWeeks;
                    const hasTips = typeof activePhaseWorkouts !== 'undefined' && activePhaseWorkouts.length > 0 && activePhaseWorkouts.every(w => w.jitPreparationTip);
                    if (hasInsights && hasTips && hasEnrichedMacrocyclePlan) {
                        refreshBtn.classList.add('hidden');
                        refreshBtn.classList.remove('flex');
                    } else {
                        refreshBtn.classList.remove('hidden');
                        refreshBtn.classList.add('flex');
                    }
                }

                const notifToggle = document.getElementById('modal-weight-notifications-toggle');
                if (notifToggle) {
                    notifToggle.checked = !!(userProfileData && userProfileData.notificationsEnabled);
                }

                const pmToggle = document.getElementById('modal-prescriptive-meals-toggle');
                const dietaryNotesEl = document.getElementById('modal-dietary-notes');
                if (pmToggle) {
                    const isChecked = !!(userProfileData && userProfileData.prescriptiveMeals);
                    pmToggle.checked = isChecked;
                    if (typeof window.toggleDietaryNotes === 'function') window.toggleDietaryNotes(isChecked);
                }
                if (dietaryNotesEl) {
                    dietaryNotesEl.value = (userProfileData && userProfileData.dietaryPreferences) || "";
                }

                if (typeof window.validateTargetWeight === 'function') {
                    window.validateTargetWeight();
                }
            }
            document.getElementById('profile-edit-modal').classList.remove('hidden');
        }

function closeProfileModal() {
            document.getElementById('profile-edit-modal').classList.add('hidden');
        }

function saveProfileModal() {
            const lengthVal = parseInt(document.getElementById('modal-workout-length').value) || 45;
            const weightVal = parseFloat(document.getElementById('modal-weight').value) || null;
            const targetWeightVal = parseFloat(document.getElementById('modal-target-weight').value) || null;
            const ftVal = parseInt(document.getElementById('modal-height-ft').value) || 0;
            const inVal = parseInt(document.getElementById('modal-height-in').value) || 0;
            const heightInchesVal = (ftVal * 12) + inVal > 0 ? (ftVal * 12) + inVal : null;
            const daysAvailableVal = parseInt(document.getElementById('modal-days-available').value) || 4;
            const strengthTypeVal = document.getElementById('modal-include-strength').value;
            const whyNotesVal = document.getElementById('modal-why-notes').value.trim();
            const baselineVal = document.getElementById('modal-baseline-notes').value.trim();
            const chronicVal = document.getElementById('modal-chronic-limitations').value.trim();
            const acuteVal = document.getElementById('modal-acute-injuries').value.trim();

            const hardwareList = Array.from(window.selectedEquipment);

            const notifToggle = document.getElementById('modal-weight-notifications-toggle');
            const notificationsEnabledVal = notifToggle ? notifToggle.checked : false;

            const pmToggle = document.getElementById('modal-prescriptive-meals-toggle');
            const prescriptiveMealsVal = pmToggle ? pmToggle.checked : false;
            const dietaryNotesEl = document.getElementById('modal-dietary-notes');
            const dietaryPreferencesVal = dietaryNotesEl ? dietaryNotesEl.value.trim() : "";

            if (db && userId) {
                const updates = {
                    desiredWorkoutLength: lengthVal,
                    weight: weightVal,
                    heightInches: heightInchesVal,
                    daysAvailable: daysAvailableVal,
                    includeStrength: strengthTypeVal !== 'none',
                    strengthType: strengthTypeVal,
                    why: whyNotesVal,
                    userBaselineNotes: baselineVal,
                    chronicLimitations: chronicVal,
                    acuteInjuries: acuteVal,
                    equipmentList: hardwareList,
                    notificationsEnabled: notificationsEnabledVal,
                    prescriptiveMeals: prescriptiveMealsVal,
                    dietaryPreferences: dietaryPreferencesVal
                };
                if (userProfileData) {
                    userProfileData.notificationsEnabled = notificationsEnabledVal;
                    userProfileData.prescriptiveMeals = prescriptiveMealsVal;
                    userProfileData.dietaryPreferences = dietaryPreferencesVal;
                }
                if (typeof checkWeightReminderBanner === 'function') checkWeightReminderBanner(userProfileData);
                if (targetWeightVal) updates.targetWeight = targetWeightVal;

                if (userProfileData && userProfileData.weight !== weightVal) {
                    let historyUpdate = userProfileData.bmiHistory || [];
                    if (historyUpdate.length === 0 && userProfileData.weight) {
                        historyUpdate.push({
                            date: userProfileData.journeyStartDate || new Date().toISOString(),
                            weight: userProfileData.weight
                        });
                    }
                    historyUpdate.push({
                        date: new Date().toISOString(),
                        weight: weightVal
                    });
                    updates.bmiHistory = historyUpdate;
                }

                if (modalGPXCleared) {
                    updates.parsedBaselineWorkout = firebase.firestore.FieldValue.delete();
                } else if (tempModalGPXData) {
                    updates.parsedBaselineWorkout = tempModalGPXData;
                    // Auto-adjust baseline parameters
                    updates.baseline5k = tempModalGPXData.pace;
                    updates.currentEstimated5k = tempModalGPXData.pace;

                    const minSec = tempModalGPXData.pace.split(':');
                    if (minSec.length === 2) {
                        document.getElementById('input-min').value = parseInt(minSec[0]);
                        document.getElementById('input-sec').value = parseInt(minSec[1]);
                    }
                }

                db.collection("users").doc(userId).update(updates).then(() => {
                    console.log("Profile updated successfully in Firestore.");
                    tempModalGPXData = null;
                    calculateTargetPaces();
                    closeProfileModal();
                }).catch(err => {
                    console.error("Failed to update profile constraints:", err);
                    alert("Error saving updates to Firestore.");
                });
            } else {
                closeProfileModal();
            }
        }

window.toggleDietaryNotes = function (checked) {
            const container = document.getElementById('modal-dietary-notes-container');
            if (container) {
                if (checked) {
                    container.classList.remove('hidden');
                    container.classList.add('flex');
                } else {
                    container.classList.add('hidden');
                    container.classList.remove('flex');
                }
            }
        }

async function refreshAIInsights() {
            try {
                const btn = document.getElementById('btn-refresh-insights');
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Refreshing...`;
                    btn.disabled = true;
                }
                const backfillAIInsights = firebase.functions().httpsCallable('backfillAIInsights');
                const cleanProfile = JSON.parse(JSON.stringify(userProfileData));
                const result = await backfillAIInsights({
                    profile: cleanProfile,
                    history: [],
                    activeWorkouts: activePhaseWorkouts
                });

                const data = result.data;
                if (!data || !data.healthInsights) throw new Error("Invalid response from AI");

                // Batch write to Firestore
                const batch = db.batch();

                // 1. Update Profile (Non-Destructive Enrichment)
                const profileRef = db.collection("users").doc(userId);
                let profileUpdates = {
                    healthInsights: data.healthInsights
                };
                if (data.macrocyclePlan) profileUpdates.macrocyclePlan = data.macrocyclePlan;
                batch.update(profileRef, profileUpdates);

                // Update local memory so we don't need a hard refresh
                if (data.macrocyclePlan) userProfileData.macrocyclePlan = data.macrocyclePlan;
                if (data.workoutTips && Array.isArray(data.workoutTips)) {
                    data.workoutTips.forEach(tip => {
                        if (tip.id && tip.jitPreparationTip) {
                            const workoutRef = db.collection("users").doc(userId).collection("active_phase").doc(tip.id);
                            batch.update(workoutRef, {
                                jitPreparationTip: tip.jitPreparationTip
                            });
                        }
                    });
                }

                await batch.commit();

                closeProfileModal();
                alert("AI Insights successfully refreshed! Loading latest data...");
                location.reload();
            } catch (err) {
                console.error("Failed to refresh AI Insights:", err);
                alert("Failed to refresh AI Insights.");
                const btn = document.getElementById('btn-refresh-insights');
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Refresh AI Insights`;
                    btn.disabled = false;
                }
            }
        }

async function refreshAITimelineDetails() {
            try {
                const btn = document.getElementById('btn-refresh-timeline');
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Refreshing...`;
                    btn.disabled = true;
                }
                const upgradeMacrocycleDescriptions = firebase.functions().httpsCallable('upgradeMacrocycleDescriptions');

                let planToUpgrade = [];
                if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
                    planToUpgrade = userProfileData.macrocyclePlan;
                } else {
                    throw new Error("No macrocycle plan exists to upgrade.");
                }

                const result = await upgradeMacrocycleDescriptions({
                    macrocyclePlan: planToUpgrade
                });

                const data = result.data;
                if (!data || !data.macrocyclePlan) throw new Error("Invalid response from AI");

                const profileRef = db.collection("users").doc(userId);
                await profileRef.update({
                    macrocyclePlan: data.macrocyclePlan
                });

                userProfileData.macrocyclePlan = data.macrocyclePlan;
                updateTimelineView(userProfileData.currentPhaseIndex || 1);

                closeProfileModal();
                alert("AI Timeline Details successfully refreshed!");
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-timeline"></i> Refresh AI Timeline Details`;
                    btn.disabled = false;
                }
            } catch (err) {
                console.error("Failed to refresh AI Timeline Details:", err);
                alert("Failed to refresh AI Timeline Details.");
                const btn = document.getElementById('btn-refresh-timeline');
                if (btn) {
                    btn.innerHTML = `<i class="fa-solid fa-timeline"></i> Refresh AI Timeline Details`;
                    btn.disabled = false;
                }
            }
        }

window.switchNutritionTab = function (tier) {
                const tabs = ['rest', 'light', 'hard'];
                tabs.forEach(t => {
                    const activeClass = "px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 text-white transition-all cursor-pointer";
                    const inactiveClass = "px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer";

                    // Tab 2 Elements
                    const tabEl = document.getElementById(`tab-nut-${t}`);
                    const insightEl = document.getElementById(`insight-nut-${t}`);
                    if (tabEl && insightEl) {
                        tabEl.className = t === tier ? activeClass : inactiveClass;
                        insightEl.className = t === tier ? "block" : "hidden";
                    }

                    // Home Tab Elements
                    const homeTabEl = document.getElementById(`home-tab-nut-${t}`);
                    const homeInsightEl = document.getElementById(`home-insight-nut-${t}`);
                    if (homeTabEl && homeInsightEl) {
                        homeTabEl.className = t === tier ? activeClass : inactiveClass;
                        homeInsightEl.className = t === tier ? "block" : "hidden";
                    }
                });
            }

window.openFullJourneyModal = function () {
                document.getElementById('full-journey-modal').classList.remove('hidden');
                if (userProfileData) {
                    // Triggers the chart to draw in the full-journey-chart context
                    console.log("openFullJourneyModal clicked!", userProfileData);
                    setTimeout(() => {
                        try {
                            updateDashboardBMI(userProfileData, true);
                        } catch (e) {
                            console.error("Crash in updateDashboardBMI:", e);
                            alert("Chart Error: " + e.message);
                        }
                    }, 100); // Wait for modal layout to render before initializing chart
                } else {
                    console.warn("userProfileData is undefined!");
                }
            }

window.closeFullJourneyModal = function () {
                document.getElementById('full-journey-modal').classList.add('hidden');
                // Re-draw normal dashboard chart
                if (userProfileData) updateDashboardBMI(userProfileData, false);
            }



window.refreshNutritionOnly = async function (btnElement) {
            let icon = null;
            if (btnElement) {
                icon = btnElement.querySelector('i');
                if (icon) icon.className = "fa-solid fa-rotate fa-spin text-emerald-400";
                btnElement.disabled = true;
            }
            try {
                const cleanProfile = JSON.parse(JSON.stringify(userProfileData || {}));
                let nutritionHeuristics = null;

                // 1. Try dedicated endpoint first
                try {
                    const fn = firebase.functions().httpsCallable('refreshNutritionOnly');
                    const result = await fn({ profile: cleanProfile });
                    if (result && result.data && result.data.nutritionHeuristics) {
                        nutritionHeuristics = result.data.nutritionHeuristics;
                    }
                } catch (e) {
                    console.warn("refreshNutritionOnly endpoint not deployed or reachable, falling back to backfillAIInsights:", e);
                }

                // 2. Fallback to existing deployed backfillAIInsights function if dedicated endpoint is not deployed yet
                if (!nutritionHeuristics) {
                    const backfillFn = firebase.functions().httpsCallable('backfillAIInsights');
                    const activeWorkouts = typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : [];
                    const result = await backfillFn({
                        profile: cleanProfile,
                        history: [],
                        activeWorkouts: activeWorkouts
                    });
                    if (result && result.data && result.data.healthInsights && result.data.healthInsights.nutritionHeuristics) {
                        nutritionHeuristics = result.data.healthInsights.nutritionHeuristics;
                    }
                }

                if (nutritionHeuristics) {
                    if (!userProfileData.healthInsights) userProfileData.healthInsights = {};
                    userProfileData.healthInsights.nutritionHeuristics = nutritionHeuristics;

                    if (db && userId) {
                        await db.collection("users").doc(userId).update({
                            "healthInsights.nutritionHeuristics": nutritionHeuristics
                        });
                    }

                    if (typeof updateAIInsightsDisplay === 'function') {
                        updateAIInsightsDisplay(userProfileData);
                    }
                } else {
                    throw new Error("No nutrition recommendations returned.");
                }
            } catch (err) {
                console.error("Failed to refresh nutrition guidance:", err);
                alert("Failed to refresh nutrition recommendations. Please try again.");
            } finally {
                if (btnElement) {
                    if (icon) icon.className = "fa-solid fa-rotate";
                    btnElement.disabled = false;
                }
            }
        }