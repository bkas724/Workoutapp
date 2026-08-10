const fs = require('fs');
const content = fs.readFileSync('script3.js', 'utf8');

function extractFunction(name) {
    const startIdx = content.indexOf('function ' + name);
    if (startIdx === -1) return '';
    let endIdx = startIdx;
    let braceCount = 0;
    let started = false;
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            started = true;
        } else if (content[i] === '}') {
            braceCount--;
        }
        if (started && braceCount === 0) {
            endIdx = i + 1;
            break;
        }
    }
    return content.substring(startIdx, endIdx);
}

let journeyJs = '';
journeyJs += extractFunction('openStartNewJourneyModal') + '\n\n';
journeyJs += extractFunction('renderJourneyAnchorCard') + '\n\n';
journeyJs += extractFunction('openDetailedPlanModal') + '\n\n';
journeyJs += extractFunction('renderDetailedPlanStages') + '\n\n';
journeyJs += extractFunction('closeDetailedPlanModal') + '\n\n';
journeyJs += extractFunction('closeStartNewJourneyModal') + '\n\n';

let searchStr = 'function openStartNewJourneyModal() {';
let replacementStr = 'function openStartNewJourneyModal() {\n    if (typeof closeProfileModal === "function") closeProfileModal();';
let finalCode = journeyJs.replace(searchStr, replacementStr);

fs.writeFileSync('public/js/journey.js', finalCode);
console.log('Successfully wrote exact functions. Length:', finalCode.length);
