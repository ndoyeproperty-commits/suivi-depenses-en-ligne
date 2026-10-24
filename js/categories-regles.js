// ═══════════════════════════════════════════════════════════════════
// ÉCRAN — CATÉGORIES & RÈGLES
// Onglet « Catégories » : tout est modifiable (nom, couleur, sous-catégories…).
// Onglet « Règles » : « si le libellé contient … alors ranger dans … ».
// Ce qui est rangé ici décide de ce que montre le tableau de bord.
// Construit à partir de la maquette maquettes/categories-regles.html.
// Une règle PROPOSE, elle ne confirme jamais (rien n'est validé à votre place).
// ═══════════════════════════════════════════════════════════════════

const OU_COMPTER = { besoin: "Dans mes besoins", envie: "Dans mes envies", epargne: "Dans mon épargne", frais: "Dans « frais & crédits »", revenu: "Dans mes revenus", ignore: "Nulle part (ignorée)" };
const TYPE_DE_FAMILLE = { besoin: "depense", envie: "depense", epargne: "depense", frais: "depense", revenu: "revenu", ignore: "neutre" };
const PALETTE_DOUCE = ["#5b7fa6", "#457b9d", "#4a8f8c", "#3f8a5a", "#6b8e6b", "#a8894c", "#e0a04a", "#c1873a", "#c4574c", "#b8654a", "#d17a74", "#b06a8f", "#8b6ea8", "#8a7060"];
const PALETTE_GRIS = ["#1d1d1f", "#4a4a4f", "#6e6e73", "#8e9aa6", "#a9a9ae", "#c7c7cc", "#e1e1e6"];

const cr = {
  onglet: "categories", ouvert: new Set(), edition: null, draft: {}, couleurEdit: "#8e9aa6", avance: false,
  ajoutDans: null, q: "", filtre: new Set(), creer: false, brouillon: { motif: "", sens: "", cible: "" }, modale: null,
};

// ── Couleurs : conversion pour le dégradé arc-en-ciel ────────────────
function hexVersHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0, s = 0; const l = (max + min) / 2;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60); if (h < 0) h += 360; }
  return [h, Math.round(s * 100), Math.round(l * 100)];
}
function hslVersHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
function selecteurCouleur(couleur) {
  const [h, sa, l] = hexVersHsl(couleur);
  const bloc = (titre, liste) => `<div class="pal-titre">${titre}</div><div class="palette">${liste.map(c =>
    `<i data-cr-couleur="${c}" class="${c.toLowerCase() === couleur.toLowerCase() ? "on" : ""}" style="background:${c}" title="${c}"></i>`).join("")}</div>`;
  return `<div class="selecteur">${bloc("Couleurs douces", PALETTE_DOUCE)}${bloc("Gris", PALETTE_GRIS)}
    <button class="lien-cr" data-cr-avance="1" style="margin-top:10px">${cr.avance ? "Masquer le dégradé" : "Autres couleurs : dégradé arc-en-ciel…"}</button>
    ${cr.avance ? `<div class="degrade">
      <label>Teinte<input type="range" min="0" max="360" value="${h}" data-cr-hsl="h" class="r-teinte"></label>
      <label>Intensité<input type="range" min="0" max="100" value="${sa}" data-cr-hsl="s" id="cr-s" style="background:linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))"></label>
      <label>Clarté<input type="range" min="8" max="92" value="${l}" data-cr-hsl="l" id="cr-l" style="background:linear-gradient(to right,hsl(${h},${sa}%,8%),hsl(${h},${sa}%,50%),hsl(${h},${sa}%,92%))"></label>
      <div class="apercu-couleur"><span class="pc-sous" id="cr-apercu-pc" style="--c:${couleur}">Aperçu</span><input type="text" id="cr-hex" value="${couleur}" size="9" maxlength="7"></div></div>` : ""}</div>`;
}
// Pendant qu'on glisse un curseur, on met à jour l'aperçu sans redessiner (sinon le curseur serait lâché).
function majCurseurs() {
  const lire = k => +document.querySelector(`[data-cr-hsl="${k}"]`).value, h = lire("h"), sa = lire("s"), l = lire("l");
  const c = hslVersHex(h, sa, l); cr.couleurEdit = c;
  document.getElementById("cr-s").style.background = `linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))`;
  document.getElementById("cr-l").style.background = `linear-gradient(to right,hsl(${h},${sa}%,8%),hsl(${h},${sa}%,50%),hsl(${h},${sa}%,92%))`;
  document.getElementById("cr-apercu-pc").style.setProperty("--c", c);
  document.getElementById("cr-hex").value = c;
  document.querySelectorAll("#etape-regles .palette i").forEach(i => i.classList.remove("on"));
  document.querySelectorAll("#etape-regles .apercu-live").forEach(el => el.style.setProperty("--c", c));
  document.querySelectorAll("#etape-regles .grande.en-edition").forEach(el => el.style.setProperty("--c", c));
}

