// ═══════════════════════════════════════════════════════════════════
// LES RÈGLES — « si le libellé contient … alors ranger dans … »
// Elles PROPOSENT, elles ne confirment jamais : une ligne rangée par une
// règle reste « suggérée » tant que vous ne l'avez pas validée (✓).
// Quand plusieurs règles visent la même ligne, la plus précise (le motif
// le plus long) l'emporte.
// ═══════════════════════════════════════════════════════════════════

// Le libellé tel qu'on le compare : sans le préfixe « CARTE X1234 12/03 », en majuscules.
const normaliserLibelle = l => String(l).replace(/CARTE\s+X?\d+\s+\d{2}\/\d{2}\s*/i, "").toUpperCase().replace(/\s+/g, " ").trim();
const normaliserMotif = m => String(m).toUpperCase().replace(/\s+/g, " ").trim();

// La cible d'une règle, si elle existe encore (une catégorie supprimée n'est plus une cible).
function cibleDeRegle(r) {
  const cat = r.categorieId && etat.categories.find(c => c.id === r.categorieId);
  if (cat) return { categorieId: cat.id, groupeId: null };
  if (r.groupeId && enveloppeDe(r.groupeId)) return { categorieId: null, groupeId: r.groupeId };
  return null;
}

function reglesQuiConcernent(libelle, sens) {
  const n = normaliserLibelle(libelle);
  return etat.regles.filter(r => r.motif && n.includes(normaliserMotif(r.motif)) && (!r.sens || !sens || r.sens === sens) && cibleDeRegle(r));
}
// La règle qui s'applique : la plus précise ; à précision égale, la plus récente (la dernière de la liste).
function meilleureRegle(libelle, sens) {
  const liste = reglesQuiConcernent(libelle, sens);
  if (!liste.length) return null;
  return liste.reduce((a, b) => normaliserMotif(b.motif).length >= normaliserMotif(a.motif).length ? b : a);
}
// Les lignes pour lesquelles CETTE règle est celle qui s'applique.
const lignesDeRegle = r => etat.transactions.filter(t => { const m = meilleureRegle(t.libelle, t.sens); return m && m.id === r.id; });

// Quand vous classez une ligne, l'appli retient le commerçant : une règle « apprise ».
function retenirRegleDeLigne(t) {
  const cible = t.categorieId ? { categorieId: t.categorieId, groupeId: null } : (t.groupeId ? { categorieId: null, groupeId: t.groupeId } : null);
  if (!cible) return;
  const motif = cleApprentissage(t.libelle);
  if (!motif) return;
  const existante = etat.regles.find(r => normaliserMotif(r.motif) === normaliserMotif(motif) && !r.sens);
  if (existante) Object.assign(existante, cible);
  else etat.regles.push({ id: "r" + crypto.randomUUID().slice(0, 8), motif, sens: "", source: "apprise", ...cible });
}
