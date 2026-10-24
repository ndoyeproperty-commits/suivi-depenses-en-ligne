// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — OPÉRATIONS
// Toutes les lignes de vos relevés, sans exception. Le libellé de la
// banque n'est JAMAIS modifié : vous classez, vous corrigez un montant,
// vous ajoutez une note — et la valeur d'origine est toujours conservée.
// Ce que vous classez ici alimente directement le tableau de bord.
// Construit à partir de la maquette maquettes/operations.html.
// ═══════════════════════════════════════════════════════════════════

// Les catégories sont celles de l'utilisateur (modifiables) : le nom se lit dans les données.
const NOM_GROUPE = new Proxy({}, { get: (_, g) => nomGroupe(g) });
// Une sortie propose d'abord les besoins, une entrée d'abord les revenus.
const ORDRE_FAMILLES_SORTIE = ["besoin", "envie", "epargne", "frais", "ignore", "revenu"];
const ORDRE_FAMILLES_ENTREE = ["revenu", "ignore", "besoin", "envie", "epargne", "frais"];
const groupesOrdonnes = sens => (sens === "credit" ? ORDRE_FAMILLES_ENTREE : ORDRE_FAMILLES_SORTIE).flatMap(f => groupesDeFamille(f));

// L'état de l'écran (gardé en mémoire tant que la page est ouverte).
const ops = {
  initialise: false, annee: null, mois: "annee", multi: false, compte: "tous",
  q: "", cat: "", sens: "", tri: "date-d", puces: new Set(), sel: new Set(),
  ouvert: null, edition: null, ajout: false, affiche: 25, stables: new Set(),
};

// ── Petites aides ────────────────────────────────────────────────────
const categorieDe = t => etat.categories.find(c => c.id === t.categorieId) || null;
const groupeEffectif = t => { const c = categorieDe(t); return c ? c.enveloppeId : (t.groupeId || null); };
const estIllisible = t => t.montant == null || !t.sens;
const montantTexte = (n, devise) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + symboleDevise(devise);
const montantRond = n => Math.round(n).toLocaleString("fr-FR");
const cleDateTx = t => { const d = lireDate(t.date); return d ? d.annee * 10000 + d.mois * 100 + +t.date.slice(0, 2) : 0; };
const sousCategoriesDe = g => etat.categories.filter(c => c.enveloppeId === g && c.active);
const doublons = () => {
  const vus = new Map();
  etat.transactions.forEach(t => { const k = [t.date, t.libelle, t.montant, t.sens].join("|"); vus.set(k, (vus.get(k) || 0) + 1); });
  return t => vus.get([t.date, t.libelle, t.montant, t.sens].join("|")) > 1;
};

// L'état de départ : la même période et le même compte que le tableau de bord.
function initialiserOperations() {
  if (ops.initialise) return;
  const dispo = periodesDisponibles();
  const annees = [...dispo.keys()].sort();
  ops.annee = typeof affichage !== "undefined" && affichage.annee && dispo.has(affichage.annee) ? affichage.annee : annees[annees.length - 1] || new Date().getFullYear();
  if (typeof affichage !== "undefined" && affichage.annee === ops.annee) ops.mois = Array.isArray(affichage.mois) ? affichage.mois.slice() : "annee";
  if (typeof affichage !== "undefined" && affichage.compte && (affichage.compte === "tous" || compteParId(affichage.compte))) ops.compte = affichage.compte;
  ops.initialise = true;
}

// ── Annuler ──────────────────────────────────────────────────────────
const HISTORIQUE = [];
let minuteurToast = null;
function modifier(message, action, ids = []) {
  HISTORIQUE.push(JSON.stringify({ t: etat.transactions, r: etat.regles }));
  if (HISTORIQUE.length > 30) HISTORIQUE.shift();
  action();
  ids.forEach(id => ops.stables.add(id));
  sauvegarderEtat(etat);
  afficherToast(message);
}
// Le message « ↶ Annuler » reste affiché 9 secondes, même si la page se redessine entre-temps.
let toastActuel = null;
function afficherToast(message) {
  toastActuel = { message, fin: Date.now() + 9000 };
  dessinerToast();
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { toastActuel = null; dessinerToast(); }, 9000);
}
function dessinerToast() {
  const el = document.getElementById("toast-ops");
  if (!el) return;
  if (!toastActuel || Date.now() > toastActuel.fin) { el.classList.remove("visible"); return; }
  el.innerHTML = `<span>${echapper(toastActuel.message)}</span><button data-ops-annuler="1">↶ Annuler</button>`;
  el.classList.add("visible");
}
function retenirRegle(t) {
  retenirRegleDeLigne(t);
}

