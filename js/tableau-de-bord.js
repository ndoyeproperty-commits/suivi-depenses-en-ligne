// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — LE TABLEAU DE BORD
// Construit à partir de la maquette maquettes/tableau-de-bord.html.
// Étape 2 : filtres de période, bandeau de fiabilité, tuiles, et la
// barre « Que deviennent vos revenus ? ». Étape 3 : « Où va l'argent » et
// l'évolution mensuelle (js/tableau-graphiques.js). La suite — récurrentes,
// top 10 — arrive ensuite.
// RÈGLE ② : aucun chiffre sans transactions derrière ; sinon « — ».
// ═══════════════════════════════════════════════════════════════════

// Ce qui est choisi à l'écran (garde en mémoire tant que la page est ouverte).
const affichage = { annee: null, mois: "annee", multi: false, edition: null, toutesAlertes: false, compte: "tous", devise: null };

const euro = n => (n < 0 ? "− " : "") + Math.round(Math.abs(n)).toLocaleString("fr-FR") + " " + symboleDevise(affichage.devise || "EUR");
const REPERE = { besoins: 0.5, envies: 0.3, epargne: 0.2 };   // la règle 50 / 30 / 20 (un repère, pas un objectif)

function titrePeriode() {
  return affichage.mois === "annee" ? String(affichage.annee) : `${libelleMois(affichage.mois)} ${affichage.annee}`;
}

// ── Filtres : année, mois, « plusieurs mois » ───────────────────────
function rendreFiltres(dispo) {
  const annees = [...dispo.keys()].sort();
  const moisDispo = dispo.get(affichage.annee) || new Set();
  const boutonAnnee = a => `<button class="pill ${a === affichage.annee ? "on" : ""}" data-an="${a}">${a}</button>`;
  const boutonMois = i => {
    const choisi = affichage.mois !== "annee" && affichage.mois.includes(i);
    return `<button class="pill ${choisi ? "on" : ""}" data-mois="${i}" ${moisDispo.has(i) ? "" : "disabled"}>${MOIS_COURTS[i]}</button>`;
  };
  return `
    <div class="filtres">
      <div class="groupe">
        ${annees.map(boutonAnnee).join("")}
        <button class="pill ${affichage.mois === "annee" ? "on" : ""}" data-mois="annee">Toute l'année</button>
        <button class="pill ${affichage.multi ? "on" : ""}" data-multi="1" title="Cliquer sur plusieurs mois pour les additionner">＋ Plusieurs mois</button>
      </div>
      <div class="groupe">${[...Array(12).keys()].map(boutonMois).join("")}</div>
      ${rendreFiltresCompte()}
    </div>`;
}

// ── Compte et devise ────────────────────────────────────────────────
// Un compte garde sa devise ; « Tous les comptes » additionne en convertissant
// aux taux que vous avez saisis (étape 2).
function normaliserCompteEtDevise() {
  if (affichage.compte !== "tous" && !compteParId(affichage.compte)) affichage.compte = "tous";
  const devises = devisesDesComptes();
  const natif = affichage.compte === "tous" ? devises[0] : deviseDuCompte(affichage.compte);
  if (!affichage.devise || (!devises.includes(affichage.devise) && affichage.devise !== natif)) affichage.devise = natif;
}
function devisePossible(vers) {
  const natifs = affichage.compte === "tous" ? devisesDesComptes() : [deviseDuCompte(affichage.compte)];
  return natifs.every(d => d === vers || (tauxPour(d, null) != null && tauxPour(vers, null) != null));
}
function rendreFiltresCompte() {
  const devises = devisesDesComptes();
  if (etat.comptes.length < 2 && devises.length < 2) return "";
  const comptes = etat.comptes.length < 2 ? "" : `
    <select class="pill" id="choix-compte-tableau">
      <option value="tous" ${affichage.compte === "tous" ? "selected" : ""}>Tous les comptes</option>
      ${etat.comptes.map((c, i) => `<option value="${c.id}" ${c.id === affichage.compte ? "selected" : ""}>${echapper(nomDuCompte(c, i))} (${codeDevise(c.devise)})</option>`).join("")}
    </select>`;
  const pilules = devises.length < 2 ? "" : devises.map(d => {
    const possible = devisePossible(d);
    return `<button class="pill ${d === affichage.devise ? "on" : ""}" data-devise="${d}" ${possible ? "" : 'disabled title="Saisissez un taux de change à l\'étape 2 pour afficher dans cette devise"'}>${d === "EUR" ? "€ EUR" : d}</button>`;
  }).join("");
  return `<div class="groupe ligne-compte">${comptes}${pilules}</div>`;
}

