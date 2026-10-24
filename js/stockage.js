// ═══════════════════════════════════════════════════════════════════
// STOCKAGE — tout est sauvegardé dans le navigateur (localStorage).
// ⚠️ RÈGLE ① : rien ne sort d'ici. Pas d'envoi réseau, pas de serveur.
// ═══════════════════════════════════════════════════════════════════

const CLE_STOCKAGE = "suivi-depenses:donnees";

// Les couleurs des 5 catégories (celles de l'écran « Catégories & règles ») : franches mais
// adoucies. Les sous-catégories reprennent la couleur de leur catégorie. Le rouge « alerte »
// est volontairement plus sombre que celui de Besoins pour ne jamais les confondre.
const COULEURS_GROUPES_DEFAUT = { besoins: "#c4574c", envies: "#e0a04a", epargne: "#5f7fae", frais: "#8a7060", revenus: "#4a8560", neutre: "#8e9aa6" };
const COULEUR_ALERTE = "#b3261e";
// La « famille » dit au tableau de bord comment compter une catégorie : un besoin, une envie,
// de l'épargne, un revenu, ou rien (ignoré). Les 5 catégories de départ ont chacune la leur ;
// une catégorie que vous créez choisit la sienne.
const FAMILLE_PAR_DEFAUT = { besoins: "besoin", envies: "envie", epargne: "epargne", frais: "frais", revenus: "revenu", neutre: "ignore" };


// ── Les catégories (anciennement « enveloppes ») et leurs sous-catégories ──
// Chaque catégorie a un TYPE : « depense », « revenu » ou « neutre » (ni
// dépense ni revenu, ex. un virement entre ses propres comptes).
function enveloppesParDefaut() {
  const e = (id, icone, nom, description, type = "depense") =>
    ({ id, icone, nom, description, type, couleur: COULEURS_GROUPES_DEFAUT[id], famille: FAMILLE_PAR_DEFAUT[id], active: true, custom: false });
  return [
    e("besoins", "🏠", "Besoins", "Ce qui est indispensable pour vivre : se loger, se nourrir, se soigner, se déplacer, payer ses factures."),
    e("envies", "✨", "Envies", "Ce qui fait plaisir mais dont on pourrait se passer : sorties, loisirs, voyages, shopping."),
    e("epargne", "💰", "Épargne", "Ce que vous mettez de côté pour plus tard : virements vers un livret ou un investissement, nets des retraits. Un virement entre vos comptes courants n'est pas de l'épargne."),
    e("revenus", "💶", "Revenus", "Ce qui entre sur vos comptes. Les noms de vos revenus (écran ①) apparaissent ici.", "revenu"),
    e("neutre", "🔁", "Ignorés (ni dépenses ni revenus)", "Les mouvements qui ne comptent pas dans votre budget.", "neutre"),
  ];
}

