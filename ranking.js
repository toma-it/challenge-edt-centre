/* ======================================================================
   RANKING.JS — Logique de classement partagée par les pages d'affichage,
   de palmarès et d'administration.
   ====================================================================== */

// Un tireur "a un résultat exploitable" pour tous les statuts sauf DNS/DSQ.
function hasResult(status) { return status !== "DNS" && status !== "DSQ"; }

// Tri d'une liste de tireurs d'UNE étape / UNE discipline / UNE catégorie,
// selon les règles du règlement (score, puis mouches, puis dernières séries).
function sortShooters(list) {
    return [...list].sort((a, b) => {
        const sa = a.status || "OK", sb = b.status || "OK";
        const exA = (sa === "DNS" || sa === "DSQ");
        const exB = (sb === "DNS" || sb === "DSQ");
        if (exA && !exB) return 1;
        if (!exA && exB) return -1;

        const scoreA = a.score || 0, scoreB = b.score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const mA = a.mouches || 0, mB = b.mouches || 0;
        if (mB !== mA) return mB - mA;

        const serA = a.series || [], serB = b.series || [];
        const max = Math.max(serA.length, serB.length);
        for (let k = max - 1; k >= 0; k--) {
            const va = serA[k] || 0, vb = serB[k] || 0;
            if (vb !== va) return vb - va;
        }
        return 0;
    });
}

// Attribue les places affichées (1,2,3...) en respectant la règle :
// seuls les tireurs "OK" comptent pour la numérotation ; DNF/HM gardent
// leur position naturelle sans "consommer" de rang.
function assignRanks(sorted) {
    let rank = 1;
    return sorted.map(s => {
        const status = s.status || "OK";
        const takesRank = (status === "OK");
        const displayRank = takesRank ? rank : status;
        if (takesRank) rank++;
        return { ...s, displayRank };
    });
}

// Regroupe une liste de tireurs (shooters d'une étape) par catégorie.
function groupByCategory(shooters) {
    const tree = {};
    shooters.forEach(s => {
        const cat = normalizeCategoryCode(s.category);
        if (!tree[cat]) tree[cat] = [];
        tree[cat].push(s);
    });
    return tree;
}

// Calcule, pour une étape donnée, les scores "Combiné EDT" (150/154) :
// un tireur avec un score Pistolet ET un score Carabine (statut OK) dans
// la même étape obtient un score combiné = somme des deux totaux.
function computeCombineForEtape(shootersByDiscipline) {
    // shootersByDiscipline = { pistolet: [...], carabine: [...] }
    const pistolet = shootersByDiscipline.pistolet || [];
    const carabine = shootersByDiscipline.carabine || [];
    const byLicence = {};
    pistolet.forEach(s => {
        if (!s.licence || (s.status || "OK") !== "OK") return;
        byLicence[s.licence] = byLicence[s.licence] || {};
        byLicence[s.licence].pistolet = s;
    });
    carabine.forEach(s => {
        if (!s.licence || (s.status || "OK") !== "OK") return;
        byLicence[s.licence] = byLicence[s.licence] || {};
        byLicence[s.licence].carabine = s;
    });
    const combined = [];
    Object.keys(byLicence).forEach(lic => {
        const pair = byLicence[lic];
        if (pair.pistolet && pair.carabine) {
            combined.push({
                licence: lic,
                lastName: pair.pistolet.lastName,
                firstName: pair.pistolet.firstName,
                club: pair.pistolet.club,
                category: pair.pistolet.category,
                status: "OK",
                score: Math.round(((pair.pistolet.score || 0) + (pair.carabine.score || 0)) * 10) / 10,
                pistoletScore: pair.pistolet.score || 0,
                carabineScore: pair.carabine.score || 0
            });
        }
    });
    return combined;
}

// Construit le classement général d'une saison pour une discipline donnée
// (pistolet / carabine / combine), à partir des étapes "etape" (E1..E6,
// la Finale est exclue du classement général du challenge).
// etapesData = [{ key, order, name, shootersRaw }] déjà triées par ordre.
// Retourne : { [catCode]: [ { licence, lastName, firstName, club, scoresByEtape:[...], best3Avg, nbParticipations } ] }
function buildGeneralRanking(etapesData, disciplineKey) {
    const perLicence = {}; // licence -> { info, scores: { etapeKey: score|null } }

    etapesData.forEach(etape => {
        let list;
        if (disciplineKey === COMBINE.key) {
            list = computeCombineForEtape(etape.shootersRaw);
        } else {
            list = (etape.shootersRaw[disciplineKey] || []).filter(s => (s.status || "OK") === "OK");
        }
        list.forEach(s => {
            if (!s.licence) return;
            if (!perLicence[s.licence]) {
                perLicence[s.licence] = {
                    licence: s.licence, lastName: s.lastName, firstName: s.firstName,
                    club: s.club, category: normalizeCategoryCode(s.category),
                    scores: {}
                };
            }
            perLicence[s.licence].scores[etape.key] = s.score || 0;
            // Toujours garder les infos les plus récentes (club/catégorie peuvent
            // évoluer d'une étape à l'autre).
            perLicence[s.licence].lastName = s.lastName;
            perLicence[s.licence].firstName = s.firstName;
            perLicence[s.licence].club = s.club;
            perLicence[s.licence].category = normalizeCategoryCode(s.category);
        });
    });

    const result = {};
    Object.values(perLicence).forEach(entry => {
        const scoresByEtape = etapesData.map(e => (entry.scores[e.key] !== undefined ? entry.scores[e.key] : null));
        const validScores = scoresByEtape.filter(v => v !== null);
        const nbParticipations = validScores.length;
        const best3 = [...validScores].sort((a, b) => b - a).slice(0, 3);
        const best3Avg = best3.length ? Math.round((best3.reduce((a, b) => a + b, 0) / best3.length) * 100) / 100 : null;

        const row = {
            licence: entry.licence, lastName: entry.lastName, firstName: entry.firstName,
            club: entry.club, category: entry.category,
            scoresByEtape, nbParticipations, best3Avg,
            classe: nbParticipations >= 3
        };
        if (!result[entry.category]) result[entry.category] = [];
        result[entry.category].push(row);
    });

    // Tri : classés (>=3 manches) d'abord par moyenne décroissante, puis
    // non-classés ensuite par moyenne décroissante.
    Object.keys(result).forEach(cat => {
        result[cat].sort((a, b) => {
            if (a.classe !== b.classe) return a.classe ? -1 : 1;
            const av = a.best3Avg || 0, bv = b.best3Avg || 0;
            return bv - av;
        });
    });

    return result;
}