// ── Bandeau de fiabilité : à quel point peut-on se fier aux chiffres ? ──
function rendreFiabilite(p) {
  const total = p.nbCompte + p.nbAClasser;
  const pct = total === 0 ? 0 : Math.round(p.nbCompte / total * 100);
  const etendue = etenduDesDonnees();
  const morceaux = [];
  if (p.nbAClasser > 0) morceaux.push(`<a class="bouton-mini" data-ops-filtre="${echapper(JSON.stringify({ puces: ["aclasser"] }))}">${p.nbAClasser} à classer</a>`);
  if (p.nbSuggerees > 0) morceaux.push(`<span>${p.nbSuggerees} classée${p.nbSuggerees > 1 ? "s" : ""} automatiquement, à valider</span>`);
  if (p.nbSansTaux > 0) morceaux.push(`<a class="bouton-mini" data-vue="comptes">${p.nbSansTaux} opération${p.nbSansTaux > 1 ? "s" : ""} sans taux de change</a>`);
  if (p.nbIllisibles > 0) morceaux.push(`<a class="bouton-mini" data-ops-filtre="${echapper(JSON.stringify({ puces: ["illisibles"] }))}">${p.nbIllisibles} sans montant ou sens lisible</a>`);
  return `
    <div class="fiabilite">
      <span class="jauge"><b>${pct} %</b> des opérations classées <span class="rail"><i style="width:${pct}%"></i></span></span>
      ${morceaux.join("")}
      <span class="droite">Données du ${etendue.debut} au ${etendue.fin} · ${etat.transactions.length} opérations</span>
    </div>`;
}

// ── Comparaison ▲ / ▼ avec la période de référence ───────────────────
function rendreEvolution(valeur, ancien, sens, lib) {
  if (ancien === 0) return "";
  const ecart = valeur - ancien;
  const pct = Math.round(Math.abs(ecart) / Math.abs(ancien) * 100);
  if (pct === 0) return `<span class="evol"><span class="neutre">●</span> stable vs ${lib}</span>`;
  const hausse = ecart > 0;
  const classe = sens === 0 ? "neutre" : ((hausse ? 1 : -1) === sens ? "bon" : "mauvais");
  return `<span class="evol"><span class="${classe}">${hausse ? "▲" : "▼"}</span> <b>${pct} %</b> (${hausse ? "+" : "−"}${euro(Math.abs(ecart)).replace("− ", "")}) vs ${lib}</span>`;
}

function rendreTuiles(p, ref) {
  const nbMois = moisDeLaSelection(affichage.mois).length;
  const defs = [
    ["Revenus", "revenus", 1, ""],
    ["Dépenses", "depense", -1, aDesFrais() ? "besoins + envies + frais & crédits" : "besoins + envies"],
    ["Épargne", "epargne", 1, "mis de côté"],
    ["Reste", "reste", 1, "d'après les opérations classées"],
  ];
  return defs.map(([titre, cle, sens, sous]) => {
    const valeur = p[cle];
    const evolution = ref ? rendreEvolution(valeur, ref.calcul[cle], sens, ref.lib) : "";
    const negatif = cle === "reste" && valeur < 0;
    return `
      <div class="tuile">
        <div class="lib">${titre} · ${titrePeriode()}</div>
        <div class="val ${negatif ? "alerte" : ""}">${euro(valeur)}</div>
        ${evolution}
        <div class="sous">${sous || "&nbsp;"}</div>
      </div>`;
  }).join("");
}

