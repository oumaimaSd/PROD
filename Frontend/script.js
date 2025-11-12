const API = "http://192.168.1.250:4800";


async function ajouterTache() {
  const nDocument = document.getElementById('nDocument').value.trim();

  const selectOuvriers = document.getElementById('nomOperateur');
  const nomOperateur = Array.from(selectOuvriers.selectedOptions).map(o => o.value);
  if (nomOperateur.length === 0) {
    alert("Veuillez sélectionner au moins un ouvrier !");
    return;
  }

  const nbreOperateurs = parseInt(document.getElementById('nbreOperateurs').value);
  const operation = document.getElementById('operation').value;
  const numMachine = document.getElementById('numMachine').value;

  if (!nDocument || !nbreOperateurs || !operation ) {
    alert("Veuillez remplir tous les champs !");
    return;
  }

  try {
    const res = await fetch(`${API}/tache/debut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nDocument,
        nomOperateur: JSON.stringify(nomOperateur),
        nbreOperateurs,
        operation,
        numMachine
      })
    });

    if (!res.ok) throw new Error('Erreur serveur');
    const data = await res.json();
    console.log('✅ Tâche ajoutée', data);

    viderFormulaire();
    setTimeout(afficherEnCours, 500); 
  } catch (err) {
    alert("❌ Erreur lors de l’ajout : " + err.message);
  }
}

function viderFormulaire() {
  document.getElementById('nDocument').value = '';
  document.getElementById('nomOperateur').selectedIndex = -1;
  document.getElementById('nbreOperateurs').value = '';
  document.getElementById('operation').value = '';
  document.getElementById('numMachine').value = '';
}


async function chargerOuvriers() {
  const res = await fetch(`${API}/ouvriers`);
  const ouvriers = await res.json();
  const select = document.getElementById('nomOperateur');
  select.innerHTML = '';

  ouvriers.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.nom;
    opt.textContent = o.nom;
    select.appendChild(opt);
  });

  new Choices(select, {
    removeItemButton: true,
    placeholderValue: '--Choisir Ouvrier--',
    searchEnabled: true
  });
}

chargerOuvriers();


async function afficherEnCours() {
  const res = await fetch(`${API}/enCours`);
  const data = await res.json();
  const tbody = document.querySelector('#tableEnCours tbody');
  tbody.innerHTML = '';

  data.forEach(t => {
    const tr = document.createElement('tr');
    const statusColor = t.status === 'PAUSE' ? 'red' : 'green';
    let ouvriersList = [];

    try {
      ouvriersList = JSON.parse(t.nomOperateur);
    } catch {
      ouvriersList = [t.nomOperateur];
    }

    tr.innerHTML = `
      <td><input type="checkbox" class="selectTache" data-id="${t.id}"></td>
      <td>${t.nDocument}</td>
      <td>${ouvriersList.join(', ')}</td>
        <td>
      <button onclick="voirHistoriqueOuvriers(${t.id})" style="background:#6c5ce7;border:none;color:white;border-radius:6px;padding:5px 10px;cursor:pointer;">
        <i class="fa-solid fa-eye"></i>
      </button>
    </td>
      <td>${t.nbreOperateurs}</td>

      <td>${t.operation}</td>
      <td>${t.numMachine}</td>
      <td>${new Date(t.dateDebut).toLocaleString()}</td>
      <td>
        ${t.status === 'PAUSE'
          ? `<button style="background:orange" onclick="reprendreTache(${t.id})">Reprendre</button>`
          : `<button style="background:red" onclick="pauseTache(${t.id})">Pause</button>`}
      </td>
      <td>${t.causePause && t.causePause.trim() !== "" ? t.causePause : '-'}</td>
      <td><button style="background:gray" onclick="finTache(${t.id})">Fin</button></td>
      <td style="color:${statusColor}; font-weight:bold">${t.status}</td>
      <td>
<button style="background:#00b894; color:white; border:none; border-radius:8px; padding:8px 12px; cursor:pointer;" onclick="modifierOuvriers(${t.id})" title="Modifier Ouvriers">
  <i class="fa-solid fa-pen-to-square"></i>
</button>
</td>

    `;
    tbody.appendChild(tr);
  });
}


async function pauseTache(id) {
  const causes = [
    "Panne machine",
    "Attente matière",
    "Réglage",
    "Pause repas",
    "Contrôle qualité",
    "Pause Cigarette",
    "Pause Toilette",
   "défaut tissage",
    "Autre"
  ];

  let cause = prompt(
    "Choisissez la cause de la pause :\n\n" +
    causes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
    "\n\nEntrez le numéro correspondant :"
  );

  if (!cause) return alert("Pause annulée.");
  const choix = parseInt(cause);

  if (isNaN(choix) || choix < 1 || choix > causes.length) {
    alert("Choix invalide !");
    return;
  }

  if (causes[choix - 1] === "Autre") {
    cause = prompt("Entrez la cause de la pause :");
    if (!cause || cause.trim() === "") {
      alert("Cause obligatoire !");
      return;
    }
  } else {
    cause = causes[choix - 1];
  }

  await fetch(`${API}/tache/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, cause })
  });

  afficherEnCours();
}

