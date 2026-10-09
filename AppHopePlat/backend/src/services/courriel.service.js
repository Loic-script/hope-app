import nodemailer from 'nodemailer';

import { config } from '../config/env.js';

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

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function miseEnPage({ titre, paragraphes, bouton = null, note = '' }) {
  const corps = paragraphes.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${echapper(p)}</p>`).join('');
  const action = bouton
    ? `<p style="margin:22px 0"><a href="${echapper(bouton.lien)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#5d5696;color:#ffffff;text-decoration:none;font-weight:600">${echapper(bouton.texte)}</a></p>`
    : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f5fb;font-family:Arial,Helvetica,sans-serif;color:#353343">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
<p style="margin:0 0 18px;font-size:22px;font-weight:700;color:#5d5696">HOPE</p>
<div style="background:#ffffff;border-radius:14px;padding:26px 24px">
<h1 style="margin:0 0 16px;font-size:19px">${echapper(titre)}</h1>${corps}${action}
${note ? `<p style="margin:18px 0 0;font-size:13px;color:#6b6880;line-height:1.5">${echapper(note)}</p>` : ''}
</div>
<p style="margin:16px 0 0;font-size:12px;color:#8a8aa0">HOPE — for a better life</p>
</div></body></html>`;
}

export async function envoyer({ a, sujet, titre, paragraphes, bouton = null, note = '' }) {
  const texte = [titre, '', ...paragraphes, bouton ? `${bouton.texte} : ${bouton.lien}` : '', note]
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
      html: miseEnPage({ titre, paragraphes, bouton, note }),
    });
    return true;
  } catch (erreur) {
    console.error(`[HOPE] Echec d'envoi du courriel "${sujet}" :`, erreur.message);
    return false;
  }
}
