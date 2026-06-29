const sampleActivities = [
  { id: "a1", name: "Estudar Calculo", start: "08:00", end: "10:00", weight: 8 },
  { id: "a2", name: "Aula de Ingles", start: "09:00", end: "11:00", weight: 6 },
  { id: "a3", name: "Projeto PI", start: "10:30", end: "12:30", weight: 10 },
  { id: "a4", name: "Almoco", start: "12:30", end: "13:30", weight: 3 },
  { id: "a5", name: "Academia", start: "13:00", end: "14:00", weight: 4 },
  { id: "a6", name: "Revisao de Prova", start: "14:00", end: "16:00", weight: 9 },
];

let activities = [...sampleActivities];

const form = document.querySelector("#activityForm");
const list = document.querySelector("#activityList");
const selectedTimeline = document.querySelector("#selectedTimeline");
const dpTable = document.querySelector("#dpTable");
const totalWeight = document.querySelector("#totalWeight");
const errorBox = document.querySelector("#errorBox");
const sampleButton = document.querySelector("#sampleButton");
const methodStatus = document.querySelector("#methodStatus");

function nextId() {
  return `a${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
}

function renderActivities() {
  if (activities.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma atividade cadastrada.</div>';
    return;
  }

  list.innerHTML = activities
    .map(
      (activity) => `
        <article class="activity-item">
          <div class="activity-main">
            <strong>${escapeHtml(activity.name)}</strong>
            <div class="meta">${activity.start} - ${activity.end} · peso ${activity.weight}</div>
          </div>
          <button class="delete-button" type="button" data-remove="${activity.id}">Remover</button>
        </article>
      `,
    )
    .join("");
}

function renderSelected(selected) {
  if (!selected.length) {
    selectedTimeline.className = "timeline empty-state";
    selectedTimeline.textContent = "Nenhuma atividade selecionada.";
    return;
  }

  selectedTimeline.className = "timeline";
  selectedTimeline.innerHTML = selected
    .map(
      (activity) => `
        <article class="timeline-item">
          <div class="timeline-main">
            <strong>${escapeHtml(activity.name)}</strong>
            <div class="meta">${activity.start} - ${activity.end}</div>
          </div>
          <div class="timeline-weight">${activity.weight}</div>
        </article>
      `,
    )
    .join("");
}

function renderTable(rows) {
  if (!rows.length) {
    dpTable.innerHTML = '<tr><td colspan="6">Nenhum cálculo executado.</td></tr>';
    return;
  }

  dpTable.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.i}</td>
          <td>${escapeHtml(row.activity)}</td>
          <td>${row.previousCompatible}</td>
          <td>${row.include}</td>
          <td>${row.exclude}</td>
          <td><strong>${row.best}</strong></td>
        </tr>
      `,
    )
    .join("");
}

async function optimize() {
  if (activities.length === 0) {
    totalWeight.textContent = "0";
    methodStatus.textContent = "Iterativo e recursivo";
    renderSelected([]);
    renderTable([]);
    return;
  }

  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activities }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel calcular.");
    }

    setError("");
    totalWeight.textContent = data.iterative.totalWeight;
    methodStatus.textContent = data.sameResult
      ? "Resultado igual nas versões iterativa e recursiva"
      : "Os métodos retornaram resultados diferentes";
    renderSelected(data.iterative.selected);
    renderTable(data.iterative.dpTable);
  } catch (error) {
    setError(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const activity = {
    id: nextId(),
    name: String(formData.get("name")).trim(),
    start: String(formData.get("start")),
    end: String(formData.get("end")),
    weight: Number(formData.get("weight")),
  };

  activities.push(activity);
  form.reset();
  document.querySelector("#weightInput").value = 5;
  renderActivities();
  optimize();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) {
    return;
  }

  activities = activities.filter((activity) => activity.id !== button.dataset.remove);
  renderActivities();
  optimize();
});

sampleButton.addEventListener("click", () => {
  activities = [...sampleActivities];
  renderActivities();
  optimize();
});

renderActivities();
optimize();
