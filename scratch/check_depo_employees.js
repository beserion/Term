async function run() {
  const baseURL = 'https://api.blackskyqore.com/api';
  const loginRes = await fetch(`${baseURL}/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'depo@geminimar.com',
      userName: 'depo@geminimar.com',
      password: 'BlueHub1!'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const empRes = await fetch(`${baseURL}/HR/employee-list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  const empData = await empRes.json();
  const employees = empData.employees || [];

  console.log(`Total employees: ${employees.length}`);
  const depts = new Set(employees.map(e => e.departmentName));
  console.log('Unique department names:', Array.from(depts));

  const depoEmployees = employees.filter(e => {
    const d = (e.departmentName || '').toUpperCase();
    return d.includes('DEPO') || d.includes('WAREHOUSE');
  });

  console.log(`\nFound ${depoEmployees.length} DEPO employees:`);
  depoEmployees.forEach(e => {
    console.log(`ID: ${e.id} | Code: ${e.employeeCode} | Name: ${e.fullName} | Dept: ${e.departmentName} | Position: ${e.positionName} | Status: ${e.employmentStatus}`);
  });

  if (depoEmployees.length === 0) {
    console.log('\nAll employees list:');
    employees.forEach(e => {
      console.log(`ID: ${e.id} | Code: ${e.employeeCode} | Name: ${e.fullName} | Dept: ${e.departmentName}`);
    });
  }
}

run().catch(console.error);
