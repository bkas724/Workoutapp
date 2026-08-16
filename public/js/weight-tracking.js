window.openLogWeightModal = function () {
                const modal = document.getElementById('log-weight-modal');
                if (!modal) return;
                const todayStr = new Date().toISOString().split('T')[0];
                document.getElementById('weight-date-val').value = todayStr;
                if (typeof userProfileData !== 'undefined' && userProfileData && userProfileData.weight) {
                    document.getElementById('weight-input-val').value = userProfileData.weight;
                } else {
                    document.getElementById('weight-input-val').value = '';
                }
                document.getElementById('bodyfat-input-val').value = '';
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }

window.closeLogWeightModal = function () {
                const modal = document.getElementById('log-weight-modal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            }

window.updateDashboardBMI = function (data, isFullJourney = false) {
                console.log(`[BMI Chart Debug] Starting updateDashboardBMI (isFullJourney: ${isFullJourney})`);
                checkWeightReminderBanner(data);
                const card = document.getElementById('dashboard-bmi-card');
                if (!card) {
                    console.log("[BMI Chart Debug] dashboard-bmi-card not found!");
                    return;
                }
                if (!data.weight || !data.heightInches) {
                    console.log("[BMI Chart Debug] Missing weight or heightInches");
                    card.style.display = 'none';
                    return;
                }

                const weight = data.weight;
                const totalInches = data.heightInches;
                const sex = data.sex || 'male';
                const minHealthyWeight = window.calculateMinTargetWeight ? window.calculateMinTargetWeight(totalInches, sex) : Math.round(((sex === 'female' ? 20.25 : 21.75) * totalInches * totalInches) / 703);
                const maxHealthyWeight = Math.round((24.9 * totalInches * totalInches) / 703);
                const obeseThresholdWeight = Math.round((29.9 * totalInches * totalInches) / 703);

                // Consistency HUD
                if (typeof activePhaseWorkouts !== 'undefined' && activePhaseWorkouts.length > 0) {
                    const completed = activePhaseWorkouts.filter(w => w.completed).length;
                    const total = activePhaseWorkouts.length;
                    const scoreEl = document.getElementById('consistency-score');
                    if (scoreEl) scoreEl.innerText = `${Math.round((completed / total) * 100)}%`;

                    const completedDates = activePhaseWorkouts.filter(w => w.completed && w.dateExecuted).map(w => new Date(w.dateExecuted).getTime());
                    const daysEl = document.getElementById('consistency-days-phase');
                    if (daysEl) {
                        if (completedDates.length > 0) {
                            const minDate = Math.min(...completedDates);
                            const days = Math.floor((new Date().getTime() - minDate) / (1000 * 3600 * 24)) + 1;
                            daysEl.innerText = `${days} Days`;
                        } else {
                            daysEl.innerText = "Day 1";
                        }
                    }
                }

                // AI Insights (Both Tab 2 and Home Tab)
                const insightsContainer = document.getElementById('ai-health-insights-container');
                const insightsEmpty = document.getElementById('ai-health-empty');
                const homeInsightsContainer = document.getElementById('home-ai-health-insights-container');
                const homeInsightsEmpty = document.getElementById('home-ai-health-empty');

                if (data.healthInsights) {
                    if (insightsContainer) {
                        insightsContainer.classList.remove('hidden');
                        insightsContainer.classList.add('grid');
                    }
                    if (insightsEmpty) insightsEmpty.classList.add('hidden');

                    if (homeInsightsContainer) {
                        homeInsightsContainer.classList.remove('hidden');
                        homeInsightsContainer.classList.add('grid');
                    }
                    if (homeInsightsEmpty) homeInsightsEmpty.classList.add('hidden');

                    const moveText = data.healthInsights.movementTip || "Keep moving!";
                    const moveEl = document.getElementById('insight-movement');
                    if (moveEl) moveEl.innerText = moveText;
                    const homeMoveEl = document.getElementById('home-insight-movement');
                    if (homeMoveEl) homeMoveEl.innerText = moveText;

                    const hydText = data.healthInsights.hydrationRecovery || "Stay hydrated!";
                    const hydEl = document.getElementById('insight-hydration');
                    if (hydEl) hydEl.innerText = hydText;
                    const homeHydEl = document.getElementById('home-insight-hydration');
                    if (homeHydEl) homeHydEl.innerText = hydText;

                    if (data.healthInsights.nutritionHeuristics) {
                        const formatNutritionTier = (tierData) => {
                            if (!tierData) return '<p class="text-slate-500 italic text-xs">No nutrition guidance available.</p>';
                            if (typeof tierData === 'string') {
                                return `<p class="leading-relaxed text-slate-300 text-xs">${tierData}</p>`;
                            }
                            if (typeof tierData === 'object') {
                                const target = tierData.calorieTarget || 'N/A';
                                const desc = tierData.description || '';
                                const meals = tierData.meals || {};
                                return `
                                    <div class="space-y-3 text-xs">
                                        <!-- Calorie Target & Description on Same Line -->
                                        <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                                            <span class="font-bold text-emerald-300 text-xs bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                                                <span class="font-bold text-emerald-400">Calorie Target:</span> ${target}
                                            </span>
                                            ${desc ? `<span class="text-slate-300 text-xs leading-relaxed font-normal">${desc}</span>` : ''}
                                        </div>

                                        <!-- Meal Cards Column Grid -->
                                        ${meals && (meals.breakfast || meals.lunch || meals.dinner || meals.snack) ? `
                                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            ${meals.breakfast ? `
                                            <div class="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between h-full shadow-sm hover:border-slate-700/80 transition-all">
                                                <div>
                                                    <span class="font-bold text-amber-400 text-xs uppercase tracking-wider block mb-2 pb-1.5 border-b border-amber-500/20">Breakfast</span>
                                                    <p class="text-slate-300 text-xs font-normal leading-relaxed">${meals.breakfast}</p>
                                                </div>
                                            </div>` : ''}
                                            ${meals.lunch ? `
                                            <div class="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between h-full shadow-sm hover:border-slate-700/80 transition-all">
                                                <div>
                                                    <span class="font-bold text-orange-400 text-xs uppercase tracking-wider block mb-2 pb-1.5 border-b border-orange-500/20">Lunch</span>
                                                    <p class="text-slate-300 text-xs font-normal leading-relaxed">${meals.lunch}</p>
                                                </div>
                                            </div>` : ''}
                                            ${meals.dinner ? `
                                            <div class="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between h-full shadow-sm hover:border-slate-700/80 transition-all">
                                                <div>
                                                    <span class="font-bold text-sky-400 text-xs uppercase tracking-wider block mb-2 pb-1.5 border-b border-sky-500/20">Dinner</span>
                                                    <p class="text-slate-300 text-xs font-normal leading-relaxed">${meals.dinner}</p>
                                                </div>
                                            </div>` : ''}
                                            ${meals.snack ? `
                                            <div class="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between h-full shadow-sm hover:border-slate-700/80 transition-all">
                                                <div>
                                                    <span class="font-bold text-fuchsia-400 text-xs uppercase tracking-wider block mb-2 pb-1.5 border-b border-fuchsia-500/20">Snack</span>
                                                    <p class="text-slate-300 text-xs font-normal leading-relaxed">${meals.snack}</p>
                                                </div>
                                            </div>` : ''}
                                        </div>` : ''}
                                    </div>
                                `;
                            }
                            return '<p class="text-slate-500 italic text-xs">No nutrition guidance available.</p>';
                        };

                        const restTxt = data.healthInsights.nutritionHeuristics.restDay;
                        const lightTxt = data.healthInsights.nutritionHeuristics.lightActivity;
                        const hardTxt = data.healthInsights.nutritionHeuristics.hardActivity;

                        const isComplexNutrition = (restTxt && typeof restTxt === 'object') ||
                            (lightTxt && typeof lightTxt === 'object') ||
                            (hardTxt && typeof hardTxt === 'object');

                        const updateLayoutForComplexity = (containerId, cardId) => {
                            const container = document.getElementById(containerId);
                            const nutCard = document.getElementById(cardId);
                            if (container && nutCard) {
                                if (isComplexNutrition) {
                                    container.className = "grid grid-cols-1 md:grid-cols-2 gap-5";
                                    nutCard.className = "bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between col-span-1 md:col-span-2";
                                } else {
                                    container.className = "grid grid-cols-1 md:grid-cols-3 gap-5";
                                    nutCard.className = "bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between col-span-1";
                                }
                            }
                        };

                        updateLayoutForComplexity('home-ai-health-insights-container', 'home-insight-nut-card');
                        updateLayoutForComplexity('ai-health-insights-container', 'insight-nut-card');

                        const nutRest = document.getElementById('insight-nut-rest');
                        if (nutRest) nutRest.innerHTML = formatNutritionTier(restTxt);
                        const homeNutRest = document.getElementById('home-insight-nut-rest');
                        if (homeNutRest) homeNutRest.innerHTML = formatNutritionTier(restTxt);

                        const nutLight = document.getElementById('insight-nut-light');
                        if (nutLight) nutLight.innerHTML = formatNutritionTier(lightTxt);
                        const homeNutLight = document.getElementById('home-insight-nut-light');
                        if (homeNutLight) homeNutLight.innerHTML = formatNutritionTier(lightTxt);

                        const nutHard = document.getElementById('insight-nut-hard');
                        if (nutHard) nutHard.innerHTML = formatNutritionTier(hardTxt);
                        const homeNutHard = document.getElementById('home-insight-nut-hard');
                        if (homeNutHard) homeNutHard.innerHTML = formatNutritionTier(hardTxt);
                    }
                } else {
                    if (insightsContainer) {
                        insightsContainer.classList.add('hidden');
                        insightsContainer.classList.remove('grid');
                    }
                    if (insightsEmpty) insightsEmpty.classList.remove('hidden');

                    if (homeInsightsContainer) {
                        homeInsightsContainer.classList.add('hidden');
                        homeInsightsContainer.classList.remove('grid');
                    }
                    if (homeInsightsEmpty) homeInsightsEmpty.classList.remove('hidden');
                }

                // Chart.js
                const chartId = isFullJourney ? 'full-journey-chart' : 'bmi-history-chart';
                const ctx = document.getElementById(chartId);
                if (ctx && (data.bmiHistory || data.weight)) {
                    let history = [];
                    if (data.bmiHistory && data.bmiHistory.length > 0) {
                        history = [...data.bmiHistory];
                    } else if (data.weight) {
                        history = [{ date: data.journeyStartDate || new Date().toISOString(), weight: data.weight }];
                    }

                    // Ensure there's a starting dot at journeyStartDate if missing
                    if (data.journeyStartDate && history.length > 0) {
                        history.sort((a, b) => new Date(a.date) - new Date(b.date));
                        const journeyStartTime = new Date(data.journeyStartDate).getTime();
                        const earliestLogTime = new Date(history[0].date).getTime();
                        // If earliest log is missing the start of the journey (e.g. > 7 days gap)
                        if (earliestLogTime - journeyStartTime > 7 * 24 * 60 * 60 * 1000) {
                            history.unshift({ date: data.journeyStartDate, weight: history[0].weight }); // Fallback to earliest known weight
                        }
                    }

                    // If they updated their weight in the profile, make sure it's plotted as 'today'
                    if (data.weight && history.length > 0) {
                        history.sort((a, b) => new Date(a.date) - new Date(b.date));
                        const lastLog = history[history.length - 1];
                        // If the current profile weight differs from the last logged history weight, plot it today
                        if (lastLog.weight !== data.weight) {
                            history.push({ date: new Date().toISOString(), weight: data.weight });
                        }
                    }
                    history.sort((a, b) => new Date(a.date) - new Date(b.date));

                    // Master Journey Timeline & Decay Parameters
                    const pad = n => n.toString().padStart(2, '0');
                    const userTargetWeight = data.targetWeight ? parseFloat(data.targetWeight) : maxHealthyWeight;
                    const journeyStart = data.journeyStartDate ? new Date(data.journeyStartDate) : new Date(history[0].date);
                    const masterStartD = new Date(journeyStart);
                    masterStartD.setHours(0, 0, 0, 0);

                    const macroPlan = data.macrocyclePlan || [];
                    const phaseIndex = data.currentPhaseIndex || 1;

                    let masterEndD = new Date(masterStartD);
                    if (data.targetDate && new Date(data.targetDate) > masterStartD) {
                        masterEndD = new Date(data.targetDate);
                    } else if (macroPlan.length > 0) {
                        for (let i = 0; i < macroPlan.length; i++) {
                            const weeks = macroPlan[i].expectedDurationWeeks || 4;
                            masterEndD.setDate(masterEndD.getDate() + (weeks * 7));
                        }
                    } else {
                        masterEndD.setDate(masterEndD.getDate() + 182); // 6 months fallback
                    }
                    masterEndD.setHours(23, 59, 59, 999);

                    const masterTotalWeeks = Math.max(1, Math.round((masterEndD - masterStartD) / (1000 * 60 * 60 * 24 * 7)));
                    const masterInitialWeight = history.length > 0 ? history[0].weight : (data.weight || userTargetWeight);

                    // Master exponential decay rate constant k: e^(-k * masterTotalWeeks) = 0.05 => 95% progress
                    const k = 2.9957 / Math.max(1, masterTotalWeeks);

                    const getProjectedTargetWeight = (dateObj) => {
                        const weeksElapsed = Math.max(0, (dateObj.getTime() - masterStartD.getTime()) / (1000 * 60 * 60 * 24 * 7));
                        return userTargetWeight + (masterInitialWeight - userTargetWeight) * Math.exp(-k * weeksElapsed);
                    };

                    // Active Phase Start & End Boundaries
                    let phaseStart = new Date(masterStartD);
                    for (let i = 0; i < phaseIndex - 1; i++) {
                        const weeks = (macroPlan[i] && macroPlan[i].expectedDurationWeeks) || 4;
                        phaseStart.setDate(phaseStart.getDate() + (weeks * 7));
                    }
                    phaseStart.setHours(0, 0, 0, 0);

                    let phaseEnd = new Date(phaseStart);
                    const currentPhasePlan = macroPlan[phaseIndex - 1];
                    const currentPhaseWeeks = (currentPhasePlan && currentPhasePlan.expectedDurationWeeks) || 4;
                    phaseEnd.setDate(phaseEnd.getDate() + (currentPhaseWeeks * 7));
                    phaseEnd.setHours(23, 59, 59, 999);

                    // Determine baseline weight entering the active phase
                    let phaseStartWeight = masterInitialWeight;
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (new Date(history[i].date) <= phaseStart) {
                            phaseStartWeight = history[i].weight;
                            break;
                        }
                    }

                    // Update biometrics ticker stats
                    if (history.length > 0) {
                        const latestLog = history[history.length - 1];
                        const currentW = latestLog.weight;
                        const currEl = document.getElementById('weight-ticker-current');
                        if (currEl) currEl.innerText = `${currentW.toFixed(1)} lbs`;

                        // 7-Day Rate calculation
                        let rateText = "-";
                        if (history.length >= 2) {
                            const latestTime = new Date(latestLog.date).getTime();
                            const sevenDaysAgoTime = latestTime - (7 * 24 * 60 * 60 * 1000);
                            let prevLog = history[0];
                            for (let i = history.length - 1; i >= 0; i--) {
                                if (new Date(history[i].date).getTime() <= sevenDaysAgoTime) {
                                    prevLog = history[i];
                                    break;
                                }
                            }
                            const daysDiff = (latestTime - new Date(prevLog.date).getTime()) / (1000 * 60 * 60 * 24);
                            if (daysDiff >= 1) {
                                const rateVal = parseFloat(((latestLog.weight - prevLog.weight) / (daysDiff / 7)).toFixed(1));
                                rateText = rateVal > 0 ? `+${rateVal} lbs/wk` : `${rateVal} lbs/wk`;
                            }
                        }
                        const rateEl = document.getElementById('weight-ticker-rate');
                        if (rateEl) rateEl.innerText = rateText;

                        // Phase Change calculation (strictly delta from current phase entry baseline)
                        const phaseDiffVal = parseFloat((latestLog.weight - phaseStartWeight).toFixed(1));
                        const phaseDiffText = phaseDiffVal > 0 ? `+${phaseDiffVal} lbs` : `${phaseDiffVal} lbs`;
                        const phaseEl = document.getElementById('weight-ticker-phase');
                        if (phaseEl) phaseEl.innerText = phaseDiffText;
                    }

                    // Determine active chart boundaries and labels
                    const startD = isFullJourney ? new Date(masterStartD) : new Date(phaseStart);
                    const endD = isFullJourney ? new Date(masterEndD) : new Date(phaseEnd);

                    let labels = [];
                    let fullDates = [];
                    let curr = new Date(startD);

                    while (curr <= endD) {
                        labels.push(`${pad(curr.getMonth() + 1)}/${pad(curr.getDate())}`);
                        fullDates.push(new Date(curr));
                        curr.setDate(curr.getDate() + 7); // weekly steps
                    }

                    // Ensure minimum 2 labels for scale rendering
                    if (labels.length < 2) {
                        let nextWeek = new Date(startD);
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        labels.push(`${pad(nextWeek.getMonth() + 1)}/${pad(nextWeek.getDate())}`);
                        fullDates.push(nextWeek);
                    }

                    // Build visible data points
                    let allPoints = [];
                    const startWeight = isFullJourney ? masterInitialWeight : phaseStartWeight;

                    // Base anchor at x=0
                    allPoints.push({ x: 0, y: startWeight });

                    if (isFullJourney) {
                        // Plot all logs across entire journey
                        for (let h of history) {
                            let hd = new Date(h.date);
                            let fractionalWeeks = (hd - masterStartD) / (7 * 24 * 60 * 60 * 1000);
                            if (fractionalWeeks > 0.05 && fractionalWeeks <= labels.length - 1) {
                                allPoints.push({ x: fractionalWeeks, y: h.weight });
                            }
                        }
                    } else {
                        // Plot only logs within active phase
                        for (let h of history) {
                            let hd = new Date(h.date);
                            if (hd > phaseStart && hd <= phaseEnd) {
                                let fractionalWeeks = (hd - phaseStart) / (7 * 24 * 60 * 60 * 1000);
                                if (fractionalWeeks > 0.05 && fractionalWeeks <= labels.length - 1) {
                                    allPoints.push({ x: fractionalWeeks, y: h.weight });
                                }
                            }
                        }
                    }
                    allPoints.sort((a, b) => a.x - b.x);

                    // Markers (Start & Latest in view)
                    let journeyMarkers = [];
                    let markerBgColors = [];
                    if (allPoints.length > 0) {
                        journeyMarkers.push(allPoints[0]);
                        markerBgColors.push(allPoints.length > 1 ? '#64748b' : '#ea580c'); // Slate if start, Orange if only point

                        if (allPoints.length > 1) {
                            journeyMarkers.push(allPoints[allPoints.length - 1]);
                            markerBgColors.push('#ea580c'); // End point is Orange
                        }
                    }

                    // Target line points evaluated at visible date steps
                    const targetPoints = [];
                    for (let i = 0; i < fullDates.length; i++) {
                        const d = fullDates[i];
                        const projY = getProjectedTargetWeight(d);
                        targetPoints.push({ x: i, y: projY });
                    }

                    // Labels Update
                    card.style.display = '';

                    const currentBmi = (weight / (totalInches * totalInches)) * 703;
                    const targetBmi = (userTargetWeight / (totalInches * totalInches)) * 703;

                    let stageTargetWeight = targetPoints.length > 0 ? targetPoints[targetPoints.length - 1].y : userTargetWeight;

                    if (!isFullJourney) {
                        const lblCurr = document.getElementById('bmi-label-current');
                        const lblTarg = document.getElementById('bmi-label-target');
                        if (lblCurr) lblCurr.innerText = `${weight} lbs`;
                        if (lblTarg) lblTarg.innerText = `${stageTargetWeight.toFixed(1)} lbs Target`;

                        const titleEl = document.getElementById('weight-progression-title');
                        if (titleEl) {
                            titleEl.innerText = `Weight Progression (Phase ${phaseIndex})`;
                        }
                    } else {
                        const modCurr = document.getElementById('modal-bmi-label-current');
                        const modTarg = document.getElementById('modal-bmi-label-target');
                        if (modCurr) modCurr.innerText = `Current: ${weight} lbs (${currentBmi.toFixed(1)} BMI)`;
                        if (modTarg) modTarg.innerText = `Target: ${userTargetWeight.toFixed(1)} lbs (${targetBmi.toFixed(1)} BMI)`;
                    }

                    // Clean up specific instance depending on which chart we are drawing
                    if (isFullJourney) {
                        if (window.fullBmiChartInstance) window.fullBmiChartInstance.destroy();
                    } else {
                        if (window.bmiChartInstance) window.bmiChartInstance.destroy();
                    }

                    const customBmiPlugin = {
                        id: 'customBmiVisuals',
                        beforeDraw: (chart) => {
                            const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;

                            const minH = minHealthyWeight;
                            const maxH = maxHealthyWeight;
                            const obese = obeseThresholdWeight;

                            const colors = {
                                obese: { bg: 'rgba(239, 68, 68, 0.03)', bar: 'rgba(185, 28, 28, 0.5)' }, // Red
                                overweight: { bg: 'rgba(249, 115, 22, 0.05)', bar: 'rgba(194, 65, 12, 0.5)' }, // Orange
                                healthy: { bg: 'rgba(34, 197, 94, 0.05)', bar: 'rgba(21, 128, 61, 0.5)' }, // Green
                                underweight: { bg: 'rgba(148, 163, 184, 0.05)', bar: 'rgba(71, 85, 105, 0.5)' } // Gray
                            };

                            const barWidth = 20;
                            const chartRight = right; // Padding provides space for the bar

                            ctx.save();

                            const drawBand = (minYVal, maxYVal, bgCol, barCol) => {
                                const yTop = Math.max(top, Math.min(bottom, y.getPixelForValue(maxYVal)));
                                const yBottom = Math.min(bottom, Math.max(top, y.getPixelForValue(minYVal)));
                                const height = yBottom - yTop;

                                if (height > 0) {
                                    // Background
                                    ctx.fillStyle = bgCol;
                                    ctx.fillRect(left, yTop, chartRight - left, height);
                                    // Stacked Bar
                                    ctx.fillStyle = barCol;
                                    ctx.fillRect(chartRight, yTop, barWidth, height);
                                }
                            };

                            drawBand(obese, y.max + 500, colors.obese.bg, colors.obese.bar);
                            drawBand(maxH, obese, colors.overweight.bg, colors.overweight.bar);
                            drawBand(minH, maxH, colors.healthy.bg, colors.healthy.bar);
                            drawBand(y.min - 500, minH, colors.underweight.bg, colors.underweight.bar);


                            // Draw Final Target Bullseye on the right side Stacked Bar
                            if (y.min !== undefined && y.max !== undefined) {
                                const finalTargetY = y.getPixelForValue(userTargetWeight);
                                if (finalTargetY >= top && finalTargetY <= bottom) {
                                    ctx.beginPath();
                                    ctx.arc(chartRight + (barWidth / 2), finalTargetY, 6, 0, 2 * Math.PI);
                                    ctx.fillStyle = '#a855f7'; // Purple for final end target
                                    ctx.fill();
                                    ctx.lineWidth = 2;
                                    ctx.strokeStyle = '#ffffff';
                                    ctx.stroke();

                                    // Small line connecting chart to bullseye
                                    ctx.beginPath();
                                    ctx.moveTo(chartRight, finalTargetY);
                                    ctx.lineTo(chartRight + (barWidth / 2) - 6, finalTargetY);
                                    ctx.strokeStyle = '#a855f7';
                                    ctx.lineWidth = 2;
                                    ctx.stroke();
                                }
                            }

                            ctx.restore();
                        },
                        afterDatasetsDraw: (chart) => {
                            const { ctx } = chart;
                            ctx.save();
                            ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                            ctx.textAlign = 'center';

                            // Dataset 2: Journey Markers
                            const meta2 = chart.getDatasetMeta(2);
                            if (meta2 && meta2.data) {
                                meta2.data.forEach((point, index) => {
                                    const valObj = journeyMarkers[index];
                                    if (valObj && point) {
                                        const numVal = parseFloat(valObj.y);
                                        const numStart = parseFloat(startWeight);
                                        const loss = (numVal - numStart).toFixed(1);
                                        const isStartPoint = (index === 0 && journeyMarkers.length > 1);
                                        const lossText = isStartPoint ? 'Start' : (numVal === numStart ? '' : (numVal < numStart ? `(${loss})` : `(+${loss})`));

                                        ctx.fillStyle = markerBgColors[index];
                                        ctx.textBaseline = 'bottom';

                                        if (lossText) {
                                            ctx.fillText(`${numVal.toFixed(1)} lbs`, point.x, point.y - 20);
                                            ctx.font = '9px "Plus Jakarta Sans", sans-serif';
                                            ctx.fillText(lossText, point.x, point.y - 9);
                                            ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                                        } else {
                                            ctx.fillText(`${numVal.toFixed(1)} lbs`, point.x, point.y - 12);
                                        }
                                    }
                                });
                            }
                            ctx.restore();
                        },
                        afterDraw: (chart) => {
                            const { ctx } = chart;
                            // Dataset 3: Stage Target Dataset
                            const datasetMeta = chart.getDatasetMeta(3);
                            if (!datasetMeta || !datasetMeta.data || datasetMeta.data.length === 0) return;

                            // Point the Blue Stage Target Bubble at the very last point of the stage target line
                            const lastPoint = datasetMeta.data[datasetMeta.data.length - 1];
                            if (!lastPoint) return;

                            const px = lastPoint.x;
                            const py = lastPoint.y;

                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(px, py, 7, 0, 2 * Math.PI);
                            ctx.fillStyle = isFullJourney ? '#a855f7' : '#0ea5e9'; // Purple if full journey, Blue if stage
                            ctx.fill();
                            ctx.lineWidth = 2.5;
                            ctx.strokeStyle = '#ffffff';
                            ctx.stroke();

                            // Label above/below stage target bubble
                            ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                            ctx.fillStyle = isFullJourney ? '#a855f7' : '#0ea5e9';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(`${stageTargetWeight.toFixed(1)} lbs`, px, py - 10);
                            ctx.restore();
                        }
                    };

                    // Calculate 7-Day Moving Average Trend points
                    let ma7Points = [];
                    for (let i = 0; i < allPoints.length; i++) {
                        let pt = allPoints[i];
                        let currentX = pt.x;
                        let windowPts = allPoints.filter(p => Math.abs(p.x - currentX) <= 0.5);
                        let sumY = windowPts.reduce((acc, p) => acc + p.y, 0);
                        let avgY = sumY / windowPts.length;
                        ma7Points.push({ x: pt.x, y: parseFloat(avgY.toFixed(1)) });
                    }

                    // Calculate dynamic min and max based on visible points
                    const validWeights = allPoints.map(p => p.y);
                    const allVisibleValues = [...validWeights, ...targetPoints.map(p => p.y)].filter(v => v !== null && v !== undefined && !isNaN(v));
                    if (userTargetWeight) allVisibleValues.push(userTargetWeight);

                    const dynamicMin = Math.floor(Math.min(...allVisibleValues)) - 5;
                    const dynamicMax = Math.ceil(Math.max(...allVisibleValues)) + 5;

                    const chartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            datasets: [
                                {
                                    label: 'Raw Weight Log',
                                    data: allPoints,
                                    borderColor: 'rgba(148, 163, 184, 0.2)', // Very subtle
                                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                    borderWidth: 1,
                                    borderDash: [4, 4],
                                    fill: false,
                                    tension: 0.2,
                                    pointBackgroundColor: 'rgba(148, 163, 184, 0.5)',
                                    pointBorderColor: 'transparent',
                                    pointRadius: 2,
                                    pointHoverRadius: 4,
                                    z: 10
                                },
                                {
                                    label: '7-Day Moving Avg',
                                    data: ma7Points,
                                    borderColor: '#10b981', // Emerald
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    borderWidth: 3,
                                    fill: false,
                                    tension: 0.25,
                                    pointRadius: 0,
                                    pointHoverRadius: 5,
                                    z: 12
                                },
                                {
                                    label: 'Journey Markers',
                                    data: journeyMarkers,
                                    borderColor: 'transparent',
                                    backgroundColor: 'transparent',
                                    borderWidth: 0,
                                    fill: false,
                                    showLine: false,
                                    pointBackgroundColor: markerBgColors,
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 2,
                                    pointRadius: 6,
                                    pointHoverRadius: 8,
                                    z: 11
                                },
                                {
                                    label: 'Healthy Target',
                                    data: targetPoints,
                                    borderColor: 'rgba(14, 165, 233, 0.2)', // Softer light blue band
                                    backgroundColor: 'transparent',
                                    borderWidth: 16, // Thinner transparent line
                                    fill: false,
                                    tension: 0.3,
                                    pointRadius: 0,
                                    pointHoverRadius: 0,
                                    borderCapStyle: 'round',
                                    z: 5
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: {
                                padding: { left: 20, right: 20, top: 10, bottom: 10 }
                            },
                            plugins: {
                                legend: {
                                    display: false,
                                    position: 'bottom',
                                    labels: {
                                        usePointStyle: true,
                                        boxWidth: 8,
                                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        title: function (context) {
                                            if (!context || !context.length) return '';
                                            const rawX = context[0].raw.x;
                                            const d = new Date(startD.getTime() + rawX * 7 * 24 * 60 * 60 * 1000);
                                            // Handle edge case of timezones by ensuring we use UTC or simply using locale string
                                            return `${d.getMonth() + 1}/${d.getDate()}`;
                                        },
                                        label: function (context) {
                                            const numVal = parseFloat(context.raw.y);
                                            const numStart = parseFloat(startWeight);
                                            const loss = (numVal - numStart).toFixed(1);
                                            const lossText = numVal === numStart ? '' : (numVal < numStart ? `(${loss})` : `(+${loss})`);
                                            if (context.dataset.label === 'Healthy Target') {
                                                return `Target: ${numVal.toFixed(1)} ${lossText}`.trim();
                                            }
                                            return `${numVal.toFixed(1)} ${lossText}`.trim();
                                        }
                                    },
                                    displayColors: true,
                                    bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '600' },
                                    titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '400' }
                                }
                            },
                            scales: {
                                y: {
                                    min: dynamicMin,
                                    max: dynamicMax,
                                    grid: { display: false },
                                    ticks: { color: '#64748b', font: { family: "'Plus Jakarta Sans', sans-serif" } },
                                    border: { display: false }
                                },
                                x: {
                                    type: 'linear',
                                    min: 0,
                                    max: labels.length - 1,
                                    grid: { display: false },
                                    ticks: {
                                        color: '#64748b',
                                        font: { family: "'Plus Jakarta Sans', sans-serif" },
                                        maxRotation: 0,
                                        minRotation: 0,
                                        stepSize: 1,
                                        callback: function (value, index, values) {
                                            // Only show the label if it exactly matches our week boundaries
                                            if (Math.floor(value) === value && labels[value]) {
                                                return labels[value];
                                            }
                                            return '';
                                        }
                                    },
                                    border: { display: false }
                                }
                            }
                        },
                        plugins: [customBmiPlugin]
                    });

                    console.log("BMI Chart Debug:", {
                        history, labels, startD, endD, validWeights, dynamicMin, dynamicMax
                    });

                    if (isFullJourney) window.fullBmiChartInstance = chartInstance;
                    else window.bmiChartInstance = chartInstance;
                }
            }

