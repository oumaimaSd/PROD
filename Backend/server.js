
process.on('uncaughtException', (err) => {
  console.error('❌ Erreur non capturée :', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesse rejetée non gérée :', reason);
});


const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 4800;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../Frontend')));

const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS taches (
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS enCours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT,
      machine TEXT,
      nomOperateur TEXT,
      nbreOperateurs INTEGER,
      etat TEXT,
      dateDebut TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS historique (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idTache INTEGER,
      typeAction TEXT,
      details TEXT,
      dateAction TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ouvriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE
    )
  `);

  console.log("✅ Vérification des tables terminée (taches + enCours + historique + ouvriers)");
});


const ensureColumn = (table, columnDef) => {
  const colName = columnDef.split(' ')[0];
  db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`, (err) => {
    if (err) {
      if (!err.message.includes('duplicate column')) {
        console.warn(`⚠️ Erreur ajout colonne ${colName} dans ${table}:`, err.message);
      }
    } else {
      console.log(`🆕 Colonne ajoutée: ${table}.${colName}`);
    }
  });
};

ensureColumn('historique', 'typeAction TEXT');
ensureColumn('historique', 'details TEXT');
ensureColumn('historique', 'dateAction TEXT');
ensureColumn('taches', 'nomOperateur TEXT');
ensureColumn('taches', 'nbreOperateurs INTEGER');

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

app.get('/historiquePause/:id', (req, res) => {
  const { id } = req.params;

  db.get("SELECT pauses FROM taches WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row || !row.pauses) return res.json([]);

    try {
      const pauses = JSON.parse(row.pauses);
      const result = pauses.map(p => {
        const debut = new Date(p.debut);
        const fin = new Date(p.fin);
        const duree = (fin - debut) / 60000; 

        return {
          cause: p.cause || "-",
          debut: p.debut,
          fin: p.fin,
          dureeMinutes: duree > 0 ? duree : 0
        };
      });
      res.json(result);
    } catch (e) {
      console.error("Erreur parsing JSON pauses:", e);
      res.json([]);
    }
  });
});



app.get('/historiqueEquipe/:id', (req, res) => {
  const { id } = req.params;
  db.all(
    "SELECT details, dateAction FROM historique WHERE idTache = ? AND typeAction = 'Modification Ouvriers' ORDER BY dateAction DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.json([]);

      const result = rows.map(r => {
    
        const match = r.details.match(/\[(.*?)\] → \[(.*?)\]/);
        const anciens = match ? match[1].split(',').map(s => s.trim()).filter(Boolean) : [];
        const nouveaux = match ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [];

        return {
          debut: r.dateAction,
          fin: r.dateAction,
          ouvriers: nouveaux,
          nbreOperateurs: nouveaux.length
        };
      });

      res.json(result);
    }
  );
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
  const debut = new Date().toISOString();

  db.get("SELECT pauses FROM taches WHERE id=?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    let pauses = [];
    try { pauses = row && row.pauses ? JSON.parse(row.pauses) : []; } catch { pauses = []; }

    pauses.push({ debut, fin: null, cause });

    db.run(
      "UPDATE taches SET status='PAUSE', causePause=?, pauseDebut=?, pauses=? WHERE id=?",
      [cause, debut, JSON.stringify(pauses), id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Tâche en pause', pauses });
      }
    );
  });
});
app.get('/recalculer-durees', (req, res) => {
  db.all("SELECT * FROM taches WHERE status='FINI'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    rows.forEach(t => {
      let dureePause = 0;
      try {
        const pauses = JSON.parse(t.pauses || "[]");
        dureePause = pauses.reduce((sum, p) => {
          if (p.debut && p.fin) {
            let diff = (new Date(p.fin) - new Date(p.debut)) / 60000;
            if (diff < 0) diff += 24 * 60; // Corrige minuit
            return sum + diff;
          }
          return sum;
        }, 0);
      } catch {}

      const dateFin = new Date(t.dateFin);
      const dateDebut = new Date(t.dateDebut);
      const periodeTotale = ((dateFin - dateDebut) / 60000 - dureePause) * (t.nbreOperateurs || 1);

      db.run(
        "UPDATE taches SET dureePause=?, periodeTotale=? WHERE id=?",
        [dureePause, periodeTotale, t.id]
      );
    });

    res.json({ message: "✅ Recalcul terminé pour toutes les tâches FINI" });
  });
});

