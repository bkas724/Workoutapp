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

            // First, determine user's Age for Max HR calculation
            let age = 35; // Default age fallback
            let targetDistance = '5K'; // Default
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

            let hrInput = (w.uploadedWorkoutFile && w.uploadedWorkoutFile.avgHeartRate) || w.actualHeartRate || w.rawHr;
            if (hrInput) debugObj.mathType = `Actual: ${Math.round(hrInput)} BPM`;
            
function calculateHrForZone(zoneValue) {
    if (!zoneValue) return "";
    let age = 35; // Default age fallback
    if (typeof userProfileData !== 'undefined' && userProfileData) {
        if (userProfileData.age) {
            age = userProfileData.age;
        } else if (userProfileData.birthYear) {
            age = new Date().getFullYear() - userProfileData.birthYear;
        }
    }
    const maxHr = 220 - age;
    const effortToHrMultiplier = {
        1: 0.60, // Zone 1: Recovery (~60% max HR)
        2: 0.70, // Zone 2: Easy Aerobic (~70% max HR)
        3: 0.80, // Zone 3: Moderate / Tempo (~80% max HR)
        4: 0.88, // Zone 4: Hard / Threshold (~88% max HR)
        5: 0.95  // Zone 5: Max Effort (~95% max HR)
    };
    const mult = effortToHrMultiplier[Number(zoneValue)];
    if (!mult) return "";
    return Math.round(maxHr * mult);
}

            if (!hrInput) {
                if (w.effortZone) {
                    // New System: Map 5-Zone Effort (1-5) to representative HR estimate using percentage of Max HR
                    hrInput = calculateHrForZone(w.effortZone);
                    debugObj.mathType = `Zone ${w.effortZone}: ${hrInput} BPM`;
                } else if (w.rpeScore) {
                    // Legacy System: Map old 1-10 RPE scores to representative HR estimate using percentage of Max HR
                    let score = Number(w.rpeScore);
                    const legacyRpeToHrMultiplier = {
                        1: 0.50, 2: 0.57, 3: 0.64, 4: 0.70, 5: 0.75,
                        6: 0.80, 7: 0.85, 8: 0.90, 9: 0.95, 10: 0.98
                    };
                    hrInput = Math.round(maxHr * (legacyRpeToHrMultiplier[score] || 0.70));
                    debugObj.mathType = `RPE ${score}: ${hrInput} BPM`;
                }
            }

            if (hrInput && hrInput > 60) {
                debugObj.hrUsed = hrInput;
                // Dynamic race HR multiplier based on target distance
                let hrMultiplier = 0.92; // default 5K
                if (targetDistance === '10K') hrMultiplier = 0.90;
                else if (targetDistance === 'Half Marathon') hrMultiplier = 0.85;
                else if (targetDistance === 'Marathon') hrMultiplier = 0.80;
                else if (targetDistance === 'Ultra') hrMultiplier = 0.75;
                else if (targetDistance === 'Other') hrMultiplier = 0.85;

                const raceHr = Math.round(maxHr * hrMultiplier);
                debugObj.raceHr = raceHr;

                // Dynamic formula based on User's projected Race HR
                // Clamp the ratio between 0.65 and 1.15 to prevent extreme mathematical anomalies
                const ratio = Math.max(0.65, Math.min(1.15, (hrInput - 60) / (raceHr - 60)));
                const projectedPaceSecPerMile = loggedSec * ratio;
                return Math.max(270, Math.round(projectedPaceSecPerMile)); // Min clamp 4:30/mi
            }

            const type = (w.type || '').toLowerCase();
            const zone = (w.targetPaceZone || '').toLowerCase();

            let offsetSec = 0;
            if (type.includes('easy') || zone.includes('easy')) {
                offsetSec = -80; // Easy run pace ~80s slower than 5K pace
            } else if (type.includes('long') || zone.includes('long')) {
                offsetSec = -90; // Long run pace ~90s slower than 5K pace
            } else if (type.includes('tempo') || zone.includes('tempo')) {
                offsetSec = -25; // Tempo run pace ~25s slower than 5K pace
            } else if (type.includes('fast') || type.includes('speed') || type.includes('interval') || w.isBenchmark) {
                offsetSec = 0;   // Direct effort
            } else {
                offsetSec = -30;
            }

            debugObj.mathType = `Offset Fallback: ${offsetSec}s`;
            return Math.max(270, loggedSec + offsetSec); // Clamp at 4:30 min/mi minimum
        }

