document.addEventListener("DOMContentLoaded", () => {
    const filterDiscipline = document.getElementById("filter-discipline");
    const filterCategory = document.getElementById("filter-category");
    const filterStep = document.getElementById("filter-step");
    const btnPDF = document.getElementById("btn-pdf");
    const tablesContainer = document.getElementById("dynamic-tables-container");

    let allSteps = {};
    let shooters = {};

    function initFilters() {
        filterDiscipline.innerHTML = '<option value="all">Toutes les épreuves</option>';
        DISCIPLINES.forEach(d => {
            filterDiscipline.innerHTML += `<option value="${d.key}">${d.label}</option>`;
        });
        filterDiscipline.innerHTML += `<option value="${COMBINE.key}">${COMBINE.label}</option>`;

        filterCategory.innerHTML = '<option value="all">Toutes les catégories</option>';
        CATEGORIES.forEach(c => {
            filterCategory.innerHTML += `<option value="${c.code}">${c.label} (${c.code})</option>`;
        });
    }

    initFilters();

    if (db) {
        db.ref(`${ROOT}/${activeSeason}`).on("value", (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            allSteps = data.steps || {};
            shooters = data.shooters || {};
            buildStepDropdown();
            renderRankings();
        });
    }

    function buildStepDropdown() {
        const currentVal = filterStep.value;
        filterStep.innerHTML = "";
        const sortedSteps = Object.entries(allSteps).sort((a, b) => {
            return (DEFAULT_ETAPES.find(s => s.key === a[0])?.order || 0) - (DEFAULT_ETAPES.find(s => s.key === b[0])?.order || 0);
        });
        sortedSteps.forEach(([key, step]) => {
            const opt = document.createElement("option");
            opt.value = key; opt.textContent = step.name;
            filterStep.appendChild(opt);
        });
        const generalOpt = document.createElement("option");
        generalOpt.value = "general";
        generalOpt.textContent = "Classement Général (Moyennes)";
        filterStep.appendChild(generalOpt);

        if (currentVal) filterStep.value = currentVal;
    }

    function renderRankings() {
        const tablesContainer = document.getElementById("dynamic-tables-container");
        
        // Sécurité active : si le conteneur n'existe pas sur la page, on stoppe proprement sans crash
        if (!tablesContainer) {
            console.warn("Le conteneur 'dynamic-tables-container' est absent de cette page. Rendu annulé.");
            return;
        }

        tablesContainer.innerHTML = "";
        const selDisc = filterDiscipline.value;
        const selCat = filterCategory.value;
        const targetStep = filterStep.value;

        const disciplineKeysToRender = (selDisc === "all") ? [...DISCIPLINES.map(d => d.key), COMBINE.key] : [selDisc];
        const categoryCodesToRender = (selCat === "all") ? CATEGORIES.map(c => c.code) : [selCat];

        // Mise à jour sécurisée des textes de l'en-tête PDF
        const stepObj = allSteps[targetStep] || {};
        let headerSub = targetStep === "general" ? "Classement Général Intermédiaire (3 meilleurs scores)" : stepObj.name;
        if (targetStep !== "general" && (stepObj.lieu || stepObj.date)) {
            headerSub += ` (${stepObj.lieu || ''} - ${stepObj.date || ''})`;
        }

        const pdfSubtitle = document.getElementById("pdf-subtitle");
        const pdfMeta = document.getElementById("pdf-meta");

        if (pdfSubtitle) {
            pdfSubtitle.textContent = headerSub;
        }
        if (pdfMeta) {
            const discLabel = selDisc === "all" ? "Toutes" : disciplineByKey(selDisc).label;
            const catLabel = selCat === "all" ? "Toutes" : categoryLabel(selCat);
            pdfMeta.textContent = `Épreuve : ${discLabel} | Catégorie : ${catLabel}`;
        }

        // Génération successive ordonnée par épreuve puis catégorie
        disciplineKeysToRender.forEach(discKey => {
            categoryCodesToRender.forEach(catCode => {
                const tableHTML = generateTableMarkup(targetStep, discKey, catCode);
                if (tableHTML) {
                    tablesContainer.innerHTML += tableHTML;
                }
            });
        });

        if (tablesContainer.innerHTML === "") {
            tablesContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:3rem; font-style:italic;">Aucun résultat enregistré pour cette sélection.</div>`;
        }
    }

    function generateTableMarkup(stepKey, discKey, catCode) {
        const list = Object.values(shooters).filter(s => normalizeCategoryCode(s.category) === catCode);
        const sortedStepsKeys = Object.keys(allSteps).sort((a, b) => {
            return (DEFAULT_ETAPES.find(s => s.key === a)?.order || 0) - (DEFAULT_ETAPES.find(s => s.key === b)?.order || 0);
        });

        if (stepKey === "general") {
            const completedSteps = Object.keys(allSteps).filter(k => allSteps[k].status === "completed" || allSteps[k].status === "ongoing");
            const completedCount = completedSteps.length;

            let records = [];
            list.forEach(s => {
                let scores = [];
                let stepScores = {};
                sortedStepsKeys.forEach(sk => {
                    let scoreVal = null;
                    scoreVal = (s.results && s.results[sk]) ? parseFloat(s.results[sk][discKey]) : null;
                    if (scoreVal !== null && !isNaN(scoreVal)) {
                        scores.push(scoreVal);
                        stepScores[sk] = scoreVal;
                    }
                });

                const participations = scores.length;
                if (participations === 0) return;

                let average = null;
                if (completedCount >= 3 && participations < 3) {
                    average = null;
                } else if (participations > 0) {
                    const sortedScores = [...scores].sort((a, b) => b - a);
                    if (completedCount <= 3) {
                        const sum = sortedScores.reduce((acc, val) => acc + val, 0);
                        average = (sum / participations).toFixed(2);
                    } else {
                        const bestThree = sortedScores.slice(0, 3);
                        const sum = bestThree.reduce((acc, val) => acc + val, 0);
                        average = (sum / 3).toFixed(2);
                    }
                }

                records.push({
                    name: `${s.lastName} ${s.firstName}`, club: s.club, stepScores: stepScores, participations: participations, average: average
                });
            });

            if (records.length === 0) return null;

            records.sort((a, b) => {
                if (a.average === null) return 1; if (b.average === null) return -1;
                if (a.average !== null && b.average !== null) return parseFloat(b.average) - parseFloat(a.average);
                return b.participations - a.participations;
            });

            let stepsHeaders = sortedStepsKeys.map(sk => `<th style="text-align: center; width: 6%; font-size:0.75rem;">${sk}</th>`).join("");

            let rowsHTML = "";
            let rank = 1;
            records.forEach(r => {
                const dispRank = r.average !== null ? rank++ : "-";
                let stepCells = sortedStepsKeys.map(sk => {
                    const sc = r.stepScores[sk];
                    return `<td style="text-align: center; font-size:0.85rem; color: var(--text-muted);">${sc !== undefined ? sc : "-"}</td>`;
                }).join("");

                rowsHTML += `
                    <tr>
                        <td><strong>${dispRank}</strong></td>
                        <td style="text-transform: uppercase; font-weight: 600;">${r.name}</td>
                        <td style="font-size:0.85rem;">${r.club}</td>
                        ${stepCells}
                        <td style="text-align: right;"><strong style="color: var(--primary);">${r.average !== null ? r.average : "Non Classé"}</strong></td>
                    </tr>
                `;
            });

            return `
                <div style="margin-top: 1.5rem; margin-bottom: 2rem;">
                    <h4 style="color: var(--primary); font-size: 1.1rem; border-left: 4px solid var(--accent); padding-left: 0.75rem; margin-bottom: 0.75rem; font-weight: 700; text-transform: uppercase;">
                        ${disciplineByKey(discKey).label} — ${categoryLabel(catCode)}
                    </h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 5%">Rg</th>
                                    <th style="width: 25%">Tireur</th>
                                    <th>Association</th>
                                    ${stepsHeaders}
                                    <th style="text-align: right; width: 10%;">Moyenne</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>
                </div>
            `;

        } else {
            // Classement d'Étape classique
            let records = [];
            list.forEach(s => {
                const score = (s.results && s.results[stepKey]) ? parseFloat(s.results[stepKey][discKey]) : null;
                if (score !== null && !isNaN(score)) {
                    records.push({
                        name: `${s.lastName} ${s.firstName}`, club: s.club, score: score
                    });
                }
            });

            if (records.length === 0) return null;

            // Règle de tri
            records.sort((a, b) => b.score - a.score);

            let rowsHTML = "";
            let rank = 1;

            records.forEach(r => {
                rowsHTML += `
                    <tr>
                        <td><strong>${rank++}</strong></td>
                        <td style="text-transform: uppercase; font-weight: 600;">${r.name}</td>
                        <td style="font-size:0.85rem;">${r.club}</td>
                        <td style="text-align: right; font-weight: 700; color: var(--success);">${r.score}</td>
                    </tr>
                `;
            });

            let headersHTML = "";
            headersHTML = `
                <th style="width: 8%">Rg</th>
                <th style="width: 35%">Tireur</th>
                <th>Association</th>
                <th style="text-align: right; width: 15%">Score</th>
            `;
            
            return `
                <div style="margin-top: 1.5rem; margin-bottom: 2rem;">
                    <h4 style="color: var(--primary); font-size: 1.1rem; border-left: 4px solid var(--accent); padding-left: 0.75rem; margin-bottom: 0.75rem; font-weight: 700; text-transform: uppercase;">
                        ${disciplineByKey(discKey).label} — ${categoryLabel(catCode)}
                    </h4>
                    <div class="table-container">
                        <table>
                            <thead><tr>${headersHTML}</tr></thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    filterDiscipline.addEventListener("change", renderRankings);
    filterCategory.addEventListener("change", renderRankings);
    filterStep.addEventListener("change", renderRankings);

    btnPDF.addEventListener("click", () => {
        const element = document.getElementById("palmares-print-zone");
        const filename = `EDT109_${filterStep.value}_${filterCategory.value}.pdf`;
        html2pdf().set({
            margin: [15, 15, 15, 15], filename: filename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(element).save();
    });
});