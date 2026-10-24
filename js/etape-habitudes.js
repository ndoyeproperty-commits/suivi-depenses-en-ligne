// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ④ — LES HABITUDES
// ⚠️ Chaque type d'abonnement est générique (« Mobile », « Streaming »…)
// et demande un détail libre une fois coché (l'opérateur, la plateforme…),
// pour rester valable pour n'importe quel foyer.
// ═══════════════════════════════════════════════════════════════════

const TYPES_ABONNEMENT = [
  { cle: "mobile", titre: "📱 Mobile", placeholder: "Quel opérateur ? (ex. SFR, Orange…)" },
  { cle: "internet", titre: "🌐 Internet / Box", placeholder: "Quel fournisseur ?" },
  { cle: "streaming", titre: "🎬 Plateforme de streaming", placeholder: "Laquelle ? (ex. Netflix, Amazon Prime…)" },
  { cle: "salleDeSport", titre: "🏋️ Salle de sport", placeholder: "Laquelle ?" },
  { cle: "transport", titre: "🚇 Abonnement transport", placeholder: "Lequel ? (ex. Navigo, TER…)" },
  { cle: "energie", titre: "💡 Énergie", placeholder: "Quel fournisseur ?" },
  { cle: "mutuelle", titre: "🏥 Mutuelle / complémentaire santé", placeholder: "Quel organisme ?" },
  { cle: "assurances", titre: "🛡️ Assurances", placeholder: "Lesquelles ? (habitation, auto…)" },
];

function caseAbonnement(t) {
  const info = etat.habitudes.abonnements[t.cle];
  return `
    <label class="cse${info.active ? " on" : ""}" data-abonnement="${t.cle}">
      <span class="b"></span>
      <span class="tx"><b>${t.titre}</b></span>
    </label>`;
}

function detailAbonnement(t) {
  const info = etat.habitudes.abonnements[t.cle];
  if (!info.active) return "";
  return `
    <div class="ch">
      <div class="lb">${t.titre}</div>
      <input type="text" placeholder="${t.placeholder}" value="${info.detail}"
             data-abonnement-detail="${t.cle}">
    </div>`;
}

function ligneAbonnementPersonnalise(a, index) {
  return `
    <div class="ch" style="display:flex;gap:10px;align-items:center">
      <input type="text" placeholder="Ex. Assurance habitation" value="${a.nom}"
             data-personnalise="${a.id}" style="flex:1">
      <button class="x" data-action="supprimer-abonnement-personnalise" data-id="${a.id}"
              title="Supprimer" style="position:static">✕</button>
    </div>`;
}

function rendreHabitudes() {
  document.getElementById("cases-abonnements").innerHTML =
    TYPES_ABONNEMENT.map(caseAbonnement).join("");

  document.getElementById("details-abonnements").innerHTML =
    TYPES_ABONNEMENT.map(detailAbonnement).join("");

  document.getElementById("liste-abonnements-personnalises").innerHTML =
    etat.habitudes.abonnementsPersonnalises.map(ligneAbonnementPersonnalise).join("");

  document.getElementById("champ-enseignes").value = etat.habitudes.enseignes;
  document.getElementById("champ-depenses-regulieres").value = etat.habitudes.depensesRegulieres;
}

document.getElementById("etape-habitudes").addEventListener("input", e => {
  const { champ, abonnementDetail, personnalise } = e.target.dataset;

  if (abonnementDetail) {
    etat.habitudes.abonnements[abonnementDetail].detail = e.target.value;
    sauvegarderEtat(etat);
    return;
  }
  if (personnalise) {
    etat.habitudes.abonnementsPersonnalises.find(a => a.id === personnalise).nom = e.target.value;
    sauvegarderEtat(etat);
    return;
  }
  if (champ) {
    etat.habitudes[champ] = e.target.value;
    sauvegarderEtat(etat);
  }
});

document.getElementById("etape-habitudes").addEventListener("click", e => {
  const caseCliquee = e.target.closest("[data-abonnement]");
  if (caseCliquee) {
    const cle = caseCliquee.dataset.abonnement;
    etat.habitudes.abonnements[cle].active = !etat.habitudes.abonnements[cle].active;
    actualiser();
    return;
  }

  const action = e.target.closest("[data-action]");
  if (!action) return;

  if (action.dataset.action === "ajouter-abonnement-personnalise") {
    etat.habitudes.abonnementsPersonnalises.push(nouvelAbonnementPersonnalise());
    actualiser();
  } else if (action.dataset.action === "supprimer-abonnement-personnalise") {
    etat.habitudes.abonnementsPersonnalises =
      etat.habitudes.abonnementsPersonnalises.filter(a => a.id !== action.dataset.id);
    actualiser();
  }
});

ECRANS.habitudes = {
  rendre: rendreHabitudes,
  compteur: () => {
    const nb = Object.values(etat.habitudes.abonnements).filter(a => a.active).length
      + etat.habitudes.abonnementsPersonnalises.length;
    return nb > 0 ? `${nb} abonnement${nb > 1 ? "s" : ""}` : "";
  },
};
