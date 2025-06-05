const seenEmails = new Set<string>();

export function isDuplicate(email: string): boolean {
  if (seenEmails.has(email)) {
    return true;
  }
  seenEmails.add(email);
  return false;
}
