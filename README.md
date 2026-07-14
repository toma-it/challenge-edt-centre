# Challenge Régional des Écoles de Tir — « La Relève au 10.9 »

Application web de gestion et de consultation du **Challenge Régional des Écoles de Tir** de la Ligue Centre-Val de Loire : 6 étapes départementales (octobre à avril) + une Finale régionale (juin), avec classement en direct par étape, palmarès général sur la saison (moyenne des 3 meilleurs scores) et classement Combiné (150/154).

Projet indépendant, construit sur le même principe que le site « Résultats en Direct » de la Ligue (Firebase Realtime Database + Firebase Authentication, hébergement statique GitHub Pages), mais avec une structure de données dédiée à un challenge multi-étapes et multi-saisons.

## Structure du projet

| Fichier | Rôle |
|---|---|
| `config.js` | **Fichier unique à configurer** (clés Firebase, nom du challenge, catégories, disciplines). Chargé par toutes les pages. |
| `ranking.js` | Logique de classement partagée (tri, places, moyenne des 3 meilleurs scores, calcul automatique du Combiné). |
| `common.css` | Style visuel commun à toutes les pages. |
| `index_admin.html` | Tableau de bord admin : création des saisons, des 6 étapes + Finale, dépôt des PDF ISISWEB, génération des QR codes. Protégé par Firebase Authentication. |
| `saisie.html` | Saisie et import CSV ISISWEB par étape (Pistolet / Carabine), corrections manuelles, statuts (DNS/DSQ/DNF/HM). Pour la Finale : bascule Qualification / Top 8. Protégé par authentification. |
| `affichage_etape.html` | Page publique d'affichage en direct des résultats d'une étape (Pistolet, Carabine, Combiné calculé automatiquement). |
| `affichage_finale.html` | Page publique dédiée à la Finale : Qualification du matin puis Top 8 de l'après-midi. |
| `palmares.html` | Page publique : classement par étape, classement général de la saison (moyenne des 3 meilleurs scores), classement général Combiné, export PDF (impression navigateur). |
| `database.rules.json` | Règles de sécurité Firebase Realtime Database. |
| `logo.png` | Logo de la Ligue (déjà fourni). |

## Fonctionnement général

### Modèle de données (Firebase Realtime Database)

```
seasons/
  └─ 2026-2027/                     → une saison = un dossier (permet de garder l'historique)
       ├─ config/                    → { label, active }
       └─ etapes/
            ├─ E1 (…E6)/             → une étape = un département
            │    ├─ config/          → { name, department, dateStart, dateEnd, order, type:"etape", scrollSpeed }
            │    │                     (dateEnd optionnel : à renseigner uniquement si l'étape se déroule sur 2 jours)
            │    ├─ shooters/        → { id: { licence, lastName, firstName, club, category,
            │    │                            discipline:"pistolet"|"carabine", status, score, series, mouches } }
            │    └─ pdfs/            → { pistolet, carabine, combine } fichiers PDF ISISWEB déposés
            └─ FINALE/
                 ├─ config/          → { type:"finale", … }
                 └─ shooters/        → mêmes champs + "round":"qualif"|"finale"
```

