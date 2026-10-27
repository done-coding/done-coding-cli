import fs from "node:fs";
import asyncFs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

const isInside = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

/** 一次性 CLI 写盘：受控配置目录下的普通文件，拒绝符号链接目标与目录逃逸。 */
export const assertSettingsTarget = (root: string, target: string): void => {
  const absRoot = path.resolve(root);
  if (
    absRoot === path.parse(absRoot).root ||
    absRoot === os.homedir() ||
    !isInside(absRoot, path.resolve(target))
  ) {
    throw new Error("settings 写入目标越界或为可疑根");
  }
  const realRoot = fs.realpathSync(absRoot);
  // root 的父目录（命名空间）也是控制边界，不能经 root 软链逃到外部。
  const realParent = fs.realpathSync(path.dirname(absRoot));
  if (!isInside(realParent, realRoot))
    throw new Error("settings 目录符号链接越界");
  const realTargetParent = fs.realpathSync(path.dirname(target));
  if (realTargetParent !== realRoot) throw new Error("settings 写入目录越界");
  try {
    const stat = fs.lstatSync(target);
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      !isInside(realRoot, fs.realpathSync(target))
    )
      throw new Error("settings 目标符号链接或越界");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

/** 临时文件从创建起就是 600，rename 失败时原文件保持，清理本次临时文件。 */
export const atomicWriteSettings = (
  target: string,
  settings: unknown,
): void => {
  const root = path.dirname(target);
  fs.mkdirSync(root, { recursive: true });
  assertSettingsTarget(root, target);
  const temporary = path.join(root, `.settings-${randomUUID()}.tmp`);
  assertSettingsTarget(root, temporary);
  let created = false;
  try {
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    created = true;
    try {
      fs.writeFileSync(descriptor, JSON.stringify(settings, null, 2));
      fs.fchmodSync(descriptor, 0o600);
    } finally {
      fs.closeSync(descriptor);
    }
    assertSettingsTarget(root, target);
    fs.renameSync(temporary, target);
  } finally {
    if (created && fs.existsSync(temporary)) {
      assertSettingsTarget(root, temporary);
      fs.unlinkSync(temporary);
    }
  }
};

/** UI 回调使用异步 I/O；同步版本保留给既有一次性 CLI。 */
export const assertSettingsTargetAsync = async (
  root: string,
  target: string,
): Promise<void> => {
  const absRoot = path.resolve(root);
  if (
    absRoot === path.parse(absRoot).root ||
    absRoot === os.homedir() ||
    !isInside(absRoot, path.resolve(target))
  )
    throw new Error("settings 写入目标越界或为可疑根");
  const [realRoot, realParent, realTargetParent, rootStat, parentStat] =
    await Promise.all([
      asyncFs.realpath(absRoot),
      asyncFs.realpath(path.dirname(absRoot)),
      asyncFs.realpath(path.dirname(target)),
      asyncFs.lstat(absRoot),
      asyncFs.lstat(path.dirname(absRoot)),
    ]);
  if (
    rootStat.isSymbolicLink() ||
    parentStat.isSymbolicLink() ||
    !isInside(realParent, realRoot)
  )
    throw new Error("settings 目录符号链接或越界");
  if (realTargetParent !== realRoot) throw new Error("settings 写入目录越界");
  try {
    const stat = await asyncFs.lstat(target);
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      !isInside(realRoot, await asyncFs.realpath(target))
    )
      throw new Error("settings 目标符号链接或越界");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

/** 同目录排他创建 600 临时文件再 rename；同样保护 UI 重建的 profile。 */
export const atomicWriteSettingsAsync = async (
  target: string,
  settings: unknown,
): Promise<void> => {
  const root = path.dirname(target);
  const content = JSON.stringify(settings, null, 2);
  await assertSettingsTargetAsync(root, target);
  const temporary = path.join(root, `.settings-${randomUUID()}.tmp`);
  await assertSettingsTargetAsync(root, temporary);
  let created = false;
  try {
    const descriptor = await asyncFs.open(temporary, "wx", 0o600);
    created = true;
    try {
      await descriptor.writeFile(content);
      await descriptor.chmod(0o600);
    } finally {
      await descriptor.close();
    }
    await assertSettingsTargetAsync(root, target);
    await asyncFs.rename(temporary, target);
    created = false;
  } finally {
    if (created) {
      await assertSettingsTargetAsync(root, temporary);
      await asyncFs.unlink(temporary);
    }
  }
};
