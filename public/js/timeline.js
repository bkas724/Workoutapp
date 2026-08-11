function checkPhaseCompletion() {
            if (activePhaseWorkouts.length === 0) return;
            const allDone = activePhaseWorkouts.every(w => w.completed);
            if (allDone) {
                document.getElementById('checkout-gateway-modal').classList.remove('hidden');
            } else {
                document.getElementById('checkout-gateway-modal').classList.add('hidden');
            }
        }

function updateOverallProgressMeter() {
            if (activePhaseWorkouts.length === 0) return;
            const completedCount = activePhaseWorkouts.filter(w => w.completed).length;
            const currentPhase = userProfileData ? (userProfileData.currentPhaseIndex || 1) : 1;
            const totalCompleted = ((currentPhase - 1) * 7) + completedCount;
            const totalWorkouts = 21; // 3 phases * 7 workouts

            const percent = Math.min(100, Math.round((totalCompleted / totalWorkouts) * 100));
            const completionText = document.getElementById('overall-completion-text');
            const completionBar = document.getElementById('overall-completion-bar');
            if (completionText) completionText.innerText = `${percent}%`;
            if (completionBar) completionBar.style.width = `${percent}%`;
        }

function updateTimelineView(phaseIndex) {
            const phase = parseInt(phaseIndex) || 1;
            const container = document.getElementById('timeline-3d-container');
            const pagination = document.getElementById('timeline-pagination');
            if (!container || !pagination) return;

            // Default phases if none provided
            let plan = [];
            if (userProfileData && userProfileData.macrocyclePlan && userProfileData.macrocyclePlan.length > 0) {
                plan = userProfileData.macrocyclePlan;
            } else {
                plan = [
                    { theme: "Speed Induction", description: "Neuromuscular speed coordination. Alternating explosive 400m intervals with targeted glute/heel stability." },
                    { theme: "Speed Endurance", description: "Aerobic threshold development. Extending speed efforts to 1000m blocks and posterior hamstring deadlifts." },
                    { theme: "Peak & Taper", description: "Maximum capacity and recovery. Testing 1-mile repetitions before backing off volume for supercompensation." }
                ];
            }

            const N = plan.length;
            container.innerHTML = '';
            pagination.innerHTML = '';

            // Generate Pagination Bubbles
            for (let i = 1; i <= N; i++) {
                const bubble = document.createElement('div');
                if (i < phase) {
                    bubble.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50";
                } else if (i === phase) {
                    bubble.className = "w-3 h-3 rounded-full bg-indigo-400 shadow-md shadow-indigo-500 ring-2 ring-indigo-500/30 scale-110 transition-transform";
                } else {
                    bubble.className = "w-2 h-2 rounded-full bg-slate-700 self-center opacity-50";
                }
                pagination.appendChild(bubble);
            }

            // Generate 3D Cards
            // Previous Phase (Left)
            if (phase > 1) {
                const prev = plan[phase - 2];
                const prevHtml = `
                    <div class="absolute left-[2%] md:left-[10%] w-1/3 max-w-[180px] flex flex-col items-center select-none z-0 opacity-40 transition-all duration-700" style="transform: scale(0.75) translateZ(-150px) rotateY(25deg);">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10 mb-2">
                            <i class="fa-solid fa-check text-[10px] text-emerald-400"></i>
                        </div>
                        <span class="text-[9px] md:text-[10px] font-bold text-emerald-400 block tracking-tight text-center uppercase leading-snug">${prev?.theme || 'Phase ' + (phase - 1)}</span>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', prevHtml);
            }

            // Active Phase (Center)
            const current = plan[phase - 1];
            const activeHtml = `
                <div class="absolute w-3/4 md:w-1/2 max-w-[340px] flex flex-col items-center select-none z-10 transition-all duration-700" style="transform: scale(1.05) translateZ(50px);">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center border-2 border-indigo-400 bg-indigo-950 shadow-[0_0_15px_rgba(99,102,241,0.5)] ring-4 ring-indigo-500/20 mb-3">
                        <span class="text-sm font-black text-indigo-300">${phase}</span>
                    </div>
                    <span class="text-[11px] md:text-xs font-black text-indigo-300 block tracking-wider text-center uppercase drop-shadow-md leading-tight">${current?.theme || 'Phase ' + phase}</span>
                    <p class="text-[10px] md:text-xs text-indigo-100/80 mt-3 leading-relaxed text-center p-4 rounded-3xl border border-indigo-500/30 bg-indigo-950/40 backdrop-blur-sm shadow-xl w-full">
                        ${current?.simpleDescription || current?.description || ''}
                    </p>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', activeHtml);

            // Next Phase (Right)
            if (phase < N) {
                const next = plan[phase];
                const nextHtml = `
                    <div class="absolute right-[2%] md:right-[10%] w-1/3 max-w-[180px] flex flex-col items-center select-none z-0 opacity-40 transition-all duration-700" style="transform: scale(0.75) translateZ(-150px) rotateY(-25deg);">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-700 bg-slate-900 mb-2">
                            <span class="text-[10px] font-black text-slate-500">${phase + 1}</span>
                        </div>
                        <span class="text-[9px] md:text-[10px] font-semibold text-slate-500 block tracking-tight text-center uppercase leading-snug">${next?.theme || 'Phase ' + (phase + 1)}</span>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', nextHtml);
            }
        }