function categoriesParDefaut() {
  const c = (id, nom, couleur, enveloppeId) =>
    ({ id, nom, couleur, active: true, enveloppeId, custom: false });
  return [
    c("loyer", "Loyer", "#4a7c6f", "besoins"),
    c("copropriete", "Charges de copropriété", "#5c8a7a", "besoins"),
    c("energie", "Énergie", "#c1873a", "besoins"),
    c("eau", "Eau", "#6a9aa6", "besoins"),
    c("assurances", "Assurances & mutuelle", "#5b7fa6", "besoins"),
    c("telecom", "Télécom & internet", "#a8628f", "besoins"),
    c("abonnements", "Abonnements", "#8b6ea8", "besoins"),
    c("credits", "Crédits & mensualités", "#7e5f94", "besoins"),
    c("impots", "Impôts & taxes", "#8a7f75", "besoins"),
    c("transports-commun", "Transport", "#6a8caf", "besoins"),
    c("alimentation", "Alimentation & courses", "#3f8f5e", "besoins"),
    c("habillement", "Habillement & beauté", "#b06a8f", "envies"),
    c("especes", "Retraits d'espèces", "#8e9aa0", "besoins"),
    c("sante", "Santé & pharmacie", "#c1663f", "besoins"),
    c("carburant", "Carburant", "#457b9d", "besoins"),
    c("parking", "Parking & péages", "#6f8fa0", "besoins"),
    c("entretien-vehicule", "Entretien véhicule", "#9a8562", "besoins"),
    c("voyages", "Voyages & billets", "#5a9fb5", "envies"),
    c("epargne", "Épargne de précaution", "#7a9a5a", "epargne"),
    c("epargne-projet", "Épargne projet", "#5f9a7a", "epargne"),
    c("placements", "Placements & investissements", "#4d8a7a", "epargne"),
    c("retraite-per", "Retraite / PER", "#6f8a50", "epargne"),
    c("restaurants", "Restaurants & cafés", "#a8894c", "envies"),
    c("loisirs-culture", "Loisirs & culture", "#6b8e6b", "envies"),
    c("bricolage", "Maison & bricolage", "#a8896a", "besoins"),
    c("frais-cb", "Frais CB", "#c2a24a", "besoins"),
    c("frais-bancaires", "Frais bancaires & agios", "#9c6b6b", "besoins"),
    c("remboursement-anticipe", "Remboursement anticipé de crédit", "#7e5f94", "besoins"),
    c("famille", "Famille & remboursements", "#d17a74", "besoins"),
    c("cadeaux", "Cadeaux", "#7a8fa6", "envies"),
    c("autres-depenses", "Autres dépenses", "#8a94a6", "envies"),
    c("salaire", "Salaire", "#3f7f4f", "revenus"),
    c("revenus-activite", "Revenus d'activité indépendante", "#5a8f3f", "revenus"),
    c("retraite-base", "Retraite de base", "#4a7a45", "revenus"),
    c("retraite-compl", "Retraite complémentaire", "#3f8a63", "revenus"),
    c("allocations", "Allocations & prestations", "#7a8f3f", "revenus"),
    c("revenus-locatifs", "Revenus locatifs", "#6f8a50", "revenus"),
    c("revenus-placements", "Revenus de placements", "#4d8a7a", "revenus"),
    c("remboursements-rev", "Remboursements (sécu, mutuelle)", "#4f8f9a", "revenus"),
    c("aides-famille", "Aides de la famille", "#8a8a3f", "revenus"),
    c("autres-revenus", "Autres revenus", "#8a6f5f", "revenus"),
    c("virements-internes", "Virements entre comptes", "#8f9aa3", "neutre"),
  ];
}

function etatParDefaut() {
  const personnes = [ nouvellePersonne() ];
  const enveloppes = enveloppesParDefaut();
  const categories = categoriesParDefaut();
  return {
    versionDonnees: 10,
    etapeCourante: "personnes",
    personnes,
    modeVie: "seul",
    repartition: "commun",
    comptes: [ nouveauCompte(personnes[0].id) ],
    foyer: {
      habitation: "Locataire",
      loyerMensuel: "",
      creditMensuel: "",
      chargesProprietaire: "",
      nombreEnfants: "",
      aVehicule: false,
      nombreVehicules: "",
      aVacances: false,
      destinationRecurrente: "",
      aAnimal: false,
      aPret: false,
      prets: [],
      aFraisScolarite: false,
      viePartielleAutrePays: false,
      detailsAutrePays: "",
    },
    habitudes: {
      abonnements: {
        mobile: { active: false, detail: "" },
        internet: { active: false, detail: "" },
        streaming: { active: false, detail: "" },
        salleDeSport: { active: false, detail: "" },
        transport: { active: false, detail: "" },
        energie: { active: false, detail: "" },
        mutuelle: { active: false, detail: "" },
        assurances: { active: false, detail: "" },
      },
      abonnementsPersonnalises: [],
      enseignes: "",
      depensesRegulieres: "",
    },
    enveloppes,
    categories,
    transactions: [],
    // Règles « si le libellé contient … alors ranger dans … » : apprises (quand vous classez) ou créées par vous.
    regles: [],
    // Vos retouches d'affichage sur le tableau de bord : un nom plus lisible
    // pour une ligne (clé = commerçant), ou une ligne retirée de la liste.
    // Les opérations elles-mêmes ne sont jamais modifiées.
    noms: { recurrentes: {}, commercants: {} },
    // Préférences d'affichage. Le repère 50 / 30 / 20 est facultatif : désactivé tant que vous ne l'avez pas demandé.
    preferences: { repere503020: false, capaciteProjets: null, projetsInclureEpargne: false },
    // Les projets (onglet « Projets ») : { id, type, nom, cible, annee, mois, deja, debut: {annee, mois}, categorieId }
    projets: [],
    // Taux de change saisis par vous : « 1 € = 4,02 AED depuis le 2026-10-10 ».
    // Une opération est convertie au taux en vigueur à sa date (jamais récupéré
    // automatiquement : rien ne quitte votre navigateur).
    taux: [],
  };
}

