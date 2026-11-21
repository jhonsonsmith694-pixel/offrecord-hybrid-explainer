// ---------------------------------------------------------------------------
// Prompts and structured-output schema for OffRecord.
//
// The model returns JSON (structured output), which the UI renders as a
// summary, key points, and "watch out" flags. Structured output is
// supported by both the on-device model (Gemini Nano) and the cloud model.
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You explain dense, hard-to-read text in plain, everyday language.
The reader is a normal person, not a lawyer or a doctor.
Rules:
- Use short sentences and everyday words. No jargon unless you explain it.
- Be faithful: never invent facts that are not in the text.
- Be neutral: do not give legal or medical advice, just explain what the text says.
- Keep the summary to 3-5 sentences.`;

export const EXPLAIN_INSTRUCTION = `Explain the text below in plain language.
Return ONLY a JSON object with this shape:
{
  "summary": "3-5 sentence plain-language summary",
  "keyPoints": ["one short point per important fact, max 5"],
  "watchOut": ["things the reader should be careful about, max 4; empty array if none"],
  "readingLevel": "Simple" | "Medium" | "Dense"
}

Text to explain:
`;

/** JSON schema for the model's structured output. */
export const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    watchOut: { type: "array", items: { type: "string" } },
    readingLevel: { type: "string", enum: ["Simple", "Medium", "Dense"] },
  },
  required: ["summary", "keyPoints", "watchOut", "readingLevel"],
};

/** Sample texts so anyone can try the app in one click. */
export const SAMPLES = [
  {
    id: "terms",
    label: "App terms of service",
    text: `By accessing or using the Service, you agree to be bound by these Terms. The Company reserves the right, at its sole discretion, to modify, suspend, or discontinue the Service, in whole or in part, at any time and without prior notice or liability. You grant the Company a perpetual, irrevocable, worldwide, royalty-free license to use, reproduce, and distribute any content you submit, including for the purpose of improving the Service. Your account may be terminated at any time, with or without cause, and upon termination your right to access the Service ceases immediately. You agree to indemnify and hold harmless the Company, its affiliates, officers, and employees from any claim arising from your use of the Service.`,
  },
  {
    id: "medical",
    label: "Medicine leaflet",
    text: `Each tablet contains 500 mg of the active substance. Adults and children over 12 years: take one tablet every 6 to 8 hours as needed, up to a maximum of 4 tablets in 24 hours. Do not take this medicine if you are allergic to any of its ingredients, if you have severe liver disease, or if you are taking other medicines containing the same active substance. Consult your doctor before use if you are pregnant, breastfeeding, or have kidney problems. Possible side effects include nausea, headache, and dizziness. Stop taking the medicine and seek medical attention immediately if you experience swelling of the face or difficulty breathing. Keep out of the reach of children. Store below 25°C.`,
  },
  {
    id: "rental",
    label: "Rental clause",
    text: `The Tenant shall pay a security deposit equal to two months' rent upon signing this agreement. The deposit shall be held by the Landlord and returned within 30 days of the termination of the tenancy, less any deductions for unpaid rent, damage beyond normal wear and tear, or cleaning costs. The Tenant is responsible for all minor repairs up to a value of $150 per incident. The Landlord may enter the premises with 24 hours' written notice for inspections or repairs. Subletting the premises, in whole or in part, is prohibited without the Landlord's prior written consent. Either party may terminate this agreement with 60 days' written notice.`,
  },
];
