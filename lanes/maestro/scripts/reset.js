// Reset api + crm to seed state (needs TEST_MODE=1 on the stack).
var opts = { headers: { 'Content-Type': 'application/json' }, body: '{}' };
http.post(API_URL + '/test/reset', opts);
http.post(CRM_API_URL + '/test/reset', opts);
