// Seed one ready letter for alice; expose its id as output.letterId.
var r = http.post(API_URL + '/test/seed', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ letters: [{ title: TITLE, body: BODY, recipientEmail: 'alice@example.test', status: 'ready' }] }),
});
output.letterId = String(json(r.body).letters[0].id);
