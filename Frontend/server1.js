 const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../Frontend')));

const db = new sqlite3.Database('./db.sqlite');


db.run(`CREATE TABLE IF NOT EXISTS taches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nDocument TEXT,
    nomOperateur TEXT,
    nbreOperateurs INTEGER,
    operation TEXT,
    numMachine TEXT,
    dateDebut TEXT,
    dateFin TEXT,
    dureePause REAL DEFAULT 0,
    periodeTotale REAL DEFAULT 0,
    status TEXT,
    causePause TEXT,
    pauses TEXT DEFAULT '[]',
    pauseDebut TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS ouvriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT UNIQUE
)`);


app.post('/ouvrier', (req, res) => {
    const { nom } = req.body;
    db.run("INSERT INTO ouvriers (nom) VALUES (?)", [nom], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, nom });
    });
});


app.get('/ouvriers', (req, res) => {
    db.all("SELECT * FROM ouvriers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.put('/ouvrier/:id', (req, res) => {
    const { id } = req.params;
    const { nom } = req.body;
    db.run("UPDATE ouvriers SET nom=? WHERE id=?", [nom, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ouvrier modifié" });
    });
});

app.delete('/ouvrier/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM ouvriers WHERE id=?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ouvrier supprimé" });
    });
});


app.post('/tache/debut', (req, res) => {
    const t = req.body;
    db.run(
        `INSERT INTO taches (nDocument, nomOperateur, nbreOperateurs, operation, numMachine, dateDebut, status)
         VALUES (?,?,?,?,?,?,?)`,
        [t.nDocument, t.nomOperateur, t.nbreOperateurs, t.operation, t.numMachine, new Date().toISOString(), 'EN_COURS'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.get('/enCours', (req, res) => {
    db.all("SELECT * FROM taches WHERE status!='FINI'", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.get('/historique', (req, res) => {
    db.all("SELECT * FROM taches WHERE status='FINI'", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.put('/tache/:id', (req, res) => {
    const { id } = req.params;
    const { nDocument, nomOperateur, nbreOperateurs, operation, numMachine, status } = req.body;
    db.run(
        `UPDATE taches SET nDocument=?, nomOperateur=?, nbreOperateurs=?, operation=?, numMachine=?, status=? WHERE id=?`,
        [nDocument, nomOperateur, nbreOperateurs, operation, numMachine, status, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Tâche modifiée" });
        }
    );
});


app.delete('/tache/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM taches WHERE id=?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Tâche supprimée" });
    });
});

app.post('/tache/pause', (req, res) => {
    const { id, cause } = req.body;
    db.run(
        "UPDATE taches SET status='PAUSE', causePause=?, pauseDebut=? WHERE id=?",
        [cause, new Date().toISOString(), id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Tâche en pause' });
        }
    );
});

app.post('/tache/reprendre', (req, res) => {
    const { id } = req.body;
    db.get("SELECT pauseDebut, dureePause, causePause FROM taches WHERE id=?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            const pauseMinutes = (new Date() - new Date(row.pauseDebut)) / 60000;
            const totalPause = row.dureePause + pauseMinutes;
          
            db.run(
                "UPDATE taches SET status='EN_COURS', dureePause=?, pauseDebut=NULL WHERE id=?",
                [totalPause, id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: 'Tâche reprise' });
                }
            );
        } else {
            res.status(404).json({ error: 'Tâche introuvable' });
        }
    });
});


app.post('/tache/fin', (req, res) => {
    const { id, nbreOperateurs, dateDebut, dureePause } = req.body;
    const dateFin = new Date();
    const periodeTotale =
        ((dateFin - new Date(dateDebut)) / 60000 - dureePause) * nbreOperateurs;
    db.run(
        "UPDATE taches SET status='FINI', dateFin=?, periodeTotale=? WHERE id=?",
        [dateFin.toISOString(), periodeTotale, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Tâche terminée' });
        }
    );
});


app.get('/stats/pauses', (req, res) => {
    db.all("SELECT causePause, COUNT(*) as total FROM taches WHERE causePause IS NOT NULL AND causePause != '' GROUP BY causePause", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/stats/taches-par-ouvrier', (req, res) => {
    db.all("SELECT nomOperateur, COUNT(*) as total FROM taches GROUP BY nomOperateur", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/login.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Serveur Node.js démarré sur http://0.0.0.0:${port}`);
});





app.post('/tache/supprimer', (req,res)=>{
    const { id } = req.body;
    db.run("DELETE FROM taches WHERE id=?", [id], (err)=>{
        if(err) return res.status(500).json({error: err.message});
        res.json({message:'Tâche supprimée'});
    });
});




app.post('/tache/modifier', (req,res)=>{
    const { id, nDocument, nbreOperateurs, numMachine, operation, nomOperateur } = req.body;
    db.run(
        "UPDATE taches SET nDocument=?, nbreOperateurs=?, numMachine=?, operation=?, nomOperateur=? WHERE id=?",
        [nDocument, nbreOperateurs, numMachine, operation, JSON.stringify(nomOperateur), id],
        (err)=>{
            if(err) return res.status(500).json({error: err.message});
            res.json({message:'Tâche modifiée'});
        }
    );
});

