// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ③ — LE FOYER
// ⚠️ Chaque question déclenche parfois un détail complémentaire.
// Tout reste facultatif : rien n'est bloquant, rien n'est inventé.
// ═══════════════════════════════════════════════════════════════════

const HABITATIONS = ["Locataire", "Propriétaire (avec crédit)", "Propriétaire (sans crédit)", "Hébergé"];
const NATURES_PRET = ["Automobile", "Consommation / personnel", "Étudiant", "Autre"];

const QUESTIONS_FOYER = [
  { champ: "aVehicule", titre: "🚗 Un véhicule", texte: "carburant, assurance, entretien" },
  { champ: "aVacances", titre: "✈️ Des vacances régulières", texte: "voyages, séjours, billets" },
  { champ: "aAnimal", titre: "🐾 Un animal", texte: "vétérinaire, nourriture" },
  { champ: "aPret", titre: "💳 Un prêt en cours", texte: "crédit, mensualités" },
  { champ: "aFraisScolarite", titre: "🎓 Des frais de scolarité", texte: "école, université, activités" },
];

function caseFoyer(q) {
  const active = etat.foyer[q.champ];
  return `
    <label class="cse${active ? " on" : ""}" data-champ="${q.champ}">
      <span class="b"></span>
      <span class="tx"><b>${q.titre}</b><span>${q.texte}</span></span>
    </label>`;
}

// ── Le détail qui apparaît directement sous « Habitation » ──────────

function detailHabitation() {
  if (etat.foyer.habitation === "Locataire") {
    return `
      <div class="ch">
        <div class="lb">Montant du loyer <span class="fa">facultatif</span></div>
        <input type="text" placeholder="Ex. 950 € par mois" value="${etat.foyer.loyerMensuel}"
               data-champ="loyerMensuel" style="max-width:260px">
      </div>`;
  }
  if (etat.foyer.habitation === "Propriétaire (avec crédit)") {
    return `
      <div class="l2">
        <div class="ch">
          <div class="lb">Votre crédit immobilier — mensualité <span class="fa">facultatif</span></div>
          <input type="text" placeholder="Ex. 1 100 € par mois" value="${etat.foyer.creditMensuel}"
                 data-champ="creditMensuel">
        </div>
        <div class="ch">
          <div class="lb">Charges (copropriété…) <span class="fa">facultatif</span></div>
          <input type="text" placeholder="Ex. 120 € par mois" value="${etat.foyer.chargesProprietaire}"
                 data-champ="chargesProprietaire">
        </div>
      </div>`;
  }
  if (etat.foyer.habitation === "Propriétaire (sans crédit)") {
    return `
      <div class="ch">
        <div class="lb">Charges (copropriété…) <span class="fa">facultatif</span></div>
        <input type="text" placeholder="Ex. 120 € par mois" value="${etat.foyer.chargesProprietaire}"
               data-champ="chargesProprietaire" style="max-width:260px">
      </div>`;
  }
  return "";
}

// ── Les détails qui apparaissent selon les cases cochées ─────────────

function detailVehicule() {
  return `
    <div class="ch">
      <div class="lb">Combien de véhicules ? <span class="fa">facultatif</span></div>
      <input type="number" placeholder="Ex. 1" value="${etat.foyer.nombreVehicules}"
             data-champ="nombreVehicules" style="max-width:160px">
    </div>`;
}

function detailVacances() {
  return `
    <div class="ch">
      <div class="lb">Partez-vous régulièrement au même endroit ?</div>
      <input type="text" placeholder="Ex. le Maroc, chaque été" value="${etat.foyer.destinationRecurrente}"
             data-champ="destinationRecurrente">
      <div class="aide">Une dépense qui revient chaque année peut avoir sa
        propre catégorie.</div>
    </div>`;
}