async function reprendreTache(id) {
  await fetch(`${API}/tache/reprendre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  afficherEnCours();
}


async function finTache(id) {


  const res = await fetch(`${API}/enCours`);
  const data = await res.json();
  const t = data.find(x => x.id === id);

  await fetch(`${API}/tache/fin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      nbreOperateurs: t.nbreOperateurs,
      dateDebut: t.dateDebut,
      dureePause: t.dureePause,
      numMachine: t.numMachine
    })
  });

  afficherEnCours();
}


function filterEnCours() {
  const docValue = document.getElementById('filterDoc').value.toLowerCase().trim();
  const ouvValue = document.getElementById('filterOuvrier').value.toLowerCase().trim();
  const opValue = document.getElementById('filterOp').value.toLowerCase().trim();
  const dateValue = document.getElementById('filterdate').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#tableEnCours tbody tr');

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 0) {
      const nDoc = cells[1].innerText.toLowerCase();
      const nomOuv = cells[2].innerText.toLowerCase();
      const operation = cells[4].innerText.toLowerCase();
      const date = cells[6].innerText.toLowerCase();

      const matchDoc = nDoc.includes(docValue);
      const matchOuv = nomOuv.includes(ouvValue);
      const matchOp = operation.includes(opValue);
      const matchDate = date.includes(dateValue);

      if (
        (docValue === "" || matchDoc) &&
        (ouvValue === "" || matchOuv) &&
        (opValue === "" || matchOp) &&
        (dateValue === "" || matchDate)
      ) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    }
  });
}

function toggleAll(source) {
  const checkboxes = document.querySelectorAll('.selectTache');
  checkboxes.forEach(cb => cb.checked = source.checked);
}

function selectAllTaches() {
  const checkboxes = document.querySelectorAll('.selectTache');
  checkboxes.forEach(cb => cb.checked = true);
}

async function pauseUsine() {
  const selected = Array.from(document.querySelectorAll('.selectTache:checked'));
  if (selected.length === 0) {
    alert("Aucune tâche sélectionnée !");
    return;
  }

  if (!confirm(`Mettre ${selected.length} tâche(s) en pause usine ?`)) return;

  for (const cb of selected) {
    const id = cb.dataset.id;
    await fetch(`${API}/tache/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cause: "Pause usine" })
    });
  }

  alert("✅ Toutes les tâches sélectionnées sont mises en pause (cause : Pause usine)");
  afficherEnCours();
}
// ──────────────────────────────
// 👷 MODIFIER LES OUVRIERS EN COURS
// ──────────────────────────────
async function modifierOuvriers(id) {
  // Récupérer la tâche concernée
  const res = await fetch(`${API}/enCours`);
  const data = await res.json();
  const tache = data.find(t => t.id === id);
  if (!tache) return alert("Tâche introuvable !");

  // Lister les ouvriers actuels
  let anciensOuvriers = [];
  try {
    anciensOuvriers = JSON.parse(tache.nomOperateur);
  } catch {
    anciensOuvriers = [tache.nomOperateur];
  }

  // Demander la nouvelle liste d’ouvriers
  const nouveauTexte = prompt(
    `Ouvriers actuels : ${anciensOuvriers.join(', ')}\n\nEntrez les nouveaux ouvriers (séparés par une virgule) :`
  );
  if (!nouveauTexte) return alert("Modification annulée.");

  const nouveauxOuvriers = nouveauTexte.split(',').map(n => n.trim()).filter(Boolean);
  if (nouveauxOuvriers.length === 0) return alert("Liste invalide.");

  // Envoi au backend
  await fetch(`${API}/tache/modifierOuvriers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      anciensOuvriers,
      nouveauxOuvriers
    })
  });

  alert("✅ Ouvriers mis à jour !");
  afficherEnCours();
}
async function voirHistoriqueOuvriers(id) {
  try {
    const res = await fetch(`${API}/tache/${id}/historiqueOuvriers`);
    const data = await res.json();

    let html = "<h3>Historique des équipes</h3>";

    if (data.message) {
      html += `<p>${data.message}</p>`;
    } else {
      data.forEach(item => {
        html += `
          <div style="margin-bottom:10px; padding:8px; border-bottom:1px solid #ccc;">
            <p><strong>Date :</strong> ${item.dateAction}</p>
            <p><strong>Détails :</strong> ${item.details}</p>
          </div>
        `;
      });
    }

    const popup = window.open("", "Historique", "width=500,height=400,scrollbars=yes");
    popup.document.write(`<html><head><title>Historique</title></head><body>${html}</body></html>`);
  } catch (err) {
    console.error("Erreur lors du chargement de l’historique :", err);
    alert("Erreur lors du chargement de l’historique.");
  }
}