window.calculateMinTargetWeight = function (heightInches, sex) {
    if (!heightInches || heightInches <= 0) return 0;
    const isFemale = (sex || '').toLowerCase() === 'female';
    const targetBmiFloor = isFemale ? 20.25 : 21.75;
    return Math.round((targetBmiFloor * heightInches * heightInches) / 703);
};

function updateBMIVisual() {
    const trackWeight = document.getElementById('intake-track-weight')?.value === 'on';
    const weight = parseFloat(document.getElementById('intake-weight')?.value);
    const ft = parseInt(document.getElementById('intake-height-ft')?.value) || 0;
    const inch = parseInt(document.getElementById('intake-height-in')?.value) || 0;
    const sex = document.getElementById('intake-sex')?.value || 'male';

    const targetInputBox = document.getElementById('target-weight-input-box');
    const healthyNote = document.getElementById('healthy-weight-note');

    if (!targetInputBox || !healthyNote) return;

    // If Target Weight Goal toggle is OFF (NO)
    if (!trackWeight) {
        targetInputBox.classList.add('hidden');
        healthyNote.classList.add('hidden');
        return;
    }

    // If Target Weight Goal toggle is ON (YES), but height/weight not fully filled yet
    if (!weight || (ft === 0 && inch === 0)) {
        targetInputBox.classList.remove('hidden');
        healthyNote.classList.add('hidden');
        return;
    }

    const totalInches = (ft * 12) + inch;
    if (totalInches === 0) return;

    const minWeightFloor = window.calculateMinTargetWeight(totalInches, sex);
    const currentBMI = (weight / (totalInches * totalInches)) * 703;

    // Check if current weight is in healthy range or at/below athletic min floor
    if (weight <= minWeightFloor || (currentBMI >= 18.5 && currentBMI <= 24.9)) {
        targetInputBox.classList.add('hidden');
        healthyNote.classList.remove('hidden');
        const targetInput = document.getElementById('intake-target-weight');
        if (targetInput) targetInput.value = '';
    } else {
        targetInputBox.classList.remove('hidden');
        healthyNote.classList.add('hidden');
    }
}

