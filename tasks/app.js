(function () {
  "use strict";

  const STORAGE_KEY = "daily-tasks-v1";
  const RING_CIRCUMFERENCE = 213.6;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    greeting: $("#greeting"),
    selectedDate: $("#selectedDate"),
    goToday: $("#goToday"),
    prevDay: $("#prevDay"),
    nextDay: $("#nextDay"),
    progressRing: $("#progressRing"),
    progressPercent: $("#progressPercent"),
    progressLabel: $("#progressLabel"),
    progressHint: $("#progressHint"),
    addForm: $("#addForm"),
    taskInput: $("#taskInput"),
    prioritySelect: $("#prioritySelect"),
    taskList: $("#taskList"),
    clearDone: $("#clearDone"),
    taskTemplate: $("#taskTemplate"),
  };

  let selectedDate = startOfDay(new Date());
  let filter = "all";
  let store = loadStore();

  function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return startOfDay(new Date(y, m - 1, d));
  }

  function isToday(d) {
    return dateKey(d) === dateKey(new Date());
  }

  function isFuture(d) {
    return d > startOfDay(new Date());
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getTasksForDate(d) {
    const key = dateKey(d);
    if (!store[key]) store[key] = [];
    return store[key];
  }

  function greetingText() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning — let's make today count.";
    if (hour < 17) return "Good afternoon — stay on track.";
    return "Good evening — wrap up what matters.";
  }

  function formatDisplayDate(d) {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateKey(d) === dateKey(today)) return "Today";
    if (dateKey(d) === dateKey(tomorrow)) return "Tomorrow";
    if (dateKey(d) === dateKey(yesterday)) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function formatSubDate(d) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function updateDateUI() {
    const key = dateKey(selectedDate);
    els.selectedDate.textContent = formatDisplayDate(selectedDate);
    els.selectedDate.setAttribute("datetime", key);
    els.selectedDate.title = formatSubDate(selectedDate);

    const today = isToday(selectedDate);
    els.goToday.hidden = today;
    els.greeting.textContent = today
      ? greetingText()
      : `Planning for ${formatSubDate(selectedDate)}.`;

    els.nextDay.disabled = false;
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + 365);
    if (selectedDate >= startOfDay(maxFuture)) {
      els.nextDay.disabled = true;
    }
  }

  function filteredTasks(tasks) {
    if (filter === "active") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }

  function updateProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;

    els.progressRing.style.strokeDashoffset = String(offset);
    els.progressPercent.textContent = `${pct}%`;
    els.progressLabel.textContent =
      total === 0 ? "No tasks yet" : `${done} of ${total} done`;
    els.progressHint.textContent =
      total === 0
        ? "Add your first task below"
        : done === total
          ? "All done — great work!"
          : `${total - done} remaining`;
  }

  function render() {
    const tasks = getTasksForDate(selectedDate);
    const visible = filteredTasks(tasks);

    updateDateUI();
    updateProgress(tasks);

    const hasDone = tasks.some((t) => t.done);
    els.clearDone.hidden = !hasDone;

    els.taskList.innerHTML = "";

    if (visible.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.setAttribute("role", "status");
      if (tasks.length === 0) {
        empty.innerHTML = `
          <div class="empty-state-icon" aria-hidden="true">✓</div>
          <strong>No tasks for this day</strong>
          <p>Type above and hit Add to create one.</p>`;
      } else if (filter === "active") {
        empty.innerHTML = `
          <div class="empty-state-icon" aria-hidden="true">🎉</div>
          <strong>All caught up</strong>
          <p>Every task is complete.</p>`;
      } else {
        empty.innerHTML = `
          <div class="empty-state-icon" aria-hidden="true">—</div>
          <strong>No completed tasks</strong>
          <p>Finish a task to see it here.</p>`;
      }
      els.taskList.appendChild(empty);
      return;
    }

    const sorted = [...visible].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
    });

    sorted.forEach((task) => {
      const node = els.taskTemplate.content.cloneNode(true);
      const li = node.querySelector(".task-item");
      li.dataset.id = task.id;
      if (task.done) li.classList.add("done");

      const checkbox = node.querySelector(".task-checkbox");
      checkbox.checked = task.done;
      checkbox.setAttribute("aria-label", `Mark "${task.title}" as ${task.done ? "incomplete" : "complete"}`);

      node.querySelector(".task-title").textContent = task.title;
      const dot = node.querySelector(".task-priority");
      dot.dataset.priority = task.priority;
      dot.title = `${task.priority} priority`;

      els.taskList.appendChild(node);
    });
  }

  function addTask(title, priority) {
    const tasks = getTasksForDate(selectedDate);
    tasks.push({
      id: crypto.randomUUID(),
      title: title.trim(),
      priority,
      done: false,
      createdAt: Date.now(),
    });
    saveStore();
    render();
  }

  function toggleTask(id) {
    const tasks = getTasksForDate(selectedDate);
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      saveStore();
      render();
    }
  }

  function deleteTask(id, li) {
    li.classList.add("removing");
    li.addEventListener(
      "animationend",
      () => {
        const tasks = getTasksForDate(selectedDate);
        const idx = tasks.findIndex((t) => t.id === id);
        if (idx !== -1) {
          tasks.splice(idx, 1);
          saveStore();
          render();
        }
      },
      { once: true }
    );
  }

  function clearCompleted() {
    const tasks = getTasksForDate(selectedDate);
    const remaining = tasks.filter((t) => !t.done);
    store[dateKey(selectedDate)] = remaining;
    saveStore();
    render();
  }

  function setFilter(next) {
    filter = next;
    $$(".filter-btn").forEach((btn) => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    render();
  }

  function changeDay(delta) {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    selectedDate = startOfDay(next);
    render();
  }

  els.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.taskInput.value;
    if (!title.trim()) return;
    addTask(title, els.prioritySelect.value);
    els.taskInput.value = "";
    els.taskInput.focus();
  });

  els.taskList.addEventListener("change", (e) => {
    if (e.target.classList.contains("task-checkbox")) {
      const li = e.target.closest(".task-item");
      if (li) toggleTask(li.dataset.id);
    }
  });

  els.taskList.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".task-delete");
    if (deleteBtn) {
      const li = deleteBtn.closest(".task-item");
      if (li) deleteTask(li.dataset.id, li);
    }
  });

  els.clearDone.addEventListener("click", clearCompleted);

  els.prevDay.addEventListener("click", () => changeDay(-1));
  els.nextDay.addEventListener("click", () => changeDay(1));
  els.goToday.addEventListener("click", () => {
    selectedDate = startOfDay(new Date());
    render();
  });

  $$(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  document.documentElement.style.setProperty(
    "--ring-circumference",
    String(RING_CIRCUMFERENCE)
  );

  render();
  els.taskInput.focus();
})();