// ── La barre « Que deviennent vos revenus ? » ────────────────────────
function rendreBarre(p) {
  const entete = `
    <h2>Que deviennent vos revenus ?</h2>
    <p class="aide">Tout ce qui est entré sur vos comptes (${titrePeriode()}), réparti entre vos besoins, vos envies et votre épargne.</p>`;

  if (p.revenus <= 0) {
    return `<div class="carte">${entete}
      <p class="aide" style="margin:0">Aucun revenu classé sur cette période : les pourcentages ne sont pas calculables.
      Classez vos entrées d'argent dans « Revenus » depuis l'import.</p></div>`;
  }

  const sorties = p.depense + p.epargne;
  const depasse = sorties > p.revenus;
  const base = Math.max(p.revenus, sorties);               // la barre est toujours à l'échelle
  const largeur = v => (Math.max(v, 0) / base * 100).toFixed(2) + "%";
  const pct = v => Math.round(v / p.revenus * 100);
  const libelle = (nom, v) => v / base >= 0.1 ? `${nom} ${pct(v)} %` : (v / base >= 0.03 ? `${pct(v)} %` : "");

  const segments = [
    `<div class="seg besoins" style="width:${largeur(p.besoins)}">${libelle(echapper(nomFamille("besoin")), p.besoins)}</div>`,
    `<div class="seg envies" style="width:${largeur(p.envies)}">${libelle(echapper(nomFamille("envie")), p.envies)}</div>`,
    `<div class="seg epargne" style="width:${largeur(p.epargne)}">${libelle(echapper(nomFamille("epargne")), p.epargne)}</div>`,
  ];
  if (aDesFrais()) segments.push(`<div class="seg frais" style="width:${largeur(p.frais)}">${libelle(echapper(nomFamille("frais")), p.frais)}</div>`);
  if (depasse) segments.push(`<div class="seg depasse" style="width:${largeur(sorties - p.revenus)}">+${euro(sorties - p.revenus).replace("− ", "")}</div>`);
  else segments.push(`<div class="seg reste" style="width:${largeur(p.reste)}" title="Reste ${pct(p.reste)} %">${libelle("Reste", p.reste)}</div>`);
  const marque = depasse ? `<div class="marque" style="left:${largeur(p.revenus)}"><span>revenus ${euro(p.revenus)}</span></div>` : "";
  const avecRepere = Boolean(etat.preferences && etat.preferences.repere503020);
  const repere = Object.values(REPERE).map((part, i) =>
    `<i style="width:${(part * p.revenus / base * 100).toFixed(2)}%;background:var(--${["besoins", "envies", "epargne"][i]})"></i>`).join("");

  const phrase = (cle, nom) => {
    const part = p[cle] / p.revenus;
    const ecart = Math.round((part - REPERE[cle]) * 100);
    const jug = Math.abs(ecart) <= 2 ? "dans le repère" : ecart > 0 ? `${ecart} points au-dessus du repère` : `${-ecart} points sous le repère`;
    return `<div class="p"><span class="point" style="background:var(--${cle})"></span>
      <span><b>${nom}</b> : ${euro(p[cle])}, soit ${Math.round(part * 100)} % de vos revenus${avecRepere ? ` — ${jug} de ${Math.round(REPERE[cle] * 100)} %` : ""}.</span></div>`;
  };
  const cle = depasse
    ? `Vous avez dépensé et épargné ${euro(sorties - p.revenus).replace("− ", "")} de plus que vos revenus.`
    : `Il vous reste ${euro(p.reste)} (${pct(p.reste)} % de vos revenus).`;

  return `<div class="carte">${entete}
    <div class="barre">${segments.join("")}${marque}</div>
    ${avecRepere ? `<div class="repere">${repere}</div>
    <div class="legende-repere">Repère 50 / 30 / 20 (${echapper(nomFamille("besoin")).toLowerCase()} / ${echapper(nomFamille("envie")).toLowerCase()} / ${echapper(nomFamille("epargne")).toLowerCase()}) — un repère courant, pas une norme.
      <button class="lien-repere" data-repere="0">Masquer</button></div>`
      : `<div class="legende-repere"><button class="lien-repere" data-repere="1">Afficher un repère 50 / 30 / 20 (facultatif)</button></div>`}
    <div class="phrase-cle">${cle}</div>
    <div class="phrases">${phrase("besoins", echapper(nomFamille("besoin")))}${phrase("envies", echapper(nomFamille("envie")))}${phrase("epargne", echapper(nomFamille("epargne")))}${p.frais > 0 ? `<div class="p"><span class="point" style="background:var(--frais)"></span><span><b>${echapper(nomFamille("frais"))}</b> : ${euro(p.frais)}, soit ${Math.round(p.frais / p.revenus * 100)} % de vos revenus (pas de repère : ce sont des frais à surveiller).</span></div>` : ""}</div>
  </div>`;
}

