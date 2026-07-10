import { patientWorkspaceService } from './src/services/patient-workspace.service.ts';

async function main() {
  try {
    const patient4 = await patientWorkspaceService.getPatientWorkspace("4");
    console.log("Patient 4 household:");
    console.log(JSON.stringify(patient4.household, null, 2));

    const patient14 = await patientWorkspaceService.getPatientWorkspace("14");
    console.log("Patient 14 household:");
    console.log(JSON.stringify(patient14.household, null, 2));
  } catch (err) {
    console.error(err);
  }
}
main();
