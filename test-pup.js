const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error' || type === 'warning' || type === 'log') {
            console.log(`[PAGE ${type.toUpperCase()}] ${msg.text()}`);
        }
    });
    
    page.on('pageerror', error => {
        console.log(`[PAGE ERROR] ${error.message}`);
    });

    console.log("Navigating to local index.html...");
    await page.goto('file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/public/index.html', { waitUntil: 'networkidle0' });
    
    console.log("Typing 'bkas724' into profile switcher...");
    await page.evaluate(() => {
        const input = document.getElementById('profile-switcher');
        if (input) {
            input.value = '';
            input.focus();
        }
    });
    
    await page.keyboard.type('bkas724');
    await page.keyboard.press('Enter');
    
    console.log("Waiting 3 seconds for async operations...");
    await new Promise(r => setTimeout(r, 3000));
    
    await browser.close();
    console.log("Done.");
})();
