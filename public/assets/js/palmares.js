/**
 * Calcule la moyenne des scores d'un tireur pour une discipline donnée.
 * @param {Object} shooterResults - Objet contenant les résultats par étape
 * @param {string} discipline - 'carabine' ou 'pistolet' ou 'combiné'
 * @param {number} currentStepCount - Nombre d'étapes actuellement disputées
 * @returns {number|string} Moyenne calculée (arrondie à 2 décimales) ou '-' si non classé
 */
function calculateGeneralAverage(shooterResults, discipline, currentStepCount) {
    let scores = [];
    
    // 1. Collecter tous les scores existants pour la discipline
    for (const stepKey in shooterResults) {
        const stepData = shooterResults[stepKey];
        if (stepData && stepData[discipline] !== undefined && stepData[discipline] !== null) {
            scores.push(parseFloat(stepData[discipline]));
        }
    }

    const participations = scores.length;
    
    // Condition de participation minimale :
    // Une fois la saison finie, il faut au moins 3 participations pour figurer au classement général final.
    if (currentStepCount >= 3 && participations < 3) {
        return '-'; 
    }

    if (participations === 0) return '-';

    // 2. Trier les scores du meilleur au moins bon
    scores.sort((a, b) => b - a);

    // 3. Appliquer la règle de calcul de la moyenne
    if (currentStepCount <= 3) {
        // Moins de 3 étapes disputées : on fait la moyenne de toutes ses participations (1, 2 ou 3)[cite: 1].
        const sum = scores.reduce((acc, val) => acc + val, 0);
        return (sum / participations).toFixed(2);
    } else {
        // Au-delà de l'étape 3 : on prend strictement les 3 meilleurs scores[cite: 1].
        const bestThree = scores.slice(0, 3);
        const sum = bestThree.reduce((acc, val) => acc + val, 0);
        return (sum / 3).toFixed(2);
    }
}