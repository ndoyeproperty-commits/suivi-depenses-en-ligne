// ═══════════════════════════════════════════════════════════════════
// TABLEAU DE BORD — LES CALCULS
// Fonctions qui transforment vos transactions en chiffres. Rien n'est
// inventé : chaque total vient de lignes de VOS relevés (règle ②).
//
// Règles de comptage (pour que vous puissiez les vérifier) :
//  · une ligne « ignorée » n'est comptée nulle part ;
//  · une ligne sans catégorie n'est comptée nulle part non plus : elle
//    apparaît dans « à classer ». Une ligne rangée dans une catégorie SANS
//    sous-catégorie compte dans sa catégorie (« Sans détail ») ;
//  · une ligne dont la sous-catégorie est dans « Ignorés » (virement
//    entre ses comptes) n'est ni une dépense ni un revenu ;
//  · un crédit rangé dans une dépense (ex. un remboursement de santé)
//    vient en déduction de cette dépense : on compte « net ».
// ═══════════════════════════════════════════════════════════════════

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// « 02/01/2026 » (ou « 02-01-26 ») → { annee: 2026, mois: 0 } ; null si illisible.
function lireDate(texte) {
  const m = /^(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})$/.exec(String(texte).trim());
  if (!m) return null;
  let annee = +m[3];
  if (annee < 100) annee += 2000;
  const mois = +m[2] - 1;
  return mois >= 0 && mois <= 11 ? { annee, mois } : null;
}

// Les mois d'une sélection : « annee » = tous les mois, sinon une liste.
const moisDeLaSelection = selection => selection === "annee" ? [...Array(12).keys()] : selection;

// Toutes les lignes à prendre en compte pour ce qui est affiché : celles du
// compte choisi (ou de tous), converties dans la devise d'affichage au taux de
// leur date. `montant` vaut null quand la ligne est illisible ou quand un taux
// de change manque (`sansTaux` le précise).
function* toutesLesLignes(opts = {}) {
  const compte = opts.compte !== undefined ? opts.compte : affichage.compte;
  const devise = opts.devise || affichage.devise || "EUR";
  for (const t of etat.transactions) {
    if (compte !== "tous" && t.compteId !== compte) continue;
    const d = lireDate(t.date);
    if (!d) continue;
    let montant = t.montant, sansTaux = false;
    if (montant != null) {
      montant = convertirMontant(t.montant, deviseDuCompte(t.compteId), devise, dateISO(t.date));
      sansTaux = montant == null;
    }
    yield { t, d, montant, sansTaux };
  }
}