- Le **classement par étape** (Pistolet, Carabine) est alimenté par **import CSV ISISWEB** puis affiché en direct sur `affichage_etape.html`, avec possibilité de correction manuelle dans `saisie.html`.
- Le **classement Combiné 150/154** par étape est **calculé automatiquement** : un·e tireur·se qui a un score Pistolet ET un score Carabine dans la même étape obtient un score combiné = somme des deux totaux. Aucune saisie supplémentaire n'est nécessaire.
- Le **classement général de la saison** (par discipline et par catégorie, moyenne des 3 meilleurs scores sur les étapes disputées) est **calculé automatiquement** par `palmares.html` à partir des résultats des 6 étapes (la Finale n'entre pas dans ce calcul). Il est imprimable en PDF via le bouton dédié (impression navigateur → « Enregistrer en PDF »), avec en en-tête le nom du challenge.
- Les **PDF officiels ISISWEB** (classement papier par étape, y compris le classement Combiné 150/154 tel que sorti d'ISISWEB) sont simplement **déposés** depuis l'admin et mis à disposition en téléchargement sur `palmares.html`. Ils sont stockés encodés dans la Realtime Database (limite indicative de 5 Mo par fichier) pour rester sur le plan gratuit Firebase (voir remarque plus bas).

### Catégories et disciplines gérées

- Catégories : Poussines (PF), Poussins (PG), Benjamines (BF), Benjamins (BG), Minimes Filles (MF), Minimes Garçons (MG).
- Disciplines : **150 – Pistolet 10 mètres Écoles de Tir** et **154 – Carabine 10 mètres Écoles de Tir** (4 séries chacune), plus le **Combiné 150/154** calculé automatiquement.

### Format du fichier CSV attendu (export ISISWEB, séparateur `;`)

```
NOM;PRENOM;LICENCE;ASSOCIATION NOM;CATÉGORIE E;EPREUVE;PLACE;SÉRIE 1;SÉRIE 2;SÉRIE 3;SÉRIE 4;NOMBRE MOUCHES
```

- `EPREUVE` doit commencer par **150** (Pistolet) ou **154** (Carabine) ; toute autre épreuve est ignorée à l'import.
- `PLACE` peut contenir `DNS`, `DSQ`, `DNF` ou `HM` pour définir le statut du tireur.
- `LICENCE` est **l'identifiant unique** du tireur utilisé pour le classement général sur la saison — vérifiez que cette colonne est bien exportée par ISISWEB (nom de colonne accepté : `LICENCE`, `N° LICENCE`, `NUM LICENCE` ou `N°LICENCE`). Si elle est absente, complétez le numéro de licence manuellement dans `saisie.html` avant de vous fier au classement général.

> ⚠️ Si votre export ISISWEB utilise des intitulés de colonnes légèrement différents, ouvrez `saisie.html` et adaptez les libellés recherchés dans la fonction `processCSVImport()` (variable `get(...)`).

## Démarches pour initialiser et configurer le projet

### 1. Créer le projet Firebase

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com) et créer un **nouveau projet** (ex. `challenge-edt-centre`).
2. Dans **Build > Realtime Database**, créer une base de données (choisir la région `europe-west1` pour rester cohérent avec le projet d'origine), en mode **verrouillé**.
3. Aller dans **Realtime Database > Règles** et coller le contenu de `database.rules.json` fourni, puis **Publier**.
4. Dans **Build > Authentication**, activer le fournisseur **Email/Mot de passe**.
5. Dans **Authentication > Users**, créer un compte administrateur (email + mot de passe) : ce sera le compte utilisé pour se connecter à `index_admin.html` et `saisie.html`.
6. Dans **Paramètres du projet (⚙️) > Général**, section « Vos applications », cliquer sur **Ajouter une application > Web (`</>`)**, donner un nom, puis copier l'objet de configuration `firebaseConfig` proposé.

### 2. Configurer le projet

1. Ouvrir `config.js`.
2. Coller les valeurs copiées à l'étape précédente dans le bloc `firebase: { ... }`.
3. Renseigner `githubBase` avec l'URL GitHub Pages que vous obtiendrez à l'étape 3 (ex. `https://votre-compte.github.io/challenge-edt-centre`) — cette valeur sert uniquement à générer les QR codes, vous pouvez la corriger après coup.
4. Vérifier/adapter si besoin `challengeName` et `ligueName`.

### 3. Déployer sur GitHub Pages

1. Créer un nouveau dépôt GitHub (ex. `challenge-edt-centre`).
2. Déposer tous les fichiers de ce projet à la racine du dépôt (`config.js`, `ranking.js`, `common.css`, les fichiers `.html`, `logo.png`, `database.rules.json` — ce dernier n'a pas besoin d'être public mais peut rester dans le dépôt pour la traçabilité).
3. Dans les paramètres du dépôt GitHub, section **Pages**, activer la publication depuis la branche principale (`main`), dossier racine `/`.
4. Une fois en ligne, revenir dans `config.js` et vérifier que `githubBase` correspond bien à l'URL publiée.
5. Dans la console Firebase, **Authentication > Settings > Domaines autorisés**, ajouter le domaine `votre-compte.github.io` (sinon la connexion admin sera refusée).

### 4. Créer la première saison

1. Ouvrir `index_admin.html`, se connecter avec le compte administrateur créé à l'étape 1.
2. Cliquer sur **+ Nouvelle saison**, renseigner par exemple l'identifiant `2026-2027` et le libellé `Saison 2026 / 2027`.
3. Les 6 étapes (E1 à E6) et la Finale sont créées automatiquement avec des noms par défaut : renommez-les si besoin directement dans Firebase (champ `config/name`), ou ajoutez ce champ dans l'admin si vous souhaitez l'éditer depuis l'interface (actuellement seuls département, date et vitesse de défilement sont éditables depuis `index_admin.html` — le nom peut être modifié directement dans la console Firebase si nécessaire).

### 5. Utiliser le site pendant une étape

1. Depuis `index_admin.html`, cliquer sur **✏️ Saisie / Import CSV** de l'étape concernée.
2. Importer le CSV exporté par ISISWEB (engagements avant l'étape, puis résultats au fil de l'épreuve — l'import peut être relancé plusieurs fois, il met à jour les fiches existantes).
3. Déposer, une fois l'étape terminée, les PDF officiels ISISWEB (Pistolet, Carabine, Combiné) depuis `index_admin.html`.
4. Générer le QR code de la page d'affichage (bouton **📱 QR**), qui pointe vers une URL du type `https://toma-it.github.io/challenge-edt-centre/affichage_etape.html?season=2026-2027&etape=E1` (ou `affichage_finale.html` pour la Finale). Le bouton **🖨️ Imprimer l'affiche A4** génère une affiche prête à imprimer (logo, nom de l'étape, QR code en grand format, URL de secours), ou projetez directement la page d'affichage sur un écran.

### 6. Consulter les palmarès

- `palmares.html` est accessible sans connexion. Il permet de choisir la saison, de basculer entre classement par étape / classement général / classement général Combiné, de filtrer par catégorie et discipline, et de télécharger le classement affiché en PDF via le bouton **🖨️ Télécharger en PDF** (impression navigateur, l'en-tête « Challenge régional des EDT : "La relève au 10.9" » s'affiche automatiquement sur le document imprimé).

### 7. Passer à la saison suivante

Il suffit de créer une nouvelle saison depuis `index_admin.html` (ex. `2027-2028`) : les données de la saison précédente restent consultables (sélecteur de saison dans `palmares.html` et dans l'admin).

## Remarque sur le stockage des PDF ISISWEB

Pour rester sur le plan gratuit **Spark** de Firebase (Firebase Storage nécessite désormais le plan payant Blaze), les PDF déposés sont encodés et stockés directement dans la Realtime Database, avec une limite de 5 Mo par fichier appliquée côté interface et confirmée par les règles de sécurité. Si vos PDF ISISWEB sont plus volumineux, pensez à les compresser avant dépôt, ou passez au plan Blaze et migrez vers Firebase Storage (adaptation du code nécessaire dans `index_admin.html` et `palmares.html`).

## Technologies utilisées

- HTML / CSS / JavaScript (vanilla, aucun framework)
- [Firebase Realtime Database](https://firebase.google.com/docs/database) et [Firebase Authentication](https://firebase.google.com/docs/auth)
- [QRCode.js](https://github.com/davidshimjs/qrcodejs)
- Hébergement statique compatible GitHub Pages

## Points restés en simplification (à faire évoluer si besoin)

- Le nom affiché de chaque étape (`config/name`) se modifie pour l'instant directement dans la console Firebase après la création automatique des 6 étapes + Finale (seuls département, date et vitesse de défilement ont un champ dédié dans `index_admin.html`) — facile à ajouter si vous le souhaitez.
- La Finale suppose que vous importez/saisissez séparément les résultats de Qualification et de Finale (bascule en haut de `saisie.html`) ; la sélection des 8 finalistes se fait manuellement en réimportant/saisissant le CSV des résultats de l'après-midi avec la bascule sur « Finale ».
- Le classement général et le classement Combiné général sont recalculés à la volée à chaque affichage de `palmares.html` (pas de valeur mise en cache) : au-delà de quelques centaines de tireurs cumulés sur 6 étapes, cela reste largement instantané pour ce volume de compétition régionale.