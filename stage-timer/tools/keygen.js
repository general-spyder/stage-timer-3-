// ADMIN TOOL - never ship the keys/ folder.
//   npm run keygen:init                        -> creates keys/private.pem + src/public.pem (run ONCE, before building)
//   npm run keygen:issue -- "Name" a@b.com 365 -> prints a license key (3rd arg = days valid; omit for lifetime)
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const [, , cmd, ...args] = process.argv;
const root = path.join(__dirname, '..');
const privPath = path.join(root, 'keys', 'private.pem');
const pubPath = path.join(root, 'src', 'public.pem');

if (cmd === 'init') {
  if (fs.existsSync(privPath)) { console.error('Keys already exist. Deleting them invalidates every issued license.'); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(privPath), { recursive: true });
  fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('Created keys/private.pem (KEEP SECRET, back it up) and src/public.pem (bundled in the app).');
} else if (cmd === 'issue') {
  const [name, email, days] = args;
  if (!name) { console.error('Usage: npm run keygen:issue -- "Customer Name" email@x.com [days]'); process.exit(1); }
  const payload = { name, email: email || '', iat: Date.now() };
  if (days) payload.exp = Date.now() + Number(days) * 864e5;
  const buf = Buffer.from(JSON.stringify(payload));
  const sig = crypto.sign(null, buf, crypto.createPrivateKey(fs.readFileSync(privPath)));
  console.log(buf.toString('base64url') + '.' + sig.toString('base64url'));
} else console.log('Commands: init | issue');