// ── Les lignes affichées ─────────────────────────────────────────────
function lignesFiltrees() {
  const q = ops.q.trim().toLowerCase();
  const estDouble = doublons();
  const lignes = etat.transactions.filter(t => {
    const d = lireDate(t.date);
    if (!d || d.annee !== ops.annee) return false;
    if (ops.mois !== "annee" && !ops.mois.includes(d.mois)) return false;
    if (ops.compte !== "tous" && t.compteId !== ops.compte) return false;
    if (ops.stables.has(t.id)) return true;
    if (ops.sens && t.sens !== ops.sens) return false;
    if (ops.cat) {
      const [type, v] = ops.cat.split(":");
      if (type === "g" && groupeEffectif(t) !== v) return false;
      if (type === "c" && t.categorieId !== v) return false;
      if (type === "v" && groupeEffectif(t)) return false;
    }
    if (q && !(t.libelle.toLowerCase().includes(q) || nomCommercant(cleApprentissage(t.libelle), "commercants", t.libelle).toLowerCase().includes(q)
      || String(t.montant).replace(".", ",").includes(q) || (t.note || "").toLowerCase().includes(q))) return false;
    if (ops.puces.has("aclasser") && groupeEffectif(t)) return false;
    if (ops.puces.has("sugg") && !(groupeEffectif(t) && !t.confirmee)) return false;
    if (ops.puces.has("ignorees") && !t.ignoree) return false;
    if (ops.puces.has("doublons") && !estDouble(t)) return false;
    if (ops.puces.has("main") && !(t.manuelle || t.original)) return false;
    if (ops.puces.has("exceptionnelles") && !t.exceptionnelle) return false;
    if (ops.puces.has("illisibles") && !estIllisible(t)) return false;
    if (ops.puces.has("sansdetail") && !(groupeEffectif(t) && !t.categorieId)) return false;
    return true;
  });
  const [champ, sens] = ops.tri.split("-");
  lignes.sort((a, b) => { const k = champ === "date" ? cleDateTx(a) - cleDateTx(b) : (a.montant || 0) - (b.montant || 0); return sens === "d" ? -k : k; });
  return lignes;
}

// ── Listes de choix ──────────────────────────────────────────────────
function optionsGroupe(courant, sens) {
  return `<option value="">— Choisir —</option>` + groupesOrdonnes(sens).map(g => `<option value="${g}" ${g === courant ? "selected" : ""}>${echapper(NOM_GROUPE[g])}</option>`).join("");
}
function optionsSousCategorie(t) {
  const g = groupeEffectif(t);
  const liste = grp => sousCategoriesDe(grp).concat(etat.categories.filter(c => c.id === t.categorieId && !c.active && c.enveloppeId === grp))
    .map(c => `<option value="${c.id}" ${c.id === t.categorieId ? "selected" : ""}>${echapper(c.nom)}</option>`).join("");
  if (g) return `<option value="">— Sans détail —</option>` + liste(g);
  return `<option value="">— Choisir —</option>` + groupesOrdonnes(t.sens).map(grp => `<optgroup label="${echapper(NOM_GROUPE[grp])}">${liste(grp)}</optgroup>`).join("");
}
function optionsFiltreCategorie() {
  const tous = groupesOrdonnes("debit");
  return `<option value="">Toutes les catégories</option><option value="v:">Pas encore classées</option>
    <optgroup label="Catégories">${tous.map(g => `<option value="g:${g}" ${ops.cat === "g:" + g ? "selected" : ""}>${echapper(NOM_GROUPE[g])}</option>`).join("")}</optgroup>`
    + tous.map(g => `<optgroup label="${echapper(NOM_GROUPE[g])} · sous-catégories">${sousCategoriesDe(g).map(c => `<option value="c:${c.id}" ${ops.cat === "c:" + c.id ? "selected" : ""}>${echapper(c.nom)}</option>`).join("")}</optgroup>`).join("");
}

