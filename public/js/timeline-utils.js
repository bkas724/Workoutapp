function getCheckpointLabel(index) {
            const labels = ["Start", "P1 Mid", "P1 End", "P2 Mid", "P2 End", "P3 Mid 1", "P3 Mid 2", "Goal"];
            if (index >= 0 && index < labels.length) {
                return labels[index];
            }
            return "Checkpoint";
        }

function generateTimelineDates(startDateStr, endDateStr) {
            const start = startDateStr ? new Date(startDateStr) : new Date();
            let end;
            if (endDateStr) {
                end = new Date(endDateStr);
            } else {
                end = new Date(start.getTime() + 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks later fallback
            }

            const totalMs = end.getTime() - start.getTime();
            const intervalMs = totalMs / 7;

            const dates = [];
            for (let i = 0; i <= 7; i++) {
                const currentMs = start.getTime() + (i * intervalMs);
                const currentDate = new Date(currentMs);

                const opt = { month: 'short', day: 'numeric' };
                dates.push(currentDate.toLocaleDateString('en-US', opt));
            }
            return dates;
        }

async function getOrFetchHistoryWorkouts(userId) {
            if (!userId || typeof db === 'undefined' || !db) return [];
            if (historyFetchedForUser === userId && cachedHistoryWorkouts.length > 0) {
                return cachedHistoryWorkouts;
            }
            try {
                const snap = await db.collection("users").doc(userId).collection("history").get();
                cachedHistoryWorkouts = [];
                snap.forEach(doc => cachedHistoryWorkouts.push(doc.data()));
                historyFetchedForUser = userId;
            } catch (e) {
                console.warn("Could not fetch history subcollection:", e);
            }
            return cachedHistoryWorkouts;
        }

function generateWeeklyTimeline(startDateStr, endDateStr, defaultWeeks = 12) {
            const start = startDateStr ? new Date(startDateStr) : new Date();
            let numWeeks = defaultWeeks;
            if (endDateStr && startDateStr) {
                const diffMs = new Date(endDateStr).getTime() - new Date(startDateStr).getTime();
                const calcWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
                if (calcWeeks > 0) numWeeks = calcWeeks;
            }
            numWeeks = Math.max(4, Math.min(16, numWeeks)); // Clamp between 4 and 16 weeks

            const labels = [];
            const windows = [];

            for (let w = 0; w < numWeeks; w++) {
                const weekStart = new Date(start.getTime() + (w * 7 * 24 * 60 * 60 * 1000));
                const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));

                const opt = { month: 'short', day: 'numeric' };
                const dateStr = weekStart.toLocaleDateString('en-US', opt);

                labels.push(`Wk ${w + 1}`);
                windows.push({ start: weekStart.getTime(), end: weekEnd.getTime(), dateStr, weekNum: w + 1 });
            }

            return { labels, windows, numWeeks, startMs: start.getTime() };
        }

function openDetailedPlanModal() {
            const modal = document.getElementById('detailed-plan-modal');
            if (!modal) return;
            renderDetailedPlanStages();
            modal.classList.remove('hidden');
        }

function renderDetailedPlanStages() {
            const container = document.getElementById('detailed-plan-stages');
            const toggle = document.getElementById('detailed-plan-toggle');
            if (!container) return;

            const isDetailed = toggle ? toggle.checked : true;
            container.innerHTML = '';

            let plan = [];
            if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
                plan = userProfileData.macrocyclePlan;
            } else {
                plan = [
                    { theme: "Speed Induction", simpleDescription: "Neuromuscular speed coordination.", detailedDescription: "Neuromuscular speed coordination. Alternating explosive 400m intervals with targeted glute/heel stability." },
                    { theme: "Speed Endurance", simpleDescription: "Aerobic threshold development.", detailedDescription: "Aerobic threshold development. Extending speed efforts to 1000m blocks and posterior hamstring deadlifts." },
                    { theme: "Peak & Taper", simpleDescription: "Maximum capacity and recovery.", detailedDescription: "Maximum capacity and recovery. Testing 1-mile repetitions before backing off volume for supercompensation." }
                ];
            }

            let currentAccumulatedDate = userProfileData && userProfileData.journeyStartDate ? new Date(userProfileData.journeyStartDate) : new Date();

            plan.forEach((stage, idx) => {
                let dateBadge = '';
                if (stage.expectedDurationWeeks) {
                    currentAccumulatedDate.setDate(currentAccumulatedDate.getDate() + (stage.expectedDurationWeeks * 7));
                    const options = { month: 'short', day: 'numeric' };
                    dateBadge = `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-md whitespace-nowrap">Target: ${currentAccumulatedDate.toLocaleDateString(undefined, options)}</span>`;
                }

                const descToShow = isDetailed
                    ? (stage.detailedDescription || stage.description || 'No detailed description available.')
                    : (stage.simpleDescription || stage.description || 'No description available.');

                container.innerHTML += `
                    <div class="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-left">
                        <div class="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            ${idx + 1}
                        </div>
                        <div class="w-full">
                            <div class="flex items-center justify-between gap-2">
                                <h4 class="text-sm font-bold text-slate-200">${stage.theme || 'Phase ' + (idx + 1)}</h4>
                                ${dateBadge}
                            </div>
                            <p class="text-xs text-slate-500 leading-relaxed mt-1">${descToShow}</p>
                        </div>
                    </div>
                `;
            });
        }

