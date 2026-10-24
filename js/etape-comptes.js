// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ② — LES COMPTES
// ═══════════════════════════════════════════════════════════════════

const TYPES_COMPTE = ["Compte courant", "Livret / épargne", "Carte de crédit", "Compte titre"];
const DEVISES = ["AED Dirham émirati", "€ Euro", "MAD Dirham marocain"];

const ALIMENTE = [
  { valeur: "commun", texte: "Le budget commun" },
  { valeur: "personnel", texte: "L'argent personnel" },
  { valeur: "epargne", texte: "L'épargne" },
];

// « À qui ? » : la liste des personnes saisies à l'écran ①, + Commun.
function optionsAQui() {
  const options = etat.personnes.map((p, i) => ({ valeur: p.id, texte: libellePersonne(p, i) }));
  options.push({ valeur: "commun", texte: "Commun" });
  return options;
}

function blocCompte(c, index) {
  const optionsPersonnes = optionsAQui();
  return `
    <div class="bloc" data-id="${c.id}">
      <div class="tt"><span class="pt">${index + 1}</span> Compte ${index + 1}</div>
      <button class="x" data-action="supprimer-compte" data-id="${c.id}" title="Supprimer">✕</button>

      <div class="l2">
        <div class="ch">
          <div class="lb">Nom du compte</div>
          <input type="text" placeholder="Ex. compte joint" value="${c.nom}"
                 data-id="${c.id}" data-champ="nom">
        </div>
        <div class="ch">
          <div class="lb">Banque</div>
          <input type="text" placeholder="Ex. Société Générale" value="${c.banque}"
                 data-id="${c.id}" data-champ="banque">
        </div>
      </div>

      <div class="l3">
        <div class="ch">
          <div class="lb">Type <span class="fa">sert à classer vos virements</span></div>
          <select data-id="${c.id}" data-champ="type">
            ${TYPES_COMPTE.map(t => `<option ${t === c.type ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="ch">
          <div class="lb">À qui ?</div>
          <select data-id="${c.id}" data-champ="aQui">
            ${optionsPersonnes.map(o =>
              `<option value="${o.valeur}" ${o.valeur === c.aQui ? "selected" : ""}>${o.texte}</option>`
            ).join("")}
          </select>
        </div>
        <div class="ch">
          <div class="lb">Devise</div>
          <select data-id="${c.id}" data-champ="devise">
            ${DEVISES.map(d => `<option ${d === c.devise ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="ch">
        <div class="lb">Ce compte alimente…</div>
        ${segment("alimente", ALIMENTE, c.alimente, `data-id="${c.id}"`)}
      </div>
    </div>`;
}

// ── Taux de change ─────────────────────────────────────────────────────
// Visible seulement si vos comptes n'ont pas tous la même devise. Vous saisissez
// vous-même « 1 € = … » et la date depuis laquelle il s'applique : une opération
// est convertie au taux en vigueur à sa date (le passé ne change pas quand
// vous ajoutez un nouveau taux). Aucun taux n'est récupéré sur Internet.
function rendreTaux() {
  const bloc = document.getElementById("bloc-taux");
  const autres = devisesDesComptes().filter(d => d !== "EUR");
  if (autres.length === 0) { bloc.innerHTML = ""; return; }
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const lignes = (etat.taux || []).map(x => `
    <div class="ligne-taux" data-id="${x.id}">
      <span>1 € =</span>
      <input type="text" inputmode="decimal" value="${echapper(x.taux)}" placeholder="4,02" data-champ-taux="taux" data-id="${x.id}">
      <select data-champ-taux="devise" data-id="${x.id}">
        ${autres.map(d => `<option ${d === x.devise ? "selected" : ""}>${d}</option>`).join("")}
      </select>
      <span>depuis le</span>
      <input type="date" value="${echapper(x.depuis)}" data-champ-taux="depuis" data-id="${x.id}">
      <button class="mini-x" data-action="supprimer-taux" data-id="${x.id}" title="Supprimer ce taux">✕</button>
    </div>`).join("");
  const manquants = autres.filter(d => tauxPour(d, null) == null);
  bloc.innerHTML = `
    <div class="bloc taux">
      <div class="tt">Taux de change</div>
      <div class="aide">Vos comptes ne sont pas tous dans la même devise : pour les additionner, indiquez le taux que vous
        voulez utiliser. Chaque opération est convertie au taux en vigueur à sa date ; un nouveau taux ne change donc jamais
        les mois passés. Rien n'est récupéré sur Internet.</div>
      ${lignes}
      ${manquants.length ? `<div class="aide">⚠️ Pas encore de taux pour ${manquants.join(", ")} : ces comptes ne seront pas convertis.</div>` : ""}
      <button class="aj" data-action="ajouter-taux" data-defaut="${aujourdhui}">＋ Ajouter un taux</button>
    </div>`;
}

function rendreComptes() {
  document.getElementById("liste-comptes").innerHTML =
    etat.comptes.map(blocCompte).join("");
  rendreTaux();
}

document.getElementById("bloc-taux").addEventListener("input", e => {
  const { id, champTaux } = e.target.dataset;
  const x = id && (etat.taux || []).find(t => t.id === id);
  if (!x) return;
  x[champTaux] = e.target.value;
  sauvegarderEtat(etat);
});
document.getElementById("bloc-taux").addEventListener("click", e => {
  const cible = e.target.closest("[data-action]");
  if (!cible) return;
  if (cible.dataset.action === "ajouter-taux") {
    const devise = devisesDesComptes().find(d => d !== "EUR");
    etat.taux = (etat.taux || []).concat({ id: crypto.randomUUID(), devise, taux: "", depuis: cible.dataset.defaut });
    sauvegarderEtat(etat);
    rendreTaux();
  } else if (cible.dataset.action === "supprimer-taux") {
    etat.taux = etat.taux.filter(t => t.id !== cible.dataset.id);
    sauvegarderEtat(etat);
    rendreTaux();
  }
});
// Changer la devise d'un compte, ou en ajouter/supprimer un, change la liste des devises à convertir.
document.getElementById("liste-comptes").addEventListener("change", e => { if (e.target.dataset.champ === "devise") rendreTaux(); });

document.getElementById("liste-comptes").addEventListener("input", e => {
  const { id, champ } = e.target.dataset;
  if (!id || !champ) return;
  const compte = etat.comptes.find(c => c.id === id);
  compte[champ] = e.target.value;
  sauvegarderEtat(etat);
});

document.getElementById("etape-comptes").addEventListener("click", e => {
  const cible = e.target.closest("[data-action], .o");
  if (!cible) return;

  if (cible.dataset.action === "supprimer-compte") {
    const nb = etat.transactions.filter(t => t.compteId === cible.dataset.id).length;
    if (nb > 0 && !confirm(`Ce compte a ${nb} opération${nb > 1 ? "s" : ""} importée${nb > 1 ? "s" : ""}. Elles seront gardées, mais rattachées à « Compte supprimé » (en euros). Supprimer quand même ?`)) return;
    etat.comptes = etat.comptes.filter(c => c.id !== cible.dataset.id);
    actualiser();
    return;
  }

  if (cible.dataset.action === "ajouter-compte") {
    etat.comptes.push(nouveauCompte(etat.personnes[0] && etat.personnes[0].id));
    actualiser();
    return;
  }

  if (cible.classList.contains("o")) {
    const { groupe, valeur, id } = cible.dataset;
    etat.comptes.find(c => c.id === id)[groupe] = valeur;
    actualiser();
  }
});

ECRANS.comptes = {
  rendre: rendreComptes,
  compteur: () => `${etat.comptes.length} compte${etat.comptes.length > 1 ? "s" : ""}`,
};
