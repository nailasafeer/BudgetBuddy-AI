function renderSummary() {
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  document.getElementById("total-saved").textContent = money(totalSaved);
  document.getElementById("total-target").textContent = money(totalTarget);
  document.getElementById("goal-count").textContent = goals.length;
}

function renderGoals() {
  const row = document.getElementById("goals-row");
  const addCard = document.getElementById("add-goal-card");

  row.querySelectorAll(".goal-card").forEach(el => el.remove());

  goals.forEach((goal, i) => {
    const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
    const color = GOAL_COLORS[i % GOAL_COLORS.length];

    const card = document.createElement("div");
    card.className = "goal-card";
    card.dataset.id = goal.id;
    card.innerHTML = `
      <div class="goal-ring" style="background: conic-gradient(${color} ${pct * 3.6}deg, #F0E4D4 0deg);">
        <div style="background:#fff; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          ${pct}%
        </div>
      </div>
      <div class="goal-name">${goal.name}</div>
      <div class="goal-amounts">${money(goal.saved)} / ${money(goal.target)}</div>
      <div class="goal-actions">
        <button class="icon-btn add-funds" title="Add funds">➕ Add</button>
        <button class="icon-btn delete-goal" title="Delete goal">🗑️</button>
      </div>
    `;
    row.insertBefore(card, addCard);
  });

  row.querySelectorAll(".add-funds").forEach(btn => {
    btn.addEventListener("click", (e) => addFunds(e.target.closest(".goal-card").dataset.id));
  });
  row.querySelectorAll(".delete-goal").forEach(btn => {
    btn.addEventListener("click", (e) => deleteGoal(e.target.closest(".goal-card").dataset.id));
  });
}

function renderAll() {
  renderSummary();
  renderGoals();
}

// ---------- Add funds to an existing goal ----------
let selectedGoalId = null;

function addFunds(id) {
  const goal = goals.find(goal => goal.id == id);

  if (!goal) return;

  selectedGoalId = id;

  document.getElementById("fund-goal-name").textContent =
    `Add money to "${goal.name}"`;

  document.getElementById("fund-amount").value = "";

  document
    .getElementById("fund-modal")
    .classList.remove("hidden");

  document.getElementById("fund-amount").focus();
}

function closeFundModal() {
  selectedGoalId = null;

  document
    .getElementById("fund-modal")
    .classList.add("hidden");
}

document
  .getElementById("cancel-fund")
  .addEventListener("click", closeFundModal);

document
  .getElementById("confirm-fund")
  .addEventListener("click", async () => {
    const goal = goals.find(goal => goal.id == selectedGoalId);

    const amount = Number(
      document.getElementById("fund-amount").value
    );

    if (!goal || !amount || amount <= 0) {
      showToast("Enter a valid amount.", "error");
      return;
    }

    const button = document.getElementById("confirm-fund");
    button.disabled = true;

    try {
      const response = await fetch(
        `${API_BASE}/api/goals/${goal.id}/progress`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            amount: amount
          })
        }
      );

      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        throw new Error(
          `Backend route error (${response.status}). Check PUT /api/goals/${goal.id}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || data.msg || "Could not add savings"
        );
      }

      goal.saved = Number(
        data.goal?.current_saved ??
        data.current_saved ??
        goal.saved + amount
      );

      closeFundModal();
      renderAll();
      showToast("Savings added successfully.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

// ---------- Delete a goal ----------
async function deleteGoal(id) {
  const goal = goals.find(g => g.id == id);
  if (!goal) return;

  try {
    await fetch(`${API_BASE}/api/goals/${id}`, { method: "DELETE", headers: authHeaders() });
  } catch (err) {
    console.warn("Backend not reachable — removing locally only.", err);
  }
  goals = goals.filter(g => g.id != id);
  renderAll();
}

// ---------- Panel toggle ----------
function showPanel(show) {
  document.getElementById("goal-panel").classList.toggle("hidden", !show);
}

document.getElementById("add-goal-trigger").addEventListener("click", () => showPanel(true));
document.getElementById("add-goal-card").addEventListener("click", () => showPanel(true));
document.getElementById("cancel-goal").addEventListener("click", () => showPanel(false));

// ---------- Create Goal ----------
document.getElementById("goal-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById("goal-name").value.trim(),
    target_amount: Number(
      document.getElementById("goal-target").value
    ),
    deadline: document.getElementById("goal-deadline").value
  };

  try {
    const response = await fetch(
      `${API_BASE}/api/goals`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (response.status === 401 || response.status === 422) {
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      showToast((data.error || data.msg || "Could not create goal"));
      return;
    }

    e.target.reset();
    showPanel(false);

    await loadGoals();
    renderAll();

    showToast((data.message || "Goal created successfully"));
  } catch (error) {
    console.error(error);
    showToast(("Cannot connect to the backend server."));
  }
});

// ---------- Init ----------
(async function init() {
  await loadGoals();
  renderAll();
})();