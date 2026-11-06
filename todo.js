export function createTodoList() {
  const tasks = [];
  let nextId = 1;

  return {
    add(text) {
      if (typeof text !== "string" || text.trim() === "") {
        throw new TypeError("Enter a task before adding it.");
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
