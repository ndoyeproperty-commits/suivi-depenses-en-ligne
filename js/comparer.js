// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — COMPARER
// Construit à partir de la maquette maquettes/comparer.html.
// Vous choisissez des mois (6 au maximum) : ils s'affichent côte à côte, avec
// l'écart par rapport à une colonne « référence ». Le compte et la devise sont
// ceux du tableau de bord. Les dépenses exceptionnelles sont incluses ici
// (comparer, c'est aussi les voir). RÈGLE ② : rien sans transactions derrière.
// ═══════════════════════════════════════════════════════════════════

const cmp = { annee: null, cols: [], ref: 0, deplie: new Set(), ecarts: true, tri: false, initialise: false };
const CMP_MAX_COLONNES = 6;
const FAMILLES_COMPARER = [["besoin", "besoins"], ["envie", "envies"], ["epargne", "epargne"], ["frais", "frais"]];

const cleMois = c => c.annee * 12 + c.mois;
const libelleColonne = c => `${MOIS_COURTS[c.mois]} ${c.annee}`;

// Les mois qui ont des opérations pour le compte choisi, du plus ancien au plus récent.
function moisAvecDonnees() {
  const liste = [];
  periodesDisponibles().forEach((set, annee) => set.forEach(mois => liste.push({ annee, mois })));
  return liste.sort((a, b) => cleMois(a) - cleMois(b));
}

function preparerComparer() {
  normaliserCompteEtDevise();
  const dispo = moisAvecDonnees(), cles = new Set(dispo.map(cleMois));
  cmp.cols = cmp.cols.filter(c => cles.has(cleMois(c)));
  if (!cmp.initialise || cmp.cols.length < 2) {
    cmp.cols = dispo.slice(-2);
    cmp.ref = 0; cmp.initialise = true;
  }
  if (cmp.ref >= cmp.cols.length) cmp.ref = 0;
  if (cmp.annee == null || !periodesDisponibles().has(cmp.annee)) cmp.annee = dispo.length ? dispo[dispo.length - 1].annee : new Date().getFullYear();
  return dispo;
}

function nomSousCategorie(cle) {
  if (cle.startsWith("__sans-detail:")) return `${nomGroupe(cle.slice(14))} (sans détail)`;
  const c = etat.categories.find(x => x.id === cle);
  return c ? c.nom : cle;
}
const groupeDeCle = cle => cle.startsWith("__sans-detail:") ? cle.slice(14) : (etat.categories.find(x => x.id === cle) || {}).enveloppeId;

