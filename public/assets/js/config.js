/* ======================================================================
   CONFIG.JS — Fichier UNIQUE à modifier pour configurer le projet.
   Toutes les pages (admin, saisie, affichage, palmarès) chargent ce
   fichier : il suffit donc de remplir les valeurs ci-dessous UNE SEULE
   FOIS pour que tout le site soit configuré.
   ====================================================================== */

const CONFIG = {
  // Nom complet du challenge, affiché en en-tête des pages publiques et
  // dans les PDF générés (classement général).
  challengeName: "Challenge Régional des Écoles de Tir « La Relève au 10.9 »",

  // Nom de la Ligue, affiché à côté du logo.
  ligueName: "LIGUE CENTRE-VAL DE LOIRE",

  // Adresse de base du site une fois publié sur GitHub Pages
  // (sert à générer les QR codes). Ex : "https://moncompte.github.io/challenge-edt-centre"
  githubBase: "https://toma-it.github.io/challenge-edt-centre",

  firebase: {
    apiKey: "AIzaSyDA3ZkdOXRlHTwl_-3ZCzlkFtxIU3XbOos",
    authDomain: "resultats-challengedt-centre.firebaseapp.com",
    databaseURL: "https://resultats-challengedt-centre-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "resultats-challengedt-centre",
    storageBucket: "resultats-challengedt-centre.firebasestorage.app",
    messagingSenderId: "26383943096",
    appId: "1:26383943096:web:5f390790431837c957fb4d"
  },
};

// ─── Initialisation Firebase (ne rien modifier en dessous) ───────────────
firebase.initializeApp(CONFIG.firebase);
const db = firebase.database();
const auth = firebase.auth();
const ROOT = 'seasons';
const activeSeason = "2026_2027";

// ─── Catégories d'âge gérées par le règlement École de Tir ───────────────
const CATEGORIES = [
  { code: "PF", label: "Poussines" },
  { code: "PG", label: "Poussins" },
  { code: "BF", label: "Benjamines" },
  { code: "BG", label: "Benjamins" },
  { code: "MF", label: "Minimes Filles" },
  { code: "MG", label: "Minimes Garçons" }
];
function categoryLabel(code) {
  const c = CATEGORIES.find(c => c.code === (code || '').toUpperCase());
  return c ? c.label : (code || 'Catégorie inconnue');
}

// ─── Disciplines du programme (École de Tir, épreuves 150 / 154) ─────────
// "key" = identifiant technique utilisé dans la base de données.
const DISCIPLINES = [
  { code: "150", key: "pistolet", label: "Pistolet 10 mètres Écoles de Tir", series: 4 },
  { code: "154", key: "carabine", label: "Carabine 10 mètres Écoles de Tir", series: 4 }
];
const COMBINE = { code: "150/154", key: "combine", label: "Combiné EDT (150/154)" };

function disciplineByKey(key) { 
  if (key === COMBINE.key) return COMBINE;
  return DISCIPLINES.find(d => d.key === key); 
}

// Reconnaît la discipline à partir du libellé "EPREUVE" d'un CSV ISISWEB
// (ex : "150 - Pistolet 10 mètres Ecoles de Tir" → pistolet)
function detectDiscipline(epreuveRaw) {
  const code = (epreuveRaw || '').trim().split(/[\s-]/)[0];
  if (code.startsWith(COMBINE.code)) return COMBINE;
  return DISCIPLINES.find(d => d.code === code) || null;
}

// Normalisation des codes catégories bruts ISISWEB (déjà au bon format ici,
// mais on nettoie les espaces/majuscules par sécurité).
function normalizeCategoryCode(raw) {
  return (raw || '').trim().toUpperCase();
}

// ─── Étapes par défaut proposées à la création d'une saison ──────────────
const DEFAULT_ETAPES = [
  { key: "E1", order: 1, name: "Étape 1", type: "etape" },
  { key: "E2", order: 2, name: "Étape 2", type: "etape" },
  { key: "E3", order: 3, name: "Étape 3", type: "etape" },
  { key: "E4", order: 4, name: "Étape 4", type: "etape" },
  { key: "E5", order: 5, name: "Étape 5", type: "etape" },
  { key: "E6", order: 6, name: "Étape 6", type: "etape" },
  { key: "FINALE", order: 7, name: "Finale régionale", type: "finale" }
];