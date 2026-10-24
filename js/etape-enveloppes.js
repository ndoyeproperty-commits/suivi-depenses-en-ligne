// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ⑤ — LES CATÉGORIES
// Trois grandes catégories (Besoins, Envies, Épargne), chacune avec ses
// sous-catégories : on retient, on retire, on ajoute les siennes.
// Plus, à part : Revenus, et Ignorés (ni dépenses ni revenus).
// (Le nom de fichier « enveloppes » est historique.)
// ═══════════════════════════════════════════════════════════════════

// Les « grandes » catégories sont celles qui comptent comme un besoin, une envie ou de l'épargne ;
// les « autres » : les revenus, et ce qui est ignoré. (Y compris les catégories que vous créez.)
const GRANDES_FAMILLES = ["besoin", "envie", "epargne", "frais"];

// Une sous-catégorie est une dépense, un revenu ou « ignorée » selon le type
// de la catégorie où elle est rangée. (Utilisé aussi par l'écran d'import.)
const TITRES_TYPES = {
  depense: "Dépenses",
  revenu: "Revenus",
  neutre: "Ignorés (ni dépenses ni revenus)",
};

function typeDeSousCategorie(c) {
  const parente = etat.enveloppes.find(e => e.id === c.enveloppeId);
  return parente && parente.type ? parente.type : "depense";
}

// Qui est en train d'être modifié : ça ne se sauvegarde pas, ça ne
// concerne que l'affichage du moment.
let categorieEnEdition = null;

function pastille(c) {
  if (categorieEnEdition === c.id) return editionCategorie(c);
  return `
    <span class="pc-groupe">
      <button class="pc${c.active ? " on" : ""}"
              style="--p:${couleurDeSousCategorie(c)}" data-id="${c.id}">${echapper(c.nom || "Sans nom")}</button>
      <button class="pc-modifier" data-action="editer-categorie" data-id="${c.id}" title="Modifier le nom ou la catégorie">✎</button>
    </span>`;
}

function editionCategorie(c) {
  const options = etat.enveloppes.map(e =>
    `<option value="${e.id}" ${e.id === c.enveloppeId ? "selected" : ""}>${echapper(e.nom)}</option>`
  ).join("");
  return `
    <span class="pc-edit" data-id="${c.id}">
      <input type="text" data-id="${c.id}" data-champ="nom" value="${c.nom}"
             placeholder="Nom de la sous-catégorie" maxlength="28">
      <select data-id="${c.id}" data-champ="enveloppeId" title="Catégorie">${options}</select>
      ${c.custom ? `<button class="effacer" data-action="supprimer-categorie" data-id="${c.id}" title="Supprimer">✕</button>` : ""}
      <button class="valider" data-action="valider-categorie" data-id="${c.id}" title="Valider">✓</button>
    </span>`;
}

function terminerEditionCategorie(id) {
  const c = etat.categories.find(x => x.id === id);
  if (c && !c.nom.trim()) c.nom = "Nouvelle sous-catégorie";
  categorieEnEdition = null;
  actualiser();
}

function sectionCategorie(e, grande) {
  const sous = etat.categories.filter(c => c.enveloppeId === e.id);
  const retenues = sous.filter(c => c.active).length;
  return `
    <section class="${grande ? "grande" : "petite"}" data-id="${e.id}">
      <div class="entete">
        <h2>${echapper(e.nom)}</h2>
        <span class="compte">${retenues} sur ${sous.length} retenue${retenues > 1 ? "s" : ""}</span>
      </div>
      <p class="desc">${echapper(e.description || "")}</p>
      <div class="past">${sous.map(pastille).join("")}</div>
      <div class="ajout-ligne">
        <input type="text" maxlength="28" data-ajout="${e.id}"
               placeholder="Ajouter votre propre sous-catégorie…">
        <button class="bt s" data-action="ajouter-sous-categorie" data-enveloppe="${e.id}">＋ Ajouter</button>
      </div>
    </section>`;
}

function rendreCategories() {
  const parId = id => etat.enveloppes.find(e => e.id === id);
  const actives = etat.enveloppes.filter(e => e.active !== false);
  document.getElementById("grandes-categories").innerHTML =
    actives.filter(e => GRANDES_FAMILLES.includes(familleDe(e.id))).map(e => sectionCategorie(e, true)).join("");
  document.getElementById("autres-categories").innerHTML =
    actives.filter(e => !GRANDES_FAMILLES.includes(familleDe(e.id))).map(e => sectionCategorie(e, false)).join("");

  if (categorieEnEdition) {
    const champ = document.querySelector(`.pc-edit input[type=text][data-id="${categorieEnEdition}"]`);
    if (champ) { champ.focus(); champ.select(); }
  }
}

// ── Les événements ────────────────────────────────────────────────

const ecranCategories = document.getElementById("etape-enveloppes");

ecranCategories.addEventListener("input", e => {
  const { id, champ } = e.target.dataset;
  if (!id || !champ) return;
  const c = etat.categories.find(x => x.id === id);
  if (!c) return;

  if (champ === "enveloppeId") {
    c.enveloppeId = e.target.value;
    actualiser();
    return;
  }
  c[champ] = e.target.value;
  sauvegarderEtat(etat);
  // La couleur change tout de suite à l'écran, sans quitter le champ en cours.
  if (champ === "couleur") rendreCategories();
});

function ajouterSousCategorie(enveloppeId) {
  const champ = ecranCategories.querySelector(`input[data-ajout="${enveloppeId}"]`);
  const nom = champ.value.trim();
  if (!nom) { champ.focus(); return; }
  const c = nouvelleCategorie(enveloppeId);
  c.nom = nom;
  etat.categories.push(c);
  actualiser();
}

ecranCategories.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.dataset.ajout) {
    e.preventDefault();
    ajouterSousCategorie(e.target.dataset.ajout);
  } else if (e.target.closest(".pc-edit") && e.target.tagName === "INPUT") {
    e.preventDefault();
    terminerEditionCategorie(e.target.closest(".pc-edit").dataset.id);
  }
});

ecranCategories.addEventListener("click", e => {
  // Cliquer une pastille la retient ou la retire.
  if (e.target.classList.contains("pc")) {
    const c = etat.categories.find(x => x.id === e.target.dataset.id);
    c.active = !c.active;
    actualiser();
    return;
  }

  const cible = e.target.closest("[data-action]");
  if (!cible) return;
  const { action, id, enveloppe } = cible.dataset;

  if (action === "ajouter-sous-categorie") {
    ajouterSousCategorie(enveloppe);
  } else if (action === "editer-categorie") {
    categorieEnEdition = id;
    actualiser();
  } else if (action === "valider-categorie") {
    terminerEditionCategorie(id);
  } else if (action === "supprimer-categorie") {
    etat.categories = etat.categories.filter(x => x.id !== id);
    categorieEnEdition = null;
    actualiser();
  }
});

// Double-clic sur une pastille = la modifier (comme l'icône ✎).
ecranCategories.addEventListener("dblclick", e => {
  const cible = e.target.closest(".pc");
  if (!cible) return;
  categorieEnEdition = cible.dataset.id;
  actualiser();
});

ECRANS.enveloppes = {
  rendre: rendreCategories,
  compteur: () => {
    const n = etat.categories.filter(c => c.active).length;
    return `${n} sous-catégorie${n > 1 ? "s" : ""} retenue${n > 1 ? "s" : ""}`;
  },
};