// ── Annuler ──────────────────────────────────────────────────────────
const HISTORIQUE_CR = [];
let minuteurCr = null, toastCr = null;
const instantane = () => JSON.stringify({ e: etat.enveloppes, c: etat.categories, t: etat.transactions, r: etat.regles });
function changer(message, action) {
  HISTORIQUE_CR.push(instantane());
  if (HISTORIQUE_CR.length > 30) HISTORIQUE_CR.shift();
  action();
  sauvegarderEtat(etat);
  toastCr = { message, fin: Date.now() + 9000 };
  clearTimeout(minuteurCr);
  minuteurCr = setTimeout(() => { toastCr = null; dessinerToastCr(); }, 9000);
}
function dessinerToastCr() {
  const el = document.getElementById("toast-cr");
  if (!el) return;
  if (!toastCr || Date.now() > toastCr.fin) { el.classList.remove("visible"); return; }
  el.innerHTML = `<span>${echapper(toastCr.message)}</span><button data-cr-annuler="1">↶ Annuler</button>`;
  el.classList.add("visible");
}

// ── Petits calculs ───────────────────────────────────────────────────
const nbOperationsDe = { sous: c => etat.transactions.filter(t => t.categorieId === c.id).length,
  sansDetail: g => etat.transactions.filter(t => !t.categorieId && t.groupeId === g).length,
  groupe: g => etat.transactions.filter(t => groupeEffectif(t) === g).length };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const enEditionCr = (type, id) => cr.edition && cr.edition.type === type && cr.edition.id === id;

// ── Onglet Catégories ────────────────────────────────────────────────
function rendreCategoriesCr() {
  return etat.enveloppes.map(e => {
    const g = e.id, couleur = enEditionCr("groupe", g) ? cr.couleurEdit : couleurGroupe(g);
    const sous = etat.categories.filter(c => c.enveloppeId === g);
    const visibles = sous.filter(c => c.active), masquees = sous.filter(c => !c.active);
    const nbSD = nbOperationsDe.sansDetail(g), nbG = nbOperationsDe.groupe(g);
    const ligne = c => enEditionCr("sous", c.id) ? editionSousCr(c) : `<div class="sous">
      <div><span class="pc-sous ${c.custom ? "perso" : ""}">${echapper(c.nom)}</span></div>
      <div class="d">${pluriel(nbOperationsDe.sous(c), "opération")}</div>
      <div class="d"><button class="ico" data-cr-edit-sous="${c.id}" title="Modifier">✎</button></div></div>`;
    return `<div class="grande ${cr.ouvert.has(g) ? "" : "ferme"} ${enEditionCr("groupe", g) ? "en-edition" : ""}" style="--c:${couleur}">
      <div class="grande-tete" data-cr-bascule="${g}"><div class="barre"></div>
        <div><h2>${echapper(e.nom)}</h2><div class="desc">${echapper(e.description || "")}</div></div>
        <div class="total"><b>${pluriel(nbG, "opération")}</b></div>
        <button class="ico" data-cr-edit-groupe="${g}" title="Modifier cette catégorie">✎</button><span class="fleche">▼</span></div>
      ${enEditionCr("groupe", g) ? editionGroupeCr(g) : ""}
      <div class="corps">
        <div class="sous tete"><span>Sous-catégorie</span><span class="d">Opérations</span><span></span></div>
        ${visibles.map(ligne).join("")}
        ${nbSD ? `<div class="sous sansdetail"><div><span class="pc-sous sans" style="--c:#8e9aa6">Sans détail</span></div><div class="d">${pluriel(nbSD, "opération")}</div>
          <div class="d"><button class="ico" data-ops-filtre="${echapper(JSON.stringify({ cat: "g:" + g, puces: ["sansdetail"] }))}" title="Choisir une sous-catégorie pour ces opérations">→</button></div></div>` : ""}
        ${cr.ajoutDans === g ? `<div class="ajout-sous"><input type="text" id="cr-nouvelle-sous" maxlength="28" placeholder="Nom de la nouvelle sous-catégorie…"><button class="bt p" data-cr-ajouter="${g}">Ajouter</button><button class="bt s" data-cr-annuler-ajout="1">Annuler</button></div>`
          : `<div class="ajout-sous"><button class="lien-cr" data-cr-ajout="${g}">＋ Ajouter une sous-catégorie à « ${echapper(e.nom)} »</button></div>`}
      </div>
      ${masquees.length ? `<div class="corps" style="padding:10px 20px"><div class="masquees">Masquées : ${masquees.map(c => `${echapper(c.nom)} <button class="lien-cr" data-cr-reafficher="${c.id}">réafficher</button>`).join(" · ")}</div></div>` : ""}
    </div>`;
  }).join("")
  + (enEditionCr("nouvelle", 0) ? `<div class="grande en-edition" style="--c:${cr.couleurEdit}">${editionGroupeCr(null)}</div>`
    : `<div style="text-align:center;margin-top:6px"><button class="bt s" data-cr-nouvelle-cat="1">＋ Nouvelle catégorie</button></div>`);
}