// ── Une ligne ────────────────────────────────────────────────────────
function ligneOperation(t, estDouble) {
  const g = groupeEffectif(t), cat = categorieDe(t);
  const devise = deviseDuCompte(t.compteId);
  const suggeree = g && !t.confirmee;
  const couleurG = g ? couleurGroupe(g) : "#8a8a90";   // la sous-catégorie prend la couleur de sa catégorie
  const classeG = !g ? "vide" : suggeree ? "suggeree" : "ok";
  const classeS = cat ? (suggeree ? "suggeree" : "ok") : (g ? "optionnelle" : "vide");
  const entree = t.sens === "credit";
  const compte = compteParId(t.compteId);
  const mentions = [
    t.manuelle ? `<span class="badge-main">saisie à la main</span>` : "",
    t.original && !t.manuelle ? `<span class="badge-main">modifiée</span>` : "",
    t.exceptionnelle ? `<span class="badge-main" title="Exclue des moyennes et des budgets récurrents">exceptionnelle</span>` : "",
    estDouble(t) ? `<span class="badge-main">doublon possible ?</span>` : "",
    t.note ? ` · ✎ ${echapper(t.note)}` : "",
  ].join("");
  const montant = estIllisible(t)
    ? `<span class="manquant">${t.montant == null ? "Montant ?" : montantTexte(t.montant, devise)}</span>`
    : `${entree ? "+" : "−"} ${montantTexte(t.montant, devise)}`;
  const actionValider = g && suggeree && !t.ignoree ? `<button class="ico valider" data-ops-valider="${t.id}" title="Valider cette classification">✓</button>` : "";
  return `<div class="ligne ${t.ignoree ? "ignoree" : ""} ${ops.sel.has(t.id) ? "sel" : ""} ${ops.stables.has(t.id) ? "touchee" : ""}" data-id="${t.id}">
    <input type="checkbox" data-ops-sel="${t.id}" ${ops.sel.has(t.id) ? "checked" : ""} aria-label="Sélectionner cette ligne">
    <div class="date">${t.date.slice(0, 5)}</div>
    <div><div class="lib-brut" data-ops-ouvrir="${t.id}" title="${echapper(t.libelle)}">${echapper(t.libelle)}</div>
      <div class="lib-sous">${echapper(nomCommercant(cleApprentissage(t.libelle), "commercants", t.libelle))}${etat.comptes.length > 1 ? " · " + echapper(compte ? nomDuCompte(compte) : "Compte supprimé") : ""}${mentions}</div></div>
    <div><span class="cat groupe-cat ${classeG}" style="--c:${couleurG}"><select data-ops-grp="${t.id}" ${t.ignoree ? "disabled" : ""}>${optionsGroupe(g, t.sens)}</select></span></div>
    <div><span class="cat sous-point ${classeS}" style="--c:${couleurG}"><select data-ops-cat="${t.id}" ${t.ignoree ? "disabled" : ""}>${optionsSousCategorie(t)}</select></span>${g ? "" : `<span class="etat">à classer</span>`}</div>
    <div class="d montant ${entree ? "entree" : ""}">${montant}</div>
    <div class="actions">${actionValider}
      <button class="ico" data-ops-ign="${t.id}" title="${t.ignoree ? "Reprendre en compte" : "Ignorer : ne compte nulle part"}">${t.ignoree ? "↺" : "⊘"}</button></div>
  </div>${ops.ouvert === t.id ? detailOperation(t) : ""}`;
}

function detailOperation(t) {
  const devise = deviseDuCompte(t.compteId);
  const cle = cleApprentissage(t.libelle);
  const memes = etat.transactions.filter(x => x.id !== t.id && cleApprentissage(x.libelle) === cle);
  if (ops.edition === t.id) {
    return `<div class="detail"><div class="champs">
      <label>Date<input id="e-date" value="${echapper(t.date)}" size="10"></label>
      ${t.manuelle ? `<label>Libellé<input id="e-lib" class="large" value="${echapper(t.libelle)}"></label>` : ""}
      <label>Montant<input id="e-mt" value="${t.montant != null ? String(t.montant).replace(".", ",") : ""}" size="9" inputmode="decimal"></label>
      <label>Sens<select id="e-sens"><option value="debit" ${t.sens === "debit" ? "selected" : ""}>Sortie (−)</option><option value="credit" ${t.sens === "credit" ? "selected" : ""}>Entrée (+)</option>${t.sens ? "" : '<option value="" selected>— ? —</option>'}</select></label>
      <label>Compte<select id="e-cpt">${etat.comptes.map((c, i) => `<option value="${c.id}" ${c.id === t.compteId ? "selected" : ""}>${echapper(nomDuCompte(c, i))}</option>`).join("")}</select></label>
      <label>Note<input id="e-note" class="large" value="${echapper(t.note || "")}" placeholder="Facultatif : un mémo pour vous"></label>
      <button class="bt p" data-ops-enregistrer="${t.id}">Enregistrer</button><button class="bt s" data-ops-annuler-edit="1">Annuler</button>
      ${t.manuelle ? `<button class="bt s danger" data-ops-supprimer="${t.id}">Supprimer cette opération</button>` : ""}
    </div>${t.manuelle ? "" : `<p>Le libellé du relevé ne se modifie pas. Ce que vous changez ici est noté « modifiée », avec la valeur d'origine conservée.</p>`}</div>`;
  }
  const o = t.original;
  const origine = o ? `<br>Le relevé indiquait : ${echapper(o.date || t.date)} · ${o.sens === "credit" ? "crédit" : o.sens === "debit" ? "débit" : "sens illisible"} ${o.montant != null ? montantTexte(o.montant, deviseDuCompte(o.compteId || t.compteId)) : "(montant illisible)"}` : "";
  const g = groupeEffectif(t);
  return `<div class="detail">${t.manuelle ? "Opération saisie à la main :" : "Ligne du relevé, telle qu'elle est écrite :"}
    <code>${echapper(t.date)} · ${echapper(t.libelle)} · ${t.sens === "credit" ? "crédit" : t.sens === "debit" ? "débit" : "sens ?"} ${t.montant != null ? montantTexte(t.montant, devise) : "montant ?"}</code>${origine}
    <div class="liens"><button data-ops-edit="${t.id}">✎ Modifier le montant, le sens, la date, le compte ou ajouter une note</button>
      <button data-ops-exc="${t.id}">${t.exceptionnelle ? "↺ Ne plus considérer comme exceptionnelle" : "Marquer comme dépense exceptionnelle (hors des moyennes et des budgets)"}</button>
      ${memes.length ? `<button data-ops-memes="${t.id}">Voir les ${memes.length} autres lignes « ${echapper(nomCommercant(cle, "commercants", t.libelle))} »</button>` : ""}
      ${g && memes.some(x => !groupeEffectif(x)) ? `<button data-ops-propager="${t.id}">Proposer cette classification aux ${memes.filter(x => !groupeEffectif(x)).length} lignes « ${echapper(nomCommercant(cle, "commercants", t.libelle))} » non classées</button>` : ""}</div></div>`;
}