// ── « Vos comptes » : un tableau à la place des tuiles quand « Tous les comptes » ──
function rendreTableauComptes(p, ref) {
  const mois = moisDeLaSelection(affichage.mois);
  const devise = affichage.devise;
  const celluleNative = (valeur, natif) => `<td class="d">${valeur === null ? "—" : formaterDevise(valeur, natif)}${valeur !== null && natif !== devise ? `<span class="fin">≈ ${valeur.conv}</span>` : ""}</td>`;
  const lignes = etat.comptes.map((c, i) => {
    const natif = codeDevise(c.devise);
    const q = calculerPeriode(affichage.annee, mois, { compte: c.id, devise: natif });
    if (q.nbCompte === 0) return `<tr><td>${echapper(nomDuCompte(c, i))}</td><td>${natif}</td><td class="d" colspan="4"><span class="fin">Aucune opération classée sur cette période</span></td></tr>`;
    const qc = natif === devise ? q : calculerPeriode(affichage.annee, mois, { compte: c.id, devise });
    const cel = cle => `<td class="d">${formaterDevise(q[cle], natif)}${natif !== devise ? `<span class="fin">≈ ${formaterDevise(qc[cle], devise)}</span>` : ""}</td>`;
    return `<tr><td>${echapper(nomDuCompte(c, i))}</td><td>${natif}</td>${cel("revenus")}${cel("depense")}${cel("epargne")}${cel("reste")}</tr>`;
  }).join("");

  const evol = (cle, sens) => {
    if (!ref) return "";
    const ancien = ref.calcul[cle], valeur = p[cle];
    if (!ancien) return "";
    const pct = Math.round(Math.abs(valeur - ancien) / Math.abs(ancien) * 100), hausse = valeur > ancien;
    const classe = pct === 0 ? "" : ((hausse ? 1 : -1) === sens ? "bon" : "mauvais");
    return `<span class="fin evol-total ${classe}">${hausse ? "▲" : "▼"} ${pct} %</span><span class="fin vs">vs ${ref.lib}</span>`;
  };
  const total = (cle, sens) => `<td class="d">${euro(p[cle])}${evol(cle, sens)}</td>`;
  const note = p.nbSansTaux > 0 ? `<p class="aide" style="margin:10px 0 0">⚠️ ${p.nbSansTaux} opération${p.nbSansTaux > 1 ? "s" : ""} non convertie${p.nbSansTaux > 1 ? "s" : ""} (taux manquant) : le total est incomplet.</p>` : "";
  return `<div class="carte">
    <h2>Vos comptes · ${titrePeriode()}</h2>
    <p class="aide">Chaque compte dans sa propre devise (exact, sans conversion), puis le total converti en ${devise === "EUR" ? "euros" : devise}.
    ${devisesDesComptes().length > 1 ? "Les lignes « ≈ » montrent la conversion de chaque compte, pour comprendre le total." : ""}</p>
    <table class="tab-comptes">
      <colgroup><col style="width:30%"><col style="width:9%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:16%"></colgroup>
      <tr><th>Compte</th><th>Devise</th><th class="d">Revenus</th><th class="d">Dépenses</th><th class="d">Épargne</th><th class="d">Reste</th></tr>
      ${lignes}
      <tr class="total"><td>Total${devisesDesComptes().length > 1 ? ` converti en ${devise}` : ""}</td><td></td>${total("revenus", 1)}${total("depense", -1)}${total("epargne", 1)}${total("reste", 1)}</tr>
    </table>${note}
    <p class="aide" style="margin:10px 0 0">Reste = revenus − dépenses − épargne, d'après les opérations classées.</p></div>`;
}

