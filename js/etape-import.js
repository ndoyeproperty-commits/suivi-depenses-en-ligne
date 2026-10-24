// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ⑦ — L'IMPORT
// ⚠️ RÈGLE ① : le fichier déposé est lu ici, dans le navigateur, et
// n'est jamais envoyé nulle part.
// ⚠️ RÈGLE IMPORTANTE (demandée explicitement) : CHAQUE ligne du relevé
// est importée telle quelle, sans exception ni filtrage. Une catégorie
// peut être SUGGÉRÉE (pré-remplie) mais jamais imposée silencieusement :
// rien n'est confirmé tant que l'utilisateur n'a pas cliqué ✓, et toutes
// les lignes restent visibles — confirmées, ignorées ou non.
// ═══════════════════════════════════════════════════════════════════

let dernierResultatImport = null; // { total, preremplies } — pour le résumé affiché

// Quand un abonnement connu (écran ④) correspond à une transaction, on
// suggère la catégorie de même nom — seulement si elle existe et qu'elle
// est active. Ce n'est qu'une suggestion, jamais une confirmation.
const ABONNEMENT_VERS_CATEGORIE = {
  mobile: "Abonnements",
  internet: "Abonnements",
  streaming: "Abonnements",
  transport: "Transport",
  energie: "Énergie",
  assurances: "Assurances",
};

function suggestionDepuisHabitudes(libelle) {
  const libelleMaj = libelle.toUpperCase();
  for (const [cleAbonnement, nomCategorie] of Object.entries(ABONNEMENT_VERS_CATEGORIE)) {
    const info = etat.habitudes.abonnements[cleAbonnement];
    const detail = info && info.active && info.detail.trim();
    if (!detail || !libelleMaj.includes(detail.toUpperCase())) continue;
    const categorie = etat.categories.find(c => c.active && c.nom === nomCategorie);
    if (categorie) return categorie.id;
  }
  return null;
}

// D'abord ce qui a déjà été appris (une catégorie confirmée par vous),
// sinon ce que suggèrent vos habitudes déclarées à l'écran ④.
// Le TYPE du compte aide à classer les virements (étape 2) :
//  · sur un compte « Livret / épargne » ou « Compte titre » : ce qui entre ou sort est presque toujours un virement
//    avec vos autres comptes → proposé en « Ignorés » (sinon l'épargne serait comptée deux fois), sauf les intérêts
//    et dividendes → « Revenus de placements » ;
//  · sur un compte courant : une ligne qui nomme l'un de vos comptes d'épargne (« LIVRET A »…) → proposée en épargne.
// Ce ne sont que des suggestions : rien n'est confirmé à votre place.
const TYPES_EPARGNE = ["Livret / épargne", "Compte titre"];
function suggestionDepuisComptes(libelle, compteId) {
  const compte = compteParId(compteId), maj = normaliserLibelle(libelle);
  if (compte && TYPES_EPARGNE.includes(compte.type)) {
    if (/INT[EÉ]R[EÊ]TS?|DIVIDENDE|COUPON/.test(maj)) return { categorieId: "revenus-placements", groupeId: null };
    return { categorieId: "virements-internes", groupeId: null };
  }
  const motsEpargne = etat.comptes.filter(c => TYPES_EPARGNE.includes(c.type)).flatMap(c => [c.nom, c.banque])
    .flatMap(t => String(t || "").toUpperCase().split(/\s+/)).filter(m => m.length >= 4 && !["COMPTE", "EPARGNE", "ÉPARGNE", "BANQUE"].includes(m));
  const nomme = motsEpargne.some(m => maj.includes(m)) || /\bLIVRET\b/.test(maj);
  if (nomme && etat.comptes.some(c => TYPES_EPARGNE.includes(c.type))) return { categorieId: null, groupeId: groupePrincipal("epargne") };
  return null;
}

function categorieSuggeree(libelle, sens, compteId) {
  const regle = meilleureRegle(libelle, sens);                       // la règle la plus précise
  if (regle) return cibleDeRegle(regle);
  const parCompte = suggestionDepuisComptes(libelle, compteId);
  if (parCompte) return parCompte;
  const deduiteDesHabitudes = sens === "credit" ? null : suggestionDepuisHabitudes(libelle);
  return { categorieId: deduiteDesHabitudes || null, groupeId: null };
}

// Le compte choisi pour le prochain import (on garde le dernier utilisé).
let compteImportChoisi = null;

function rendreChoixCompte() {
  const select = document.getElementById("choix-compte-import");
  if (!etat.comptes.some(c => c.id === compteImportChoisi)) compteImportChoisi = etat.comptes[0] ? etat.comptes[0].id : null;
  select.innerHTML = etat.comptes.map((c, i) =>
    `<option value="${c.id}" ${c.id === compteImportChoisi ? "selected" : ""}>${echapper(nomDuCompte(c, i))} (${codeDevise(c.devise)})</option>`).join("");
  document.getElementById("aide-compte-import").textContent = etat.comptes.length > 1
    ? "Les montants du relevé sont dans la devise de ce compte."
    : "";
  document.querySelector(".choix-compte").hidden = etat.comptes.length < 2;
}
document.getElementById("choix-compte-import").addEventListener("change", e => { compteImportChoisi = e.target.value; });

