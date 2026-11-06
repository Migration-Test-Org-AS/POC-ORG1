import { createTodoList } from "./todo.js";

const todos = createTodoList();
const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const error = document.querySelector("#task-error");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const count = document.querySelector("#task-count");

function updateSummary() {
  const tasks = todos.getTasks();
  const remaining = tasks.filter((task) => !task.completed).length;
  count.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
  emptyState.hidden = tasks.length > 0;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task";

  const label = document.createElement("label");
  label.className = "task-label";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  label.append(checkbox, text);

  checkbox.addEventListener("change", () => {
    const updatedTask = todos.toggle(task.id);
    item.classList.toggle("is-complete", updatedTask.completed);
    updateSummary();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete task: ${task.text}`);
  deleteButton.addEventListener("click", () => {
    const nextFocus = item.nextElementSibling?.querySelector("input")
      ?? item.previousElementSibling?.querySelector("input")
      ?? input;
    todos.remove(task.id);
    item.remove();
    updateSummary();
    nextFocus.focus();
  });

  item.append(label, deleteButton);
  return item;
}

function clearError() {
  error.hidden = true;
  error.textContent = "";
  input.removeAttribute("aria-invalid");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (input.value.trim() === "") {
    error.textContent = "Enter a task before adding it.";
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }

  const task = todos.add(input.value);
  taskList.append(createTaskElement(task));
  input.value = "";
  clearError();
  updateSummary();
  input.focus();
});

input.addEventListener("input", clearError);
updateSummary();
