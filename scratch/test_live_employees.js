async function run() {
  const baseURL = 'https://api.blackskyqore.com/api';
  console.log('Logging in with depo@geminimar.com...');
  const loginRes = await fetch(`${baseURL}/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'depo@geminimar.com',
      userName: 'depo@geminimar.com',
      password: 'BlueHub1!'
    })
  });
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login success:', loginData.success, 'Token length:', loginData.token?.length);
  const token = loginData.token;

  if (!token) {
    console.error('No token received');
    return;
  }

  // Now call /api/HR/employee-list with Bearer token!
  console.log('\nFetching /HR/employee-list...');
  const empRes = await fetch(`${baseURL}/HR/employee-list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  console.log('Employee list status:', empRes.status);
  const empData = await empRes.json();
  console.log('Employee response keys / type:', Array.isArray(empData) ? 'Array' : Object.keys(empData));
  console.log('Employee sample data:', JSON.stringify(empData, null, 2).substring(0, 1500));
}

run().catch(console.error);
