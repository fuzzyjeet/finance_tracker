// Websites of common banks and payment services, to suggest a logo from the account name.
const KNOWN: [RegExp, string][] = [
  [/\bpaypal\b/, 'paypal.com'],
  [/\bcommerzbank\b/, 'commerzbank.de'],
  [/\bwise\b/, 'wise.com'],
  [/\bn26\b/, 'n26.com'],
  [/\brevolut\b/, 'revolut.com'],
  [/\bdeutsche bank\b/, 'deutsche-bank.de'],
  [/\bsparkasse\b/, 'sparkasse.de'],
  [/\bbarclays\b/, 'barclays.de'],
  [/\bdkb\b/, 'dkb.de'],
  [/\bing(-diba)?\b/, 'ing.de'],
  [/\btrade ?republic\b/, 'traderepublic.com'],
  [/\b(amex|american express)\b/, 'americanexpress.com'],
  [/\bcomdirect\b/, 'comdirect.de'],
  [/\bconsors(bank)?\b/, 'consorsbank.de'],
  [/\bpostbank\b/, 'postbank.de'],
  [/\b(volksbank|raiffeisenbank)\b/, 'vr.de'],
  [/\bbunq\b/, 'bunq.com'],
  [/\bscalable\b/, 'scalable.capital'],
  [/\bhanseatic\b/, 'hanseaticbank.de'],
  [/\badvanzia\b/, 'advanzia.com'],
  [/\bc24\b/, 'c24.de'],
  [/\btomorrow\b/, 'tomorrow.one'],
  [/\bvivid\b/, 'vivid.money'],
  [/\bklarna\b/, 'klarna.com'],
  [/\bsantander\b/, 'santander.de'],
  [/\b(hypovereinsbank|hvb)\b/, 'hypovereinsbank.de'],
  [/\btargobank\b/, 'targobank.de'],
  [/\bnorisbank\b/, 'norisbank.de'],
  [/\bmonzo\b/, 'monzo.com'],
  [/\bcurve\b/, 'curve.com'],
  [/\bapple (card|cash|pay)\b/, 'apple.com'],
  [/\bgoogle pay\b/, 'pay.google.com'],
];

export function guessBankDomain(name: string): string | null {
  const n = name.toLowerCase();
  return KNOWN.find(([re]) => re.test(n))?.[1] ?? null;
}

/** Shrinks a picked image to a small square PNG data URL (logo kept whole, transparent edges). */
export function imageToLogo(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
    img.src = url;
  });
}
