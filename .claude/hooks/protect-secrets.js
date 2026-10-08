// Hook PreToolUse: impide que el agente lea el archivo de constantes sensibles.
// Solo coincide con el nombre exacto (no con nombres como "mis-constants" o "fooconstants").
const PROTECTED_FILE = /(^|[^\w-])constants\.js\b/i;

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  const toolInput = JSON.stringify(input.tool_input || {});

  if (PROTECTED_FILE.test(toolInput)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'no puedo leer ese archivo, me han censurado :('
      }
    }));
  }
});
