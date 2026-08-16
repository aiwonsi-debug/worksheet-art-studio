// Does pdfjs v6 legacy load a PDF in pure node WITHOUT any worker setup?
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { execSync } from "child_process";

const raw = execSync(
  'printf "%%PDF-1.4\\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\\n3 0 obj<</Type/Page/MediaBox[0 0 100 100]/Parent 2 0 R>>endobj\\nxref\\n0 4\\n0000000000 65535 f \\n0000000009 00000 n \\n0000000058 00000 n \\n0000000115 00000 n \\ntrailer<</Size 4/Root 1 0 R>>\\nstartxref\\n190\\n%%%%EOF"'
);
const pdf = new Uint8Array(raw);

const doc = await getDocument({ data: pdf }).promise;
console.log("pages:", doc.numPages);
console.log("SUCCESS: legacy build works in node WITHOUT worker setup");
