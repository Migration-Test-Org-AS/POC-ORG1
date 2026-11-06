import test from "node:test";
import assert from "node:assert/strict";
import { createTodoList } from "../todo.js";

test("a new todo list is empty", () => {
  assert.deepEqual(createTodoList().getTasks(), []);
});

test("adding a task trims text and creates an incomplete task", () => {
  const todos = createTodoList();
  const task = todos.add("  Buy groceries  ");
  assert.deepEqual(task, { id: 1, text: "Buy groceries", completed: false });
  assert.deepEqual(todos.getTasks(), [task]);
});

test("blank and non-string tasks are rejected without changing state", () => {
  const todos = createTodoList();
  for (const text of ["", "   ", "\t\r\n", null, undefined, 42]) {
    assert.throws(() => todos.add(text), TypeError);
  }
  assert.deepEqual(todos.getTasks(), []);
  assert.equal(todos.add("Valid task").id, 1);
});

test("duplicate task text gets separate IDs and independent completion", () => {
  const todos = createTodoList();
  const first = todos.add("Read");
  const second = todos.add("Read");
  assert.notEqual(first.id, second.id);
  todos.toggle(first.id);
  assert.deepEqual(todos.getTasks().map((task) => task.completed), [true, false]);
});

test("toggling twice restores the original completion state", () => {
  const todos = createTodoList();
  const task = todos.add("Take a walk");
  assert.equal(todos.toggle(task.id).completed, true);
  assert.equal(todos.toggle(task.id).completed, false);
  assert.deepEqual(todos.getTasks(), [task]);
});

test("deleting a task preserves the others and their order", () => {
  const todos = createTodoList();
  const first = todos.add("First");
  const second = todos.add("Second");
  const third = todos.add("Third");
  assert.deepEqual(todos.remove(second.id), second);
  assert.deepEqual(todos.getTasks(), [first, third]);
});

test("deleting the last task restores an empty list without reusing IDs", () => {
  const todos = createTodoList();
  const task = todos.add("One task");
  todos.remove(task.id);
  assert.deepEqual(todos.getTasks(), []);
  assert.notEqual(todos.add("Another task").id, task.id);
});

test("returned tasks and snapshots cannot mutate stored state", () => {
  const todos = createTodoList();
  const added = todos.add("Original");
  added.text = "Changed";
  const toggled = todos.toggle(added.id);
  toggled.completed = false;
  const snapshot = todos.getTasks();
  snapshot[0].text = "Changed again";
  snapshot.push({ id: 99, text: "Injected", completed: false });
  assert.deepEqual(todos.getTasks(), [
    { id: 1, text: "Original", completed: true },
  ]);
});

test("unknown IDs report errors and leave existing tasks unchanged", () => {
  const todos = createTodoList();
  const task = todos.add("Keep this");
  for (const id of [0, 99, "1", null, undefined]) {
    assert.throws(() => todos.toggle(id), RangeError);
    assert.throws(() => todos.remove(id), RangeError);
  }
  assert.deepEqual(todos.getTasks(), [task]);
});

test("separate lists do not share state", () => {
  const first = createTodoList();
  const second = createTodoList();
  first.add("Only in the first list");
  assert.deepEqual(second.getTasks(), []);
});

test("HTML-like task text is kept as literal text", () => {
  const todos = createTodoList();
  const text = '<img src="missing" onerror="alert(1)">';
  assert.equal(todos.add(text).text, text);
});
