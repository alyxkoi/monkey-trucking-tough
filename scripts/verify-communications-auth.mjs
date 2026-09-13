// Read-only deployment check: deliberately invalid credentials and no customer payload.
// Run only with sending gates closed and empty queues during release verification.
const base = 'https://dugmcjpistrxxryaubkd.supabase.co/functions/v1';
const forged = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.invalid`;
const cases = ['send-sms', 'sent-dm-webhook', 'ai-draft', 'process-communications']
  .map(name => ({ name, authorization: null, expected: name === 'sent-dm-webhook' ? 400 : 401 }));
cases.push({ name: 'process-communications', authorization: `Bearer ${forged}`, expected: 401 });
cases.push({ name: 'process-communications', authorization: `Bearer ${'0'.repeat(64)}`, expected: 401, invalidVaultToken: true });
cases.push({ name: 'sent-dm-webhook', authorization: null, expected: 401, forgedSignature: true });
for (const test of cases) {
  const headers = { 'Content-Type': 'application/json' };
  if (test.authorization) headers.Authorization = test.authorization;
  if (test.forgedSignature) Object.assign(headers, {
    'X-Webhook-ID': 'invalid-signature-release-check',
    'X-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)),
    'X-Webhook-Signature': 'v1,aW52YWxpZA==',
  });
  const response = await fetch(`${base}/${test.name}`, {
    method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  console.log(JSON.stringify({ function: test.name, credential: test.invalidVaultToken ? 'invalid-vault-token' : test.authorization ? 'forged-role-claim' : test.forgedSignature ? 'forged-signature' : 'absent', status: response.status, error: body?.error ?? null }));
  if (response.status !== test.expected) process.exitCode = 1;
}
