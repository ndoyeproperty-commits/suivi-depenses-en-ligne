// ═══════════════════════════════════════════════════════════════════
// APP — fait avancer/reculer l'utilisateur entre les écrans du
// paramétrage. Chaque écran s'enregistre lui-même dans ECRANS (voir
// js/etape-personnes.js, js/etape-comptes.js, …).
// ═══════════════════════════════════════════════════════════════════

// Le paramétrage : 5 étapes, dans l'ordre. L'import n'en fait plus partie :
// on y accède depuis le bouton « Importer les relevés » du menu.
const ETAPES = ["personnes", "comptes", "foyer", "habitudes", "enveloppes"];
const ETAPE_SUIVANTE_NOM = {
  personnes: "les comptes",
  comptes: "le foyer",
  foyer: "les habitudes",
  habitudes: "les catégories",
  enveloppes: "le tableau de bord",
};
// Après la dernière étape, on arrive sur le tableau de bord.
const APRES_PARAMETRAGE = "tableau";

// Les pages du menu qui ne sont pas encore construites.
const PAGES_A_VENIR = {};   // (plus aucune page « bientôt » : tous les onglets existent)
// Les écrans « hors paramétrage » qui existent déjà.
const VUES_HORS_PARAMETRAGE = ["tableau", "bilan", "projets", "comparer", "import", "reglages", "operations", "regles"];

const TETE_CONTEXTE = {
  titre: "Parlez-moi de vous",
  sousTitre: "Quelques informations pour comprendre vos relevés dès le premier import. Rien n'est définitif.",
};
const TETE = {
  personnes: TETE_CONTEXTE,
  comptes: TETE_CONTEXTE,
  foyer: TETE_CONTEXTE,
  habitudes: TETE_CONTEXTE,
  enveloppes: {
    titre: "Comment organiser votre budget ?",
    sousTitre: "Besoins, envies, épargne : retenez les sous-catégories qui vous correspondent. Vous pourrez tout modifier plus tard.",
  },
  import: {
    titre: "Importez vos relevés",
    sousTitre: "Vos fichiers ne quittent jamais votre ordinateur.",
  },
};

// Une vue = un écran du paramétrage, le tableau de bord, l'import,
// ou une page pas encore construite.
const vueExiste = nom => ETAPES.includes(nom) || VUES_HORS_PARAMETRAGE.includes(nom) || nom in PAGES_A_VENIR;
const estEtape = nom => ETAPES.includes(nom);
const conteneurDe = nom => nom in PAGES_A_VENIR ? "bientot" : nom;

function rendrePageAVenir(nom) {
  document.getElementById("etape-bientot").innerHTML = `
    <h2>${PAGES_A_VENIR[nom]}</h2>
    <p>Cette page n'est pas encore construite. Vos données sont bien conservées dans ce navigateur.</p>
    <button class="bt p" data-vue="tableau">← Retour au tableau de bord</button>`;
}

// Recalcule tout ce qui est affiché : le contenu de l'écran courant,
// le pied de page (boutons, compteur) et la barre de progression.
function actualiser() {
  synchroniserSousCategoriesDeclarees();
  sauvegarderEtat(etat);
  const nom = etat.etapeCourante;
  const enParametrage = estEtape(nom);

  document.querySelectorAll(".etape-conteneur").forEach(el => {
    el.hidden = el.id !== `etape-${conteneurDe(nom)}`;
  });

  // Titre, barre de progression et boutons « Retour / Continuer » : seulement
  // pendant le paramétrage (et le titre aussi sur l'import).
  const afficheTete = enParametrage || nom === "import";
  document.querySelector(".tete").hidden = !afficheTete;
  document.querySelector(".prog").hidden = !enParametrage;
  document.querySelector(".bas").hidden = !enParametrage;
  if (afficheTete) {
    document.getElementById("titre-principal").textContent = TETE[nom].titre;
    document.getElementById("sous-titre-principal").textContent = TETE[nom].sousTitre;
  }

  if (nom in PAGES_A_VENIR) rendrePageAVenir(nom);
  else ECRANS[nom].rendre();

  // Menu du haut : l'élément de la page courante est en gras.
  document.querySelectorAll("header [data-vue]").forEach(el => {
    const cible = el.dataset.vue;
    const actif = cible === nom || (cible === "reglages" && enParametrage);
    el.classList.toggle("actif", actif);
  });

  if (!enParametrage) return;
  document.getElementById("compteur").textContent = ECRANS[nom].compteur();

  const index = ETAPES.indexOf(nom);
  document.querySelectorAll(".prog .e").forEach((el, i) => {
    el.classList.toggle("cour", i === index);
    el.classList.toggle("fait", i < index);
  });

  document.getElementById("btn-retour").disabled = index === 0;
  document.getElementById("btn-passer").disabled = false;
  document.getElementById("btn-continuer").disabled = false;
  document.getElementById("btn-continuer").textContent =
    `Continuer : ${ETAPE_SUIVANTE_NOM[nom]} →`;
  document.getElementById("note-etape").hidden = true;
}

function irA(nom) {
  if (!vueExiste(nom)) return;
  etat.etapeCourante = nom;
  actualiser();
  window.scrollTo(0, 0);
}

function avancer() {
  const index = ETAPES.indexOf(etat.etapeCourante);
  irA(ETAPES[index + 1] || APRES_PARAMETRAGE);
}

document.getElementById("btn-retour").addEventListener("click", () => {
  const index = ETAPES.indexOf(etat.etapeCourante);
  if (index > 0) irA(ETAPES[index - 1]);
});
document.getElementById("btn-continuer").addEventListener("click", avancer);
document.getElementById("btn-passer").addEventListener("click", avancer);

// La barre de progression est cliquable : on peut sauter directement à
// n'importe quelle étape (rien n'est bloquant, règle ⑤).
document.querySelector(".prog").addEventListener("click", e => {
  const el = e.target.closest(".e");
  if (!el) return;
  const nom = ETAPES[[...el.parentElement.children].indexOf(el)];
  if (nom) irA(nom);
});

// Tout élément portant data-vue="…" (menu, boutons) mène à cette vue.
document.addEventListener("click", e => {
  const cible = e.target.closest("[data-vue]");
  if (!cible) return;
  e.preventDefault();
  irA(cible.dataset.vue);
});

// Si la vue sauvegardée n'existe plus (ancien brouillon), on revient au début.
if (!vueExiste(etat.etapeCourante)) etat.etapeCourante = "personnes";
actualiser();
