/**
 * vitest globalSetup：把 HOME / USERPROFILE 指向空临时目录，隔离宿主全局层 `~/.done-coding/`。
 * 须配 `pool: "forks"`——threads 池下 worker 内改 env 不影响 libuv `os.homedir()`。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default (): (() => void) => {
  const saved = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dc-test-home-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(home, { recursive: true, force: true });
  };
};
