// ═══════════════════════════════════════════════════════════════════
// PARSEUR D'IMPORT — transforme le texte brut d'un PDF, ou le contenu
// d'un CSV, en une liste de transactions { date, libelle, montant }.
// ⚠️ Analyse au mieux : chaque banque a son propre format. Réglage
// actuel calé sur un relevé Société Générale — à ajuster si un autre
// format apparaît.
// ═══════════════════════════════════════════════════════════════════

// Le séparateur des milliers peut être une espace ou un point (« 1.306,05 »).
// ⚠️ Il est OBLIGATOIRE (pas juste optionnel) : sinon un
// long numéro de référence collé ("MANDAT 00S019715599 125,00") se faisait
// lire comme un montant à 6 chiffres au lieu du vrai « 125,00 ». Le (?<!\d)
// et (?!\d) empêchent en plus de « couper » un tel numéro en deux. Les « : » et
// « / » devant interdisent aussi de prendre la fin d'une heure (« 23:49 150,00 »
// ne doit pas devenir 49 150,00) ou d'une date (« 27/07/26 150,00 »).
const REGEX_MONTANT = /(?<![\d:\/])\d{1,3}(?:[ \u00A0.]\d{3})*,\d{2}(?!\d)/g;

// Un relevé PDF, une fois le texte extrait, n'a plus de retour à la
// ligne : les transactions se suivent. On repère chacune grâce à son
// couple de dates (date d'opération, date de valeur) qui l'ouvre.
function extraireTransactionsPDF(texte) {
  const positions = [];
  const re = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}/g;
  let m;
  while ((m = re.exec(texte))) {
    positions.push({ index: m.index, date: m[1], finPrefixe: re.lastIndex });
  }

  const transactions = [];
  for (let i = 0; i < positions.length; i++) {
    const debut = positions[i].finPrefixe;
    const fin = i + 1 < positions.length ? positions[i + 1].index : texte.length;
    const bloc = texte.slice(debut, fin).trim();

    // Le montant d'une transaction est celui marqué ⟦D⟧ / ⟦C⟧ par le lecteur
    // PDF (colonne Débit ou Crédit). On prend le PREMIER : en fin de page, le
    // texte d'une transaction déborde sur l'en-tête de la page suivante
    // (« RCS Paris… capital de 1 000 395 971,25 Eur »), qui ressemble aussi à
    // un montant mais vient toujours après le vrai.
    //
    // ⚠️ RÈGLE IMPORTANTE : chaque ligne du relevé doit être importée, sans
    // exception. Si le montant n'a pas pu être lu, la transaction est quand
    // même créée — avec un montant vide à saisir à la main.
    const marque = /(?<![\d:\/])(\d{1,3}(?:[ \u00A0.]\d{3})*,\d{2})⟦([DC])⟧/.exec(bloc);
    let montantTexte = null, sens = null, libelle = bloc;
    if (marque) {
      montantTexte = marque[1];
      sens = marque[2] === "C" ? "credit" : "debit";
      libelle = bloc.slice(0, marque.index);
    } else {
      const m = new RegExp(REGEX_MONTANT.source).exec(bloc);
      if (m) { montantTexte = m[0]; libelle = bloc.slice(0, m.index); }
    }
    libelle = libelle.replace(/⟦[DC]⟧/g, "").trim();

    transactions.push({
      date: positions[i].date,
      libelle: libelle || "(libellé non détecté)",
      montant: montantTexte ? parseFloat(montantTexte.replace(/[ \u00A0.]/g, "").replace(",", ".")) : null,
      sens,
    });
  }
  return transactions;
}

// Un CSV bancaire n'a pas de colonnes standardisées d'une banque à
// l'autre : on repère la colonne date et la colonne montant par leur
// forme, et le reste devient le libellé.
function extraireTransactionsCSV(contenu) {
  const lignes = contenu.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lignes.length === 0) return [];
  const delimiteur = lignes[0].includes(";") ? ";" : ",";

  const transactions = [];
  for (const ligne of lignes) {
    const colonnes = ligne.split(delimiteur).map(c => c.trim().replace(/^"|"$/g, ""));
    const colonneDate = colonnes.find(c => /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(c));
    if (!colonneDate) continue; // sans date reconnaissable, impossible de distinguer une transaction d'un en-tête

    // ⚠️ RÈGLE IMPORTANTE : chaque ligne datée doit être importée, même si
    // le montant n'a pas pu être identifié — avec un montant vide à saisir
    // à la main plutôt que d'être silencieusement écartée.
    const colonneMontant = [...colonnes].reverse()
      .find(c => /^-?\d+([.,]\d{1,2})?$/.test(c.replace(/\s/g, "")));

    const libelle = colonnes.filter(c => c !== colonneDate && c !== colonneMontant).join(" ").trim();
    transactions.push({
      date: colonneDate.replace(/-/g, "/"),
      libelle: libelle || "(sans libellé)",
      montant: colonneMontant ? Math.abs(parseFloat(colonneMontant.replace(",", "."))) : null,
      signe: colonneMontant ? Math.sign(parseFloat(colonneMontant.replace(",", "."))) : 0,
    });
  }

  // Le signe n'est fiable que si le fichier mélange négatifs et positifs
  // (montants « signés »). Sinon on ne devine pas : sens inconnu.
  const signe = transactions.some(t => t.signe < 0);
  transactions.forEach(t => {
    t.sens = !signe || t.signe === 0 ? null : t.signe < 0 ? "debit" : "credit";
    delete t.signe;
  });
  return transactions;
}

// La clé qui sert à « retenir » une catégorie pour un commerçant :
// on retire le préfixe technique (« CARTE X1234 12/03 ») et on ne
// garde que les premiers mots du nom du commerçant.
function cleApprentissage(libelle) {
  const sansPrefixe = libelle.replace(/CARTE\s+X?\d+\s+\d{2}\/\d{2}\s*/i, "").trim();
  // On ignore les numéros de référence (4 chiffres ou plus), qui changent à
  // chaque opération, pour que deux paiements chez le même commerçant
  // donnent la même clé.
  return sansPrefixe.toUpperCase().split(/\s+/).filter(m => !/\d{4,}/.test(m)).slice(0, 4).join(" ");
}

// Un relevé donne ses propres totaux (« TOTAUX DES MOUVEMENTS »). On les lit
// pour pouvoir vérifier que l'import est complet et fidèle au relevé.
function extraireTotauxPDF(texte) {
  const m = /TOTAUX DES MOUVEMENTS\s+(\d{1,3}(?:[  .]\d{3})*,\d{2})⟦D⟧\s+(\d{1,3}(?:[  .]\d{3})*,\d{2})⟦C⟧/.exec(texte);
  if (!m) return null;
  const nombre = t => parseFloat(t.replace(/[  .]/g, "").replace(",", "."));
  return { debit: nombre(m[1]), credit: nombre(m[2]) };
}
