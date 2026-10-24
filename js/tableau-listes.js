// ═══════════════════════════════════════════════════════════════════
// TABLEAU DE BORD — « Ce qui revient chaque mois » et « Top 10 des commerçants »
// Les lignes sont REPÉRÉES dans vos relevés (js/tableau-calculs.js) : vous
// pouvez les renommer ou les retirer de la liste avec ✎, sans toucher aux
// opérations elles-mêmes (règle : les lignes du relevé ne changent jamais).
// ═══════════════════════════════════════════════════════════════════


const enEdition = (type, cle) => affichage.edition && affichage.edition.type === type && affichage.edition.cle === cle;

// La ligne de saisie qui remplace une ligne quand on clique sur ✎.
function editeurNom(type, cle, nomActuel, peutRetirer) {
  const c = echapper(cle);
  return `<div class="editeur-nom">
    <input type="text" class="champ-nom" value="${echapper(nomActuel)}" data-type="${type}" data-cle="${c}">
    <button class="bt p" data-ok-nom="1" data-type="${type}" data-cle="${c}">OK</button>
    ${peutRetirer ? `<button class="bt s" data-retirer="1" data-type="${type}" data-cle="${c}">Retirer de la liste</button>` : ""}
    <button class="bt s" data-annuler-nom="1">Annuler</button>
  </div>`;
}

// ── Ce qui revient chaque mois ───────────────────────────────────────
function ligneRecurrente(l) {
  if (enEdition("recurrentes", l.cle)) {
    return `<tr><td colspan="2">${editeurNom("recurrentes", l.cle, l.nom, true)}</td></tr>`;
  }
  return `<tr>
    <td>${echapper(l.nom)}${l.variable ? '<span class="var">⚠ montant variable</span>' : ""}</td>
    <td class="d">${euro2(l.total)} <button class="crayon" title="Renommer ou retirer" data-editer="recurrentes" data-cle="${echapper(l.cle)}">✎</button></td>
  </tr>`;
}

function colonneRecurrente(titre, aide, couleur, lignes, credits) {
  const libelleCol = affichage.mois === "annee" ? "Sur l'année" : (moisDeLaSelection(affichage.mois).length > 1 ? "Sur la période" : "Ce mois-ci");
  const total = lignes.concat(credits || []).reduce((s, l) => s + l.total, 0);
  const blocCredits = credits && credits.length
    ? `<tr><td colspan="2" class="sous-bloc"><b>Crédits &amp; mensualités</b></td></tr>${credits.map(ligneRecurrente).join("")}`
    : "";
  const corps = lignes.length === 0 && !(credits && credits.length)
    ? `<p class="aide-col">Rien de récurrent repéré ici sur cette période.</p>`
    : `<table><tr><th>Poste</th><th class="d">${libelleCol}</th></tr>${lignes.map(ligneRecurrente).join("")}${blocCredits}
         <tr class="total"><td>Total</td><td class="d">${euro2(total)}</td></tr></table>`;
  return `<div class="col" style="--c:${couleur}"><h3>${titre}</h3><p class="aide-col">${aide}</p>${corps}</div>`;
}

// Tant qu'il y a moins de 3 mois de relevés, rien ne peut être « repéré » :
// on montre ce que VOUS avez déclaré (étape 3), clairement étiqueté.
function colonneDeclaree() {
  const f = etat.foyer;
  const lignes = [];
  if (nombreDe(f.loyerMensuel) > 0) lignes.push(["Loyer", nombreDe(f.loyerMensuel), ""]);
  if (nombreDe(f.creditMensuel) > 0) lignes.push(["Crédit immobilier", nombreDe(f.creditMensuel), ""]);
  (f.prets || []).forEach(p => {
    if (nombreDe(p.mensualite) > 0) lignes.push([p.nom || p.nature || "Prêt", nombreDe(p.mensualite), p.echeance ? `jusqu'à ${p.echeance}` : ""]);
  });
  const corps = lignes.length === 0
    ? `<p class="aide-col">Rien de déclaré pour l'instant (étape 3 du paramétrage).</p>`
    : `<table><tr><th>Poste</th><th class="d">Par mois</th></tr>${lignes.map(([nom, m, fin]) => `
        <tr><td>${echapper(nom)}${fin ? `<span class="fin">${echapper(fin)}</span>` : ""}</td><td class="d">${euro2(m)}</td></tr>`).join("")}</table>`;
  return `<div class="col" style="--c:var(--besoins)"><h3>${echapper(nomFamille("besoin"))}</h3><p class="aide-col">Déclaré à l'étape 3 — pas encore vérifié dans vos relevés</p>${corps}</div>`;
}

