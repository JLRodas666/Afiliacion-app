import { connectorsForRequest } from "@/lib/connectors";

export const dynamic = "force-dynamic";

const connectorId = "connector_5f3c8c41a1e54ad7a76272c89e2554fa";
const spreadsheetId = "1Vw07us8qZ2tniOYKc9-_5CftFM8Pf-7HVLAb4bSQHo0";
const headers = ["Nombre", "APELLIDOS", "DNI", "TELEFONO", "Correo electrónico", "Fecha Afiliación Stuni", "ANTIGUEDAD", "CENTRO DE TRABAJO", "TIENDA", "PROVINCIA", "PUESTO", "CUOTA", "Banco", "Observaciones", "Fecha de creación"];
const allowedEmails = new Set(["lozano@stuni.es", "admin@stuni.es"]);

function allowed(request: Request) {
  return allowedEmails.has((request.headers.get("oai-authenticated-user-email") || "").trim().toLowerCase());
}

async function readMembers() {
  const result = await connectorsForRequest().invoke(connectorId, "google_drive_get_spreadsheet_range", {
    spreadsheet_id: spreadsheetId,
    sheet_name: "Afiliados",
    range: "A1:O1000",
    value_render_option: "UNFORMATTED_VALUE",
  });
  if (result.status !== "success") throw new Error("No se pudo leer la base de afiliación.");
  const values = (result.result.structuredContent as { values?: unknown[][] })?.values;
  if (!Array.isArray(values)) throw new Error("La hoja no devolvió datos válidos.");
  return values.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, column) => [header, String(row[column] ?? "")]))) as Record<string, string>[];
}

function response(id: string | number | null, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!allowed(request)) return new Response("Forbidden", { status: 403 });
  const message = await request.json() as { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  const id = message.id ?? null;

  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message.method === "initialize") {
    return response(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "Afiliaciones STUNI", version: "1.0.0" },
    });
  }
  if (message.method === "tools/list") {
    return response(id, {
      tools: [
        {
          name: "contar_afiliados",
          description: "Cuenta afiliados. Puede filtrar por tienda, provincia o puesto.",
          inputSchema: { type: "object", properties: { tienda: { type: "string" }, provincia: { type: "string" }, puesto: { type: "string" } } },
        },
        {
          name: "buscar_afiliados",
          description: "Busca afiliados por tienda, provincia o puesto y devuelve nombre, apellidos, tienda, provincia, puesto y observaciones.",
          inputSchema: { type: "object", properties: { tienda: { type: "string" }, provincia: { type: "string" }, puesto: { type: "string" } } },
        },
      ],
    });
  }
  if (message.method === "tools/call") {
    const params = message.params || {};
    const name = String(params.name || "");
    const args = (params.arguments || {}) as { tienda?: string; provincia?: string; puesto?: string };
    const members = await readMembers();
    const matches = members.filter((member) => ["tienda", "provincia", "puesto"].every((key) => {
      const filter = args[key as keyof typeof args]?.trim().toLowerCase();
      return !filter || (member[key.toUpperCase()] || "").toLowerCase().includes(filter);
    }));
    if (name === "contar_afiliados") return response(id, { content: [{ type: "text", text: `Hay ${matches.length} afiliados.` }], structuredContent: { count: matches.length } });
    if (name === "buscar_afiliados") {
      const safe = matches.map((member) => ({ Nombre: member.Nombre, APELLIDOS: member.APELLIDOS, TIENDA: member.TIENDA, PROVINCIA: member.PROVINCIA, PUESTO: member.PUESTO, Observaciones: member.Observaciones }));
      return response(id, { content: [{ type: "text", text: JSON.stringify(safe) }], structuredContent: { members: safe } });
    }
    return response(id, { isError: true, content: [{ type: "text", text: "Herramienta no disponible." }] });
  }
  return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Método no disponible." } }, { status: 400 });
}