function editionSousCr(c) {
  const nom = cr.draft.nom !== undefined ? cr.draft.nom : c.nom, g = cr.draft.g || c.enveloppeId, nb = nbOperationsDe.sous(c);
  return `<div class="edition"><div class="champs">
    <label>Nom<input type="text" id="cr-ed-nom" data-cr-draft="nom" value="${echapper(nom)}" maxlength="28"></label>
    <label>Catégorie<select id="cr-ed-g" data-cr-draft="g">${etat.enveloppes.map(e => `<option value="${e.id}" ${e.id === g ? "selected" : ""}>${echapper(e.nom)}</option>`).join("")}</select></label></div>
    <p class="aide-edit">Elle prend la couleur de sa catégorie : <span class="pc-sous" style="--c:${couleurGroupe(g)}">${echapper(nom || "…")}</span>${nb ? ` · ${pluriel(nb, "opération")} rangée${nb > 1 ? "s" : ""} ici : si vous changez de catégorie, elles suivent (et les totaux du tableau de bord aussi).` : ""}</p>
    <div class="champs"><button class="bt p" data-cr-enregistrer-sous="${c.id}">Enregistrer</button><button class="bt s" data-cr-annuler-edit="1">Annuler</button>
      <button class="bt s" data-cr-masquer="${c.id}">Masquer</button><button class="bt s danger" data-cr-supprimer-sous="${c.id}">Supprimer…</button></div></div>`;
}

function editionGroupeCr(g) {
  const e = g ? enveloppeDe(g) : { nom: "", description: "" }, nouvelle = !g;
  const nom = cr.draft.nom !== undefined ? cr.draft.nom : e.nom, desc = cr.draft.desc !== undefined ? cr.draft.desc : (e.description || "");
  const nbSous = g ? etat.categories.filter(c => c.enveloppeId === g).length : 0, nbOps = g ? nbOperationsDe.groupe(g) : 0;
  return `<div class="edition"><div class="champs">
    <label>Nom de la catégorie<input type="text" id="cr-eg-nom" data-cr-draft="nom" value="${echapper(nom)}" placeholder="Ex. Enfants, Voiture, Vacances…" maxlength="30" style="min-width:230px"></label>
    <label>Courte description<input type="text" id="cr-eg-desc" data-cr-draft="desc" value="${echapper(desc)}" placeholder="Facultatif" maxlength="120" style="min-width:300px"></label></div>
    ${nouvelle ? `<div style="margin-top:12px"><div class="mini-titre">Où doit-elle compter dans le tableau de bord ?</div><div class="chips-fam">${Object.entries(OU_COMPTER).map(([k, v]) =>
      `<button class="puce-f ${(cr.draft.famille || "envie") === k ? "on" : ""}" data-cr-fam="${k}">${v}</button>`).join("")}</div></div>` : ""}
    <div class="champs" style="margin-top:12px"><label>Couleur${selecteurCouleur(cr.couleurEdit)}</label></div>
    <p class="aide-edit">Aperçu d'une de ses sous-catégories : <span class="pc-sous apercu-live" style="--c:${cr.couleurEdit}">${echapper(nom || "Nouvelle catégorie")}</span>
      ${!nouvelle && nbOps ? ` · ${pluriel(nbSous, "sous-catégorie")} et ${pluriel(nbOps, "opération")} suivent si vous changez le nom ou la couleur.` : ""}</p>
    <div class="champs"><button class="bt p" data-cr-enregistrer-groupe="${g || ""}">${nouvelle ? "Créer la catégorie" : "Enregistrer"}</button><button class="bt s" data-cr-annuler-edit="1">Annuler</button>
      ${!nouvelle ? `<button class="bt s danger" data-cr-supprimer-groupe="${g}">Supprimer cette catégorie…</button>` : ""}</div></div>`;
}

