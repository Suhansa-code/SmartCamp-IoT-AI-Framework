'use strict';

const C = require('../config/constants');

const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const currentLevel = C.NODE_ENV === 'development' ? LEVELS.DEBUG : LEVELS.INFO;

function formatMsg(level, message) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const ts = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+05:30`;
  return `[${ts}] [${level.padEnd(5)}] ${message}`;
}

const logger = {
  error(message, meta = null) {
    if (LEVELS.ERROR <= currentLevel) {
      const line = meta ? `${message} | ${JSON.stringify(meta)}` : message;
      console.error(formatMsg('ERROR', line));
    }
  },

  warn(message, meta = null) {
    if (LEVELS.WARN <= currentLevel) {
      const line = meta ? `${message} | ${JSON.stringify(meta)}` : message;
      console.warn(formatMsg('WARN', line));
    }
  },

  info(message, meta = null) {
    if (LEVELS.INFO <= currentLevel) {
      const line = meta ? `${message} | ${JSON.stringify(meta)}` : message;
      console.log(formatMsg('INFO', line));
    }
  },

  debug(message, meta = null) {
    if (LEVELS.DEBUG <= currentLevel) {
      const line = meta ? `${message} | ${JSON.stringify(meta)}` : message;
      console.log(formatMsg('DEBUG', line));
    }
  },
};

module.exports = logger;