async function traiterFichier(fichier) {
  const statut = document.getElementById("statut-import");
  statut.textContent = "Lecture en cours…";

  let brutes;
  let totauxReleve = null;
  try {
    if (fichier.name.toLowerCase().endsWith(".pdf")) {
      const texte = await extraireTextePDF(fichier);
      brutes = extraireTransactionsPDF(texte);
      totauxReleve = extraireTotauxPDF(texte);
    } else if (fichier.name.toLowerCase().endsWith(".csv")) {
      const texte = await fichier.text();
      brutes = extraireTransactionsCSV(texte);
    } else {
      statut.textContent = "Format non reconnu. Utilisez un fichier PDF ou CSV.";
      return;
    }
  } catch (err) {
    statut.textContent = "Impossible de lire ce fichier : " + err.message;
    return;
  }

  if (brutes.length === 0) {
    statut.textContent = "Aucune transaction reconnue dans ce fichier.";
    return;
  }
  statut.textContent = "";

  if (etat.comptes.length === 0) etat.comptes.push(nouveauCompte(etat.personnes[0] && etat.personnes[0].id));
  const compteId = compteImportChoisi || etat.comptes[0].id;
  let nbPreremplies = 0;
  for (const t of brutes) {
    const { categorieId, groupeId } = categorieSuggeree(t.libelle, t.sens, compteId);
    if (categorieId || groupeId) nbPreremplies++;
    etat.transactions.push({
      id: crypto.randomUUID(),
      compteId,                 // le compte auquel ce relevé appartient
      date: t.date,
      libelle: t.libelle,
      montant: t.montant, // peut être null : montant non détecté, à saisir à la main
      sens: t.sens,       // « debit », « credit » ou null (inconnu : on ne devine pas)
      categorieId,
      groupeId,                 // catégorie choisie sans sous-catégorie (sinon null)
      ignoree: false,
      confirmee: false,
    });
  }
  sauvegarderEtat(etat);

  // Vérification : les totaux importés doivent égaler ceux écrits sur le relevé.
  let verification = null;
  if (totauxReleve) {
    const somme = sens => brutes.filter(t => t.sens === sens && t.montant != null)
      .reduce((total, t) => total + t.montant, 0);
    const debit = Math.round(somme("debit") * 100) / 100;
    const credit = Math.round(somme("credit") * 100) / 100;
    verification = {
      ok: Math.abs(debit - totauxReleve.debit) < 0.005 && Math.abs(credit - totauxReleve.credit) < 0.005,
      importe: { debit, credit }, releve: totauxReleve,
    };
  }
  dernierResultatImport = { total: brutes.length, preremplies: nbPreremplies, verification };
  rendreImport();
}

const euros = n => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + symboleDevise(deviseDuCompte(compteImportChoisi));

function rendreVerification(v) {
  if (!v) return "";
  if (v.ok) {
    return `<p class="aide">✓ Vérifié : les totaux importés correspondent exactement à ceux du relevé
      (débits ${euros(v.releve.debit)} · crédits ${euros(v.releve.credit)}).</p>`;
  }
  return `<p class="aide"><b>⚠️ Les totaux ne correspondent pas au relevé.</b>
    Importé : débits ${euros(v.importe.debit)} · crédits ${euros(v.importe.credit)}.
    Relevé : débits ${euros(v.releve.debit)} · crédits ${euros(v.releve.credit)}.
    Une ligne a pu être mal lue : comparez avec votre relevé.</p>`;
}

function rendreResultat() {
  const zone = document.getElementById("resultat-import");
  if (!dernierResultatImport) { zone.innerHTML = ""; return; }
  zone.innerHTML = `
    <p>J'ai lu <b>${dernierResultatImport.total}</b> transaction${dernierResultatImport.total > 1 ? "s" : ""} —
    toutes sont enregistrées, aucune n'est filtrée.
    <b>${dernierResultatImport.preremplies}</b> ont déjà une classification suggérée
    (grâce à vos habitudes ou à ce que vous m'avez déjà appris) : vous les vérifiez et les validez dans la page Opérations.</p>
    ${rendreVerification(dernierResultatImport.verification)}
    <p><button class="bt p" data-vue="operations">Voir et classer les opérations →</button></p>`;
}

function rendreImport() {
  rendreChoixCompte();
  rendreResultat();
  const n = etat.transactions.length;
  document.getElementById("liste-transactions").innerHTML = n === 0 ? "" : `
    <p class="aide" style="text-align:center">${n} opération${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""} au total.
      Pour les voir, les classer ou les corriger :
      <button class="lien-discret-import" data-vue="operations">ouvrir la page Opérations</button></p>`;
}

// ── Dépôt de fichier ──────────────────────────────────────────────

const zoneDepot = document.getElementById("zone-depot");
const champFichier = document.getElementById("champ-fichier");

zoneDepot.addEventListener("click", () => champFichier.click());
champFichier.addEventListener("change", () => {
  if (champFichier.files[0]) traiterFichier(champFichier.files[0]);
});
zoneDepot.addEventListener("dragover", e => { e.preventDefault(); zoneDepot.classList.add("survol"); });
zoneDepot.addEventListener("dragleave", () => zoneDepot.classList.remove("survol"));
zoneDepot.addEventListener("drop", e => {
  e.preventDefault();
  zoneDepot.classList.remove("survol");
  if (e.dataTransfer.files[0]) traiterFichier(e.dataTransfer.files[0]);
});

ECRANS.import = {
  rendre: rendreImport,
  compteur: () => {
    const n = etat.transactions.length;
    return n > 0 ? `${n} transaction${n > 1 ? "s" : ""}` : "";
  },
};
