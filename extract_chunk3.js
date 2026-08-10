const fs = require('fs');

let lines = fs.readFileSync('public/index.html', 'utf8').split('\n');

// 1. Extract GPX Parsers (lines 2840 - 3224)
// Remember: 1-indexed line 2840 is array index 2839
const gpxStart = lines.findIndex(l => l.includes('function haversineDistance('));
const gpxEnd = lines.findIndex((l, i) => i > gpxStart && l.includes('async function setupProfileSync('));

if (gpxStart === -1 || gpxEnd === -1) throw new Error('Could not find GPX boundaries');

const gpxLines = lines.slice(gpxStart, gpxEnd);
fs.writeFileSync('public/js/gpx-parser.js', gpxLines.join('\n'));
console.log('Extracted gpx-parser.js:', gpxLines.length, 'lines');

// 2. Extract Onboarding (lines 3225 - 4225)
const onboardStart = gpxEnd;
const onboardEnd = lines.findIndex((l, i) => i > onboardStart && l.includes('function buildActivePhaseHTML('));

if (onboardEnd === -1) throw new Error('Could not find Onboarding boundaries');

const onboardLines = lines.slice(onboardStart, onboardEnd);
fs.writeFileSync('public/js/onboarding.js', onboardLines.join('\n'));
console.log('Extracted onboarding.js:', onboardLines.length, 'lines');

// 3. Extract Journey Features from script3.js
const script3 = fs.readFileSync('script3.js', 'utf8');
const func1Start = script3.indexOf('function openStartNewJourneyModal');
const func1End = script3.indexOf('function renderJourneyAnchorCard');
const func1Code = script3.substring(func1Start, func1End);

const func2Start = script3.indexOf('function renderJourneyAnchorCard');
const func2End = script3.indexOf('function getActivePhaseTheme');
const func2Code = script3.substring(func2Start, func2End);

const journeyJS = func1Code + '\n' + func2Code;
fs.writeFileSync('public/js/journey.js', journeyJS);
console.log('Extracted journey.js from script3.js');

// 4. Update index.html
// We need to replace `lines` from `gpxStart` to `onboardEnd - 1` with:
// </script>
// <script src="js/gpx-parser.js"></script>
// <script src="js/onboarding.js"></script>
// <script src="js/journey.js"></script>
// <script>

const replacementText = `    </script>
    <script src="js/gpx-parser.js"></script>
    <script src="js/onboarding.js"></script>
    <script src="js/journey.js"></script>
    <script>`;

lines.splice(gpxStart, onboardEnd - gpxStart, replacementText);

fs.writeFileSync('public/index.html', lines.join('\n'));
console.log('Successfully updated index.html for Chunk 3');