function rendreComparer() {
  const conteneur = document.getElementById("etape-comparer");
  [["besoins", "besoin"], ["envies", "envie"], ["epargne", "epargne"], ["frais", "frais"]].forEach(([v, f]) => conteneur.style.setProperty("--" + v, couleurFamille(f)));
  const dispo = preparerComparer(), dev = affichage.devise, sym = symboleDevise(dev);
  const fmt = n => (n < 0 ? "− " : "") + Math.round(Math.abs(n)).toLocaleString("fr-FR") + " " + sym;
  const entete = `<h1>Comparer</h1><p class="intro">Choisissez les mois à comparer : ils s'affichent côte à côte, avec l'écart par rapport à une référence.</p>`;
  if (dispo.length < 2) {
    conteneur.innerHTML = `<div class="comparer-page">${entete}<div class="accueil"><h2>Il faut au moins deux mois de relevés</h2><p>Importez vos relevés : vous pourrez ensuite comparer vos mois côte à côte.</p><button class="bt p" data-vue="import">Importer les relevés</button></div></div>`;
    return;
  }

  // Filtres : compte, devise, années, mois.
  const dispoParAnnee = periodesDisponibles(), annees = [...dispoParAnnee.keys()].sort();
  const devises = devisesDesComptes();
  const compteHtml = etat.comptes.length < 2 ? "" : `<select class="pill" id="cmp-compte">
      <option value="tous" ${affichage.compte === "tous" ? "selected" : ""}>Tous les comptes</option>
      ${etat.comptes.map((c, i) => `<option value="${c.id}" ${c.id === affichage.compte ? "selected" : ""}>${echapper(nomDuCompte(c, i))} (${codeDevise(c.devise)})</option>`).join("")}</select>`;
  const deviseHtml = devises.length < 2 ? "" : devises.map(d => `<button class="pill ${d === dev ? "on" : ""}" data-cmp-devise="${d}" ${devisePossible(d) ? "" : 'disabled title="Saisissez un taux de change à l\'étape 2 pour afficher dans cette devise"'}>${d}</button>`).join("");
  let h = entete;
  if (compteHtml || deviseHtml) h += `<div class="filtres"><span class="etiq">Compte</span><div class="rang">${compteHtml}${deviseHtml}</div></div>`;
  h += `<div class="filtres"><span class="etiq">Mois</span><div class="rang">${annees.map(a => `<button class="pill ${a === cmp.annee ? "on" : ""}" data-cmp-an="${a}">${a}</button>`).join("")}</div></div>
    <div class="filtres"><span class="etiq"></span><div class="rang">${MOIS_COURTS.map((m, i) => {
      const actif = cmp.cols.some(c => c.annee === cmp.annee && c.mois === i), ok = dispoParAnnee.get(cmp.annee) && dispoParAnnee.get(cmp.annee).has(i);
      return `<button class="pill mois ${actif ? "on" : ""}" data-cmp-mois="${i}" ${ok ? "" : "disabled"}>${m}</button>`; }).join("")}</div></div>
    <p class="aide-c">Cliquez sur les mois à comparer (${CMP_MAX_COLONNES} au maximum). La colonne « référence » sert de point de comparaison pour les écarts.</p>`;
  if (cmp.cols.length < 2) { conteneur.innerHTML = `<div class="comparer-page">${h}<div class="vide-c">Choisissez au moins deux mois pour les comparer.</div></div>`; return; }

  // Calculs : une période par colonne.
  const data = cmp.cols.map(c => calculerPeriode(c.annee, [c.mois], { compte: affichage.compte, devise: dev })), ref = data[cmp.ref];
  const nbSansTaux = data.reduce((s, p) => s + p.nbSansTaux, 0), nbAClasser = data.reduce((s, p) => s + p.nbAClasser, 0);
  const sousParFamille = {};
  const toutesLesCles = new Set(); data.forEach(p => Object.keys(p.parSousCategorie).forEach(k => toutesLesCles.add(k)));
  toutesLesCles.forEach(k => { const g = groupeDeCle(k); if (!g) return; const f = familleDe(g); if (!FAMILLES_COMPARER.some(x => x[0] === f)) return; (sousParFamille[f] = sousParFamille[f] || []).push(k); });

  // Phrase d'ensemble : la première colonne qui n'est pas la référence.
  const j = cmp.cols.findIndex((_, i) => i !== cmp.ref), dj = data[j], diffDep = dj.depense - ref.depense;
  const contrib = [];
  FAMILLES_COMPARER.forEach(([f]) => { if (f === "epargne") return; (sousParFamille[f] || []).forEach(k => { const d = (dj.parSousCategorie[k] || 0) - (ref.parSousCategorie[k] || 0); if (Math.abs(d) >= 15) contrib.push([nomSousCategorie(k), d]); }); });
  contrib.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  h += `<div class="resume"><b>${libelleColonne(cmp.cols[j])}</b> par rapport à <b>${libelleColonne(cmp.cols[cmp.ref])}</b> : dépenses <b>${fmt(diffDep).replace(/^(?!−)/, "+")}</b>.
    <div class="sous-r">${contrib.length ? `Ce qui explique le plus : ${contrib.slice(0, 3).map(([n, d]) => `${echapper(n)} (${d > 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString("fr-FR")})`).join(", ")}.` : "Aucun écart important entre ces deux colonnes."}</div></div>`;
  const alertes = [];
  if (nbAClasser) alertes.push(`${nbAClasser} opération${nbAClasser > 1 ? "s" : ""} à classer ne sont comptées nulle part`);
  if (nbSansTaux) alertes.push(`${nbSansTaux} opération${nbSansTaux > 1 ? "s" : ""} sans taux de change ne sont pas converties`);
  if (alertes.length) h += `<p class="alerte-c">⚠ ${alertes.join(" ; ")}.</p>`;
  h += `<div class="outils"><label><input type="checkbox" data-cmp-opt="ecarts" ${cmp.ecarts ? "checked" : ""}> Afficher les écarts</label><label><input type="checkbox" data-cmp-opt="tri" ${cmp.tri ? "checked" : ""}> Trier par ce qui a le plus changé</label></div>`;

  // Tableau.
  const ecart = (a, b, depense) => {
    const d = a - b;
    if (Math.abs(d) < 0.5) return `<span class="ec neutre">= égal</span>`;
    const p = Math.abs(b) > 0.5 ? Math.round(d / Math.abs(b) * 100) : null, cls = depense ? (d > 0 ? "plus" : "moins") : "neutre";
    return `<span class="ec ${cls}">${d > 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString("fr-FR")} ${sym}${p == null ? "" : ` · ${p > 0 ? "+" : "−"}${Math.abs(p)} %`}</span>`;
  };
  const ligne = (nom, vals, depense, cls, attrs = "", fleche = "", filtreDe = null) => {
    const cellules = vals.map((v, i) => {
      const texte = filtreDe && Math.abs(v) >= 0.5 ? `<a class="montant" data-ops-filtre="${echapper(JSON.stringify(filtreDe(i)))}" title="Voir les opérations">${fmt(v)}</a>` : `<span class="montant-nu">${fmt(v)}</span>`;
      return `<td class="${i === cmp.ref ? "ref" : ""}">${texte}${cmp.ecarts && i !== cmp.ref ? ecart(v, vals[cmp.ref], depense) : ""}</td>`; }).join("");
    return `<tr class="${cls}" ${attrs}><td>${fleche}${nom}</td>${cellules}</tr>`;
  };
  const ecartMax = vals => Math.max(...vals.map((v, i) => i === cmp.ref ? 0 : Math.abs(v - vals[cmp.ref])));
  let t = `<div class="tableau"><table class="cmp" style="min-width:${160 + cmp.cols.length * 104}px"><tr><th></th>${cmp.cols.map((c, i) => `<th class="${i === cmp.ref ? "estref" : ""}">${libelleColonne(c)}<label class="ref"><input type="radio" name="cmp-ref" data-cmp-ref="${i}" ${i === cmp.ref ? "checked" : ""}>${i === cmp.ref ? "Référence" : "Réf."}</label></th>`).join("")}</tr>`;
  t += ligne("Revenus", data.map(p => p.revenus), false, "total");
  let familles = FAMILLES_COMPARER.map(([f, cle]) => ({ f, cle, vals: data.map(p => p[cle]) })).filter(x => x.vals.some(v => Math.abs(v) >= 0.5) || (sousParFamille[x.f] || []).length);
  if (cmp.tri) familles.sort((a, b) => ecartMax(b.vals) - ecartMax(a.vals));
  for (const fam of familles) {
    const ouvert = cmp.deplie.has(fam.f);
    t += ligne(`<span class="point" style="--c:var(--${fam.cle})">${echapper(nomFamille(fam.f))}</span>`, fam.vals, fam.f !== "epargne", "cat", `data-cmp-ouv="${fam.f}"`, `<span class="fl">${ouvert ? "▼" : "▶"}</span>`);
    if (!ouvert) continue;
    let sous = (sousParFamille[fam.f] || []).map(k => ({ k, vals: data.map(p => p.parSousCategorie[k] || 0) })).filter(x => x.vals.some(v => Math.abs(v) >= 0.5));
    sous.sort(cmp.tri ? (a, b) => ecartMax(b.vals) - ecartMax(a.vals) : (a, b) => Math.max(...b.vals.map(Math.abs)) - Math.max(...a.vals.map(Math.abs)));
    t += sous.map(x => ligne(echapper(nomSousCategorie(x.k)), x.vals, fam.f !== "epargne", "sous", "", "",
      i => ({ cat: x.k.startsWith("__sans-detail:") ? "g:" + x.k.slice(14) : x.k, annee: cmp.cols[i].annee, mois: [cmp.cols[i].mois], compte: affichage.compte }))).join("");
  }
  t += ligne("Dépenses totales", data.map(p => p.depense), true, "total") + ligne("Reste", data.map(p => p.reste), false, "total") + `</table></div>`;
  h += t + `<p class="avert">Les montants sont les totaux des mois choisis, en ${sym}. Les dépenses exceptionnelles sont incluses ici. Cliquez sur un montant d'une sous-catégorie pour voir les opérations.</p>`;
  conteneur.innerHTML = `<div class="comparer-page">${h}</div>`;
}

