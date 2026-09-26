import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 15_000;

function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 256 * 1024,
    },
  );
  return (stdout ?? "").trim();
}

export function canWriteUserEnv(): boolean {
  return process.platform === "win32";
}

export async function getUserEnvironmentVariable(name: string): Promise<string | null> {
  if (!canWriteUserEnv()) return null;
  const output = await runPowerShell(
    `[Environment]::GetEnvironmentVariable(${psLiteral(name)}, 'User')`,
  );
  const value = output.split(/\r?\n/)[0]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export async function setUserEnvironmentVariable(name: string, value: string | null): Promise<void> {
  if (!canWriteUserEnv()) {
    throw new Error(
      "当前系统无法由本工具写入用户环境变量。请在启动 Pi 的终端执行：export PI_CACHE_RETENTION=long",
    );
  }
  const assignment =
    value == null
      ? `[Environment]::SetEnvironmentVariable(${psLiteral(name)}, $null, 'User')`
      : `[Environment]::SetEnvironmentVariable(${psLiteral(name)}, ${psLiteral(value)}, 'User')`;
  await runPowerShell(assignment);
  const readBack = await getUserEnvironmentVariable(name);
  if (value == null) {
    if (readBack != null) {
      throw new Error("已请求删除用户环境变量，但读取仍有值");
    }
    return;
  }
  if (readBack !== value) {
    throw new Error("写入用户环境变量后校验失败");
  }
}
