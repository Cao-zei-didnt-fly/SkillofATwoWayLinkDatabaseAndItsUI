import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import storage from './paths.cjs';
import { startMcp } from './mcp.js';
const args=process.argv.slice(2),at=args.indexOf('--vault');
const bundle=path.resolve(fileURLToPath(new URL('..',import.meta.url)));const root=bundle.endsWith('.asar')?path.dirname(path.dirname(bundle)):bundle;
const vault=at>=0?args[at+1]:storage.localLayout({root}).vault;
startMcp(vault).catch(error=>{console.error(error);process.exitCode=1;});