// Additionne les transactions d'une année pour les mois demandés.
function calculerPeriode(annee, mois, opts = {}) {
  const categorieParId = new Map(etat.categories.map(c => [c.id, c]));
  const r = {
    revenus: 0, besoins: 0, envies: 0, epargne: 0, frais: 0,
    nbCompte: 0,       // lignes comptées dans les chiffres
    nbAClasser: 0,     // lignes sans catégorie
    nbSuggerees: 0,    // comptées, mais la sous-catégorie n'est pas encore validée par vous
    nbIllisibles: 0,   // montant ou sens (débit/crédit) non détecté
    nbSansTaux: 0,     // montant lisible mais taux de change manquant : non converti
    nbIgnorees: 0,
    parGroupe: {},         // id de catégorie → total net (revenus : entrées − sorties ; dépenses : sorties − entrées)
    parSousCategorie: {},  // id de sous-catégorie → total net (« __sans-detail:<catégorie> » : rangé sans sous-catégorie)
    neutre: 0,         // total des virements « ignorés » (information)
    exceptionnelles: [],   // (option sansExceptionnelles) les lignes mises à part
  };
  for (const { t, d, montant, sansTaux } of toutesLesLignes(opts)) {
    if (d.annee !== annee || !mois.includes(d.mois)) continue;
    if (t.ignoree) { r.nbIgnorees++; continue; }
    if (t.montant == null || !t.sens) { r.nbIllisibles++; continue; }
    if (sansTaux) { r.nbSansTaux++; continue; }
    const cat = t.categorieId && categorieParId.get(t.categorieId);
    const groupe = cat ? cat.enveloppeId : (t.groupeId || null);   // la catégorie vient de la sous-catégorie, ou a été choisie seule
    if (!groupe) { r.nbAClasser++; continue; }
    const cleDetail = cat ? cat.id : "__sans-detail:" + groupe;

    const signe = t.sens === "credit" ? 1 : -1;       // + : de l'argent entre
    const famille = familleDe(groupe);                 // un besoin, une envie, de l'épargne, un revenu, ou rien
    if (famille === "ignore") { r.neutre += montant; continue; }
    // Bilan : une dépense marquée « exceptionnelle » reste à part, hors des moyennes et des tendances.
    if (opts.sansExceptionnelles && t.exceptionnelle && famille !== "revenu") { r.exceptionnelles.push({ t, groupe, montant: -signe * montant }); continue; }
    r.nbCompte++;
    if (!t.confirmee) r.nbSuggerees++;
    if (famille === "revenu") {
      r.revenus += signe * montant;
      r.parGroupe[groupe] = (r.parGroupe[groupe] || 0) + signe * montant;
      r.parSousCategorie[cleDetail] = (r.parSousCategorie[cleDetail] || 0) + signe * montant;
    } else {
      const cle = { besoin: "besoins", envie: "envies", epargne: "epargne", frais: "frais" }[famille];
      r[cle] += -signe * montant;                    // une dépense est positive, un remboursement la réduit
      r.parGroupe[groupe] = (r.parGroupe[groupe] || 0) - signe * montant;
      r.parSousCategorie[cleDetail] = (r.parSousCategorie[cleDetail] || 0) - signe * montant;
    }
  }
  r.depense = r.besoins + r.envies + r.frais;       // les frais & crédits comptent dans les dépenses
  r.reste = r.revenus - r.depense - r.epargne;
  return r;
}

// Années et mois pour lesquels il existe au moins une transaction.
function periodesDisponibles() {
  const parAnnee = new Map();
  for (const { d } of toutesLesLignes()) {
    if (!parAnnee.has(d.annee)) parAnnee.set(d.annee, new Set());
    parAnnee.get(d.annee).add(d.mois);
  }
  return parAnnee;
}

// Du plus ancien au plus récent : « 02/01/2026 », « 29/08/2026 ».
function etenduDesDonnees() {
  const dates = etat.transactions.map(t => ({ t, d: lireDate(t.date) })).filter(x => x.d);
  if (dates.length === 0) return null;
  const cle = x => x.d.annee * 10000 + x.d.mois * 100 + +x.t.date.slice(0, 2);
  dates.sort((a, b) => cle(a) - cle(b));
  return { debut: dates[0].t.date, fin: dates[dates.length - 1].t.date };
}

const sontContigus = liste => liste.every((v, i) => i === 0 || v === liste[i - 1] + 1);
function libelleMois(liste) {
  if (liste.length === 1) return MOIS_COURTS[liste[0]];
  if (sontContigus(liste)) return MOIS_COURTS[liste[0]] + "–" + MOIS_COURTS[liste[liste.length - 1]];
  return liste.map(i => MOIS_COURTS[i]).join(", ");
}

// Période de comparaison, ou null s'il n'y en a pas (on n'invente rien) :
//  · mois qui se suivent → la période de même durée juste avant ;
//  · sinon (ou si elle sort de l'année) → les mêmes mois de l'année d'avant ;
//  · dans les deux cas, seulement s'il y a des lignes comptées.
function periodeDeReference(annee, selection) {
  const mois = moisDeLaSelection(selection);
  const candidates = [];
  const n = mois.length;
  if (selection !== "annee" && sontContigus(mois) && mois[0] - n >= 0) {
    const avant = Array.from({ length: n }, (_, k) => mois[0] - n + k);
    candidates.push({ annee, mois: avant, lib: n === 1 ? `mois précédent (${MOIS_COURTS[avant[0]]})` : libelleMois(avant) });
  }
  candidates.push({
    annee: annee - 1, mois,
    lib: selection === "annee" ? String(annee - 1) : (n === 1 ? `même mois ${annee - 1}` : `mêmes mois ${annee - 1}`),
  });
  for (const c of candidates) {
    const calcul = calculerPeriode(c.annee, c.mois);
    if (calcul.nbCompte > 0) return { ...c, calcul };
  }
  return null;
}

