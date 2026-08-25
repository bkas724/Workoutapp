function calculateEst5KRacePace(completedRuns, baseline5kStr) {
            window.lastPaceBreakdown = [];
            if (!completedRuns || completedRuns.length === 0) {
                return baseline5kStr || "8:10";
            }
            
            // Filter to only running-based activities
            const excludedTypes = ['bike', 'walk', 'swim', 'row', 'strength', 'yoga', 'mobility', 'hike'];
            
            const runsWithPace = completedRuns.filter(w => {
                const type = (w.type || '').toLowerCase();
                const isExcluded = excludedTypes.some(ex => type.includes(ex));
                const hasPace = w.actualLoggedPace || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgPace);
                return hasPace && !isExcluded;
            }).sort((a, b) => {
                const dateA = a.dateExecuted ? new Date(a.dateExecuted).getTime() : (a.sequenceOrder || 0);
                const dateB = b.dateExecuted ? new Date(b.dateExecuted).getTime() : (b.sequenceOrder || 0);
                return dateB - dateA;
            });

            if (runsWithPace.length === 0) return baseline5kStr || "8:10";

            // Take up to the last 5 valid running activities
            const lastFive = runsWithPace.slice(0, 5);
            let projectedSecs = [];

            lastFive.forEach(w => {
                let debugObj = { workout: w };
                const est5KSec = convertRunToEst5KPaceSec(w, debugObj);
                if (est5KSec !== null) {
                    debugObj.estSec = est5KSec;
                    window.lastPaceBreakdown.push(debugObj);
                    projectedSecs.push(est5KSec);
                }
            });

            if (projectedSecs.length === 0) return baseline5kStr || "8:10";

            // If we have 3 or more runs, discard the absolute slowest projected outlier
            if (projectedSecs.length >= 3) {
                projectedSecs.sort((a, b) => a - b); // Ascending order (fastest to slowest)
                const discardedSec = projectedSecs.pop(); // Remove the last item (slowest pace)
                // Mark it in the debug breakdown
                const outlier = window.lastPaceBreakdown.find(d => d.estSec === discardedSec && !d.discarded);
                if (outlier) outlier.discarded = true;
            }

            const totalEstSec = projectedSecs.reduce((sum, sec) => sum + sec, 0);
            const avg5KSec = Math.round(totalEstSec / projectedSecs.length);
            const mins = Math.floor(avg5KSec / 60);
            const secs = avg5KSec % 60;
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