// ── Onglet Règles ────────────────────────────────────────────────────
// Deux règles peuvent viser la même ligne : la plus précise (le motif le plus long) l'emporte.
function conflitDe(r) {
  const m = normaliserMotif(r.motif);
  const plusPrecises = etat.regles.filter(o => o !== r && normaliserMotif(o.motif).includes(m) && normaliserMotif(o.motif).length > m.length);
  const moinsPrecises = etat.regles.filter(o => o !== r && m.includes(normaliserMotif(o.motif)) && m.length > normaliserMotif(o.motif).length);
  if (plusPrecises.length) return `<div class="conflit">⚠ Chevauchement : « ${echapper(plusPrecises[0].motif)} » est plus précise et l'emporte pour les lignes qui contiennent les deux.</div>`;
  if (moinsPrecises.length) return `<div class="conflit ok">✓ Plus précise que « ${echapper(moinsPrecises[0].motif)} » : c'est elle qui s'applique à ces lignes.</div>`;
  return "";
}
// La liste de choix d'une cible : « Catégorie · sans détail », puis ses sous-catégories.
function optionsCible(valeurActuelle) {
  return etat.enveloppes.filter(e => e.active !== false).map(e => `<optgroup label="${echapper(e.nom)}">
    <option value="g:${e.id}" ${valeurActuelle === "g:" + e.id ? "selected" : ""}>${echapper(e.nom)} · sans détail</option>
    ${etat.categories.filter(c => c.enveloppeId === e.id && c.active).map(c => `<option value="c:${c.id}" ${valeurActuelle === "c:" + c.id ? "selected" : ""}>${echapper(c.nom)}</option>`).join("")}</optgroup>`).join("");
}
const valeurCible = r => r.categorieId ? "c:" + r.categorieId : (r.groupeId ? "g:" + r.groupeId : "");
function groupeDeRegle(r) { const c = etat.categories.find(x => x.id === r.categorieId); return c ? c.enveloppeId : r.groupeId; }
function decoderCible(v) {
  if (!v) return { categorieId: null, groupeId: null };
  return v.startsWith("c:") ? { categorieId: v.slice(2), groupeId: null } : { categorieId: null, groupeId: v.slice(2) };
}

function formulaireRegle() {
  const b = cr.brouillon, motif = normaliserMotif(b.motif);
  if (!b.cible) b.cible = "g:" + (groupesDeFamille("envie")[0] || etat.enveloppes[0].id);
  const concernees = motif ? etat.transactions.filter(t => normaliserLibelle(t.libelle).includes(motif) && (!b.sens || t.sens === b.sens)) : [];
  const nonClassees = concernees.filter(t => !groupeEffectif(t));
  return `<div class="creer"><h3>Créer une règle</h3><div class="champs">
    <label>Si le libellé contient<input type="text" id="cr-r-motif" data-cr-brouillon="motif" value="${echapper(b.motif)}" placeholder="Ex. NETFLIX, UBER EATS" style="min-width:220px"></label>
    <label>Type de ligne<select id="cr-r-sens" data-cr-brouillon="sens"><option value="">Sorties et entrées</option><option value="debit" ${b.sens === "debit" ? "selected" : ""}>Sorties seulement</option><option value="credit" ${b.sens === "credit" ? "selected" : ""}>Entrées seulement</option></select></label>
    <label>Alors ranger dans<select id="cr-r-cible" data-cr-brouillon="cible">${optionsCible(b.cible)}</select></label></div>
    <div class="apercu">${!motif ? "Tapez un mot du libellé : vous verrez tout de suite les lignes concernées dans vos relevés."
      : `Cette règle concerne <b>${pluriel(concernees.length, "ligne")}</b> de vos relevés${concernees.length ? `, dont <b>${nonClassees.length}</b> pas encore classée${nonClassees.length > 1 ? "s" : ""}` : ""}.`
        + (concernees.length ? `<ul>${concernees.slice(0, 4).map(t => `<li>${echapper(t.libelle)} · ${t.sens === "credit" ? "+" : "−"} ${t.montant != null ? t.montant.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "?"}</li>`).join("")}${concernees.length > 4 ? `<li>… et ${concernees.length - 4} autres</li>` : ""}</ul>` : "")}</div>
    <div class="champs" style="margin-top:12px"><button class="bt p" data-cr-enregistrer-regle="1" ${motif ? "" : "disabled"}>Créer la règle</button><button class="bt s" data-cr-annuler-creer="1">Annuler</button></div></div>`;
}

