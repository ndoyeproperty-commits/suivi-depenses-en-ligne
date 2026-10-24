// ═══════════════════════════════════════════════════════════════════
// BILAN & PISTES — LES CALCULS
// Transforme vos transactions en constats : pour chaque catégorie, une
// courbe mensuelle, un verdict (stable, en hausse…), les moments qui sortent
// du lot, qui les explique, et une piste quand il y en a une.
//
// Règles (pour que vous puissiez les vérifier) :
//  · seuls les mois COMPLETS sont analysés (le dernier mois est écarté si le
//    relevé s'arrête en plein mois) ;
//  · les dépenses marquées « exceptionnelles » sont exclues des moyennes et
//    des tendances, mais signalées à part ;
//  · « pic ponctuel » = un mois nettement au-dessus de votre niveau habituel
//    (la médiane), qui n'est pas suivi d'un nouveau niveau ;
//  · « nouveau niveau » (dès 6 mois) = la médiane des 3 derniers mois diffère
//    d'au moins 20 % ET d'au moins 30 € de celle des 3 mois d'avant ;
//  · rien n'est affiché avant 3 mois ; aucun chiffre n'est inventé (règle ②).
// ═══════════════════════════════════════════════════════════════════

const BILAN_MOIS_MINI = 3;            // en dessous : on décrit, on ne conclut pas
const BILAN_MOIS_COMPARAISON = 6;     // à partir de là : « nouveau niveau »
const BILAN_SEUIL_EUROS = 30;         // un écart plus petit n'est jamais signalé
const BILAN_SEUIL_RELATIF = 0.2;
const FAMILLES_BILAN = ["besoin", "envie", "epargne", "frais"];

const deviseDuBilan = () => affichage.devise || (etat.comptes[0] && deviseDuCompte(etat.comptes[0].id)) || "EUR";
const medianeDe = a => {
  if (!a.length) return 0;
  const t = [...a].sort((x, y) => x - y), m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};
const moyenneDe = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const arrondi10 = n => Math.round(n / 10) * 10;

// ── Quels mois ? ────────────────────────────────────────────────────
// La dernière suite de mois qui se suivent, sans le dernier s'il est incomplet.
function moisDuBilan() {
  const lignes = [];
  for (const t of etat.transactions) {
    const d = lireDate(t.date);
    if (d) lignes.push({ nm: numeroMois(d.annee, d.mois), jour: +t.date.slice(0, 2), d });
  }
  if (!lignes.length) return { liste: [], partiel: null };
  const nms = [...new Set(lignes.map(l => l.nm))].sort((a, b) => a - b);
  let debut = nms.length - 1;
  while (debut > 0 && nms[debut - 1] === nms[debut] - 1) debut--;
  let suite = nms.slice(debut);
  let partiel = null;
  const dernier = suite[suite.length - 1];
  const jourMax = Math.max(...lignes.filter(l => l.nm === dernier).map(l => l.jour));
  const annee = Math.floor(dernier / 12), mois = dernier % 12;
  if (jourMax < new Date(annee, mois + 1, 0).getDate() - 5) { partiel = { annee, mois, jusquau: jourMax }; suite = suite.slice(0, -1); }
  return { liste: suite.map(nm => ({ nm, annee: Math.floor(nm / 12), mois: nm % 12 })), partiel };
}