function convertRunToEst5KPaceSec(w, debugObj = {}) {
    const rawPaceStr = w.actualLoggedPace || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgPace);
    if (!rawPaceStr) return null;
    const loggedSec = paceStringToSeconds(rawPaceStr);
    debugObj.rawPace = rawPaceStr;

    // 1. User Profile Biometrics & Target Distance
    let age = 35; // Default age fallback
    let targetDistance = '5K'; // Default target
    if (typeof userProfileData !== 'undefined' && userProfileData) {
        if (userProfileData.age) {
            age = userProfileData.age;
        } else if (userProfileData.birthYear) {
            age = new Date().getFullYear() - userProfileData.birthYear;
        }
        if (userProfileData.dynamicGoalData && userProfileData.dynamicGoalData.targetDistance) {
            targetDistance = userProfileData.dynamicGoalData.targetDistance;
        }
    }
    const maxHr = 220 - age;

    // 2. Volume & Duration Guardrail (Tier 1)
    const workoutDistance = typeof extractWorkoutMileage === 'function' ? extractWorkoutMileage(w) : (parseFloat(w.actualLoggedDistance) || 0);
    const totalWorkoutSec = w.actualLoggedDuration ? (parseFloat(w.actualLoggedDuration) * 60) : (workoutDistance * loggedSec);
    const isVeryShortEffort = (workoutDistance > 0 && workoutDistance < 0.75) && (totalWorkoutSec > 0 && totalWorkoutSec < 360);

    // 3. Interval Work-to-Rest Ratio Density Modeling (Tier 2)
    // Account for N-1 rest periods between N interval repetitions (if interval details are present)
    let densityFactor = 1.0;
    const intervalMeta = typeof getIntervalMetadata === 'function' ? getIntervalMetadata(w) : null;
    const repCount = w.intervalRepCount ? parseInt(w.intervalRepCount) : (intervalMeta ? intervalMeta.repCount : 1);
    const isIntervalSession = repCount > 1 || (w.workoutCategory === 'intervals') || ((w.type || '').toLowerCase().includes('interval'));

    if (isIntervalSession && repCount > 1) {
        const restSecPerRep = typeof w.intervalRestSeconds === 'number' ? w.intervalRestSeconds : (intervalMeta ? intervalMeta.restSeconds : 60);
        const interRepRestCount = repCount - 1; // Rest occurs only between reps (N-1)
        const totalRestSec = interRepRestCount * restSecPerRep;

        let totalWorkSec = 0;
        if (intervalMeta && intervalMeta.intervalType === 'time') {
            totalWorkSec = repCount * (intervalMeta.repDurationSeconds || 300);
        } else if (intervalMeta && intervalMeta.intervalType === 'distance') {
            totalWorkSec = repCount * (intervalMeta.repDistanceMiles * loggedSec);
        } else if (workoutDistance > 0) {
            totalWorkSec = workoutDistance * loggedSec;
        } else {
            totalWorkSec = repCount * 300; // 5 min fallback per rep
        }

        if (totalRestSec > 0 && totalWorkSec > 0) {
            const workToRestRatio = totalWorkSec / totalRestSec;
            if (workToRestRatio >= 2.5) {
                // High density (Cruise/Threshold intervals with short rest, e.g. 5m work / 1-1.5m rest)
                densityFactor = Math.min(0.99, 0.97 + ((workToRestRatio - 2.5) * 0.005));
            } else if (workToRestRatio >= 1.5) {
                // Moderate density (VO2max intervals with moderate rest)
                densityFactor = 0.93 + ((workToRestRatio - 1.5) * 0.04);
            } else {
                // Low density / Full recovery (Anaerobic speed repeats with generous rest)
                densityFactor = Math.max(0.86, 0.88 + ((workToRestRatio - 0.5) * 0.05));
            }
        } else {
            densityFactor = 0.97;
        }
    }

    // 4. Physiological %HRmax Aerobic Velocity Scaling (Tier 3)
    let hrInput = (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgHeartRate) || w.actualHeartRate || w.rawHr;
    let velocityFraction = 0.95; // Default fallback to threshold velocity
    let mathLabel = "";

    if (hrInput && hrInput > 60) {
        const pctMaxHr = hrInput / maxHr;
        debugObj.hrUsed = hrInput;
        debugObj.maxHr = maxHr;

        if (pctMaxHr >= 0.96) {
            // Zone 5+ (VO2max / Sprint Repeats)
            velocityFraction = Math.min(1.04, 1.02 + ((pctMaxHr - 0.96) * 0.5));
            mathLabel = `Zone 5+ (${Math.round(hrInput)} BPM)`;
        } else if (pctMaxHr >= 0.90) {
            // Zone 5 (5K Race Effort / Hard Intervals)
            velocityFraction = 0.98 + (((pctMaxHr - 0.90) / 0.06) * 0.04);
            mathLabel = `Zone 5 (${Math.round(hrInput)} BPM)`;
        } else if (pctMaxHr >= 0.84) {
            // Zone 4 (Threshold / Tempo)
            velocityFraction = 0.94 + (((pctMaxHr - 0.84) / 0.06) * 0.04);
            mathLabel = `Zone 4 / Tempo (${Math.round(hrInput)} BPM)`;
        } else if (pctMaxHr >= 0.76) {
            // Zone 3 (Steady Aerobic / Moderate)
            velocityFraction = 0.89 + (((pctMaxHr - 0.76) / 0.08) * 0.05);
            mathLabel = `Zone 3 / Steady (${Math.round(hrInput)} BPM)`;
        } else if (pctMaxHr >= 0.65) {
            // Zone 2 (Easy Aerobic / Conversational)
            velocityFraction = 0.84 + (((pctMaxHr - 0.65) / 0.11) * 0.05);
            mathLabel = `Zone 2 / Easy (${Math.round(hrInput)} BPM)`;
        } else {
            // Zone 1 (Recovery / Flush)
            velocityFraction = Math.max(0.78, 0.80 + ((pctMaxHr - 0.55) * 0.4));
            mathLabel = `Zone 1 / Recovery (${Math.round(hrInput)} BPM)`;
        }
    } else if (w.effortZone) {
        // Effort Zone (1-5) Direct Mapping
        const zoneNum = Number(w.effortZone);
        const zoneVelocityMap = { 1: 0.81, 2: 0.86, 3: 0.90, 4: 0.95, 5: 1.00 };
        velocityFraction = zoneVelocityMap[zoneNum] || 0.92;
        mathLabel = `Effort Zone ${zoneNum}`;
    } else if (w.rpeScore) {
        // Legacy RPE (1-10) Mapping
        const rpeNum = Number(w.rpeScore);
        if (rpeNum <= 2) velocityFraction = 0.81;
        else if (rpeNum <= 4) velocityFraction = 0.86;
        else if (rpeNum <= 6) velocityFraction = 0.90;
        else if (rpeNum <= 8) velocityFraction = 0.95;
        else velocityFraction = 1.00;
        mathLabel = `RPE ${rpeNum}/10`;
    } else {
        // Workout Category / Type Offset Fallback
        const type = (w.type || '').toLowerCase();
        const zone = (w.targetPaceZone || '').toLowerCase();

        if (type.includes('easy') || zone.includes('easy') || type.includes('recovery')) {
            velocityFraction = 0.85;
            mathLabel = 'Easy / Aerobic Offset';
        } else if (type.includes('long') || zone.includes('long')) {
            velocityFraction = 0.88;
            mathLabel = 'Long Run Offset';
        } else if (type.includes('tempo') || zone.includes('tempo')) {
            velocityFraction = 0.95;
            mathLabel = 'Tempo Offset';
        } else if (type.includes('fast') || type.includes('speed') || type.includes('interval') || w.isBenchmark) {
            velocityFraction = 1.00;
            mathLabel = 'Direct Speed / Benchmark';
        } else {
            velocityFraction = 0.92;
            mathLabel = 'Standard Run Offset';
        }
    }

    if (isIntervalSession && repCount > 1) {
        mathLabel += ` [${repCount}x Intervals]`;
    }
    debugObj.mathType = mathLabel;

    // 5. Convert Logged Pace to Base 5K Pace Equivalent
    let base5KPaceSec = loggedSec;

    if (isIntervalSession && repCount > 1) {
        // In an interval session with recovery breaks:
        // Rest intervals assist the runner in holding faster rep times than continuous running.
        // - Tempo / Threshold intervals (Zone 4, e.g. 3x5 min @ 7:23 with rest): continuous 5K pace is anchored right around rep pace (~7:18 - 7:23 /mi)
        // - Speed / VO2max repeats (Zone 5+, e.g. 8x400m @ 6:15 with rest): continuous 5K is slower than short sprint rep pace (~6:26 - 6:35 /mi)
        // - Aerobic / Easy intervals (Zone 2-3): continuous 5K is moderately faster
        if (velocityFraction >= 1.01) {
            // Speed / Anaerobic Repeats with generous rest
            base5KPaceSec = loggedSec * (1.03 + (densityFactor < 0.92 ? 0.02 : 0));
        } else if (velocityFraction >= 0.93) {
            // Tempo / Threshold Intervals (e.g. 3x5 min @ 7:23 with 2m rest)
            base5KPaceSec = loggedSec * (0.99 + ((1.0 - densityFactor) * 0.3));
        } else {
            // Aerobic / Moderate Cruise Intervals (Zone 2-3)
            base5KPaceSec = loggedSec * Math.min(0.96, velocityFraction * 1.06);
        }
    } else {
        // Continuous steady-state run (No rest intervals)
        // Scales directly via the physiological %HRmax aerobic velocity curve
        base5KPaceSec = loggedSec * velocityFraction;
    }

    // 6. Non-Linear Distance Scaling via Peter Riegel's Power Law (Tier 4)
    // Pace_target = Pace_5K * (D_target / 3.1068)^(b - 1)
    let fatigueExponent = 1.06; // Standard 5K-10K scaling
    let targetDistMiles = 3.1068; // 5K default

    if (targetDistance === '10K') {
        targetDistMiles = 6.2137;
        fatigueExponent = 1.06;
    } else if (targetDistance === 'Half Marathon') {
        targetDistMiles = 13.1094;
        fatigueExponent = 1.07;
    } else if (targetDistance === 'Marathon') {
        targetDistMiles = 26.2188;
        fatigueExponent = 1.08;
    } else if (targetDistance === 'Ultra') {
        targetDistMiles = 31.0686;
        fatigueExponent = 1.09;
    } else {
        targetDistMiles = 3.1068;
        fatigueExponent = 1.06;
    }

    // If workout was a short sprint effort (<0.75 mi), cap extrapolation to 10K max
    if (isVeryShortEffort && targetDistMiles > 6.2137) {
        targetDistMiles = 6.2137;
    }

    const distanceScalingFactor = Math.pow(targetDistMiles / 3.1068, fatigueExponent - 1.0);
    const finalProjectedPaceSec = Math.round(base5KPaceSec * distanceScalingFactor);

    return Math.max(240, Math.min(900, finalProjectedPaceSec)); // Clamp between 4:00/mi and 15:00/mi
}