app.post('/tache/reprendre', (req, res) => {
  const { id } = req.body;

  db.get("SELECT pauseDebut, dureePause, pauses FROM taches WHERE id=?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Tâche introuvable" });

    const finPause = new Date();
let pauseMinutes = (finPause - new Date(row.pauseDebut)) / 60000;
if (pauseMinutes < 0) pauseMinutes += 24 * 60; 
    const totalPause = (row.dureePause || 0) + pauseMinutes;

    let pauses = [];
    try { pauses = JSON.parse(row.pauses || "[]"); } catch { pauses = []; }
    if (pauses.length > 0 && !pauses[pauses.length - 1].fin) {
      pauses[pauses.length - 1].fin = finPause.toISOString();
    }

    db.run(
      "UPDATE taches SET status='EN_COURS', dureePause=?, pauseDebut=NULL, pauses=? WHERE id=?",
      [totalPause, JSON.stringify(pauses), id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Tâche reprise', pauses });
      }
    );
  });
});

app.post("/tache/ajouterPause", (req, res) => {
  const { id, debut, fin, cause } = req.body;

  db.get("SELECT pauses FROM taches WHERE id=?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    let pauses = [];
    try { pauses = row && row.pauses ? JSON.parse(row.pauses) : []; } catch { pauses = []; }

    pauses.push({ debut, fin, cause });

    db.run(
      "UPDATE taches SET pauses=? WHERE id=?",
      [JSON.stringify(pauses), id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: "Pause ajoutée", pauses });
      }
    );
  });
});


app.post('/tache/fin', (req, res) => {
  const { id, nbreOperateurs, dateDebut, dureePause } = req.body;
  const dateFin = new Date();
  const periodeTotale = ((dateFin - new Date(dateDebut)) / 60000 - dureePause) * nbreOperateurs;
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

app.get('/pauses', (req, res) => {
  db.all("SELECT id, nDocument, nomOperateur, pauses FROM taches WHERE pauses IS NOT NULL AND pauses != '[]'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const allPauses = [];
    rows.forEach(t => {
      let pauses = [];
      try { pauses = JSON.parse(t.pauses); } catch { pauses = []; }
      pauses.forEach((p, index) => {
        allPauses.push({
          idTache: t.id,
          nDocument: t.nDocument,
          nomOperateur: t.nomOperateur,
          cause: p.cause,
          debut: p.debut,
          fin: p.fin,
          duree: p.fin ? ((new Date(p.fin) - new Date(p.debut)) / 60000).toFixed(1) : "-",
          numeroPause: index + 1
        });
      });
    });
    res.json(allPauses);
  });
});


app.post('/tache/modifier', (req, res) => {
  const { id, nDocument, nbreOperateurs, numMachine, operation, nomOperateur } = req.body;
  if (!id) return res.status(400).json({ error: 'id manquant' });

  db.run(
    "UPDATE taches SET nDocument=?, nbreOperateurs=?, numMachine=?, operation=?, nomOperateur=? WHERE id=?",
    [nDocument, nbreOperateurs, numMachine, operation, typeof nomOperateur === 'object' ? JSON.stringify(nomOperateur) : nomOperateur, id],
    function(err) {
      if (err) {
        console.error('Erreur update tache:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Tâche modifiée' });
    }
  );
});


app.post('/tache/modifierOuvriers', (req, res) => {
  const { id, anciensOuvriers, nouveauxOuvriers, nbreOperateurs } = req.body;

  if (!id || !nouveauxOuvriers) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants' });
  }
  app.get('/tache/:id/historiqueOuvriers', (req, res) => {
  const { id } = req.params;
  db.all(
    "SELECT typeAction, details, dateAction FROM historique WHERE idTache = ? AND typeAction = 'Modification Ouvriers' ORDER BY dateAction DESC",
    [id],
    (err, rows) => {
      if (err) {
        console.error("❌ Erreur lors de la récupération de l’historique :", err.message);
        return res.status(500).json({ error: err.message });
      }
      if (!rows || rows.length === 0)
        return res.json({ message: "Aucun historique d’équipe enregistré pour cette tâche." });
      res.json(rows);
    }
  );
});


  db.run(
    `UPDATE taches SET nomOperateur = ?, nbreOperateurs = ? WHERE id = ?`,
    [JSON.stringify(nouveauxOuvriers), nbreOperateurs || nouveauxOuvriers.length, id],
    function(err) {
      if (err) {
        console.error('Erreur SQL update taches:', err);
        return res.status(500).json({ success: false, message: 'Erreur mise à jour taches' });
      }

      const details = `Changement ouvriers : [${(anciensOuvriers||[]).join(', ')}] → [${nouveauxOuvriers.join(', ')}] (nbre: ${nbreOperateurs || nouveauxOuvriers.length})`;
      db.run(
        `INSERT INTO historique (idTache, typeAction, details, dateAction) VALUES (?, ?, ?, datetime('now'))`,
        [id, 'Modification Ouvriers', details],
        (err2) => {
          if (err2) {
            console.error('Erreur insertion historique:', err2);
            return res.status(200).json({ success: true, message: 'Tâche modifiée, erreur historique' });
          }
          return res.status(200).json({ success: true, message: 'Ouvriers modifiés et archivés.' });
        }
      );
    }
  );
});