function nouvelleEnveloppe() {
  return {
    id: crypto.randomUUID(),
    icone: "＋",
    nom: "",
    description: "",
    active: true,
    custom: true,
  };
}

function nouvelleCategorie(enveloppeId, couleur) {
  return {
    id: crypto.randomUUID(),
    nom: "",
    couleur: couleur || COULEURS_CATEGORIES_LIBRES[Math.floor(Math.random() * COULEURS_CATEGORIES_LIBRES.length)],
    active: true,
    enveloppeId: enveloppeId || null,
    custom: true,
  };
}

// Palette proposée pour les nouvelles catégories (teintes douces, comme
// celles du CHARTE.md — jamais vives, jamais de bleu vif).
const COULEURS_CATEGORIES_LIBRES = [
  "#4a7c6f", "#c1873a", "#5b7fa6", "#8b6ea8", "#3f8f5e",
  "#b06a8f", "#c1663f", "#457b9d", "#a8894c", "#6b8e6b",
  "#8a7f75", "#9c6b6b", "#7a8fa6",
];

function nouvellePersonne() {
  return {
    id: crypto.randomUUID(),
    prenom: "",
    nom: "",
    age: "",
    situation: "activite",
    revenus: [ nouveauRevenu() ],
  };
}

function nouveauRevenu() {
  return {
    id: crypto.randomUUID(),
    nom: "",
    type: "Salaire / rémunération",
    montant: "",
    jourVersement: "",
  };
}

function nouveauCompte(aQuiDefaut) {
  return {
    id: crypto.randomUUID(),
    nom: "",
    banque: "",
    type: "Compte courant",
    aQui: aQuiDefaut || "commun",
    devise: "€ Euro",
    alimente: "commun",
  };
}

function nouveauPret() {
  return {
    id: crypto.randomUUID(),
    nom: "",
    nature: "Automobile",
    mensualite: "",
    echeance: "",
  };
}

function nouvelAbonnementPersonnalise() {
  return { id: crypto.randomUUID(), nom: "" };
}

// Un abonnement enregistré dans un très ancien format était une simple
// case oui/non (ex. `salleDeSport: false`), pas un objet { active, detail }.
// On ignore ces anciennes valeurs mal formées plutôt que de planter dessus.
function migrerAbonnements(defautAbonnements, sauvegardeAbonnements) {
  const resultat = {};
  for (const cle in defautAbonnements) {
    const valeur = sauvegardeAbonnements[cle];
    resultat[cle] = (valeur && typeof valeur === "object")
      ? { ...defautAbonnements[cle], ...valeur }
      : defautAbonnements[cle];
  }
  return resultat;
}

// Met à niveau une personne enregistrée dans un ancien format : avant, un
// seul revenu (typeRevenus + montant) ; maintenant, une liste « revenus ».
// ⚠️ Nécessaire pour que les données déjà saisies par l'utilisateur ne
// disparaissent jamais après une mise à jour de l'app.
function migrerPersonne(p) {
  const { jourVersement: ancienJour, typeRevenus, montant, ...base } = { nom: "", ...p };

  const revenus = Array.isArray(base.revenus) && base.revenus.length > 0
    ? base.revenus.map(r => ({ nom: "", jourVersement: "", ...r }))
    : [{ id: crypto.randomUUID(), nom: "", type: typeRevenus || "Salaire / rémunération",
         montant: montant || "", jourVersement: "" }];

  // Avant : un seul « jour de versement » pour toute la personne.
  // Maintenant : un par revenu — l'ancienne valeur passe au premier revenu.
  if (ancienJour && !revenus[0].jourVersement) revenus[0].jourVersement = ancienJour;
  return { ...base, revenus };
}