function updatePaceChart(data, completedRuns, isFullJourney = false) {
    if (!data) return;
    const canvasId = isFullJourney ? 'full-pace-journey-chart' : 'pace-chart';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Clean up activeAdjustedGoal string (e.g. remove leading zeros like '06:46' -> '6:46')
    let rawGoal = data.activeAdjustedGoal || "-";
    let cleanGoal = rawGoal;
    if (typeof cleanGoal === 'string' && cleanGoal.startsWith('0') && cleanGoal.length > 1 && cleanGoal[1] !== ':') {
        cleanGoal = cleanGoal.replace(/^0+/, '');
    } else if (typeof cleanGoal === 'string' && cleanGoal.startsWith('0') && cleanGoal.includes(':')) {
        cleanGoal = cleanGoal.replace(/^0/, '');
    }

    // Set Goal Target display text
    const goalDisplay = document.getElementById('goal-pace-display');
    if (goalDisplay) {
        goalDisplay.innerText = cleanGoal !== '-' ? `${cleanGoal} / mi` : '-';
    }

    const modalPaceStart = document.getElementById('modal-pace-start');
    if (modalPaceStart) {
        modalPaceStart.innerText = `${data.baseline5k || "8:10"} / mi`;
    }

    const modalPaceTarget = document.getElementById('modal-pace-target');
    if (modalPaceTarget) {
        modalPaceTarget.innerText = cleanGoal !== '-' ? `${cleanGoal} / mi` : '-';
    }

    const startSec = paceStringToSeconds(data.baseline5k || "8:10");
    const goalSec = paceStringToSeconds(cleanGoal || "6:26");

    // 1. Generate Timeline for EVERY Week across the macrocycle
    const { labels: allLabels, windows: allWindows, numWeeks, startMs } = generateWeeklyTimeline(data.journeyStartDate, data.targetDate, 12);

    // 2. Linear Projected Goal Line across all weeks
    const allProjected = [];
    for (let i = 0; i < numWeeks; i++) {
        const sec = startSec - (i * (startSec - goalSec) / Math.max(1, numWeeks - 1));
        allProjected.push(sec / 60);
    }

    // 3. Calculate Weekly Volume & Weekly Est. Pace for EVERY Week
    const allWeeklyVolume = Array(numWeeks).fill(0);
    const allWeeklyEstPace = Array(numWeeks).fill(null);

    // Baseline bubble at Week 1 if initialized
    if (allWeeklyEstPace.length > 0) {
        allWeeklyEstPace[0] = startSec / 60;
    }

    const runs = completedRuns || (typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : []);

    for (let wIdx = 0; wIdx < numWeeks; wIdx++) {
        const weekWin = allWindows[wIdx];
        let weekVolume = 0;
        let weekPaceSecs = [];

        runs.forEach(w => {
            let wMs = 0;
            if (w.dateExecuted) {
                wMs = new Date(w.dateExecuted).getTime();
            } else if (w.sequenceOrder) {
                const wkOffset = Math.floor((w.sequenceOrder - 1) / 3);
                wMs = startMs + (wkOffset * 7 * 24 * 60 * 60 * 1000);
            }

            if (wMs >= weekWin.start && wMs < weekWin.end) {
                const miles = extractWorkoutMileage(w);
                if (miles > 0) weekVolume += miles;

                const type = (w.type || '').toLowerCase();
                const excludedTypes = ['bike', 'walk', 'swim', 'row', 'strength', 'yoga', 'mobility', 'hike'];
                const isExcluded = excludedTypes.some(ex => type.includes(ex));
                const hasPace = w.actualLoggedPace || (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgPace);

                if (hasPace && !isExcluded) {
                    const estSec = convertRunToEst5KPaceSec(w);
                    if (estSec !== null) {
                        weekPaceSecs.push(estSec);
                    }
                }
            }
        });

        allWeeklyVolume[wIdx] = parseFloat(weekVolume.toFixed(1));

        if (weekPaceSecs.length > 0) {
            const avgSec = weekPaceSecs.reduce((a, b) => a + b, 0) / weekPaceSecs.length;
            allWeeklyEstPace[wIdx] = avgSec / 60;
        }
    }

    // Determine dataset slice for default 5-week focus vs full journey
    let labels, weeklyEstPaceData, projectedData, weeklyVolumeData;

    if (isFullJourney) {
        labels = allLabels;
        weeklyEstPaceData = allWeeklyEstPace;
        projectedData = allProjected;
        weeklyVolumeData = allWeeklyVolume;
    } else {
        // Find latest active week index (by logged volume/pace or current calendar date)
        let latestActiveWeekIdx = 0;
        const nowMs = Date.now();
        for (let i = 0; i < numWeeks; i++) {
            if (allWeeklyVolume[i] > 0 || (allWeeklyEstPace[i] !== null && i > 0) || (nowMs >= allWindows[i].start)) {
                latestActiveWeekIdx = i;
            }
        }

        let sliceEnd = Math.max(5, latestActiveWeekIdx + 1);
        sliceEnd = Math.min(numWeeks, sliceEnd);
        let sliceStart = Math.max(0, sliceEnd - 5);

        labels = allLabels.slice(sliceStart, sliceEnd);
        weeklyEstPaceData = allWeeklyEstPace.slice(sliceStart, sliceEnd);
        projectedData = allProjected.slice(sliceStart, sliceEnd);
        weeklyVolumeData = allWeeklyVolume.slice(sliceStart, sliceEnd);
    }

    const instanceKey = isFullJourney ? 'fullPaceChartInstance' : 'paceChartInstance';

    if (window[instanceKey]) {
        window[instanceKey].data.labels = labels;
        window[instanceKey].data.datasets[0].data = weeklyEstPaceData;
        window[instanceKey].data.datasets[1].data = projectedData;
        window[instanceKey].data.datasets[2].data = weeklyVolumeData;
        window[instanceKey].options.scales.x.ticks.maxTicksLimit = isFullJourney ? 8 : 5;
        window[instanceKey].update();
    } else {
        const ctx = canvas.getContext('2d');
        window[instanceKey] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Est. Pace',
                        type: 'line',
                        yAxisID: 'y',
                        data: weeklyEstPaceData,
                        borderColor: '#6366f1', // Indigo-500
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        borderWidth: 3.5,
                        pointBackgroundColor: '#6366f1',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: isFullJourney ? 5 : 6.5,
                        pointHoverRadius: 8,
                        tension: 0.2,
                        spanGaps: true,
                        order: 1
                    },
                    {
                        label: 'Target Trend',
                        type: 'line',
                        yAxisID: 'y',
                        data: projectedData,
                        borderColor: '#94a3b8', // Slate-400
                        borderDash: [6, 6],
                        borderWidth: 1.5,
                        pointBackgroundColor: '#94a3b8',
                        pointHoverRadius: 4,
                        tension: 0.1,
                        fill: false,
                        order: 2
                    },
                    {
                        label: 'Weekly Volume',
                        type: 'bar',
                        yAxisID: 'y1',
                        data: weeklyVolumeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.35)',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        barPercentage: isFullJourney ? 0.6 : 0.45,
                        order: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 },
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderWidth: 1,
                        titleColor: '#fff',
                        titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
                        bodyColor: '#94a3b8',
                        bodyFont: { family: 'Plus Jakarta Sans' },
                        callbacks: {
                            label: function (context) {
                                const val = context.raw;
                                if (val === null || val === undefined) return '';
                                const label = context.dataset.label || '';
                                if (context.dataset.yAxisID === 'y1') {
                                    return ` ${label}: ${parseFloat(val.toFixed(1))} miles`;
                                }
                                const mins = Math.floor(val);
                                const secs = Math.round((val - mins) * 60);
                                return ` ${label}: ${mins}:${secs < 10 ? '0' : ''}${secs} /mi`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 10 },
                            autoSkip: false,
                            maxTicksLimit: isFullJourney ? 8 : 5,
                            maxRotation: 0,
                            minRotation: 0
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Pace (min/mi)', color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10, weight: 'bold' } },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 10 },
                            callback: function (value) {
                                const mins = Math.floor(value);
                                const secs = Math.round((value - mins) * 60);
                                return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Weekly Volume (mi)', color: '#10b981', font: { family: 'Plus Jakarta Sans', size: 10, weight: 'bold' } },
                        grid: { display: false },
                        ticks: {
                            color: '#10b981',
                            font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' },
                            callback: function (v) {
                                return (typeof window !== 'undefined' && window.innerWidth < 480) ? `${v}m` : `${v} mi`;
                            }
                        }
                    }
                }
            }
        });
    }
}

