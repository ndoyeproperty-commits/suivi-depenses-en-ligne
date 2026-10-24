// ═══════════════════════════════════════════════════════════════════
// TABLEAU DE BORD — « Où va l'argent » et « Évolution mensuelle »
// Même règle partout : un chiffre vient de VOS transactions, sinon « — ».
// ═══════════════════════════════════════════════════════════════════

const euro2 = n => (n < 0 ? "− " : "") + Math.abs(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + symboleDevise(affichage.devise || "EUR");

// Les colonnes que l'utilisateur a repliées (par défaut tout est déplié).
const colonnesRepliees = new Set();

// Les trois familles de dépenses du graphique : la clé dans les chiffres, et la famille.
const FAMILLES_DEPENSES = [["besoins", "besoin"], ["envies", "envie"], ["epargne", "epargne"], ["frais", "frais"]];

// ── « Où va l'argent » ───────────────────────────────────────────────
// Une colonne par catégorie de dépense ou d'épargne (celles de départ, et celles que vous créez).
function rendreOuVaLArgent(p) {
  const entete = `
    <h2>Où va l'argent</h2>
    <p class="aide">Par catégorie, nets des remboursements. Cliquez sur une catégorie pour replier ou déplier son détail.</p>`;

  const groupes = ["besoin", "envie", "epargne", "frais"].flatMap(f => groupesDeFamille(f));
  const colonnes = groupes.map(g => {
    const couleur = couleurGroupe(g);
    const total = p.parGroupe[g] || 0;
    const sousCategories = etat.categories
      .filter(c => c.enveloppeId === g && p.parSousCategorie[c.id])
      .map(c => ({ c, montant: p.parSousCategorie[c.id] }))
      .sort((a, b) => b.montant - a.montant);
    // Les lignes rangées dans cette catégorie sans choisir de sous-catégorie.
    const sansDetail = p.parSousCategorie["__sans-detail:" + g];
    if (sansDetail) sousCategories.push({ c: { nom: "Sans détail", sansDetail: true }, montant: sansDetail });
    const partRevenus = p.revenus > 0 ? Math.round(total / p.revenus * 100) + " % de vos revenus" : "— (pas de revenu classé)";
    const largeurColonne = p.revenus > 0 ? Math.min(100, Math.max(0, total / p.revenus * 100)) : 0;

    const lignes = sousCategories.map(({ c, montant }) => `
      <div class="sub">
        <span class="pc-sous" ${c.sansDetail ? 'style="--c:#8e9aa6"' : ""}>${echapper(c.nom)}</span>
        <span class="mont">${euro2(montant)}</span>
        <div class="rail"><i style="width:${total > 0 ? Math.min(100, Math.max(0, montant / total * 100)) : 0}%;background:${c.sansDetail ? "#8e9aa6" : couleur}"></i></div>
      </div>`).join("");

    return `
      <div class="cat ${colonnesRepliees.has(g) ? "" : "ouvert"}" data-cat="${echapper(g)}" style="--c:${couleur}">
        <div class="cat-tete">
          <div class="nom">${echapper(nomGroupe(g))}</div><div class="mont">${euro(total)}</div>
          <div class="rail"><i style="width:${largeurColonne}%;background:${couleur}"></i></div>
          <div class="pct">${partRevenus}</div>
        </div>
        <div class="subs">${lignes || `<div class="vide-sub">Rien de classé ici sur cette période.</div>`}</div>
      </div>`;
  }).join("");

  const ignores = p.neutre > 0
    ? `<div class="nb-ignores">${euro(p.neutre)} de virements entre vos propres comptes ne sont comptés ni en revenus ni en dépenses.</div>`
    : "";
  return `<div class="carte">${entete}<div class="cats-3">${colonnes}</div>${ignores}</div>`;
}

// ── « Évolution mensuelle » ──────────────────────────────────────────
function echelleAgreable(max) {
  const pas = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000].find(p => max / p <= 5) || 500000;
  return { pas, max: Math.max(pas, Math.ceil(max / pas) * pas) };
}

