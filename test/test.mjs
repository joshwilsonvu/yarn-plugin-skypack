#!/usr/bin/env node

import fs from "fs/promises";
import { fileURLToPath } from "url";

(async () => {
  try {
    const path = fileURLToPath(
      await import.meta.resolve("preact")
    );
    await fs.stat(path);
    const text = await fs.readFile(path, "utf-8");
    console.log(text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
