const scheduleSampleActivities = [
  { id: "a1", name: "Estudar Calculo", start: "08:00", end: "10:00", weight: 8 },
  { id: "a2", name: "Aula de Ingles", start: "09:00", end: "11:00", weight: 6 },
  { id: "a3", name: "Projeto PI", start: "10:30", end: "12:30", weight: 10 },
  { id: "a4", name: "Almoco", start: "12:30", end: "13:30", weight: 3 },
  { id: "a5", name: "Academia", start: "13:00", end: "14:00", weight: 4 },
  { id: "a6", name: "Revisao de Prova", start: "14:00", end: "16:00", weight: 9 },
];

const knapsackSampleItems = [
  { id: "k1", name: "Notebook", weight: 5, value: 10 },
  { id: "k2", name: "Livro", weight: 4, value: 40 },
  { id: "k3", name: "Camera", weight: 6, value: 30 },
  { id: "k4", name: "Fones", weight: 3, value: 50 },
];

const scheduleState = {
  activities: [...scheduleSampleActivities],
  result: null,
};

const knapsackState = {
  items: [...knapsackSampleItems],
  capacity: 10,
  result: null,
};

const dom = {
  scoreboardLabel: document.querySelector("#scoreboardLabel"),
  scoreboardValue: document.querySelector("#totalWeight"),
  tabButtons: [...document.querySelectorAll("[data-tab-target]")],
  tabPanels: [...document.querySelectorAll("[data-tab-panel]")],
  schedule: {
    form: document.querySelector("#activityForm"),
    list: document.querySelector("#activityList"),
    selected: document.querySelector("#selectedTimeline"),
    table: document.querySelector("#dpTable"),
    errorBox: document.querySelector("#scheduleErrorBox"),
    sampleButton: document.querySelector("#scheduleSampleButton"),
    methodStatus: document.querySelector("#scheduleMethodStatus"),
  },
  knapsack: {
    form: document.querySelector("#knapsackForm"),
    list: document.querySelector("#knapsackList"),
    selected: document.querySelector("#knapsackSelected"),
    tableHead: document.querySelector("#knapsackTableHead"),
    tableBody: document.querySelector("#knapsackTableBody"),
    errorBox: document.querySelector("#knapsackErrorBox"),
    sampleButton: document.querySelector("#knapsackSampleButton"),
    methodStatus: document.querySelector("#knapsackMethodStatus"),
    totalValue: document.querySelector("#knapsackTotalValue"),
    totalWeight: document.querySelector("#knapsackTotalWeight"),
    capacityInput: document.querySelector("#capacityInput"),
  },
};

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(errorBox, message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!bodyText) {
    return {};
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(bodyText);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    if (bodyText.trimStart().startsWith("<!DOCTYPE") || bodyText.trimStart().startsWith("<html")) {
      throw new Error(
        "A API respondeu uma pagina HTML. Reinicie o servidor para carregar a rota nova ou verifique se a URL esta correta.",
      );
    }

    throw new Error(bodyText.trim() || "Resposta invalida da API.");
  }
}

function setScoreboard(label, value) {
  dom.scoreboardLabel.textContent = label;
  dom.scoreboardValue.textContent = value;
}

function isTabActive(tabName) {
  return dom.tabButtons.some((button) => button.dataset.tabTarget === tabName && button.classList.contains("is-active"));
}

function setActiveTab(tabName) {
  dom.tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  dom.tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });

  if (tabName === "schedule") {
    updateScheduleScoreboard();
  } else {
    updateKnapsackScoreboard();
  }
}

function renderScheduleActivities() {
  if (scheduleState.activities.length === 0) {
    dom.schedule.list.innerHTML = '<div class="empty-state">Nenhuma atividade cadastrada.</div>';
    return;
  }

  dom.schedule.list.innerHTML = scheduleState.activities
    .map(
      (activity) => `
        <article class="activity-item">
          <div class="activity-main">
            <strong>${escapeHtml(activity.name)}</strong>
            <div class="meta">${activity.start} - ${activity.end} · peso ${activity.weight}</div>
          </div>
          <button class="delete-button" type="button" data-remove-schedule="${activity.id}">Remover</button>
        </article>
      `,
    )
    .join("");
}

