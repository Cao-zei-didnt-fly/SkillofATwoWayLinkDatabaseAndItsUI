import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {connectionConfig} from '../src/connection.js';
test('desktop clients receive the bundled runtime, stable vault and stdio entry point',()=>{
 const c=connectionConfig({executable:path.resolve('dist/win-unpacked/Link Garden.exe'),vault:path.resolve('vault'),skill:'skill'});
 const service=JSON.parse(c.workbuddy).mcpServers.link_garden;
 assert.equal(service.env.ELECTRON_RUN_AS_NODE,'1');assert.match(service.args[0],/app\.asar[\\/]src[\\/]mcp-entry\.js$/);assert.equal(service.args[2],path.resolve('vault'));
 assert.match(c.codex,/\[mcp_servers.link_garden.env\]/);assert.match(c.codex,/ELECTRON_RUN_AS_NODE = "1"/);
});