// Renomme une enveloppe ou une catégorie par défaut, mais SEULEMENT si
// l'utilisateur n'y a jamais touché (nom encore égal à l'ancien nom
// d'origine) — pour ne jamais écraser un renommage volontaire.
function renommerSiInchange(liste, id, ancienNom, nouvelleValeurs) {
  const item = liste.find(x => x.id === id);
  if (item && item.nom === ancienNom) Object.assign(item, nouvelleValeurs);
}

// Version 2 : les catégories ont un type, et de nouvelles catégories /
// sous-catégories par défaut existent (revenus, banque, famille…). On ajoute
// celles qui manquent sans jamais toucher à ce que l'utilisateur a modifié.
function migrerVersion2(sauvegarde, defaut) {
  if ((sauvegarde.versionDonnees || 1) >= 2) return;
  if (Array.isArray(sauvegarde.enveloppes)) {
    const types = Object.fromEntries(defaut.enveloppes.map(e => [e.id, e.type]));
    sauvegarde.enveloppes.forEach(e => { if (!e.type) e.type = types[e.id] || "depense"; });
    defaut.enveloppes.forEach(e => {
      if (!sauvegarde.enveloppes.some(x => x.id === e.id)) sauvegarde.enveloppes.push(e);
    });
  }
  if (Array.isArray(sauvegarde.categories)) {
    defaut.categories.forEach(c => {
      const existante = sauvegarde.categories.find(x => x.id === c.id);
      if (!existante) sauvegarde.categories.push(c);
      else if (!existante.custom && existante.enveloppeId == null && c.enveloppeId) existante.enveloppeId = c.enveloppeId;
    });
    [["assurances", "Assurances", "Assurances & mutuelle"], ["alimentation", "Alimentation", "Alimentation & courses"],
     ["habillement", "Habillement", "Habillement & beauté"], ["sante", "Santé", "Santé & pharmacie"],
     ["restaurants", "Restaurants", "Restaurants & cafés"], ["frais-bancaires", "Frais bancaires", "Frais bancaires & agios"],
    ].forEach(([id, ancien, nouveau]) => renommerSiInchange(sauvegarde.categories, id, ancien, { nom: nouveau }));
  }
  sauvegarde.versionDonnees = 2;
}

// Version 3 : les 12 anciennes catégories (Charges fixes, Voiture, Vacances…)
// laissent place à trois grandes catégories : Besoins, Envies, Épargne
// (+ Revenus et Ignorés). Les sous-catégories par défaut prennent leur place
// d'origine ; celles créées par l'utilisateur suivent leur ancienne catégorie ;
// une ancienne catégorie créée par l'utilisateur devient une sous-catégorie.
const ANCIENNE_VERS_GRANDE = {
  "charges-fixes": "besoins", "vie-courante": "besoins", "sante": "besoins", "transport": "besoins",
  "maison": "besoins", "banque": "besoins", "famille": "besoins",
  "vacances": "envies", "sorties-loisirs": "envies", "epargne": "epargne",
  "besoins": "besoins", "envies": "envies", "revenus": "revenus", "neutre": "neutre",
};

// Version 4 : chaque opération est rattachée à un compte. Les opérations déjà
// importées sont rattachées au premier compte déclaré.
// Version 5 : chaque catégorie (Besoins, Envies…) a sa couleur ; les sous-catégories
// prennent celle de leur catégorie. (Les couleurs propres aux sous-catégories sont
// conservées dans les données mais ne sont plus affichées.)
// Version 6 : chaque catégorie a une famille, et les règles apprises deviennent des règles « contient ».
// Version 7 (étape intermédiaire) : ajoute la sous-catégorie « Remboursement anticipé de crédit ».
function migrerVersion7(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 7) return;
  if (Array.isArray(sauvegarde.categories) && !sauvegarde.categories.some(c => c.id === "remboursement-anticipe")) {
    const c = nouvelleCategorie("besoins", "#7e5f94"); Object.assign(c, { id: "remboursement-anticipe", nom: "Remboursement anticipé de crédit", custom: false });
    sauvegarde.categories.push(c);
  }
  sauvegarde.versionDonnees = 7;
}

