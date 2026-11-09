import nodemailer from 'nodemailer';

import { config } from '../config/env.js';
import { LOGO_DES_COURRIELS } from '../shared/referencement.js';

let transport = null;

function transporteur() {
  if (!config.smtp.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
  });
  return transport;
}

export function envoiConfigure() {
  return Boolean(config.smtp.host);
}

export async function verifierEnvoi() {
  const smtp = transporteur();
  if (!smtp) return { pret: false, raison: 'SMTP non configure (SMTP_HOST vide)' };
  if (!config.smtp.user && (config.smtp.password || /(^|\.)gmail\.com$/i.test(config.smtp.host))) {
    return { pret: false, raison: 'SMTP_USER vide : renseignez l’adresse du compte qui envoie les courriels' };
  }
  try {
    await smtp.verify();
    return { pret: true };
  } catch (erreur) {
    return { pret: false, raison: String(erreur.response || erreur.message).split('\n')[0] };
  }
}

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const POLICE = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const VIOLET = '#5d5696';
const NUIT = '#2c2748';
const SOLEIL = '#e0973a';
const FOND = '#f3f1fb';
const TEXTE = '#353343';
const TEXTE_DOUX = '#615d75';

export function miseEnPage({ titre, paragraphes, bouton = null, note = '', image = null, desinscription = null }) {
  const site = config.siteUrl.replace(/\/$/, '');
  const hote = site.replace(/^https?:\/\//, '');
  const corps = paragraphes
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXTE}">${echapper(p)}</p>`)
    .join('');
  const action = bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr>
<td align="center" bgcolor="${VIOLET}" style="border-radius:10px;background:${VIOLET}">
<a href="${echapper(bouton.lien)}" style="display:inline-block;padding:15px 30px;font-family:${POLICE};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">${echapper(bouton.texte)}</a>
</td></tr></table>
<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${TEXTE_DOUX}">Le bouton ne s’ouvre pas ? Copiez ce lien dans votre navigateur :<br><a href="${echapper(bouton.lien)}" style="color:${VIOLET};word-break:break-all">${echapper(bouton.lien)}</a></p>`
    : '';
  const encart = note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr>
<td bgcolor="${FOND}" style="background:${FOND};border-left:4px solid ${SOLEIL};border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.55;color:${TEXTE_DOUX}">${echapper(note)}</td>
</tr></table>`
    : '';

  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${echapper(titre)}</title>
</head>
<body style="margin:0;padding:0;background:${FOND};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${echapper(paragraphes[0] ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FOND}" style="background:${FOND}"><tr>
<td align="center" style="padding:32px 12px;font-family:${POLICE}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" bgcolor="${NUIT}" style="background:${NUIT};border-radius:16px 16px 0 0;padding:28px 24px 24px">
<a href="${echapper(site)}/" style="text-decoration:none"><img src="${echapper(site + LOGO_DES_COURRIELS.chemin)}" width="${LOGO_DES_COURRIELS.largeur}" height="${LOGO_DES_COURRIELS.hauteur}" alt="HOPE – for a better life" style="display:block;border:0;outline:none;width:${LOGO_DES_COURRIELS.largeur}px;height:auto;font-family:${POLICE};font-size:22px;font-weight:700;color:#ffffff"></a>
</td></tr>
<tr><td height="4" bgcolor="${SOLEIL}" style="background:${SOLEIL};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 16px 16px;padding:34px 32px 32px;font-family:${POLICE}">
${image ? `<img src="${echapper(image.src)}" width="496" alt="${echapper(image.alt)}" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;margin:0 0 24px">` : ''}
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:#2a2433">${echapper(titre)}</h1>
${corps}${action}${encart}
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-family:${POLICE};font-size:13px;line-height:1.6;color:${TEXTE_DOUX}">
<strong style="color:${TEXTE}">HOPE – Hope for a Better Life</strong><br>
Aux côtés des orphelins et des mères célibataires de Madagascar<br>
<a href="${echapper(site)}/" style="color:${VIOLET}">${echapper(hote)}</a> · <a href="${echapper(site)}/contact" style="color:${VIOLET}">Écrire à l’équipe</a>
${desinscription ? `<br>Vous recevez les actualités de HOPE à votre demande. <a href="${echapper(desinscription.page)}" style="color:${VIOLET}">Se désinscrire</a>` : ''}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function envoyer({ a, sujet, titre, paragraphes, bouton = null, note = '', image = null, desinscription = null }) {
  const texte = [
    titre,
    '',
    ...paragraphes,
    bouton ? `${bouton.texte} : ${bouton.lien}` : '',
    note,
    desinscription ? `Se désinscrire des actualités : ${desinscription.page}` : '',
  ]
    .filter((ligne) => ligne !== undefined)
    .join('\n');

  if (/\.(test|example|invalid|localhost)$/i.test(String(a ?? '').trim())) {
    if (!config.enProduction) console.log(`[HOPE] Courriel (domaine reserve, non envoye) a ${a} — ${sujet}\n${texte}\n`);
    return false;
  }

  const smtp = transporteur();
  if (!smtp) {
    if (config.enProduction) {
      console.warn(`[HOPE] Courriel non envoye (SMTP non configure) : "${sujet}".`);
    } else {
      console.log(`[HOPE] Courriel (SMTP non configure, affiche ici) a ${a} — ${sujet}\n${texte}\n`);
    }
    return false;
  }

  try {
    await smtp.sendMail({
      from: config.smtp.from,
      ...(config.equipe.email ? { replyTo: config.equipe.email } : {}),
      to: a,
      subject: sujet,
      text: texte,
      html: miseEnPage({ titre, paragraphes, bouton, note, image, desinscription }),
      ...(desinscription
        ? {
            headers: {
              'List-Unsubscribe': `<${desinscription.api}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    });
    return true;
  } catch (erreur) {
    console.error(`[HOPE] Echec d'envoi du courriel "${sujet}" :`, erreur.message);
    return false;
  }
}