function rendreReglesCr() {
  const q = cr.q.trim().toLowerCase();
  const infos = etat.regles.map(r => { const l = lignesDeRegle(r); return { r, nb: l.length, nonClasse: l.filter(t => !groupeEffectif(t)).length }; });
  const aValider = infos.reduce((s, x) => s + x.nonClasse, 0);
  const liste = infos.filter(({ r, nonClasse }) => (!q || r.motif.toLowerCase().includes(q) || nomGroupe(groupeDeRegle(r)).toLowerCase().includes(q))
    && (!cr.filtre.has("creees") || r.source === "creee") && (!cr.filtre.has("apprises") || r.source !== "creee") && (!cr.filtre.has("attente") || nonClasse > 0));
  const puce = (k, t) => `<button class="puce-f ${cr.filtre.has(k) ? "on" : ""}" data-cr-filtre="${k}">${t}</button>`;
  const exemple = r => { const l = lignesDeRegle(r)[0]; return l ? l.libelle : "(aucune ligne pour l'instant)"; };
  return `<div class="note-cr">Une règle <b>propose</b> toujours, elle ne confirme jamais : vous validez avec ✓ dans Opérations.</div>
    <div class="barre-regles"><input type="search" id="cr-q" placeholder="Rechercher un commerçant ou une catégorie…" value="${echapper(cr.q)}"><button class="bt p" data-cr-creer="1">＋ Créer une règle</button></div>
    <div class="puces">${puce("apprises", "Apprises par l'appli")}${puce("creees", "Créées par vous")}${puce("attente", `Avec des lignes à classer (${aValider})`)}</div>
    ${cr.creer ? formulaireRegle() : ""}
    <div class="liste"><div class="regle tete"><span>Si le libellé contient…</span><span>Alors ranger dans</span><span>Lignes</span><span></span></div>
      ${liste.length ? liste.map(({ r, nb, nonClasse }) => `<div class="regle"><div class="si"><b>${echapper(r.motif)}</b>${r.source === "creee" ? '<span class="badge">créée par vous</span>' : ""}${r.sens === "credit" ? '<span class="badge">entrées</span>' : r.sens === "debit" ? '<span class="badge">sorties</span>' : ""}
          <div class="ex">ex. : ${echapper(exemple(r))}</div>${conflitDe(r)}</div>
          <div><span class="cible" style="--c:${couleurGroupe(groupeDeRegle(r))}"><select data-cr-cible="${r.id}">${optionsCible(valeurCible(r))}</select></span></div>
          <div class="nb">${pluriel(nb, "ligne")}${nonClasse ? `<small class="alerte-txt">${nonClasse} à classer</small>` : ""}</div>
          <div class="acts">${nonClasse ? `<button class="ico" data-cr-appliquer="${r.id}" title="Proposer cette catégorie aux ${nonClasse} lignes non classées">⤵</button>` : ""}
            <button class="ico" data-ops-filtre="${echapper(JSON.stringify({ q: r.motif }))}" title="Voir les lignes dans Opérations">↗</button>
            <button class="ico" data-cr-oublier="${r.id}" title="Oublier cette règle">⊘</button></div></div>`).join("")
        : `<div class="vide-cr">${etat.regles.length ? "Aucune règle ne correspond." : "Aucune règle pour l'instant : elles se créent toutes seules quand vous classez vos opérations."}</div>`}</div>`;
}

// ── La page ──────────────────────────────────────────────────────────
function rendreCategoriesEtRegles() {
  const conteneur = document.getElementById("etape-regles");
  const actif = document.activeElement;
  conteneur.innerHTML = `<div class="cr-page">
    <h1>Catégories &amp; règles</h1>
    <p class="intro">Ce que vous rangez ici décide de ce que montre le tableau de bord : les catégories et leurs sous-catégories, puis les règles que l'appli a retenues de vos classements.</p>
    <div class="onglets-cr"><button class="pill ${cr.onglet === "categories" ? "on" : ""}" data-cr-onglet="categories">Catégories</button>
      <button class="pill ${cr.onglet === "regles" ? "on" : ""}" data-cr-onglet="regles">Règles <b>${etat.regles.length}</b></button></div>
    ${cr.onglet === "categories" ? rendreCategoriesCr() : rendreReglesCr()}
  </div>
  <div class="toast" id="toast-cr"></div>
  <div class="modale-fond ${cr.modale ? "visible" : ""}" id="modale-cr"><div class="modale">${cr.modale || ""}</div></div>`;
  dessinerToastCr();
}

// ── Actions ──────────────────────────────────────────────────────────
const fermerModale = () => { cr.modale = null; };
const compterDeplacement = (ids, vers) => `${pluriel(ids, "élément")} déplacé${ids > 1 ? "s" : ""} vers « ${vers} »`;

