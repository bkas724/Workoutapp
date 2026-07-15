
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('block');
            });
            document.querySelectorAll(`.tab-${tabId}`).forEach(el => {
                el.classList.remove('hidden');
                el.classList.add('block');
            });

            document.querySelectorAll('nav button').forEach(el => {
                el.classList.remove('text-indigo-400');
                el.classList.add('text-slate-500');
            });
            const btn = document.getElementById(`nav-btn-${tabId}`);
            if (btn) {
                btn.classList.remove('text-slate-500');
                btn.classList.add('text-indigo-400');
            }

            const header = document.getElementById('journey-header-card');
            const headerText = document.getElementById('header-text-toggle');
            const motivationBlock = document.getElementById('motivation-block-container');

            if (header) {
                if (tabId === 'home') {
                    header.classList.remove('py-2', 'px-4');
                    header.classList.add('p-4', 'md:p-5', 'mb-4');
                    if (headerText) headerText.classList.remove('hidden');
                    if (motivationBlock) motivationBlock.classList.remove('hidden');
                } else {
                    header.classList.remove('p-4', 'md:p-5', 'mb-4');
                    header.classList.add('py-2', 'px-4', 'mb-2');
                    if (headerText) headerText.classList.add('hidden');
                    if (motivationBlock) motivationBlock.classList.add('hidden');
                }
            }
        }
        // Your web app's Firebase configuration 
        // (Copy this exact block from your Firebase Project Settings Web App page)
        const firebaseConfig = {
            apiKey: "AIzaSyCedoObrQQHkJ9B_ycYsWla5q8aIIts9nE",
            authDomain: "yourflow-b8645.firebaseapp.com",
            projectId: "yourflow-b8645",
            storageBucket: "yourflow-b8645.firebasestorage.app",
            messagingSenderId: "886635521341",
            appId: "1:886635521341:web:f1162e315632e67a2cd154"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();

    