// Single source of truth for ports and URLs. Everything derives from PORT_OFFSET (default 0).
const offset = Number(process.env.PORT_OFFSET ?? 0);
if (!Number.isInteger(offset) || offset < 0 || offset > 60000) throw new Error(`bad PORT_OFFSET: ${process.env.PORT_OFFSET}`);

export const PORT_OFFSET = offset;
export const ports = { api: 5100 + offset, admin: 5101 + offset, portal: 5102 + offset, crm: 5103 + offset };
export const urls = {
  api: `http://api.localhost:${ports.api}`,
  admin: `http://admin.localhost:${ports.admin}`,
  portal: `http://portal.localhost:${ports.portal}`,
  crm: `http://crm.localhost:${ports.crm}`,
};
export const internal = { api: `http://127.0.0.1:${ports.api}`, crm: `http://127.0.0.1:${ports.crm}` };
export const dbSuffix = offset ? `-${offset}` : "";
