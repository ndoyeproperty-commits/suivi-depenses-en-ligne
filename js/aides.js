// ═══════════════════════════════════════════════════════════════════
// AIDES — petits outils réutilisés par plusieurs écrans.
// ═══════════════════════════════════════════════════════════════════

// Chaque écran s'y enregistre (voir js/etape-*.js). js/app.js s'en sert
// ensuite pour savoir quels écrans existent déjà et lesquels afficher.
const ECRANS = {};

// (Les couleurs par défaut des catégories sont définies en tête de js/stockage.js.)
// ── Les catégories et leur famille ────────────────────────────────
const ORDRE_FAMILLES = ["besoin", "envie", "epargne", "frais", "ignore", "revenu"];
const FAMILLE_DE_BASE = { besoin: "besoins", envie: "envies", epargne: "epargne", frais: "frais", revenu: "revenus", ignore: "neutre" };
const enveloppeDe = id => etat.enveloppes.find(e => e.id === id) || null;
const familleDe = id => { const e = enveloppeDe(id); return (e && e.famille) || FAMILLE_PAR_DEFAUT[id] || "envie"; };
const nomGroupe = id => { const e = enveloppeDe(id); return e ? e.nom : id; };
// Les catégories (actives) d'une famille, dans l'ordre où elles sont rangées.
const groupesDeFamille = f => etat.enveloppes.filter(e => e.active !== false && familleDe(e.id) === f).map(e => e.id);
// La catégorie « de référence » d'une famille (ex. « Besoins » pour la famille « besoin ») : son nom et sa
// couleur servent au tableau de bord quand on parle de la famille entière.
function groupePrincipal(f) {
  const liste = groupesDeFamille(f);
  return liste.includes(FAMILLE_DE_BASE[f]) ? FAMILLE_DE_BASE[f] : (liste[0] || FAMILLE_DE_BASE[f]);
}
// Existe-t-il une catégorie « frais & crédits » (créée par l'utilisateur) ? Sinon, on n'en parle pas à l'écran.
const aDesFrais = () => etat.enveloppes.some(e => e.active !== false && familleDe(e.id) === "frais");
const nomFamille = f => nomGroupe(groupePrincipal(f));
const couleurFamille = f => couleurGroupe(groupePrincipal(f));

function couleurGroupe(id) {
  const e = typeof etat !== "undefined" && etat.enveloppes.find(x => x.id === id);
  return (e && e.couleur) || COULEURS_GROUPES_DEFAUT[id] || "#8e9aa6";
}
// La couleur d'une sous-catégorie = celle de sa catégorie.
const couleurDeSousCategorie = c => couleurGroupe(c.enveloppeId);

// Un groupe de choix (un seul actif). `dataAttrs` sert à rattacher le
// choix à une personne ou à un compte précis (ex. data-id="...").
function segment(groupe, options, valeurActuelle, dataAttrs = "") {
  const boutons = options.map(o => `
    <div class="o${o.valeur === valeurActuelle ? " on" : ""}"
         data-groupe="${groupe}" data-valeur="${o.valeur}" ${dataAttrs}>
      ${o.titre ? `<span><b>${o.titre}</b> — ${o.texte}</span>` : o.texte}
    </div>`).join("");
  const pile = options.some(o => o.titre) ? " pile" : "";
  return `<div class="sg${pile}">${boutons}</div>`;
}

// Protège un texte saisi par vous (ex. le nom d'une sous-catégorie) avant de
// l'afficher dans la page : « <b> » reste du texte, pas du code.
function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Un nombre saisi (« 193,58 », « 1 200 ») → 193.58 ; 0 si illisible.
const nombreDe = valeur => {
  const n = parseFloat(String(valeur).replace(",", ".").replace(/\s/g, ""));
  return isNaN(n) ? 0 : n;
};

// Ce que l'appli a appris pour un commerçant : soit une sous-catégorie (son id),
// soit seulement une catégorie (« g:besoins »). → { categorieId, groupeId }
function decoderRegle(valeur) {
  if (!valeur) return { categorieId: null, groupeId: null };
  if (String(valeur).startsWith("g:")) return { categorieId: null, groupeId: valeur.slice(2) };
  return { categorieId: valeur, groupeId: null };
}
