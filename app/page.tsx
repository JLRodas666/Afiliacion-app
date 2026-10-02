"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Member = Record<string, string> & { _row?: number };
const fields = [
  ["Nombre", "Nombre", true], ["APELLIDOS", "Apellidos", true], ["DNI", "DNI", true],
  ["TELEFONO", "Teléfono", true], ["Correo electrónico", "Correo electrónico", false],
  ["Fecha Afiliación Stuni", "Fecha de afiliación", false], ["ANTIGUEDAD", "Antigüedad", false],
  ["CENTRO DE TRABAJO", "Centro de trabajo", true], ["TIENDA", "Tienda", true], ["PROVINCIA", "Provincia", true],
  ["PUESTO", "Puesto", true], ["CUOTA", "Cuota", true], ["Banco", "Banco", true], ["Observaciones", "Observaciones", false],
] as const;
const choiceFields = new Set(["CENTRO DE TRABAJO", "TIENDA", "PROVINCIA", "PUESTO", "CUOTA"]);

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [form, setForm] = useState<Member>({});
  const [status, setStatus] = useState("Cargando afiliaciones…");
  const [busy, setBusy] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [newFields, setNewFields] = useState<Set<string>>(new Set());

  async function load() {
    setStatus("Cargando afiliaciones…");
    const response = await fetch("/api/afiliados", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || (body.status && body.status !== "success")) throw new Error(body.message || "No se pudo leer la hoja.");
    if (!Array.isArray(body.members)) throw new Error("La hoja no devolvió una lista válida de afiliaciones.");
    setMembers(body.members); setHasLoaded(true); setStatus("Base actualizada");
  }
  useEffect(() => { load().catch((error) => setStatus(error.message)); }, []);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => (member.APELLIDOS || "").toLowerCase().includes(needle));
  }, [members, query]);
  const catalogs = useMemo(() => Object.fromEntries(Array.from(choiceFields).map((key) => [key, Array.from(new Set(members.map((member) => member[key]).filter(Boolean))).sort()])) as Record<string, string[]>, [members]);
  function selectMember(member: Member) { setSelected(member); setForm({ ...member }); setNewFields(new Set()); }
  function change(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setStatus("Guardando…");
    try {
      const response = await fetch("/api/afiliados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member: { ...form, Banco: form.Banco || "No" }, row: selected?._row ?? null }) });
      const body = await response.json();
      if (!response.ok || body.status !== "success") { setStatus(body.message || "No se pudo confirmar el guardado. Comprueba la hoja antes de repetirlo."); return; }
      setSelected(null); setForm({}); setNewFields(new Set());
      try { await load(); setStatus(selected ? "Afiliación actualizada" : "Nueva afiliación guardada"); }
      catch { setStatus("La afiliación se guardó, pero no se pudo actualizar la lista. Pulsa Actualizar."); }
    } catch { setStatus("No se pudo confirmar el guardado. Comprueba la hoja antes de repetirlo."); }
    finally { setBusy(false); }
  }
  function renderField(key: string, label: string, required: boolean) {
    if (key === "Banco") return <label key={key} className="flex min-h-11 items-center justify-between rounded-2xl border border-[#e2d8cf] bg-[#f7f6f5] px-4 text-sm"><span className="font-medium">Banco: {form.Banco === "Si" ? "Sí" : "No"}</span><button type="button" aria-label={`Banco: ${form.Banco === "Si" ? "Sí" : "No"}`} role="switch" aria-checked={form.Banco === "Si"} onClick={() => change("Banco", form.Banco === "Si" ? "No" : "Si")} className={`relative h-7 w-12 rounded-full transition ${form.Banco === "Si" ? "bg-[#ff9800]" : "bg-[#c8b7a9]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.Banco === "Si" ? "left-6" : "left-1"}`} /></button></label>;
    if (choiceFields.has(key)) {
      const options = catalogs[key] || [];
      const selectValue = newFields.has(key) || (form[key] && !options.includes(form[key])) ? "__new__" : form[key] || "";
      return <label key={key} className="grid gap-1.5 text-sm"><span className="font-medium">{label}{required && <span className="text-[#65361c]"> *</span>}</span><select required={required && selectValue !== "__new__"} value={selectValue} onChange={(event) => { const isNew = event.target.value === "__new__"; setNewFields((current) => { const next = new Set(current); if (isNew) next.add(key); else next.delete(key); return next; }); change(key, isNew ? "" : event.target.value); }} className="h-11 rounded-2xl border border-[#ded3c8] bg-[#ffffff] px-3 outline-none ring-[#ff9800] focus:ring-2"><option value="">Selecciona una opción…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}<option value="__new__">＋ Añadir nuevo…</option></select>{selectValue === "__new__" && <input autoFocus required={required} value={form[key] || ""} onChange={(event) => change(key, event.target.value)} placeholder={`Escribe ${label.toLowerCase()}`} className="h-11 rounded-2xl border border-[#ff9800] bg-[#fff6e6] px-3 outline-none ring-[#ff9800] focus:ring-2" />}</label>;
    }
    if (key === "Observaciones") return <label key={key} className="grid gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Observaciones (opcional)</span><textarea rows={4} value={form[key] || ""} onChange={(event) => change(key, event.target.value)} className="w-full rounded-2xl border border-[#ded3c8] bg-[#ffffff] px-3 py-3 outline-none ring-[#ff9800] focus:ring-2" /></label>;
    return <label key={key} className="grid gap-1.5 text-sm"><span className="font-medium">{label}{required && <span className="text-[#65361c]"> *</span>}</span><input required={required} value={form[key] || ""} onChange={(event) => change(key, event.target.value)} className="h-11 rounded-2xl border border-[#ded3c8] bg-[#ffffff] px-3 outline-none ring-[#ff9800] focus:ring-2" /></label>;
  }

  return (
    <main className="min-h-screen bg-[#f7f6f5] text-[#010000]">
      <header className="border-b border-[#ded3c8] border-t-4 border-t-[#ff9800] bg-[#f7f6f5] px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <img src="/stuni-logo.png" alt="STUNI, Sindicato de Trabajadores Unidos" width={2230} height={829} className="h-auto w-28 shrink-0 sm:w-40" />
            <div className="border-l border-[#ded3c8] pl-5">
              <p className="brand-meta text-xs font-semibold uppercase tracking-[.16em] text-[#65361c]">Gestión del sindicato</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Afiliaciones</h1>
              <p className="mt-1 text-sm text-[#65361c]">Altas y actualización de la base de datos</p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#65361c] px-5 py-3 text-right text-white">
            <span className="brand-meta block text-2xl font-bold text-[#fedc5b]">{hasLoaded ? members.length : "—"}</span>
            <span className="brand-meta text-sm">afiliaciones</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl items-start gap-6 px-5 py-7 sm:px-10 lg:grid-cols-[.72fr_1.28fr]">
        <section className="rounded-2xl border border-[#ded3c8] bg-white p-5 shadow-[0_8px_30px_rgba(101,54,28,.06)] sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="brand-meta text-xs font-bold uppercase tracking-[.15em] text-[#65361c]">Directorio</p>
              <h2 className="mt-2 text-xl font-bold">Buscar afiliado</h2>
            </div>
            <span className="brand-meta rounded-full bg-[#fedc5b] px-3 py-1 text-xs font-semibold text-[#65361c]">Privado</span>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Apellidos
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe un apellido…" className="h-12 w-full rounded-xl border border-[#ded3c8] bg-[#f7f6f5] px-4 font-normal outline-none focus:ring-2 focus:ring-[#ff9800]" />
          </label>
          <p className="brand-meta mt-5 border-b border-[#eee7e0] pb-3 text-sm text-[#65361c]">{query ? `${results.length} resultados` : "Afiliaciones"}</p>
          <div className="mt-2 space-y-1">
            {results.slice(0, query ? 30 : 12).map((member, index) => (
              <button key={`${member.DNI}-${index}`} onClick={() => selectMember(member)} className="group w-full rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-[#ff9800] hover:bg-[#fff6e6]">
                <span className="block text-sm font-semibold">{member.APELLIDOS}, {member.Nombre}</span>
                <span className="mt-1 block text-sm text-[#65361c]">{member.TIENDA || "Sin tienda"} · {member.PROVINCIA || "Sin provincia"}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[#ded3c8] bg-white p-5 shadow-[0_8px_30px_rgba(101,54,28,.06)] sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#eee7e0] pb-5">
            <div>
              <p className="brand-meta text-xs font-bold uppercase tracking-[.15em] text-[#65361c]">Ficha de afiliación</p>
              <h2 className="mt-2 text-xl font-bold">{selected ? "Editar afiliación" : "Nueva afiliación"}</h2>
              <p className="mt-2 text-sm text-[#65361c]">Los campos con asterisco son necesarios.</p>
            </div>
            {selected && <button type="button" onClick={() => { setSelected(null); setForm({}); setNewFields(new Set()); }} className="shrink-0 rounded-xl border border-[#ff9800] px-3 py-2 text-sm font-semibold text-[#65361c] hover:bg-[#fff6e6]">Nueva alta</button>}
          </div>
          <form onSubmit={submit} className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {fields.map(([key, label, required]) => renderField(key, label, required))}
            <div className="flex flex-col gap-4 border-t border-[#eee7e0] pt-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-2">
                <span role="status" className="brand-meta text-sm text-[#65361c]">{status}</span>
                <button type="button" disabled={busy} onClick={() => load().catch((error) => setStatus(error.message))} className="text-left text-sm font-semibold text-[#65361c] underline decoration-[#ff9800] underline-offset-4">Actualizar datos y opciones</button>
              </div>
              <button disabled={busy || !hasLoaded} className="shrink-0 rounded-xl bg-[#ff9800] px-5 py-3 text-sm font-bold text-[#010000] shadow-[0_5px_15px_rgba(255,152,0,.18)] transition hover:bg-[#fedc5b] disabled:opacity-50">{busy ? "Guardando…" : selected ? "Guardar cambios" : "Guardar afiliación"}</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
