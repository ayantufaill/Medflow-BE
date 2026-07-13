async function main() {
  try {
    const loginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.tokens?.accessToken;

    const res4 = await fetch('http://localhost:5001/api/appointments?patientId=4', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json4 = await res4.json();
    console.log("Appointments for Patient 4:");
    console.log(json4.data?.appointments?.map(a => ({
      _id: a._id,
      appointmentDate: a.appointmentDate,
      patientId: a.patientId
    })));

    const res14 = await fetch('http://localhost:5001/api/appointments?patientId=14', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json14 = await res14.json();
    console.log("Appointments for Patient 14:");
    console.log(json14.data?.appointments?.map(a => ({
      _id: a._id,
      appointmentDate: a.appointmentDate,
      patientId: a.patientId
    })));
  } catch (err) {
    console.error(err);
  }
}
main();
