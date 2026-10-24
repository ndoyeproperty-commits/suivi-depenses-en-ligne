// ═══════════════════════════════════════════════════════════════════
// LECTEUR PDF — extrait le texte d'un relevé bancaire, entièrement dans
// le navigateur, avec pdf.js. ⚠️ RÈGLE ① : le fichier ne quitte jamais
// cet ordinateur — aucun envoi réseau.
// ═══════════════════════════════════════════════════════════════════

pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";   // copie locale : rien ne sort du navigateur

// Une fois le texte extrait, les colonnes « Débit » et « Crédit » sont
// mélangées : on ne sait plus si un montant sort ou entre. On le retrouve
// grâce à la position du montant sur la page : on le marque ⟦D⟧ (débit) ou
// ⟦C⟧ (crédit) selon la colonne où il est écrit, repérée avec les en-têtes
// « Débit » et « Crédit » du relevé.
const MONTANT_SEUL = /^\d{1,3}(?:[ \u00A0.]\d{3})*,\d{2}$/;

function trouverColonnes(items) {
  const centre = mot => {
    const it = items.find(i => i.str.trim() === mot);
    return it ? it.transform[4] + it.width / 2 : null;
  };
  const debit = centre("Débit");
  const credit = centre("Crédit");
  return debit !== null && credit !== null ? { debit, credit } : null;
}

async function extraireTextePDF(fichier) {
  const arrayBuffer = await fichier.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let texte = "";
  let colonnes = null; // reprise d'une page à l'autre si l'en-tête n'est pas répété
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const items = (await page.getTextContent()).items;
    colonnes = trouverColonnes(items) || colonnes;

    const morceaux = items.map(item => {
      if (!colonnes || !MONTANT_SEUL.test(item.str.trim())) return item.str;
      const droite = item.transform[4] + item.width;
      if (droite < colonnes.debit - 20) return item.str; // dans le libellé, pas dans une colonne
      return item.str + (droite > (colonnes.debit + colonnes.credit) / 2 ? "⟦C⟧" : "⟦D⟧");
    });
    texte += " " + morceaux.join(" ");
  }
  return texte;
}
