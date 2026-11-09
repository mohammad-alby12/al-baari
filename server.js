const express = require("express");
const helmet = require("helmet");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database(path.join(__dirname, "kelas6.db"));
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "246810";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS homework (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, task TEXT NOT NULL, due TEXT NOT NULL, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, time TEXT NOT NULL, subject TEXT NOT NULL, room TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const defaults = {
  className: "KELAS 6 AL BAARI", schoolYear: "TAHUN AJARAN 2026 / 2027",
  developer: "Alby", motto: "Belajar hari ini, bersinar esok hari."
};
for (const [k,v] of Object.entries(defaults)) db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(k,v);
if (!db.prepare("SELECT COUNT(*) n FROM schedule").get().n) {
  const rows = [
    ["Senin","07.00–08.20","Matematika",""],
    ["Senin","08.20–09.40","Bahasa Indonesia",""],
    ["Selasa","07.00–08.20","IPAS",""],
    ["Selasa","08.20–09.40","Pendidikan Pancasila",""],
    ["Rabu","07.00–08.20","Bahasa Inggris",""],
    ["Rabu","08.20–09.40","Matematika",""],
    ["Kamis","07.00–08.20","PAI",""],
    ["Kamis","08.20–09.40","PJOK",""],
    ["Jumat","07.00–08.20","Seni Budaya",""]
  ];
  const insert = db.prepare("INSERT INTO schedule(day,time,subject,room) VALUES(?,?,?,?)");
  db.transaction(() => rows.forEach(r => insert.run(...r)))();
}
const getSettings = () => Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(x=>[x.key,x.value]));
app.get("/api/data", (req,res) => res.json({
  settings:getSettings(),
  homework:db.prepare("SELECT * FROM homework ORDER BY due,id").all(),
  schedule:db.prepare("SELECT * FROM schedule ORDER BY CASE day WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END,time").all(),
  notes:db.prepare("SELECT * FROM notes ORDER BY id DESC LIMIT 8").all()
}));
function admin(req,res,next) {
  if (req.headers["x-admin-pin"] !== ADMIN_PIN) return res.status(401).json({error:"PIN admin salah."});
  next();
}
app.post("/api/admin/login",(req,res)=> {
  if ((req.body.pin || "") !== ADMIN_PIN) return res.status(401).json({error:"PIN tidak cocok."});
  res.json({ok:true});
});
app.put("/api/settings",admin,(req,res)=>{
  const allowed=["className","schoolYear","developer","motto"];
  const q=db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.transaction(()=>allowed.forEach(k=>{if(typeof req.body[k]==="string")q.run(k,req.body[k].slice(0,120));}))();
  res.json({ok:true});
});
app.post("/api/homework",admin,(req,res)=>{
  const {subject,task,due}=req.body;
  if(!subject||!task||!due) return res.status(400).json({error:"Mata pelajaran, tugas, dan tenggat wajib diisi."});
  const info=db.prepare("INSERT INTO homework(subject,task,due) VALUES(?,?,?)").run(subject.slice(0,80),task.slice(0,500),due);
  res.json({id:info.lastInsertRowid});
});
app.patch("/api/homework/:id",admin,(req,res)=>{
  db.prepare("UPDATE homework SET done=? WHERE id=?").run(req.body.done?1:0,req.params.id);res.json({ok:true});
});
app.delete("/api/homework/:id",admin,(req,res)=>{db.prepare("DELETE FROM homework WHERE id=?").run(req.params.id);res.json({ok:true});});
app.post("/api/schedule",admin,(req,res)=>{
  const {day,time,subject,room=""}=req.body;
  if(!day||!time||!subject)return res.status(400).json({error:"Lengkapi jadwal."});
  const info=db.prepare("INSERT INTO schedule(day,time,subject,room) VALUES(?,?,?,?)").run(day,time,subject,room);
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/schedule/:id",admin,(req,res)=>{db.prepare("DELETE FROM schedule WHERE id=?").run(req.params.id);res.json({ok:true});});
app.post("/api/notes",admin,(req,res)=>{
  if(!req.body.title||!req.body.body)return res.status(400).json({error:"Judul dan isi wajib diisi."});
  const info=db.prepare("INSERT INTO notes(title,body) VALUES(?,?)").run(req.body.title.slice(0,100),req.body.body.slice(0,1000));
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/notes/:id",admin,(req,res)=>{db.prepare("DELETE FROM notes WHERE id=?").run(req.params.id);res.json({ok:true});});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Kelas 6 Al Baari aktif di port ${PORT}`));