// ── Lignes comptées, une par une (pour les listes : récurrentes, top 10) ──
function* transactionsComptees(opts = {}) {
  const parId = new Map(etat.categories.map(c => [c.id, c]));
  for (const { t, d, montant } of toutesLesLignes(opts)) {
    if (t.ignoree || montant == null || !t.sens) continue;   // (montant null : illisible ou taux manquant)
    const cat = t.categorieId && parId.get(t.categorieId);
    const groupe = cat ? cat.enveloppeId : (t.groupeId || null);
    if (!groupe) continue;
    yield { t, d, cat: cat || null, montant, groupe, signe: t.sens === "credit" ? 1 : -1 };
  }
}

const numeroMois = (annee, mois) => annee * 12 + mois;
const dansLaSelection = (d, annee, mois) => d.annee === annee && mois.includes(d.mois);

// Un nom lisible pour un commerçant, pour l'AFFICHAGE seulement (la ligne du
// relevé n'est jamais modifiée) :
//   « PRLV EUROPEEN DE: SFR ID EMETTEUR: 123… » → « SFR »
//   « CARTE X1234 12/03 MONOPRIX PARIS 15 »       → « Monoprix Paris »
// ou le nom que vous lui avez donné (✎).
const MOTS_BANCAIRES = new Set(["PRLV", "PRELEVEMENT", "PAIEMENT", "CB", "CARTE", "SEPA", "EUROPEEN", "VIR", "VIREMENT", "INST", "RE", "RECU", "EMIS"]);
const PETITS_MOTS = new Set(["LA", "LE", "LES", "DE", "DU", "DES", "ET", "EN", "AU", "AUX", "D", "L"]);

function extraireNomAffichable(libelle) {
  const sansCarte = libelle.replace(/CARTE\s+X?\d+\s+\d{2}\/\d{2}\s*/i, "").trim();
  const apresDe = /\bDE:\s*(.+)/i.exec(sansCarte);      // « … DE: SFR … » : le nom suit « DE: »
  const mots = (apresDe ? apresDe[1] : sansCarte).split(/\s+/);
  const nom = [];
  for (const mot of mots) {
    if (/:$/.test(mot) || /\d{4,}/.test(mot)) { if (nom.length) break; else continue; }   // « ID EMETTEUR: » ou une référence : le nom est fini
    if (nom.length && (/^(ID|REF|REFERENCE|MOTIF|MDT|MANDAT|LIB|DATE|NUM)$/i.test(mot) || /^\d+$/.test(mot))) break;   // « ID EMETTEUR », un code postal…
    if (!apresDe && nom.length === 0 && MOTS_BANCAIRES.has(mot.toUpperCase())) continue;   // préfixe technique du début
    nom.push(mot);
    if (nom.length === 3) break;
  }
  return nom.map((mot, i) => {
    const maj = mot.toUpperCase();
    if (i > 0 && PETITS_MOTS.has(maj)) return mot.toLowerCase();
    if (PETITS_MOTS.has(maj)) return mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase();   // « La Poste »
    return mot.length <= 3 ? maj : mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase();   // SFR, EDF restent en majuscules
  }).join(" ");
}

function nomCommercant(cle, type, exemple) {
  const retouche = etat.noms && etat.noms[type] && etat.noms[type][cle];
  if (retouche && retouche.nom) return retouche.nom;
  return extraireNomAffichable(exemple || cle) || (cle.charAt(0) + cle.slice(1).toLowerCase());
}

// ── Ce qui revient chaque mois ─────────────────────────────────────
// Un « poste récurrent » = un commerçant dont une dépense (ou un virement
// d'épargne) apparaît dans au moins 3 mois différents. ⚠️ C'est une
// détection : vous pouvez renommer ou retirer une ligne (✎).
const MOIS_MINIMUM_RECURRENT = 3;

function nombreDeMoisAvecDonnees() {
  const mois = new Set();
  for (const { d } of transactionsComptees()) mois.add(numeroMois(d.annee, d.mois));
  return mois.size;
}