// === FONCTION MODIFICATION OUVRIERS AVEC PAUSE AUTO PUIS REPRISE AUTOMATIQUE ===
async function modifierOuvriers(id) {
  // 1️⃣ Pause automatique avant modification
  await fetch(`${API}/tache/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, cause: "Changement équipe" })
  });

  // 2️⃣ Récupérer la tâche après mise en pause
  const resTaches = await fetch(`${API}/enCours`);
  const data = await resTaches.json();
  const tache = data.find(t => t.id === id);
  if (!tache) return alert("Tâche introuvable !");

  let anciensOuvriers = [];
  try {
    anciensOuvriers = JSON.parse(tache.nomOperateur);
  } catch {
    anciensOuvriers = [tache.nomOperateur];
  }

  // 3️⃣ Récupération liste ouvriers disponibles
  const resOuv = await fetch(`${API}/ouvriers`);
  const ouvriers = await resOuv.json();

  // 4️⃣ Création de la modale
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>Changement d'équipe</h3>
    <p style="font-size:14px;color:#971010;margin-bottom:10px;">
      La tâche est mise en pause (cause : Changement équipe)
    </p>
    <div class="ouvrier-list"></div>
    <div style="text-align:right;margin-top:10px;">
      <button id="annulerModif">Annuler</button>
      <button id="validerModif">Valider</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 5️⃣ Liste d'ouvriers à cocher
  const list = modal.querySelector(".ouvrier-list");
  ouvriers.forEach(o => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>
        <input type="checkbox" value="${o.nom}" ${anciensOuvriers.includes(o.nom) ? "checked" : ""}>
        ${o.nom}
      </label>
    `;
    list.appendChild(div);
  });

  // 6️⃣ Bouton Annuler
  modal.querySelector("#annulerModif").onclick = () => overlay.remove();

  // 7️⃣ Bouton Valider → Met à jour ouvriers + relance tâche
  modal.querySelector("#validerModif").onclick = async () => {
    const nouveauxOuvriers = Array.from(list.querySelectorAll("input:checked")).map(i => i.value);
    if (nouveauxOuvriers.length === 0) return alert("Veuillez sélectionner au moins un ouvrier.");

    const nbreOperateurs = nouveauxOuvriers.length;

    // ➤ Mise à jour des ouvriers
    await fetch(`${API}/tache/modifierOuvriers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, anciensOuvriers, nouveauxOuvriers, nbreOperateurs })
    });

    // ➤ Reprise automatique (statut = EN COURS)
    await fetch(`${API}/tache/reprendre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    overlay.remove();
    alert("✅ Équipe modifiée et tâche reprise !");
    afficherEnCours();
  };

  // === HISTORIQUE DES TÂCHES ===
async function afficherHistorique() {
  try {
    const res = await fetch(`${API}/historique`);
    if (!res.ok) throw new Error("Erreur serveur");
    const data = await res.json();
    remplirTableau(data);
  } catch (err) {
    console.error("Erreur chargement historique :", err);
  }
}

function remplirTableau(data) {
  const tbody = document.querySelector("#historiqueTable tbody");
  if (!tbody) return; // Sécurité
  tbody.innerHTML = "";

  data.forEach(t => {
    const hist = JSON.parse(t.historiqueOuvriers || "[]");
    const allOuvriers = hist.flatMap(h => Array.isArray(h) ? h : [h.nom || h]);
    const row = `
      <tr>
        <td>${t.id}</td>
        <td>${t.nDocument}</td>
        <td>${allOuvriers.join(", ")}</td>
        <td>${t.nbreOperateurs}</td>
        <td>${t.operation}</td>
        <td>${t.numMachine}</td>
        <td>${new Date(t.dateDebut).toLocaleString()}</td>
        <td>${new Date(t.dateFin).toLocaleString()}</td>
        <td>${t.dureeTotale || "-"}</td>
        <td>${t.dureePause || "-"}</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

if (window.location.pathname.includes("historique.html")) {
  afficherHistorique();
}

  // 8️⃣ Rafraîchir l'affichage (statut pause temporaire)
  afficherEnCours();
}

const style = document.createElement("style");
style.textContent = `
.overlay {
  position: fixed;
  top:0;left:0;width:100%;height:100%;
  background:rgba(0,0,0,0.4);
  display:flex;
  justify-content:center;
  align-items:center;
  z-index:1000;
}
.modal {
  background:#fff;
  padding:20px;
  border-radius:10px;
  box-shadow:0 0 10px rgba(0,0,0,0.3);
  width:300px;
}
.modal h3 {
  text-align:center;
  color:#971010;
}
.ouvrier-list {
  max-height:200px;
  overflow:auto;
  margin-top:10px;
  border:1px solid #ccc;
  padding:5px;
}
`;
document.head.appendChild(style);

afficherEnCours();   