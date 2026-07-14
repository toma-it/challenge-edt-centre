document.addEventListener("DOMContentLoaded", () => {
    const filterDiscipline = document.getElementById("filter-discipline");
    const filterCategory = document.getElementById("filter-category");
    const filterStep = document.getElementById("filter-step");
    const btnPDF = document.getElementById("btn-pdf");

    let allSteps = {};
    let shooters = {};

    function initFilters() {
        filterDiscipline.innerHTML = '<option value="all">Toutes les epreuves</option>';
        DISCIPLINES.forEach(d => {
            filterDiscipline.innerHTML += `<option value="${d.key}">${d.label}</option>`;
        });
        filterDiscipline.innerHTML += `<option value="${COMBINE.key}">${COMBINE.label}</option>`;

        filterCategory.innerHTML = "";
        CATEGORIES.forEach(c => {
            filterCategory.innerHTML += `<option value="${c.code}">${c.label} (${c.code})</option>`;
        });
    }

    initFilters();

    db.ref(`${ROOT}/${activeSeason}`).on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        allSteps = data.steps || {};
        shooters = data.shooters || {};

        buildStepDropdown();
        renderRankings();
    });

    function buildStepDropdown() {
        const currentVal = filterStep.value;
        filterStep.innerHTML = "";

        const sortedSteps = Object.entries(allSteps).sort((a, b) => {
            return (DEFAULT_ETAPES.find(s => s.key === a[0])?.order || 0) - (DEFAULT_ETAPES.find(s => s.key === b[0])?.order || 0);
        });

        sortedSteps.forEach(([key, step]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = step.name;
            filterStep.appendChild(opt);
        });

        const generalOpt = document.createElement("option");
        generalOpt.value = "general";
        generalOpt.textContent = "Classement General (Moyennes)";
        filterStep.appendChild(generalOpt);

        if (currentVal) filterStep.value = currentVal;
    }

    function renderRankings() {
        const disc = filterDiscipline.value;
        const cat = filterCategory.value;
        const targetStep = filterStep.value;

        const tableHeaders = document.getElementById("table-headers");
        const tableBody = document.getElementById("table-body");

        const sortedStepsKeys = Object.keys(allSteps).sort((a, b) => {
            return (DEFAULT_ETAPES.find(s => s.key === a)?.order || 0) - (DEFAULT_ETAPES.find(s => s.key === b)?.order || 0);
        });

        tableBody.innerHTML = "";

        if (targetStep === "general") {
            // Classement General dynamique : construction des colonnes d'etapes
            let headersHTML = `
                <th style="width: 5%">Rg</th>
                <th>Nom Prenom</th>
            `;
            if (disc === "all") {
                headersHTML += `<th>Epreuve</th>`;
            }
            headersHTML += `<th>Club / Association</th>`;
            
            sortedStepsKeys.forEach(stepKey => {
                headersHTML += `<th style="text-align: center; width: 6%;">${stepKey}</th>`;
            });
            headersHTML += `<th style="text-align: right; width: 10%;">Moyenne</th>`;
            tableHeaders.innerHTML = headersHTML;

            const completedStepsKeys = Object.keys(allSteps).filter(k => allSteps[k].status === "completed" || allSteps[k].status === "ongoing");
            const completedCount = completedStepsKeys.length;

            let list = [];
            Object.values(shooters).forEach(s => {
                if (normalizeCategoryCode(s.category) !== cat) return;

                let discsToProcess = (disc === "all") ? [...DISCIPLINES.map(d => d.key), COMBINE.key] : [disc];

                discsToProcess.forEach(dKey => {
                    let scores = [];
                    let stepScores = {};

                    sortedStepsKeys.forEach(stepKey => {
                        if (s.results && s.results[stepKey] && s.results[stepKey][dKey] !== undefined && s.results[stepKey][dKey] !== null) {
                            const sc = parseFloat(s.results[stepKey][dKey]);
                            if (!isNaN(sc)) {
                                scores.push(sc);
                                stepScores[stepKey] = sc;
                            }
                        }
                    });

                    const participations = scores.length;
                    if (participations === 0) return; // Ne pas afficher si aucun score n'existe

                    let average = null;
                    if (completedCount >= 3 && participations < 3) {
                        average = null; // Non classe (moins de 3 tirs alors qu'au moins 3 etapes ont debute)
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

                    list.push({
                        name: `${s.lastName} ${s.firstName}`,
                        club: s.club,
                        disciplineKey: dKey,
                        stepScores: stepScores,
                        participations: participations,
                        average: average
                    });
                });
            });

            // Tri : Classés d'abord par moyenne decroissante, puis non-classes par nombre de tirs
            list.sort((a, b) => {
                if (a.average === null && b.average !== null) return 1;
                if (a.average !== null && b.average === null) return -1;
                if (a.average !== null && b.average !== null) {
                    return parseFloat(b.average) - parseFloat(a.average);
                }
                return b.participations - a.participations;
            });

            let rank = 1;
            list.forEach(item => {
                const tr = document.createElement("tr");
                const dispRank = item.average !== null ? rank++ : "-";
                
                let rowHTML = `
                    <td><strong>${dispRank}</strong></td>
                    <td style="text-transform: uppercase; font-weight: 600;">${item.name}</td>
                `;
                if (disc === "all") {
                    rowHTML += `<td><span class="badge badge-primary">${disciplineByKey(item.disciplineKey).label}</span></td>`;
                }
                rowHTML += `<td>${item.club}</td>`;
                
                sortedStepsKeys.forEach(stepKey => {
                    const sc = item.stepScores[stepKey];
                    rowHTML += `<td style="text-align: center; color: var(--text-muted);">${sc !== undefined ? sc : "-"}</td>`;
                });

                rowHTML += `<td style="text-align: right;"><strong style="color: var(--primary);">${item.average !== null ? item.average : "Non Classe"}</strong></td>`;
                tr.innerHTML = rowHTML;
                tableBody.appendChild(tr);
            });

            document.getElementById("pdf-subtitle").textContent = "Classement General Intermediaire (3 meilleures performances)";
            const discLabel = disc === "all" ? "Toutes les epreuves" : disciplineByKey(disc).label;
            document.getElementById("pdf-meta").textContent = `Discipline : ${discLabel} | Categorie : ${categoryLabel(cat)}`;

        } else {
            // Classement d'une Etape specifique
            let headersHTML = `
                <th style="width: 8%">Rg</th>
                <th style="width: 15%">Licence</th>
                <th>Nom Prenom</th>
            `;
            if (disc === "all") {
                headersHTML += `<th>Epreuve</th>`;
            }
            headersHTML += `
                <th>Club / Association</th>
                <th style="text-align: right; width: 15%;">Score</th>
            `;
            tableHeaders.innerHTML = headersHTML;

            const stepObj = allSteps[targetStep] || {};
            let list = [];

            Object.values(shooters).forEach(s => {
                if (normalizeCategoryCode(s.category) !== cat) return;

                let discsToProcess = (disc === "all") ? [...DISCIPLINES.map(d => d.key), COMBINE.key] : [disc];

                discsToProcess.forEach(dKey => {
                    const score = (s.results && s.results[targetStep]) ? s.results[targetStep][dKey] : null;
                    if (score !== null && score !== undefined && !isNaN(parseFloat(score))) {
                        list.push({
                            licence: s.licence,
                            name: `${s.lastName} ${s.firstName}`,
                            club: s.club,
                            disciplineKey: dKey,
                            score: parseFloat(score)
                        });
                    }
                });
            });

            list.sort((a, b) => b.score - a.score);

            let rank = 1;
            list.forEach(item => {
                const tr = document.createElement("tr");
                let rowHTML = `
                    <td><strong>${rank++}</strong></td>
                    <td><code>${item.licence}</code></td>
                    <td style="text-transform: uppercase; font-weight: 600;">${item.name}</td>
                `;
                if (disc === "all") {
                    rowHTML += `<td><span class="badge badge-primary">${disciplineByKey(item.disciplineKey).label}</span></td>`;
                }
                rowHTML += `
                    <td>${item.club}</td>
                    <td style="text-align: right;"><strong style="color: var(--success);">${item.score}</strong></td>
                `;
                tr.innerHTML = rowHTML;
                tableBody.appendChild(tr);
            });

            let locationDetails = stepObj.name || targetStep;
            if (stepObj.lieu || stepObj.date) {
                locationDetails += ` (${stepObj.lieu || ''} - ${stepObj.date || ''})`;
            }

            document.getElementById("pdf-subtitle").textContent = locationDetails;
            const discLabel = disc === "all" ? "Toutes les epreuves" : disciplineByKey(disc).label;
            document.getElementById("pdf-meta").textContent = `Discipline : ${discLabel} | Categorie : ${categoryLabel(cat)}`;
        }
    }

    filterDiscipline.addEventListener("change", renderRankings);
    filterCategory.addEventListener("change", renderRankings);
    filterStep.addEventListener("change", renderRankings);

    btnPDF.addEventListener("click", () => {
        const element = document.getElementById("palmares-print-zone");
        const filename = `EDT109_${filterStep.value}_${filterCategory.value}.pdf`;
        html2pdf().set({
            margin: [10, 10, 15, 10], filename: filename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(element).save();
    });
});