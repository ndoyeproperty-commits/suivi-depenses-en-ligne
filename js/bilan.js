// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — BILAN & PISTES
// Construit à partir de la maquette maquettes/bilan-pistes-v3.html
// (cartes par catégorie, graphique en barres). Les calculs sont dans
// js/bilan-calculs.js. RÈGLE ② : aucun chiffre sans transactions derrière.
// ═══════════════════════════════════════════════════════════════════

const bil = { horizon: null, ouvertes: new Set(), initialise: false };
const TYPES_BILAN = { pic: "Pic ponctuel", niveau: "Nouveau niveau", exc: "Exceptionnel", manque: "Mois manquant" };

// Une barre par mois ; les mois qui sortent du lot sont pleins et numérotés ; les tirets = niveau habituel (médiane).
function graphiqueBilan(carte, mois, evts) {
  const v = carte.serie, n = v.length, W = 340, H = 118, bas = 96, haut = 22, g = n > 8 ? 3 : 6, bw = (W - g * (n - 1)) / n;
  const mx = Math.max(...v, 1) * 1.05, y = x => bas - (Math.max(0, x) / mx) * (bas - haut);
  const numDe = i => { const e = evts.find(z => z.m === i); return e ? evts.indexOf(e) + 1 : 0; };
  let o = "";
  v.forEach((x, i) => {
    const k = numDe(i), h = Math.max(1, bas - y(x)), cx = i * (bw + g) + bw / 2;
    o += `<rect x="${(i * (bw + g)).toFixed(1)}" y="${(bas - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${carte.couleur}" opacity="${k ? 1 : .35}"><title>${MOIS_COURTS[mois[i].mois]} : ${euroBilan(x)}</title></rect>
      <text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="rgba(0,0,0,.5)">${MOIS_COURTS[mois[i].mois].charAt(0).toUpperCase()}</text>`;
    if (k) { const cy = Math.max(10, bas - h - 11); o += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="#1d1d1f"/><text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">${k}</text>`; }
  });
  o += `<line x1="0" x2="${W}" y1="${y(carte.med).toFixed(1)}" y2="${y(carte.med).toFixed(1)}" stroke="#1d1d1f" stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>`;
  return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Montant mensuel : ${echapper(carte.nom)}">${o}</svg>`;
}

function detailBilan(carte, b) {
  const numerotes = carte.evenements.filter(e => e.type !== "exc");
  return carte.evenements.map(e => {
    const k = numerotes.indexOf(e) + 1;
    const mx = Math.max(...(e.causes || []).map(c => Math.abs(c.delta)), 1);
    const barres = (e.causes || []).map(c => `<div class="barre"><span>${echapper(c.nom)}</span><div class="rail"><i style="width:${Math.round(Math.abs(c.delta) / mx * 100)}%"></i></div><span class="m">${c.delta >= 0 ? "+" : "−"}${euroBilan(Math.abs(c.delta), b.devise)} / mois</span></div>`).join("");
    const lien = e.filtre ? `<button class="bouton-mini" data-ops-filtre="${echapper(JSON.stringify(e.filtre))}">Voir les opérations</button>` : "";
    return `<div class="evt"><div>${e.type === "exc" ? `<div class="num gris">·</div>` : `<div class="num">${k}</div>`}</div><div>
      <h4>${echapper(e.titre)}<span class="tag">${TYPES_BILAN[e.type]}</span></h4><p>${e.texte}</p>
      ${barres ? `<p class="qui">Qui l'explique :</p>${barres}` : ""}
      ${e.piste ? `<div class="piste-box"><span><span class="lbl">Piste</span>${e.piste}</span>${lien}</div>` : (lien ? `<div class="evt-lien">${lien}</div>` : "")}</div></div>`;
  }).join("");
}

function rendreBilan() {
  const conteneur = document.getElementById("etape-bilan");
  [["besoins", "besoin"], ["envies", "envie"], ["epargne", "epargne"], ["frais", "frais"]].forEach(([v, f]) => conteneur.style.setProperty("--" + v, couleurFamille(f)));
  const complet = calculerBilan(null);
  const entete = `<h1>Bilan &amp; pistes</h1><p class="intro">Ce qu'il faut retenir de vos relevés, catégorie par catégorie, et où vous pouvez agir.</p>`;
  if (complet.n === 0) {
    conteneur.innerHTML = `<div class="bilan-page">${entete}<div class="accueil"><h2>Votre bilan se construira avec vos relevés</h2>
      <p>Importez vos relevés : à partir de 3 mois complets, vous verrez des constats, et à partir de 6 mois, ce qui a changé et pourquoi. Rien n'est affiché tant qu'il n'y a pas de données.</p>
      <button class="bt p" data-vue="import">Importer les relevés</button></div></div>`;
    return;
  }
  const dispo = complet.n;
  if (bil.horizon && bil.horizon > dispo) bil.horizon = null;
  const b = bil.horizon ? calculerBilan(bil.horizon) : complet, n = b.n;
  const premier = b.mois[0], dernier = b.mois[n - 1];
  const periode = `${MOIS_COURTS[premier.mois]}${premier.annee !== dernier.annee ? " " + premier.annee : ""} – ${MOIS_COURTS[dernier.mois]} ${dernier.annee} · ${n} mois complet${n > 1 ? "s" : ""} analysé${n > 1 ? "s" : ""}.`;
  const partiel = b.partiel ? ` ${MOIS_COURTS[b.partiel.mois].charAt(0).toUpperCase() + MOIS_COURTS[b.partiel.mois].slice(1)} est incomplet (relevé jusqu'au ${b.partiel.jusquau}) : il n'est pas utilisé ici.` : "";
  const q = (k, t) => `<div class="q-titre"><span class="q-num">${k}</span><b>${t}</b></div>`;
  const e = v => euroBilan(v, b.devise);

  // 1. L'essentiel
  let h = q("1", "L'essentiel");
  const reste = b.resteMoy;
  const phrase = b.revenusMoy > 0
    ? (reste >= 0 ? `En moyenne, il vous reste ${e(reste)} par mois après vos dépenses et votre épargne.` : `En moyenne, vos dépenses et votre épargne dépassent vos revenus de ${e(-reste)} par mois.`)
    : "Aucun revenu n'est repéré sur ces mois : le reste ne peut pas être calculé.";
  const fixes = b.charges && b.revenusMoy > 0 ? `Vos charges fixes (postes qui reviennent chaque mois, sans varier) représentent ${e(b.charges.total)} par mois, soit ${Math.round(b.charges.total / b.revenusMoy * 100)} % de vos revenus.` : "";
  h += `<div class="carte"><p class="verdict">${phrase}</p>
    <p class="verdict-sous">${fixes} Ce reste est un constat sur le passé, pas de l'argent forcément disponible. Les dépenses marquées exceptionnelles sont exclues.</p>
    <div class="chiffres"><div><div class="lib">Revenus</div><div class="val">${b.revenusMoy > 0 ? e(b.revenusMoy) : "—"}</div><div class="sous">par mois</div></div>
    <div><div class="lib">Dépenses</div><div class="val">${e(b.depensesMoy)}</div><div class="sous">par mois</div></div>
    <div><div class="lib">Épargne</div><div class="val">${e(b.epargneMoy)}</div><div class="sous">par mois</div></div>
    <div><div class="lib">Reste</div><div class="val">${b.revenusMoy > 0 ? e(reste) : "—"}</div><div class="sous">par mois</div></div></div>
    ${b.pourcentClasse != null && b.pourcentClasse < 90 ? `<p class="avert-classement">⚠ Seulement ${b.pourcentClasse} % de vos opérations sont classées : les causes affichées ci-dessous peuvent être incomplètes. <button class="lien-b" data-ops-filtre="${echapper(JSON.stringify({ puces: ["aclasser"] }))}">Voir les opérations à classer</button></p>` : ""}</div>`;

  // 2. Catégorie par catégorie
  h += q("2", "Catégorie par catégorie");
  if (n < BILAN_MOIS_MINI) {
    h += `<div class="carte"><div class="verrou">Les courbes par catégorie apparaissent à partir de <b>${BILAN_MOIS_MINI} mois complets</b> de relevés. Avec ${n} mois, l'appli décrit votre budget mais ne tire pas encore de conclusion.</div></div>`;
  } else {
    const pill = (k, t, ok) => `<button class="pill ${(bil.horizon === k || (k === null && !bil.horizon)) ? "on" : ""}" data-bilan-h="${k === null ? "" : k}" ${ok ? "" : "disabled"}>${t}</button>`;
    h += `<div class="pills">${pill(3, "3 derniers mois", dispo > 3)}${pill(6, "6 derniers mois", dispo > 6)}${pill(null, "Toute la période", true)}</div>
      <p class="legende">Chaque barre est un mois. Les tirets indiquent votre niveau habituel (médiane). Les barres pleines et numérotées sont les moments qui méritent un coup d'œil.${n < BILAN_MOIS_COMPARAISON ? ` Avec moins de ${BILAN_MOIS_COMPARAISON} mois, seuls les pics sont détectés : les « nouveaux niveaux » demandent ${BILAN_MOIS_COMPARAISON} mois.` : ""}</p>`;
    if (!bil.initialise) { const premiere = b.categories.find(c => c.evenements.length); if (premiere) bil.ouvertes.add(premiere.famille); bil.initialise = true; }
    h += b.categories.map(c => {
      const evts = c.evenements.filter(x => x.type !== "exc"), ouv = bil.ouvertes.has(c.famille), nbEv = evts.length;
      return `<div class="cat"><div class="cat-tete"><div><div class="cat-nom"><span class="plein" style="--c:${c.couleur}">${echapper(c.nom)}</span><span class="verd ${c.verdict[0]}">${c.verdict[1]}</span></div>
        <p class="cat-resume">${c.resume}</p>${c.evenements.length ? `<button class="bascule" data-bilan-ouv="${c.famille}">${ouv ? "Masquer le détail" : `Voir le détail (${nbEv ? nbEv + " moment" + (nbEv > 1 ? "s" : "") + " à regarder" : "dépense exceptionnelle"})`}</button>` : `<p class="rien">Rien de particulier à signaler.</p>`}</div>
        <div>${graphiqueBilan(c, b.mois, evts)}</div></div>${ouv && c.evenements.length ? `<div class="cat-detail">${detailBilan(c, b)}</div>` : ""}</div>`;
    }).join("");
    h += `<p class="avert">Ce sont des constats d'après vos relevés, pas des conseils financiers.</p>`;
  }
  // Combien de mois manque-t-il pour débloquer la suite ? (d'après tous les mois disponibles, pas la période regardée)
  const palier = dispo < BILAN_MOIS_MINI ? BILAN_MOIS_MINI : dispo < BILAN_MOIS_COMPARAISON ? BILAN_MOIS_COMPARAISON : 0;
  const manque = palier - dispo;
  const encore = palier ? `<p class="encore">Encore <b>${manque} mois</b> de relevés complets pour ${dispo < BILAN_MOIS_MINI ? "voir les premiers constats" : "voir ce qui a changé et pourquoi"}.</p>` : "";
  conteneur.innerHTML = `<div class="bilan-page">${entete}<p class="periode">${periode}${partiel}</p>${encore}${h}</div>`;
}

document.getElementById("etape-bilan").addEventListener("click", ev => {
  const bh = ev.target.closest("[data-bilan-h]");
  if (bh) { bil.horizon = bh.dataset.bilanH ? +bh.dataset.bilanH : null; rendreBilan(); return; }
  const bo = ev.target.closest("[data-bilan-ouv]");
  if (bo) { const f = bo.dataset.bilanOuv; bil.ouvertes.has(f) ? bil.ouvertes.delete(f) : bil.ouvertes.add(f); rendreBilan(); }
});

ECRANS.bilan = { rendre: rendreBilan, compteur: () => "" };
