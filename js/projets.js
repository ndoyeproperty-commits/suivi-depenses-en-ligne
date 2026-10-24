// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — PROJETS
// Construit à partir de la maquette maquettes/projet.html.
// « Atteindre un montant à une date » : l'appli compare ce qu'il faut mettre
// de côté par mois avec ce que vos relevés montrent que vous pouvez dégager
// (capacité, calculée par le Bilan sur les 3 derniers mois).
//
// RÈGLES : ② aucun chiffre sans données (« Non renseigné » sinon) ; un projet
// est une HYPOTHÈSE : il ne modifie jamais vos opérations ni vos totaux ;
// pas de simulation de prêt. Hypothèses affichées : sans intérêts, sans
// inflation, revenus et dépenses comme ces derniers mois.
// ═══════════════════════════════════════════════════════════════════

const prj = { ouverts: new Set(), form: null, initialise: false };
const TYPES_PROJET = ["Achat", "Voyage", "Apport", "Autre"];
const SEUIL_FAISABLE = 0.85;     // au-dessus de 85 % de la capacité : « serré »

const aujourdhui = () => { const d = new Date(); return { annee: d.getFullYear(), mois: d.getMonth() }; };
const moisEntre = (x, y) => (y.annee - x.annee) * 12 + (y.mois - x.mois);
const libMoisAnnee = (annee, mois) => { const nm = annee * 12 + mois; return NOMS_MOIS_LONGS[((nm % 12) + 12) % 12] + " " + Math.floor(nm / 12); };
const NOMS_MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const eurP = n => euroBilan(n, deviseDuBilan());

// ── Capacité à mettre de côté ───────────────────────────────────────
function capaciteProjets() {
  const prefs = etat.preferences || {};
  const complet = calculerBilan(null), recent = calculerBilan(3);
  const auto = complet.n >= BILAN_MOIS_MINI && recent.revenusMoy > 0 ? Math.max(0, recent.resteMoy) : null;
  const saisie = typeof prefs.capaciteProjets === "number" ? prefs.capaciteProjets : null;
  const epargne = auto != null ? Math.max(0, recent.epargneMoy) : 0;
  let valeur = null, source = null;
  if (saisie != null) { valeur = saisie; source = "saisie"; }
  else if (auto != null) { valeur = auto + (prefs.projetsInclureEpargne ? epargne : 0); source = "auto"; }
  return { valeur, source, auto, epargne, moyenne: complet.n >= BILAN_MOIS_MINI ? complet.resteMoy : null, nbMois: complet.n, bilanComplet: complet };
}

// Ce que vos relevés montrent déjà rangé dans la sous-catégorie du projet.
function epargneSuivie(p) {
  if (!p.categorieId) return 0;
  let total = 0;
  for (const { t, d, montant, signe } of transactionsComptees({ compte: "tous", devise: deviseDuBilan() }))
    if (t.categorieId === p.categorieId && moisEntre(p.debut, d) >= 0) total += -signe * montant;   // seulement depuis le début du projet
  return Math.max(0, total);
}
const misDeCote = p => (p.deja || 0) + epargneSuivie(p);

function calculProjet(p, cap) {
  const mr = moisEntre(aujourdhui(), p), manque = Math.max(0, p.cible - misDeCote(p)), res = { mr, manque };
  if (manque === 0) { res.etat = "atteint"; return res; }
  if (mr < 1) { res.etat = "passee"; return res; }
  res.parMois = manque / mr;
  if (cap == null) { res.etat = "inconnu"; return res; }
  res.ratio = cap > 0 ? res.parMois / cap : Infinity;
  res.etat = res.ratio <= SEUIL_FAISABLE ? "ok" : res.ratio <= 1 ? "serre" : "non";
  res.atteignable = misDeCote(p) + cap * mr;
  return res;
}

