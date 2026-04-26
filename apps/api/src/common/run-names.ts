const ADJECTIVES = [
  'amber', 'bold', 'calm', 'dark', 'eager', 'fast', 'glad', 'hazy',
  'icy', 'jade', 'keen', 'lush', 'mild', 'neat', 'opal', 'pure',
  'quick', 'rare', 'slim', 'tidy', 'vast', 'warm', 'zany', 'bright',
];

const NOUNS = [
  'arc', 'beam', 'coil', 'dawn', 'echo', 'flux', 'gate', 'halo',
  'iris', 'jade', 'knot', 'lens', 'mesa', 'node', 'orb', 'peak',
  'quay', 'rift', 'spur', 'tide', 'vale', 'wave', 'zero', 'bolt',
];

export function generateRunName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}