function dessinerGraphique(parMois, annee) {
  const W = 1000, H = 270, marge = { g: 56, d: 10, h: 12, b: 30 };
  const largeur = W - marge.g - marge.d, hauteur = H - marge.h - marge.b;
  const mois = parMois.filter(m => m.p.nbCompte > 0);
  const { pas: pasY, max } = echelleAgreable(Math.max(1, ...mois.map(m => Math.max(
    Math.max(m.p.besoins, 0) + Math.max(m.p.envies, 0) + Math.max(m.p.epargne, 0) + Math.max(m.p.frais, 0), m.p.revenus))));
  const y = v => marge.h + hauteur - Math.max(v, 0) / max * hauteur;
  const pasX = largeur / 12, largeurBarre = pasX * 0.58;
  const selection = moisDeLaSelection(affichage.mois);

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Évolution mensuelle des dépenses et des revenus">`;
  for (let v = 0; v <= max; v += pasY) {
    svg += `<line x1="${marge.g}" x2="${W - marge.d}" y1="${y(v)}" y2="${y(v)}" stroke="#e8e8ed"/>
      <text x="${marge.g - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end">${v.toLocaleString("fr-FR")}</text>`;
  }
  const points = [];
  for (let i = 0; i < 12; i++) {
    const m = parMois[i].p, actif = m.nbCompte > 0;
    const x = marge.g + i * pasX + (pasX - largeurBarre) / 2;
    const choisi = selection.includes(i);
    if (actif) {
      let cumul = 0;
      for (const [cle, famille] of FAMILLES_DEPENSES) {
        const valeur = Math.max(m[cle], 0);
        cumul += valeur;
        const couleurHex = couleurFamille(famille);
        svg += `<rect x="${x}" y="${y(cumul)}" width="${largeurBarre}" height="${valeur / max * hauteur}" fill="${couleurHex}" opacity="${choisi ? 1 : 0.28}"/>`;
      }
      points.push(`${x + largeurBarre / 2},${y(m.revenus)}`);
    }
    const depasse = actif && m.depense > m.revenus;   // l'épargne n'est pas une dépense perdue
    svg += `<text x="${x + largeurBarre / 2}" y="${H - 10}" font-size="11.5" text-anchor="middle" ${depasse ? 'style="fill:#b3261e;font-weight:700"' : ""}>${MOIS_COURTS[i]}</text>`;
    if (actif) {
      svg += `<rect x="${marge.g + i * pasX}" y="${marge.h}" width="${pasX}" height="${hauteur + marge.b}" fill="transparent" data-mois="${i}" style="cursor:pointer">
        <title>${MOIS_COURTS[i]} ${annee} · revenus ${euro(m.revenus)} · dépenses ${euro(m.depense)} · épargne ${euro(m.epargne)}</title></rect>`;
    }
  }
  if (points.length > 1) svg += `<polyline points="${points.join(" ")}" fill="none" stroke="#1d1d1f" stroke-width="2"/>`;
  points.forEach(pt => {
    const [cx, cy] = pt.split(",");
    svg += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff" stroke="#1d1d1f" stroke-width="2"/>`;
  });
  return svg + "</svg>";
}

function rendreEvolution12Mois(annee) {
  const parMois = [...Array(12).keys()].map(i => ({ i, p: calculerPeriode(annee, [i]) }));
  const actifs = parMois.filter(m => m.p.nbCompte > 0);
  const entete = `
    <h2>Évolution mensuelle</h2>
    <p class="aide">Ce qui sort chaque mois (besoins, envies, épargne) face à vos revenus (la ligne). Cliquez un mois pour le détailler.
    Un mois est signalé en rouge quand vos <b>dépenses</b> dépassent vos revenus — l'épargne n'est pas comptée comme une perte.</p>`;
  if (actifs.length === 0) return `<div class="carte">${entete}<p class="aide" style="margin:0">Aucune opération classée en ${annee}.</p></div>`;

  const legende = `<div class="legende">
    <span><i style="background:var(--besoins)"></i>${echapper(nomFamille("besoin"))}</span><span><i style="background:var(--envies)"></i>${echapper(nomFamille("envie"))}</span>
    <span><i style="background:var(--epargne)"></i>${echapper(nomFamille("epargne"))}</span>${aDesFrais() ? `<span><i style="background:var(--frais)"></i>${echapper(nomFamille("frais"))}</span>` : ""}<span><i class="ligne-rev"></i>Revenus</span></div>`;

  let pied;
  if (actifs.length < 2) {
    pied = `<p class="aide" style="margin:14px 0 0">Les comparaisons (plus dépensé, moins dépensé) apparaîtront dès le deuxième mois importé.</p>`;
  } else {
    const plus = actifs.reduce((a, b) => b.p.depense > a.p.depense ? b : a);
    const moins = actifs.reduce((a, b) => b.p.depense < a.p.depense ? b : a);
    const sur = actifs.filter(m => m.p.depense > m.p.revenus);
    pied = `<div class="pied-stats">
      <div><div class="l">Le plus dépensé</div><div class="v">${MOIS_COURTS[plus.i]} · ${euro(plus.p.depense)}</div></div>
      <div><div class="l">Le moins dépensé</div><div class="v">${MOIS_COURTS[moins.i]} · ${euro(moins.p.depense)}</div></div>
      <div><div class="l">Mois où les dépenses dépassent les revenus</div>
        <div class="v">${sur.length ? sur.length + " · " + sur.map(m => MOIS_COURTS[m.i]).join(", ") : "aucun"}</div></div>
    </div>`;
  }
  return `<div class="carte">${entete}${dessinerGraphique(parMois, annee)}${legende}${pied}</div>`;
}
