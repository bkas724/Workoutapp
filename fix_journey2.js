const fs = require('fs');
let content = fs.readFileSync('public/js/journey.js', 'utf8');

const replacement = `function openStartNewJourneyModal() {
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

content = content.replace(/function openStartNewJourneyModal\(\) \{\s*\}\s*\}/, replacement);

fs.writeFileSync('public/js/journey.js', content);
