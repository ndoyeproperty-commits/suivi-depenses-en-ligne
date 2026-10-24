// ═══════════════════════════════════════════════════════════════════
// TABLEAU DE BORD — « Revenus attendus et reçus » et « À surveiller »
// Tout est déduit de VOS relevés et de ce que vous avez déclaré à
// l'étape 1 ; une alerte n'apparaît que si elle repose sur des lignes
// réelles (règle ②). Ce sont des signaux, jamais des certitudes :
// chaque message dit simplement ce qui a été repéré.
// ═══════════════════════════════════════════════════════════════════

// ── Revenus attendus et reçus ────────────────────────────────────────
// On rapproche chaque revenu déclaré (étape 1) d'une entrée d'argent
// classée « Revenus », mois par mois : même montant à 10 % près.
const TOLERANCE_REVENU = 0.10;

function revenusDeclares() {
  const liste = [];
  etat.personnes.forEach(pe => (pe.revenus || []).forEach(r => {
    const montant = nombreDe(r.montant);
    if (montant > 0) liste.push({ id: r.id, nom: r.nom || r.type, type: r.type, montant, jour: String(r.jourVersement || "").trim() });
  }));
  return liste;
}

function calculerRevenusAttendus(annee, mois, p) {
  const declares = revenusDeclares();
  const dispo = periodesDisponibles().get(annee) || new Set();
  const moisAvecDonnees = mois.filter(m => dispo.has(m));

  // Les entrées classées « Revenus » de la période, mois par mois.
  const entrees = new Map();   // mois → [{ montant, jour, utilise }]
  for (const { t, d, montant, groupe, signe } of transactionsComptees()) {
    if (familleDe(groupe) !== "revenu" || signe !== 1 || !dansLaSelection(d, annee, mois)) continue;
    if (!entrees.has(d.mois)) entrees.set(d.mois, []);
    entrees.get(d.mois).push({ montant, jour: t.date.slice(0, 2), utilise: false });
  }

  const lignes = declares.map(r => {
    let recus = 0, total = 0, jourRecu = null;
    for (const m of moisAvecDonnees) {
      const candidates = (entrees.get(m) || []).filter(e => !e.utilise && Math.abs(e.montant - r.montant) <= r.montant * TOLERANCE_REVENU);
      candidates.sort((a, b) => Math.abs(a.montant - r.montant) - Math.abs(b.montant - r.montant));
      if (candidates[0]) { candidates[0].utilise = true; recus++; total += candidates[0].montant; jourRecu = candidates[0].jour; }
    }
    return { ...r, recus, attendus: moisAvecDonnees.length, total, jourRecu };
  });
  const rattache = lignes.reduce((s, l) => s + l.total, 0);
  return { lignes, autres: p.revenus - rattache, aDeclares: declares.length > 0, moisAvecDonnees };
}

function rendreRevenusAttendus(p) {
  const entete = `
    <h2>Revenus attendus et reçus</h2>
    <p class="aide">D'après ce que vous avez déclaré à l'étape 1 : attendu, et reçu ou non (rapproché de vos entrées classées « Revenus », à 10 % près).</p>`;
  const r = calculerRevenusAttendus(affichage.annee, moisDeLaSelection(affichage.mois), p);
  if (!r.aDeclares) {
    return `<div class="carte">${entete}<p class="aide" style="margin:0">Aucun revenu avec un montant n'a été renseigné à l'étape 1.
      <button class="lien-discret" data-vue="personnes">Les renseigner</button></p></div>`;
  }
  const multi = r.moisAvecDonnees.length > 1;
  const lignes = r.lignes.map(l => {
    let statut;
    if (multi) statut = `<span class="statut ${l.recus === l.attendus ? "ok" : ""}">${l.recus} mois sur ${l.attendus}</span>`;
    else if (l.recus === 1) statut = `<span class="statut ok">Reçu le ${l.jourRecu}</span>`;
    else statut = `<span class="statut retard">Attendu${l.jour ? " le " + echapper(l.jour) : ""} — non repéré dans vos relevés</span>`;
    return `<tr><td>${echapper(l.nom)}<span class="fin">${echapper(l.type)}${l.jour ? " · versé le " + echapper(l.jour) : ""}</span></td>
      <td>${statut}</td><td class="d">${euro2(l.total)}</td></tr>`;
  }).join("");
  const autres = Math.abs(r.autres) >= 0.5
    ? `<tr><td>Autres entrées classées en revenus<span class="fin">non rattachées à un revenu déclaré</span></td><td><span class="statut">—</span></td><td class="d">${euro2(r.autres)}</td></tr>`
    : "";
  return `<div class="carte">${entete}<table>
    <tr><th>Revenu</th><th>Statut</th><th class="d">${multi ? "Reçu sur la période" : "Reçu ce mois-ci"}</th></tr>
    ${lignes}${autres}
    <tr class="total"><td>Total des revenus</td><td></td><td class="d">${euro2(p.revenus)}</td></tr></table></div>`;
}

// ── À surveiller ─────────────────────────────────────────────────────
const IDS_FRAIS = ["frais-bancaires", "frais-cb"];