window.enforceMinimumWeight = function (el) {
    const ft = parseInt(document.getElementById('intake-height-ft')?.value) || (typeof userProfileData !== 'undefined' && userProfileData?.heightInches ? Math.floor(userProfileData.heightInches / 12) : 0);
    const inch = parseInt(document.getElementById('intake-height-in')?.value) || (typeof userProfileData !== 'undefined' && userProfileData?.heightInches ? userProfileData.heightInches % 12 : 0);
    const sex = document.getElementById('intake-sex')?.value || (typeof userProfileData !== 'undefined' ? userProfileData?.sex : 'male');
    const totalInches = (ft * 12) + inch;

    if (totalInches > 0) {
        const minWeightFloor = window.calculateMinTargetWeight(totalInches, sex);
        const val = parseFloat(el.value);

        if (val && val < minWeightFloor) {
            el.value = minWeightFloor;

            const container = el.parentElement;
            const bubble = container?.querySelector('.min-weight-bubble');
            if (bubble) {
                const minValEl = bubble.querySelector('.min-val');
                if (minValEl) minValEl.innerText = minWeightFloor;
                bubble.classList.remove('hidden');

                el.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
                setTimeout(() => {
                    bubble.classList.add('hidden');
                    el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
                }, 6000);
            }
        }
    }
}