function formulaireAjout() {
  if (!ops.ajout) return "";
  const today = new Date().toLocaleDateString("fr-FR");
  return `<div class="ajout"><h3>Ajouter une opération à la main</h3><div class="champs">
    <label>Date<input id="a-date" value="${today}" size="10"></label>
    <label>Libellé<input id="a-lib" class="large" placeholder="Ex. Marché, coiffeur (espèces)"></label>
    <label>Montant<input id="a-mt" size="9" inputmode="decimal" placeholder="0,00"></label>
    <label>Sens<select id="a-sens"><option value="debit">Sortie (−)</option><option value="credit">Entrée (+)</option></select></label>
    <label>Compte<select id="a-cpt">${etat.comptes.map((c, i) => `<option value="${c.id}" ${c.id === (ops.compte !== "tous" ? ops.compte : etat.comptes[0].id) ? "selected" : ""}>${echapper(nomDuCompte(c, i))}</option>`).join("")}</select></label>
    <label>Catégorie<select id="a-grp">${optionsGroupe("", "debit")}</select></label>
    <button class="bt p" data-ops-ajouter="1">Ajouter</button><button class="bt s" data-ops-annuler-ajout="1">Annuler</button></div>
    <p>Pour les dépenses qui ne passent pas par un relevé (espèces…). Elle est marquée « saisie à la main » et compte comme les autres.</p></div>`;
}

