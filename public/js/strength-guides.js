function switchStrength(routineId) {
            const contentDiv = document.getElementById('strength-guide-content');
            if (contentDiv) {
                Array.from(contentDiv.children).forEach(child => {
                    child.classList.add('hidden');
                });
            }
            const targetDetails = document.getElementById(`r-details-${routineId}`);
            if (targetDetails) targetDetails.classList.remove('hidden');

            const tabsDiv = document.getElementById('strength-guide-tabs');
            if (tabsDiv) {
                Array.from(tabsDiv.children).forEach(tab => {
                    tab.className = "px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all";
                });
            }
            const activeBtn = document.getElementById(`btn-s${routineId.toLowerCase()}`);
            if (activeBtn) activeBtn.className = "px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-600 text-white transition-all";
        }

function renderStrengthGuides(guides) {
            const tabsDiv = document.getElementById('strength-guide-tabs');
            const contentDiv = document.getElementById('strength-guide-content');
            if (!tabsDiv || !contentDiv) return;

            tabsDiv.innerHTML = '';
            contentDiv.innerHTML = '';

            if (!guides || guides.length === 0) {
                tabsDiv.classList.add('hidden');
                contentDiv.innerHTML = '<p class="text-xs text-slate-500 italic mt-4">No strength routines assigned for this block.</p>';
                return;
            }

            tabsDiv.classList.remove('hidden');
            const letters = ['A', 'B', 'C', 'D', 'E'];

            guides.forEach((guide, index) => {
                const id = letters[index] || `G${index}`;

                // Button
                const btn = document.createElement('button');
                btn.id = `btn-s${id.toLowerCase()}`;
                btn.className = index === 0
                    ? "px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-600 text-white transition-all"
                    : "px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-slate-200 transition-all";
                btn.onclick = () => switchStrength(id);
                btn.innerText = id;
                tabsDiv.appendChild(btn);

                // Content
                const wrapper = document.createElement('div');
                wrapper.id = `r-details-${id}`;
                wrapper.className = index === 0 ? "space-y-4 animate-fade-in" : "space-y-4 hidden";

                const titleParts = guide.title.split(':');
                const cleanTitle = titleParts.length > 1 ? titleParts[1].trim() : guide.title;

                const isSimple = (userProfileData && userProfileData.simpleStrengthGuides && userProfileData.simpleStrengthGuides === guides);

                let html = `
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-bold text-violet-400 uppercase tracking-wider">${cleanTitle}</h3>
                        <select onchange="adaptSimpleMode(this)" class="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] uppercase font-bold tracking-wider rounded-lg focus:outline-none focus:border-indigo-500 px-2 py-1 cursor-pointer">
                            <option value="normal" ${!isSimple ? 'selected' : ''}>Normal</option>
                            <option value="simple" ${isSimple ? 'selected' : ''}>Simple</option>
                        </select>
                    </div>
                `;
                html += `<div class="grid grid-cols-1 gap-4">`;

                (guide.exercises || []).forEach((ex, exIdx) => {
                    html += `
                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <h4 class="text-xs font-bold text-slate-300">${exIdx + 1}. ${ex.name}</h4>
                            <p class="text-[11px] text-slate-500 mt-1">${ex.setsReps}. ${ex.description}</p>
                        </div>
                    `;
                });

                html += `</div>`;
                wrapper.innerHTML = html;
                contentDiv.appendChild(wrapper);
            });
        }

async function adaptSimpleMode(selectEl) {
            if (!db || !userId || !userProfileData) return;
            let isSimple = false;
            if (selectEl) {
                isSimple = selectEl.value === 'simple';
            }

            const userDocRef = db.collection("users").doc(userId);

            if (isSimple) {
                // If we already have simple guides cached, just use them
                if (userProfileData.simpleStrengthGuides && userProfileData.simpleStrengthGuides.length > 0) {
                    renderStrengthGuides(userProfileData.simpleStrengthGuides);
                    if (userProfileData.simpleStrengthGuides.length > 0) switchStrength('A');
                    return;
                }

                showAutopilotLoader("Generating Simplified workouts.");
                try {
                    const generateStrengthGuidesOnly = firebase.functions().httpsCallable('generateStrengthGuidesOnly');
                    const cleanProfile = JSON.parse(JSON.stringify(userProfileData));
                    const aiResult = await generateStrengthGuidesOnly({
                        phaseIndex: userProfileData.currentPhaseIndex || 1,
                        profile: cleanProfile,
                        history: [],
                        simpleMode: true
                    });

                    const newGuides = aiResult.data.strengthGuides || [];
                    if (newGuides.length > 0) {
                        await userDocRef.update({ simpleStrengthGuides: newGuides });
                        // Update in-memory userProfileData so next render knows it's simple mode
                        userProfileData.simpleStrengthGuides = newGuides;
                        renderStrengthGuides(newGuides);
                        if (newGuides.length > 0) switchStrength('A');
                    }
                    setTimeout(() => { hideAutopilotLoader(); }, 1000);
                } catch (err) {
                    console.error("Simple mode adapt failure:", err);
                    hideAutopilotLoader();
                    alert("Failed to adapt plan to Simple Mode.");
                    if (selectEl) selectEl.value = 'normal';
                }
            } else {
                // Revert to original
                let guidesToRender = userProfileData.currentStrengthGuides;
                if (!guidesToRender || guidesToRender.length === 0) {
                    guidesToRender = getDefaultStrengthGuides();
                }
                if (guidesToRender) {
                    renderStrengthGuides(guidesToRender);
                    if (guidesToRender.length > 0) switchStrength('A');
                }
            }
        }