window.validateTargetWeight = function () {
                // enforceMinimumWeight handles the correction and bubble on blur.
            }

window.openWeightHistoryModal = function () {
                document.getElementById('weight-history-modal').classList.remove('hidden');
                document.getElementById('weight-history-modal').classList.add('flex');

                const today = new Date().toISOString().split('T')[0];
                document.getElementById('history-new-date').value = today;
                document.getElementById('history-new-weight').value = '';

                // Limit date to current journey stage elapsed days
                let minDate = new Date();
                if (userProfileData) {
                    const startD = userProfileData.journeyStartDate ? new Date(userProfileData.journeyStartDate) : new Date();
                    const phaseIndex = userProfileData.currentPhaseIndex || 1;
                    const macroPlan = userProfileData.macrocyclePlan || [];

                    let phaseStart = new Date(startD);
                    for (let i = 0; i < phaseIndex - 1; i++) {
                        if (macroPlan[i]) {
                            phaseStart.setDate(phaseStart.getDate() + ((macroPlan[i].expectedDurationWeeks || 4) * 7));
                        }
                    }
                    minDate = phaseStart;
                }
                document.getElementById('history-new-date').min = minDate.toISOString().split('T')[0];
                document.getElementById('history-new-date').max = today;

                renderWeightHistoryList();
            }

