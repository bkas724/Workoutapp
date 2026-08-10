        let isTurkeyTrotGuest = false;

        function bypassToTurkeyTrot() {
            isTurkeyTrotGuest = true;
            document.getElementById('onboarding-modal').classList.add('hidden');
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('block');
            });
            // Show Turkey Trot tab
            document.getElementById('turkey-trot-card').classList.remove('hidden');
            document.getElementById('turkey-trot-card').classList.add('block');

            // Hide the bottom navigation for guests
            const bottomNav = document.querySelector('nav');
            if (bottomNav) bottomNav.classList.add('hidden');

            // Show the guest back button
            document.getElementById('tt-guest-back').classList.remove('hidden');

            // Hide the submission area
            document.getElementById('tt-submit-area').classList.add('hidden');

            loadTurkeyTrotData();
        }

        window.isTTDemoMode = false;
        window.toggleTTDemoMode = function () {
            window.isTTDemoMode = !window.isTTDemoMode;
            const btn = document.getElementById('tt-demo-btn');
            if (btn) {
                if (window.isTTDemoMode) {
                    btn.className = "px-2.5 py-1 rounded-full border border-amber-400 bg-amber-500 text-slate-950 font-black text-[10px] shadow-md transition-all cursor-pointer";
                    btn.innerText = "🧪 Demo Mode ON";
                } else {
                    btn.className = "px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[10px] font-extrabold transition-all cursor-pointer";
                    btn.innerText = "🧪 Test Data";
                }
            }
            loadTurkeyTrotData();
        };

        window.currentTTRange = 'focus';
        window.switchTTRange = function (range) {
            window.currentTTRange = range;
            const btnFull = document.getElementById('tt-range-full');
            const btnFocus = document.getElementById('tt-range-focus');
            if (btnFull && btnFocus) {
                if (range === 'full') {
                    btnFull.className = "px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 font-extrabold shadow-sm transition-all cursor-pointer";
                    btnFocus.className = "px-2.5 py-1 rounded-full text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer";
                } else {
                    btnFocus.className = "px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black shadow-sm transition-all cursor-pointer";
                    btnFull.className = "px-2.5 py-1 rounded-full text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer";
                }
            }
            if (typeof loadTurkeyTrotData === 'function') {
                loadTurkeyTrotData();
            }
        };

        window.checkDevMode = function () {
            const params = new URLSearchParams(window.location.search);
            const isDev = params.get('dev') === 'true' ||
                params.get('debug') === 'true' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

            const devToggleBar = document.getElementById('tt-dev-toggle-bar');
            const demoBtn = document.getElementById('tt-demo-btn');

            if (isDev) {
                if (devToggleBar) devToggleBar.classList.remove('hidden');
                if (demoBtn) demoBtn.classList.remove('hidden');
            } else {
                if (devToggleBar) devToggleBar.classList.add('hidden');
                if (demoBtn) demoBtn.classList.add('hidden');
            }
            return isDev;
        };

        window.currentTTView = 'kickoff';
        window.switchTTView = function (view) {
            window.currentTTView = view;
            window.hasUserToggledView = true;
            const btnKickoff = document.getElementById('tt-view-kickoff');
            const btnChart = document.getElementById('tt-view-chart');
            const kickoffBox = document.getElementById('tt-kickoff-box');
            const chartContainer = document.getElementById('tt-chart-container');

            if (btnKickoff && btnChart) {
                if (view === 'kickoff') {
                    btnKickoff.className = "px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black shadow-md transition-all cursor-pointer";
                    btnChart.className = "px-3.5 py-1.5 rounded-full text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer";
                    if (kickoffBox) kickoffBox.classList.remove('hidden');
                    if (chartContainer) chartContainer.classList.add('hidden');
                } else {
                    btnChart.className = "px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black shadow-md transition-all cursor-pointer";
                    btnKickoff.className = "px-3.5 py-1.5 rounded-full text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer";
                    if (kickoffBox) kickoffBox.classList.add('hidden');
                    if (chartContainer) chartContainer.classList.remove('hidden');
                }
            }
        };

        window.updateKickoffGapSimulator = function (val) {
            const gapPercent = parseFloat(val) || 0;
            const badge = document.getElementById('tt-slider-val-badge');

            let effortDesc = "Baseline";
            if (gapPercent > 0 && gapPercent <= 10) {
                effortDesc = "Light";
            } else if (gapPercent > 10 && gapPercent <= 20) {
                effortDesc = "Consistent";
            } else if (gapPercent > 20 && gapPercent <= 30) {
                effortDesc = "Aggressive";
            } else if (gapPercent > 30) {
                effortDesc = "Peak";
            }

            if (badge) badge.innerText = `+${gapPercent.toFixed(1)}% (${effortDesc})`;

            const baseBkas = window.baselineBkas || 1425; // 23:45 default
            const baseAcap = window.baselineAcap || 1470; // 24:30 default

            const formatTimeLocal = (secs) => {
                if (!secs || isNaN(secs)) return "--:--";
                const m = Math.floor(secs / 60);
                const s = Math.floor(secs % 60);
                return m + ':' + (s < 10 ? '0' : '') + s;
            };

            // Log formula: S = gapPercent -> T_proj = T_base * (755 / T_base)^(S / 100)
            const projBkasSecs = baseBkas * Math.pow(755 / baseBkas, gapPercent / 100);
            const projAcapSecs = baseAcap * Math.pow(755 / baseAcap, gapPercent / 100);

            const dropBkas = baseBkas - projBkasSecs;
            const dropAcap = baseAcap - projAcapSecs;

            const baseBkasEl = document.getElementById('tt-kickoff-base-bkas');
            const projBkasEl = document.getElementById('tt-kickoff-proj-bkas');
            const dropBkasEl = document.getElementById('tt-kickoff-drop-bkas');

            const baseAcapEl = document.getElementById('tt-kickoff-base-acap');
            const projAcapEl = document.getElementById('tt-kickoff-proj-acap');
            const dropAcapEl = document.getElementById('tt-kickoff-drop-acap');

            if (baseBkasEl) baseBkasEl.innerText = formatTimeLocal(baseBkas);
            if (projBkasEl) projBkasEl.innerText = formatTimeLocal(Math.round(projBkasSecs));
            if (dropBkasEl) dropBkasEl.innerText = `-${formatTimeLocal(Math.round(dropBkas))}`;

            if (baseAcapEl) baseAcapEl.innerText = formatTimeLocal(baseAcap);
            if (projAcapEl) projAcapEl.innerText = formatTimeLocal(Math.round(projAcapSecs));
            if (dropAcapEl) dropAcapEl.innerText = `-${formatTimeLocal(Math.round(dropAcap))}`;

            // Calculate 1-second threshold times based on current gap simulator values
            const projBkasRound = Math.round(projBkasSecs);
            const projAcapRound = Math.round(projAcapSecs);

            const anthonySlower = formatTimeLocal(projAcapRound + 1);
            const anthonyFaster = formatTimeLocal(projAcapRound - 1);

            const bryanSlower = formatTimeLocal(projBkasRound + 1);
            const bryanFaster = formatTimeLocal(projBkasRound - 1);

            const winBkasEl = document.getElementById('tt-kickoff-win-bkas');
            const winAcapEl = document.getElementById('tt-kickoff-win-acap');
            const explainBannerEl = document.getElementById('tt-kickoff-explanation-banner');

            if (winBkasEl) winBkasEl.innerHTML = `Anthony runs <span class="text-white font-black">${anthonySlower}+</span>`;
            if (winAcapEl) winAcapEl.innerHTML = `Bryan runs <span class="text-white font-black">${bryanSlower}+</span>`;

            if (explainBannerEl) {
                explainBannerEl.innerHTML = `Winner is decided by % Gap Closed! E.g. If Anthony runs <span class="text-violet-300 font-black">${formatTimeLocal(projAcapRound)}</span> (+${gapPercent.toFixed(1)}% gap) and Bryan runs <span class="text-emerald-300 font-black">${bryanSlower}</span> (+${Math.max(0, gapPercent - 0.1).toFixed(1)}% gap), <span class="text-amber-400 font-black">Anthony WINS</span> even though Bryan crossed the finish line first!`;
            }
        };

        window.currentTTMode = 'gap';
        window.switchTTChartMode = function (mode) {
            window.currentTTMode = mode;
            const btnGap = document.getElementById('tt-mode-gap');
            const btnTime = document.getElementById('tt-mode-time');
            if (btnGap && btnTime) {
                if (mode === 'gap') {
                    btnGap.className = "px-3 py-1 rounded-full bg-indigo-600 text-white shadow-md transition-all cursor-pointer font-bold";
                    btnTime.className = "px-3 py-1 rounded-full text-slate-400 hover:text-slate-200 transition-all cursor-pointer font-bold";
                } else {
                    btnTime.className = "px-3 py-1 rounded-full bg-indigo-600 text-white shadow-md transition-all cursor-pointer font-bold";
                    btnGap.className = "px-3 py-1 rounded-full text-slate-400 hover:text-slate-200 transition-all cursor-pointer font-bold";
                }
            }
            if (typeof loadTurkeyTrotData === 'function') {
                loadTurkeyTrotData();
            }
        };

        async function loadTurkeyTrotData() {
            try {
                // Fetch all submissions to easily find the first (baseline) entry
                const snap = await db.collection("turkeyTrotSubmissions").orderBy('timestamp', 'asc').get();
                const submissions = {};

                let baselineBkas = null;
                let baselineWeekBkas = null;
                let baselineAcap = null;
                let baselineWeekAcap = null;

                snap.forEach(doc => {
                    const data = doc.data();
                    // Map raw weekNumber (calendar week 29-46) into 1-18 Competition Weeks
                    let rawWeek = parseInt(data.weekNumber) || 1;
                    let week = rawWeek >= 29 ? Math.min(18, Math.max(1, rawWeek - 28)) : Math.min(18, Math.max(1, rawWeek));

                    // The first entry serves as the baseline seed
                    if (data.userId === 'bkas724' && !baselineBkas) {
                        baselineBkas = data.projectedPaceSeconds;
                        baselineWeekBkas = week;
                    }
                    if (data.userId === 'acap1600' && !baselineAcap) {
                        baselineAcap = data.projectedPaceSeconds;
                        baselineWeekAcap = week;
                    }

                    if (!submissions[week]) submissions[week] = {};
                    submissions[week][data.userId] = data;
                });

                // Inject Local Demo/Test Data if active or if no Firebase submissions exist yet
                if (window.isTTDemoMode || Object.keys(submissions).length === 0) {
                    baselineBkas = 1425; // 23:45
                    baselineWeekBkas = 1;
                    baselineAcap = 1470; // 24:30
                    baselineWeekAcap = 1;

                    submissions[1] = { 'bkas724': { projectedPaceSeconds: 1425, screenshotUrl: '#' }, 'acap1600': { projectedPaceSeconds: 1470, screenshotUrl: '#' } };
                    submissions[2] = { 'bkas724': { projectedPaceSeconds: 1395, screenshotUrl: '#' }, 'acap1600': { projectedPaceSeconds: 1440, screenshotUrl: '#' } };
                    submissions[3] = { 'bkas724': { projectedPaceSeconds: 1370, screenshotUrl: '#' }, 'acap1600': { projectedPaceSeconds: 1420, screenshotUrl: '#' } };
                    submissions[4] = { 'bkas724': { projectedPaceSeconds: 1350, screenshotUrl: '#' }, 'acap1600': { projectedPaceSeconds: 1395, screenshotUrl: '#' } };
                    submissions[5] = { 'bkas724': { projectedPaceSeconds: 1335, screenshotUrl: '#' }, 'acap1600': { projectedPaceSeconds: 1375, screenshotUrl: '#' } };
                }

                window.baselineBkas = baselineBkas || 1425;
                window.baselineAcap = baselineAcap || 1470;

                const sliderEl = document.getElementById('tt-gap-slider');
                if (sliderEl) updateKickoffGapSimulator(sliderEl.value);

                function formatTime(secs) {
                    if (!secs) return "Pending Seed";
                    const m = Math.floor(secs / 60);
                    const s = Math.floor(secs % 60);
                    return m + ':' + (s < 10 ? '0' : '') + s;
                }

                const elBaseBkas = document.getElementById('tt-base-bkas');
                if (elBaseBkas) elBaseBkas.innerText = formatTime(baselineBkas);
                const elBaseAcap = document.getElementById('tt-base-acap');
                if (elBaseAcap) elBaseAcap.innerText = formatTime(baselineAcap);

                // Change submit button text if they need to seed
                const currentUser = typeof userId !== 'undefined' ? userId : null;
                const submitBtn = document.getElementById('tt-submit-btn');
                const seedingMsg = document.getElementById('tt-seeding-msg');
                const titleEl = document.getElementById('tt-submission-title');

                const july25 = new Date('2026-07-25T00:00:00');
                const now = new Date();
                const isBeforeJuly25 = now < july25;

                if (submitBtn) {
                    if (isBeforeJuly25) {
                        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Baseline Opens July 25th';
                        submitBtn.disabled = true;
                        submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500', 'cursor-pointer');
                        submitBtn.classList.add('bg-slate-700', 'text-slate-400', 'cursor-not-allowed');
                        if (titleEl) titleEl.innerText = "Submissions Locked";
                        if (seedingMsg) seedingMsg.classList.add('hidden');
                    } else {
                        // Ensure it is not locked visually if they refresh on or after July 25
                        submitBtn.disabled = false;
                        submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500', 'cursor-pointer');
                        submitBtn.classList.remove('bg-slate-700', 'text-slate-400', 'cursor-not-allowed');

                        if (currentUser && ((currentUser === 'bkas724' && !baselineBkas) || (currentUser === 'acap1600' && !baselineAcap))) {
                            submitBtn.innerHTML = '<i class="fa-solid fa-seedling"></i> Lock in Baseline Submission';
                            if (titleEl) titleEl.innerText = "Baseline Submission";
                            if (seedingMsg) seedingMsg.classList.remove('hidden');
                        } else {
                            submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lock in Weekly Time';
                            if (titleEl) titleEl.innerText = "Weekly Submission";
                            if (seedingMsg) seedingMsg.classList.add('hidden');
                        }
                    }
                }

                // Update Countdown
                const todayForCountdown = new Date();
                todayForCountdown.setHours(0, 0, 0, 0);
                const raceDay = new Date('2026-11-26T00:00:00'); // Thanksgiving 2026
                const diffDays = Math.ceil((raceDay - todayForCountdown) / (1000 * 60 * 60 * 24));

                const countdownEl = document.getElementById('tt-countdown-banner');
                const textEl = document.getElementById('tt-countdown-text');
                if (countdownEl && textEl) {
                    countdownEl.classList.remove('hidden');
                    if (diffDays > 0) {
                        textEl.innerHTML = `<span class="text-white font-black">${diffDays} Days</span><br>Left!`;
                    } else if (diffDays === 0) {
                        textEl.innerHTML = `<span class="text-white font-black">It's Race Day!</span> Give it your all!`;
                    } else {
                        textEl.innerHTML = `<span class="text-white font-black">Race Completed!</span>`;
                    }
                }

                // Find the latest week where BOTH have submitted, or current week
                let latestWeek = 1;
                let maxWeekFound = 1;
                Object.keys(submissions).forEach(w => { if (parseInt(w) > maxWeekFound) maxWeekFound = parseInt(w); });

                let bkasData = null;
                let acapData = null;

                for (let w = maxWeekFound; w >= 1; w--) {
                    if (submissions[w]) {
                        if (submissions[w]['bkas724'] && submissions[w]['acap1600']) {
                            latestWeek = w;
                            bkasData = submissions[w]['bkas724'];
                            acapData = submissions[w]['acap1600'];
                            break;
                        } else if (submissions[w]['bkas724'] || submissions[w]['acap1600']) {
                            latestWeek = w;
                        }
                    }
                }

                const currentWeekSubmissions = submissions[latestWeek] || {};
                const bkasHasSubmitted = !!currentWeekSubmissions['bkas724'];
                const acapHasSubmitted = !!currentWeekSubmissions['acap1600'];

                function calculateEstimatedFinalPace(base, current, currentWk, seedWk) {
                    if (!base || !current) return "--:--";
                    const wksPassed = currentWk - seedWk;
                    if (wksPassed <= 0) return formatTime(current);
                    const rate = (base - current) / wksPassed;
                    const wksRemaining = 18 - wksPassed; // Roughly 18 weeks from July 25 to Nov 26
                    let proj = current - (rate * wksRemaining);
                    if (proj < 755) proj = 755;
                    return formatTime(proj);
                }

                let bkasScore = 0;
                let acapScore = 0;

                const weekStatusEl = document.getElementById('tt-week-status');
                const projBkasEl = document.getElementById('tt-proj-bkas');
                const projAcapEl = document.getElementById('tt-proj-acap');
                const proofViewEl = document.getElementById('tt-proof-view');

                if (bkasHasSubmitted && acapHasSubmitted) {
                    if (weekStatusEl) weekStatusEl.innerText = `Week ${latestWeek} Results Live!`;

                    bkasScore = calculateLogScore(baselineBkas, currentWeekSubmissions['bkas724'].projectedPaceSeconds);
                    acapScore = calculateLogScore(baselineAcap, currentWeekSubmissions['acap1600'].projectedPaceSeconds);

                    if (projBkasEl) projBkasEl.innerText = calculateEstimatedFinalPace(baselineBkas, currentWeekSubmissions['bkas724'].projectedPaceSeconds, latestWeek, baselineWeekBkas);
                    if (projAcapEl) projAcapEl.innerText = calculateEstimatedFinalPace(baselineAcap, currentWeekSubmissions['acap1600'].projectedPaceSeconds, latestWeek, baselineWeekAcap);

                    if (proofViewEl) proofViewEl.classList.remove('hidden');
                    const btnBkas = document.getElementById('tt-proof-bkas');
                    const btnAcap = document.getElementById('tt-proof-acap');

                    if (btnBkas) {
                        btnBkas.classList.remove('hidden');
                        btnBkas.onclick = () => window.open(currentWeekSubmissions['bkas724'].screenshotUrl, '_blank');
                    }
                    if (btnAcap) {
                        btnAcap.classList.remove('hidden');
                        btnAcap.onclick = () => window.open(currentWeekSubmissions['acap1600'].screenshotUrl, '_blank');
                    }

                } else {
                    if (weekStatusEl) weekStatusEl.innerText = `Week ${latestWeek}: Waiting for ${(!bkasHasSubmitted ? 'Bryan' : '')} ${(!bkasHasSubmitted && !acapHasSubmitted ? '&' : '')} ${(!acapHasSubmitted ? 'Anthony' : '')}`;
                    if (projBkasEl) projBkasEl.innerText = '--:--';
                    if (projAcapEl) projAcapEl.innerText = '--:--';
                    if (proofViewEl) proofViewEl.classList.add('hidden');

                    if (latestWeek > 1 && submissions[latestWeek - 1] && submissions[latestWeek - 1]['bkas724'] && submissions[latestWeek - 1]['acap1600']) {
                        bkasScore = calculateLogScore(baselineBkas, submissions[latestWeek - 1]['bkas724'].projectedPaceSeconds);
                        acapScore = calculateLogScore(baselineAcap, submissions[latestWeek - 1]['acap1600'].projectedPaceSeconds);

                        if (projBkasEl) projBkasEl.innerText = calculateEstimatedFinalPace(baselineBkas, submissions[latestWeek - 1]['bkas724'].projectedPaceSeconds, latestWeek - 1, baselineWeekBkas);
                        if (projAcapEl) projAcapEl.innerText = calculateEstimatedFinalPace(baselineAcap, submissions[latestWeek - 1]['acap1600'].projectedPaceSeconds, latestWeek - 1, baselineWeekAcap);
                    }
                }

                // --- 18-WEEK TRAJECTORY LINE CHART & FOG OF WAR LOGIC ---
                const activeUser = typeof userId !== 'undefined' && userId ? userId : null;
                const isBryan = (activeUser === 'bkas724');
                const isAnthony = (activeUser === 'acap1600');
                const isSpectator = (!isBryan && !isAnthony);

                const badgeEl = document.getElementById('tt-view-mode-badge');
                if (badgeEl) {
                    if (isBryan || isAnthony) {
                        badgeEl.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/40 bg-indigo-950/90 text-indigo-300 hover:bg-indigo-900 transition-all shadow-md text-[10px] font-extrabold tracking-wide cursor-pointer group pointer-events-auto";
                        badgeEl.innerHTML = `<i class="fa-solid fa-user-shield text-indigo-400"></i><span>Fog mode</span><i class="fa-solid fa-circle-info text-indigo-400/80 group-hover:text-indigo-200 ml-0.5"></i>`;
                        badgeEl.onclick = () => window.openFogOfWarModal && window.openFogOfWarModal(true);
                    } else {
                        badgeEl.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900 transition-all shadow-md text-[10px] font-extrabold tracking-wide cursor-pointer group pointer-events-auto";
                        badgeEl.innerHTML = `<i class="fa-solid fa-eye text-emerald-400"></i><span>Spectator View</span><i class="fa-solid fa-circle-info text-emerald-400/80 group-hover:text-emerald-200 ml-0.5"></i>`;
                        badgeEl.onclick = () => window.openFogOfWarModal && window.openFogOfWarModal(false);
                    }
                }

                // Construct 18-Week Datasets for Bryan & Anthony (with Starting Baseline Seeds)
                const startBkasSecs = baselineBkas || 1440; // 24:00 default seed
                const startAcapSecs = baselineAcap || 1440; // 24:00 default seed

                const weekLabels = [];
                const bkasScores = [];
                const acapScores = [];
                const bkasTimes = [];
                const acapTimes = [];

                let bkasLastSecs = startBkasSecs;
                let acapLastSecs = startAcapSecs;
                let bkasLastScore = 0;
                let acapLastScore = 0;

                let bkasLatestPointIndex = 0;
                let acapLatestPointIndex = 0;

                for (let w = 1; w <= 18; w++) {
                    weekLabels.push(`Wk ${w}`);

                    // Bryan's data calculation
                    if (submissions[w] && submissions[w]['bkas724']) {
                        bkasLastSecs = submissions[w]['bkas724'].projectedPaceSeconds;
                        bkasLastScore = parseFloat(calculateLogScore(startBkasSecs, bkasLastSecs));
                        bkasLatestPointIndex = w - 1;
                    } else if (w > 1) {
                        // Auto-trajectory projection (+2.0% score per week / ~10s reduction)
                        bkasLastSecs = Math.max(755, bkasLastSecs - 10);
                        bkasLastScore = Math.min(100, bkasLastScore + 2.0);
                    } else {
                        bkasLastSecs = startBkasSecs;
                        bkasLastScore = 0;
                    }
                    bkasTimes.push(bkasLastSecs);
                    bkasScores.push(parseFloat(bkasLastScore.toFixed(1)));

                    // Anthony's data calculation
                    if (submissions[w] && submissions[w]['acap1600']) {
                        acapLastSecs = submissions[w]['acap1600'].projectedPaceSeconds;
                        acapLastScore = parseFloat(calculateLogScore(startAcapSecs, acapLastSecs));
                        acapLatestPointIndex = w - 1;
                    } else if (w > 1) {
                        // Auto-trajectory projection (+2.0% score per week / ~10s reduction)
                        acapLastSecs = Math.max(755, acapLastSecs - 10);
                        acapLastScore = Math.min(100, acapLastScore + 2.0);
                    } else {
                        acapLastSecs = startAcapSecs;
                        acapLastScore = 0;
                    }
                    acapTimes.push(acapLastSecs);
                    acapScores.push(parseFloat(acapLastScore.toFixed(1)));
                }

                // Apply Fog of War datasets if active competitor
                let bkasDisplayScores = [...bkasScores];
                let acapDisplayScores = [...acapScores];
                let bkasDisplayTimes = [...bkasTimes];
                let acapDisplayTimes = [...acapTimes];

                let isBkasDashed = false;
                let isAcapDashed = false;

                if (isBryan && baselineAcap > 0) {
                    isAcapDashed = true;
                    // Obscure Anthony's actual data with estimated trajectory
                    for (let w = baselineWeekAcap; w < 18; w++) {
                        const wksPassed = w - baselineWeekAcap + 1;
                        acapDisplayScores[w] = parseFloat((wksPassed * 2.0).toFixed(1));
                        acapDisplayTimes[w] = Math.max(755, baselineAcap - (wksPassed * 12));
                    }
                    const btnAcap = document.getElementById('tt-proof-acap');
                    if (btnAcap) {
                        btnAcap.innerText = "🔒 Opponent Proof Obscured";
                        btnAcap.onclick = (e) => { e.preventDefault(); alert("Fog of War Active: Opponent screenshot proofs and actual weekly times are hidden from active competitors to prevent pacing! Visitors and spectators can view all live unfiltered data."); };
                        btnAcap.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                } else if (isAnthony && baselineBkas > 0) {
                    isBkasDashed = true;
                    // Obscure Bryan's actual data with estimated trajectory
                    for (let w = baselineWeekBkas; w < 18; w++) {
                        const wksPassed = w - baselineWeekBkas + 1;
                        bkasDisplayScores[w] = parseFloat((wksPassed * 2.0).toFixed(1));
                        bkasDisplayTimes[w] = Math.max(755, baselineBkas - (wksPassed * 12));
                    }
                    const btnBkas = document.getElementById('tt-proof-bkas');
                    if (btnBkas) {
                        btnBkas.innerText = "🔒 Opponent Proof Obscured";
                        btnBkas.onclick = (e) => { e.preventDefault(); alert("Fog of War Active: Opponent screenshot proofs and actual weekly times are hidden from active competitors to prevent pacing! Visitors and spectators can view all live unfiltered data."); };
                        btnBkas.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                }

                // Render / Update Chart.js Line Chart
                const canvas = document.getElementById('ttTrajectoryChart');
                if (canvas && typeof Chart !== 'undefined') {
                    const ctx = canvas.getContext('2d');
                    const mode = window.currentTTMode || 'gap';
                    const rangeMode = window.currentTTRange || 'full';

                    let fullBkasData = (mode === 'gap') ? bkasDisplayScores : bkasDisplayTimes;
                    let fullAcapData = (mode === 'gap') ? acapDisplayScores : acapDisplayTimes;

                    let chartLabels = weekLabels;
                    let chartBkasData = fullBkasData;
                    let chartAcapData = fullAcapData;

                    if (rangeMode === 'focus') {
                        const startWk = Math.max(1, latestWeek - 2);
                        const endWk = Math.min(18, startWk + 4);
                        const startIdx = startWk - 1;
                        const endIdx = endWk;

                        chartLabels = weekLabels.slice(startIdx, endIdx);
                        chartBkasData = fullBkasData.slice(startIdx, endIdx);
                        chartAcapData = fullAcapData.slice(startIdx, endIdx);
                    }

                    // Calculate Dynamic Y-Axis Scale Bounds for Perfect Fitting & Headroom
                    let yMin = undefined;
                    let yMax = undefined;

                    if (mode === 'gap') {
                        yMin = 0; // Baseline grounded at 0%
                        const maxScoreVal = Math.max(...chartBkasData, ...chartAcapData, 0);
                        // Add extra negative space headroom above highest score so labels & avatars never clip
                        yMax = Math.max(20, Math.ceil((maxScoreVal + 10) / 5) * 5);
                    } else {
                        const allTimes = [...chartBkasData, ...chartAcapData].filter(v => typeof v === 'number' && v > 0);
                        if (allTimes.length > 0) {
                            const fastestSecs = Math.min(...allTimes);
                            const slowestSecs = Math.max(...allTimes);
                            // 45-second margin around time spectrum for negative space
                            yMin = Math.max(755, Math.floor((fastestSecs - 45) / 15) * 15);
                            yMax = Math.ceil((slowestSecs + 45) / 15) * 15;
                        }
                    }

                    if (window.ttChartInstance) {
                        window.ttChartInstance.destroy();
                    }

                    window.ttChartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: chartLabels,
                            datasets: [
                                {
                                    label: 'Bryan (bkas724)',
                                    data: chartBkasData,
                                    borderColor: '#10b981', // Emerald
                                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                    borderWidth: 3,
                                    borderDash: isBkasDashed ? [6, 6] : [],
                                    pointRadius: 4,
                                    pointHoverRadius: 7,
                                    pointBackgroundColor: '#10b981',
                                    tension: 0.35,
                                    fill: true
                                },
                                {
                                    label: 'Anthony (acap1600)',
                                    data: chartAcapData,
                                    borderColor: '#8b5cf6', // Violet
                                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                    borderWidth: 3,
                                    borderDash: isAcapDashed ? [6, 6] : [],
                                    pointRadius: 4,
                                    pointHoverRadius: 7,
                                    pointBackgroundColor: '#8b5cf6',
                                    tension: 0.35,
                                    fill: true
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: { duration: 0 },
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    borderWidth: 1,
                                    titleFont: { size: 11, weight: 'bold' },
                                    bodyFont: { size: 11 },
                                    padding: 8,
                                    callbacks: {
                                        label: function (context) {
                                            const val = context.raw;
                                            return mode === 'gap' ? `${context.dataset.label}: +${val}%` : `${context.dataset.label}: ${formatTime(val)}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                                    ticks: { color: '#64748b', font: { size: 9, weight: 'bold' } }
                                },
                                y: {
                                    min: yMin,
                                    max: yMax,
                                    reverse: (mode === 'time'),
                                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                                    ticks: {
                                        color: '#64748b',
                                        font: { size: 9, weight: 'bold' },
                                        callback: function (val) {
                                            return mode === 'gap' ? val + '%' : formatTime(val);
                                        }
                                    }
                                }
                            }
                        }
                    });

                    window.ttChartInstance.update();
                }

                // Position Dynamic Overlay Badges on Chart Point Coordinates
                const updateAvatars = () => {
                    if (!window.ttChartInstance || !window.ttChartInstance.scales) return;

                    const canvas = document.getElementById('ttTrajectoryChart');
                    const cLeft = canvas ? canvas.offsetLeft : 0;
                    const cTop = canvas ? canvas.offsetTop : 0;

                    const rangeMode = window.currentTTRange || 'full';
                    let targetIndex = latestWeek - 1;
                    if (rangeMode === 'focus') {
                        const startWk = Math.max(1, latestWeek - 2);
                        targetIndex = latestWeek - startWk;
                    }

                    const metaBkas = window.ttChartInstance.getDatasetMeta(0);
                    const metaAcap = window.ttChartInstance.getDatasetMeta(1);

                    const bkasAvatarEl = document.getElementById('tt-avatar-bkas');
                    const acapAvatarEl = document.getElementById('tt-avatar-acap');

                    if (diff === 0) {
                        if (bkasAvatarEl) {
                            bkasAvatarEl.innerHTML = `
                                <div class="flex items-center gap-1.5 bg-slate-950/90 border border-amber-500/50 p-1.5 rounded-full shadow-2xl backdrop-blur">
                                    <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-emerald-400 overflow-hidden shadow bg-emerald-950">
                                        <img src="Images/bryanheadshot.png" class="w-full h-full object-cover" title="Bryan">
                                    </div>
                                    <span class="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                                        Tied
                                    </span>
                                    <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-violet-400 overflow-hidden shadow bg-violet-950">
                                        <img src="Images/anthonyheadshot.png" class="w-full h-full object-cover" title="Anthony">
                                    </div>
                                </div>
                            `;
                            const pt = (metaBkas && metaBkas.data && metaBkas.data[targetIndex]) ? metaBkas.data[targetIndex] : null;
                            if (pt) {
                                bkasAvatarEl.style.left = (cLeft + pt.x) + 'px';
                                bkasAvatarEl.style.top = (cTop + pt.y) + 'px';
                                bkasAvatarEl.classList.remove('hidden');
                            }
                        }
                        if (acapAvatarEl) {
                            acapAvatarEl.classList.add('hidden');
                        }
                    } else {
                        const isBryanWinning = (diff > 0);

                        if (bkasAvatarEl) {
                            if (isBryanWinning) {
                                // Bryan Winning: WINNING pill centered on point, Headshot to the LEFT
                                bkasAvatarEl.innerHTML = `
                                    <div class="flex items-center pointer-events-none relative">
                                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-emerald-400 overflow-hidden shadow-xl bg-emerald-950 absolute right-full mr-1.5 top-1/2 -translate-y-1/2" title="Bryan">
                                            <img src="Images/bryanheadshot.png" class="w-full h-full object-cover">
                                        </div>
                                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] shadow-lg uppercase tracking-wider whitespace-nowrap">
                                            Winning
                                        </span>
                                    </div>
                                `;
                            } else {
                                // Bryan Losing: LOSING pill centered on point, Headshot to the RIGHT
                                bkasAvatarEl.innerHTML = `
                                    <div class="flex items-center pointer-events-none relative">
                                        <span class="px-2.5 py-0.5 rounded-full bg-violet-600/90 text-white font-black text-[9px] shadow-lg uppercase tracking-wider whitespace-nowrap">
                                            Losing
                                        </span>
                                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-violet-400 overflow-hidden shadow-xl bg-violet-950 absolute left-full ml-1.5 top-1/2 -translate-y-1/2" title="Bryan">
                                            <img src="Images/bryanheadshot.png" class="w-full h-full object-cover">
                                        </div>
                                    </div>
                                `;
                            }
                            const ptBkas = (metaBkas && metaBkas.data && metaBkas.data[targetIndex]) ? metaBkas.data[targetIndex] : null;
                            if (ptBkas) {
                                bkasAvatarEl.style.left = (cLeft + ptBkas.x) + 'px';
                                bkasAvatarEl.style.top = (cTop + ptBkas.y) + 'px';
                                bkasAvatarEl.classList.remove('hidden');
                            }
                        }

                        if (acapAvatarEl) {
                            if (!isBryanWinning) {
                                // Anthony Winning: WINNING pill centered on point, Headshot to the LEFT
                                acapAvatarEl.innerHTML = `
                                    <div class="flex items-center pointer-events-none relative">
                                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-emerald-400 overflow-hidden shadow-xl bg-emerald-950 absolute right-full mr-1.5 top-1/2 -translate-y-1/2" title="Anthony">
                                            <img src="Images/anthonyheadshot.png" class="w-full h-full object-cover">
                                        </div>
                                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] shadow-lg uppercase tracking-wider whitespace-nowrap">
                                            Winning
                                        </span>
                                    </div>
                                `;
                            } else {
                                // Anthony Losing: LOSING pill centered on point, Headshot to the RIGHT
                                acapAvatarEl.innerHTML = `
                                    <div class="flex items-center pointer-events-none relative">
                                        <span class="px-2.5 py-0.5 rounded-full bg-violet-600/90 text-white font-black text-[9px] shadow-lg uppercase tracking-wider whitespace-nowrap">
                                            Losing
                                        </span>
                                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-violet-400 overflow-hidden shadow-xl bg-violet-950 absolute left-full ml-1.5 top-1/2 -translate-y-1/2" title="Anthony">
                                            <img src="Images/anthonyheadshot.png" class="w-full h-full object-cover">
                                        </div>
                                    </div>
                                `;
                            }
                            const ptAcap = (metaAcap && metaAcap.data && metaAcap.data[targetIndex]) ? metaAcap.data[targetIndex] : null;
                            if (ptAcap) {
                                acapAvatarEl.style.left = (cLeft + ptAcap.x) + 'px';
                                acapAvatarEl.style.top = (cTop + ptAcap.y) + 'px';
                                acapAvatarEl.classList.remove('hidden');
                            }
                        }
                    }
                };

                requestAnimationFrame(updateAvatars);
                setTimeout(updateAvatars, 100);

                // Update Competition Week Bubble Badge
                const weekNumEl = document.getElementById('tt-week-num-display');
                if (weekNumEl) weekNumEl.innerText = `Week ${latestWeek}`;

                // Update Kickoff Box & Right Sidebar Docking State (Defaults to Kickoff Card until Week 4)
                checkDevMode();
                let targetView = (latestWeek < 4) ? 'kickoff' : 'chart';
                if (window.hasUserToggledView && window.currentTTView) {
                    targetView = window.currentTTView;
                }
                switchTTView(targetView);

                if (latestWeek >= 4) {
                    const isBryanWinning = (diff >= 0);
                    const winImg = isBryanWinning ? 'Images/bryanheadshot.png' : 'Images/anthonyheadshot.png';
                    const winName = isBryanWinning ? 'Bryan' : 'Anthony';
                    const winBase = isBryanWinning ? formatTime(baselineBkas) : formatTime(baselineAcap);
                    const winProj = isBryanWinning ? formatTime(bkasTimes[bkasTimes.length - 1]) : formatTime(acapTimes[acapTimes.length - 1]);

                    const loseImg = !isBryanWinning ? 'Images/bryanheadshot.png' : 'Images/anthonyheadshot.png';
                    const loseName = !isBryanWinning ? 'Bryan' : 'Anthony';
                    const loseBase = !isBryanWinning ? formatTime(baselineBkas) : formatTime(baselineAcap);
                    const loseProj = !isBryanWinning ? formatTime(bkasTimes[bkasTimes.length - 1]) : formatTime(acapTimes[acapTimes.length - 1]);

                    const sideWinImg = document.getElementById('tt-side-winner-img');
                    const sideWinName = document.getElementById('tt-side-winner-name');
                    const sideWinBase = document.getElementById('tt-side-winner-base');
                    const sideWinProj = document.getElementById('tt-side-winner-proj');

                    const sideLoseImg = document.getElementById('tt-side-loser-img');
                    const sideLoseName = document.getElementById('tt-side-loser-name');
                    const sideLoseBase = document.getElementById('tt-side-loser-base');
                    const sideLoseProj = document.getElementById('tt-side-loser-proj');

                    if (sideWinImg) sideWinImg.src = winImg;
                    if (sideWinName) sideWinName.innerText = winName;
                    if (sideWinBase) sideWinBase.innerText = winBase;
                    if (sideWinProj) sideWinProj.innerText = winProj;

                    if (sideLoseImg) sideLoseImg.src = loseImg;
                    if (sideLoseName) sideLoseName.innerText = loseName;
                    if (sideLoseBase) sideLoseBase.innerText = loseBase;
                    if (sideLoseProj) sideLoseProj.innerText = loseProj;
                }

                // Update Leader Advantage Badge in Header
                const diffEl = document.getElementById('tt-leader-diff');
                const estSuffix = (isBryan || isAnthony) ? " (vs Est.)" : "";
                if (diffEl) {
                    if (diff > 0) {
                        diffEl.innerHTML = `<span class="text-emerald-400">Bryan +${diff.toFixed(1)}%${estSuffix}</span>`;
                    } else if (diff < 0) {
                        diffEl.innerHTML = `<span class="text-violet-400">Anthony +${Math.abs(diff).toFixed(1)}%${estSuffix}</span>`;
                    } else {
                        diffEl.innerText = "Tied" + (estSuffix ? " vs Est." : "");
                    }
                }

            } catch (e) {
                console.error("Error loading Turkey Trot data:", e);
                const statusEl = document.getElementById('tt-week-status');
                if (statusEl) statusEl.innerText = "Error: " + e.message;
            }
        }

        function calculateLogScore(baselineSecs, currentSecs) {
            if (!baselineSecs || !currentSecs) return 0;
            if (currentSecs >= baselineSecs) return 0;
            const wr = 755; // 12:35
            const num = Math.log10(baselineSecs) - Math.log10(currentSecs);
            const den = Math.log10(baselineSecs) - Math.log10(wr);
            let score = (num / den) * 100;
            if (score < 0) score = 0;
            if (score > 100) score = 100;
            return score.toFixed(1);
        }

        function animateVerticalScore(textId, barId, targetScore, targetHeight) {
            document.getElementById(textId).innerText = targetScore + '%';
            setTimeout(() => {
                document.getElementById(barId).style.height = targetHeight + '%';
            }, 100);
        }

        async function submitTurkeyTrotProgress() {
            if (isTurkeyTrotGuest) return; // Guests can't submit

            // Require active user
            if (!userId || (userId !== 'bkas724' && userId !== 'acap1600')) {
                alert("Only bkas724 and acap1600 can submit times.");
                return;
            }

            const dateInput = document.getElementById('tt-input-date').value;
            const distInput = parseFloat(document.getElementById('tt-input-dist').value);
            const timeInput = document.getElementById('tt-input-time').value.trim();
            const hrInput = parseInt(document.getElementById('tt-input-hr').value);
            const proofFile = document.getElementById('tt-input-proof').files[0];
            const statusText = document.getElementById('tt-upload-status');

            if (!dateInput || !distInput || !timeInput || !hrInput || !proofFile) {
                alert("Please fill out all fields and attach a screenshot proof.");
                return;
            }

            // Parse MM:SS
            const parts = timeInput.split(':');
            if (parts.length !== 2) {
                alert("Please enter time in MM:SS format.");
                return;
            }
            const mins = parseInt(parts[0]);
            const secs = parseInt(parts[1]);
            const totalSeconds = (mins * 60) + secs;

            // Calculate Projected 5K Baseline (Resting HR = 60, Max HR = 185, Target Race HR = 172, Divisor = 112)
            const paceSecPerMile = totalSeconds / distInput;
            const projectedPaceSecPerMile = paceSecPerMile * ((hrInput - 60) / 112);
            const projected5kSecs = projectedPaceSecPerMile * 3.10686;

            statusText.innerText = "Uploading proof...";
            statusText.classList.remove('hidden');
            document.getElementById('tt-submit-btn').disabled = true;

            try {
                // Upload to Firebase Storage
                const ext = proofFile.name.split('.').pop();
                const path = `challenge_proofs/${Date.now()}_${userId}.${ext}`;
                const storageRef = firebase.storage().ref().child(path);

                await storageRef.put(proofFile);
                const downloadUrl = await storageRef.getDownloadURL();

                statusText.innerText = "Saving submission...";

                // Save to Firestore using Week of Year
                // If it is the first entry for this user, it acts as the baseline (seeding run).
                const d = new Date();
                const start = new Date(d.getFullYear(), 0, 0);
                const diff = d - start;
                const oneWeek = 1000 * 60 * 60 * 24 * 7;
                let calWeekNum = Math.floor(diff / oneWeek);
                // Map calendar week (Week 29+) to 18-week competition timeline (Week 1 to 18)
                let currentWeekNum = calWeekNum >= 29 ? Math.min(18, Math.max(1, calWeekNum - 28)) : Math.min(18, Math.max(1, calWeekNum));

                // Ensure they don't overwrite a previous submission in the exact same week accidentally,
                // or just append it and our logic fetches the earliest/latest appropriately.
                // The `orderBy('timestamp', 'asc')` in `loadTurkeyTrotData` guarantees the absolute first
                // submission across time acts as the baseline.

                await db.collection("turkeyTrotSubmissions").add({
                    weekNumber: currentWeekNum,
                    userId: userId,
                    workoutDate: dateInput,
                    rawDistance: distInput,
                    rawTime: timeInput,
                    rawHr: hrInput,
                    projectedPaceSeconds: projected5kSecs,
                    screenshotUrl: downloadUrl,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                statusText.innerText = "Submission successful!";
                statusText.classList.add('text-emerald-400');
                statusText.classList.remove('text-slate-400');

                // Reset inputs
                document.getElementById('tt-input-date').value = '';
                document.getElementById('tt-input-dist').value = '';
                document.getElementById('tt-input-time').value = '';
                document.getElementById('tt-input-hr').value = '';
                document.getElementById('tt-input-proof').value = '';

                // Reload data
                loadTurkeyTrotData();

            } catch (e) {
                console.error("Error submitting progress:", e);
                statusText.innerText = "Upload failed. Try again.";
                statusText.classList.add('text-rose-450');
            } finally {
                document.getElementById('tt-submit-btn').disabled = false;
            }
        }

        // Hook into existing switchTab to load data when tab is opened
        const originalSwitchTab = switchTab;
        switchTab = function (tabId) {
            originalSwitchTab(tabId);
            if (tabId === 'turkey-trot') {
                loadTurkeyTrotData();
                // Ensure userId exists before checking
                const currentUser = typeof userId !== 'undefined' ? userId : null;
                if (currentUser !== 'bkas724' && currentUser !== 'acap1600') {
                    document.getElementById('tt-submit-area').classList.add('hidden');
                } else {
                    document.getElementById('tt-submit-area').classList.remove('hidden');
                }
            }
        };
