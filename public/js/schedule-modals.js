function openSwapDaysModal() {
            swapSelectedDay = null;
            renderSwapDaysList();

            const modal = document.getElementById('swap-days-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            // Trigger animation
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
                modal.querySelector('div').classList.add('scale-100');
            }, 10);
        }

function closeSwapDaysModal() {
            const modal = document.getElementById('swap-days-modal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.remove('scale-100');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
            swapSelectedDay = null;
        }

function renderSwapDaysList() {
            const listContainer = document.getElementById('swap-days-list');
            if (!activePhaseWorkouts || activePhaseWorkouts.length === 0) {
                listContainer.innerHTML = '<p class="text-slate-400 text-sm text-center">No active workouts to swap.</p>';
                return;
            }

            // Group active phase workouts by sequenceOrder (day)
            const groupedWorkouts = {};
            activePhaseWorkouts.forEach(step => {
                const day = step.sequenceOrder || 1;
                if (!groupedWorkouts[day]) {
                    groupedWorkouts[day] = [];
                }
                groupedWorkouts[day].push(step);
            });

            const sortedDays = Object.keys(groupedWorkouts).sort((a, b) => Number(a) - Number(b));
            let html = '';

            sortedDays.forEach(day => {
                const dayWorkouts = groupedWorkouts[day];
                const activityNames = dayWorkouts.map(w => w.workoutTitle).join(', ');
                const isSelected = swapSelectedDay === day;

                // Container Styling
                let containerClass = "p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-4 ";
                if (isSelected) {
                    containerClass += "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                } else if (swapSelectedDay) {
                    containerClass += "bg-slate-900 border-slate-800 hover:border-slate-700";
                } else {
                    containerClass += "bg-slate-900 border-slate-800 hover:border-slate-700";
                }

                // Button State
                let btnHtml = '';
                if (isSelected) {
                    btnHtml = `<button onclick="handleSwapAction('${day}')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors shadow-sm text-sm"><i class="fa-solid fa-xmark"></i></button>`;
                } else if (swapSelectedDay) {
                    btnHtml = `<button onclick="handleSwapAction('${day}')" class="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-[0_0_10px_rgba(99,102,241,0.3)] text-sm">With</button>`;
                } else {
                    btnHtml = `<button onclick="handleSwapAction('${day}')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors text-sm">Swap</button>`;
                }

                html += `
                    <div class="${containerClass}">
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-bold text-slate-200 mb-0.5">Day ${day}</h4>
                            <p class="text-xs text-slate-400 truncate">${activityNames}</p>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            });

            listContainer.innerHTML = html;
        }

async function handleSwapAction(dayStr) {
            if (swapSelectedDay === dayStr) {
                // Deselect
                swapSelectedDay = null;
                renderSwapDaysList();
            } else if (!swapSelectedDay) {
                // Select
                swapSelectedDay = dayStr;
                renderSwapDaysList();
            } else {
                // Execute Swap between swapSelectedDay and dayStr
                const dayA = swapSelectedDay;
                const dayB = dayStr;

                // Show loading state in modal
                document.getElementById('swap-days-list').innerHTML = `
                    <div class="flex flex-col items-center justify-center py-8">
                        <i class="fa-solid fa-circle-notch animate-spin text-2xl text-indigo-500 mb-3"></i>
                        <p class="text-slate-400 text-sm font-medium">Swapping Day ${dayA} with Day ${dayB}...</p>
                    </div>
                `;

                try {
                    const batch = db.batch();
                    const userDocRef = db.collection("users").doc(userId);
                    const phaseRef = userDocRef.collection("active_phase");

                    // Identify items
                    const itemsA = activePhaseWorkouts.filter(w => w.sequenceOrder == dayA);
                    const itemsB = activePhaseWorkouts.filter(w => w.sequenceOrder == dayB);

                    // Temp assignment to avoid collisions not strictly necessary in memory/firestore batch, 
                    // but we just assign the new values
                    itemsA.forEach(item => {
                        item.sequenceOrder = Number(dayB); // Update local
                        batch.update(phaseRef.doc(item.id), { sequenceOrder: Number(dayB) });
                    });

                    itemsB.forEach(item => {
                        item.sequenceOrder = Number(dayA); // Update local
                        batch.update(phaseRef.doc(item.id), { sequenceOrder: Number(dayA) });
                    });

                    await batch.commit();

                    // Re-render JIT list
                    buildActivePhaseHTML();

                    // Close modal
                    closeSwapDaysModal();
                } catch (err) {
                    console.error("Error swapping days:", err);
                    alert("Failed to swap days. Please check your connection.");
                    swapSelectedDay = null;
                    renderSwapDaysList();
                }
            }
        }