function alertesDuTableau(p, revenus) {
  const annee = affichage.annee, mois = moisDeLaSelection(affichage.mois);
  const alertes = [];
  const alerte = (html, bouton, forte = false, filtre = {}) => alertes.push({ html, bouton, forte, filtre });

  // 1. Des lignes qu'aucune sous-catégorie ne range : elles ne comptent nulle part.
  if (p.nbAClasser > 0) {
    alerte(`<b>${p.nbAClasser} opération${p.nbAClasser > 1 ? "s" : ""}</b> ${p.nbAClasser > 1 ? "n'ont" : "n'a"} pas encore de catégorie : ${p.nbAClasser > 1 ? "elles ne sont comptées" : "elle n'est comptée"} nulle part.`, "Classer", true, { puces: ["aclasser"] });
  }

  // 2. Un revenu déclaré qu'on ne retrouve pas (un seul mois choisi seulement).
  if (revenus.aDeclares && revenus.moisAvecDonnees.length === 1) {
    revenus.lignes.filter(l => l.recus === 0).forEach(l =>
      alerte(`<b>${echapper(l.nom)}</b> : attendu${l.jour ? " le " + echapper(l.jour) : ""}, non repéré dans vos relevés ce mois-ci.`, "voir les opérations", false, { q: l.nom }));
  }

  // 3. Des lignes en double (même date, même libellé, même montant) : fichier importé deux fois ?
  const vues = new Map();
  let nbDoubles = 0;
  for (const { t, d } of toutesLesLignes()) {
    if (t.ignoree || !dansLaSelection(d, annee, mois)) continue;
    const cle = [t.date, t.libelle, t.montant, t.sens].join("|");
    if (vues.has(cle)) nbDoubles++; else vues.set(cle, true);
  }
  if (nbDoubles > 0) {
    alerte(`À vérifier : <b>${nbDoubles} opération${nbDoubles > 1 ? "s" : ""}</b> ${nbDoubles > 1 ? "apparaissent" : "apparaît"} en double (même date, même libellé, même montant). Un relevé importé deux fois ?`, "voir les opérations", false, { puces: ["doublons"] });
  }

  // 4. Des frais bancaires : l'objectif est zéro.
  const frais = IDS_FRAIS.reduce((s, id) => s + (p.parSousCategorie[id] || 0), 0);
  if (frais > 0.005) alerte(`<b>${euro2(frais)}</b> de frais bancaires &amp; agios sur ${titrePeriode()} — l'objectif est 0.`, "voir les opérations", false, { cat: "c:frais-bancaires" });

  // 5. Un poste récurrent qui augmente, ou qui a disparu.
  const moisDonnees = [...new Set([...transactionsComptees()].map(({ d }) => numeroMois(d.annee, d.mois)))].sort((a, b) => a - b);
  const masquees = (etat.noms && etat.noms.recurrentes) || {};
  for (const r of repererRecurrentes()) {
    if (masquees[r.cle] && masquees[r.cle].masque) continue;
    const nom = echapper(nomCommercant(r.cle, "recurrentes", r.exemple));
    const presents = [...r.parMois.entries()].filter(([, v]) => v > 0).sort((a, b) => a[0] - b[0]);
    const dernier = presents[presents.length - 1];
    const avant = presents.slice(0, -1).map(([, v]) => v).sort((a, b) => a - b);
    const mediane = avant[Math.floor(avant.length / 2)];
    const dernierMoisGlobal = moisDonnees[moisDonnees.length - 1];

    if (dernier[0] === dernierMoisGlobal && mediane > 0 && dernier[1] > mediane * 1.25 && dernier[1] - mediane > 5) {
      alerte(`<b>${nom}</b> : le prélèvement passe d'environ ${euro2(mediane)} à ${euro2(dernier[1])} — soit +${Math.round((dernier[1] / mediane - 1) * 100)} %.`, "voir les opérations", false, { q: nomCommercant(r.cle, "recurrentes", r.exemple) });
    } else if (moisDonnees.length >= 5 && dernier[0] < moisDonnees[moisDonnees.length - 2]) {
      const m = dernier[0] % 12, a = Math.floor(dernier[0] / 12);
      alerte(`<b>${nom}</b> n'apparaît plus depuis ${MOIS_COURTS[m]} ${a} — terminé ? (environ ${euro2(mediane || dernier[1])} par mois libérés)`, "voir les opérations", false, { q: nomCommercant(r.cle, "recurrentes", r.exemple) });
    }
  }
  return alertes;
}

function rendreLigneAlertes(alertes) {
  if (alertes.length === 0) return "";
  return `<div class="ligne-alertes"><a data-aller="surveiller">⚑ ${alertes.length} point${alertes.length > 1 ? "s" : ""} à surveiller · voir</a></div>`;
}

function rendreSurveiller(alertes) {
  const entete = `<h2>À surveiller <span class="periode-titre">· ${titrePeriode()}</span></h2><p class="aide">Ce qui mérite votre attention. Ce sont des signaux repérés dans vos relevés, pas des certitudes.</p>`;
  if (alertes.length === 0) {
    return `<div class="carte" id="surveiller">${entete}<p class="aide" style="margin:0">Rien à signaler pour l'instant.</p></div>`;
  }
  const visibles = affichage.toutesAlertes ? alertes : alertes.slice(0, 3);
  const plus = alertes.length > 3
    ? `<button class="plus" data-plus-alertes="1">${affichage.toutesAlertes ? "Réduire" : `Voir les ${alertes.length - 3} autre${alertes.length - 3 > 1 ? "s" : ""}`}</button>`
    : "";
  return `<div class="carte" id="surveiller">${entete}
    ${visibles.map(a => `<div class="alerte ${a.forte ? "forte" : ""}"><span>${a.html}</span>
      <button class="bouton-mini" data-ops-filtre="${echapper(JSON.stringify(a.filtre || {}))}">${a.bouton}</button></div>`).join("")}${plus}</div>`;
}
