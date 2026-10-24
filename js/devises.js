// ═══════════════════════════════════════════════════════════════════
// DEVISES — comptes, devises et taux de change saisis par vous.
// ⚠️ RÈGLE ① : aucun taux n'est récupéré sur Internet. Vous saisissez
// « 1 € = 4,02 AED depuis le … » ; une opération est convertie au taux en
// vigueur à sa date, donc un nouveau taux ne change jamais le passé.
// ═══════════════════════════════════════════════════════════════════

// « AED Dirham émirati » → « AED » ; « € Euro » → « EUR ».
function codeDevise(texte) {
  const t = String(texte || "€ Euro");
  return /^€|^EUR/i.test(t) ? "EUR" : t.split(" ")[0];
}
const symboleDevise = code => code === "EUR" ? "€" : code;

// Le nom d'un compte tel qu'on le montre : « Compte joint · Société Générale ».
function nomDuCompte(c, index) {
  const nom = (c.nom || "").trim(), banque = (c.banque || "").trim();
  if (nom && banque) return `${nom} · ${banque}`;
  return nom || banque || `Compte ${index !== undefined ? index + 1 : ""}`.trim();
}

const compteParId = id => etat.comptes.find(c => c.id === id) || null;
const deviseDuCompte = id => { const c = compteParId(id); return c ? codeDevise(c.devise) : "EUR"; };

// Les devises présentes parmi les comptes (dans l'ordre où elles apparaissent).
function devisesDesComptes() {
  const liste = [];
  etat.comptes.forEach(c => { const d = codeDevise(c.devise); if (!liste.includes(d)) liste.push(d); });
  return liste.length ? liste : ["EUR"];
}

// « 02/01/2026 » → « 2026-01-02 » (comparable comme du texte).
function dateISO(texte) {
  const d = lireDate(texte);
  const jour = String(texte).slice(0, 2);
  return d ? `${d.annee}-${String(d.mois + 1).padStart(2, "0")}-${jour}` : null;
}

// Le taux en vigueur à une date : « 1 € = X devise ». Avant le premier taux
// saisi, on prend le premier. Sans aucun taux : null (on ne devine pas).
function tauxPour(devise, iso) {
  if (devise === "EUR") return 1;
  const liste = (etat.taux || []).filter(x => x.devise === devise && nombreDe(x.taux) > 0)
    .sort((a, b) => (a.depuis || "").localeCompare(b.depuis || ""));
  if (liste.length === 0) return null;
  let choisi = liste[0];
  for (const x of liste) if (iso && x.depuis && x.depuis <= iso) choisi = x;
  return nombreDe(choisi.taux);
}

// Convertit un montant ; null si un taux manque.
function convertirMontant(montant, de, vers, iso) {
  if (de === vers) return montant;
  const a = tauxPour(de, iso), b = tauxPour(vers, iso);
  return a == null || b == null ? null : montant / a * b;
}

// Peut-on afficher tous les comptes dans cette devise ? (un taux pour chaque devise)
const conversionPossible = vers => devisesDesComptes().every(d => d === vers || (tauxPour(d, null) != null && tauxPour(vers, null) != null));
