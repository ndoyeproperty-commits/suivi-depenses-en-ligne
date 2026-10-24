// ═══════════════════════════════════════════════════════════════════
// RÉGLAGES — revoir le paramétrage, sauvegarder / restaurer ses données,
// tout effacer.
// ⚠️ RÈGLE ① : vos données vivent UNIQUEMENT dans ce navigateur. La
// sauvegarde est un fichier téléchargé sur votre ordinateur : rien n'est
// envoyé nulle part. Si le navigateur est vidé, seul ce fichier permet de
// tout retrouver.
// ═══════════════════════════════════════════════════════════════════

const frDate = iso => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function rendreReglages() {
  const nb = etat.transactions.length;
  const derniere = etat.derniereSauvegarde;
  document.getElementById("etape-reglages").innerHTML = `
    <div class="reglages-page">
      <h1>Réglages</h1>
      <p class="intro">Vos données restent sur cet ordinateur, dans ce navigateur. Aucun compte, aucun serveur.</p>

      <section class="carte-reglage">
        <h2>Sauvegarde</h2>
        <p>Votre budget n'existe que dans ce navigateur : si vous videz les données du navigateur ou changez d'ordinateur,
        tout disparaît. Le fichier de sauvegarde se télécharge sur votre ordinateur (rien n'est envoyé nulle part) et permet de tout restaurer.</p>
        <p class="etat-sauvegarde ${derniere ? "" : "alerte"}">${derniere
          ? `Dernière sauvegarde : ${frDate(derniere)}.`
          : "Vous n'avez pas encore fait de sauvegarde."} ${nb} opération${nb > 1 ? "s" : ""} actuellement enregistrée${nb > 1 ? "s" : ""}.</p>
        <div class="actions">
          <button class="bt p" data-reglage="exporter">Télécharger une sauvegarde</button>
          <button class="bt s" data-reglage="choisir-fichier">Restaurer depuis un fichier…</button>
          <input type="file" id="fichier-sauvegarde" accept=".json,application/json" hidden>
        </div>
        <p class="message" id="message-reglage"></p>
      </section>

      <section class="carte-reglage">
        <h2>Affichage</h2>
        <label class="interrupteur">
          <input type="checkbox" data-reglage-pref="repere503020" ${etat.preferences && etat.preferences.repere503020 ? "checked" : ""}>
          <span><b>Afficher un repère 50 / 30 / 20</b> sur le tableau de bord<br>
          <small>Un repère courant (50 % de besoins, 30 % d'envies, 20 % d'épargne), pas une norme : à vous de dire s'il vous est utile.
          Désactivé par défaut.</small></span>
        </label>
      </section>

      <section class="carte-reglage">
        <h2>Revoir le paramétrage</h2>
        <p>Les personnes, les comptes (et les taux de change), le foyer, les habitudes et les catégories.</p>
        <div class="actions">
          <button class="bt s" data-vue="personnes">Les personnes</button>
          <button class="bt s" data-vue="comptes">Les comptes &amp; taux de change</button>
          <button class="bt s" data-vue="foyer">Le foyer</button>
          <button class="bt s" data-vue="habitudes">Les habitudes</button>
          <button class="bt s" data-vue="enveloppes">Les catégories</button>
        </div>
      </section>

      <section class="carte-reglage danger">
        <h2>Tout effacer</h2>
        <p>Supprime toutes vos données de ce navigateur : paramétrage, opérations importées, catégories apprises.
        Pensez à télécharger une sauvegarde avant.</p>
        <div class="actions"><button class="bt s" data-reglage="tout-effacer">Tout effacer…</button></div>
      </section>
    </div>`;
}

function messageReglage(texte, erreur = false) {
  const el = document.getElementById("message-reglage");
  if (!el) return;
  el.textContent = texte;
  el.classList.toggle("erreur", erreur);
}

function telechargerSauvegarde() {
  etat.derniereSauvegarde = new Date().toISOString();
  sauvegarderEtat(etat);
  const contenu = JSON.stringify({ application: "suivi-depenses", exporteLe: etat.derniereSauvegarde, donnees: etat }, null, 1);
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
  lien.download = `suivi-depenses-sauvegarde-${etat.derniereSauvegarde.slice(0, 10)}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  rendreReglages();
  messageReglage("Sauvegarde téléchargée. Rangez-la en lieu sûr (elle contient vos opérations bancaires).");
}

// Vérifie qu'un fichier ressemble bien à une sauvegarde de cette appli.
function lireSauvegarde(texte) {
  let json;
  try { json = JSON.parse(texte); } catch { throw new Error("Ce fichier n'est pas une sauvegarde valide (il n'est pas lisible)."); }
  const donnees = json && json.application === "suivi-depenses" ? json.donnees : null;
  const ok = donnees && typeof donnees === "object"
    && Array.isArray(donnees.personnes) && Array.isArray(donnees.comptes)
    && Array.isArray(donnees.categories) && Array.isArray(donnees.transactions);
  if (!ok) throw new Error("Ce fichier n'est pas une sauvegarde de Suivi de dépenses.");
  return donnees;
}

async function restaurerSauvegarde(fichier) {
  try {
    const donnees = lireSauvegarde(await fichier.text());
    const nb = donnees.transactions.length;
    if (!confirm(`Remplacer vos données actuelles par cette sauvegarde (${nb} opération${nb > 1 ? "s" : ""}) ?\\n\\nVos données actuelles seront perdues si vous ne les avez pas sauvegardées.`)) return;
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
    location.reload();   // au rechargement, les anciennes versions sont mises à niveau automatiquement
  } catch (err) {
    messageReglage(err.message, true);
  }
}

function toutEffacer() {
  if (!confirm("Effacer TOUTES vos données de ce navigateur ?\\n\\nParamétrage, opérations importées et catégories apprises seront supprimés. Cette action est définitive.")) return;
  if (!confirm("Dernière confirmation : tout supprimer ?")) return;
  localStorage.removeItem(CLE_STOCKAGE);
  location.reload();
}

document.getElementById("etape-reglages").addEventListener("click", e => {
  const cible = e.target.closest("[data-reglage]");
  if (!cible) return;
  const action = cible.dataset.reglage;
  if (action === "exporter") telechargerSauvegarde();
  else if (action === "choisir-fichier") document.getElementById("fichier-sauvegarde").click();
  else if (action === "tout-effacer") toutEffacer();
});
document.getElementById("etape-reglages").addEventListener("change", e => {
  const pref = e.target.dataset.reglagePref;
  if (pref) { etat.preferences = { ...(etat.preferences || {}), [pref]: e.target.checked }; sauvegarderEtat(etat); return; }
  if (e.target.id === "fichier-sauvegarde" && e.target.files[0]) restaurerSauvegarde(e.target.files[0]);
});

ECRANS.reglages = { rendre: rendreReglages, compteur: () => "" };