// ── La page ──────────────────────────────────────────────────────────
function rendreOperations() {
  const conteneur = document.getElementById("etape-operations");
  initialiserOperations();
  const dispo = periodesDisponibles();

  if (etat.transactions.length === 0) {
    conteneur.innerHTML = `<div class="ops-page"><h1>Opérations</h1>
      <div class="vide-liste">Aucune opération pour l'instant.<br><br>
      <button class="bt p" data-vue="import">Importer mes relevés</button>
      <div style="margin-top:10px"><button class="lien-ops" data-ops-ajout-vide="1">ou ajouter une opération à la main</button></div></div>${ops.ajout ? formulaireAjout() : ""}</div>
      <div class="toast" id="toast-ops"></div>`;
    return;
  }

  const annees = [...dispo.keys()].sort();
  if (!annees.includes(ops.annee)) ops.annee = annees[annees.length - 1];
  const moisDispo = dispo.get(ops.annee) || new Set();
  const filtres = `
    <div class="filtres-ops">
      <div class="groupe">${annees.map(a => `<button class="pill ${a === ops.annee ? "on" : ""}" data-ops-an="${a}">${a}</button>`).join("")}
        <button class="pill ${ops.mois === "annee" ? "on" : ""}" data-ops-mois="annee">Toute l'année</button>
        <button class="pill ${ops.multi ? "on" : ""}" data-ops-multi="1">＋ Plusieurs mois</button></div>
      <div class="groupe">${MOIS_COURTS.map((m, i) => `<button class="pill ${ops.mois !== "annee" && ops.mois.includes(i) ? "on" : ""}" data-ops-mois="${i}" ${moisDispo.has(i) ? "" : "disabled"}>${m}</button>`).join("")}</div>
      ${etat.comptes.length > 1 ? `<div class="groupe"><select class="sel" id="ops-compte"><option value="tous">Tous les comptes</option>
        ${etat.comptes.map((c, i) => `<option value="${c.id}" ${c.id === ops.compte ? "selected" : ""}>${echapper(nomDuCompte(c, i))} (${codeDevise(c.devise)})</option>`).join("")}</select></div>` : ""}
    </div>`;

  // Les chiffres de la période (pour les puces) : ce qui compte, devise par devise.
  const estDouble = doublons();
  const periodeCompte = etat.transactions.filter(t => {
    const d = lireDate(t.date);
    return d && d.annee === ops.annee && (ops.mois === "annee" || ops.mois.includes(d.mois)) && (ops.compte === "tous" || t.compteId === ops.compte);
  });
  const n = {
    aclasser: periodeCompte.filter(t => !groupeEffectif(t)).length,
    sugg: periodeCompte.filter(t => groupeEffectif(t) && !t.confirmee).length,
    sansdetail: periodeCompte.filter(t => groupeEffectif(t) && !t.categorieId).length,
    ignorees: periodeCompte.filter(t => t.ignoree).length,
    doublons: periodeCompte.filter(estDouble).length,
    main: periodeCompte.filter(t => t.manuelle || t.original).length,
    exceptionnelles: periodeCompte.filter(t => t.exceptionnelle).length,
    illisibles: periodeCompte.filter(estIllisible).length,
  };
  const puce = (cle, texte, nb, alerte) => `<button class="puce-f ${ops.puces.has(cle) ? "on" : ""} ${alerte && nb ? "alerte" : ""}" data-ops-puce="${cle}">${texte} <b>${nb}</b></button>`;
  const puces = puce("aclasser", "À classer", n.aclasser, true) + puce("sugg", "Suggérées, à valider", n.sugg, true)
    + puce("sansdetail", "Sans détail", n.sansdetail) + puce("illisibles", "Montant ou sens illisible", n.illisibles, true)
    + puce("ignorees", "Ignorées", n.ignorees) + puce("doublons", "Doublons possibles", n.doublons) + puce("main", "Modifiées ou saisies à la main", n.main) + puce("exceptionnelles", "Exceptionnelles", n.exceptionnelles);

  const lignes = lignesFiltrees();
  // Ce que cette liste pèse dans le tableau de bord, catégorie par catégorie (net des remboursements)
  const total = {}; ["revenu", "besoin", "envie", "epargne", "frais"].forEach(f => total[f] = {});
  lignes.filter(t => !t.ignoree && !estIllisible(t) && total[familleDe(groupeEffectif(t))]).forEach(t => {
    const f = familleDe(groupeEffectif(t)), dv = deviseDuCompte(t.compteId), s = t.sens === "credit" ? 1 : -1;
    total[f][dv] = (total[f][dv] || 0) + (f === "revenu" ? s : -s) * t.montant;
  });
  const texteTotal = f => { const e = Object.entries(total[f]); return e.length ? e.map(([dv, v]) => (v < 0 ? "−" : f === "revenu" ? "+" : "") + montantRond(Math.abs(v)) + " " + symboleDevise(dv)).join(" · ") : "—"; };
  const nbNon = lignes.filter(t => !groupeEffectif(t) && !t.ignoree).length;
  const pastillesTotaux = ["revenu", "besoin", "envie", "epargne", "frais"].filter(f => f !== "frais" || aDesFrais()).map(f =>
    `<span class="gchip" style="--c:${couleurFamille(f)}"><i></i>${echapper(nomFamille(f))} <b>${texteTotal(f)}</b></span>`).join("")
    + (nbNon ? `<span class="gchip" style="--c:#b3261e"><i></i>Non classées <b>${nbNon}</b></span>` : "");

  const filtreActif = ops.q || ops.cat || ops.sens || ops.puces.size;
  const vues = lignes.slice(0, ops.affiche);
  const reste = lignes.length - ops.affiche;

  conteneur.innerHTML = `<div class="ops-page">
    <h1>Opérations</h1>
    <p class="intro">Toutes les lignes de vos relevés, sans exception. Le libellé est celui de la banque : il n'est jamais modifié.</p>
    ${filtres}
    <div class="outils">
      <div class="recherche">
        <input id="ops-q" type="search" value="${echapper(ops.q)}" placeholder="Rechercher un libellé, un commerçant, un montant…">
        <select class="sel" id="ops-cat">${optionsFiltreCategorie()}</select>
        <select class="sel" id="ops-sens">
          <option value="">Entrées et sorties</option><option value="debit" ${ops.sens === "debit" ? "selected" : ""}>Sorties seulement</option><option value="credit" ${ops.sens === "credit" ? "selected" : ""}>Entrées seulement</option></select>
        <select class="sel" id="ops-tri">
          <option value="date-d" ${ops.tri === "date-d" ? "selected" : ""}>Plus récentes d'abord</option><option value="date-a" ${ops.tri === "date-a" ? "selected" : ""}>Plus anciennes d'abord</option>
          <option value="mont-d" ${ops.tri === "mont-d" ? "selected" : ""}>Montant décroissant</option><option value="mont-a" ${ops.tri === "mont-a" ? "selected" : ""}>Montant croissant</option></select>
      </div>
      <div class="puces">${puces}</div>
    </div>
    <div class="haut-liste"><div class="gchips">${pastillesTotaux}</div><button class="bt p" data-ops-ajout="1">＋ Ajouter une opération à la main</button></div>
    ${formulaireAjout()}
    <div class="resume"><span><b>${lignes.length}</b> opération${lignes.length > 1 ? "s" : ""} affichée${lignes.length > 1 ? "s" : ""}</span>
      <span>Les totaux ci-dessus sont ceux du tableau de bord pour cette sélection.</span>
      ${filtreActif ? `<button class="eff" data-ops-eff="1">Effacer les filtres</button>` : ""}</div>
    <div class="liste"><div class="ligne tete"><span></span><span>Date</span><span>Libellé du relevé</span><span>Catégorie</span><span>Sous-catégorie</span><span class="d">Montant</span><span></span></div>
      ${vues.length ? vues.map(t => ligneOperation(t, estDouble)).join("") : `<div class="vide-liste">Aucune opération ne correspond à ces filtres.</div>`}</div>
    ${reste > 0 ? `<button class="plus" data-ops-plus="1">Afficher ${Math.min(25, reste)} de plus (${reste} restantes)</button>` : ""}
    <div class="legende-p"><span><i class="plein"></i>validée par vous</span><span><i class="pointille"></i>suggérée : à valider avec ✓</span><span><i class="pointille gris"></i>pas encore classée</span></div>
    <p class="note-bas">Cliquez sur un libellé pour voir la ligne telle qu'elle est écrite sur le relevé.
      <button class="lien-ops" data-ops-tout-effacer="1">Effacer toutes les opérations importées…</button></p>
  </div>
  <div class="barre-bas" id="barre-ops"></div>
  <div class="toast" id="toast-ops"></div>`;
  rendreBarreBas();
  dessinerToast();
}

