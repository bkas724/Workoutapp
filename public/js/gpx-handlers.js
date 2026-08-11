function clearModalGPX() {
            modalGPXCleared = true;
            tempModalGPXData = null;
            const statusEl = document.getElementById('modal-gpx-status');
            if (statusEl) {
                statusEl.className = "text-[10px] text-slate-500 italic";
                statusEl.innerText = "File removed (click save to apply)";
            }
            const clearBtn = document.getElementById('modal-gpx-clear-btn');
            if (clearBtn) clearBtn.classList.add('hidden');
        }

async function handleModalGPXUpload(input) {
            const statusEl = document.getElementById('modal-gpx-status');
            const clearBtn = document.getElementById('modal-gpx-clear-btn');
            if (!input.files || input.files.length === 0) {
                tempModalGPXData = null;
                if (statusEl) {
                    statusEl.className = "text-[10px] text-slate-500 italic";
                    statusEl.innerText = "No file uploaded";
                }
                if (clearBtn) clearBtn.classList.add('hidden');
                return;
            }

            const file = input.files[0];
            if (statusEl) {
                statusEl.className = "text-[10px] text-amber-400 font-semibold italic animate-pulse";
                statusEl.innerText = "Parsing...";
            }

            try {
                const parsed = await parseWorkoutFile(file);
                tempModalGPXData = {
                    fileName: parsed.fileName,
                    format: parsed.format,
                    distance: parsed.distance,
                    duration: parsed.duration,
                    pace: parsed.pace,
                    avgCadence: parsed.avgCadence,
                    avgHeartRate: parsed.avgHeartRate,
                    maxHeartRate: parsed.maxHeartRate,
                    elevationGain: parsed.elevationGain,
                    avgGradient: parsed.avgGradient,
                    uploadedAt: new Date().toISOString()
                };

                modalGPXCleared = false;
                if (statusEl) {
                    statusEl.className = "text-[10px] text-emerald-450 font-bold";
                    statusEl.innerText = `Parsed: ${parsed.fileName}`;
                }
                if (clearBtn) clearBtn.classList.remove('hidden');
            } catch (err) {
                console.error("Modal GPX upload error:", err);
                tempModalGPXData = null;
                if (statusEl) {
                    statusEl.className = "text-[10px] text-rose-450 font-bold";
                    statusEl.innerText = `Error: ${err.message}`;
                }
                if (clearBtn) clearBtn.classList.add('hidden');
            }
        }

function renderGPXBaselineCard(data) {
            // Samsung Health Baseline has been removed
            return;
        }

async function handleDirectGPXUpload(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            showAutopilotLoader();
            try {
                const parsed = await parseWorkoutFile(file);
                const userDocRef = db.collection("users").doc(userId);

                await userDocRef.update({
                    parsedBaselineWorkout: {
                        fileName: parsed.fileName,
                        format: parsed.format,
                        distance: parsed.distance,
                        duration: parsed.duration,
                        pace: parsed.pace,
                        avgCadence: parsed.avgCadence,
                        avgHeartRate: parsed.avgHeartRate,
                        maxHeartRate: parsed.maxHeartRate,
                        elevationGain: parsed.elevationGain,
                        avgGradient: parsed.avgGradient,
                        uploadedAt: new Date().toISOString()
                    },
                    baseline5k: parsed.pace,
                    currentEstimated5k: parsed.pace,
                    journeyComments: `Coach Autopilot has analyzed your uploaded workout file (${parsed.fileName}). Your cadence was ${parsed.avgCadence || 'N/A'} spm. Pacing guidelines adjusted.`
                });

                console.log("Successfully uploaded direct GPX baseline.");
                const minSec = parsed.pace.split(':');
                if (minSec.length === 2) {
                    document.getElementById('input-min').value = parseInt(minSec[0]);
                    document.getElementById('input-sec').value = parseInt(minSec[1]);
                }

                setTimeout(() => {
                    hideAutopilotLoader();
                    calculateTargetPaces();
                }, 1500);
            } catch (err) {
                console.error("Direct GPX upload error:", err);
                hideAutopilotLoader();
                alert("Error parsing workout file: " + err.message);
            }
        }

async function clearGPXBaseline() {
            if (!db || !userId) return;
            if (!confirm("Are you sure you want to remove your GPX baseline file?")) return;
            showAutopilotLoader();
            try {
                const userDocRef = db.collection("users").doc(userId);
                await userDocRef.update({
                    parsedBaselineWorkout: firebase.firestore.FieldValue.delete()
                });
                setTimeout(() => {
                    hideAutopilotLoader();
                }, 1000);
            } catch (err) {
                console.error("Error clearing GPX baseline:", err);
                hideAutopilotLoader();
                alert("Error removing file from Firestore.");
            }
        }