function rendreRecurrentes() {
  const entete = `
    <h2>Ce qui revient chaque mois</h2>
    <p class="aide">Repéré dans vos relevés : un poste qui apparaît dans au moins ${MOIS_MINIMUM_RECURRENT} mois différents.
    Renommez ou retirez une ligne avec ✎ (vos opérations, elles, ne changent jamais).</p>`;

  if (nombreDeMoisAvecDonnees() < MOIS_MINIMUM_RECURRENT) {
    return `<div class="carte">${entete}
      <p class="aide">Le repérage automatique demande au moins ${MOIS_MINIMUM_RECURRENT} mois de relevés. En attendant, voici ce que vous avez déclaré :</p>
      <div class="trois">${colonneDeclaree()}
        <div class="col" style="--c:var(--envies)"><h3>${echapper(nomFamille("envie"))}</h3><p class="aide-col">Apparaîtra avec vos relevés.</p></div>
        <div class="col" style="--c:var(--epargne)"><h3>${echapper(nomFamille("epargne"))}</h3><p class="aide-col">Apparaîtra avec vos relevés.</p></div></div></div>`;
  }

  const { lignes, nbMasquees } = recurrentesPourPeriode(affichage.annee, moisDeLaSelection(affichage.mois));
  const de = (famille, credit) => lignes.filter(l => l.famille === famille && l.estCredit === credit);
  const reaffichage = nbMasquees > 0
    ? `<p class="aide" style="margin:14px 0 0">${nbMasquees} ligne${nbMasquees > 1 ? "s" : ""} retirée${nbMasquees > 1 ? "s" : ""} de cette liste.
       <button class="lien-discret" data-reafficher="1">Tout réafficher</button></p>`
    : "";
  return `<div class="carte">${entete}<div class="trois">
      ${colonneRecurrente(nomFamille("besoin"), "Charges fixes, abonnements, crédits", "var(--besoins)", de("besoin", false), de("besoin", true))}
      ${colonneRecurrente(nomFamille("envie"), "Ce qui revient, mais qu'on choisit", "var(--envies)", de("envie", false).concat(de("envie", true)))}
      ${colonneRecurrente(nomFamille("epargne"), "Vos virements réguliers", "var(--epargne)", de("epargne", false).concat(de("epargne", true)))}
      ${de("frais", false).concat(de("frais", true)).length ? colonneRecurrente(nomFamille("frais"), "Crédits, frais bancaires", "var(--frais)", de("frais", false).concat(de("frais", true))) : ""}
    </div>${reaffichage}</div>`;
}

// ── Top 10 des commerçants ───────────────────────────────────────────
function rendreTopCommercants() {
  const entete = `
    <h2>Top 10 des commerçants</h2>
    <p class="aide">Les enseignes sont regroupées (toutes vos lignes « Monoprix » ensemble) pour ${titrePeriode()}.
    Les lignes de votre relevé, elles, ne sont jamais modifiées.</p>`;
  const { lignes, nbTotal } = topCommercants(affichage.annee, moisDeLaSelection(affichage.mois));
  if (lignes.length === 0) return `<div class="carte">${entete}<p class="aide" style="margin:0">Aucune dépense classée sur cette période.</p></div>`;

  const rangs = lignes.map((l, i) => {
    const nom = enEdition("commercants", l.cle)
      ? editeurNom("commercants", l.cle, l.nom, false)
      : `<span class="puce" style="background:${l.couleur}"></span>${echapper(l.nom)}`;
    const crayon = enEdition("commercants", l.cle) ? "" : `<button class="crayon" title="Renommer" data-editer="commercants" data-cle="${echapper(l.cle)}">✎</button>`;
    return `<tr><td class="rang">${i + 1}</td><td>${nom}</td><td class="d">${euro2(l.total)}</td><td class="d">${l.nb}</td><td class="d">${crayon}</td></tr>`;
  }).join("");
  return `<div class="carte">${entete}
    <table><tr><th></th><th>Commerçant</th><th class="d">Total</th><th class="d">Opérations</th><th></th></tr>${rangs}</table>
    <p class="aide" style="margin:12px 0 0">${lignes.length} affiché${lignes.length > 1 ? "s" : ""} sur ${nbTotal} commerçant${nbTotal > 1 ? "s" : ""}.</p></div>`;
}

// ── Retouches d'affichage (✎) ────────────────────────────────────────
function retoucherNom(type, cle, changements) {
  if (!etat.noms) etat.noms = { recurrentes: {}, commercants: {} };
  if (!etat.noms[type]) etat.noms[type] = {};
  etat.noms[type][cle] = { ...(etat.noms[type][cle] || {}), ...changements };
  sauvegarderEtat(etat);
}
