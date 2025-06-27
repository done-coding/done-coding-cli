import path from "node:path";
import fs from "node:fs";

const DCPath = path.resolve("./es/cli.mjs");

const DCContent = fs.readFileSync(DCPath, "utf-8");

const dcCliPath = path.resolve("./es/dc-cli.mjs");

fs.writeFileSync(dcCliPath, DCContent, "utf-8");

const doneCodingPath = path.resolve("./es/done-coding.mjs");

fs.writeFileSync(doneCodingPath, DCContent, "utf-8");
