const express = require("express");
const helmet = require("helmet");
const path = require("path");
const Database = require("better-sqlite3");
const app = express();
const db = new Database(process.env.DB_PATH || path.join(__dirname, "kelas6.db"));
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
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, no INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS homework_done (homework_id INTEGER NOT NULL, student_id INTEGER NOT NULL, done INTEGER DEFAULT 1, checked_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(homework_id, student_id));
CREATE TABLE IF NOT EXISTS duty (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, members TEXT NOT NULL);
`);
if (!db.prepare("PRAGMA table_info(homework_done)").all().some(c => c.name === "checked_at")) db.exec("ALTER TABLE homework_done ADD COLUMN checked_at TEXT");
const defaults = {
 className: "KELAS 6 AL BAARI", schoolYear: "TAHUN AJARAN 2026 / 2027",
 developer: "Alby", motto: "Belajar hari ini, bersinar esok hari.",
 homeroomTeacher: "Ibu Fitriyana (Ibu Uthie)"
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
app.get("/api/data", (req,res) => {
 const homework = db.prepare("SELECT * FROM homework ORDER BY due,id").all();
 const doneRows = db.prepare("SELECT homework_id, student_id, checked_at FROM homework_done WHERE done=1").all();
 const doneMap = {};
 doneRows.forEach(r => { (doneMap[r.homework_id] ??= []).push(r.student_id); });
 homework.forEach(h => { h.doneBy = doneMap[h.id] || []; });
 const statRows = db.prepare("SELECT student_id, COUNT(*) got, MAX(checked_at) lastAt FROM homework_done WHERE done=1 GROUP BY student_id").all();
 const statMap = {};
 statRows.forEach(r => { statMap[r.student_id] = { got:r.got, lastAt:r.lastAt }; });
 const students = db.prepare("SELECT * FROM students ORDER BY no,id").all().map(s => ({ ...s, got:(statMap[s.id]||{}).got||0, lastAt:(statMap[s.id]||{}).lastAt||null }));
 res.json({
 settings:getSettings(),
 students,
 homework,
 schedule:db.prepare("SELECT * FROM schedule ORDER BY CASE day WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END,time").all(),
 duty:db.prepare("SELECT * FROM duty ORDER BY CASE day WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END,id").all(),
 notes:db.prepare("SELECT * FROM notes ORDER BY id DESC LIMIT 8").all()
 });
});
function admin(req,res,next) {
 if (req.headers["x-admin-pin"] !== ADMIN_PIN) return res.status(401).json({error:"PIN admin salah."});
 next();
}
app.post("/api/admin/login",(req,res)=> {
 if ((req.body.pin || "") !== ADMIN_PIN) return res.status(401).json({error:"PIN tidak cocok."});
 res.json({ok:true});
});
app.put("/api/settings",admin,(req,res)=>{
 const allowed=["className","schoolYear","developer","motto","homeroomTeacher"];
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
app.put("/api/homework/:id/check",(req,res)=>{
 const {studentId,done}=req.body;
 const student=db.prepare("SELECT id FROM students WHERE id=?").get(studentId);
 const hw=db.prepare("SELECT id FROM homework WHERE id=?").get(req.params.id);
 if(!student||!hw) return res.status(400).json({error:"Data siswa atau PR tidak ditemukan."});
 if(done){
 db.prepare("INSERT INTO homework_done(homework_id,student_id,done,checked_at) VALUES(?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(homework_id,student_id) DO UPDATE SET done=1, checked_at=CURRENT_TIMESTAMP").run(req.params.id,studentId);
 } else {
 db.prepare("DELETE FROM homework_done WHERE homework_id=? AND student_id=?").run(req.params.id,studentId);
 }
 res.json({ok:true});
});
app.delete("/api/homework/:id",admin,(req,res)=>{db.prepare("DELETE FROM homework_done WHERE homework_id=?").run(req.params.id);db.prepare("DELETE FROM homework WHERE id=?").run(req.params.id);res.json({ok:true});});
app.post("/api/schedule",admin,(req,res)=>{
 const {day,time,subject,room=""}=req.body;
 if(!day||!time||!subject)return res.status(400).json({error:"Lengkapi jadwal."});
 const info=db.prepare("INSERT INTO schedule(day,time,subject,room) VALUES(?,?,?,?)").run(day,time,subject,room);
 res.json({id:info.lastInsertRowid});
});
app.delete("/api/schedule/:id",admin,(req,res)=>{db.prepare("DELETE FROM schedule WHERE id=?").run(req.params.id);res.json({ok:true});});
app.post("/api/students",admin,(req,res)=>{
 const {name,no=0}=req.body;
 if(!name) return res.status(400).json({error:"Nama siswa wajib diisi."});
 const info=db.prepare("INSERT INTO students(name,no) VALUES(?,?)").run(String(name).slice(0,60),Number(no)||0);
 res.json({id:info.lastInsertRowid});
});
app.delete("/api/students/:id",admin,(req,res)=>{
 db.prepare("DELETE FROM homework_done WHERE student_id=?").run(req.params.id);
 db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
 res.json({ok:true});
});
app.post("/api/duty",admin,(req,res)=>{
 const {day,members}=req.body;
 if(!day||!members) return res.status(400).json({error:"Hari dan anggota piket wajib diisi."});
 const info=db.prepare("INSERT INTO duty(day,members) VALUES(?,?)").run(day,String(members).slice(0,300));
 res.json({id:info.lastInsertRowid});
});
app.delete("/api/duty/:id",admin,(req,res)=>{db.prepare("DELETE FROM duty WHERE id=?").run(req.params.id);res.json({ok:true});});
app.post("/api/notes",admin,(req,res)=>{
 if(!req.body.title||!req.body.body)return res.status(400).json({error:"Judul dan isi wajib diisi."});
 const info=db.prepare("INSERT INTO notes(title,body) VALUES(?,?)").run(req.body.title.slice(0,100),req.body.body.slice(0,1000));
 res.json({id:info.lastInsertRowid});
});
app.delete("/api/notes/:id",admin,(req,res)=>{db.prepare("DELETE FROM notes WHERE id=?").run(req.params.id);res.json({ok:true});});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Kelas 6 Al Baari aktif di port ${PORT}`));