// Le projet n°1 est servi en premier, le suivant reçoit ce qui reste.
function repartirProjets(liste, cap) {
  let reste = cap;
  return liste.map(p => { const dispo = reste, c = calculProjet(p, dispo); if (reste != null) reste = Math.max(0, reste - (c.parMois || 0)); return { p, c, dispo }; });
}

// Les pistes du Bilan qui libéreraient de l'argent chaque mois.
function pistesBilanPourProjets(complet) {
  if (complet.n < BILAN_MOIS_COMPARAISON) return [];
  const l = [];
  complet.categories.forEach(c => { if (c.famille === "epargne") return; c.evenements.forEach(e => { if (e.type === "niveau" && e.sens > 0 && e.delta > 0) l.push(e); }); });
  return l.sort((a, b) => b.delta - a.delta).slice(0, 2);
}

const BADGES_PROJET = { ok: ["ok", "Faisable"], serre: ["serre", "Serré"], non: ["non", "Au-delà de votre capacité"], inconnu: ["", "À estimer"], passee: ["non", "Date dépassée"], atteint: ["ok", "Objectif atteint"] };

function comparaisonProjet(c, dispo) {
  if (c.parMois == null) return "";
  const mx = Math.max(c.parMois, dispo || 0, 1);
  return `<h4>Par mois</h4><div class="comp"><div class="l"><span>Il faut</span><div class="bar"><i style="width:${c.parMois / mx * 100}%;background:var(--epargne)"></i></div><span class="m">${eurP(c.parMois)}</span></div>
    <div class="l"><span>Vous pouvez</span><div class="bar"><i style="width:${(dispo || 0) / mx * 100}%;background:${c.etat === "non" ? "var(--alerte)" : "var(--noir2)"}"></i></div><span class="m">${eurP(dispo || 0)}</span></div></div>`;
}

function leviersProjet(p, c, dispo, cap, pistes) {
  if (c.etat === "serre") return `<h4>Où vous en êtes</h4><div class="levier">Il vous reste <b>${eurP(dispo - c.parMois)} par mois</b> de marge une fois ce projet financé.</div>`;
  if (c.etat !== "non") return "";
  const l = [];
  if (dispo > 0) {
    const decale = Math.ceil(c.manque / dispo), t = aujourdhui();
    l.push(`<div class="levier"><b>Décaler la date</b><span class="eff">À ${eurP(dispo)} par mois, vous atteignez ${eurP(p.cible)} en <b>${libMoisAnnee(t.annee, t.mois + decale)}</b> (+${decale - c.mr} mois).</span></div>`);
    l.push(`<div class="levier"><b>Viser un peu moins</b><span class="eff">Avec ${eurP(dispo)} par mois, vous pouvez viser <b>${eurP(c.atteignable)}</b> pour ${libMoisAnnee(p.annee, p.mois)}.</span></div>`);
  } else l.push(`<div class="levier"><b>Ce projet passe après vos projets prioritaires</b><span class="eff">Toute la capacité est déjà utilisée par eux. Changez l'ordre de priorité, ou allongez leurs délais.</span></div>`);
  pistes.forEach(e => {
    const d2 = dispo + e.delta, c2 = calculProjet(p, d2);
    l.push(`<div class="levier"><b>Une piste de votre Bilan</b> : ${echapper(e.titre)} (environ ${eurP(e.delta)} par mois)<span class="eff">La capacité pour ce projet passerait à ${eurP(d2)} par mois : ${c2.etat === "ok" ? "il devient <b>faisable</b>" : c2.etat === "serre" ? "il devient <b>faisable de justesse</b>" : "cela ne suffit pas à lui seul"}. <button class="lien" data-vue="bilan">Voir dans le Bilan</button></span></div>`);
  });
  const prefs = etat.preferences || {};
  if (cap.source === "auto" && !prefs.projetsInclureEpargne && cap.epargne > 0) l.push(`<div class="levier"><b>Utiliser votre épargne actuelle</b> (${eurP(cap.epargne)} par mois)<span class="eff">Cochez « Inclure mon épargne actuelle » dans la capacité ci-dessus si vous voulez la rediriger vers vos projets.</span></div>`);
  return `<h4>Pour y arriver</h4>${l.join("")}`;
}

