import { seedAll } from "@/lib/seed/run";

seedAll({ resetContent: process.argv.includes("--reset-content"), fresh: process.argv.includes("--fresh") })
  .then((runs) => {
    for (const r of runs) console.log(`${r.run.supplierId}: ${r.run.status}`, r.run.stats, r.alerts.length ? `${r.alerts.length} upozornění` : "");
    console.log("Seed hotov.");
  })
  .catch((e) => { console.error(e); process.exit(1); });
