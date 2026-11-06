export function createTodoList(initialTasks = []) {
  if (!Array.isArray(initialTasks)) {
    throw new TypeError("Saved tasks must be a list.");
  }

  const ids = new Set();
  for (const task of initialTasks) {
    if (!task || !Number.isSafeInteger(task.id) || task.id < 1
      || ids.has(task.id) || typeof task.text !== "string"
      || task.text.trim() === "" || task.text !== task.text.trim()
      || typeof task.completed !== "boolean") {
      throw new TypeError("Saved tasks are invalid. Stored data was not changed.");
    }
    ids.add(task.id);
  }

  const tasks = initialTasks.map((task) => ({ ...task }));
  let nextId = tasks.reduce((largest, task) => Math.max(largest, task.id), 0) + 1;

  return {
    add(text) {
      if (typeof text !== "string" || text.trim() === "") {
        throw new TypeError("Enter a task before adding it.");
      }
      if (!Number.isSafeInteger(nextId)) {
        throw new RangeError("The task ID limit has been reached.");
      }

      const task = { id: nextId++, text: text.trim(), completed: false };
      tasks.push(task);
      return { ...task };
    },

    toggle(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        throw new RangeError("Task not found.");
      }

      task.completed = !task.completed;
      return { ...task };
    },

    remove(id) {
      const index = tasks.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new RangeError("Task not found.");
      }

      return { ...tasks.splice(index, 1)[0] };
    },

    getTasks() {
      return tasks.map((task) => ({ ...task }));
    },
  };
}
