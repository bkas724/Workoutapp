const fs = require('fs');

function extractFunctions(targetFileName, functionNames) {
    let html = fs.readFileSync('public/index.html', 'utf8');
    let extractedCode = '';
    
    // Some functions might be defined as `window.funcName = function` or `async function funcName` or `function funcName`
    functionNames.forEach(func => {
        // Find the start of the function definition
        let startIdx = html.indexOf(`function ${func}(`);
        if (startIdx === -1) startIdx = html.indexOf(`function ${func} (`);
        if (startIdx === -1) startIdx = html.indexOf(`window.${func} = function`);
        if (startIdx === -1) startIdx = html.indexOf(`async function ${func}(`);
        if (startIdx === -1) startIdx = html.indexOf(`async function ${func} (`);
        
        if (startIdx === -1) {
            console.log(`❌ Function ${func} not found in index.html!`);
            return;
        }

        // Adjust startIdx to capture "async " or "window." if it exists right before it
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
            
            // Remove from HTML completely
            html = html.substring(0, startIdx) + html.substring(endIdx);
            console.log(`✅ Extracted ${func}`);
        } else {
            console.log(`❌ Failed to find end of function ${func}`);
        }
    });
    
    if (extractedCode.trim().length > 0) {
        fs.writeFileSync(`public/js/${targetFileName}`, extractedCode);
        
        // Ensure script tag exists in index.html
        const scriptTag = `<script src="js/${targetFileName}"></script>`;
        if (!html.includes(scriptTag)) {
            // Find where to insert it, before the closing </body> tag
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

// 1. Gatekeeper
extractFunctions('gatekeeper.js', [
    'openFogOfWarModal',
    'closeFogOfWarModal',
    'toggleGatekeeper',
    'openPrepTipModal',
    'closePrepTipModal'
]);

// 2. Schedule
extractFunctions('schedule.js', [
    'openSwapModifyModal',
    'closeSwapModifyModal',
    'renderSwapDayTiles',
    'switchSwapModalTab',
    'submitWorkoutOrderSwap',
    'submitSingleWorkoutModification'
]);

// 3. Pace & Volume Analytics
extractFunctions('pace-volume.js', [
    'updatePaceAndVolumeHub',
    'calculateRollingJITConsistency',
    'updateJITConsistencyBadge'
]);

// 4. Timeline
extractFunctions('timeline.js', [
    'checkPhaseCompletion',
    'advancePhase',
    'completeJourney',
    'updateOverallProgressMeter',
    'updateTimelineView'
]);

// 5. Workout Logging
extractFunctions('workout-logging.js', [
    'submitWorkout',
    'unsubmitWorkout',
    'quickCompleteWorkout',
    'getIntervalMetadata',
    'recalculateIntervalPace',
    'renderRepRows',
    'openAlternativeModal',
    'closeAlternativeModal',
    'handleAltActivityTypeChange',
    'submitAlternativeActivity',
    'flashPaceChart',
    'autoFillIntervalTargetPace',
    'adjustRepCount',
    'toggleRepSplitsDrawer',
    'toggleAdvancedRepSplits',
    'recalculateFromRepGrid',
    'parseRepDistanceInMiles',
    'getAccurateStrengthExerciseCount'
]);

// 6. Workouts Core UI
extractFunctions('workouts.js', [
    'buildActivePhaseHTML',
    'renderNextActivityCard',
    'toggleStepCheck',
    'toggleActivityCheck',
    'updateWorkoutDate',
    'toggleStepCheckDirect',
    'toggleStrengthTip',
    'toggleCircuitRound',
    'openWorkoutModal',
    'handleWorkoutFileUpload',
    'getISOWeekString',
    'getDisplayDuration',
    'formatActivityRepsDisplay',
    'handleWorkoutCheckToggle',
    'getCheckpointIndex'
]);
