// Mirrored in frontend/src/api/types.ts (PIR_TEMPLATES) for the template picker —
// the structure (5 fixed sections) doesn't change per template, only the framing.
export interface PirTemplate {
  id: string;
  name: string;
  focus: string;
}

export const PIR_TEMPLATES: PirTemplate[] = [
  { id: 'phishing', name: 'Phishing Incident', focus: 'How the lure worked, what let it through, and who clicked.' },
  { id: 'ransomware', name: 'Ransomware Incident', focus: 'Initial access, lateral movement, encryption scope, and recovery.' },
  { id: 'insider_threat', name: 'Insider Threat', focus: 'Access misuse, detection gap, and policy/process follow-up.' },
  { id: 'data_breach', name: 'Data Breach / Exfiltration', focus: 'What left the environment, how, and notification obligations.' },
  { id: 'generic', name: 'Generic Incident', focus: 'General-purpose root-cause and lessons-learned review.' },
];

export const PIR_TEMPLATE_IDS = PIR_TEMPLATES.map((t) => t.id);