function rendreBarreBas(proposition) {
  const b = document.getElementById("barre-ops");
  if (!b) return;
  if (proposition) { b.className = "barre-bas visible"; b.innerHTML = proposition; return; }
  if (ops.sel.size) {
    b.className = "barre-bas visible";
    b.innerHTML = `<span>${ops.sel.size} sélectionnée${ops.sel.size > 1 ? "s" : ""}</span>
      <select id="ops-b-grp">${optionsGroupe("", "debit")}</select><button class="p" data-ops-b="classer">Classer dans cette catégorie</button>
      <button data-ops-b="ignorer">Ignorer</button><button data-ops-b="annuler">Annuler</button>`;
  } else b.className = "barre-bas";
}

function proposerApprentissage(t) {
  const cle = cleApprentissage(t.libelle);
  const memes = etat.transactions.filter(x => x.id !== t.id && !groupeEffectif(x) && cleApprentissage(x.libelle) === cle);
  if (!memes.length || !groupeEffectif(t)) return;
  const cat = categorieDe(t);
  rendreBarreBas(`<span>Retenir : « ${echapper(nomCommercant(cle, "commercants", t.libelle))} » → <b>${echapper(cat ? cat.nom : NOM_GROUPE[groupeEffectif(t)])}</b>.
    ${memes.length} autre${memes.length > 1 ? "s" : ""} ligne${memes.length > 1 ? "s" : ""} non classée${memes.length > 1 ? "s" : ""}</span>
    <button class="p" data-ops-appliquer="${t.id}">Leur proposer la même</button><button data-ops-b="fermer">Non merci</button>`);
}

// Propose la classification de `modele` aux lignes sans catégorie du même commerçant (jamais confirmée à votre place).
function proposerAuxMemes(modele) {
  const cle = cleApprentissage(modele.libelle);
  const cibles = etat.transactions.filter(x => !groupeEffectif(x) && cleApprentissage(x.libelle) === cle);
  modifier(`${cibles.length} ligne${cibles.length > 1 ? "s" : ""} classée${cibles.length > 1 ? "s" : ""} en suggestion : à valider avec ✓.`, () => {
    cibles.forEach(x => { x.categorieId = modele.categorieId; x.groupeId = modele.categorieId ? null : modele.groupeId; x.confirmee = false; });
  }, cibles.map(x => x.id));
}

// ── Les actions ──────────────────────────────────────────────────────
const txParId = id => etat.transactions.find(t => t.id === id);
const reinitialiserStables = () => ops.stables.clear();