document.getElementById("etape-regles").addEventListener("click", e => {
  const cible = k => e.target.closest(`[data-cr-${k}]`);
  let x;
  if ((x = cible("onglet"))) cr.onglet = x.dataset.crOnglet;
  else if ((x = cible("edit-groupe"))) {
    cr.edition = { type: "groupe", id: x.dataset.crEditGroupe }; cr.draft = {}; cr.couleurEdit = couleurGroupe(x.dataset.crEditGroupe); cr.avance = false; cr.ouvert.add(x.dataset.crEditGroupe);
  }
  else if ((x = cible("bascule"))) { const g = x.dataset.crBascule; cr.ouvert.has(g) ? cr.ouvert.delete(g) : cr.ouvert.add(g); }
  else if ((x = cible("edit-sous"))) { cr.edition = { type: "sous", id: x.dataset.crEditSous }; cr.draft = {}; }
  else if (cible("nouvelle-cat")) { cr.edition = { type: "nouvelle", id: 0 }; cr.draft = {}; cr.couleurEdit = PALETTE_DOUCE[etat.enveloppes.length % PALETTE_DOUCE.length]; cr.avance = false; }
  else if (cible("annuler-edit")) cr.edition = null;
  else if ((x = cible("couleur"))) cr.couleurEdit = x.dataset.crCouleur;
  else if (cible("avance")) cr.avance = !cr.avance;
  else if ((x = cible("fam"))) cr.draft.famille = x.dataset.crFam;
  else if ((x = cible("enregistrer-groupe"))) {
    const nom = (cr.draft.nom !== undefined ? cr.draft.nom : (x.dataset.crEnregistrerGroupe ? enveloppeDe(x.dataset.crEnregistrerGroupe).nom : "")).trim();
    if (!nom) { document.getElementById("cr-eg-nom").focus(); return; }
    const desc = (cr.draft.desc !== undefined ? cr.draft.desc : (x.dataset.crEnregistrerGroupe ? enveloppeDe(x.dataset.crEnregistrerGroupe).description : "") || "").trim();
    const id = x.dataset.crEnregistrerGroupe;
    if (!id) {
      const famille = cr.draft.famille || "envie", nid = "cat" + crypto.randomUUID().slice(0, 8);
      changer(`Catégorie « ${nom} » créée : elle compte ${OU_COMPTER[famille].replace("Dans ", "dans ").replace("Nulle part (ignorée)", "nulle part (ignorée)")}.`, () => {
        const position = etat.enveloppes.findIndex(v => familleDe(v.id) === "ignore" || familleDe(v.id) === "revenu");
        etat.enveloppes.splice(position >= 0 ? position : etat.enveloppes.length, 0,
          { id: nid, icone: "＋", nom, description: desc, type: TYPE_DE_FAMILLE[famille], couleur: cr.couleurEdit, famille, active: true, custom: true });
      });
      cr.ouvert.add(nid);
    } else {
      changer(`« ${nom} » enregistrée.`, () => Object.assign(enveloppeDe(id), { nom, description: desc, couleur: cr.couleurEdit }));
    }
    cr.edition = null;
  }
  else if ((x = cible("enregistrer-sous"))) {
    const c = etat.categories.find(v => v.id === x.dataset.crEnregistrerSous);
    const nom = (cr.draft.nom !== undefined ? cr.draft.nom : c.nom).trim(), g = cr.draft.g || c.enveloppeId;
    if (!nom) { document.getElementById("cr-ed-nom").focus(); return; }
    const deplace = g !== c.enveloppeId, nb = nbOperationsDe.sous(c);
    changer(deplace ? `« ${nom} » déplacée vers ${nomGroupe(g)} : ${pluriel(nb, "opération")} suivent, les totaux du tableau de bord changent.` : "Sous-catégorie enregistrée.", () => { c.nom = nom; c.enveloppeId = g; });
    cr.edition = null; cr.ouvert.add(g);
  }
  else if ((x = cible("masquer"))) { const c = etat.categories.find(v => v.id === x.dataset.crMasquer); changer(`« ${c.nom} » masquée : elle n'apparaît plus dans les listes de choix.`, () => { c.active = false; }); cr.edition = null; }
  else if ((x = cible("reafficher"))) { const c = etat.categories.find(v => v.id === x.dataset.crReafficher); changer(`« ${c.nom} » réaffichée.`, () => { c.active = true; }); }
  else if ((x = cible("supprimer-sous"))) {
    const c = etat.categories.find(v => v.id === x.dataset.crSupprimerSous), nb = nbOperationsDe.sous(c);
    if (!nb) { changer(`« ${c.nom} » supprimée.`, () => { etat.categories = etat.categories.filter(v => v.id !== c.id); etat.regles.forEach(r => { if (r.categorieId === c.id) { r.categorieId = null; r.groupeId = c.enveloppeId; } }); }); cr.edition = null; }
    else {
      cr.modale = `<h3>Supprimer « ${echapper(c.nom)} » ?</h3><p>${pluriel(nb, "opération")} ${nb > 1 ? "sont rangées" : "est rangée"} dedans. Que faire ?</p>
        <div class="champs"><label>Les déplacer vers<select id="cr-m-vers"><option value="">— Sans détail (elles restent dans ${echapper(nomGroupe(c.enveloppeId))}) —</option>
          ${etat.categories.filter(v => v.enveloppeId === c.enveloppeId && v.id !== c.id && v.active).map(v => `<option value="${v.id}">${echapper(v.nom)}</option>`).join("")}</select></label></div>
        <p class="petit">Les totaux de la catégorie ne changent pas : seules les lignes changent de sous-catégorie.</p>
        <div class="pied"><button class="bt s" data-cr-fermer="1">Annuler</button><button class="bt p" data-cr-confirmer-sous="${c.id}">Supprimer</button></div>`;
    }
  }
  else if ((x = cible("confirmer-sous"))) {
    const c = etat.categories.find(v => v.id === x.dataset.crConfirmerSous), vers = document.getElementById("cr-m-vers").value; fermerModale();
    changer(`« ${c.nom} » supprimée : ${pluriel(nbOperationsDe.sous(c), "opération")} déplacée${nbOperationsDe.sous(c) > 1 ? "s" : ""}.`, () => {
      etat.transactions.forEach(t => { if (t.categorieId === c.id) { t.categorieId = vers || null; t.groupeId = vers ? null : c.enveloppeId; } });
      etat.regles.forEach(r => { if (r.categorieId === c.id) { r.categorieId = vers || null; r.groupeId = vers ? null : c.enveloppeId; } });
      etat.categories = etat.categories.filter(v => v.id !== c.id);
    });
    cr.edition = null;
  }
  else if ((x = cible("supprimer-groupe"))) {
    const g = x.dataset.crSupprimerGroupe, E = enveloppeDe(g), autres = etat.enveloppes.filter(v => v.id !== g);
    if (!autres.length) return;
    const ns = etat.categories.filter(c => c.enveloppeId === g).length, no = nbOperationsDe.groupe(g);
    if (!ns && !no) { changer(`Catégorie « ${E.nom} » supprimée.`, () => { etat.enveloppes = etat.enveloppes.filter(v => v.id !== g); etat.regles.forEach(r => { if (r.groupeId === g) r.groupeId = null; }); }); cr.edition = null; }
    else cr.modale = `<h3>Supprimer la catégorie « ${echapper(E.nom)} » ?</h3><p>Elle contient ${pluriel(ns, "sous-catégorie")} et ${pluriel(no, "opération")}. Rien n'est perdu : tout est déplacé vers la catégorie de votre choix.</p>
      <div class="champs"><label>Déplacer vers<select id="cr-m-vers-g">${autres.map(v => `<option value="${v.id}">${echapper(v.nom)}</option>`).join("")}</select></label></div>
      <p class="petit">Les totaux du tableau de bord suivent : ils sont recalculés d'après la famille de la catégorie d'arrivée.</p>
      <div class="pied"><button class="bt s" data-cr-fermer="1">Annuler</button><button class="bt p" data-cr-confirmer-groupe="${g}">Supprimer</button></div>`;
  }
  else if ((x = cible("confirmer-groupe"))) {
    const g = x.dataset.crConfirmerGroupe, vers = document.getElementById("cr-m-vers-g").value, E = enveloppeDe(g); fermerModale();
    changer(`Catégorie « ${E.nom} » supprimée : son contenu a été déplacé vers « ${nomGroupe(vers)} ».`, () => {
      etat.categories.forEach(c => { if (c.enveloppeId === g) c.enveloppeId = vers; });
      etat.transactions.forEach(t => { if (!t.categorieId && t.groupeId === g) t.groupeId = vers; });
      etat.regles.forEach(r => { if (r.groupeId === g) r.groupeId = vers; });
      etat.enveloppes = etat.enveloppes.filter(v => v.id !== g);
    });
    cr.edition = null; cr.ouvert.add(vers);
  }
  else if (cible("fermer")) fermerModale();
  else if ((x = cible("ajout"))) cr.ajoutDans = x.dataset.crAjout;
  else if (cible("annuler-ajout")) cr.ajoutDans = null;
  else if ((x = cible("ajouter"))) {
    const nom = document.getElementById("cr-nouvelle-sous").value.trim(); if (!nom) return;
    const g = x.dataset.crAjouter;
    changer(`« ${nom} » ajoutée à ${nomGroupe(g)}.`, () => { const c = nouvelleCategorie(g, couleurGroupe(g)); c.nom = nom; etat.categories.push(c); });
    cr.ajoutDans = null;
  }
  // règles
  else if ((x = cible("filtre"))) { const k = x.dataset.crFiltre; cr.filtre.has(k) ? cr.filtre.delete(k) : cr.filtre.add(k); }
  else if (cible("creer")) cr.creer = !cr.creer;
  else if (cible("annuler-creer")) cr.creer = false;
  else if (cible("enregistrer-regle")) {
    const b = cr.brouillon, motif = b.motif.trim(); if (!normaliserMotif(motif)) return;
    const cib = decoderCible(b.cible);
    changer(`Règle créée : « ${motif} » → ${cib.categorieId ? etat.categories.find(c => c.id === cib.categorieId).nom : nomGroupe(cib.groupeId)}.`,
      () => etat.regles.push({ id: "r" + crypto.randomUUID().slice(0, 8), motif, sens: b.sens, source: "creee", ...cib }));
    cr.creer = false; cr.brouillon = { motif: "", sens: "", cible: "" };
  }
  else if ((x = cible("appliquer"))) {
    const r = etat.regles.find(v => v.id === x.dataset.crAppliquer), cib = cibleDeRegle(r), lignes = lignesDeRegle(r).filter(t => !groupeEffectif(t));
    if (!cib) return;
    changer(`${pluriel(lignes.length, "ligne")} rangée${lignes.length > 1 ? "s" : ""} en suggestion : à valider avec ✓ dans Opérations.`, () => lignes.forEach(t => { t.categorieId = cib.categorieId; t.groupeId = cib.groupeId; t.confirmee = false; }));
  }
  else if ((x = cible("oublier"))) {
    const r = etat.regles.find(v => v.id === x.dataset.crOublier);
    changer(`Règle « ${r.motif} » oubliée. Vos opérations déjà classées ne changent pas ; les prochaines lignes ne seront plus proposées automatiquement.`, () => { etat.regles = etat.regles.filter(v => v.id !== r.id); });
  }
  else if (cible("annuler")) {
    if (HISTORIQUE_CR.length) {
      const avant = JSON.parse(HISTORIQUE_CR.pop());
      etat.enveloppes = avant.e; etat.categories = avant.c; etat.transactions = avant.t; etat.regles = avant.r; sauvegarderEtat(etat); toastCr = null;
    }
  }
  else if (e.target.id === "modale-cr") fermerModale();
  else return;
  rendreCategoriesEtRegles();
});

