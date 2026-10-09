const WINANSI = new Map([
  ['’', '\x92'], ['‘', '\x91'], ['“', '\x93'], ['”', '\x94'],
  ['–', '\x96'], ['—', '\x97'], ['…', '\x85'], ['€', '\x80'],
  ['œ', '\x9c'], ['•', '\x95'], [' ', ' '], [' ', ' '],
]);

function versWinAnsi(texte) {
  return Array.from(String(texte))
    .map((c) => WINANSI.get(c) ?? (c.charCodeAt(0) < 256 ? c : '?'))
    .join('');
}

function echapper(texte) {
  return texte.replace(/([\\()])/g, '\\$1');
}

const PAGE = { largeur: 595, hauteur: 842, marge: 64, haut: 742, bas: 78 };

function couper(texte, taille, largeur) {
  const parLigne = Math.floor(largeur / (taille * 0.5));
  const lignes = [];
  let courante = '';
  for (const mot of texte.split(/\s+/)) {
    if (courante && `${courante} ${mot}`.length > parLigne) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = courante ? `${courante} ${mot}` : mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

export function construirePdf({ titre, sousTitre, blocs }) {
  const pages = [[]];
  let y = PAGE.haut;
  const largeurTexte = PAGE.largeur - 2 * PAGE.marge;

  const texte = (police, taille, x, valeur, couleur = '0.16 0.18 0.25') =>
    pages.at(-1).push(
      `${couleur} rg BT /${police} ${taille} Tf ${x} ${y} Td (${echapper(versWinAnsi(valeur))}) Tj ET`
    );

  const reserver = (hauteur) => {
    if (y - hauteur < PAGE.bas) {
      pages.push([]);
      y = PAGE.haut;
    }
  };

  for (const ligne of couper(titre, 20, largeurTexte)) {
    texte('F2', 20, PAGE.marge, ligne);
    y -= 26;
  }
  y -= 2;
  texte('F1', 11, PAGE.marge, sousTitre, '0.42 0.45 0.53');
  y -= 34;

  for (const bloc of blocs) {
    if (bloc.t === 'h2') {
      reserver(48);
      y -= 8;
      texte('F2', 13, PAGE.marge, bloc.texte, '0.36 0.32 0.56');
      y -= 20;
    } else if (bloc.t === 'p' || bloc.t === 'puce') {
      const retrait = bloc.t === 'puce' ? 16 : 0;
      const lignes = couper(bloc.texte, 10.5, largeurTexte - retrait);
      lignes.forEach((ligne, index) => {
        reserver(15);
        if (bloc.t === 'puce' && index === 0) texte('F1', 10.5, PAGE.marge, '•');
        texte('F1', 10.5, PAGE.marge + retrait, ligne);
        y -= 15;
      });
      y -= 6;
    } else if (bloc.t === 'kv') {
      for (const [libelle, valeur] of bloc.lignes) {
        reserver(18);
        texte('F1', 10.5, PAGE.marge, libelle, '0.42 0.45 0.53');
        texte('F2', 10.5, PAGE.marge + 250, valeur);
        y -= 18;
      }
      y -= 6;
    }
  }

  const total = pages.length;
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${total} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  pages.forEach((operations, index) => {
    const decor = [
      '0.36 0.32 0.56 rg 0 792 595 50 re f',
      `1 1 1 rg BT /F2 13 Tf ${PAGE.marge} 811 Td (HOPE) Tj ET`,
      `1 1 1 rg BT /F1 10 Tf ${PAGE.marge + 44} 811 Td (${echapper(versWinAnsi('Hope for a Better Life — Madagascar'))}) Tj ET`,
      `0.62 0.64 0.70 rg BT /F1 8.5 Tf ${PAGE.marge} 42 Td (${echapper(
        versWinAnsi(`${titre} — page ${index + 1} sur ${total}`)
      )}) Tj ET`,
    ];
    const flux = [...decor, ...operations].join('\n');
    objets.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        `/Contents ${6 + index * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`
    );
    objets.push(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const positions = [];
  objets.forEach((objet, index) => {
    positions.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });
  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    pdf += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  return { contenu: Buffer.from(pdf, 'latin1'), pages: total };
}
