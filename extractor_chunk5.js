const fs = require('fs');

function extractFunctions(targetFileName, functionNames) {
    let html = fs.readFileSync('public/index.html', 'utf8');
    let extractedCode = '';
    
    functionNames.forEach(func => {
        let startIdx = html.indexOf(`function ${func}(`);
        if (startIdx === -1) startIdx = html.indexOf(`function ${func} (`);
        if (startIdx === -1) startIdx = html.indexOf(`window.${func} = function`);
        if (startIdx === -1) startIdx = html.indexOf(`async function ${func}(`);
        if (startIdx === -1) startIdx = html.indexOf(`async function ${func} (`);
        
        if (startIdx === -1) {
            console.log(`❌ Function ${func} not found in index.html!`);
            return;
        }

        let beforeStart = html.substring(Math.max(0, startIdx - 30), startIdx);
        if (beforeStart.endsWith('async ')) {
            startIdx -= 6;
        }
        
        let braceCount = 0;
        let started = false;
        let endIdx = -1;
        
        for (let i = startIdx; i < html.length; i++) {
            if (html[i] === '{') {
                braceCount++;
                started = true;
            } else if (html[i] === '}') {
                braceCount--;
            }
            
            if (started && braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
        
        if (endIdx !== -1) {
            let funcCode = html.substring(startIdx, endIdx);
            extractedCode += funcCode + '\n\n';
            html = html.substring(0, startIdx) + html.substring(endIdx);
            console.log(`✅ Extracted ${func}`);
        } else {
            console.log(`❌ Failed to find end of function ${func}`);
        }
    });
    
    if (extractedCode.trim().length > 0) {
        fs.writeFileSync(`public/js/${targetFileName}`, extractedCode);
        const scriptTag = `<script src="js/${targetFileName}"></script>`;
        if (!html.includes(scriptTag)) {
            const bodyCloseIdx = html.indexOf('</body>');
            if (bodyCloseIdx !== -1) {
                html = html.substring(0, bodyCloseIdx) + '    ' + scriptTag + '\n' + html.substring(bodyCloseIdx);
                console.log(`✅ Added script tag for ${targetFileName}`);
            }
        }
        fs.writeFileSync('public/index.html', html);
        console.log(`🎉 Successfully wrote ${targetFileName}`);
    } else {
        console.log(`⚠️ Nothing extracted for ${targetFileName}`);
    }
}

// 1. Pace Math
extractFunctions('pace-math.js', [
    'calculateEst5KRacePace', 'convertRunToEst5KPaceSec', 'updatePaceChart', 
    'formatPace', 'calculateTargetPaces', 'updateTimelinePaceLabels', 
    'paceStringToSeconds', 'extractWorkoutMileage'
]);

// 2. Strength Guides
extractFunctions('strength-guides.js', [
    'switchStrength', 'renderStrengthGuides', 'adaptSimpleMode', 
    'toggleTimer', 'resetTimer', 'getDefaultStrengthGuides'
]);

// 3. Profile Settings
extractFunctions('profile-settings.js', [
    'openProfileModal', 'closeProfileModal', 'saveProfileModal', 
    'toggleDietaryNotes', 'refreshAIInsights', 'refreshNutritionOnly', 
    'refreshAITimelineDetails', 'switchNutritionTab', 'openFullJourneyModal', 
    'closeFullJourneyModal'
]);

// 4. Weight Tracking
extractFunctions('weight-tracking.js', [
    'openLogWeightModal', 'closeLogWeightModal', 'saveWeightLog', 
    'updateDashboardBMI', 'updateBMIVisual', 'enforceMinimumWeight', 
    'validateTargetWeight', 'openWeightHistoryModal', 'closeWeightHistoryModal', 
    'renderWeightHistoryList', 'addWeightHistoryEntry', 'removeWeightHistoryEntry', 
    'checkWeightReminderBanner'
]);

// 5. Phase Generation
extractFunctions('phase-generation.js', [
    'triggerEmergencyAdaptation', 'closeEmergencyModal', 'submitEmergencyAdaptation', 
    'proceedToNextPhase', 'retryAIBlockGeneration', 'getPhase1DefaultWorkouts', 
    'getPhase2DefaultWorkouts', 'getPhase3DefaultWorkouts'
]);

// 6. GPX Handlers
extractFunctions('gpx-handlers.js', [
    'clearModalGPX', 'handleModalGPXUpload', 'renderGPXBaselineCard', 
    'handleDirectGPXUpload', 'clearGPXBaseline'
]);

// 7. Timeline Utils
extractFunctions('timeline-utils.js', [
    'getCheckpointLabel', 'generateTimelineDates', 'getOrFetchHistoryWorkouts', 
    'generateWeeklyTimeline', 'openDetailedPlanModal', 'renderDetailedPlanStages', 
    'closeDetailedPlanModal', 'initCalendar', 'renderCalendarGrid'
]);

// 8. Loaders
extractFunctions('loaders.js', [
    'showAutopilotLoader', 'hideAutopilotLoader', 'retrySyncAfterTimeout'
]);

// 9. Schedule Modals
extractFunctions('schedule-modals.js', [
    'openSwapDaysModal', 'closeSwapDaysModal', 'renderSwapDaysList', 'handleSwapAction'
]);