function repererRecurrentes() {
  const parCle = new Map();
  for (const { t, d, cat, montant, groupe, signe } of transactionsComptees()) {
    if (!["besoin", "envie", "epargne", "frais"].includes(familleDe(groupe))) continue;
    if (t.exceptionnelle) continue;                  // une dépense exceptionnelle n'est pas « récurrente »
    const cle = cleApprentissage(t.libelle);
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, { cle, exemple: t.libelle, parMois: new Map(), parGroupe: {}, parCategorie: {} });
    const e = parCle.get(cle);
    const net = -signe * montant;
    const nm = numeroMois(d.annee, d.mois);
    e.parMois.set(nm, (e.parMois.get(nm) || 0) + net);
    e.parGroupe[groupe] = (e.parGroupe[groupe] || 0) + Math.abs(net);
    const idCat = cat ? cat.id : "__sans-detail"; e.parCategorie[idCat] = (e.parCategorie[idCat] || 0) + Math.abs(net);
  }
  const resultat = [];
  for (const e of parCle.values()) {
    const montants = [...e.parMois.values()].filter(v => v > 0);
    if (montants.length < MOIS_MINIMUM_RECURRENT) continue;
    const triParValeur = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0][0];
    const mediane = [...montants].sort((a, b) => a - b)[Math.floor(montants.length / 2)];
    resultat.push({
      cle: e.cle, exemple: e.exemple, parMois: e.parMois, nbMois: montants.length,
      groupe: triParValeur(e.parGroupe), famille: familleDe(triParValeur(e.parGroupe)),
      estCredit: triParValeur(e.parCategorie) === "credits",
      variable: (Math.max(...montants) - Math.min(...montants)) / mediane > 0.15,
    });
  }
  return resultat;
}

// Les lignes récurrentes pour la période choisie (total net sur la période).
function recurrentesPourPeriode(annee, mois) {
  const masquees = (etat.noms && etat.noms.recurrentes) || {};
  const lignes = [];
  let nbMasquees = 0;
  for (const r of repererRecurrentes()) {
    let total = 0, present = false;
    for (const m of mois) {
      const v = r.parMois.get(numeroMois(annee, m));
      if (v !== undefined) { total += v; present = true; }
    }
    if (!present) continue;
    if (masquees[r.cle] && masquees[r.cle].masque) { nbMasquees++; continue; }
    lignes.push({ ...r, total, nom: nomCommercant(r.cle, "recurrentes", r.exemple) });
  }
  lignes.sort((a, b) => b.total - a.total);
  return { lignes, nbMasquees };
}

// ── Top des commerçants (période choisie) ──────────────────────────
// Regroupement d'AFFICHAGE seulement : toutes les lignes d'un même commerçant
// sont additionnées ici, mais chaque ligne de votre relevé reste intacte.
function topCommercants(annee, mois) {
  const parCle = new Map();
  for (const { t, d, cat, montant, groupe, signe } of transactionsComptees()) {
    if (!dansLaSelection(d, annee, mois) || !["besoin", "envie", "frais"].includes(familleDe(groupe))) continue;
    const cle = cleApprentissage(t.libelle);
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, { cle, exemple: t.libelle, total: 0, nb: 0, parCategorie: {}, groupe });
    const e = parCle.get(cle);
    e.total += -signe * montant;
    e.nb++;
    const idCat = cat ? cat.id : "__sans-detail"; e.parCategorie[idCat] = (e.parCategorie[idCat] || 0) + Math.abs(montant);
  }
  const tous = [...parCle.values()].filter(e => e.total > 0).sort((a, b) => b.total - a.total);
  const parId = new Map(etat.categories.map(c => [c.id, c]));
  return {
    nbTotal: tous.length,
    lignes: tous.slice(0, 10).map(e => {
      const catPrincipale = Object.entries(e.parCategorie).sort((a, b) => b[1] - a[1])[0][0];
      return { ...e, nom: nomCommercant(e.cle, "commercants", e.exemple), couleur: couleurGroupe((parId.get(catPrincipale) || { enveloppeId: e.groupe }).enveloppeId) };
    }),
  };
}
