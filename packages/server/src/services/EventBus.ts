import type { TaskEvent } from '../types/index.js';

type Listener = (event: TaskEvent) => void | Promise<void>;

export class EventBus {
  private readonly globalListeners = new Set<Listener>();
  private readonly taskListeners = new Map<string, Set<Listener>>();

  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  subscribeTask(taskId: string, listener: Listener): () => void {
    let set = this.taskListeners.get(taskId);
    if (!set) {
      set = new Set();
      this.taskListeners.set(taskId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.taskListeners.delete(taskId);
    };
  }

  async publish(event: TaskEvent): Promise<void> {
    const tasks: Listener[] = [
      ...this.globalListeners,
      ...(this.taskListeners.get(event.taskId) ?? []),
    ];
    await Promise.all(tasks.map((fn) => Promise.resolve(fn(event))));
  }
}

export const eventBus = new EventBus();