window.closeWeightHistoryModal = function () {
                document.getElementById('weight-history-modal').classList.add('hidden');
                document.getElementById('weight-history-modal').classList.remove('flex');
            }

window.renderWeightHistoryList = function () {
                const listEl = document.getElementById('weight-history-list');
                listEl.innerHTML = '';

                if (!userProfileData || !userProfileData.bmiHistory || userProfileData.bmiHistory.length === 0) {
                    listEl.innerHTML = `<div class="text-center text-slate-500 text-xs py-4">No history recorded yet.</div>`;
                    return;
                }

                const sortedHistory = [...userProfileData.bmiHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

                sortedHistory.forEach((entry, index) => {
                    const d = new Date(entry.date);
                    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const trueIndex = userProfileData.bmiHistory.indexOf(entry);

                    listEl.innerHTML += `
                        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                            <div>
                                <div class="text-white font-bold text-sm">${entry.weight} lbs</div>
                                <div class="text-slate-500 text-[10px]">${dateStr}</div>
                            </div>
                            <button onclick="removeWeightHistoryEntry(${trueIndex})" class="text-slate-500 hover:text-rose-400 transition-colors p-2">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `;
                });
            }

window.addWeightHistoryEntry = function () {
                const dateVal = document.getElementById('history-new-date').value;
                const weightVal = parseFloat(document.getElementById('history-new-weight').value);

                if (!dateVal || isNaN(weightVal)) {
                    alert("Please provide both a valid date and weight.");
                    return;
                }

                if (!userProfileData) return;

                const d = new Date(dateVal + 'T12:00:00');

                let history = userProfileData.bmiHistory || [];
                if (history.length === 0 && userProfileData.weight) {
                    history.push({
                        date: userProfileData.journeyStartDate || new Date().toISOString(),
                        weight: userProfileData.weight
                    });
                }

                history.push({
                    date: d.toISOString(),
                    weight: weightVal
                });

                userProfileData.bmiHistory = history;
                const latest = [...history].sort((a, b) => new Date(b.date) - new Date(a.date))[0].weight;
                userProfileData.weight = latest;

                db.collection("users").doc(userId).update({
                    bmiHistory: history,
                    weight: latest
                }).then(() => {
                    renderWeightHistoryList();
                    document.getElementById('modal-weight').value = latest;
                    if (window.updateDashboardBMI) window.updateDashboardBMI(userProfileData, false);
                }).catch(err => {
                    console.error("Error saving weight history:", err);
                    alert("Failed to save.");
                });
            }

window.removeWeightHistoryEntry = function (index) {
                if (!confirm("Are you sure you want to delete this log?")) return;
                if (!userProfileData || !userProfileData.bmiHistory) return;

                let history = [...userProfileData.bmiHistory];
                history.splice(index, 1);

                userProfileData.bmiHistory = history;
                const latest = history.length > 0 ? [...history].sort((a, b) => new Date(b.date) - new Date(a.date))[0].weight : (userProfileData.weight || null);
                userProfileData.weight = latest;

                db.collection("users").doc(userId).update({
                    bmiHistory: history,
                    weight: latest
                }).then(() => {
                    renderWeightHistoryList();
                    document.getElementById('modal-weight').value = latest || "";
                    if (window.updateDashboardBMI) window.updateDashboardBMI(userProfileData, false);
                }).catch(err => {
                    console.error("Error deleting weight history:", err);
                    alert("Failed to delete.");
                });
            }

function checkWeightReminderBanner(data) {
                const banner = document.getElementById('home-weight-reminder-banner');
                if (!banner) return;
                if (!data) return;

                // Off by default unless explicitly enabled in profile settings
                const enabled = !!data.notificationsEnabled;
                if (!enabled) {
                    banner.classList.add('hidden');
                    banner.classList.remove('flex', 'block');
                    return;
                }

                let lastLogTime = 0;
                if (data.bmiHistory && data.bmiHistory.length > 0) {
                    data.bmiHistory.forEach(h => {
                        if (h.date) {
                            const t = new Date(h.date).getTime();
                            if (!isNaN(t) && t > lastLogTime) lastLogTime = t;
                        }
                    });
                }
                if (data.lastWeightLogDate) {
                    const t = new Date(data.lastWeightLogDate).getTime();
                    if (!isNaN(t) && t > lastLogTime) lastLogTime = t;
                }

                if (lastLogTime === 0) {
                    banner.classList.remove('hidden');
                    banner.classList.add('flex');
                    return;
                }

                // Calculate calendar day difference using local midnight boundaries
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

                const lastLogDateObj = new Date(lastLogTime);
                const lastLogStart = new Date(lastLogDateObj.getFullYear(), lastLogDateObj.getMonth(), lastLogDateObj.getDate()).getTime();

                const calendarDaysDiff = Math.floor((todayStart - lastLogStart) / (24 * 60 * 60 * 1000));
                console.log("[Weight Reminder Debug] Evaluated banner. Last log date:", new Date(lastLogTime).toLocaleDateString(), "| Days diff:", calendarDaysDiff, "| Showing:", calendarDaysDiff > 2);

                // Show banner ONLY if it has been MORE than 2 calendar days since the last log
                if (calendarDaysDiff > 2) {
                    banner.classList.remove('hidden');
                    banner.classList.add('flex');
                } else {
                    banner.classList.add('hidden');
                    banner.classList.remove('flex', 'block');
                }
            }



window.saveWeightLog = async function (e) {
                if (e) e.preventDefault();
                const weightVal = parseFloat(document.getElementById('weight-input-val').value);
                const bodyFatVal = parseFloat(document.getElementById('bodyfat-input-val').value);
                const dateVal = document.getElementById('weight-date-val').value;

                if (isNaN(weightVal) || weightVal <= 0) return;

                const dateObj = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
                const entry = {
                    date: dateObj.toISOString(),
                    weight: weightVal
                };
                if (!isNaN(bodyFatVal) && bodyFatVal > 0) {
                    entry.bodyFat = bodyFatVal;
                }

                if (typeof userProfileData !== 'undefined' && userProfileData) {
                    if (!userProfileData.bmiHistory) userProfileData.bmiHistory = [];
                    userProfileData.bmiHistory.push(entry);
                    userProfileData.weight = weightVal;
                    userProfileData.lastWeightLogDate = dateObj.toISOString();
                }

                if (typeof userId !== 'undefined' && userId && typeof db !== 'undefined' && db) {
                    try {
                        await db.collection("users").doc(userId).update({
                            weight: weightVal,
                            lastWeightLogDate: dateObj.toISOString(),
                            bmiHistory: firebase.firestore.FieldValue.arrayUnion(entry)
                        });
                    } catch (err) {
                        console.warn("Error updating weight log in Firestore:", err);
                    }
                }

                if (typeof userProfileData !== 'undefined') {
                    if (typeof updateDashboardBMI === 'function') updateDashboardBMI(userProfileData);
                    checkWeightReminderBanner(userProfileData);
                }
                closeLogWeightModal();
            }