function updatePaceChart(data, completedRuns) {
            if (!data) return;
            const canvas = document.getElementById('pace-chart');
            if (!canvas) return;

            // Set Goal Target display text
            const goalDisplay = document.getElementById('goal-pace-display');
            if (goalDisplay) {
                goalDisplay.innerText = `${data.activeAdjustedGoal || "-"} / mi`;
            }

            const startSec = paceStringToSeconds(data.baseline5k || "8:10");
            const goalSec = paceStringToSeconds(data.activeAdjustedGoal || "6:26");

            // 1. Generate Timeline for EVERY Week across the macrocycle
            const { labels, windows, numWeeks, startMs } = generateWeeklyTimeline(data.journeyStartDate, data.targetDate, 12);

            // 2. Linear Projected Goal Line
            const projectedData = [];
            for (let i = 0; i < numWeeks; i++) {
                const sec = startSec - (i * (startSec - goalSec) / (numWeeks - 1));
                projectedData.push(sec / 60);
            }

            // 3. Calculate Weekly Volume & Weekly Est. 5K Race Pace Bubbles for EVERY Week
            const weeklyVolumeData = Array(numWeeks).fill(0);
            const weeklyEstPaceData = Array(numWeeks).fill(null);

            // Baseline bubble at Week 1 if no runs completed yet
            weeklyEstPaceData[0] = startSec / 60;

            const runs = completedRuns || (typeof activePhaseWorkouts !== 'undefined' ? activePhaseWorkouts : []);

            for (let wIdx = 0; wIdx < numWeeks; wIdx++) {
                const weekWin = windows[wIdx];
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

                weeklyVolumeData[wIdx] = parseFloat(weekVolume.toFixed(1));

                if (weekPaceSecs.length > 0) {
                    const avgSec = weekPaceSecs.reduce((a, b) => a + b, 0) / weekPaceSecs.length;
                    weeklyEstPaceData[wIdx] = avgSec / 60;
                }
            }

            // Update or Create Mixed Dual-Axis Chart Instance
            if (paceChartInstance) {
                paceChartInstance.data.labels = labels;
                paceChartInstance.data.datasets[0].data = weeklyEstPaceData;
                paceChartInstance.data.datasets[1].data = projectedData;
                paceChartInstance.data.datasets[2].data = weeklyVolumeData;
                paceChartInstance.update();
            } else {
                const ctx = canvas.getContext('2d');
                paceChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Weekly Est. 5K Pace',
                                type: 'line',
                                yAxisID: 'y',
                                data: weeklyEstPaceData,
                                borderColor: '#6366f1', // Indigo-500
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                borderWidth: 3.5,
                                pointBackgroundColor: '#6366f1',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 2,
                                pointRadius: 6.5,
                                pointHoverRadius: 9,
                                tension: 0.2,
                                spanGaps: true,
                                order: 1
                            },
                            {
                                label: 'Projected Pace Target',
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
                                barPercentage: 0.45,
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
                                    boxWidth: 12,
                                    boxHeight: 12,
                                    padding: 15
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
                                    autoSkip: true,
                                    maxTicksLimit: 4,
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
                                    callback: function (v) { return `${v} mi`; }
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
            const tempoMin = decimalPace - (70 / 60);
            const tempoMax = decimalPace - (45 / 60);

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
                    label.innerText = `${formatPace(easyMin)} - ${formatPace(easyMax)} /mi`;
                } else if (type === 'long') {
                    label.innerText = `${formatPace(longMin)} - ${formatPace(longMax)} /mi`;
                } else if (type === 'tempo') {
                    label.innerText = `${formatPace(tempoMin)} - ${formatPace(tempoMax)} /mi`;
                } else if (type === 'goal') {
                    label.innerText = `${userProfileData ? userProfileData.activeAdjustedGoal : "6:26"} /mi`;
                } else if (type === 'race') {
                    label.innerText = `LFG: Target Sub-20 (6:25/mi or faster)`;
                }
            });
        }

function paceStringToSeconds(paceInput) {
            if (!paceInput && paceInput !== 0) return 490; // Default 8:10 (490s)
            if (typeof paceInput === 'number') return paceInput;
            const str = String(paceInput).trim().replace(/\/mi|min\/mi|mi/gi, '').trim();
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

            // 3. Explicit target distance field if present
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
                    if (type === 'fast' || type === 'easy' || type === 'long' || workout.isSpeedWorkout) {
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

