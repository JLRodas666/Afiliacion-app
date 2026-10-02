import { connectorsForRequest } from "@/lib/connectors";
import { connectorResponse } from "@/lib/connector-errors.mjs";

export const dynamic = "force-dynamic";
const connectorId = "connector_5f3c8c41a1e54ad7a76272c89e2554fa";
const spreadsheetId = "1Vw07us8qZ2tniOYKc9-_5CftFM8Pf-7HVLAb4bSQHo0";
const headers = ["Nombre", "APELLIDOS", "DNI", "TELEFONO", "Correo electrónico", "Fecha Afiliación Stuni", "ANTIGUEDAD", "CENTRO DE TRABAJO", "TIENDA", "PROVINCIA", "PUESTO", "CUOTA", "Banco", "Observaciones", "Fecha de creación"];
const allowedEmails = new Set(["lozano@stuni.es", "admin@stuni.es"]);

function json(status: number, body: unknown) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
function isAllowed(request: Request) { return allowedEmails.has((request.headers.get("oai-authenticated-user-email") || "").trim().toLowerCase()); }

export async function GET(request: Request) {
  if (!isAllowed(request)) return json(403, { message: "Acceso no autorizado." });
  const result = await connectorsForRequest().invoke(connectorId, "google_drive_get_spreadsheet_range", { spreadsheet_id: spreadsheetId, sheet_name: "Afiliados", range: "A1:O1000", value_render_option: "UNFORMATTED_VALUE" });
  if (result.status !== "success") return connectorResponse(result);
  const values = (result.result.structuredContent as { values?: unknown[][] })?.values;
  if (!Array.isArray(values)) return json(502, { message: "La hoja no devolvió datos válidos. Vuelve a cargarla." });
  const rows = values.slice(1).map((row, index) => Object.fromEntries(headers.map((header, column) => [header, String(row[column] ?? "")]).concat([["_row", String(index + 2)]]))).filter((member) => headers.some((header) => member[header].trim()));
  return json(200, { members: rows });
}

export async function POST(request: Request) {
  if (!isAllowed(request)) return json(403, { message: "Acceso no autorizado." });
  const { member, row } = await request.json() as { member: Record<string, string>; row: number | null };
  const values = headers.map((header) => String(member?.[header] ?? ""));
  if (!values[0] || !values[1] || !values[2]) return json(400, { message: "Nombre, apellidos y DNI son obligatorios." });
  if (!row || row < 2) values[14] = new Date().toLocaleString("es-ES");
  const startRowIndex = row && row > 1 ? row - 1 : 489;
  const requestBody = row && row > 1 ? [{ updateCells: { range: { sheetId: 1082182129, startRowIndex, endRowIndex: startRowIndex + 1, startColumnIndex: 0, endColumnIndex: headers.length }, rows: [{ values: values.map((value) => ({ userEnteredValue: { stringValue: value } })) }], fields: "userEnteredValue" } }] : [{ appendCells: { sheetId: 1082182129, rows: [{ values: values.map((value) => ({ userEnteredValue: { stringValue: value } })) }], fields: "userEnteredValue" } }];
  const result = await connectorsForRequest().invoke(connectorId, "google_drive_batch_update_spreadsheet", { spreadsheet_id: spreadsheetId, requests: requestBody });
  if (result.status !== "success") return connectorResponse(result);
  return json(200, { status: "success", ok: true });
}
