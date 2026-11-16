export interface Choice { value: string; label: string }

/**
 * The options of an Owner box on a record's edit form: the record's present owner first (even one the person could not choose, so nothing changes by leaving
 * it), then the people the database lets them give it to, and always whoever the form holds now (`current`, the owner id the next save will send), so the box
 * never shows one person while a save sends another: after "Keep theirs" the form holds the other person's choice, who may be neither the present owner nor
 * someone the person may choose. That person is named from the firm's people (`people`), else "Someone in the firm".
 */
export function ownerChoices(present: { id: string; name: string } | null, choosable: Choice[], people: Choice[], current: string): Choice[] {
  const options: Choice[] = present ? [{ value: present.id, label: present.name }] : [];
  for (const c of choosable) if (!options.some((o) => o.value === c.value)) options.push(c);
  if (current !== "" && !options.some((o) => o.value === current)) {
    options.splice(present ? 1 : 0, 0, { value: current, label: people.find((p) => p.value === current)?.label ?? "Someone in the firm" });
  }
  return options;
}