function carteProjet(item, rang, total, cap, pistes) {
  const { p, c, dispo } = item, [cls, txt] = BADGES_PROJET[c.etat], ouv = prj.ouverts.has(p.id);
  const suivie = epargneSuivie(p), mis = (p.deja || 0) + suivie, pct = p.cible > 0 ? Math.min(100, Math.round(mis / p.cible * 100)) : 0;
  let cle = "";
  if (c.etat === "atteint") cle = `<p class="cle">Vous avez déjà de côté le montant visé.</p>`;
  else if (c.etat === "passee") cle = `<p class="cle">La date est dépassée : choisissez une date à venir.</p>`;
  else if (c.etat === "inconnu") cle = `<p class="cle">Il faut <b>${eurP(c.parMois)} par mois</b> pendant ${c.mr} mois. Votre capacité n'est pas encore estimée : saisissez-la plus haut, ou importez au moins ${BILAN_MOIS_MINI} mois de relevés.</p>`;
  else cle = `<p class="cle">Il faut <b>${eurP(c.parMois)} par mois</b> pendant ${c.mr} mois. ${c.etat === "ok" ? `La capacité disponible pour ce projet (${eurP(dispo)}) le permet avec de la marge.` : c.etat === "serre" ? `La capacité disponible pour ce projet (${eurP(dispo)}) le permet de justesse.` : `La capacité disponible pour ce projet (${eurP(dispo)}) ne suffit pas : il manque <b>${eurP(c.parMois - dispo)} par mois</b>.`}</p>`;
  let suivi;
  if (p.categorieId) {
    const ecoule = Math.max(0, moisEntre(p.debut, aujourdhui())), plan0 = (p.cible - (p.deja || 0)) / Math.max(1, moisEntre(p.debut, p)), attendu = Math.min(p.cible - (p.deja || 0), plan0 * ecoule), ecart = suivie - attendu;
    suivi = `<div class="suivi"><b>Suivi avec vos relevés</b> : depuis ${NOMS_MOIS_LONGS[p.debut.mois]}, <b>${eurP(suivie)}</b> rangés dans « ${echapper((etat.categories.find(x => x.id === p.categorieId) || {}).nom || "Projet")} ».
      ${ecoule > 0 ? `Au rythme prévu au départ (${eurP(plan0)} par mois), il y aurait ${eurP(attendu)} à ce jour : vous êtes ${ecart >= 0 ? `<b class="bon">${eurP(ecart)} en avance</b>` : `<b class="mauvais">${eurP(-ecart)} en retard</b>`}.` : "Rangez vos virements d'épargne de ce projet dans cette sous-catégorie (page Opérations)."}</div>`;
  } else suivi = `<div class="suivi">Suivi avec vos relevés : non activé. <button class="lien" data-projet-suivi="${p.id}">Créer la sous-catégorie « Projet : ${echapper(p.nom)} »</button> pour que vos virements comptent dans l'avancement.</div>`;
  const prio = total > 1 ? `<div class="prio">Priorité ${rang + 1} <button data-projet-monter="${p.id}" ${rang === 0 ? "disabled" : ""} title="Plus prioritaire">▲</button><button data-projet-descendre="${p.id}" ${rang === total - 1 ? "disabled" : ""} title="Moins prioritaire">▼</button></div>` : "";
  const date = `${p.annee}-${String(p.mois + 1).padStart(2, "0")}`;
  return `<div class="proj"><div class="proj-tete"><div><h3>${echapper(p.nom)}</h3><div class="sous">${echapper(p.type)} · ${eurP(p.cible)} d'ici ${libMoisAnnee(p.annee, p.mois)}</div></div>
      <div class="proj-actions">${prio}<span class="badge ${cls}">${txt}</span><button class="lien" data-projet-ouv="${p.id}">${ouv ? "Masquer" : "Détail"}</button></div></div>
    <div class="saisie"><label>Nom<input class="champ" type="text" value="${echapper(p.nom)}" data-projet-champ="nom" data-id="${p.id}"></label>
      <label>Montant visé (${symboleDevise(deviseDuBilan())})<input class="champ num" type="number" min="0" value="${p.cible}" data-projet-champ="cible" data-id="${p.id}"></label>
      <label>Date visée<input class="champ" type="month" value="${date}" data-projet-champ="date" data-id="${p.id}"></label>
      <label>${p.categorieId ? "Déjà de côté au départ" : "Déjà mis de côté"} (facultatif)<input class="champ num" type="number" min="0" value="${p.deja ?? ""}" placeholder="Non renseigné" data-projet-champ="deja" data-id="${p.id}"></label></div>
    ${ouv ? `<div class="corps"><div>${cle}<div class="progres"><i style="width:${pct}%"></i></div><div class="sous-note">${mis ? `${eurP(mis)} de côté, soit ${pct} %${suivie ? ` (dont ${eurP(suivie)} vus dans vos relevés)` : ""}` : "Montant déjà de côté : non renseigné"}</div>${suivi}
        <p class="supprimer"><button class="lien" data-projet-supprimer="${p.id}">Supprimer ce projet</button></p></div>
      <div>${comparaisonProjet(c, dispo)}${leviersProjet(p, c, dispo, cap, pistes)}</div></div>
      <p class="hyp bas">Hypothèses : sans intérêts ni inflation, avec des revenus et des dépenses comme ces derniers mois.</p>` : ""}</div>`;
}

