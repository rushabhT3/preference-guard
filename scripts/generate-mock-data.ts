import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDataset,
  MOCK_DATA_SEED,
  serializeDataset,
} from "./mock-data/build";

const DATA_DIR = join(import.meta.dirname, "..", "src", "data");

const dataset = buildDataset(MOCK_DATA_SEED);
for (const [fileName, contents] of serializeDataset(dataset)) {
  writeFileSync(join(DATA_DIR, fileName), contents);
}
process.stdout.write(
  `Wrote ${dataset.clients.length} clients, ${dataset.candidates.length} candidates and ${dataset.history.length} events to src/data\n`,
);
