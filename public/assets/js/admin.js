document.addEventListener("DOMContentLoaded", () => {
    const loginZone = document.getElementById("login-zone");
    const adminPanel = document.getElementById("admin-panel");
    const btnLogin = document.getElementById("btn-login");
    const btnLogout = document.getElementById("btn-logout");
    const btnReset = document.getElementById("btn-reset");

    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");

    const stepsTableBody = document.getElementById("steps-table-body");
    const importStepSelect = document.getElementById("import-step-select");
    const shootersTableBody = document.getElementById("shooters-table-body");
    const searchShooter = document.getElementById("search-shooter");

    const csvDropzone = document.getElementById("csv-dropzone");
    const csvFileInput = document.getElementById("csv-file-input");

    let globalShooters = {};

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
        auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value).catch(err => alert(err.message));
    });

    btnLogout.addEventListener("click", () => auth.signOut());

    function loadAdminDashboard() {
        db.ref(`${ROOT}/${activeSeason}`).on("value", (snapshot) => {
            const data = snapshot.val();
            
            // Si la base est neuve, initialisation complète depuis config.js
            if (!data || !data.steps) {
                const initialSteps = {};
                DEFAULT_ETAPES.forEach(s => {
                    initialSteps[s.key] = { name: s.name, status: "upcoming", date: "", lieu: "" };
                });
                db.ref(`${ROOT}/${activeSeason}/steps`).set(initialSteps);
                return;
            }

            globalShooters = data.shooters || {};
            renderStepsTable(data.steps);
            renderImportDropdown(data.steps);
            renderShootersTable(globalShooters);
        });
    }

    function renderStepsTable(steps) {
        stepsTableBody.innerHTML = "";
        const sorted = Object.entries(steps).sort((a, b) => {
            return (DEFAULT_ETAPES.find(s => s.key === a[0])?.order || 0) - (DEFAULT_ETAPES.find(s => s.key === b[0])?.order || 0);
        });

        sorted.forEach(([key, val]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${val.name}</strong></td>
                <td><input type="text" class="step-date-input" data-key="${key}" value="${val.date || ''}" placeholder="Ex: 14/11/2026" style="width:110px; padding:4px;"></td>
                <td><input type="text" class="step-lieu-input" data-key="${key}" value="${val.lieu || ''}" placeholder="Club d'accueil" style="width:100%; padding:4px;"></td>
                <td>
                    <select class="step-status-select" data-key="${key}">
                        <option value="upcoming" ${val.status === 'upcoming' ? 'selected' : ''}>À venir</option>
                        <option value="ongoing" ${val.status === 'ongoing' ? 'selected' : ''}>En cours</option>
                        <option value="completed" ${val.status === 'completed' ? 'selected' : ''}>Terminée</option>
                    </select>
                </td>
            `;
            stepsTableBody.appendChild(tr);
        });

        // Événements d'enregistrement en direct
        document.querySelectorAll(".step-date-input").forEach(i => i.addEventListener("change", e => {
            db.ref(`${ROOT}/${activeSeason}/steps/${e.target.dataset.key}/date`).set(e.target.value);
        }));
        document.querySelectorAll(".step-lieu-input").forEach(i => i.addEventListener("change", e => {
            db.ref(`${ROOT}/${activeSeason}/steps/${e.target.dataset.key}/lieu`).set(e.target.value);
        }));
        document.querySelectorAll(".step-status-select").forEach(s => s.addEventListener("change", e => {
            db.ref(`${ROOT}/${activeSeason}/steps/${e.target.dataset.key}/status`).set(e.target.value);
        }));
    }

    function renderImportDropdown(steps) {
        const current = importStepSelect.value;
        importStepSelect.innerHTML = "";
        Object.entries(steps).forEach(([k, v]) => {
            const opt = document.createElement("option");
            opt.value = k; opt.textContent = v.name;
            importStepSelect.appendChild(opt);
        });
        if (current) importStepSelect.value = current;
    }

    function renderShootersTable(shooters, filterText = "") {
        shootersTableBody.innerHTML = "";
        const list = Object.values(shooters);
        
        const filtered = list.filter(s => {
            const search = filterText.toLowerCase();
            return s.lastName?.toLowerCase().includes(search) || s.firstName?.toLowerCase().includes(search) || s.licence?.includes(search);
        });

        if (filtered.length === 0) {
            shootersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucun tireur trouve en base de données.</td></tr>`;
            return;
        }

        filtered.forEach(s => {
            let scoresHTML = "";
            if (s.results) {
                let resultsList = [];
                Object.entries(s.results).forEach(([stepKey, disciplines]) => {
                    Object.entries(disciplines).forEach(([discKey, score]) => {
                        resultsList.push(`
                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; margin-bottom: 4px; font-size: 0.8rem;">
                                <span style="font-weight: 700; color: var(--primary);">${stepKey}</span>
                                <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">${discKey}</span>
                                <span style="font-weight: 700; color: var(--success);">${score} pts</span>
                            </div>
                        `);
                    });
                });
                scoresHTML = resultsList.join("");
            } else {
                scoresHTML = `<span style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">Aucun score</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${s.licence}</code></td>
                <td><strong style="text-transform: uppercase;">${s.lastName}</strong> ${s.firstName}</td>
                <td><span class="badge badge-primary">${s.category}</span></td>
                <td>${s.club}</td>
                <td>
                    <div style="max-height: 120px; overflow-y: auto; padding-right: 4px;">
                        ${scoresHTML}
                    </div>
                </td>
            `;
            shootersTableBody.appendChild(tr);
        });
    }

    searchShooter.addEventListener("input", (e) => renderShootersTable(globalShooters, e.target.value));

    // Import CSV
    csvDropzone.addEventListener("click", () => csvFileInput.click());
    csvFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const stepKey = importStepSelect.value;
            Papa.parse(file, {
                header: true, skipEmptyLines: true,
                complete: function(results) {
                    let updates = {}; let count = 0;
                    results.data.forEach(row => {
                        const licence = row['Licence']?.trim();
                        const epreuveRaw = row['Epreuve']?.trim();
                        const score = parseFloat(row['Total Séries']);
                        if (!licence || isNaN(score)) return;

                        const discipline = detectDiscipline(epreuveRaw);
                        if (!discipline) return;

                        const catCode = normalizeCategoryCode(row['Catégorie E']);
                        const basePath = `${ROOT}/${activeSeason}/shooters/licence_${licence}`;

                        updates[`${basePath}/licence`] = licence;
                        updates[`${basePath}/lastName`] = row['Nom']?.trim().toUpperCase();
                        updates[`${basePath}/firstName`] = row['Prenom']?.trim();
                        updates[`${basePath}/club`] = row['Association Nom']?.trim();
                        updates[`${basePath}/category`] = catCode;
                        updates[`${basePath}/results/${stepKey}/${discipline.key}`] = score;
                        count++;
                    });

                    if (count > 0) {
                        db.ref().update(updates).then(() => alert(`Importation réussie : ${count} fiches traitées.`));
                    } else {
                        alert("Erreur : Aucun score valide trouvé pour le challenge dans ce fichier.");
                    }
                }
            });
        }
    });

    btnReset.addEventListener("click", () => {
        if (confirm("Vider complètement la liste des tireurs ?")) {
            db.ref(`${ROOT}/${activeSeason}/shooters`).remove();
        }
    });
});