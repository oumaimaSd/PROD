const API = window.location.origin;

async function chargerArchives() {
  try {
    const res = await fetch(`${API}/historique`);
    if (!res.ok) throw new Error("Erreur réseau");
    const data = await res.json();

    const tbody = document.querySelector('#tableArchive tbody');
    tbody.innerHTML = "";

    data.forEach(t => {
      const tr = document.createElement("tr");
// ✅ Lecture correcte depuis la colonne "pauses"
let dureePause = 0;
let nbPauses = 0;
try {
  const pauses = JSON.parse(t.pauses || "[]");
  nbPauses = pauses.length;
  dureePause = pauses.reduce((sum, p) => {
    if (p.debut && p.fin) {
      const diff = (new Date(p.fin) - new Date(p.debut)) / 60000; // minutes
      return sum + diff;
    }
    return sum;
  }, 0);
} catch (e) {
  console.warn("Erreur parsing pauses:", e);
}

      // ✅ Calcul période totale
      let periodeTotale = 0;
      const debut = new Date(t.dateDebut);
      const fin = new Date(t.dateFin);
      const diff = (fin - debut) / (1000 * 60); // minutes totales

      // Si pas d’historique équipe, simple calcul
      if (!t.historiqueEquipe) {
        periodeTotale = (diff - dureePause) * t.nbreOperateurs;
      } else {
        try {
          const groupes = JSON.parse(t.historiqueEquipe);
          groupes.forEach(g => {
            const d1 = new Date(g.debut);
            const d2 = new Date(g.fin || t.dateFin);
            const minutes = (d2 - d1) / (1000 * 60);
            periodeTotale += minutes * (g.nbreOperateurs || 1);
          });
          periodeTotale -= dureePause;
        } catch {}
      }

      tr.innerHTML = `
        <td>${t.numMachine || "-"}</td>
        <td>${t.nDocument}</td>
        <td>${t.nomOperateur}</td>
        <td>${t.nbreOperateurs}</td>
        <td>${t.operation}</td>
        <td>${new Date(t.dateDebut).toLocaleString()}</td>
        <td>${new Date(t.dateFin).toLocaleString()}</td>
        <td>${formatDuree(dureePause)}</td>

        <td>${t.causePause || "-"}</td>
        <td>${nbPauses}</td>
<td>${formatDuree(periodeTotale)}</td> 
       <td style="color:green;font-weight:bold">${t.status}</td>
        <td><button onclick="voirHistoriquePause(${t.id})"><i class='fa-solid fa-eye'></i></button></td>
        <td><button onclick="voirHistoriqueEquipe(${t.id})"><i class='fa-solid fa-users'></i></button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("Erreur lors du chargement des archives !");
  }
}
function formatDuree(minutesTotales) {
  const totalSeconds = Math.round(minutesTotales * 60);
  const heures = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secondes = totalSeconds % 60;
  return `${heures}h ${minutes}m ${secondes}s`;
}

async function voirHistoriquePause(id) {
  try {
    const res = await fetch(`${API}/historiquePause/${id}`);
    if (!res.ok) throw new Error("Erreur serveur");
    const data = await res.json();

    if (!data.length) {
      alert("Aucune pause enregistrée pour cette tâche.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `<h4>Historique des pauses</h4><ul></ul>`;
    const list = modal.querySelector("ul");

    data.forEach(p => {
      const li = document.createElement("li");
li.textContent = `${p.cause} — ${new Date(p.debut).toLocaleTimeString()} à ${new Date(p.fin).toLocaleTimeString()} (${formatDuree(p.dureeMinutes)})`;
      list.appendChild(li);
    });

    modal.innerHTML += `<div style="text-align:center;margin-top:10px;">
      <button onclick="this.closest('.overlay').remove()">Fermer</button>
    </div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

  } catch (err) {
    alert("Erreur lors du chargement de l’historique des pauses.");
  }
}

async function voirHistoriqueEquipe(id) {
  try {
    const res = await fetch(`${API}/historiqueEquipe/${id}`);
    if (!res.ok) throw new Error("Erreur serveur");
    const data = await res.json();

    if (!data.length) {
      alert("Aucun historique d’équipe pour cette tâche.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `<h4>Historique d'équipe</h4><ul></ul>`;
    const list = modal.querySelector("ul");

    data.forEach(g => {
      const li = document.createElement("li");
      li.textContent = `${new Date(g.debut).toLocaleString()} → ${new Date(g.fin).toLocaleString()} : ${g.ouvriers.join(", ")} (${g.nbreOperateurs} opérateurs)`;
      list.appendChild(li);
    });

    modal.innerHTML += `<div style="text-align:center;margin-top:10px;">
      <button onclick="this.closest('.overlay').remove()">Fermer</button>
    </div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

  } catch (err) {
    alert("Erreur lors du chargement de l’historique d’équipe.");
  }
}

chargerArchives();
