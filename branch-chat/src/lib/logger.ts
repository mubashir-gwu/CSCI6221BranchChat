import fs from 'fs';
import path from 'path';

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase();
  if (LOG_LEVELS.includes(env as LogLevel)) return env as LogLevel;
  return 'INFO';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(getMinLevel());
}

async function ensureLogDir(): Promise<void> {
  try {
    await fs.promises.access(LOG_DIR);
  } catch {
    await fs.promises.mkdir(LOG_DIR, { recursive: true });
  }
}

let writeChain = Promise.resolve();

function writeLog(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (extra) {
    const { context, ...rest } = extra;
    if (context) entry.context = context;
    Object.assign(entry, rest);
  }

  const line = JSON.stringify(entry) + '\n';

  writeChain = writeChain.then(async () => {
    await ensureLogDir();
    await fs.promises.appendFile(LOG_FILE, line);
  });
}

export const logger = {
  trace: (message: string, extra?: Record<string, unknown>) => { writeLog('TRACE', message, extra); },
  debug: (message: string, extra?: Record<string, unknown>) => { writeLog('DEBUG', message, extra); },
  info: (message: string, extra?: Record<string, unknown>) => { writeLog('INFO', message, extra); },
  warn: (message: string, extra?: Record<string, unknown>) => { writeLog('WARN', message, extra); },
  error: (message: string, extra?: Record<string, unknown>) => { writeLog('ERROR', message, extra); },
};
