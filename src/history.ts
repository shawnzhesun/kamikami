/** A focused edit is one undo step; other operations always start a new step. */
export class EditHistory<T> {
  private past: { value: T; group?: string }[] = [];
  private future: { value: T; group?: string }[] = [];
  private group: string | undefined;

  constructor(private limit = 60) {}

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  get latestGroup() {
    return this.past.at(-1)?.group;
  }

  record(current: T, group?: string) {
    if (!group || group !== this.group) {
      this.past.push({ value: current, group });
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    this.group = group;
  }

  endGroup() {
    this.group = undefined;
  }

  undo(current: T): T | undefined {
    this.endGroup();
    if (!this.canUndo) return undefined;
    const entry = this.past.pop()!;
    this.future.push({ value: current, group: entry.group });
    return entry.value;
  }

  redo(current: T): T | undefined {
    this.endGroup();
    if (!this.canRedo) return undefined;
    const entry = this.future.pop()!;
    this.past.push({ value: current, group: entry.group });
    return entry.value;
  }
}
