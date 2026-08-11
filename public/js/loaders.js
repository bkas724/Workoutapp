function showAutopilotLoader(customMessage) {
            document.getElementById('autopilot-loading-screen').classList.remove('hidden');
            const tickerEl = document.getElementById('autopilot-loading-ticker');

            if (window.tickerInterval) {
                clearInterval(window.tickerInterval);
            }

            if (customMessage) {
                tickerEl.innerText = customMessage;
            } else {
                const tickers = [
                    "Analyzing your consistency curve...",
                    "Calculating fatigue curves and RPE ratios...",
                    "Adapting pace targets to your heart rate variance...",
                    "Seeding next 7-activity JIT block...",
                    "Syncing updates to Firestore databases..."
                ];
                let tickerIdx = 0;
                tickerEl.innerText = tickers[0];

                window.tickerInterval = setInterval(() => {
                    tickerIdx = (tickerIdx + 1) % tickers.length;
                    tickerEl.innerText = tickers[tickerIdx];
                }, 2000);
            }

            // 120-second abort interceptor
            syncTimeoutHandle = setTimeout(() => {
                hideAutopilotLoader();
                document.getElementById('timeout-error-modal').classList.remove('hidden');
            }, 120000);
        }

function hideAutopilotLoader() {
            document.getElementById('autopilot-loading-screen').classList.add('hidden');
            if (window.tickerInterval) {
                clearInterval(window.tickerInterval);
            }
            if (syncTimeoutHandle) {
                clearTimeout(syncTimeoutHandle);
                syncTimeoutHandle = null;
            }
        }

function retrySyncAfterTimeout() {
            document.getElementById('timeout-error-modal').classList.add('hidden');
            setupProfileSync(userId);
        }