document.getElementById("etape-comparer").addEventListener("click", e => {
  const x = e.target.closest("button, tr[data-cmp-ouv]");
  if (!x || e.target.closest("a[data-ops-filtre]")) return;
  const d = x.dataset;
  if (d.cmpAn) { cmp.annee = +d.cmpAn; rendreComparer(); }
  else if (d.cmpMois !== undefined) {
    const mois = +d.cmpMois, i = cmp.cols.findIndex(c => c.annee === cmp.annee && c.mois === mois);
    if (i >= 0) { cmp.cols.splice(i, 1); if (cmp.ref >= cmp.cols.length) cmp.ref = 0; else if (i < cmp.ref) cmp.ref--; else if (i === cmp.ref) cmp.ref = 0; }
    else if (cmp.cols.length < CMP_MAX_COLONNES) { const refCle = cmp.cols[cmp.ref] && cleMois(cmp.cols[cmp.ref]); cmp.cols.push({ annee: cmp.annee, mois }); cmp.cols.sort((a, b) => cleMois(a) - cleMois(b)); if (refCle != null) cmp.ref = Math.max(0, cmp.cols.findIndex(c => cleMois(c) === refCle)); }
    rendreComparer();
  }
  else if (d.cmpDevise) { affichage.devise = d.cmpDevise; rendreComparer(); }
  else if (d.cmpOuv) { cmp.deplie.has(d.cmpOuv) ? cmp.deplie.delete(d.cmpOuv) : cmp.deplie.add(d.cmpOuv); rendreComparer(); }
});
document.getElementById("etape-comparer").addEventListener("change", e => {
  const d = e.target.dataset;
  if (e.target.id === "cmp-compte") { affichage.compte = e.target.value; affichage.devise = null; cmp.initialise = false; rendreComparer(); }
  else if (d.cmpRef !== undefined) { cmp.ref = +d.cmpRef; rendreComparer(); }
  else if (d.cmpOpt === "ecarts") { cmp.ecarts = e.target.checked; rendreComparer(); }
  else if (d.cmpOpt === "tri") { cmp.tri = e.target.checked; rendreComparer(); }
});

ECRANS.comparer = { rendre: rendreComparer, compteur: () => "" };
