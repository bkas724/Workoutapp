const fs = require('fs');

const htmlBlock = `
    <!-- CONFIRM NEW JOURNEY MODAL -->
    <div id="confirm-new-journey-modal"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                <h3 class="font-bold text-lg text-rose-400 flex items-center gap-2">
                    <i class="fa-solid fa-triangle-exclamation"></i> Warning: New Journey
                </h3>
                <button onclick="closeConfirmNewJourneyModal()" class="text-slate-400 hover:text-white transition-colors">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
            
            <!-- Body -->
            <div class="p-6 space-y-4">
                <p class="text-slate-300 text-sm">
                    Are you sure you want to start a new journey? This will wipe your current active block and restart you at Phase 1. Your historical completed workouts will be archived.
                </p>
                <div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                    <label class="block text-rose-400 text-xs font-bold mb-2 uppercase tracking-wide">Type 'NEW' to confirm</label>
                    <input type="text" id="confirm-new-journey-input" oninput="validateConfirmNewJourney()"
                        class="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-center font-mono focus:outline-none focus:border-rose-500 transition-colors uppercase"
                        placeholder="NEW">
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-slate-800 bg-slate-800/30 flex gap-3">
                <button onclick="closeConfirmNewJourneyModal()"
                    class="flex-1 py-3 px-4 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer">
                    Cancel
                </button>
                <button id="confirm-new-journey-btn" onclick="proceedToNewJourney()" disabled
                    class="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-rose-500/50 cursor-not-allowed transition-colors">
                    Start Fresh
                </button>
            </div>
        </div>
    </div>
`;

let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<!-- ONBOARDING MODAL -->', htmlBlock + '\n    <!-- ONBOARDING MODAL -->');
fs.writeFileSync('public/index.html', indexHtml);

const jsBlock = `
function closeConfirmNewJourneyModal() {
    document.getElementById('confirm-new-journey-modal').classList.add('hidden');
    document.getElementById('confirm-new-journey-modal').style.display = 'none';
}

window.validateConfirmNewJourney = function() {
    const input = document.getElementById('confirm-new-journey-input').value.trim().toUpperCase();
    const btn = document.getElementById('confirm-new-journey-btn');
    if (input === 'NEW') {
        btn.disabled = false;
        btn.classList.remove('bg-rose-500/50', 'cursor-not-allowed');
        btn.classList.add('bg-rose-500', 'hover:bg-rose-600', 'shadow-lg', 'shadow-rose-500/30', 'cursor-pointer');
    } else {
        btn.disabled = true;
        btn.classList.remove('bg-rose-500', 'hover:bg-rose-600', 'shadow-lg', 'shadow-rose-500/30', 'cursor-pointer');
        btn.classList.add('bg-rose-500/50', 'cursor-not-allowed');
    }
}

window.proceedToNewJourney = function() {
    closeConfirmNewJourneyModal();
    // Open onboarding modal directly for existing athlete ID
    document.getElementById('onboarding-modal').classList.remove('hidden');
    document.getElementById('profile-lookup-panel').classList.add('hidden');
    document.getElementById('create-id-panel').classList.add('hidden');
    document.getElementById('medical-disclaimer-panel').classList.remove('hidden');
}
`;

let journeyJs = fs.readFileSync('public/js/journey.js', 'utf8');

const oldOpenFunc = `function openStartNewJourneyModal() {
    if (typeof closeProfileModal === 'function') closeProfileModal();

    if (userProfileData && userId) {
        const confirmed = confirm("Are you sure you want to start a new journey? This will wipe your current active block and restart you at Phase 1. Your historical completed workouts will be archived.");
        if (!confirmed) return;

        // Open onboarding modal directly for existing athlete ID
        document.getElementById('onboarding-modal').classList.remove('hidden');
        document.getElementById('profile-lookup-panel').classList.add('hidden');
        document.getElementById('create-id-panel').classList.add('hidden');
        document.getElementById('medical-disclaimer-panel').classList.remove('hidden');
    } else {
        showProfileLookupPanel();
    }
}`;

const newOpenFunc = `function openStartNewJourneyModal() {
    if (typeof closeProfileModal === 'function') closeProfileModal();

    if (userProfileData && userId) {
        document.getElementById('confirm-new-journey-input').value = '';
        window.validateConfirmNewJourney();
        document.getElementById('confirm-new-journey-modal').classList.remove('hidden');
        document.getElementById('confirm-new-journey-modal').style.display = 'flex';
    } else {
        showProfileLookupPanel();
    }
}`;

journeyJs = journeyJs.replace(oldOpenFunc, newOpenFunc);
journeyJs += '\n' + jsBlock;
fs.writeFileSync('public/js/journey.js', journeyJs);

console.log('Successfully injected Custom Confirm Modal');
