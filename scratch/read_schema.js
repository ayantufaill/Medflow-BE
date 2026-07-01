import fs from 'fs';
const content = fs.readFileSync('prisma/schema.prisma', 'utf16le');
console.log("UTF-16LE Length:", content.length);
let index = content.indexOf('clinicalsystemsetting');
if (index === -1) {
  const contentUtf8 = fs.readFileSync('prisma/schema.prisma', 'utf8');
  console.log("UTF-8 Length:", contentUtf8.length);
  index = contentUtf8.indexOf('clinicalsystemsetting');
  if (index !== -1) {
    console.log("Found in UTF-8!");
    console.log(contentUtf8.substring(index - 100, index + 300));
  } else {
    console.log("Not found in UTF-8 either");
    // Print first 500 characters
    console.log("First 500 chars:", contentUtf8.substring(0, 500));
  }
} else {
  console.log("Found in UTF-16LE!");
  console.log(content.substring(index - 100, index + 300));
}
