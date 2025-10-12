import http from 'node:http';

const base = process.env.SMOKE_BASE ?? 72;
const port = process.env.PORT ?? 3001;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(body) : null;
    const r = http.request(
      { method, host: 'localhost', port, path, headers: { 'Content-Type': 'application/json', ...headers } },
      res => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', c => buf += c);
        res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('health →', await req('GET', '/health'));

  const payload = JSON.stringify({ base, bases: { openai: 80, midjourney: 78 } });
  console.log('\nbulk csv →', await req('POST', '/api/v1/providers/leaderboard/bulk?format=csv&reviewer=smoke&period=auto', payload));

  const list = await req('GET', '/api/v1/audit');
  console.log('\naudit list →', list.status);
  const items = JSON.parse(list.body).items || [];
  const latest = items[0];
  console.log('latest:', latest);
  if (!latest) process.exit(1);

  const verify = await req('GET', `/api/v1/audit/${latest.id}/verify`);
  console.log('\nverify →', verify.status, verify.body);
})();