// Un montant dans une devise donnée, sans toucher à l'affichage courant.
function formaterDevise(n, devise) {
  return (n < 0 ? "− " : "") + Math.round(Math.abs(n)).toLocaleString("fr-FR") + " " + symboleDevise(devise);
}

// ── Premier affichage : le bon an, tous les mois ────────────────────
function initialiserAffichage(dispo) {
  const annees = [...dispo.keys()].sort();
  if (!dispo.has(affichage.annee)) {
    affichage.annee = annees[annees.length - 1];
    affichage.mois = "annee";
  }
}

function rendreTableau() {
  const conteneur = document.getElementById("etape-tableau");
  // Les couleurs des catégories viennent des données (modifiables), pas du style.
  [["besoins", "besoin"], ["envies", "envie"], ["epargne", "epargne"], ["frais", "frais"], ["revenus", "revenu"], ["neutre", "ignore"]].forEach(([v, f]) => conteneur.style.setProperty("--" + v, couleurFamille(f)));
  normaliserCompteEtDevise();
  const dispo = periodesDisponibles();
  const nb = etat.transactions.length;

  if (nb === 0 || dispo.size === 0) {
    conteneur.innerHTML = `
      <div class="accueil">
        <h2>Bienvenue — votre tableau de bord vous attend</h2>
        <p>Importez votre premier relevé bancaire : tout ce que vous voyez ci-dessous,
        vide pour l'instant, se remplira tout seul. Vos fichiers ne quittent jamais
        votre ordinateur.</p>
        <button class="bt p" data-vue="import">Importer mes relevés</button>
        <div><button class="lien-discret" data-vue="enveloppes">ou d'abord ajuster mes catégories</button></div>
      </div>
      <div class="tuiles">
        ${["Revenus", "Dépenses", "Épargne", "Reste"].map(t => `
          <div class="tuile"><div class="lib">${t}</div><div class="val vide">—</div><div class="sous">&nbsp;</div></div>`).join("")}
      </div>`;
    return;
  }

  initialiserAffichage(dispo);
  const mois = moisDeLaSelection(affichage.mois);
  const p = calculerPeriode(affichage.annee, mois);
  const ref = periodeDeReference(affichage.annee, affichage.mois);

  const revenus = calculerRevenusAttendus(affichage.annee, mois, p);
  const alertes = alertesDuTableau(p, revenus);

  conteneur.innerHTML = `
    ${rendreFiltres(dispo)}
    ${rendreFiabilite(p)}
    ${affichage.compte === "tous" && etat.comptes.length >= 2 ? rendreTableauComptes(p, ref) : `<div class="tuiles">${rendreTuiles(p, ref)}</div>`}
    ${rendreLigneAlertes(alertes)}
    ${rendreRevenusAttendus(p)}
    ${rendreBarre(p)}
    ${rendreOuVaLArgent(p)}
    ${rendreEvolution12Mois(affichage.annee)}
    ${rendreRecurrentes()}
    ${rendreTopCommercants()}
    ${rendreSurveiller(alertes)}`;
}