// Version 8 : retour à TROIS catégories de départ. Un test avait ajouté une catégorie « Frais & crédits » ;
// les frais et les crédits restent dans « Besoins » (le Bilan les analysera à part). Les sous-catégories restées « par
// défaut » reviennent dans Besoins ; la catégorie « Frais & crédits » est supprimée si elle est vide, et conservée
// (comme une catégorie à vous) si vous y avez mis quelque chose.
// Version 9 : le repère 50 / 30 / 20 devient facultatif (désactivé par défaut).
function migrerVersion9(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 9) return;
  sauvegarde.preferences = { repere503020: false, ...(sauvegarde.preferences || {}) };
  sauvegarde.versionDonnees = 9;
}

// Version 10 : l'onglet « Projets » (liste de projets + deux préférences).
function migrerVersion10(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 10) return;
  if (!Array.isArray(sauvegarde.projets)) sauvegarde.projets = [];
  sauvegarde.preferences = { capaciteProjets: null, projetsInclureEpargne: false, ...(sauvegarde.preferences || {}) };
  sauvegarde.versionDonnees = 10;
}

function migrerVersion8(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 8) return;
  if (Array.isArray(sauvegarde.enveloppes) && Array.isArray(sauvegarde.categories)) {
    const defauts = ["credits", "frais-cb", "frais-bancaires", "remboursement-anticipe"];
    sauvegarde.categories.forEach(c => { if (defauts.includes(c.id) && c.enveloppeId === "frais" && !c.custom) c.enveloppeId = "besoins"; });
    const encoreUtilisee = sauvegarde.categories.some(c => c.enveloppeId === "frais")
      || (sauvegarde.transactions || []).some(t => t.groupeId === "frais")
      || (sauvegarde.regles || []).some(r => r.groupeId === "frais");
    if (!encoreUtilisee) sauvegarde.enveloppes = sauvegarde.enveloppes.filter(e => e.id !== "frais");
    else sauvegarde.enveloppes.forEach(e => { if (e.id === "frais") e.custom = true; });
  }
  sauvegarde.versionDonnees = 8;
}

function migrerVersion6(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 6) return;
  if (Array.isArray(sauvegarde.enveloppes)) {
    sauvegarde.enveloppes.forEach(e => { if (!e.famille) e.famille = FAMILLE_PAR_DEFAUT[e.id] || "envie"; });
  }
  if (!Array.isArray(sauvegarde.regles)) sauvegarde.regles = [];
  const anciennes = sauvegarde.reglesCategorisation || {};
  Object.entries(anciennes).forEach(([motif, cible]) => {
    const groupe = String(cible).startsWith("g:");
    sauvegarde.regles.push({
      id: "r" + Math.random().toString(36).slice(2, 10), motif, sens: "", source: "apprise",
      categorieId: groupe ? null : cible, groupeId: groupe ? String(cible).slice(2) : null,
    });
  });
  delete sauvegarde.reglesCategorisation;
  sauvegarde.versionDonnees = 6;
}

function migrerVersion5(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 5) return;
  if (Array.isArray(sauvegarde.enveloppes)) {
    sauvegarde.enveloppes.forEach(e => { if (!e.couleur) e.couleur = COULEURS_GROUPES_DEFAUT[e.id] || "#8e9aa6"; });
  }
  sauvegarde.versionDonnees = 5;
}

function migrerVersion4(sauvegarde) {
  if ((sauvegarde.versionDonnees || 1) >= 4) return;
  const premier = Array.isArray(sauvegarde.comptes) && sauvegarde.comptes[0] && sauvegarde.comptes[0].id;
  if (Array.isArray(sauvegarde.transactions)) {
    sauvegarde.transactions.forEach(t => { if (!t.compteId && premier) t.compteId = premier; });
  }
  sauvegarde.versionDonnees = 4;
}

function migrerVersion3(sauvegarde, defaut) {
  if ((sauvegarde.versionDonnees || 1) >= 3) return;
  if (Array.isArray(sauvegarde.enveloppes) && Array.isArray(sauvegarde.categories)) {
    const parDefaut = Object.fromEntries(defaut.categories.map(c => [c.id, c]));

    sauvegarde.enveloppes.filter(e => e.custom && (e.nom || "").trim()).forEach(e => {
      if (sauvegarde.categories.some(c => c.id === e.id)) return;
      const c = nouvelleCategorie("envies");
      Object.assign(c, { id: e.id, nom: e.nom.trim(), active: e.active !== false });
      sauvegarde.categories.push(c);
    });

    sauvegarde.categories.forEach(c => {
      if (parDefaut[c.id] && !c.custom) c.enveloppeId = parDefaut[c.id].enveloppeId;
      else c.enveloppeId = ANCIENNE_VERS_GRANDE[c.enveloppeId] || "besoins";
    });
    defaut.categories.forEach(c => {
      if (!sauvegarde.categories.some(x => x.id === c.id)) sauvegarde.categories.push(c);
    });
    renommerSiInchange(sauvegarde.categories, "epargne", "Épargne", { nom: "Épargne de précaution" });
    sauvegarde.enveloppes = defaut.enveloppes;
  }
  sauvegarde.versionDonnees = 3;
}

