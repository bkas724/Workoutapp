const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const startIndex = html.indexOf('const icons = {');
if (startIndex === -1) throw new Error('Start string not found');

const scriptTagIndex = html.lastIndexOf('<script>', startIndex);
const actualStart = scriptTagIndex !== -1 ? scriptTagIndex : startIndex; 

const endStr = 'else window.bmiChartInstance = chartInstance;';
const endIndex = html.indexOf(endStr);
if (endIndex === -1) throw new Error('End string not found');

const blockEndIndex = html.indexOf('</script>', endIndex) + 9;

let extractedJS = html.substring(actualStart + 8, blockEndIndex - 9); // strip <script> and </script>

const script3 = fs.readFileSync('script3.js', 'utf8');
const func1Start = script3.indexOf('function openStartNewJourneyModal');
const func1End = script3.indexOf('function renderJourneyAnchorCard');
const func1Code = script3.substring(func1Start, func1End);

const func2Start = script3.indexOf('function renderJourneyAnchorCard');
const func2End = script3.indexOf('function getActivePhaseTheme');
const func2Code = script3.substring(func2Start, func2End);

extractedJS += '\n\n        // --- Functions ported from script3.js ---\n\n        ' + func1Code + '\n        ' + func2Code + '\n';

fs.writeFileSync('public/app.js', extractedJS);

const newHtml = html.substring(0, actualStart) + '\n<script src=\"app.js\"></script>\n' + html.substring(blockEndIndex);
fs.writeFileSync('public/index.html', newHtml);

console.log('Successfully modularized app.js! Size:', extractedJS.length, 'bytes');
