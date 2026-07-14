document.addEventListener("DOMContentLoaded", () => {
    const loginZone = document.getElementById("login-zone");
    const adminPanel = document.getElementById("admin-panel");
    const btnLogin = document.getElementById("btn-login");
    const btnLogout = document.getElementById("btn-logout");
    const btnReset = document.getElementById("btn-reset");

    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");

    const stepsStatusList = document.getElementById("steps-status-list");
    const importStepSelect = document.getElementById("import-step-select");

    const csvDropzone = document.getElementById("csv-dropzone");
    const csvFileInput = document.getElementById("csv-file-input");

    // 1. Détection de l'état de connexion de l'admin
    auth.onAuthStateChanged((user) => {
        if (user) {
            loginZone.style.display = "none";
            adminPanel.style.display = "block";
            loadAdminDashboard();
        } else {
            loginZone.style.display = "block";
            adminPanel.style.display = "none";
        }
    });

    btnLogin.addEventListener("click", () => {
        auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
            .catch(err => alert("Erreur d'accès : " + err.message));
    });

    btnLogout.addEventListener("click", () => {
        auth.signOut();
    });

    // 2. Gestion et Initialisation automatique de la base
    function loadAdminDashboard() {
        db.ref(`${ROOT}/${activeSeason}`).on("value", (snapshot) => {
            const data = snapshot.val();
            
            // Si la base de données est vierge, on l'initialise avec config.js
            if (!data || !data.steps) {
                const initialSteps = {};
                DEFAULT_ETAPES.forEach(s => {
                    initialSteps[s.key] = {
                        name: s.name,
                        status: "upcoming"
                    };
                });
                db.ref(`${ROOT}/${activeSeason}/steps`).set(initialSteps);
                return;
            }

            renderStepsControl(data.steps);
            renderStepImportDropdown(data.steps);
        });
    }

    function renderStepsControl(steps) {
        stepsStatusList.innerHTML = "";
        
        // Tri selon l'ordre configuré
        const sorted = Object.entries(steps).sort((a, b) => {
            const stepA = DEFAULT_ETAPES.find(s => s.key === a[0]);
            const stepB = DEFAULT_ETAPES.find(s => s.key === b[0]);
            return (stepA?.order || 0) - (stepB?.order || 0);
        });

        sorted.forEach(([key, val]) => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.padding = "10px 0";
            div.style.borderBottom = "1px solid var(--border-color)";

            div.innerHTML = `
                <span style="font-weight: 600; font-size: 0.95rem;">${val.name}</span>
                <select data-key="${key}" class="step-status-modifier">
                    <option value="upcoming" ${val.status === 'upcoming' ? 'selected' : ''}>À venir</option>
                    <option value="ongoing" ${val.status === 'ongoing' ? 'selected' : ''}>En cours</option>
                    <option value="completed" ${val.status === 'completed' ? 'selected' : ''}>Terminée</option>
                </select>
            `;
            stepsStatusList.appendChild(div);
        });

        document.querySelectorAll(".step-status-modifier").forEach(sel => {
            sel.addEventListener("change", (e) => {
                const key = e.target.getAttribute("data-key");
                const newStatus = e.target.value;
                db.ref(`${ROOT}/${activeSeason}/steps/${key}/status`).set(newStatus);
            });
        });
    }

    function renderStepImportDropdown(steps) {
        const currentVal = importStepSelect.value;
        importStepSelect.innerHTML = "";

        const sorted = Object.entries(steps).sort((a, b) => {
            const stepA = DEFAULT_ETAPES.find(s => s.key === a[0]);
            const stepB = DEFAULT_ETAPES.find(s => s.key === b[0]);
            return (stepA?.order || 0) - (stepB?.order || 0);
        });

        sorted.forEach(([key, val]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = val.name;
            importStepSelect.appendChild(opt);
        });

        if (currentVal) importStepSelect.value = currentVal;
    }

    // 3. Import des données CSV d'ISISWEB avec détection automatique
    csvDropzone.addEventListener("click", () => csvFileInput.click());

    csvFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleCSVParse(file);
    });

    function handleCSVParse(file) {
        const stepKey = importStepSelect.value;
        if (!stepKey) {
            alert("Veuillez sélectionner une étape cible avant l'import.");
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const rows = results.data;
                let updates = {};
                let recordsCount = 0;

                rows.forEach(row => {
                    const licence = row['Licence']?.trim();
                    const epreuveRaw = row['Epreuve']?.trim();
                    const score = parseFloat(row['Total Séries']);

                    if (!licence || isNaN(score)) return;

                    // Détection dynamique de la discipline via config.js
                    const discipline = detectDiscipline(epreuveRaw);
                    if (!discipline) return; // Ignore les autres épreuves (ex: Arbalète)

                    const catCode = normalizeCategoryCode(row['Catégorie E']);
                    const basePath = `${ROOT}/${activeSeason}/shooters/licence_${licence}`;

                    updates[`${basePath}/licence`] = licence;
                    updates[`${basePath}/lastName`] = row['Nom']?.trim().toUpperCase();
                    updates[`${basePath}/firstName`] = row['Prenom']?.trim();
                    updates[`${basePath}/club`] = row['Association Nom']?.trim();
                    updates[`${basePath}/category`] = catCode;
                    updates[`${basePath}/results/${stepKey}/${discipline.key}`] = score;

                    recordsCount++;
                });

                if (recordsCount > 0) {
                    db.ref().update(updates)
                        .then(() => alert(`Importation réussie : ${recordsCount} scores enregistrés !`))
                        .catch(err => alert("Erreur d'écriture : " + err.message));
                } else {
                    alert("Aucune épreuve de tir correspondante au challenge n'a été détectée dans ce fichier.");
                }
            }
        });
    }

    btnReset.addEventListener("click", () => {
        if (confirm("Supprimer l'intégralité des résultats et tireurs de cette saison ? Action définitive !")) {
            db.ref(`${ROOT}/${activeSeason}/shooters`).remove()
                .then(() => alert("Données des tireurs réinitialisées."))
                .catch(err => alert("Erreur : " + err.message));
        }
    });
});