function rendreProjets() {
  const conteneur = document.getElementById("etape-projets");
  [["epargne", "epargne"]].forEach(([v, f]) => conteneur.style.setProperty("--" + v, couleurFamille(f)));
  if (!prj.initialise) { etat.projets.forEach(p => prj.ouverts.add(p.id)); prj.initialise = true; }
  const cap = capaciteProjets(), liste = etat.projets, prefs = etat.preferences || {};
  const q = (k, t) => `<div class="q-titre"><span class="q-num">${k}</span><b>${t}</b></div>`;
  let h = `<h1>Projets</h1><p class="intro">Planifiez un achat, un voyage ou un apport : l'appli compare ce qu'il faut mettre de côté avec ce que vos relevés montrent que vous pouvez dégager.</p>
    <p class="periode">Ce sont des estimations d'après le passé, pas des conseils financiers. Un projet ne modifie jamais vos opérations ni vos totaux.</p>`;

  h += q("1", "Ma capacité à mettre de côté") + `<div class="carte">`;
  if (cap.valeur == null) h += `<div class="verrou">Il faut au moins <b>${BILAN_MOIS_MINI} mois de relevés complets</b> pour estimer ce que vous pouvez dégager${cap.nbMois ? ` (vous en avez ${cap.nbMois})` : ""}. Vous pouvez aussi saisir un montant vous-même.</div>
    <div class="ligne-form" style="margin-top:12px"><label style="max-width:320px">Montant que je peux consacrer à mes projets par mois (${symboleDevise(deviseDuBilan())})<input class="champ num" type="number" min="0" placeholder="Non renseigné" data-projet-cap="1"></label></div>`;
  else h += `<div class="cap"><div><div class="lib">Capacité par mois</div><div class="gros">${eurP(cap.valeur)}</div></div>
    <div class="cap-texte"><p class="verdict-sous">${cap.source === "saisie" ? "Montant saisi par vous." : `D'après vos <b>3 derniers mois</b> (revenus − dépenses − épargne déjà prévue : ${eurP(cap.auto)}${prefs.projetsInclureEpargne ? ` + votre épargne actuelle ${eurP(cap.epargne)}` : ""})${cap.moyenne != null && cap.nbMois > 3 ? `, plutôt que la moyenne de ${cap.nbMois} mois (${eurP(cap.moyenne)})` : ""}.`}
      Un reste observé dans le passé, pas de l'argent garanti. ${cap.source === "saisie" ? `<button class="lien" data-projet-reset="1">Revenir à l'estimation</button>` : ""}</p>
      ${cap.source === "auto" && cap.epargne > 0 ? `<label class="case"><input type="checkbox" data-projet-epargne="1" ${prefs.projetsInclureEpargne ? "checked" : ""}><span><b>Inclure mon épargne actuelle</b> (${eurP(cap.epargne)} par mois) : je veux la rediriger vers mes projets.</span></label>` : ""}</div>
    <label class="saisie-cap">Je préfère saisir mon montant (${symboleDevise(deviseDuBilan())})<input class="champ num" type="number" min="0" value="${cap.source === "saisie" ? cap.valeur : ""}" placeholder="${cap.auto != null ? Math.round(cap.auto) : ""}" data-projet-cap="1"></label></div>`;
  h += `<p class="hyp">Hypothèses : sans intérêts ni inflation, avec des revenus et des dépenses comme ces derniers mois.</p></div>`;

  h += q("2", "Mes projets");
  if (!liste.length && !prj.form) h += `<div class="carte vide"><p class="verdict">Aucun projet pour l'instant</p><p class="verdict-sous">Un achat, un voyage, un apport : indiquez un montant et une date, l'appli vous dit ce qu'il faut mettre de côté.</p>
    <div class="pills">${TYPES_PROJET.map(t => `<button class="pill" data-projet-nouveau="${t}">${t}</button>`).join("")}</div></div>`;
  const parts = repartirProjets(liste, cap.valeur), pistes = pistesBilanPourProjets(cap.bilanComplet);
  if (liste.length > 1 && cap.valeur != null) {
    const tot = parts.reduce((s, x) => s + (x.c.parMois || 0), 0);
    h += `<div class="ensemble"><b>Ensemble</b>, vos ${liste.length} projets demandent <b>${eurP(tot)} par mois</b> pour une capacité de ${eurP(cap.valeur)}${tot > cap.valeur ? ` : il manque ${eurP(tot - cap.valeur)} par mois. La capacité est donnée d'abord au projet n°1, puis au suivant : changez l'ordre avec ▲ ▼.` : " : c'est compatible."}</div>`;
  }
  h += parts.map((x, i) => carteProjet(x, i, parts.length, cap, pistes)).join("");
  if (prj.form) {
    const t = aujourdhui();
    h += `<div class="nouveau"><h3>Nouveau projet</h3><div class="ligne-form">
      <label>Type<select class="champ" id="pf-type">${TYPES_PROJET.map(x => `<option ${x === prj.form.type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label>Nom<input class="champ" id="pf-nom" placeholder="Ex. : vélo"></label>
      <label>Montant visé (${symboleDevise(deviseDuBilan())})<input class="champ num" type="number" min="0" id="pf-cible"></label>
      <label>Date visée<input class="champ" type="month" id="pf-date" value="${t.annee + 1}-${String(t.mois + 1).padStart(2, "0")}"></label>
      <label>Déjà de côté (facultatif)<input class="champ num" type="number" min="0" id="pf-deja" placeholder="Non renseigné"></label>
      <button class="btn" data-projet-creer="1">Créer le projet</button><button class="btn s" data-projet-annuler="1">Annuler</button></div></div>`;
  } else if (liste.length) h += `<button class="btn s" data-projet-nouveau="Achat">＋ Nouveau projet</button>`;
  conteneur.innerHTML = `<div class="projets-page">${h}</div>`;
}

function sauverProjets() { sauvegarderEtat(etat); rendreProjets(); }
function deplacerProjet(id, dir) {
  const i = etat.projets.findIndex(p => p.id === id), j = i + dir;
  if (j < 0 || j >= etat.projets.length) return;
  [etat.projets[i], etat.projets[j]] = [etat.projets[j], etat.projets[i]];
}

document.getElementById("etape-projets").addEventListener("click", e => {
  const x = e.target.closest("button"); if (!x) return;
  const d = x.dataset;
  if (d.projetOuv) { const i = d.projetOuv; prj.ouverts.has(i) ? prj.ouverts.delete(i) : prj.ouverts.add(i); rendreProjets(); }
  else if (d.projetMonter) { deplacerProjet(d.projetMonter, -1); sauverProjets(); }
  else if (d.projetDescendre) { deplacerProjet(d.projetDescendre, 1); sauverProjets(); }
  else if (d.projetNouveau) { prj.form = { type: d.projetNouveau }; rendreProjets(); }
  else if (d.projetAnnuler) { prj.form = null; rendreProjets(); }
  else if (d.projetReset) { etat.preferences.capaciteProjets = null; sauverProjets(); }
  else if (d.projetSuivi) {
    const p = etat.projets.find(v => v.id === d.projetSuivi); if (!p) return;
    const c = nouvelleCategorie("epargne", "#5f9a7a"); c.nom = "Projet : " + p.nom;
    etat.categories.push(c); p.categorieId = c.id; p.debut = aujourdhui(); sauverProjets();
  }
  else if (d.projetSupprimer) {
    const p = etat.projets.find(v => v.id === d.projetSupprimer); if (!p) return;
    if (!confirm(`Supprimer le projet « ${p.nom} » ?${p.categorieId ? " Sa sous-catégorie d'épargne et vos opérations sont conservées." : ""}`)) return;
    etat.projets = etat.projets.filter(v => v !== p); sauverProjets();
  }
  else if (d.projetCreer) {
    const cible = +document.getElementById("pf-cible").value;
    if (!(cible > 0)) { document.getElementById("pf-cible").focus(); return; }
    const [a, m] = document.getElementById("pf-date").value.split("-").map(Number), deja = document.getElementById("pf-deja").value;
    if (!a) { document.getElementById("pf-date").focus(); return; }
    const id = "p" + crypto.randomUUID().slice(0, 8);
    etat.projets.push({ id, type: document.getElementById("pf-type").value, nom: document.getElementById("pf-nom").value.trim() || "Nouveau projet", cible, annee: a, mois: m - 1,
      deja: deja === "" ? null : +deja, debut: aujourdhui(), categorieId: null });
    prj.ouverts.add(id); prj.form = null; sauverProjets();
  }
});
document.getElementById("etape-projets").addEventListener("change", e => {
  const d = e.target.dataset;
  if (d.projetEpargne) { etat.preferences.projetsInclureEpargne = e.target.checked; sauverProjets(); return; }
  if (d.projetCap) { etat.preferences.capaciteProjets = e.target.value === "" ? null : Math.max(0, +e.target.value); sauverProjets(); return; }
  if (!d.projetChamp) return;
  const p = etat.projets.find(v => v.id === d.id); if (!p) return;
  if (d.projetChamp === "nom") {
    p.nom = e.target.value.trim() || p.nom;
    const c = p.categorieId && etat.categories.find(v => v.id === p.categorieId); if (c) c.nom = "Projet : " + p.nom;
  } else if (d.projetChamp === "cible") p.cible = Math.max(0, +e.target.value || 0);
  else if (d.projetChamp === "deja") p.deja = e.target.value === "" ? null : Math.max(0, +e.target.value);
  else { const [a, m] = e.target.value.split("-").map(Number); if (a) { p.annee = a; p.mois = m - 1; } }
  sauverProjets();
});

ECRANS.projets = { rendre: rendreProjets, compteur: () => "" };
