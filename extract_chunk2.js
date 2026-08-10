const fs = require('fs');

let lines = fs.readFileSync('public/index.html', 'utf8').split('\n');

function extractScriptBlock(expectedLineNum, outFilename, srcAttribute) {
    // Find the nearest <script> tag to expectedLineNum (1-indexed)
    // We search near it because we might have slight offsets.
    let startIdx = lines.findIndex((l, i) => i > expectedLineNum - 100 && i < expectedLineNum + 100 && l.trim() === '<script>');
    if (startIdx === -1) throw new Error("Start script not found near " + expectedLineNum);
    
    let endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '</script>');
    if (endIdx === -1) throw new Error("End script not found after " + startIdx);
    
    const jsLines = lines.slice(startIdx + 1, endIdx);
    fs.writeFileSync(outFilename, jsLines.join('\n'));
    console.log(`Extracted ${jsLines.length} lines to ${outFilename}`);
    
    // Replace the entire block with the new script tag
    lines.splice(startIdx, endIdx - startIdx + 1, `    <script src="${srcAttribute}"></script>`);
}

// Extract bottom-up so line numbers don't shift for the next extraction
// Equipment Modal was around line 11490
extractScriptBlock(11490, 'public/js/equipment-modal.js', 'js/equipment-modal.js');

// Activity Modal was around line 10158
extractScriptBlock(10158, 'public/js/activity-modal.js', 'js/activity-modal.js');

fs.writeFileSync('public/index.html', lines.join('\n'));
console.log('Successfully updated index.html for Chunk 2');