// ── Clics sur les filtres ───────────────────────────────────────────
document.getElementById("etape-tableau").addEventListener("click", e => {
  // ✎ : renommer / retirer une ligne de liste
  const editer = e.target.closest("[data-editer]");
  if (editer) { affichage.edition = { type: editer.dataset.editer, cle: editer.dataset.cle }; rendreTableau(); return; }
  const ok = e.target.closest("[data-ok-nom]");
  if (ok) {
    const champ = document.querySelector("#etape-tableau .champ-nom");
    const nom = champ ? champ.value.trim() : "";
    retoucherNom(ok.dataset.type, ok.dataset.cle, { nom });   // un nom vide revient au nom d'origine
    affichage.edition = null; rendreTableau(); return;
  }
  const retirer = e.target.closest("[data-retirer]");
  if (retirer) { retoucherNom(retirer.dataset.type, retirer.dataset.cle, { masque: true }); affichage.edition = null; rendreTableau(); return; }
  if (e.target.closest("[data-annuler-nom]")) { affichage.edition = null; rendreTableau(); return; }
  if (e.target.closest("[data-reafficher]")) {
    Object.values(etat.noms.recurrentes).forEach(r => { delete r.masque; });
    sauvegarderEtat(etat); rendreTableau(); return;
  }

  const repereBtn = e.target.closest("[data-repere]");
  if (repereBtn) {
    etat.preferences = { ...(etat.preferences || {}), repere503020: repereBtn.dataset.repere === "1" };
    sauvegarderEtat(etat); rendreTableau(); return;
  }
  const aller = e.target.closest("[data-aller]");
  if (aller) { document.getElementById(aller.dataset.aller).scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (e.target.closest("[data-plus-alertes]")) { affichage.toutesAlertes = !affichage.toutesAlertes; rendreTableau(); return; }

  const colonne = e.target.closest(".cat-tete");
  if (colonne) {
    const cle = colonne.parentElement.dataset.cat;
    colonnesRepliees.has(cle) ? colonnesRepliees.delete(cle) : colonnesRepliees.add(cle);
    rendreTableau();
    return;
  }
  const dev = e.target.closest("[data-devise]");
  if (dev) { affichage.devise = dev.dataset.devise; rendreTableau(); return; }
  const an = e.target.closest("[data-an]");
  const m = e.target.closest("[data-mois]");
  const multi = e.target.closest("[data-multi]");
  if (an) {
    affichage.annee = +an.dataset.an;
    affichage.mois = "annee";
  } else if (multi) {
    affichage.multi = !affichage.multi;
  } else if (m) {
    if (m.dataset.mois === "annee") affichage.mois = "annee";
    else if (affichage.multi || e.shiftKey || e.metaKey || e.ctrlKey) {
      // mode « plusieurs mois » : un clic ajoute ou retire un mois
      const i = +m.dataset.mois;
      const actuels = affichage.mois === "annee" ? [] : affichage.mois.slice();
      const nouveaux = actuels.includes(i) ? actuels.filter(x => x !== i) : [...actuels, i].sort((a, b) => a - b);
      affichage.mois = nouveaux.length === 0 ? "annee" : nouveaux;
    } else affichage.mois = [+m.dataset.mois];   // sinon : ce mois seulement
  } else return;
  rendreTableau();
});

ECRANS.tableau = { rendre: rendreTableau, compteur: () => "" };

// Choix du compte affiché : le compte garde sa devise de départ.
document.getElementById("etape-tableau").addEventListener("change", e => {
  if (e.target.id !== "choix-compte-tableau") return;
  affichage.compte = e.target.value;
  affichage.devise = null;
  rendreTableau();
});