function blocPret(p, index) {
  return `
    <div class="bloc" data-id="${p.id}">
      <div class="tt"><span class="pt">${index + 1}</span> Prêt ${index + 1}</div>
      <button class="x" data-action="supprimer-pret" data-id="${p.id}" title="Supprimer">✕</button>
      <div class="l2">
        <div class="ch">
          <div class="lb">Nom <span class="fa">facultatif</span></div>
          <input type="text" placeholder="Ex. Crédit auto Peugeot" value="${p.nom}"
                 data-pret="${p.id}" data-champ="nom">
        </div>
        <div class="ch">
          <div class="lb">Nature</div>
          <select data-pret="${p.id}" data-champ="nature">
            ${NATURES_PRET.map(n => `<option ${n === p.nature ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="l2">
        <div class="ch">
          <div class="lb">Mensualité</div>
          <input type="text" placeholder="Ex. 210 € / mois" value="${p.mensualite}"
                 data-pret="${p.id}" data-champ="mensualite">
        </div>
        <div class="ch">
          <div class="lb">Échéance prévue <span class="fa">facultatif</span></div>
          <input type="date" value="${p.echeance}" data-pret="${p.id}" data-champ="echeance">
        </div>
      </div>
    </div>`;
}

function detailPrets() {
  return `
    <div class="ch"><div class="lb">💳 Vos prêts en cours</div></div>
    <div id="liste-prets">${etat.foyer.prets.map(blocPret).join("")}</div>
    <button class="aj" data-action="ajouter-pret">＋ Ajouter un prêt</button>`;
}

function detailRetraites() {
  const actif = etat.foyer.viePartielleAutrePays;
  return `
    <div class="ch"><div class="lb">🧓 Vie à l'étranger</div></div>
    <div class="ch">
      <div class="lb">Passez-vous une partie de l'année dans un autre pays ?</div>
      ${segment("viePartielleAutrePays",
        [{ valeur: "true", texte: "Oui" }, { valeur: "false", texte: "Non" }],
        String(actif))}
    </div>
    ${actif ? `
    <div class="ch">
      <div class="lb">Où, et à quelle période ? <span class="fa">facultatif</span></div>
      <input type="text" placeholder="Ex. le Maroc, 4 mois l'hiver" value="${etat.foyer.detailsAutrePays}"
             data-champ="detailsAutrePays">
    </div>` : ""}`;
}

function rendreFoyer() {
  document.getElementById("bloc-habitation").innerHTML = `
    <select data-champ="habitation">
      ${HABITATIONS.map(h => `<option ${h === etat.foyer.habitation ? "selected" : ""}>${h}</option>`).join("")}
    </select>`;
  document.getElementById("detail-habitation").innerHTML = detailHabitation();

  document.getElementById("champ-enfants").value = etat.foyer.nombreEnfants;

  document.getElementById("cases-foyer").innerHTML =
    QUESTIONS_FOYER.map(caseFoyer).join("");

  const detailsUnPersonneRetraitee = etat.personnes.some(p => p.situation === "retraite");
  const panneaux = [
    etat.foyer.aVehicule && detailVehicule(),
    etat.foyer.aVacances && detailVacances(),
    etat.foyer.aPret && detailPrets(),
    detailsUnPersonneRetraitee && detailRetraites(),
  ].filter(Boolean);

  document.getElementById("panneaux-foyer").innerHTML =
    panneaux.map(p => `<div class="etape" style="margin-bottom:24px">${p}</div>`).join("");
}

document.getElementById("etape-foyer").addEventListener("input", e => {
  const { champ, pret } = e.target.dataset;
  if (!champ) return;

  if (pret) {
    etat.foyer.prets.find(p => p.id === pret)[champ] = e.target.value;
    sauvegarderEtat(etat);
    return;
  }

  etat.foyer[champ] = e.target.value;
  if (champ === "habitation") { actualiser(); return; }
  sauvegarderEtat(etat);
});

document.getElementById("etape-foyer").addEventListener("click", e => {
  const cible = e.target.closest("[data-action], .o, [data-champ]");
  if (!cible) return;

  if (cible.dataset.action === "ajouter-pret") {
    etat.foyer.prets.push(nouveauPret());
    actualiser();
    return;
  }
  if (cible.dataset.action === "supprimer-pret") {
    etat.foyer.prets = etat.foyer.prets.filter(p => p.id !== cible.dataset.id);
    actualiser();
    return;
  }
  if (cible.classList.contains("o")) {
    const { groupe, valeur } = cible.dataset;
    etat.foyer[groupe] = valeur === "true" ? true : valeur === "false" ? false : valeur;
    actualiser();
    return;
  }
  if (cible.tagName !== "SELECT" && cible.dataset.champ && cible.dataset.champ in etat.foyer
      && typeof etat.foyer[cible.dataset.champ] === "boolean") {
    etat.foyer[cible.dataset.champ] = !etat.foyer[cible.dataset.champ];
    actualiser();
  }
});

ECRANS.foyer = {
  rendre: rendreFoyer,
  compteur: () => {
    const nb = QUESTIONS_FOYER.filter(q => etat.foyer[q.champ]).length;
    return nb > 0 ? `${nb} réponse${nb > 1 ? "s" : ""} cochée${nb > 1 ? "s" : ""}` : "";
  },
};
