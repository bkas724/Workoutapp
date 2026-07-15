
        function submitSpeedWorkout(stepId, subId, isBenchmark) {
            const minInput = document.getElementById('logged-min');
            const secInput = document.getElementById('logged-sec');
            const warning = document.getElementById('gatekeeper-warn');

            const mins = parseFloat(minInput.value);
            const secs = parseFloat(secInput.value);

            // Enforce data governance limits (Gating validation)
            if (isNaN(mins) || isNaN(secs) || minInput.value === "" || secInput.value === "") {
                warning.classList.remove('hidden');
                return;
            }
            warning.classList.add('hidden');

            // Process step completion status
            appState[stepId] = true;
            const timelineCb = document.getElementById(stepId);
            if (timelineCb) timelineCb.checked = true;

            // Capture the metrics directly to the subphases array
            const stepNum = stepId.substring(stepId.lastIndexOf('-') + 1);
            const stepObj = subphases.find(s => s.id === subId)?.steps[parseInt(stepNum)];
            if (stepObj) {
                stepObj.completed = true;
                stepObj.actualLoggedPace = `${mins}:${secs < 10 ? '0' + secs : secs}`;
            }

            // Handle Adaptive Physiological Recalculation if it is a benchmark day
            if (isBenchmark) {
                const actualWorkoutPaceDecimal = mins + (secs / 60);

                // Grab old baseline parameters
                const prevMins = parseFloat(document.getElementById('input-min').value) || 8;
                const prevSecs = parseFloat(document.getElementById('input-sec').value) || 10;
                const previousTargetBaselineDecimal = prevMins + (prevSecs / 60);

                // Execute the 70/30 EMA Formula
                const newBaselinePaceDecimal = (previousTargetBaselineDecimal * 0.70) + (actualWorkoutPaceDecimal * 0.30);

                // Convert the final updated decimal blueprint back to clean integers
                const finalMin = Math.floor(newBaselinePaceDecimal);
                const finalSec = Math.round((newBaselinePaceDecimal - finalMin) * 60);

                // Inject the updated baseline straight back to user data configuration views
                document.getElementById('input-min').value = finalMin;
                document.getElementById('input-sec').value = finalSec;

                if (document.getElementById('input-min-display')) {
                    document.getElementById('input-min-display').innerText = finalMin;
                    document.getElementById('input-sec-display').innerText = finalSec < 10 ? '0' + finalSec : finalSec;
                }

                console.log(`EMA recalibration triggered! Previous: ${prevMins}:${prevSecs}, Logged: ${mins}:${secs}, New Engine Base Calibration: ${finalMin}:${finalSec}`);
            }

            // Refresh UI components across layout streams
            updateSubphaseProgressBadge(subId);
            updateOverallProgressMeter();
            calculateTargetPaces(); // This will recalculate threshold slots
            saveStateToCloud(); // Explicitly push the speed workout metrics to Firestore
            renderNextActivityCard();
            updateStageProgress();
        }
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: {
                            easy: '#22c55e', /* Green for easy runs */
                            speed: '#6366f1', /* Indigo for speed runs */
                            strength: '#f97316', /* Orange for strength */
                        }
                    }
                }
            }
        }
    