// Hints in the briefings and objectives name the keyboard key and the controller button (V / Y).
// On a phone neither exists, so the same hints name the on-screen button instead.
const PHONE = [
  [/\(R \/ X button\)/g, '(Report button)'],
  [/\(V \/ Y, after the cockpit\)/g, '(View button, after the cockpit)'],
  [/with V \/ Y/g, 'with the View button'],
  [/\(F \/ LB: /g, '(Depth button: '],
];

export function forDevice(text) {
  if (typeof document === 'undefined' || !document.body || !document.body.classList.contains('touch')) return text;
  let out = text;
  for (const [pattern, phone] of PHONE) out = out.replace(pattern, phone);
  return out;
}
