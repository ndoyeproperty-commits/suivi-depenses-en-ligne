// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ① — LES PERSONNES
// ⚠️ Ce fichier ne touche qu'à l'écran des personnes. Le style associé
// est préfixé #etape-personnes (voir css/etape-personnes.css) pour ne
// jamais déborder sur un autre écran (règle ④ de CLAUDE.md).
// ═══════════════════════════════════════════════════════════════════

const SITUATIONS = [
  { valeur: "activite", texte: "💼 En activité" },
  { valeur: "retraite", texte: "🧓 Retraité" },
  { valeur: "sans-activite", texte: "🏠 Sans activité" },
  { valeur: "etudiant", texte: "🎓 Étudiant" },
];

const JOURS = [
  { valeur: "1", texte: "Le 1ᵉʳ" },
  { valeur: "5", texte: "Le 5" },
  { valeur: "27", texte: "Le 27" },
  { valeur: "autre", texte: "Autre" },
  { valeur: "variable", texte: "Variable" },
];

const MODES_VIE = [
  { valeur: "seul", texte: "👤 Seul(e)" },
  { valeur: "couple", texte: "👫 En couple" },
  { valeur: "enfants", texte: "👨‍👩‍👧 Avec enfants" },
  { valeur: "coloc", texte: "🏠 Colocation" },
];

const REPARTITIONS = [
  { valeur: "commun", titre: "Tout est en commun", texte: "revenus et dépenses forment un seul budget" },
  { valeur: "separe", titre: "Tout est séparé", texte: "chaque personne a son propre budget" },
  { valeur: "partiel", titre: "En partie commun", texte: "un budget commun + de l'argent personnel" },
];

// ⚠️ Une personne peut cumuler plusieurs sources de revenus (ex. salaire +
// revenus locatifs) : ce n'est pas un menu unique mais une liste.
const TYPES_REVENUS = [
  "Salaire / rémunération",
  "Revenus d'activité indépendante",
  "Revenus d'entreprise",
  "Retraite",
  "Allocations / prestations sociales",
  "Indemnités / revenus de remplacement",
  "Revenus locatifs",
  "Revenus de placements",
  "Pension alimentaire / soutien régulier",
  "Bourse / allocation d'études",
  "Autre revenu",
];

function ligneRevenu(r, personneId, supprimable) {
  return `
    <div class="bloc" data-id="${r.id}" style="padding:16px 16px 4px;margin-bottom:10px">
      ${supprimable ? `<button class="x" data-action="supprimer-revenu" data-id="${personneId}" data-revenu="${r.id}"
              title="Supprimer">✕</button>` : ""}
      <div class="ch">
        <div class="lb">Nom de ce revenu <span class="fa">facultatif</span></div>
        <input type="text" placeholder="Ex. Salaire principal, Appartement Paris…" value="${r.nom}"
               data-id="${personneId}" data-revenu="${r.id}" data-champ="nom">
      </div>
      <div class="l2">
        <div class="ch">
          <div class="lb">Type de revenus</div>
          <select data-id="${personneId}" data-revenu="${r.id}" data-champ="type">
            ${TYPES_REVENUS.map(v => `<option ${v === r.type ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </div>
        <div class="ch">
          <div class="lb">Montant approximatif</div>
          <input type="text" placeholder="Ex. 2 100 € par mois" value="${r.montant}"
                 data-id="${personneId}" data-revenu="${r.id}" data-champ="montant">
        </div>
      </div>
      <div class="ch">
        <div class="lb">Jour de versement habituel <span class="fa">facultatif</span></div>
        ${segment("jourVersement", JOURS, r.jourVersement, `data-id="${personneId}" data-revenu="${r.id}"`)}
      </div>
    </div>`;
}

function blocPersonne(p, index) {
  return `
    <div class="bloc" data-id="${p.id}">
      <div class="tt"><span class="pt">${index + 1}</span> Personne ${index + 1}</div>
      <button class="x" data-action="supprimer-personne" data-id="${p.id}" title="Supprimer">✕</button>

      <div class="l3">
        <div class="ch">
          <div class="lb">Prénom</div>
          <input type="text" placeholder="Ex. Léa" value="${p.prenom}"
                 data-id="${p.id}" data-champ="prenom">
        </div>
        <div class="ch">
          <div class="lb">Nom</div>
          <input type="text" placeholder="Ex. Martin" value="${p.nom}"
                 data-id="${p.id}" data-champ="nom">
        </div>
        <div class="ch">
          <div class="lb">Âge <span class="fa">facultatif</span></div>
          <input type="number" placeholder="Ex. 34" value="${p.age}"
                 data-id="${p.id}" data-champ="age">
        </div>
      </div>

      <div class="ch">
        <div class="lb">Situation</div>
        ${segment("situation", SITUATIONS, p.situation, `data-id="${p.id}"`)}
      </div>

      <div class="ch">
        <div class="lb">Revenus</div>
        ${p.revenus.map(r => ligneRevenu(r, p.id, p.revenus.length > 1)).join("")}
        <button class="aj" data-action="ajouter-revenu" data-id="${p.id}" style="margin-top:6px">＋ Ajouter un revenu</button>
      </div>
    </div>`;
}

function rendrePersonnes() {
  document.getElementById("liste-personnes").innerHTML =
    etat.personnes.map(blocPersonne).join("");

  document.getElementById("bloc-mode-vie").innerHTML =
    segment("modeVie", MODES_VIE, etat.modeVie);

  document.getElementById("bloc-repartition").innerHTML =
    segment("repartition", REPARTITIONS, etat.repartition);
}

document.getElementById("liste-personnes").addEventListener("input", e => {
  const { id, champ, revenu } = e.target.dataset;
  if (!id || !champ) return;
  const personne = etat.personnes.find(p => p.id === id);
  if (revenu) {
    personne.revenus.find(r => r.id === revenu)[champ] = e.target.value;
  } else {
    personne[champ] = e.target.value;
  }
  sauvegarderEtat(etat);
});

document.getElementById("etape-personnes").addEventListener("click", e => {
  const cible = e.target.closest("[data-action], .o");
  if (!cible) return;

  if (cible.dataset.action === "supprimer-personne") {
    etat.personnes = etat.personnes.filter(p => p.id !== cible.dataset.id);
    actualiser();
    return;
  }

  if (cible.dataset.action === "ajouter-personne") {
    etat.personnes.push(nouvellePersonne());
    actualiser();
    return;
  }

  if (cible.dataset.action === "ajouter-revenu") {
    etat.personnes.find(p => p.id === cible.dataset.id).revenus.push(nouveauRevenu());
    actualiser();
    return;
  }

  if (cible.dataset.action === "supprimer-revenu") {
    const personne = etat.personnes.find(p => p.id === cible.dataset.id);
    personne.revenus = personne.revenus.filter(r => r.id !== cible.dataset.revenu);
    actualiser();
    return;
  }

  if (cible.classList.contains("o")) {
    const { groupe, valeur, id, revenu } = cible.dataset;
    if (revenu) {
      etat.personnes.find(p => p.id === id).revenus.find(r => r.id === revenu)[groupe] = valeur;
    } else if (id) {
      etat.personnes.find(p => p.id === id)[groupe] = valeur;
    } else {
      etat[groupe] = valeur;
    }
    actualiser();
  }
});

ECRANS.personnes = {
  rendre: rendrePersonnes,
  compteur: () => `${etat.personnes.length} personne${etat.personnes.length > 1 ? "s" : ""}`,
};