document.getElementById("etape-regles").addEventListener("change", e => {
  const d = e.target.dataset;
  if (d.crDraft) cr.draft[d.crDraft] = e.target.value;
  if (d.crCible) {
    const r = etat.regles.find(v => v.id === d.crCible), cib = decoderCible(e.target.value);
    changer(`Règle « ${r.motif} » : les prochaines lignes seront proposées dans ${cib.categorieId ? etat.categories.find(c => c.id === cib.categorieId).nom : nomGroupe(cib.groupeId)}. Vos opérations déjà validées ne changent pas.`, () => Object.assign(r, cib));
    rendreCategoriesEtRegles();
  } else if (d.crBrouillon) { cr.brouillon[d.crBrouillon] = e.target.value; rendreCategoriesEtRegles(); }
  else if (d.crDraft === "g") rendreCategoriesEtRegles();
});
document.getElementById("etape-regles").addEventListener("input", e => {
  const d = e.target.dataset, id = e.target.id;
  if (d.crDraft) cr.draft[d.crDraft] = e.target.value;
  if (d.crHsl) { majCurseurs(); return; }
  if (id === "cr-hex" && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
    const c = e.target.value.toLowerCase(), [h, sa, l] = hexVersHsl(c);
    ["h", "s", "l"].forEach((k, i) => { document.querySelector(`[data-cr-hsl="${k}"]`).value = [h, sa, l][i]; });
    majCurseurs(); document.getElementById("cr-hex").value = c; cr.couleurEdit = c;
    return;
  }
  // La saisie met à jour l'aperçu sans perdre le curseur.
  const redessiner = () => { const pos = e.target.selectionStart; rendreCategoriesEtRegles(); const champ = document.getElementById(id); if (champ) { champ.focus(); champ.setSelectionRange(pos, pos); } };
  if (id === "cr-q") { cr.q = e.target.value; redessiner(); }
  else if (d.crBrouillon === "motif") { cr.brouillon.motif = e.target.value; redessiner(); }
  else if (id === "cr-ed-nom" || id === "cr-eg-nom") redessiner();
});
document.getElementById("etape-regles").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "cr-nouvelle-sous") document.querySelector("[data-cr-ajouter]").click();
});

ECRANS.regles = { rendre: rendreCategoriesEtRegles, compteur: () => "" };
