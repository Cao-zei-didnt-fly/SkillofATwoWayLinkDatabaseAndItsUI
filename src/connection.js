import path from 'node:path';
export function connectionConfig({executable,entry,vault,skill}) {
  const command=path.resolve(executable),parameters=[entry||path.join(path.dirname(command),'resources/app.asar/src/mcp-entry.js'),'--vault',path.resolve(vault)],env={ELECTRON_RUN_AS_NODE:'1'};
  return {vault:path.resolve(vault),skill,
    codex:`[mcp_servers.link_garden]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(parameters)}\nstartup_timeout_sec = 120\ntool_timeout_sec = 60\n\n[mcp_servers.link_garden.env]\nELECTRON_RUN_AS_NODE = "1"\n`,
    workbuddy:JSON.stringify({mcpServers:{link_garden:{command,args:parameters,env}}},null,2)};
}