function formatPace(totalMinutes) {
            const mins = Math.floor(totalMinutes);
            const secs = Math.round((totalMinutes - mins) * 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

function calculateTargetPaces() {
            const currentMins = parseFloat(document.getElementById('input-min').value) || 8;
            const currentSecs = parseFloat(document.getElementById('input-sec').value) || 10;
            const decimalPace = currentMins + (currentSecs / 60);

            const easyMin = decimalPace + (65 / 60);
            const easyMax = decimalPace + (95 / 60);
            const longMin = decimalPace + (40 / 60);
            const longMax = decimalPace + (70 / 60);
            const tempoMin = decimalPace + (15 / 60);
            const tempoMax = decimalPace + (30 / 60);

            const easyEl = document.getElementById('pace-easy');
            if (easyEl) easyEl.innerText = `${formatPace(easyMin)} - ${formatPace(easyMax)} /mi`;
            const longEl = document.getElementById('pace-long');
            if (longEl) longEl.innerText = `${formatPace(longMin)} - ${formatPace(longMax)} /mi`;
            const tempoEl = document.getElementById('pace-tempo');
            if (tempoEl) tempoEl.innerText = `${formatPace(tempoMin)} - ${formatPace(tempoMax)} /mi`;

            updateTimelinePaceLabels(easyMin, easyMax, longMin, longMax, tempoMin, tempoMax);
        }

function updateTimelinePaceLabels(easyMin, easyMax, longMin, longMax, tempoMin, tempoMax) {
            const allPaceLabels = document.querySelectorAll('.dynamic-pace-hint');
            allPaceLabels.forEach(label => {
                const type = label.dataset.type;
                if (type === 'easy') {
                    const mid = Math.round((easyMin + easyMax) / 2);
                    label.innerText = `~${formatPace(mid)} /mi`;
                } else if (type === 'long') {
                    const mid = Math.round((longMin + longMax) / 2);
                    label.innerText = `~${formatPace(mid)} /mi`;
                } else if (type === 'tempo') {
                    const mid = Math.round((tempoMin + tempoMax) / 2);
                    label.innerText = `~${formatPace(mid)} /mi`;
                } else if (type === 'goal') {
                    label.innerText = `~${userProfileData ? userProfileData.activeAdjustedGoal : "6:26"} /mi`;
                } else if (type === 'race') {
                    label.innerText = `LFG: Target Sub-20 (6:25/mi or faster)`;
                } else if (type && (type.includes(':') || type.includes('-'))) {
                    const midStr = typeof parsePaceToMidpoint === 'function' ? parsePaceToMidpoint(type) : type;
                    label.innerText = `~${midStr} /mi`;
                }
            });
        }

function paceStringToSeconds(paceInput) {
            if (!paceInput && paceInput !== 0) return 490; // Default 8:10 (490s)
            if (typeof paceInput === 'number') return paceInput;
            const str = String(paceInput).trim().replace(/\/mi|min\/mi|mi/gi, '').trim();
            if (str.includes('-') || str.includes('–')) {
                const parts = str.split(/[-–]/);
                if (parts.length === 2) {
                    const s1 = paceStringToSeconds(parts[0].trim());
                    const s2 = paceStringToSeconds(parts[1].trim());
                    return Math.round((s1 + s2) / 2);
                }
            }
            if (!str.includes(':')) {
                const num = parseFloat(str);
                return !isNaN(num) ? num : 490;
            }
            const parts = str.split(':');
            if (parts.length !== 2) return 490;
            const m = parseInt(parts[0], 10);
            const s = parseInt(parts[1], 10);
            if (isNaN(m) || isNaN(s)) return 490;
            return m * 60 + s;
        }

function parsePaceToMidpoint(paceStr) {
            if (!paceStr) return null;
            const str = String(paceStr).trim().replace(/\/mi|min\/mi|mi/gi, '').trim();
            if (str.includes('-') || str.includes('–')) {
                const parts = str.split(/[-–]/);
                if (parts.length === 2) {
                    const sec1 = paceStringToSeconds(parts[0].trim());
                    const sec2 = paceStringToSeconds(parts[1].trim());
                    const midSec = Math.round((sec1 + sec2) / 2);
                    const m = Math.floor(midSec / 60);
                    const s = midSec % 60;
                    return `${m}:${s < 10 ? '0' + s : s}`;
                }
            }
            if (str.includes(':')) {
                const parts = str.split(':');
                const m = parseInt(parts[0], 10);
                const s = parseInt(parts[1], 10);
                if (!isNaN(m) && !isNaN(s)) {
                    return `${m}:${s < 10 ? '0' + s : s}`;
                }
            }
            return str;
        }

function extractWorkoutMileage(workout) {
            if (!workout) return 0;

            // 1. Primary priority: User's explicitly logged distance (stored as double/float)
            if (workout.actualLoggedDistance !== null && workout.actualLoggedDistance !== undefined && workout.actualLoggedDistance !== "") {
                const distNum = parseFloat(workout.actualLoggedDistance);
                if (!isNaN(distNum) && distNum > 0) {
                    return distNum;
                }
            }

            // 2. Secondary priority: GPX / TCX uploaded file
            if (workout.uploadedWorkoutFile && workout.uploadedWorkoutFile.totalDistanceMeters) {
                return workout.uploadedWorkoutFile.totalDistanceMeters / 1609.344;
            }

            // 3. Structured Interval Workout fallback (calculate total work volume)
            if (workout.intervalRepCount && workout.intervalWorkValue) {
                const reps = parseInt(workout.intervalRepCount) || 1;
                const val = parseFloat(workout.intervalWorkValue) || 1;
                const unit = (workout.intervalWorkUnit || '').toLowerCase();
                const type = (workout.intervalType || '').toLowerCase();

                if (type === 'time' || unit.includes('min') || unit.includes('sec')) {
                    const totalWorkMins = unit.includes('sec') ? (reps * val) / 60 : (reps * val);
                    const paceSec = workout.actualLoggedPace ? paceStringToSeconds(workout.actualLoggedPace) : (workout.intervalTargetPace ? paceStringToSeconds(workout.intervalTargetPace) : 480);
                    const paceMins = paceSec / 60;
                    if (paceMins > 0) {
                        return parseFloat((totalWorkMins / paceMins).toFixed(2));
                    }
                } else if (type === 'distance' || unit.includes('m') || unit.includes('k') || unit.includes('mi')) {
                    let milesPerRep = 0.24855; // 400m default
                    if (unit.includes('k')) milesPerRep = val * 0.621371;
                    else if (unit.includes('mi')) milesPerRep = val;
                    else if (unit.includes('m') || val > 50) milesPerRep = val * 0.000621371;
                    return parseFloat((reps * milesPerRep).toFixed(2));
                }
            }

            // 4. Explicit target distance field if present
            if (workout.targetDistance !== null && workout.targetDistance !== undefined && workout.targetDistance !== "") {
                const targetDistNum = parseFloat(workout.targetDistance);
                if (!isNaN(targetDistNum) && targetDistNum > 0) {
                    return targetDistNum;
                }
            }

            const type = (workout.type || '').toLowerCase();
            const title = (workout.workoutTitle || '').toLowerCase();

            // Exclude cross training and non-mile based activities
            if (type.includes('cross') || title.includes('cross training') || title.includes('xt')) {
                return 0;
            }

            // Exclude non-running sessions (Strength, Rest, Recovery) unless GPX or logged distance exists
            if ((type === 'strength' || type === 'rest' || title.includes('strength') || title.includes('rest day')) && (!workout.uploadedWorkoutFile || !workout.uploadedWorkoutFile.totalDistanceMeters)) {
                return 0;
            }

            if (!workout.distanceDuration) return 0;
            const str = String(workout.distanceDuration).trim().toLowerCase();

            if (str.includes('5k')) return 3.1;
            if (str.includes('10k')) return 6.2;
            if (str.includes('half') || str.includes('13.1')) return 13.1;
            if (str.includes('marathon') || str.includes('26.2')) return 26.2;

            // Check for explicit miles / mi
            const mileMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/);
            if (mileMatch) {
                return parseFloat(mileMatch[1]);
            }

            // Check for explicit km / k
            const kmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:km|k)\b/);
            if (kmMatch) {
                return parseFloat(kmMatch[1]) * 0.621371;
            }

            // Check for explicit time in minutes (e.g. "30 mins")
            if (str.includes('min')) {
                const minsMatch = str.match(/(\d+)\s*min/);
                if (minsMatch) {
                    const mins = parseInt(minsMatch[1]);
                    if (type === 'fast' || type === 'easy' || type === 'long' || type === 'tempo' || type === 'interval' || workout.isSpeedWorkout) {
                        const paceSec = workout.actualLoggedPace ? paceStringToSeconds(workout.actualLoggedPace) : 480; // 8:00 pace default
                        const paceMins = paceSec / 60;
                        return parseFloat((mins / paceMins).toFixed(1));
                    }
                }
                return 0;
            }

            // Generic number fallback
            const genericMatch = str.match(/(\d+(?:\.\d+)?)/);
            if (genericMatch) {
                return parseFloat(genericMatch[1]);
            }

            return 0;
        }