document.getElementById("etape-operations").addEventListener("click", e => {
  const cible = k => e.target.closest(`[data-ops-${k}]`);
  let x;
  if ((x = cible("an"))) { ops.annee = +x.dataset.opsAn; ops.mois = "annee"; reinitialiserStables(); }
  else if ((x = cible("multi"))) ops.multi = !ops.multi;
  else if ((x = cible("mois"))) {
    if (x.dataset.opsMois === "annee") ops.mois = "annee";
    else if (ops.multi || e.shiftKey || e.metaKey || e.ctrlKey) {
      const i = +x.dataset.opsMois, actuels = ops.mois === "annee" ? [] : ops.mois.slice();
      const nouveaux = actuels.includes(i) ? actuels.filter(v => v !== i) : [...actuels, i].sort((a, b) => a - b);
      ops.mois = nouveaux.length ? nouveaux : "annee";
    } else ops.mois = [+x.dataset.opsMois];
    ops.affiche = 25; reinitialiserStables();
  }
  else if ((x = cible("puce"))) { const k = x.dataset.opsPuce; ops.puces.has(k) ? ops.puces.delete(k) : ops.puces.add(k); ops.affiche = 25; reinitialiserStables(); }
  else if (cible("eff")) { ops.q = ""; ops.cat = ""; ops.sens = ""; ops.puces.clear(); reinitialiserStables(); }
  else if ((x = cible("valider"))) {
    const t = txParId(x.dataset.opsValider);
    modifier("Classification validée.", () => { t.confirmee = true; retenirRegle(t); }, [t.id]);
    rendreOperations(); proposerApprentissage(t); return;
  }
  else if ((x = cible("ign"))) { const t = txParId(x.dataset.opsIgn); modifier(t.ignoree ? "Ligne reprise en compte." : "Ligne ignorée : elle ne compte plus nulle part.", () => { t.ignoree = !t.ignoree; }, [t.id]); }
  else if ((x = cible("ouvrir"))) { ops.ouvert = ops.ouvert === x.dataset.opsOuvrir ? null : x.dataset.opsOuvrir; ops.edition = null; }
  else if ((x = cible("memes"))) { const t = txParId(x.dataset.opsMemes); ops.q = nomCommercant(cleApprentissage(t.libelle), "commercants", t.libelle); ops.ouvert = null; reinitialiserStables(); }
  else if ((x = cible("propager")) || (x = cible("appliquer"))) {
    proposerAuxMemes(txParId(x.dataset.opsPropager || x.dataset.opsAppliquer)); rendreBarreBas();
  }
  else if ((x = cible("exc"))) {
    const t = txParId(x.dataset.opsExc);
    modifier(t.exceptionnelle ? "Ligne remise parmi les dépenses courantes." : "Ligne marquée exceptionnelle : elle sort des moyennes et des budgets récurrents (elle reste comptée dans vos totaux).", () => { t.exceptionnelle = !t.exceptionnelle; }, [t.id]);
  }
  else if ((x = cible("edit"))) ops.edition = x.dataset.opsEdit;
  else if (cible("annuler-edit")) ops.edition = null;
  else if ((x = cible("enregistrer"))) {
    const t = txParId(x.dataset.opsEnregistrer);
    const valeur = parseFloat(document.getElementById("e-mt").value.replace(/\s/g, "").replace(",", "."));
    const date = document.getElementById("e-date").value.trim();
    const sens = document.getElementById("e-sens").value;
    if (isNaN(valeur) || valeur < 0 || !lireDate(date) || !sens) { alert("Montant, sens ou date illisible (la date s'écrit jj/mm/aaaa)."); return; }
    modifier("Opération modifiée (la valeur d'origine est conservée).", () => {
      if (!t.original && !t.manuelle) t.original = { montant: t.montant, sens: t.sens, date: t.date, compteId: t.compteId };
      t.montant = Math.round(valeur * 100) / 100; t.sens = sens; t.date = date;
      t.compteId = document.getElementById("e-cpt").value; t.note = document.getElementById("e-note").value.trim();
      const lib = document.getElementById("e-lib"); if (lib && lib.value.trim()) t.libelle = lib.value.trim();
    }, [t.id]);
    ops.edition = null;
  }
  else if ((x = cible("supprimer"))) {
    const t = txParId(x.dataset.opsSupprimer);
    if (!confirm("Supprimer cette opération saisie à la main ?")) return;
    modifier("Opération supprimée.", () => { etat.transactions = etat.transactions.filter(v => v.id !== t.id); });
    ops.ouvert = null; ops.edition = null;
  }
  else if (cible("ajout") || cible("ajout-vide")) ops.ajout = !ops.ajout;
  else if (cible("annuler-ajout")) ops.ajout = false;
  else if (cible("ajouter")) {
    const valeur = parseFloat(document.getElementById("a-mt").value.replace(/\s/g, "").replace(",", "."));
    const date = document.getElementById("a-date").value.trim(), libelle = document.getElementById("a-lib").value.trim();
    if (isNaN(valeur) || valeur <= 0 || !lireDate(date) || !libelle) { alert("Date (jj/mm/aaaa), libellé et montant sont nécessaires."); return; }
    const groupeId = document.getElementById("a-grp").value || null;
    const nouvelle = { id: crypto.randomUUID(), compteId: document.getElementById("a-cpt").value, date, libelle, montant: Math.round(valeur * 100) / 100,
      sens: document.getElementById("a-sens").value, categorieId: null, groupeId, ignoree: false, confirmee: true, manuelle: true };
    modifier("Opération ajoutée : elle compte dans le tableau de bord.", () => etat.transactions.push(nouvelle), [nouvelle.id]);
    ops.ajout = false;
    const d = lireDate(date);
    ops.annee = d.annee; if (ops.mois !== "annee" && !ops.mois.includes(d.mois)) ops.mois = "annee";
  }
  else if (cible("annuler")) {
    if (HISTORIQUE.length) {
      const avant = JSON.parse(HISTORIQUE.pop());
      etat.transactions = avant.t; etat.regles = avant.r; sauvegarderEtat(etat);
      toastActuel = null;
    }
  }
  else if ((x = cible("b"))) {
    const action = x.dataset.opsB;
    if (action === "annuler") ops.sel.clear();
    else if (action === "fermer") { rendreBarreBas(); return; }
    else if (action === "ignorer") { const ids = [...ops.sel]; modifier(`${ids.length} ligne${ids.length > 1 ? "s" : ""} ignorée${ids.length > 1 ? "s" : ""}.`, () => ids.forEach(id => { txParId(id).ignoree = true; }), ids); ops.sel.clear(); }
    else if (action === "classer") {
      const g = document.getElementById("ops-b-grp").value; if (!g) return;
      const ids = [...ops.sel];
      modifier(`${ids.length} ligne${ids.length > 1 ? "s" : ""} classée${ids.length > 1 ? "s" : ""} dans ${NOM_GROUPE[g]}.`, () => ids.forEach(id => {
        const t = txParId(id), c = categorieDe(t);
        if (c && c.enveloppeId !== g) t.categorieId = null;     // la sous-catégorie ne correspond plus : à rechoisir
        if (!t.categorieId) t.groupeId = g;
        t.confirmee = true; retenirRegle(t);
      }), ids);
      ops.sel.clear();
    }
  }
  else if (cible("plus")) ops.affiche += 25;
  else if (cible("tout-effacer")) {
    if (!confirm(`Effacer les ${etat.transactions.length} opérations importées ?\n\nVotre paramétrage et les catégories apprises sont conservés. Vous pourrez réimporter vos relevés.`)) return;
    HISTORIQUE.length = 0; etat.transactions = []; sauvegarderEtat(etat);
  }
  else return;
  rendreOperations();
});