// ── Détection sur une série mensuelle ───────────────────────────────
// Renvoie le « nouveau niveau » (ou null) et les pics.
function detecterSerie(s, seuil) {
  const n = s.length, med = medianeDe(s);
  let niveau = null;
  if (n >= BILAN_MOIS_COMPARAISON) {
    const avant = medianeDe(s.slice(n - 6, n - 3)), apres = medianeDe(s.slice(n - 3));
    const d = apres - avant;
    if (Math.abs(d) >= seuil && Math.abs(d) / Math.max(avant, apres, 1) >= BILAN_SEUIL_RELATIF) {
      let i0 = n - 3;
      for (let i = n - 6; i < n; i++) if (Math.abs(s[i] - avant) > Math.abs(d) / 2 && Math.sign(s[i] - avant) === Math.sign(d)) { i0 = i; break; }
      niveau = { m: i0, avant, apres, delta: d, sens: d > 0 ? 1 : -1 };
    }
  }
  const pics = [];
  s.forEach((x, i) => {
    if (niveau && i >= n - 3) return;                         // fait partie du nouveau niveau
    if (niveau && Math.abs(x - niveau.avant) <= 0.25 * Math.max(niveau.avant, 1) + seuil / 2) return;   // appartient à l'ancien niveau
    if (x - med < Math.max(1.5 * seuil, 0.4 * Math.max(med, 1))) return;
    if (i < n - 1 && s[i + 1] > med + (x - med) * 0.5) return; // le mois suivant reste haut : pas un pic isolé
    pics.push({ m: i, valeur: x, ecart: x - med });
  });
  return { med, niveau, pics };
}

