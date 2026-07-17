async function main() {
  try {
    const response = await fetch('http://localhost:5001/api/patients/14');
    const json = await response.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}
main();