function toggleTimer() {
            if (isTimerRunning) {
                clearInterval(mainTimerInterval);
                isTimerRunning = false;
                document.getElementById('btn-timer-primary').innerHTML = `<i class="fa-solid fa-play"></i> Start`;
            } else {
                isTimerRunning = true;
                document.getElementById('btn-timer-primary').innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;

                mainTimerInterval = setInterval(() => {
                    if (totalTimeRemaining > 0) {
                        totalTimeRemaining--;
                        const minutes = Math.floor(totalTimeRemaining / 60);
                        const seconds = totalTimeRemaining % 60;
                        document.getElementById('timer-display-time').innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                    } else {
                        clearInterval(mainTimerInterval);
                        isTimerRunning = false;
                        document.getElementById('btn-timer-primary').innerHTML = `<i class="fa-solid fa-play"></i> Start`;
                        document.getElementById('timer-display-time').innerText = "Done!";
                    }
                }, 1000);
            }
        }

function resetTimer() {
            clearInterval(mainTimerInterval);
            isTimerRunning = false;
            totalTimeRemaining = 30 * 60;
            document.getElementById('timer-display-time').innerText = "30:00";
            document.getElementById('btn-timer-primary').innerHTML = `<i class="fa-solid fa-play"></i> Start`;
        }

function getDefaultStrengthGuides() {
            return [
                {
                    id: "A",
                    title: "Hip Stability & Single-Leg Ground Force",
                    exercises: [
                        { name: "DB Reverse Lunges", setsReps: "3 Sets x 10/leg", description: "Load front heel dynamically. Builds specific push power." },
                        { name: "Banded Monster Walks", setsReps: "3 Sets x 40s", description: "Band around shins. Step wide laterally to strengthen hips." },
                        { name: "DB Goblet Squats", setsReps: "3 Sets x 12", description: "Heavy DB at chest. Focus on deep glute and core control." },
                        { name: "Banded Clamshells", setsReps: "3 Sets x 15/side", description: "Strengthens Gluteus Medius to keep knee track aligned." }
                    ]
                },
                {
                    id: "B",
                    title: "Posterior Propulsion & Rotational Core",
                    exercises: [
                        { name: "DB Romanian Deadlifts", setsReps: "3 Sets x 12", description: "Keep spine neutral. Focuses heavily on hamstrings & glutes." },
                        { name: "Banded Pallof Press", setsReps: "3 Sets x 12/side", description: "Resisting rotation builds powerful torso stiffness." },
                        { name: "Single-Leg DB RDL", setsReps: "3 Sets x 8/leg", description: "Imparts great single-leg balance and hamstring depth." },
                        { name: "Banded Glute Bridges", setsReps: "3 Sets x 15", description: "Band above knees. Drive hips up, pushing knees apart." }
                    ]
                },
                {
                    id: "C",
                    title: "Stride Elasticity & Ankle/Foot Rigidity",
                    exercises: [
                        { name: "Single-Leg Calf Raises", setsReps: "3 Sets x 15", description: "Hold DB on active side. Toughens Achilles for high bounce." },
                        { name: "Banded Toe Hip-Pull", setsReps: "3 Sets x 12", description: "Band around toes. Raise knee up to build hip-flexor snap." },
                        { name: "DB Bulgarian Split Squats", setsReps: "3 Sets x 8/leg", description: "Quad power and deep knee flex reinforcement." },
                        { name: "Banded Pull-Aparts", setsReps: "3 Sets x 15", description: "Strengthens posterior shoulders for deep arm drive." }
                    ]
                }
            ];
        }