// Certaines sous-catégories viennent de ce que l'utilisateur a déclaré aux
// écrans ① à ③ : le nom d'un revenu, le nom d'un prêt, la destination
// récurrente. Elles sont créées une fois, puis suivent le nom déclaré tant
// que l'utilisateur ne les a pas renommées lui-même.
function synchroniserSousCategoriesDeclarees() {
  const declarees = [];
  etat.personnes.forEach(p => p.revenus.forEach(r => {
    if ((r.nom || "").trim()) declarees.push({ source: `revenu:${r.id}`, nom: r.nom.trim(), enveloppeId: "revenus" });
  }));
  (etat.foyer.prets || []).forEach(p => {
    if ((p.nom || "").trim()) declarees.push({ source: `pret:${p.id}`, nom: p.nom.trim(), enveloppeId: "besoins" });
  });
  if (etat.foyer.aVacances && (etat.foyer.destinationRecurrente || "").trim()) {
    declarees.push({ source: "destination", nom: etat.foyer.destinationRecurrente.trim(), enveloppeId: "envies" });
  }
  declarees.forEach(d => {
    const existante = etat.categories.find(c => c.source === d.source);
    if (!existante) {
      const c = nouvelleCategorie(d.enveloppeId);
      Object.assign(c, { source: d.source, nom: d.nom, nomAuto: d.nom });
      etat.categories.push(c);
    } else if (existante.nom === existante.nomAuto) {
      existante.nom = d.nom;
      existante.nomAuto = d.nom;
    }
  });
}

function chargerEtat() {
  const brut = localStorage.getItem(CLE_STOCKAGE);
  const defaut = etatParDefaut();
  if (!brut) return defaut;
  try {
    const sauvegarde = JSON.parse(brut);
    if (Array.isArray(sauvegarde.personnes)) {
      sauvegarde.personnes = sauvegarde.personnes.map(migrerPersonne);
    }
    migrerVersion2(sauvegarde, defaut);
    migrerVersion3(sauvegarde, defaut);
    migrerVersion4(sauvegarde);
    migrerVersion5(sauvegarde);
    migrerVersion6(sauvegarde);
    migrerVersion7(sauvegarde);
    migrerVersion8(sauvegarde);
    migrerVersion9(sauvegarde);
    migrerVersion10(sauvegarde);
    if (Array.isArray(sauvegarde.enveloppes)) {
      renommerSiInchange(sauvegarde.enveloppes, "transport", "Transport",
        { nom: "Voiture", description: "Carburant, entretien, assurance auto" });
    }
    if (Array.isArray(sauvegarde.categories)) {
      renommerSiInchange(sauvegarde.categories, "transports-commun", "Transports en commun",
        { nom: "Transport" });
    }
    // Fusion à deux niveaux pour « foyer » : un ancien enregistrement qui ne
    // connaît pas encore un nouveau champ (ex. « prets ») garde sa valeur
    // par défaut au lieu de la perdre.
    return {
      ...defaut, ...sauvegarde,
      foyer: { ...defaut.foyer, ...(sauvegarde.foyer || {}) },
      habitudes: {
        ...defaut.habitudes, ...(sauvegarde.habitudes || {}),
        abonnements: migrerAbonnements(defaut.habitudes.abonnements, (sauvegarde.habitudes || {}).abonnements || {}),
      },
    };
  } catch {
    return defaut;
  }
}

function sauvegarderEtat(etat) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
}

// Étant partagé par tous les écrans, l'état vit ici, une seule fois.
let etat = chargerEtat();

function libellePersonne(p, index) {
  return `${p.prenom || ""} ${p.nom || ""}`.trim() || `Personne ${index + 1}`;
}
