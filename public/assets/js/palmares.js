document.addEventListener("DOMContentLoaded", () => {
    const filterDiscipline = document.getElementById("filter-discipline");
    const filterCategory = document.getElementById("filter-category");
    const filterStep = document.getElementById("filter-step");
    const btnPDF = document.getElementById("btn-pdf");

    let allSteps = {};
    let shooters = {};

    // 1. Initialiser les sélecteurs HTML à partir de CONFIG.JS
    function initFiltersFromConfig() {
        filterDiscipline.innerHTML = "";
        DISCIPLINES.forEach(d => {
            filterDiscipline.innerHTML += `<option value="${d.key}">${d.label}</option>`;
        });
        filterDiscipline.innerHTML += `<option value="${COMBINE.key}">${COMBINE.label}</option>`;

        filterCategory.innerHTML = "";
        CATEGORIES.forEach(c => {
            filterCategory.innerHTML += `<option value="${c.code}">${c.label} (${c.code})</option>`;
        });
    }

    initFiltersFromConfig();

    // 2. Synchronisation avec Firebase
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

        // Récupérer les étapes de la base triées par ordre chronologique
        const sortedSteps = Object.entries(allSteps).sort((a, b) => {
            const stepA = DEFAULT_ETAPES.find(s => s.key === a[0]);
            const stepB = DEFAULT_ETAPES.find(s => s.key === b[0]);
            return (stepA?.order || 0) - (stepB?.order || 0);
        });

        sortedSteps.forEach(([key, step]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = step.name;
            filterStep.appendChild(opt);
        });

        const generalOpt = document.createElement("option");
        generalOpt.value = "general";
        generalOpt.textContent = "Classement Général (Moyennes)";
        filterStep.appendChild(generalOpt);

        if (currentVal) filterStep.value = currentVal;
    }

    // 3. Calculs et Affichage des Tableaux
    function renderRankings() {
        const disc = filterDiscipline.value;
        const cat = filterCategory.value;
        const targetStep = filterStep.value;

        const tableHeaders = document.getElementById("table-headers");
        const tableBody = document.getElementById("table-body");

        if (targetStep === "general") {
            tableHeaders.innerHTML = `
                <th style="width: 8%">Rg</th>
                <th>Nom Prénom</th>
                <th>Club / Association</th>
                <th style="text-align: center;">Tirs</th>
                <th style="text-align: right; width: 15%;">Moyenne</th>
            `;
        } else {
            tableHeaders.innerHTML = `
                <th style="width: 8%">Rg</th>
                <th style="width: 15%">Licence</th>
                <th>Nom Prénom</th>
                <th>Club / Association</th>
                <th style="text-align: right; width: 15%;">Score</th>
            `;
        }

        tableBody.innerHTML = "";
        const filteredList = Object.values(shooters).filter(s => normalizeCategoryCode(s.category) === cat);

        if (targetStep === "general") {
            // Moyenne générale dynamique
            const completedStepsKeys = Object.keys(allSteps).filter(k => allSteps[k].status === "completed" || allSteps[k].status === "ongoing");
            const completedCount = completedStepsKeys.length;

            const computed = filteredList.map(s => {
                let scores = [];
                completedStepsKeys.forEach(stepKey => {
                    if (s.results && s.results[stepKey] && s.results[stepKey][disc] !== undefined) {
                        scores.push(parseFloat(s.results[stepKey][disc]));
                    }
                });

                const participations = scores.length;
                let average = null;

                if (completedCount >= 3 && participations < 3) {
                    average = null; // Disqualifié du classement général (moins de 3 participations)
                } else if (participations > 0) {
                    scores.sort((a, b) => b - a);
                    if (completedCount <= 3) {
                        const sum = scores.reduce((acc, val) => acc + val, 0);
                        average = (sum / participations).toFixed(2);
                    } else {
                        const bestThree = scores.slice(0, 3);
                        const sum = bestThree.reduce((acc, val) => acc + val, 0);
                        average = (sum / 3).toFixed(2);
                    }
                }

                return {
                    name: `${s.lastName} ${s.firstName}`,
                    club: s.club,
                    participations: participations,
                    average: average
                };
            });

            // Tri par moyenne descendante
            computed.sort((a, b) => {
                if (a.average === null) return 1;
                if (b.average === null) return -1;
                return parseFloat(b.average) - parseFloat(a.average);
            });

            let rank = 1;
            computed.forEach(cs => {
                const tr = document.createElement("tr");
                const dispRank = cs.average !== null ? rank++ : "-";
                tr.innerHTML = `
                    <td><strong>${dispRank}</strong></td>
                    <td>${cs.name}</td>
                    <td>${cs.club}</td>
                    <td style="text-align: center;">${cs.participations} / ${completedCount}</td>
                    <td style="text-align: right;"><strong style="color: var(--primary);">${cs.average !== null ? cs.average : "Non Classé"}</strong></td>
                `;
                tableBody.appendChild(tr);
            });

            document.getElementById("pdf-subtitle").textContent = "Classement Général (Moyennes des 3 meilleures étapes)";
            document.getElementById("pdf-meta").textContent = `Discipline : ${disciplineByKey(disc).label} | Catégorie : ${categoryLabel(cat)}`;

        } else {
            // Classement d'étape simple
            const stepName = allSteps[targetStep]?.name || targetStep;
            
            const computed = filteredList.map(s => {
                const score = (s.results && s.results[targetStep]) ? s.results[targetStep][disc] : null;
                return {
                    licence: s.licence,
                    name: `${s.lastName} ${s.firstName}`,
                    club: s.club,
                    score: score !== undefined ? parseFloat(score) : null
                };
            }).filter(cs => cs.score !== null);

            computed.sort((a, b) => b.score - a.score);

            let rank = 1;
            computed.forEach(cs => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${rank++}</strong></td>
                    <td>${cs.licence}</td>
                    <td>${cs.name}</td>
                    <td>${cs.club}</td>
                    <td style="text-align: right;"><strong style="color: var(--success);">${cs.score}</strong></td>
                `;
                tableBody.appendChild(tr);
            });

            document.getElementById("pdf-subtitle").textContent = `${stepName}`;
            document.getElementById("pdf-meta").textContent = `Discipline : ${disciplineByKey(disc).label} | Catégorie : ${categoryLabel(cat)}`;
        }
    }

    filterDiscipline.addEventListener("change", renderRankings);
    filterCategory.addEventListener("change", renderRankings);
    filterStep.addEventListener("change", renderRankings);

    // 4. Génération PDF
    btnPDF.addEventListener("click", () => {
        const element = document.getElementById("palmares-print-zone");
        const filename = `EDT109_${filterStep.value}_${filterCategory.value}_${filterDiscipline.value}.pdf`;

        const opt = {
            margin: [10, 10, 15, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save();
    });
});