document.getElementById("etape-operations").addEventListener("change", e => {
  const d = e.target.dataset, id = e.target.id;
  if (d.opsSel) { e.target.checked ? ops.sel.add(d.opsSel) : ops.sel.delete(d.opsSel); rendreOperations(); }
  else if (d.opsGrp) {
    const t = txParId(d.opsGrp), g = e.target.value || null, c = categorieDe(t);
    modifier(g ? `Classée dans ${NOM_GROUPE[g]}${c && c.enveloppeId !== g ? " (la sous-catégorie est à rechoisir)" : ""}.` : "Classification retirée.", () => {
      if (c && c.enveloppeId !== g) t.categorieId = null;
      if (!t.categorieId) t.groupeId = g;
      t.confirmee = Boolean(g); if (g) retenirRegle(t);
    }, [t.id]);
    rendreOperations(); if (g) proposerApprentissage(t);
  } else if (d.opsCat) {
    const t = txParId(d.opsCat), valeur = e.target.value || null;
    const cat = etat.categories.find(c => c.id === valeur);
    modifier(cat ? `Classée : ${cat.nom} · ${NOM_GROUPE[cat.enveloppeId]}.` : "Sous-catégorie retirée (la catégorie est conservée).", () => {
      const groupeAvant = groupeEffectif(t);
      t.categorieId = valeur;
      t.groupeId = valeur ? null : groupeAvant;
      t.confirmee = Boolean(valeur || groupeAvant); if (t.confirmee) retenirRegle(t);
    }, [t.id]);
    rendreOperations(); if (cat) proposerApprentissage(t);
  }
  else if (id === "ops-compte") { ops.compte = e.target.value; reinitialiserStables(); rendreOperations(); }
  else if (id === "ops-cat") { ops.cat = e.target.value; ops.affiche = 25; reinitialiserStables(); rendreOperations(); }
  else if (id === "ops-sens") { ops.sens = e.target.value; reinitialiserStables(); rendreOperations(); }
  else if (id === "ops-tri") { ops.tri = e.target.value; rendreOperations(); }
});
// La recherche se met à jour en tapant, sans perdre le curseur.
document.getElementById("etape-operations").addEventListener("input", e => {
  if (e.target.id !== "ops-q") return;
  ops.q = e.target.value; ops.affiche = 25; reinitialiserStables();
  const position = e.target.selectionStart;
  rendreOperations();
  const champ = document.getElementById("ops-q");
  champ.focus(); champ.setSelectionRange(position, position);
});

// ── Arriver ici depuis le tableau de bord, déjà filtré (ex. « 12 à classer ») ──
document.addEventListener("click", e => {
  const lien = e.target.closest("[data-ops-filtre]");
  if (!lien) return;
  e.preventDefault();
  const f = JSON.parse(lien.dataset.opsFiltre);
  ops.initialise = false; initialiserOperations();     // même période et même compte que le tableau de bord
  ops.puces = new Set(f.puces || []); ops.q = f.q || ""; ops.cat = f.cat || ""; ops.sens = ""; ops.sel.clear();
  if (f.annee != null && Array.isArray(f.mois)) { ops.annee = f.annee; ops.mois = f.mois.slice(); ops.multi = f.mois.length > 1; ops.compte = f.compte || "tous"; }   // lien depuis le Bilan : le mois en question
  ops.ouvert = null; ops.edition = null; ops.affiche = 25; reinitialiserStables();
  irA("operations");
});

ECRANS.operations = { rendre: rendreOperations, compteur: () => "" };
