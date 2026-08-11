const fs = require('fs');

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

console.log('Successfully injected Custom Confirm Modal JS');
