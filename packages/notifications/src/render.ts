/** Replace `{{name}}` tokens. Unknown keys stay as-is. */
export function renderTemplate(template: string, variables?: Record<string, string>): string {
  if (!variables) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

export function formatOutboundText(title: string, body: string): string {
  const t = title.trim();
  const b = body.trim();
  if (!t) return b;
  if (!b) return t;
  return `${t}\n\n${b}`;
}
