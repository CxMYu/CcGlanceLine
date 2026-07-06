import fs from 'fs';
import path from 'path';
import { cacheDir } from '../utils/paths';

const CACHE_TTL_MS = 4 * 3600 * 1000;
const REFRESH_THROTTLE_MS = 60 * 1000;
const cacheFile = path.join(cacheDir('version'), 'claude-code.json');
const refreshFile = path.join(cacheDir('version'), 'claude-code.refresh');

interface VersionCache {
  latest?: string;
  checkedAt?: number;
}

let memo: VersionCache | null = null;

function readCache(): VersionCache {
  if (memo) return memo;
  try {
    memo = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as VersionCache;
  } catch {
    memo = {};
  }
  return memo;
}

export function readCachedLatest(): string {
  return readCache().latest || '';
}

function shouldRefresh(): boolean {
  try {
    fs.mkdirSync(path.dirname(refreshFile), { recursive: true });
    fs.writeFileSync(refreshFile, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    // Existing marker means another statusline process is already refreshing.
  }

  try {
    const st = fs.statSync(refreshFile);
    if (Date.now() - st.mtimeMs < REFRESH_THROTTLE_MS) return false;
    fs.rmSync(refreshFile, { force: true });
    fs.writeFileSync(refreshFile, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

export function scheduleRefresh(): void {
  try {
    const age = Date.now() - (readCache().checkedAt || 0);
    if (age <= CACHE_TTL_MS) return;
    if (!shouldRefresh()) return;

    const bg =
      "const https=require('https'),fs=require('fs'),path=require('path');" +
      "const f=" + JSON.stringify(cacheFile) + ";" +
      "const marker=" + JSON.stringify(refreshFile) + ";" +
      "let prev='';try{prev=(JSON.parse(fs.readFileSync(f,'utf8')).latest)||''}catch{}" +
      "let done=false;const finish=v=>{if(done)return;done=true;" +
      "try{const tmp=f+'.'+process.pid+'.tmp';fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(tmp,JSON.stringify({latest:v||prev,checkedAt:Date.now()}));fs.renameSync(tmp,f)}catch{}" +
      "try{fs.rmSync(marker,{force:true})}catch{}};" +
      "try{" +
      "const req=https.get('https://registry.npmjs.org/@anthropic-ai/claude-code/latest',r=>{" +
      "if(r.statusCode!==200){r.resume();return finish('')}" +
      "let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{finish(JSON.parse(d).version)}catch{finish('')}})" +
      "});req.on('error',()=>finish(''));req.setTimeout(5000,()=>{req.destroy();finish('')});" +
      "}catch{finish('')}";
    const { spawn } = require('child_process') as typeof import('child_process');
    spawn(process.execPath, ['-e', bg], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {
    try { fs.rmSync(refreshFile, { force: true }); } catch { /* ignore */ }
    // Version refresh never affects statusline rendering.
  }
}