// Qui explique l'écart ? Les commerçants d'une sous-catégorie, classés par contribution.
function expliquer(index, cle, nms, mode, i, cible) {
  const m = index.get(cle);
  if (!m) return [];
  const n = nms.length, lignes = [];
  for (const [marchand, e] of m) {
    const v = nms.map(nm => e.parMois.get(nm) || 0);
    let delta;
    if (mode === "niveau") delta = moyenneDe(v.slice(n - 3)) - moyenneDe(v.slice(n - 6, n - 3));
    else { const autres = v.filter((_, k) => k !== i); delta = v[i] - moyenneDe(autres); }
    lignes.push({ nom: nomCommercant(marchand, "commercants", e.exemple), delta });
  }
  const total = lignes.reduce((s, l) => s + l.delta, 0), sens = Math.sign(total) || 1;
  const bons = lignes.filter(l => Math.sign(l.delta) === sens && Math.abs(l.delta) >= 1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const tete = bons.slice(0, 3), reste = bons.slice(3).reduce((s, l) => s + l.delta, 0);
  if (Math.abs(reste) >= 1) tete.push({ nom: "Autres", delta: reste });
  const somme = tete.reduce((s, l) => s + l.delta, 0);      // les parts s'additionnent à l'écart annoncé (médiane), pas à la moyenne
  if (cible && somme) tete.forEach(l => { l.delta *= cible / somme; });
  return tete;
}

// ── Le bilan complet ────────────────────────────────────────────────
// `horizon` : nombre de mois regardés (les plus récents) ; null = tous.
function calculerBilan(horizon) {
  const { liste: tous, partiel } = moisDuBilan();
  const devise = deviseDuBilan(), opts = { compte: "tous", devise, sansExceptionnelles: true };
  const mois = horizon ? tous.slice(-horizon) : tous, n = mois.length;
  const bilan = { devise, mois, n, partiel, totalMoisDisponibles: tous.length, categories: [], verdict: null };
  if (!n) return bilan;
  const nms = mois.map(m => m.nm);
  const periodes = mois.map(m => calculerPeriode(m.annee, [m.mois], opts));
  const classees = periodes.reduce((s, p) => s + p.nbCompte, 0), aClasser = periodes.reduce((s, p) => s + p.nbAClasser, 0);
  bilan.pourcentClasse = classees + aClasser ? Math.round(classees / (classees + aClasser) * 100) : null;
  const revenusMoy = moyenneDe(periodes.map(p => p.revenus));
  bilan.revenusMoy = revenusMoy;
  bilan.depensesMoy = moyenneDe(periodes.map(p => p.depense));
  bilan.epargneMoy = moyenneDe(periodes.map(p => p.epargne));
  bilan.resteMoy = revenusMoy - bilan.depensesMoy - bilan.epargneMoy;
  const seuil = Math.max(BILAN_SEUIL_EUROS, revenusMoy * 0.01);

  // Index commerçants (hors exceptionnelles) pour expliquer les écarts.
  const index = new Map();
  for (const { t, d, cat, montant, groupe, signe } of transactionsComptees({ compte: "tous", devise })) {
    if (t.exceptionnelle || !FAMILLES_BILAN.includes(familleDe(groupe))) continue;
    const nm = numeroMois(d.annee, d.mois);
    if (!nms.includes(nm)) continue;
    const cle = cat ? cat.id : "__sans-detail:" + groupe, marchand = cleApprentissage(t.libelle);
    if (!marchand) continue;
    if (!index.has(cle)) index.set(cle, new Map());
    const m = index.get(cle);
    if (!m.has(marchand)) m.set(marchand, { exemple: t.libelle, parMois: new Map() });
    const e = m.get(marchand);
    e.parMois.set(nm, (e.parMois.get(nm) || 0) - signe * montant);
  }

  const parId = new Map(etat.categories.map(c => [c.id, c]));
  const libMois = i => `${MOIS_COURTS[mois[i].mois]}`;
  const filtreOps = (cle, i) => ({ cat: cle.startsWith("__sans-detail:") ? "g:" + cle.slice(14) : cle, annee: mois[i].annee, mois: [mois[i].mois] });

  for (const famille of FAMILLES_BILAN) {
    if (famille === "frais" && !aDesFrais()) continue;
    const cle = { besoin: "besoins", envie: "envies", epargne: "epargne", frais: "frais" }[famille];
    const serie = periodes.map(p => p[cle]);
    if (serie.every(v => !v)) continue;                         // rien dans cette catégorie
    const carte = { famille, nom: nomFamille(famille), couleur: `var(--${cle})`, serie, med: medianeDe(serie), evenements: [], verdict: null, resume: "" };
    if (n >= BILAN_MOIS_MINI) {
      // Sous-catégories de cette famille.
      const cles = new Set();
      periodes.forEach(p => Object.keys(p.parSousCategorie).forEach(k => {
        const grp = k.startsWith("__sans-detail:") ? k.slice(14) : (parId.get(k) || {}).enveloppeId;
        if (grp && familleDe(grp) === famille) cles.add(k);
      }));
      for (const k of cles) {
        const s = periodes.map(p => p.parSousCategorie[k] || 0);
        const nom = k.startsWith("__sans-detail:") ? `${nomGroupe(k.slice(14))} (sans détail)` : (parId.get(k) || {}).nom;
        const { niveau, pics } = detecterSerie(s, seuil);
        if (niveau) {
          const monte = niveau.sens > 0, caus = expliquer(index, k, nms, "niveau", 0, niveau.delta);
          let piste = null;
          if (famille !== "epargne") piste = monte
            ? `Si vous reveniez au niveau d'avant (${euroBilan(niveau.avant, devise)} par mois), cela représenterait environ <b>${euroBilan(arrondi10(Math.abs(niveau.delta) * 12), devise)} de moins par an</b>.`
            : `<b>${euroBilan(Math.abs(niveau.delta), devise)} par mois</b> sont libérés dans votre budget : à vous de décider de leur affectation.`;
          carte.evenements.push({ m: niveau.m, type: "niveau", sens: niveau.sens, poids: Math.abs(niveau.delta) * 3, delta: niveau.delta, cle: k,
            titre: `${nom} : de ${euroBilan(niveau.avant, devise)} à ${euroBilan(niveau.apres, devise)} par mois`,
            texte: `${monte ? "Une hausse" : "Une baisse"} qui dure : médiane des 3 derniers mois, ${euroBilan(niveau.apres, devise)}, contre ${euroBilan(niveau.avant, devise)} pour les 3 mois d'avant.`,
            causes: caus, piste, filtre: filtreOps(k, niveau.m) });
        }
        for (const pic of pics) {
          const dernier = pic.m === n - 1;
          carte.evenements.push({ m: pic.m, type: "pic", sens: 1, poids: pic.ecart, cle: k,
            titre: `${libMois(pic.m)} : ${nom} (${euroBilan(pic.valeur, devise)})`,
            texte: dernier ? "Mois élevé : à confirmer le mois prochain (un pic ponctuel ou un nouveau niveau ?)." : "Pic ponctuel : retour à la normale le mois suivant. Pas de piste : cela ne semble pas durer.",
            causes: expliquer(index, k, nms, "pic", pic.m, pic.ecart), piste: null, filtre: filtreOps(k, pic.m) });
        }
      }
      // Épargne : un mois sans virement alors qu'il y en a d'habitude.
      if (famille === "epargne" && carte.med > 0) {
        serie.forEach((v, i) => { if (v <= 0) carte.evenements.push({ m: i, type: "manque", sens: -1, poids: carte.med, cle: null,
          titre: `${libMois(i)} : pas de virement d'épargne`,
          texte: `Les autres mois, l'épargne est de ${euroBilan(carte.med, devise)} (médiane) : ${serie.filter(x => x > 0).length} mois sur ${n} avec un virement.`, causes: [], piste: null, filtre: null }); });
      }
      // Dépenses exceptionnelles (à part).
      periodes.forEach((p, i) => p.exceptionnelles.filter(x => familleDe(x.groupe) === famille).forEach(x => carte.evenements.push({
        m: i, type: "exc", sens: 1, poids: 0, cle: null,
        titre: `${libMois(i)} : ${nomCommercant(cleApprentissage(x.t.libelle), "commercants", x.t.libelle)} (${euroBilan(x.montant, devise)})`,
        texte: "Dépense marquée exceptionnelle : elle est exclue de la courbe et des moyennes, pour ne pas fausser votre niveau habituel.", causes: [], piste: null, filtre: null })));
      // On garde les plus marquants, dans l'ordre des mois.
      const gardes = carte.evenements.filter(e => e.type !== "exc").sort((a, b) => b.poids - a.poids).slice(0, 4);
      carte.evenements = [...gardes, ...carte.evenements.filter(e => e.type === "exc")].sort((a, b) => a.m - b.m || (a.type === "exc") - (b.type === "exc"));

      // Verdict de la catégorie.
      const { niveau, med } = detecterSerie(serie, seuil);
      const bande = Math.max(seuil, med * 0.15), dehors = serie.filter(v => Math.abs(v - med) > bande).length;
      const estEpargne = famille === "epargne";
      if (niveau) carte.verdict = niveau.sens > 0 ? ["hausse", estEpargne ? "En hausse" : "En hausse"] : ["baisse", "En baisse"];
      else if (dehors / n >= 0.3) carte.verdict = ["variable", estEpargne ? "Irrégulière" : "En dents de scie"];
      else carte.verdict = ["stable", estEpargne ? "Régulière" : "Stable"];
      if (niveau) carte.resume = `De <b>${euroBilan(niveau.avant, devise)}</b> à <b>${euroBilan(niveau.apres, devise)} par mois</b> (médiane des 3 derniers mois face aux 3 précédents).`;
      else carte.resume = `Autour de <b>${euroBilan(med, devise)} par mois</b>${carte.verdict[0] === "stable" ? ", très régulier" : ", avec des écarts d'un mois à l'autre"}.`;
      const nbPics = carte.evenements.filter(e => e.type === "pic").length;
      if (nbPics) carte.resume += ` ${nbPics > 1 ? nbPics + " mois sortent" : "Un mois sort"} du lot.`;
    }
    bilan.categories.push(carte);
  }

  // Phrase d'ensemble.
  bilan.charges = chargesFixes(nms);
  return bilan;
}

// Charges fixes : les postes récurrents qui ne varient pas, en moyenne par mois.
function chargesFixes(nms) {
  let total = 0, nb = 0;
  for (const r of repererRecurrentes()) {
    if (r.variable || r.famille === "epargne" || r.famille === "revenu") continue;
    const masque = etat.noms && etat.noms.recurrentes && etat.noms.recurrentes[r.cle] && etat.noms.recurrentes[r.cle].masque;
    if (masque) continue;
    if (!(r.parMois.get(nms[nms.length - 1]) > 0)) continue;       // un poste terminé n'est plus une charge fixe
    const vals = nms.map(nm => r.parMois.get(nm)).filter(v => v > 0);
    if (vals.length >= Math.min(3, nms.length)) { total += medianeDe(vals); nb++; }
  }
  return nb ? { total, nb } : null;
}

function euroBilan(n, devise) {
  return (n < 0 ? "− " : "") + Math.round(Math.abs(n)).toLocaleString("fr-FR") + " " + symboleDevise(devise || deviseDuBilan());
}
