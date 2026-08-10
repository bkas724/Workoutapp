
        // --- EQUIPMENT SELECTION MODAL LOGIC ---

        // 1. Data Structure
        const equipmentData = {
            "Cardio & Cross-training": ["Bicycle", "Rowing Machine", "Treadmill", "Elliptical", "Stair Climber", "Swimming Pool", "SkiErg"],
            "Weights & Free Weights": ["Dumbbells", "Kettlebells", "Barbell", "Weight Plates", "Hex Bar / Trap Bar", "Adjustable Dumbbells"],
            "Machines": ["Cable Machine", "Leg Press", "Leg Extension", "Leg Curl", "Lat Pulldown", "Seated Row", "Pec Deck / Fly", "Smith Machine", "Hack Squat"],
            "Racks & Benches": ["Squat Rack / Power Rack", "Bench Press", "Adjustable Bench", "Flat Bench"],
            "Bodyweight & Accessories": ["Pull-up Bar", "Dip Station", "Resistance Bands", "Yoga Mat", "Jump Rope", "Ab Roller", "Foam Roller", "Battle Ropes", "Plyo Box", "TRX Suspension Trainer", "Sandbag", "Medicine Balls", "Bosu Ball"]
        };

        const presets = {
            "commercial": ["Dumbbells", "Kettlebells", "Barbell", "Weight Plates", "Hex Bar / Trap Bar", "Cable Machine", "Leg Press", "Leg Extension", "Leg Curl", "Lat Pulldown", "Seated Row", "Pec Deck / Fly", "Smith Machine", "Hack Squat", "Squat Rack / Power Rack", "Bench Press", "Adjustable Bench", "Flat Bench", "Pull-up Bar", "Dip Station", "Rowing Machine", "Treadmill", "Elliptical", "Stair Climber", "Resistance Bands", "Yoga Mat", "Jump Rope", "Ab Roller", "Foam Roller", "Medicine Balls", "Bosu Ball", "TRX Suspension Trainer", "Plyo Box", "Battle Ropes"],
            "home": ["Dumbbells", "Kettlebells", "Resistance Bands", "Yoga Mat", "Pull-up Bar", "Jump Rope", "Adjustable Bench"]
        };

        // State
        window.selectedEquipment = new Set();
        let customEquipmentList = [];
        let currentEditingContext = 'intake'; // 'intake' or 'modal'

        // DOM Elements
        const equipModal = document.getElementById('equipment-selection-modal');
        const closeEquipBtn = document.getElementById('close-equipment-modal-btn');
        const searchInput = document.getElementById('equipment-search-input');
        const categoriesContainer = document.getElementById('equipment-categories-container');
        const confirmEquipBtn = document.getElementById('confirm-equipment-btn');
        const addCustomBtn = document.getElementById('add-custom-equipment-btn');

        const presetCommercialBtn = document.getElementById('preset-commercial-gym');
        const presetHomeBtn = document.getElementById('preset-home-gym');

        // Render Categories and Items
        function renderEquipmentList(filterTerm = '') {
            categoriesContainer.innerHTML = '';
            const term = filterTerm.toLowerCase().trim();
            let hasMatches = false;

            const allCategories = { ...equipmentData, "Custom": customEquipmentList };

            for (const [category, items] of Object.entries(allCategories)) {
                if (!items || items.length === 0) continue;

                // Filter items based on search
                const filteredItems = items.filter(item => item.toLowerCase().includes(term));

                if (filteredItems.length === 0) continue; // Skip category if no matches
                hasMatches = true;

                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'bg-slate-950 border border-slate-800 rounded-xl overflow-hidden';

                // Accordion Header
                const headerBtn = document.createElement('button');
                headerBtn.type = 'button';
                // Automatically expand if filtering, otherwise only expand the first one
                const isExpanded = term !== '' || (category === "Cardio & Cross-training" && categoriesContainer.children.length === 0);

                headerBtn.className = 'w-full flex justify-between items-center p-3 text-left font-bold text-white bg-slate-900/50 hover:bg-slate-800 transition-colors';

                // Items Container
                const itemsDiv = document.createElement('div');
                itemsDiv.className = `p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-800 ${isExpanded ? '' : 'hidden'}`;

                const renderHeaderContent = () => {
                    const selectedInCategory = filteredItems.filter(item => window.selectedEquipment.has(item));
                    let rightSideHtml = '';

                    if (selectedInCategory.length > 0) {
                        rightSideHtml += `<div class="flex items-center gap-1 mr-3">`;
                        const maxBubbles = 2;
                        for (let i = 0; i < Math.min(selectedInCategory.length, maxBubbles); i++) {
                            let displayName = selectedInCategory[i];
                            if (displayName.length > 12) displayName = displayName.substring(0, 10) + '...';
                            rightSideHtml += `<div class="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-2 py-0.5 rounded-full text-[9px] font-bold">${displayName}</div>`;
                        }
                        if (selectedInCategory.length > maxBubbles) {
                            rightSideHtml += `<div class="bg-slate-700 border border-slate-600 text-slate-300 px-2 py-0.5 rounded-full text-[9px] font-bold">+${selectedInCategory.length - maxBubbles}</div>`;
                        }
                        rightSideHtml += `</div>`;
                    }

                    const isCurrentlyExpanded = !itemsDiv.classList.contains('hidden');

                    headerBtn.innerHTML = `
                        <span>${category} <span class="text-xs text-slate-500 font-normal ml-2 hidden sm:inline">(${filteredItems.length})</span></span>
                        <div class="flex items-center">
                            ${rightSideHtml}
                            <i class="fa-solid fa-chevron-${isCurrentlyExpanded ? 'up' : 'down'} text-slate-500 transition-transform duration-200"></i>
                        </div>
                    `;
                };

                renderHeaderContent();

                // Toggle Accordion
                headerBtn.onclick = () => {
                    if (itemsDiv.classList.contains('hidden')) {
                        itemsDiv.classList.remove('hidden');
                    } else {
                        itemsDiv.classList.add('hidden');
                    }
                    renderHeaderContent();
                };

                // Render Checkboxes
                filteredItems.forEach(item => {
                    const label = document.createElement('label');
                    label.className = 'flex items-center gap-2 cursor-pointer select-none p-2 rounded-lg hover:bg-slate-900 transition-colors';
                    const isChecked = window.selectedEquipment.has(item);

                    label.innerHTML = `
                        <input type="checkbox" value="${item}" ${isChecked ? 'checked' : ''}
                               class="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-indigo-500 text-indigo-500 focus:ring-0">
                        <span class="text-slate-300 text-sm font-semibold">${item}</span>
                    `;

                    const checkbox = label.querySelector('input');
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            window.selectedEquipment.add(item);
                        } else {
                            window.selectedEquipment.delete(item);
                        }
                        renderHeaderContent();
                    });

                    itemsDiv.appendChild(label);
                });

                categoryDiv.appendChild(headerBtn);
                categoryDiv.appendChild(itemsDiv);
                categoriesContainer.appendChild(categoryDiv);
            }

            // Handle Custom Add Button Visibility
            if (!hasMatches && term !== '') {
                addCustomBtn.classList.remove('hidden');
                addCustomBtn.innerText = `Add "${term}"`;
            } else if (term !== '' && !Array.from(window.selectedEquipment).some(i => i.toLowerCase() === term)) {
                // Even if there are matches, allow adding if exact match doesn't exist
                let exactMatchFound = false;
                Object.values(allCategories).flat().forEach(i => {
                    if (i.toLowerCase() === term) exactMatchFound = true;
                });
                if (!exactMatchFound) {
                    addCustomBtn.classList.remove('hidden');
                    addCustomBtn.innerText = `Add "${term}"`;
                } else {
                    addCustomBtn.classList.add('hidden');
                }
            } else {
                addCustomBtn.classList.add('hidden');
            }
        }

        // Search Input Event
        searchInput.addEventListener('input', (e) => {
            renderEquipmentList(e.target.value);
        });

        // Add Custom Equipment Event
        addCustomBtn.addEventListener('click', () => {
            const term = searchInput.value.trim();
            if (term) {
                // Capitalize first letters
                const formattedTerm = term.replace(/\b\w/g, l => l.toUpperCase());
                if (!customEquipmentList.includes(formattedTerm)) {
                    customEquipmentList.push(formattedTerm);
                }
                window.selectedEquipment.add(formattedTerm);
                searchInput.value = '';
                addCustomBtn.classList.add('hidden');
                renderEquipmentList(); // re-render
            }
        });

        // Preset Events
        presetCommercialBtn.addEventListener('click', () => {
            presets.commercial.forEach(item => window.selectedEquipment.add(item));
            renderEquipmentList(searchInput.value);
        });

        presetHomeBtn.addEventListener('click', () => {
            presets.home.forEach(item => window.selectedEquipment.add(item));
            renderEquipmentList(searchInput.value);
        });

        // Bubble Rendering
        window.renderBubbles = function (containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';

            if (window.selectedEquipment.size === 0) {
                container.innerHTML = '<span class="text-xs text-slate-500 italic p-1">No equipment selected</span>';
                return;
            }

            Array.from(window.selectedEquipment).forEach(item => {
                const bubble = document.createElement('div');
                bubble.className = 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5';

                const text = document.createElement('span');
                text.innerText = item;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'hover:text-white transition-colors cursor-pointer w-4 h-4 flex items-center justify-center rounded-full hover:bg-indigo-500/40';
                removeBtn.innerHTML = '<i class="fa-solid fa-times text-[10px]"></i>';

                removeBtn.onclick = () => {
                    window.selectedEquipment.delete(item);
                    renderBubbles(containerId);
                };

                bubble.appendChild(text);
                bubble.appendChild(removeBtn);
                container.appendChild(bubble);
            });
        };

        // Modal Open/Close
        function openEquipmentModal(context) {
            currentEditingContext = context;

            // Initialize selectedEquipment based on context if needed
            if (context === 'modal' && typeof userProfileData !== 'undefined' && userProfileData.equipmentList) {
                // Load from profile if we just opened the settings modal (handled in loadProfileSettings usually, but good to be safe)
            }

            searchInput.value = '';
            addCustomBtn.classList.add('hidden');
            renderEquipmentList();
            equipModal.classList.remove('hidden');
            equipModal.classList.add('flex');
        }

        closeEquipBtn.addEventListener('click', () => {
            equipModal.classList.add('hidden');
            equipModal.classList.remove('flex');
        });

        confirmEquipBtn.addEventListener('click', () => {
            equipModal.classList.add('hidden');
            equipModal.classList.remove('flex');

            // Update the correct bubble container
            if (currentEditingContext === 'intake') {
                renderBubbles('intake-equipment-bubbles');
            } else if (currentEditingContext === 'modal') {
                renderBubbles('modal-equipment-bubbles');
            }
        });

        // Attach listeners to trigger buttons
        document.getElementById('intake-select-equipment-btn').addEventListener('click', () => {
            openEquipmentModal('intake');
        });

        document.getElementById('modal-select-equipment-btn').addEventListener('click', () => {
            openEquipmentModal('modal');
        });

        // --- INTERACTIVE APP TOUR LOGIC ---
        // --- INTERACTIVE APP TOUR LOGIC ---
        const tourSteps = [
            {
                targetId: 'nav-btn-home',
                tab: 'home',
                title: '1. Home Tab',
                desc: 'Your daily control center! Access your current focus workout, weight progression chart, and health insights at a glance.'
            },
            {
                targetId: 'journey-header-card',
                tab: 'home',
                title: '2. Athlete Profile & Header',
                desc: 'Your main dashboard header! View your active Athlete ID, sync status, and click "Edit" to adjust your baseline pace, weight, or target goals anytime.'
            },
            {
                targetId: 'next-activity-focus',
                tab: 'home',
                title: '3. Up Next (Daily JIT Task)',
                desc: 'This is your primary Daily Focus Card! It shows today\'s workout, preparation notes and a preview of tomorrow when the daily activities are complete.'
            },
            {
                targetId: 'focus-action-controls',
                tab: 'home',
                title: '4. 1-Touch Checkmark vs. Detailed Logging',
                desc: 'Followed the coach\'s guidance? 1-touch on the checkmark and you\'re done. Easy peasy lemon squeezy! Ran a bit extra or slightly off target? Tap Log to easily adjust those default metrics.'
            },
            {
                targetId: 'home-health-insights-card',
                tab: 'home',
                title: '5. AI Recovery & Meal Insights',
                desc: 'Dynamically calculated movement tips, hydration guidelines, and tiered nutrition meals tailored to rest, light, or hard workout days.'
            },
            {
                targetId: 'nav-btn-analytics',
                tab: 'analytics',
                title: '6. Analytics Tab',
                desc: 'Track your long-term progress! View your weight & BMI trend lines, 5K estimated race pace improvements, and weekly volume graphs.'
            },
            {
                targetId: 'nav-btn-checklist',
                tab: 'checklist',
                title: '7. JIT Checklist Tab',
                desc: 'Your full workout sequence! Check off completed activities, swap training days around, or request an adaptive plan update.'
            },
            {
                targetId: 'nav-btn-strength',
                tab: 'strength',
                title: '8. Strength Tab',
                desc: 'Customized bodyweight & equipment-based strength circuits designed to build core stability and prevent injuries.'
            },
            {
                targetId: 'nav-btn-journey',
                tab: 'journey',
                title: '9. Journey Roadmap Tab',
                desc: 'Your macrocycle timeline! View your current training phase, milestone target dates, and long-term training strategies/ goals.'
            }
        ];

        let currentTourIndex = 0;
        let tourCardMinimized = false;

        function startAppTour(force = false) {
            console.log("🚩 startAppTour triggered, force=", force);
            const isLocalDone = localStorage.getItem('myflow_tour_completed') === 'true';
            const isRemoteDone = userProfileData && (userProfileData.hasCompletedTour || userProfileData.tourCompleted);
            if (!force && (isLocalDone || isRemoteDone)) return;
            currentTourIndex = 0;
            tourCardMinimized = false;
            const overlay = document.getElementById('app-tour-overlay');
            if (overlay) {
                overlay.style.display = 'block';
                overlay.classList.remove('hidden');
            }
            renderTourStep();
        }
        window.startAppTour = startAppTour;

        function toggleTourCardMinimize() {
            tourCardMinimized = !tourCardMinimized;
            const descEl = document.getElementById('tour-desc');
            const minBtn = document.getElementById('tour-min-btn');
            if (tourCardMinimized) {
                if (descEl) descEl.classList.add('hidden');
                if (minBtn) minBtn.innerText = 'Expand';
            } else {
                if (descEl) descEl.classList.remove('hidden');
                if (minBtn) minBtn.innerText = 'Minimize';
            }
        }
        window.toggleTourCardMinimize = toggleTourCardMinimize;

        function getTourTargetEl(targetId) {
            if (targetId === 'focus-action-controls') {
                return document.querySelector('.focus-action-controls-station') || document.getElementById('next-activity-focus');
            }
            return document.getElementById(targetId);
        }

        function updateSpotlightPos() {
            const step = tourSteps[currentTourIndex];
            if (!step) return;
            const targetEl = getTourTargetEl(step.targetId);
            const spotlight = document.getElementById('tour-spotlight-box');
            if (targetEl && spotlight) {
                const rect = targetEl.getBoundingClientRect();
                const padding = 6;
                spotlight.style.top = `${rect.top - padding}px`;
                spotlight.style.left = `${rect.left - padding}px`;
                spotlight.style.width = `${rect.width + (padding * 2)}px`;
                spotlight.style.height = `${rect.height + (padding * 2)}px`;

                const isTabTarget = step.targetId.startsWith('nav-btn-');
                if (isTabTarget) {
                    // Tab highlight mode: No dark overlay blocking background. Full tab visibility & scrollability!
                    spotlight.style.boxShadow = '0 0 25px rgba(99, 102, 241, 0.85), 0 0 10px rgba(99, 102, 241, 0.6)';
                } else {
                    // Component highlight mode: gentle dark frame
                    spotlight.style.boxShadow = '0 0 0 9999px rgba(2, 6, 23, 0.75), 0 0 30px rgba(99, 102, 241, 0.6)';
                }
            }
        }

        window.addEventListener('scroll', updateSpotlightPos, { passive: true });
        window.addEventListener('resize', updateSpotlightPos, { passive: true });

        function renderTourStep() {
            const step = tourSteps[currentTourIndex];
            if (!step) {
                endAppTour();
                return;
            }

            // Switch to required tab if needed
            if (typeof switchTab === 'function' && step.tab) {
                switchTab(step.tab);
            }

            // Update badge, title, desc
            const badge = document.getElementById('tour-step-badge');
            if (badge) badge.innerText = `Step ${currentTourIndex + 1} of ${tourSteps.length}`;

            const title = document.getElementById('tour-title');
            if (title) title.innerText = step.title;

            const desc = document.getElementById('tour-desc');
            if (desc) desc.innerText = step.desc;

            // Reset minimize state if expanded
            if (!tourCardMinimized) {
                const descEl = document.getElementById('tour-desc');
                if (descEl) descEl.classList.remove('hidden');
                const minBtn = document.getElementById('tour-min-btn');
                if (minBtn) minBtn.innerText = 'Minimize';
            }

            // Prev button state
            const prevBtn = document.getElementById('tour-prev-btn');
            if (prevBtn) prevBtn.disabled = (currentTourIndex === 0);

            // Next button text
            const nextBtn = document.getElementById('tour-next-btn');
            if (nextBtn) {
                nextBtn.innerText = (currentTourIndex === tourSteps.length - 1) ? 'Finish Tour' : 'Next Step';
            }

            // Position tour card & spotlight cutout near target element
            setTimeout(() => {
                const targetEl = getTourTargetEl(step.targetId);
                const tourCard = document.getElementById('tour-card');

                if (targetEl && tourCard) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    setTimeout(() => {
                        updateSpotlightPos();
                        const rect = targetEl.getBoundingClientRect();

                        const isTabTarget = step.targetId.startsWith('nav-btn-');

                        if (window.innerWidth >= 768) {
                            // Desktop positioning: nav tabs are at the TOP, so place instruction card BELOW them
                            if (isTabTarget) {
                                let top = rect.bottom + 20;
                                let left = Math.max(16, Math.min(rect.left - 40, window.innerWidth - tourCard.offsetWidth - 16));
                                tourCard.style.top = `${top}px`;
                                tourCard.style.bottom = 'auto';
                                tourCard.style.left = `${left}px`;
                                tourCard.style.transform = 'none';
                            } else {
                                let top = rect.bottom + 20;
                                if (top + tourCard.offsetHeight > window.innerHeight) {
                                    top = Math.max(20, rect.top - tourCard.offsetHeight - 20);
                                }
                                let left = Math.max(20, Math.min(rect.left, window.innerWidth - tourCard.offsetWidth - 20));
                                tourCard.style.top = `${top}px`;
                                tourCard.style.bottom = 'auto';
                                tourCard.style.left = `${left}px`;
                                tourCard.style.transform = 'none';
                            }
                        } else {
                            // Mobile positioning: ensure card sits NEAR tabs with clearance, never covering
                            if (isTabTarget) {
                                // Bottom nav bar tab: position card cleanly ABOVE the tab spotlight
                                const cardTop = Math.max(16, rect.top - tourCard.offsetHeight - 24);
                                tourCard.style.top = `${cardTop}px`;
                                tourCard.style.bottom = 'auto';
                            } else {
                                const elementCenterY = rect.top + (rect.height / 2);
                                if (elementCenterY > (window.innerHeight / 2)) {
                                    tourCard.style.top = '16px';
                                    tourCard.style.bottom = 'auto';
                                } else {
                                    tourCard.style.top = 'auto';
                                    tourCard.style.bottom = '16px';
                                }
                            }
                            tourCard.style.left = '50%';
                            tourCard.style.transform = 'translateX(-50%)';
                        }
                    }, 150);
                }
            }, 100);
        }

        function nextTourStep() {
            if (currentTourIndex < tourSteps.length - 1) {
                currentTourIndex++;
                renderTourStep();
            } else {
                endAppTour();
            }
        }
        window.nextTourStep = nextTourStep;

        function prevTourStep() {
            if (currentTourIndex > 0) {
                currentTourIndex--;
                renderTourStep();
            }
        }
        window.prevTourStep = prevTourStep;

        function endAppTour() {
            const overlay = document.getElementById('app-tour-overlay');
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.add('hidden');
            }
            localStorage.setItem('myflow_tour_completed', 'true');
            if (typeof userProfileData !== 'undefined' && userProfileData) {
                userProfileData.hasCompletedTour = true;
                userProfileData.tourCompleted = true;
            }
            if (typeof userId !== 'undefined' && userId && typeof db !== 'undefined') {
                db.collection('users').doc(userId).set({
                    hasCompletedTour: true,
                    tourCompleted: true,
                    tourCompletedAt: new Date().toISOString()
                }, { merge: true }).then(() => {
                    console.log("☁️ Saved tour completion status to Firestore user document.");
                }).catch(err => console.warn("Firestore tour status save notice:", err));
            }
            if (typeof switchTab === 'function') switchTab('home');
        }
        window.endAppTour = endAppTour;

    