function renderScheduleSelected(selected) {
  if (!selected.length) {
    dom.schedule.selected.className = "timeline empty-state";
    dom.schedule.selected.textContent = "Nenhuma atividade selecionada.";
    return;
  }

  dom.schedule.selected.className = "timeline";
  dom.schedule.selected.innerHTML = selected
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

function renderScheduleTable(rows) {
  if (!rows.length) {
    dom.schedule.table.innerHTML = '<tr><td colspan="6">Nenhum cálculo executado.</td></tr>';
    return;
  }

  dom.schedule.table.innerHTML = rows
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

function updateScheduleScoreboard() {
  if (!isTabActive("schedule")) {
    return;
  }

  setScoreboard("Peso ótimo", scheduleState.result?.iterative?.totalWeight ?? 0);
}

async function optimizeSchedule() {
  if (scheduleState.activities.length === 0) {
    scheduleState.result = null;
    updateScheduleScoreboard();
    dom.schedule.methodStatus.textContent = "Iterativo e recursivo";
    renderScheduleSelected([]);
    renderScheduleTable([]);
    return;
  }

  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activities: scheduleState.activities }),
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel calcular.");
    }

    scheduleState.result = data;
    setError(dom.schedule.errorBox, "");
    updateScheduleScoreboard();
    dom.schedule.methodStatus.textContent = data.sameResult
      ? "Resultado igual nas versões iterativa e recursiva"
      : "Os métodos retornaram resultados diferentes";
    renderScheduleSelected(data.iterative.selected);
    renderScheduleTable(data.iterative.dpTable);
  } catch (error) {
    setError(dom.schedule.errorBox, error.message);
  }
}

function renderKnapsackItems() {
  if (knapsackState.items.length === 0) {
    dom.knapsack.list.innerHTML = '<div class="empty-state">Nenhum item cadastrado.</div>';
    return;
  }

  dom.knapsack.list.innerHTML = knapsackState.items
    .map(
      (item) => `
        <article class="activity-item">
          <div class="activity-main">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">peso ${item.weight} · valor ${item.value}</div>
          </div>
          <button class="delete-button" type="button" data-remove-knapsack="${item.id}">Remover</button>
        </article>
      `,
    )
    .join("");
}

function renderKnapsackSelected(selected) {
  if (!selected.length) {
    dom.knapsack.selected.className = "timeline empty-state";
    dom.knapsack.selected.textContent = "Nenhum item selecionado.";
    return;
  }

  dom.knapsack.selected.className = "timeline";
  dom.knapsack.selected.innerHTML = selected
    .map(
      (item) => `
        <article class="timeline-item">
          <div class="timeline-main">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">peso ${item.weight} · valor ${item.value}</div>
          </div>
          <div class="timeline-weight">${item.value}</div>
        </article>
      `,
    )
    .join("");
}

