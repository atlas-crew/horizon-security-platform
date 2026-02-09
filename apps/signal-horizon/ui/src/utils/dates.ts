export function formatIsoOrInvalid(input: string): string {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? 'Invalid Date' : d.toISOString();
}