function closeDetailedPlanModal() {
            const modal = document.getElementById('detailed-plan-modal');
            if (modal) modal.classList.add('hidden');

            // Force redraw of the timeline to prevent browser rendering bugs or missing states
            if (typeof userProfileData !== 'undefined' && userProfileData) {
                updateTimelineView(userProfileData.currentPhaseIndex || 1);
            } else {
                updateTimelineView(1);
            }
        }

function initCalendar() {
            const dateInput = document.getElementById('intake-date');
            const dropdown = document.getElementById('calendar-dropdown');
            const prevBtn = document.getElementById('cal-prev');
            const nextBtn = document.getElementById('cal-next');

            if (!dateInput || !dropdown) return;

            // Open/close toggle
            dateInput.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                if (!dropdown.classList.contains('hidden')) {
                    // Reset grid to current selected or today
                    if (dateInput.value) {
                        const parsed = new Date(dateInput.value + 'T00:00:00');
                        if (!isNaN(parsed.getTime())) {
                            calCurrentDate = parsed;
                            calSelectedDate = parsed;
                        }
                    } else {
                        calCurrentDate = new Date();
                    }
                    renderCalendarGrid();
                }
            });

            // Prev month button
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
                renderCalendarGrid();
            });

            // Next month button
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
                renderCalendarGrid();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.classList.contains('hidden')) {
                    const wrapper = document.getElementById('intake-date-wrapper');
                    if (wrapper && !wrapper.contains(e.target)) {
                        dropdown.classList.add('hidden');
                    }
                }
            });
        }

function renderCalendarGrid() {
            const dropdown = document.getElementById('calendar-dropdown');
            const monthYearEl = document.getElementById('cal-month-year');
            const daysGrid = document.getElementById('cal-days-grid');
            const dateInput = document.getElementById('intake-date');

            if (!monthYearEl || !daysGrid || !dateInput) return;

            const year = calCurrentDate.getFullYear();
            const month = calCurrentDate.getMonth();

            // Set Header Month Year
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            monthYearEl.innerText = `${monthNames[month]} ${year}`;

            daysGrid.innerHTML = "";

            // Start of current month
            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDayDate = new Date(year, month + 1, 0).getDate();

            // Prev month buffer days
            const prevMonthLastDate = new Date(year, month, 0).getDate();
            for (let i = firstDayIndex; i > 0; i--) {
                const prevDay = prevMonthLastDate - i + 1;
                const cell = document.createElement('div');
                cell.className = "p-2 text-slate-700/40 select-none font-medium cursor-not-allowed text-center";
                cell.innerText = prevDay;
                daysGrid.appendChild(cell);
            }

            // Current month days
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let d = 1; d <= lastDayDate; d++) {
                const cellDate = new Date(year, month, d);
                cellDate.setHours(0, 0, 0, 0);

                const cell = document.createElement('div');
                cell.className = "p-2 rounded-xl text-center cursor-pointer transition-all relative font-medium";
                cell.innerText = d;

                // Check if in the past
                const isPast = cellDate < today;

                // Highlight today
                const isToday = cellDate.getTime() === today.getTime();

                // Highlight selected date
                let isSelected = false;
                if (dateInput.value) {
                    const activeValDate = new Date(dateInput.value + 'T00:00:00');
                    activeValDate.setHours(0, 0, 0, 0);
                    isSelected = cellDate.getTime() === activeValDate.getTime();
                }

                if (isPast) {
                    cell.className += " text-slate-700 cursor-not-allowed";
                } else {
                    if (isSelected) {
                        cell.className += " bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-500/20";
                    } else {
                        cell.className += " text-slate-200 hover:bg-indigo-500/20 hover:text-white";
                    }

                    if (isToday && !isSelected) {
                        cell.className += " border border-indigo-500/40";
                        const dot = document.createElement('span');
                        dot.className = "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400";
                        cell.appendChild(dot);
                    }

                    // Click handler
                    cell.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const padMonth = String(month + 1).padStart(2, '0');
                        const padDay = String(d).padStart(2, '0');
                        const dateStr = `${year}-${padMonth}-${padDay}`;

                        dateInput.value = dateStr;
                        calSelectedDate = cellDate;

                        // Close dropdown
                        dropdown.classList.add('hidden');
                    });
                }

                daysGrid.appendChild(cell);
            }

            // Next month buffer days to complete 6-row grid (42 cells)
            const totalCellsUsed = firstDayIndex + lastDayDate;
            const remainingCells = 42 - totalCellsUsed;
            for (let i = 1; i <= remainingCells; i++) {
                const cell = document.createElement('div');
                cell.className = "p-2 text-slate-700/40 select-none font-medium cursor-not-allowed text-center";
                cell.innerText = i;
                daysGrid.appendChild(cell);
            }
        }

