        function haversineDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // Earth radius in meters
            const phi1 = lat1 * Math.PI / 180;
            const phi2 = lat2 * Math.PI / 180;
            const deltaPhi = (lat2 - lat1) * Math.PI / 180;
            const deltaLambda = (lon2 - lon1) * Math.PI / 180;

            const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // in meters
        }

        function parseGPX(xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const trkpts = xmlDoc.getElementsByTagName("trkpt");

            if (trkpts.length === 0) {
                throw new Error("No trackpoints found in GPX file.");
            }

            let totalDistanceMeters = 0;
            let totalDurationSeconds = 0;
            let heartRates = [];
            let cadences = [];
            let elevations = [];

            let prevLat = null;
            let prevLon = null;
            let prevTime = null;

            for (let i = 0; i < trkpts.length; i++) {
                const trkpt = trkpts[i];
                const lat = parseFloat(trkpt.getAttribute("lat"));
                const lon = parseFloat(trkpt.getAttribute("lon"));

                if (!isNaN(lat) && !isNaN(lon)) {
                    if (prevLat !== null && prevLon !== null) {
                        totalDistanceMeters += haversineDistance(prevLat, prevLon, lat, lon);
                    }
                    prevLat = lat;
                    prevLon = lon;
                }

                const timeEl = trkpt.getElementsByTagName("time")[0];
                if (timeEl) {
                    const currentTime = new Date(timeEl.textContent);
                    if (prevTime !== null) {
                        const diff = (currentTime - prevTime) / 1000;
                        if (diff > 0 && diff < 300) {
                            totalDurationSeconds += diff;
                        }
                    }
                    prevTime = currentTime;
                }

                const eleEl = trkpt.getElementsByTagName("ele")[0];
                if (eleEl) {
                    const eleVal = parseFloat(eleEl.textContent);
                    if (!isNaN(eleVal)) elevations.push(eleVal);
                }

                let hr = null;
                let cad = null;

                const hrEl = trkpt.getElementsByTagName("hr")[0] || trkpt.getElementsByTagName("gpxtpx:hr")[0];
                if (hrEl) hr = parseFloat(hrEl.textContent);

                const cadEl = trkpt.getElementsByTagName("cad")[0] || trkpt.getElementsByTagName("gpxtpx:cad")[0];
                if (cadEl) cad = parseFloat(cadEl.textContent);

                if (isNaN(hr) || hr === null || isNaN(cad) || cad === null) {
                    const extensions = trkpt.getElementsByTagName("extensions")[0];
                    if (extensions) {
                        const allChildren = extensions.getElementsByTagName("*");
                        for (let j = 0; j < allChildren.length; j++) {
                            const child = allChildren[j];
                            if (child.localName === 'hr' && (isNaN(hr) || hr === null)) {
                                hr = parseFloat(child.textContent);
                            }
                            if (child.localName === 'cad' && (isNaN(cad) || cad === null)) {
                                cad = parseFloat(child.textContent);
                            }
                        }
                    }
                }

                if (hr && !isNaN(hr)) heartRates.push(hr);
                if (cad && !isNaN(cad)) cadences.push(cad);
            }

            if (totalDurationSeconds === 0 && trkpts.length > 1) {
                const startTimeEl = trkpts[0].getElementsByTagName("time")[0];
                const endTimeEl = trkpts[trkpts.length - 1].getElementsByTagName("time")[0];
                if (startTimeEl && endTimeEl) {
                    const start = new Date(startTimeEl.textContent);
                    const end = new Date(endTimeEl.textContent);
                    totalDurationSeconds = (end - start) / 1000;
                }
            }

            const distanceMiles = totalDistanceMeters / 1609.344;
            let paceDecimal = 0;
            let paceStr = "0:00";
            if (distanceMiles > 0 && totalDurationSeconds > 0) {
                paceDecimal = (totalDurationSeconds / 60) / distanceMiles;
                const paceMins = Math.floor(paceDecimal);
                const paceSecs = Math.round((paceDecimal - paceMins) * 60);
                paceStr = `${paceMins}:${paceSecs < 10 ? '0' + paceSecs : paceSecs}`;
            }

            let avgCadence = 0;
            if (cadences.length > 0) {
                avgCadence = Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length);
            }

            let avgHeartRate = 0;
            let maxHeartRate = 0;
            if (heartRates.length > 0) {
                avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
                maxHeartRate = Math.max(...heartRates);
            }

            let elevationGainMeters = 0;
            if (elevations.length > 1) {
                for (let i = 1; i < elevations.length; i++) {
                    const diff = elevations[i] - elevations[i - 1];
                    if (diff > 0) elevationGainMeters += diff;
                }
            }
            const elevationGainFeet = elevationGainMeters * 3.28084;

            let avgGradient = 0;
            if (totalDistanceMeters > 0 && elevationGainMeters > 0) {
                avgGradient = (elevationGainMeters / totalDistanceMeters) * 100;
            }

            return {
                distance: parseFloat(distanceMiles.toFixed(2)),
                duration: Math.round(totalDurationSeconds),
                pace: paceStr,
                paceDecimal: paceDecimal,
                avgCadence: avgCadence || null,
                avgHeartRate: avgHeartRate || null,
                maxHeartRate: maxHeartRate || null,
                elevationGain: parseFloat(elevationGainFeet.toFixed(1)),
                avgGradient: parseFloat(avgGradient.toFixed(2))
            };
        }

        function parseTCX(xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const trackpoints = xmlDoc.getElementsByTagName("Trackpoint");

            if (trackpoints.length === 0) {
                throw new Error("No trackpoints found in TCX file.");
            }

            let totalDistanceMeters = 0;
            let totalDurationSeconds = 0;
            let heartRates = [];
            let cadences = [];
            let elevations = [];

            let prevTime = null;
            let startDistance = null;
            let endDistance = null;

            for (let i = 0; i < trackpoints.length; i++) {
                const tp = trackpoints[i];

                const distEl = tp.getElementsByTagName("DistanceMeters")[0];
                if (distEl) {
                    const dist = parseFloat(distEl.textContent);
                    if (startDistance === null) startDistance = dist;
                    endDistance = dist;
                }

                const timeEl = tp.getElementsByTagName("Time")[0];
                if (timeEl) {
                    const currentTime = new Date(timeEl.textContent);
                    if (prevTime !== null) {
                        const diff = (currentTime - prevTime) / 1000;
                        if (diff > 0 && diff < 300) {
                            totalDurationSeconds += diff;
                        }
                    }
                    prevTime = currentTime;
                }

                const altEl = tp.getElementsByTagName("AltitudeMeters")[0];
                if (altEl) {
                    const altVal = parseFloat(altEl.textContent);
                    if (!isNaN(altVal)) elevations.push(altVal);
                }

                const hrEl = tp.getElementsByTagName("HeartRateBpm")[0];
                if (hrEl) {
                    const valEl = hrEl.getElementsByTagName("Value")[0];
                    if (valEl) {
                        const hr = parseFloat(valEl.textContent);
                        if (!isNaN(hr)) heartRates.push(hr);
                    }
                }

                const cadEl = tp.getElementsByTagName("Cadence")[0];
                if (cadEl) {
                    const cad = parseFloat(cadEl.textContent);
                    if (!isNaN(cad)) cadences.push(cad);
                }
            }

            if (startDistance !== null && endDistance !== null) {
                totalDistanceMeters = endDistance - startDistance;
            }

            if (totalDurationSeconds === 0 && trackpoints.length > 1) {
                const startTimeEl = trackpoints[0].getElementsByTagName("Time")[0];
                const endTimeEl = trackpoints[trackpoints.length - 1].getElementsByTagName("Time")[0];
                if (startTimeEl && endTimeEl) {
                    const start = new Date(startTimeEl.textContent);
                    const end = new Date(endTimeEl.textContent);
                    totalDurationSeconds = (end - start) / 1000;
                }
            }

            const distanceMiles = totalDistanceMeters / 1609.344;
            let paceDecimal = 0;
            let paceStr = "0:00";
            if (distanceMiles > 0 && totalDurationSeconds > 0) {
                paceDecimal = (totalDurationSeconds / 60) / distanceMiles;
                const paceMins = Math.floor(paceDecimal);
                const paceSecs = Math.round((paceDecimal - paceMins) * 60);
                paceStr = `${paceMins}:${paceSecs < 10 ? '0' + paceSecs : paceSecs}`;
            }

            let avgCadence = 0;
            if (cadences.length > 0) {
                avgCadence = Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length);
            }

            let avgHeartRate = 0;
            let maxHeartRate = 0;
            if (heartRates.length > 0) {
                avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
                maxHeartRate = Math.max(...heartRates);
            }

            let elevationGainMeters = 0;
            if (elevations.length > 1) {
                for (let i = 1; i < elevations.length; i++) {
                    const diff = elevations[i] - elevations[i - 1];
                    if (diff > 0) elevationGainMeters += diff;
                }
            }
            const elevationGainFeet = elevationGainMeters * 3.28084;

            let avgGradient = 0;
            if (totalDistanceMeters > 0 && elevationGainMeters > 0) {
                avgGradient = (elevationGainMeters / totalDistanceMeters) * 100;
            }

            return {
                distance: parseFloat(distanceMiles.toFixed(2)),
                duration: Math.round(totalDurationSeconds),
                pace: paceStr,
                paceDecimal: paceDecimal,
                avgCadence: avgCadence || null,
                avgHeartRate: avgHeartRate || null,
                maxHeartRate: maxHeartRate || null,
                elevationGain: parseFloat(elevationGainFeet.toFixed(1)),
                avgGradient: parseFloat(avgGradient.toFixed(2))
            };
        }

        function parseGenericWorkout(text) {
            const lines = text.split('\n');
            let distance = null;
            let duration = null;
            let pace = null;
            let avgCadence = null;
            let avgHeartRate = null;

            for (let line of lines) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const val = parts.slice(1).join(':').trim();
                    if (key.includes('distance') || key.includes('dist')) {
                        distance = parseFloat(val);
                    } else if (key.includes('duration') || key.includes('time')) {
                        if (val.includes(':')) {
                            const tParts = val.split(':');
                            if (tParts.length === 2) duration = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
                            else if (tParts.length === 3) duration = parseInt(tParts[0]) * 3600 + parseInt(tParts[1]) * 60 + parseInt(tParts[2]);
                        } else {
                            duration = parseFloat(val);
                        }
                    } else if (key.includes('pace') || key.includes('speed')) {
                        pace = val;
                    } else if (key.includes('cadence') || key.includes('cad')) {
                        avgCadence = parseInt(val);
                    } else if (key.includes('heart') || key.includes('hr')) {
                        avgHeartRate = parseInt(val);
                    }
                }
            }

            if (distance === null || isNaN(distance)) {
                throw new Error("Could not parse generic file: missing distance.");
            }

            return {
                distance: distance,
                duration: duration || 0,
                pace: pace || "8:10",
                avgCadence: avgCadence,
                avgHeartRate: avgHeartRate,
                elevationGain: 0,
                avgGradient: 0
            };
        }

        function parseWorkoutFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const content = e.target.result;
                    const fileName = file.name;
                    const fileExtension = fileName.split('.').pop().toLowerCase();

                    try {
                        if (fileExtension === 'gpx') {
                            const parsedData = parseGPX(content);
                            resolve({ fileName, format: 'GPX', ...parsedData });
                        } else if (fileExtension === 'tcx') {
                            const parsedData = parseTCX(content);
                            resolve({ fileName, format: 'TCX', ...parsedData });
                        } else if (fileExtension === 'json') {
                            const parsedData = JSON.parse(content);
                            resolve({ fileName, format: 'JSON', ...parsedData });
                        } else {
                            const parsedData = parseGenericWorkout(content);
                            resolve({ fileName, format: 'TXT', ...parsedData });
                        }
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error("File reading error"));
                reader.readAsText(file);
            });
        }

        // Firebase Sync Infrastructure Setup
        let auth = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null;
        let db = typeof window.db !== 'undefined' ? window.db : null;
        let userId = ""; // Athlete ID tracker
        let userProfileData = null;
        let activePhaseWorkouts = [];
        let cachedHistoryWorkouts = [];
        let historyFetchedForUser = null;
        let activeUserListener = null;
        let activeWorkoutsListener = null;
        let syncTimeoutHandle = null;
        let paceChartInstance = null;
        let volumeChartInstance = null;

        // Initialize Firebase
        if (typeof __firebase_config !== 'undefined') {
            try {
                const configBlock = JSON.parse(__firebase_config);
                const firebaseInstanceApp = firebase.initializeApp(configBlock);
                db = firebase.firestore(firebaseInstanceApp);
                auth = firebase.auth(firebaseInstanceApp);
                console.log("Firebase linked securely.");
            } catch (err) {
                console.error("Firebase initialization mismatch error: ", err);
            }
        }

        // 1. Profile Switcher & Real-Time Sync Handshake