function renderKnapsackTable(rows, capacity) {
  if (!rows.length) {
    dom.knapsack.tableHead.innerHTML = `
      <tr>
        <th>i</th>
        <th>Item</th>
        <th>Peso</th>
        <th>Valor</th>
        <th>0</th>
      </tr>
    `;
    dom.knapsack.tableBody.innerHTML = '<tr><td colspan="5">Nenhum cálculo executado.</td></tr>';
    return;
  }

  dom.knapsack.tableHead.innerHTML = `
    <tr>
      <th>i</th>
      <th>Item</th>
      <th>Peso</th>
      <th>Valor</th>
      ${Array.from({ length: capacity + 1 }, (_, index) => `<th>${index}</th>`).join("")}
    </tr>
  `;

  dom.knapsack.tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.i}</td>
          <td>${escapeHtml(row.item)}</td>
          <td>${row.weight}</td>
          <td>${row.value}</td>
          ${row.values.map((value) => `<td>${value}</td>`).join("")}
        </tr>
      `,
    )
    .join("");
}

function updateKnapsackScoreboard() {
  if (!isTabActive("knapsack")) {
    dom.knapsack.totalValue.textContent = knapsackState.result?.iterative?.totalValue ?? 0;
    dom.knapsack.totalWeight.textContent = knapsackState.result?.iterative?.totalWeight ?? 0;
    return;
  }

  setScoreboard("Valor ótimo", knapsackState.result?.iterative?.totalValue ?? 0);
  dom.knapsack.totalValue.textContent = knapsackState.result?.iterative?.totalValue ?? 0;
  dom.knapsack.totalWeight.textContent = knapsackState.result?.iterative?.totalWeight ?? 0;
}

async function optimizeKnapsack() {
  if (knapsackState.items.length === 0) {
    knapsackState.result = null;
    updateKnapsackScoreboard();
    dom.knapsack.methodStatus.textContent = "Programação dinâmica iterativa";
    renderKnapsackSelected([]);
    renderKnapsackTable([], knapsackState.capacity);
    return;
  }

  try {
    const response = await fetch("/api/knapsack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capacity: knapsackState.capacity,
        items: knapsackState.items,
      }),
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel calcular.");
    }

    knapsackState.result = data;
    setError(dom.knapsack.errorBox, "");
    updateKnapsackScoreboard();
    dom.knapsack.methodStatus.textContent = "Programação dinâmica iterativa";
    renderKnapsackSelected(data.iterative.selected);
    renderKnapsackTable(data.iterative.dpTable, data.capacity);
  } catch (error) {
    setError(dom.knapsack.errorBox, error.message);
  }
}

function syncKnapsackCapacityFromInput() {
  const value = Number(dom.knapsack.capacityInput.value);
  knapsackState.capacity = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

dom.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tabTarget);
  });
});

dom.schedule.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dom.schedule.form);
  const activity = {
    id: nextId("schedule"),
    name: String(formData.get("name")).trim(),
    start: String(formData.get("start")),
    end: String(formData.get("end")),
    weight: Number(formData.get("weight")),
  };

  scheduleState.activities.push(activity);
  dom.schedule.form.reset();
  document.querySelector("#weightInput").value = 5;
  renderScheduleActivities();
  optimizeSchedule();
});

dom.schedule.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-schedule]");
  if (!button) {
    return;
  }

  scheduleState.activities = scheduleState.activities.filter(
    (activity) => activity.id !== button.dataset.removeSchedule,
  );
  renderScheduleActivities();
  optimizeSchedule();
});

dom.schedule.sampleButton.addEventListener("click", () => {
  scheduleState.activities = [...scheduleSampleActivities];
  renderScheduleActivities();
  optimizeSchedule();
});

dom.knapsack.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dom.knapsack.form);
  syncKnapsackCapacityFromInput();
  const item = {
    id: nextId("knapsack"),
    name: String(formData.get("name")).trim(),
    weight: Number(formData.get("weight")),
    value: Number(formData.get("value")),
  };

  knapsackState.items.push(item);
  dom.knapsack.form.reset();
  dom.knapsack.capacityInput.value = String(knapsackState.capacity || 10);
  document.querySelector("#itemWeightInput").value = 1;
  document.querySelector("#itemValueInput").value = 1;
  renderKnapsackItems();
  optimizeKnapsack();
});

dom.knapsack.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-knapsack]");
  if (!button) {
    return;
  }

  knapsackState.items = knapsackState.items.filter((item) => item.id !== button.dataset.removeKnapsack);
  renderKnapsackItems();
  optimizeKnapsack();
});

dom.knapsack.sampleButton.addEventListener("click", () => {
  knapsackState.items = [...knapsackSampleItems];
  knapsackState.capacity = 10;
  dom.knapsack.capacityInput.value = "10";
  renderKnapsackItems();
  optimizeKnapsack();
});

dom.knapsack.capacityInput.addEventListener("input", () => {
  syncKnapsackCapacityFromInput();
  if (knapsackState.capacity > 0) {
    optimizeKnapsack();
  }
});

renderScheduleActivities();
renderKnapsackItems();
setActiveTab("schedule");
optimizeSchedule();
optimizeKnapsack();