app.get('/archive', (req, res) => {
  db.all("SELECT * FROM historique ORDER BY dateAction DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.get('/import-taches', (req, res) => {
  db.all("SELECT * FROM taches", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows); 
  });
});

app.get('/ouvriers', (req, res) => {
  db.all("SELECT * FROM ouvriers", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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

app.get('/historiquePause/:id', (req, res) => {
  const { id } = req.params;
  db.get("SELECT pauses FROM taches WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row || !row.pauses) return res.json([]);
    const pauses = JSON.parse(row.pauses);
    res.json(pauses.map(p => ({
      cause: p.cause || "-",
      debut: p.debut,
      fin: p.fin,
      dureeMinutes: p.fin ? ((new Date(p.fin) - new Date(p.debut)) / 60000) : 0
    })));
  });
});

app.get('/historiqueEquipe/:id', (req, res) => {
  const { id } = req.params;
  db.all(
    "SELECT details, dateAction FROM historique WHERE idTache = ? AND typeAction = 'Modification Ouvriers' ORDER BY dateAction DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const result = rows.map(r => {
        const match = r.details.match(/\[(.*?)\] → \[(.*?)\]/);
        const nouveaux = match ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [];
        return { debut: r.dateAction, fin: r.dateAction, ouvriers: nouveaux, nbreOperateurs: nouveaux.length };
      });
      res.json(result);
    }
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/login.html'));
});

app.get('/pauses', (req, res) => {
  db.all("SELECT id, nDocument, nomOperateur, pauses FROM taches WHERE pauses IS NOT NULL AND pauses != '[]'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const allPauses = [];
    rows.forEach(t => {
      let pauses = JSON.parse(t.pauses || "[]");
      pauses.forEach((p, index) => allPauses.push({
        idTache: t.id,
        nDocument: t.nDocument,
        nomOperateur: t.nomOperateur,
        cause: p.cause,
        debut: p.debut,
        fin: p.fin,
        duree: p.fin ? ((new Date(p.fin) - new Date(p.debut)) / 60000).toFixed(1) : "-",
        numeroPause: index + 1
      }));
    });
    res.json(allPauses);
  });
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
app.get('/archive', (req, res) => {
  db.all("SELECT * FROM historique ORDER BY dateAction DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.get('/tache/:id/historiqueOuvriers', (req, res) => {
  const { id } = req.params;
  db.all(
    "SELECT typeAction, details, dateAction FROM historique WHERE idTache = ? AND typeAction = 'Modification Ouvriers' ORDER BY dateAction DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.json({ message: "Aucun historique d’équipe enregistré pour cette tâche." });
      res.json(rows);
    }
  );
});


app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Serveur Node.js démarré sur http://192.168.1.193:${port}`);
});
