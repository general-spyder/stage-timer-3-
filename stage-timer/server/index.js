// Stage Timer backend. `cd server && npm i express nodemailer`. Deploy over HTTPS.
// ENV: PAYSTACK_SECRET, ADMIN_TOKEN, SMTP_URL, PRICE_GHS (initial only), ADMIN_EMAIL (default mystagetimer@gmail.com),
//      ADMIN_PHONE (0552231869, server-side only), SMS_CLIENT_ID, SMS_SECRET (Hubtel), PRIVATE_KEY_PATH (default ../keys/private.pem)
const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path'),nodemailer=require('nodemailer');
const E=process.env,app=express(),DB='db.json',ADMIN_EMAIL=E.ADMIN_EMAIL||'mystagetimer@gmail.com';
const db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{users:[],orders:{},act:{},feedback:[]};
db.price=db.price||+E.PRICE_GHS||100;const save=()=>fs.writeFileSync(DB,JSON.stringify(db));
const priv=()=>crypto.createPrivateKey(fs.readFileSync(E.PRIVATE_KEY_PATH||path.join(__dirname,'..','keys','private.pem')));
const pub=()=>fs.readFileSync(path.join(__dirname,'..','src','public.pem'));
const issue=(name,email)=>{const b=Buffer.from(JSON.stringify({name,email,iat:Date.now(),id:crypto.randomBytes(6).toString('hex')}));return b.toString('base64url')+'.'+crypto.sign(null,b,priv()).toString('base64url')};
const mail=()=>nodemailer.createTransport(E.SMTP_URL);
app.use((q,r,n)=>{r.set({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,x-admin-token'});q.method==='OPTIONS'?r.end():n()});
app.post('/webhook',express.raw({type:'*/*'}),async(q,r)=>{
 if(crypto.createHmac('sha512',E.PAYSTACK_SECRET).update(q.body).digest('hex')!==q.headers['x-paystack-signature'])return r.sendStatus(401);
 r.sendStatus(200);const ev=JSON.parse(q.body),o=db.orders[ev.data&&ev.data.reference];
 if(ev.event!=='charge.success'||!o||o.key)return;
 if(ev.data.amount<Math.round(o.price*100))return; // underpaid
 o.key=issue(o.name,o.email);save();
 mail().sendMail({from:'Stage Timer <'+ADMIN_EMAIL+'>',to:o.email,subject:'Your Stage Timer licence key',text:`Hi ${o.name},\n\nThank you! Your permanent licence key (works on up to 5 PCs):\n\n${o.key}\n\nPaste it in Stage Timer > Upgrade > License.`}).catch(console.error);
 mail().sendMail({from:'Stage Timer <'+ADMIN_EMAIL+'>',to:ADMIN_EMAIL,subject:`New Stage Timer purchase – ${o.name}`,text:`Name: ${o.name}\nEmail: ${o.email}\nCountry: ${o.country}\nPhone: ${o.phone||'-'}\nAmount: GHS ${o.price}\nRef: ${ev.data.reference}\nTime: ${new Date().toISOString()}`}).catch(console.error);
 fetch(`https://smsc.hubtel.com/v1/messages/send?clientsecret=${E.SMS_SECRET}&clientid=${E.SMS_CLIENT_ID}&from=StageTimer&to=233${(E.ADMIN_PHONE||'').slice(1)}&content=${encodeURIComponent(`Stage Timer sale: ${o.name} (${o.email}) paid GHS ${o.price}`)}`).catch(()=>{});
});
app.use(express.json({limit:'100kb'}));
app.get('/price',(q,r)=>r.json({price:db.price,currency:'GHS'}));
const auth=(q,r,n)=>E.ADMIN_TOKEN&&q.headers['x-admin-token']===E.ADMIN_TOKEN?n():r.status(401).json({error:'Unauthorized'});
app.post('/admin/price',auth,(q,r)=>{const p=+q.body.price;if(!(p>0))return r.json({error:'Invalid price'});db.price=p;save();r.json({ok:true,price:p})});
app.get('/admin/orders',auth,(q,r)=>r.json(Object.values(db.orders).filter(o=>o.key).map(({key,...o})=>o)));
app.get('/admin/feedback',auth,(q,r)=>r.json(db.feedback));
app.get('/admin',(q,r)=>r.send(`<meta charset=utf-8><body style="font-family:sans-serif;max-width:360px;margin:40px auto"><h3>Stage Timer admin</h3>Admin token<br><input id=t type=password><br><br>Price (GHS)<br><input id=p type=number step=0.01 value=${db.price}><br><br><button onclick="fetch('/admin/price',{method:'POST',headers:{'Content-Type':'application/json','x-admin-token':t.value},body:JSON.stringify({price:+p.value})}).then(r=>r.json()).then(d=>m.textContent=d.ok?'Price set to GHS '+d.price:d.error)">Set price</button><p id=m></p>`));
app.post('/signup',(q,r)=>{const{name,email,machine}=q.body;if(!db.users.find(u=>u.email===email))db.users.push({name,email,machine,at:Date.now()});save();r.json({ok:true})});
app.post('/signin',(q,r)=>{const u=db.users.find(u=>u.email===q.body.email);r.json(u?{ok:true,user:{name:u.name,email:u.email}}:{error:'No account found for that email.'})});
app.post('/pay',async(q,r)=>{const{name,country,email,phone,network}=q.body,ref='ST'+Date.now()+crypto.randomBytes(3).toString('hex');
 db.orders[ref]={name,country,email,phone,price:db.price};save();
 const H={Authorization:'Bearer '+E.PAYSTACK_SECRET,'Content-Type':'application/json'},amt=Math.round(db.price*100);
 // Paystack settles to the account linked to YOUR Paystack business; the admin number never reaches the app.
 if(network==='card'){const x=await(await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:H,body:JSON.stringify({email,amount:amt,currency:'GHS',reference:ref,channels:['card']})})).json();return r.json({url:x.data&&x.data.authorization_url,error:x.status?null:x.message})}
 const x=await(await fetch('https://api.paystack.co/charge',{method:'POST',headers:H,body:JSON.stringify({email,amount:amt,currency:'GHS',reference:ref,mobile_money:{phone,provider:network}})})).json();
 r.json({message:x.status?'Approve the prompt on your phone. Your key will be emailed once payment succeeds.':null,error:x.status?null:x.message})});
app.post('/activate',(q,r)=>{const{key,machine}=q.body;try{const[p,s]=String(key).split('.');if(!crypto.verify(null,Buffer.from(p,'base64url'),pub(),Buffer.from(s,'base64url')))throw 0}catch{return r.json({error:'Invalid key.'})}
 const id=crypto.createHash('sha256').update(key).digest('hex').slice(0,16),m=db.act[id]=db.act[id]||[];
 if(!m.includes(machine)){if(m.length>=5)return r.json({error:'This key is already active on 5 PCs.'});m.push(machine);save()}r.json({ok:true})});
app.post('/feedback',(q,r)=>{db.feedback.push({...q.body,at:Date.now()});save();r.json({ok:true})});
app.use('/updates',express.static(path.join(__dirname,'..','dist'))); // upload latest.yml + installers here
app.listen(E.PORT||3000);
